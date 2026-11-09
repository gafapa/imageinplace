/** Hand a blob to the browser as a download. */
export function downloadBlob(blob, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** One file is downloaded as is; several go into a ZIP (JSZip is loaded only then). Names must already be unique. */
export async function downloadFiles(entries, zipName, signal) {
  if (entries.length === 1) { downloadBlob(entries[0].blob, entries[0].name); return; }
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  entries.forEach((entry) => zip.file(entry.name, entry.blob));
  const blob = await zip.generateAsync({ type: 'blob' });
  signal?.throwIfAborted();
  downloadBlob(blob, zipName);
}
