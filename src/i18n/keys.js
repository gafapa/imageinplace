/** Source-text keys used with t()/tn() in a JS/JSX source string (single-quoted literals only, as the code uses). */
const LITERAL = String.raw`'((?:[^'\\]|\\.)*)'`;
const T_CALL = new RegExp(String.raw`(?<![\w$.])t\(\s*${LITERAL}`, 'g');
const TN_CALL = new RegExp(String.raw`(?<![\w$.])tn\(\s*[^,]+?,\s*${LITERAL}\s*,\s*${LITERAL}`, 'g');
const unescape = (text) => text.replace(/\\(.)/g, '$1');

export function extractKeys(source) {
  const keys = new Set();
  for (const match of source.matchAll(T_CALL)) keys.add(unescape(match[1]));
  for (const match of source.matchAll(TN_CALL)) { keys.add(unescape(match[1])); keys.add(unescape(match[2])); }
  return keys;
}

export const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
