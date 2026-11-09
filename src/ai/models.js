/** Pure pre- and post-processing for the on-device models (unit-tested; also used inside the worker). */

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/** U²-Net input: RGB scaled by the image maximum, ImageNet-normalised, planar (CHW). */
export function salientInput(pixels, size) {
  const plane = size * size;
  let max = 0;
  for (let index = 0; index < plane; index += 1) {
    const offset = index * 4;
    max = Math.max(max, pixels[offset], pixels[offset + 1], pixels[offset + 2]);
  }
  const scale = max || 1;
  const input = new Float32Array(3 * plane);
  for (let index = 0; index < plane; index += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      input[channel * plane + index] = (pixels[index * 4 + channel] / scale - MEAN[channel]) / STD[channel];
    }
  }
  return input;
}

function intersectionOverUnion(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = width * height;
  return intersection / (a.width * a.height + b.width * b.height - intersection || 1);
}

/** Keep the strongest boxes, dropping any that overlap a stronger one by more than `iou`. */
export function suppress(candidates, iou = 0.3) {
  const kept = [];
  for (const candidate of [...candidates].sort((a, b) => b.score - a.score)) {
    if (kept.every((box) => intersectionOverUnion(box, candidate) <= iou)) kept.push(candidate);
  }
  return kept;
}

/** UltraFace output (scores [N,2], boxes [N,4] as normalised corners) to `{ x, y, width, height, score }`. */
export function decodeFaces(scores, boxes, threshold = 0.6) {
  const candidates = [];
  for (let index = 0; index < scores.length / 2; index += 1) {
    const score = scores[index * 2 + 1];
    if (score < threshold) continue;
    const x1 = Math.max(0, boxes[index * 4]); const y1 = Math.max(0, boxes[index * 4 + 1]);
    const x2 = Math.min(1, boxes[index * 4 + 2]); const y2 = Math.min(1, boxes[index * 4 + 3]);
    if (x2 <= x1 || y2 <= y1) continue;
    candidates.push({ x: x1, y: y1, width: x2 - x1, height: y2 - y1, score });
  }
  return suppress(candidates);
}

/** Grow a normalised box by `margin` of its size on every side, clamped to the image. */
export function expandBox({ x, y, width, height }, margin = 0.15) {
  const left = Math.max(0, x - width * margin);
  const top = Math.max(0, y - height * margin);
  const right = Math.min(1, x + width * (1 + margin));
  const bottom = Math.min(1, y + height * (1 + margin));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Smoothstep the model's soft mask so faint halo values vanish and the subject stays opaque. */
export function refineAlpha(value, low = 0.08, high = 0.92) {
  const t = Math.min(1, Math.max(0, (value / 255 - low) / (high - low)));
  return Math.round(t * t * (3 - 2 * t) * 255);
}

const SENSITIVE_PATTERNS = [
  // Labels that introduce personal data, so a misread digit or letter does not hide the line.
  /\b(?:DNI|NIE|NIF|pasaporte|passport|tel[eé]fono|tel\.|m[oó]vil|e-?mail|correo|direcci[oó]n|domicilio|nacimiento|NUSS|CIP|SIP)\b/i,
  /\b\d{8}\s?[-‐]?\s?[A-Z0-9]\b/i, // DNI (OCR may read the letter as a digit)
  /\b[XYZ]\s?[-‐]?\s?\d{7}\s?[-‐]?\s?[A-Z]\b/i, // NIE
  /[\w.+-]+@[\w-]+\.[\w.]+/, // e-mail
  /(?:\+34|0034)?[\s-]?[6789](?:[\s-]?\d){8}\b/, // Spanish phone
  /\bES\d{2}(?:\s?\d{4}){5}\b/i, // IBAN
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/, // dates (e.g. birth dates)
];

/** Whether a recognised line looks like personal data that is usually hidden by default. */
export function looksSensitive(text) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}
