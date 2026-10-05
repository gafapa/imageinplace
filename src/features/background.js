const MAX_COLOR_DISTANCE = Math.sqrt(3 * 255 * 255);
const TRANSPARENT_ALPHA = 16;
const MAX_BORDER_SAMPLES = 8000;

/** Load any image URL into a canvas, optionally downscaled so its longest side fits maxSide. */
export async function canvasFromUrl(url, maxSide = Infinity, maxPixels = 40_000_000) {
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    element.src = url;
  });
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  if (width * height > maxPixels) throw new Error('La imagen es demasiado grande para procesarla en el navegador.');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  return canvas;
}

function borderIndices(width, height) {
  const perimeter = width === 1 || height === 1 ? width * height : 2 * (width + height) - 4;
  const step = Math.max(1, Math.floor(perimeter / MAX_BORDER_SAMPLES));
  const indices = [];
  let position = 0;
  const visit = (x, y) => { if (position++ % step === 0) indices.push(y * width + x); };
  for (let x = 0; x < width; x += 1) visit(x, 0);
  if (height > 1) for (let x = 0; x < width; x += 1) visit(x, height - 1);
  for (let y = 1; y < height - 1; y += 1) { visit(0, y); if (width > 1) visit(width - 1, y); }
  return indices;
}

/**
 * Estimate the background from the image border: either mostly transparent, or the
 * dominant border colour (border pixels are bucketed and the busiest bucket is averaged).
 */
export function estimateBackground({ data, width, height }) {
  const indices = borderIndices(width, height);
  const buckets = new Map();
  let transparent = 0;
  for (const index of indices) {
    const offset = index * 4;
    if (data[offset + 3] < TRANSPARENT_ALPHA) { transparent += 1; continue; }
    const key = ((data[offset] >> 4) << 8) | ((data[offset + 1] >> 4) << 4) | (data[offset + 2] >> 4);
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1; bucket.r += data[offset]; bucket.g += data[offset + 1]; bucket.b += data[offset + 2];
    buckets.set(key, bucket);
  }
  if (transparent >= indices.length / 2) return { transparent: true, coverage: transparent / indices.length };
  let best = null;
  buckets.forEach((bucket) => { if (!best || bucket.count > best.count) best = bucket; });
  return {
    transparent: false,
    color: [Math.round(best.r / best.count), Math.round(best.g / best.count), Math.round(best.b / best.count)],
    coverage: best.count / indices.length,
  };
}

const distanceTo = (data, offset, [r, g, b]) => {
  const dr = data[offset] - r; const dg = data[offset + 1] - g; const db = data[offset + 2] - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

/**
 * Make the background transparent in place.
 * tolerance/softness are percentages of the maximum RGB distance. By default only background
 * connected to the image edge is removed; `interior` also clears enclosed areas of the same colour.
 * Returns the share of pixels that became fully transparent.
 */
export function removeBackground(imageData, { tolerance = 15, softness = 8, interior = false } = {}) {
  const { data, width, height } = imageData;
  const background = estimateBackground(imageData);
  if (background.transparent) return { removedShare: 0, background };
  const color = background.color;
  const hard = (Math.max(0, tolerance) / 100) * MAX_COLOR_DISTANCE;
  const soft = (Math.max(0, softness) / 100) * MAX_COLOR_DISTANCE;
  const total = width * height;
  let removed = 0;

  // Partially transparent edge pixels get the background colour "unmixed" so no halo remains.
  const fade = (offset, distance) => {
    const alpha = Math.min(1, (distance - hard) / soft);
    for (let channel = 0; channel < 3; channel += 1) {
      const value = (data[offset + channel] - color[channel] * (1 - alpha)) / alpha;
      data[offset + channel] = Math.max(0, Math.min(255, Math.round(value)));
    }
    data[offset + 3] = Math.round(data[offset + 3] * alpha);
  };
  const clear = (offset) => { data[offset + 3] = 0; removed += 1; };

  if (interior) {
    for (let index = 0; index < total; index += 1) {
      const offset = index * 4;
      if (data[offset + 3] === 0) continue;
      const distance = distanceTo(data, offset, color);
      if (distance <= hard) clear(offset);
      else if (soft > 0 && distance < hard + soft) fade(offset, distance);
    }
    return { removedShare: removed / total, background };
  }

  const state = new Uint8Array(total); // 0 unseen, 1 queued/cleared, 2 edge (faded or kept)
  const queue = new Int32Array(total);
  let head = 0; let tail = 0;
  const consider = (index) => {
    if (state[index]) return;
    const offset = index * 4;
    const distance = distanceTo(data, offset, color);
    if (distance <= hard || data[offset + 3] < TRANSPARENT_ALPHA) {
      state[index] = 1; queue[tail++] = index; clear(offset);
    } else {
      state[index] = 2;
      if (soft > 0 && distance < hard + soft) fade(offset, distance);
    }
  };
  // Seed the fill with every edge pixel; estimateBackground only samples them.
  for (let x = 0; x < width; x += 1) { consider(x); consider((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { consider(y * width); consider(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    if (x > 0) consider(index - 1);
    if (x < width - 1) consider(index + 1);
    if (index >= width) consider(index - width);
    if (index < total - width) consider(index + width);
  }
  return { removedShare: removed / total, background };
}

/**
 * Bounding box of the content: pixels that are not transparent and, when the border is a solid
 * colour, differ from it by more than `tolerance` percent. Returns null for an empty image.
 */
export function findContentBounds(imageData, { tolerance = 8 } = {}) {
  const { data, width, height } = imageData;
  const background = estimateBackground(imageData);
  const limit = (Math.max(0, tolerance) / 100) * MAX_COLOR_DISTANCE;
  const isContent = (offset) => data[offset + 3] >= TRANSPARENT_ALPHA
    && (background.transparent || distanceTo(data, offset, background.color) > limit);
  let top = -1; let bottom = -1; let left = width; let right = -1;
  for (let y = 0; y < height; y += 1) {
    let rowHasContent = false;
    for (let x = 0; x < width; x += 1) {
      if (!isContent((y * width + x) * 4)) continue;
      rowHasContent = true;
      if (x < left) left = x;
      if (x > right) right = x;
    }
    if (rowHasContent) { if (top < 0) top = y; bottom = y; }
  }
  if (top < 0) return { bounds: null, background };
  return { bounds: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }, background };
}

/** Copy `bounds` from a canvas into a new one with `padding` pixels around it. */
export function cropCanvas(canvas, bounds, padding = 0, background = { transparent: true }) {
  const pad = Math.max(0, Math.round(padding));
  const output = document.createElement('canvas');
  output.width = bounds.width + pad * 2;
  output.height = bounds.height + pad * 2;
  const context = output.getContext('2d');
  if (pad && !background.transparent) {
    context.fillStyle = `rgb(${background.color.join(',')})`;
    context.fillRect(0, 0, output.width, output.height);
  }
  context.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, pad, pad, bounds.width, bounds.height);
  return output;
}

/** JPEG has no alpha: paint transparent areas white instead of letting them turn black. */
export function flattenForFormat(canvas, type) {
  if (type !== 'image/jpeg') return canvas;
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;
  const context = output.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(canvas, 0, 0);
  return output;
}

export const canvasToBlob = (canvas, type = 'image/png', quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo codificar la imagen.'))), type, quality);
});
