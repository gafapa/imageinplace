const MIME_EXTENSIONS = { 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/png': '.png', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif' };
const RESERVED = /^(con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])(?:\..*)?$/i;

const extensionFor = (item) => {
  if (MIME_EXTENSIONS[item.type]) return MIME_EXTENSIONS[item.type];
  const fromName = String(item.name || '').match(/(\.[^.]*)$/)?.[1];
  return (fromName || '.jpg').toLowerCase();
};
const stemFor = (item) => String(item.name || 'imagen').replace(/\.[^.]*$/, '');

export function sanitizeFilename(value, fallback = 'imagen') {
  // Control characters are invalid in filenames on every platform, so matching them is intentional.
  // eslint-disable-next-line no-control-regex
  let result = String(value ?? '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').trim();
  if (!result) result = fallback;
  if (RESERVED.test(result)) result = `_${result}`;
  return result.slice(0, 180).replace(/[. ]+$/g, '') || fallback;
}

/** Generate safe, unique names while preserving each image's MIME extension. */
export function createRenames(items, { pattern = '{name}-{n}', start = 1, padding = 2 } = {}, allItems = items) {
  const selectedIds = new Set(items.map((item) => item.id));
  const used = new Set(allItems.filter((item) => !selectedIds.has(item.id)).map((item) => String(item.name || '').toLowerCase()));
  const names = [];
  const first = Number.isFinite(Number(start)) ? Math.max(0, Math.floor(Number(start))) : 1;
  const width = Math.max(1, Math.min(8, Math.floor(Number(padding) || 1)));
  items.forEach((item, index) => {
    const number = String(first + index).padStart(width, '0');
    const raw = String(pattern || '{name}-{n}').replaceAll('{name}', stemFor(item)).replaceAll('{n}', number);
    const base = sanitizeFilename(raw, 'imagen');
    const extension = extensionFor(item);
    let candidate = `${base}${extension}`;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) candidate = `${base} (${suffix++})${extension}`;
    used.add(candidate.toLowerCase());
    names.push({ id: item.id, name: candidate });
  });
  return names;
}
