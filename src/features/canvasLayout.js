const MAX_DIMENSION = 12000;
const MAX_AREA = 100_000_000;

export const CANVAS_ALIGNMENTS = [
  ['top-left', '↖'], ['top-center', '↑'], ['top-right', '↗'],
  ['center-left', '←'], ['center', '•'], ['center-right', '→'],
  ['bottom-left', '↙'], ['bottom-center', '↓'], ['bottom-right', '↘'],
];

const numberOr = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function validateCanvasSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('Las dimensiones deben ser números enteros positivos.');
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_AREA) throw new Error('El lienzo es demasiado grande. Reduce sus dimensiones.');
}

function getOffset(alignment, availableWidth, availableHeight, imageWidth, imageHeight) {
  const horizontal = alignment.endsWith('left') ? 0 : alignment.endsWith('right') ? availableWidth - imageWidth : (availableWidth - imageWidth) / 2;
  const vertical = alignment.startsWith('top') ? 0 : alignment.startsWith('bottom') ? availableHeight - imageHeight : (availableHeight - imageHeight) / 2;
  return { x: horizontal, y: vertical };
}

/** Render a non-distorted image inside a fixed canvas with padding and alignment. */
export function renderCanvasLayout(source, options = {}, targetCanvas = document.createElement('canvas')) {
  if (!source) throw new Error('No hay una imagen para colocar en el lienzo.');
  const width = Math.round(numberOr(options.width, source.naturalWidth || source.width));
  const height = Math.round(numberOr(options.height, source.naturalHeight || source.height));
  const padding = Math.max(0, Math.round(numberOr(options.padding, 0)));
  const borderWidth = Math.max(0, Math.round(numberOr(options.borderWidth, 0)));
  validateCanvasSize(width, height);
  if (padding * 2 + borderWidth * 2 >= width || padding * 2 + borderWidth * 2 >= height) throw new Error('El relleno y el borde dejan un área insuficiente.');

  targetCanvas.width = width;
  targetCanvas.height = height;
  const context = targetCanvas.getContext('2d');
  if (!context) throw new Error('El navegador no admite lienzos 2D.');
  context.clearRect(0, 0, width, height);
  const background = options.background || 'white';
  if (background !== 'transparent') {
    context.fillStyle = background === 'custom' ? (options.backgroundColor || '#ffffff') : '#ffffff';
    context.fillRect(0, 0, width, height);
  }

  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  if (!sourceWidth || !sourceHeight) throw new Error('No se pudieron leer las dimensiones de la imagen.');
  const availableWidth = width - padding * 2 - borderWidth * 2;
  const availableHeight = height - padding * 2 - borderWidth * 2;
  const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
  const imageWidth = Math.max(1, Math.round(sourceWidth * scale));
  const imageHeight = Math.max(1, Math.round(sourceHeight * scale));
  const offset = getOffset(options.alignment || 'center', availableWidth, availableHeight, imageWidth, imageHeight);
  const x = padding + borderWidth + offset.x;
  const y = padding + borderWidth + offset.y;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, x, y, imageWidth, imageHeight);

  if (borderWidth > 0) {
    context.strokeStyle = options.borderColor || '#111111';
    context.lineWidth = borderWidth;
    context.strokeRect(borderWidth / 2, borderWidth / 2, width - borderWidth, height - borderWidth);
  }
  return targetCanvas;
}

