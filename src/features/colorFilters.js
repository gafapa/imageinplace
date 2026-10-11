/**
 * Pixel implementation of the CSS filter chain used by renderImage, for browsers whose
 * canvas ignores `context.filter` (Safari for years). Matrices follow the Filter Effects spec.
 */

const clamp255 = (value) => (value < 0 ? 0 : value > 255 ? 255 : value);

const saturateMatrix = (s) => [
  0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
  0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
  0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
];

const grayscaleMatrix = (g) => {
  const a = 1 - g;
  return [
    0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a,
    0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a,
    0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a,
  ];
};

const sepiaMatrix = (s) => {
  const a = 1 - s;
  return [
    0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a,
    0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a,
    0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a,
  ];
};

/** Ordered colour steps for the settings; identity steps are omitted. Each step clamps like a filter primitive. */
export function colorSteps({ brightness = 100, contrast = 100, saturation = 100, grayscale = 0, sepia = 0 }) {
  const steps = [];
  if (brightness !== 100) steps.push({ slope: brightness / 100, intercept: 0 });
  if (contrast !== 100) steps.push({ slope: contrast / 100, intercept: 255 * (0.5 - 0.5 * (contrast / 100)) });
  if (saturation !== 100) steps.push({ matrix: saturateMatrix(saturation / 100) });
  if (grayscale) steps.push({ matrix: grayscaleMatrix(Math.min(1, grayscale / 100)) });
  if (sepia) steps.push({ matrix: sepiaMatrix(Math.min(1, sepia / 100)) });
  return steps;
}

/** Apply colour steps in place to RGBA data (unpremultiplied, as returned by getImageData). */
export function applyColorSteps(data, steps) {
  if (!steps.length) return;
  for (let offset = 0; offset < data.length; offset += 4) {
    let r = data[offset];
    let g = data[offset + 1];
    let b = data[offset + 2];
    for (const step of steps) {
      if (step.matrix) {
        const m = step.matrix;
        const nr = m[0] * r + m[1] * g + m[2] * b;
        const ng = m[3] * r + m[4] * g + m[5] * b;
        const nb = m[6] * r + m[7] * g + m[8] * b;
        r = clamp255(nr); g = clamp255(ng); b = clamp255(nb);
      } else {
        r = clamp255(r * step.slope + step.intercept);
        g = clamp255(g * step.slope + step.intercept);
        b = clamp255(b * step.slope + step.intercept);
      }
    }
    data[offset] = r; data[offset + 1] = g; data[offset + 2] = b;
  }
}

/** Box sizes whose three successive passes approximate a Gaussian with the given standard deviation. */
export function boxesForGauss(sigma, count = 3) {
  const ideal = Math.sqrt((12 * sigma * sigma) / count + 1);
  let lower = Math.floor(ideal);
  if (lower % 2 === 0) lower -= 1;
  const upper = lower + 2;
  const m = Math.round((12 * sigma * sigma - count * lower * lower - 4 * count * lower - 3 * count) / (-4 * lower - 4));
  return Array.from({ length: count }, (_, index) => (index < m ? lower : upper));
}

function boxPass(source, target, width, height, radius, horizontal) {
  const size = radius * 2 + 1;
  const lines = horizontal ? height : width;
  const length = horizontal ? width : height;
  const stride = horizontal ? 4 : width * 4;
  for (let line = 0; line < lines; line += 1) {
    const base = horizontal ? line * width * 4 : line * 4;
    for (let channel = 0; channel < 4; channel += 1) {
      // Pixels outside the image count as transparent black, as with the CSS blur filter.
      let sum = 0;
      for (let i = 0; i <= Math.min(radius, length - 1); i += 1) sum += source[base + i * stride + channel];
      for (let i = 0; i < length; i += 1) {
        target[base + i * stride + channel] = sum / size;
        const add = i + radius + 1;
        const remove = i - radius;
        if (add < length) sum += source[base + add * stride + channel];
        if (remove >= 0) sum -= source[base + remove * stride + channel];
      }
    }
  }
}

/** Gaussian-like blur in place on RGBA data; blurs premultiplied colour so transparent pixels do not bleed. */
export function blurImageData({ data, width, height }, sigma) {
  if (!(sigma > 0)) return;
  const work = new Float32Array(data.length);
  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3] / 255;
    work[offset] = data[offset] * alpha;
    work[offset + 1] = data[offset + 1] * alpha;
    work[offset + 2] = data[offset + 2] * alpha;
    work[offset + 3] = data[offset + 3];
  }
  const temp = new Float32Array(data.length);
  for (const box of boxesForGauss(sigma)) {
    const radius = (box - 1) / 2;
    if (!radius) continue;
    boxPass(work, temp, width, height, radius, true);
    boxPass(temp, work, width, height, radius, false);
  }
  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = work[offset + 3];
    const scale = alpha > 0 ? 255 / alpha : 0;
    data[offset] = clamp255(Math.round(work[offset] * scale));
    data[offset + 1] = clamp255(Math.round(work[offset + 1] * scale));
    data[offset + 2] = clamp255(Math.round(work[offset + 2] * scale));
    data[offset + 3] = clamp255(Math.round(alpha));
  }
}

let filterSupport;
/** Whether this browser's canvas honours `context.filter` (detected once by drawing through brightness(0)). */
export function canvasFilterSupported() {
  if (filterSupport !== undefined) return filterSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const source = document.createElement('canvas');
    source.width = 1; source.height = 1;
    const sourceContext = source.getContext('2d');
    sourceContext.fillStyle = '#ffffff';
    sourceContext.fillRect(0, 0, 1, 1);
    context.filter = 'brightness(0%)';
    context.drawImage(source, 0, 0);
    filterSupport = context.getImageData(0, 0, 1, 1).data[0] < 128;
  } catch { filterSupport = false; }
  return filterSupport;
}
