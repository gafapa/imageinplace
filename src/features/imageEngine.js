import { validateDimensions } from './imageLimits.js';
import { applyColorSteps, blurImageData, canvasFilterSupported, colorSteps } from './colorFilters.js';

export const initialSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  sepia: 0,
  blur: 0,
  rotation: 0,
  flipX: false,
  cropTop: 0,
  cropRight: 0,
  cropBottom: 0,
  cropLeft: 0,
  cropRatio: 0,
  watermarkText: '',
  watermarkPosition: 'bottom-right',
  watermarkSize: 5,
  watermarkOpacity: 70,
  format: 'image/jpeg',
  quality: 84,
};

const PIXEL_BLOCKS = 8;
const MIN_PIXEL_BLOCK = 16;

export const MIME_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Format used when saving edited pixels: keep lossy originals lossy, everything else PNG. */
export function saveFormatFor(type) {
  return type === 'image/jpeg' || type === 'image/webp' ? type : 'image/png';
}

export const SAVE_QUALITY = 0.92;

/** Default settings whose export format matches the image, so PNG transparency and sharp text survive a download. */
export function settingsFor(type) {
  return { ...initialSettings, format: saveFormatFor(type) };
}

/** Shared export format for several images: their common format, otherwise PNG when any needs it. */
export function batchFormatFor(types) {
  const formats = new Set(types.map(saveFormatFor));
  if (formats.size === 1) return [...formats][0];
  return formats.has('image/png') ? 'image/png' : 'image/jpeg';
}

/** Replace a filename's extension so it matches the blob's MIME type. */
export function nameForType(name, type) {
  const extension = MIME_EXTENSIONS[type];
  if (!extension) return name;
  const stem = String(name || 'imagen').replace(/\.[^.]+$/, '') || 'imagen';
  return `${stem}.${extension}`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

export function getCrop(settings, width, height) {
  if (settings.cropRatio > 0) {
    const sw = Math.min(width, height * settings.cropRatio);
    const sh = sw / settings.cropRatio;
    return { sx: (width - sw) / 2, sy: (height - sh) / 2, sw: Math.max(1, Math.round(sw)), sh: Math.max(1, Math.round(sh)) };
  }
  const left = Math.round((settings.cropLeft / 100) * width);
  const top = Math.round((settings.cropTop / 100) * height);
  const right = Math.round((settings.cropRight / 100) * width);
  const bottom = Math.round((settings.cropBottom / 100) * height);
  return {
    sx: left,
    sy: top,
    sw: Math.max(1, width - left - right),
    sh: Math.max(1, height - top - bottom),
  };
}

export function renderImage(source, canvas, settings, outputSize, privacyAreas) {
  if (!source || !canvas) return;
  const crop = getCrop(settings, source.naturalWidth, source.naturalHeight);
  const quarterTurn = Math.abs(settings.rotation % 180) === 90;
  const outputScale = outputSize.width && outputSize.height ? Math.min(outputSize.width / crop.sw, outputSize.height / crop.sh) : 1;
  const baseWidth = Math.max(1, Math.round(crop.sw * outputScale));
  const baseHeight = Math.max(1, Math.round(crop.sh * outputScale));
  validateDimensions(baseWidth, baseHeight);
  canvas.width = quarterTurn ? baseHeight : baseWidth;
  canvas.height = quarterTurn ? baseWidth : baseHeight;

  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((settings.rotation * Math.PI) / 180);
  context.scale(settings.flipX ? -1 : 1, 1);
  const nativeFilter = canvasFilterSupported();
  if (nativeFilter) context.filter = `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%) grayscale(${settings.grayscale}%) sepia(${settings.sepia}%) blur(${settings.blur}px)`;
  context.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, -baseWidth / 2, -baseHeight / 2, baseWidth, baseHeight);
  context.restore();
  if (!nativeFilter) {
    const steps = colorSteps(settings);
    if (steps.length || settings.blur > 0) {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      applyColorSteps(pixels.data, steps);
      blurImageData(pixels, settings.blur);
      context.putImageData(pixels, 0, 0);
    }
  }

  if (privacyAreas.length) {
    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext('2d').drawImage(canvas, 0, 0);
    privacyAreas.forEach((area) => {
      const x = area.x * canvas.width;
      const y = area.y * canvas.height;
      const width = area.width * canvas.width;
      const height = area.height * canvas.height;
      if (area.mode === 'fill') {
        context.fillStyle = '#000000';
        context.fillRect(Math.floor(x), Math.floor(y), Math.ceil(width) + 1, Math.ceil(height) + 1);
        return;
      }
      // Blocks scale with the area so a face never keeps more than ~PIXEL_BLOCKS blocks on its short side.
      const block = Math.max(MIN_PIXEL_BLOCK, Math.min(width, height) / PIXEL_BLOCKS);
      const small = document.createElement('canvas');
      small.width = Math.max(1, Math.round(width / block));
      small.height = Math.max(1, Math.round(height / block));
      const smallContext = small.getContext('2d');
      smallContext.imageSmoothingEnabled = false;
      smallContext.drawImage(snapshot, x, y, width, height, 0, 0, small.width, small.height);
      context.imageSmoothingEnabled = false;
      context.drawImage(small, 0, 0, small.width, small.height, x, y, width, height);
      context.imageSmoothingEnabled = true;
    });
  }

  if (settings.watermarkText.trim()) {
    const padding = Math.max(18, canvas.width * 0.025);
    const fontSize = Math.max(18, canvas.width * (settings.watermarkSize / 100));
    context.save();
    context.globalAlpha = settings.watermarkOpacity / 100;
    context.font = `700 ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(0, 0, 0, 0.55)';
    context.shadowBlur = fontSize * 0.18;
    context.fillStyle = '#ffffff';
    const textWidth = context.measureText(settings.watermarkText).width;
    const positions = {
      'top-left': [padding, padding + fontSize / 2],
      'top-right': [canvas.width - textWidth - padding, padding + fontSize / 2],
      center: [(canvas.width - textWidth) / 2, canvas.height / 2],
      'bottom-left': [padding, canvas.height - padding - fontSize / 2],
      'bottom-right': [canvas.width - textWidth - padding, canvas.height - padding - fontSize / 2],
    };
    context.fillText(settings.watermarkText, ...(positions[settings.watermarkPosition] || positions['bottom-right']));
    context.restore();
  }
}
