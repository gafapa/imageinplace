const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Draw normalized annotations on an already rendered image canvas. */
export function renderAnnotations(context, annotations = [], width, height) {
  if (!context) return;
  annotations.forEach((annotation) => {
    const x = clamp(Number(annotation.x) || 0, 0, 1) * width;
    const y = clamp(Number(annotation.y) || 0, 0, 1) * height;
    const w = (annotation.type === 'arrow' ? Math.max(-1, Math.min(1, Number(annotation.width) || 0)) : clamp(Number(annotation.width) || 0, 0, 1)) * width;
    const h = (annotation.type === 'arrow' ? Math.max(-1, Math.min(1, Number(annotation.height) || 0)) : clamp(Number(annotation.height) || 0, 0, 1)) * height;
    const color = annotation.color || '#e23b32';
    context.save();
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = Math.max(2, Number(annotation.strokeWidth) || Math.max(2, width / 400));
    if (annotation.type === 'text') {
      context.font = `700 ${Math.max(12, Number(annotation.fontSize) || Math.max(18, width / 24))}px sans-serif`;
      context.textBaseline = 'top';
      context.fillText(String(annotation.text || ''), x, y);
    } else if (annotation.type === 'arrow') {
      const endX = x + w; const endY = y + h;
      const angle = Math.atan2(endY - y, endX - x); const head = Math.max(8, context.lineWidth * 4);
      context.beginPath(); context.moveTo(x, y); context.lineTo(endX, endY); context.stroke();
      context.beginPath(); context.moveTo(endX, endY); context.lineTo(endX - head * Math.cos(angle - Math.PI / 6), endY - head * Math.sin(angle - Math.PI / 6)); context.lineTo(endX - head * Math.cos(angle + Math.PI / 6), endY - head * Math.sin(angle + Math.PI / 6)); context.closePath(); context.fill();
    } else if (annotation.type === 'ellipse') {
      context.beginPath(); context.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); context.stroke();
    } else if (annotation.type === 'marker') {
      const radius = Math.max(10, Number(annotation.fontSize) || Math.abs(w || h) / 2 || width / 35);
      context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#ffffff'; context.font = `700 ${Math.max(12, radius)}px sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(annotation.text || annotation.number || '1'), x, y);
    } else {
      context.strokeRect(x, y, w, h);
    }
    context.restore();
  });
}

export const annotationDefaults = (type, index = 0) => ({ id: crypto.randomUUID(), type, x: 0.25, y: 0.25, width: type === 'text' || type === 'marker' ? 0 : 0.3, height: type === 'text' || type === 'marker' ? 0 : 0.2, color: '#e23b32', text: type === 'marker' ? String(index + 1) : 'Texto', fontSize: 32, strokeWidth: 5 });
