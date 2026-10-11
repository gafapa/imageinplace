import { validateDimensions } from './imageLimits.js';

export const defaultCorners = () => [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
export const defaultCrop = () => ({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function rotationSize(width, height, angle) {
  if (!Number.isFinite(angle) || Math.abs(angle) > 15) throw new Error('El ángulo debe estar entre −15° y 15°.');
  const radians = angle * Math.PI / 180;
  const size = { width: Math.ceil(Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians)) - 1e-8),
    height: Math.ceil(Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians)) - 1e-8) };
  validateDimensions(size.width, size.height);
  return size;
}

export function cropBounds(width, height, crop) {
  const values = [crop.x, crop.y, crop.width, crop.height];
  if (!values.every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0
    || crop.x + crop.width > 1 + 1e-8 || crop.y + crop.height > 1 + 1e-8) throw new Error('El recorte debe quedar dentro de la imagen.');
  const x = Math.round(crop.x * width); const y = Math.round(crop.y * height);
  const right = Math.min(width, Math.round((crop.x + crop.width) * width));
  const bottom = Math.min(height, Math.round((crop.y + crop.height) * height));
  if (right <= x || bottom <= y) throw new Error('El recorte debe contener al menos un píxel.');
  return { x, y, width: right - x, height: bottom - y };
}

export function validateCorners(points) {
  if (!Array.isArray(points) || points.length !== 4 || points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) throw new Error('Las cuatro esquinas deben quedar dentro de la imagen.');
  for (let i = 0; i < 4; i += 1) {
    const a = points[i]; const b = points[(i + 1) % 4]; const c = points[(i + 2) % 4];
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 0.00001) throw new Error('Las esquinas deben formar un cuadrilátero sin cruces: superior izquierda, superior derecha, inferior derecha e inferior izquierda.');
  }
}

export function perspectiveSize(width, height, points) {
  validateCorners(points);
  const length = (a, b) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
  const size = { width: Math.max(1, Math.round((length(points[0], points[1]) + length(points[3], points[2])) / 2)),
    height: Math.max(1, Math.round((length(points[0], points[3]) + length(points[1], points[2])) / 2)) };
  validateDimensions(size.width, size.height);
  return size;
}

/** Map the unit square into an ordered, convex quadrilateral using a homography. */
export function squareToQuad(points) {
  validateCorners(points);
  const [a, b, c, d] = points;
  const dx1 = b.x - c.x; const dx2 = d.x - c.x; const dx3 = a.x - b.x + c.x - d.x;
  const dy1 = b.y - c.y; const dy2 = d.y - c.y; const dy3 = a.y - b.y + c.y - d.y;
  let g = 0; let h = 0;
  if (Math.abs(dx3) + Math.abs(dy3) > 1e-10) {
    const denominator = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(denominator) < 1e-12) throw new Error('No se puede corregir esta selección. Separa las esquinas.');
    g = (dx3 * dy2 - dx2 * dy3) / denominator;
    h = (dx1 * dy3 - dx3 * dy1) / denominator;
  }
  return [b.x - a.x + g * b.x, d.x - a.x + h * d.x, a.x,
    b.y - a.y + g * b.y, d.y - a.y + h * d.y, a.y, g, h];
}

export function projectPoint(matrix, x, y) {
  const denominator = matrix[6] * x + matrix[7] * y + 1;
  return { x: (matrix[0] * x + matrix[1] * y + matrix[2]) / denominator,
    y: (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator };
}

/** Bilinear, premultiplied-alpha resampling avoids dark fringes around transparent pixels. */
export function warpPerspective(source, points, size) {
  validateDimensions(source.width, source.height);
  validateDimensions(size.width, size.height);
  const matrix = squareToQuad(points);
  const output = new Uint8ClampedArray(size.width * size.height * 4);
  const pixels = source.data;
  if (pixels.length !== source.width * source.height * 4) throw new Error('Datos de imagen incompletos.');
  for (let y = 0; y < size.height; y += 1) for (let x = 0; x < size.width; x += 1) {
    const u = (x + 0.5) / size.width; const v = (y + 0.5) / size.height;
    const denominator = matrix[6] * u + matrix[7] * v + 1;
    const sx = clamp((matrix[0] * u + matrix[1] * v + matrix[2]) / denominator * source.width - 0.5, 0, source.width - 1);
    const sy = clamp((matrix[3] * u + matrix[4] * v + matrix[5]) / denominator * source.height - 0.5, 0, source.height - 1);
    const left = Math.floor(sx); const top = Math.floor(sy);
    const right = Math.min(source.width - 1, left + 1); const bottom = Math.min(source.height - 1, top + 1);
    const fx = sx - left; const fy = sy - top;
    const target = (y * size.width + x) * 4;
    let alpha = 0; let red = 0; let green = 0; let blue = 0;
    for (let i = 0; i < 4; i += 1) {
      const offset = ((i > 1 ? bottom : top) * source.width + (i & 1 ? right : left)) * 4;
      const weight = (i & 1 ? fx : 1 - fx) * (i > 1 ? fy : 1 - fy) * pixels[offset + 3];
      alpha += weight; red += pixels[offset] * weight; green += pixels[offset + 1] * weight; blue += pixels[offset + 2] * weight;
    }
    if (alpha > 0) { output[target] = red / alpha; output[target + 1] = green / alpha; output[target + 2] = blue / alpha; }
    output[target + 3] = alpha;
  }
  return output;
}

export function geometrySize(width, height, tool, options) {
  if (tool === 'deskew') return rotationSize(width, height, options.angle);
  if (tool === 'visualcrop') return cropBounds(width, height, options.crop);
  return perspectiveSize(width, height, options.points);
}

export function renderGeometryCanvas(source, tool, options) {
  const width = source.naturalWidth || source.width; const height = source.naturalHeight || source.height;
  const size = geometrySize(width, height, tool, options);
  const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (tool === 'deskew') {
    if (options.background !== 'transparent') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.translate(canvas.width / 2, canvas.height / 2); context.rotate(options.angle * Math.PI / 180);
    context.drawImage(source, -width / 2, -height / 2);
  } else if (tool === 'visualcrop') context.drawImage(source, size.x, size.y, size.width, size.height, 0, 0, size.width, size.height);
  else {
    const input = document.createElement('canvas'); input.width = width; input.height = height;
    const inputContext = input.getContext('2d', { willReadFrequently: true }); inputContext.drawImage(source, 0, 0);
    context.putImageData(new ImageData(warpPerspective(inputContext.getImageData(0, 0, width, height), options.points, size), size.width, size.height), 0, 0);
  }
  return canvas;
}
