const clamp = (value, low = 0, high = 255) => Math.min(high, Math.max(low, value));
const luminance = (data, offset) => 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];

/** 1st–99th percentile luminance of the visible pixels; transparent pixels often hide arbitrary RGB values. */
function tonalRange({ data }) {
  const histogram = new Uint32Array(256);
  let count = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] < 128) continue;
    histogram[Math.round(luminance(data, offset))]++; count++;
  }
  const percentile = (share) => {
    let total = 0;
    for (let value = 0; value < 256; value++) { total += histogram[value]; if (total >= Math.max(1, count * share)) return value; }
    return 0;
  };
  return { count, low: percentile(0.01), high: percentile(0.99) };
}

/** Conservative 3x3 impulse removal, edge-aware smoothing, and thresholded unsharp masking. */
export function restorePixels(image, options = {}) {
  const { data, width, height } = image;
  const strength = (key) => clamp(Number(options[key]) || 0, 0, 100) / 100;
  const dust = strength('dust'); const noise = strength('noise'); const sharpen = strength('sharpen');
  if (dust || noise || sharpen) {
    const source = data.slice();
    const neighbors = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (!source[offset + 3]) continue;
      for (let channel = 0; channel < 3; channel++) {
        neighbors.length = 0;
        let sum = 0; let weight = 0; let average = 0;
        const center = source[offset + channel];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = clamp(x + dx, 0, width - 1); const ny = clamp(y + dy, 0, height - 1);
          const index = (ny * width + nx) * 4;
          if (!source[index + 3]) continue;
          const value = source[index + channel];
          neighbors.push(value);
          const factor = Math.exp(-((value - center) ** 2) / 800) * source[index + 3] / 255;
          sum += value * factor; weight += factor; average += value;
        }
        neighbors.sort((a, b) => a - b);
        const median = neighbors[Math.floor(neighbors.length / 2)];
        let result = center;
        if (dust && Math.abs(center - median) > 24) result += (median - center) * dust;
        if (noise) result += (sum / weight - result) * noise;
        const detail = center - average / neighbors.length;
        if (sharpen && Math.abs(detail) > 3) result += detail * sharpen * 1.5;
        data[offset + channel] = result;
      }
    }
  }
  const faded = strength('faded'); const color = strength('color');
  const exposure = clamp(Number(options.exposure) || 0, -50, 50);
  if (faded || color || exposure) {
    const { low, high, count } = tonalRange(image);
    const range = high - low;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (!data[offset + 3] || !count) continue;
      const light = luminance(data, offset);
      for (let channel = 0; channel < 3; channel++) {
        const value = data[offset + channel];
        const stretched = range > 16 ? clamp((value - low) * 255 / range) : value;
        data[offset + channel] = value + faded * (stretched - value) + exposure + color * (value - light);
      }
    }
  }
  return image;
}
