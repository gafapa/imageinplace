const TEXT_INPUT_TYPES = new Set(['text', 'number', 'search', 'email', 'url', 'tel', 'password', '']);

/** True when the key press belongs to a field the user is typing into, so app shortcuts must not steal it. */
export function isTextEntry(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && TEXT_INPUT_TYPES.has((target.getAttribute?.('type') || '').toLowerCase());
}

/**
 * Translate a keyboard event into an app command name, or null.
 * Ctrl and Cmd are equivalent so the same shortcuts work on Windows, ChromeOS and macOS.
 */
export function shortcutFor(event) {
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (mod && !event.altKey) {
    if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
    if (key === 'y' && !event.shiftKey) return 'redo';
    if (key === 'a' && !event.shiftKey) return 'selectAll';
    if (key === 's' && !event.shiftKey) return 'save';
    if (key === 'o' && !event.shiftKey) return 'open';
    if (key === 'Enter') return 'save';
    return null;
  }
  if (event.altKey || event.shiftKey) return null;
  if (key === 'Delete') return 'delete';
  if (key === 'Escape') return 'escape';
  if (key === 'PageUp') return 'previous';
  if (key === 'PageDown') return 'next';
  return null;
}
