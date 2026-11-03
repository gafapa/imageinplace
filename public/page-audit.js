/* Runs only inside an opaque sandbox. No editor data or external proxy is used. */
const copies = {
  es: ['Consulta URLs HTTPS públicas sin cookies. Solo se accede a la página indicada y a sus imágenes; el sitio recibe estas solicitudes. CORS puede impedir el acceso: guarda el HTML y ábrelo aquí con su URL original. No se ejecuta JavaScript de la página. Máximo: 100 imágenes, 2 MB de HTML, 40 MB por imagen y 80 MB en total.', 'URL original de la página', 'Analizar', 'Cancelar', 'O abrir HTML guardado (usa la URL anterior para resolver rutas)', 'Imagen', 'Formato / peso', 'Dimensiones', 'Observaciones', 'Analizando…', 'Sin acceso (CORS, red o límite).', 'Sin texto alternativo', 'Sin carga diferida', 'Cancelado', 'Imágenes encontradas', 'Escribe una URL HTTPS pública válida.', 'No se pudo leer la página. Puede bloquear CORS. Guarda su HTML y ábrelo aquí.', 'Candidata a AVIF/WebP'],
  en: ['Reads public HTTPS URLs without cookies. Only the supplied page and its images are requested; the site receives these requests. CORS may block access: save the HTML and open it here with its original URL. Page JavaScript is never executed. Limits: 100 images, 2 MB HTML, 40 MB per image and 80 MB total.', 'Original page URL', 'Analyze', 'Cancel', 'Or open saved HTML (use the URL above to resolve paths)', 'Image', 'Format / size', 'Dimensions', 'Observations', 'Analyzing…', 'Unavailable (CORS, network or size limit).', 'Missing alternative text', 'Missing lazy loading', 'Cancelled', 'Images found', 'Enter a valid public HTTPS URL.', 'Unable to read the page. CORS may be blocked. Save its HTML and open it here.', 'AVIF/WebP candidate'],
  gl: ['Consulta URLs HTTPS públicas sen cookies. O sitio recibe as solicitudes da páxina e das súas imaxes. CORS pode impedir o acceso: garda o HTML e ábreo aquí coa URL orixinal. Non se executa JavaScript da páxina. Máximo: 100 imaxes, 2 MB de HTML, 40 MB por imaxe e 80 MB en total.', 'URL orixinal da páxina', 'Analizar', 'Cancelar', 'Ou abrir HTML gardado (usa a URL anterior para resolver rutas)', 'Imaxe', 'Formato / peso', 'Dimensións', 'Observacións', 'Analizando…', 'Sen acceso (CORS, rede ou límite).', 'Sen texto alternativo', 'Sen carga diferida', 'Cancelado', 'Imaxes atopadas', 'Escribe unha URL HTTPS pública válida.', 'Non se puido ler a páxina. Pode bloquear CORS. Garda o HTML e ábreo aquí.', 'Candidata a AVIF/WebP'],
  ca: ['Consulta URL HTTPS públiques sense galetes. El lloc rep les peticions de la pàgina i les seves imatges. CORS pot impedir l’accés: desa l’HTML i obre’l aquí amb l’URL original. No s’executa JavaScript de la pàgina. Màxim: 100 imatges, 2 MB d’HTML, 40 MB per imatge i 80 MB en total.', 'URL original de la pàgina', 'Analitzar', 'Cancel·lar', 'O obrir HTML desat (usa l’URL anterior per resoldre rutes)', 'Imatge', 'Format / pes', 'Dimensions', 'Observacions', 'Analitzant…', 'Sense accés (CORS, xarxa o límit).', 'Sense text alternatiu', 'Sense càrrega diferida', 'Cancel·lat', 'Imatges trobades', 'Escriu una URL HTTPS pública vàlida.', 'No s’ha pogut llegir la pàgina. Pot bloquejar CORS. Desa l’HTML i obre’l aquí.', 'Candidata a AVIF/WebP'],
  eu: ['HTTPS URL publikoak cookierik gabe kontsultatzen ditu. Guneak orriaren eta irudien eskaerak jasotzen ditu. CORSek sarbidea blokea dezake: gorde HTMLa eta ireki hemen jatorrizko URLarekin. Orriko JavaScript ez da exekutatzen. Mugak: 100 irudi, 2 MB HTML, 40 MB irudiko eta 80 MB guztira.', 'Orriaren jatorrizko URLa', 'Aztertu', 'Utzi', 'Edo ireki gordetako HTMLa (erabili goiko URLa bideak ebazteko)', 'Irudia', 'Formatua / tamaina', 'Neurriak', 'Oharrak', 'Aztertzen…', 'Sarbiderik ez (CORS, sarea edo muga).', 'Ordezko testurik ez', 'Karga geroraturik ez', 'Bertan behera', 'Aurkitutako irudiak', 'Idatzi baliozko HTTPS URL publiko bat.', 'Ezin izan da orria irakurri. CORSek blokea dezake. Gorde HTMLa eta ireki hemen.', 'AVIF/WebP hautagaia'],
};
const language = new URLSearchParams(location.search).get('lang');
const copy = copies[language] || copies.es;
document.documentElement.lang = copies[language] ? language : 'es';
const element = (id) => document.getElementById(id);
['help', 'url-label', 'analyze', 'cancel', 'file-label'].forEach((id, index) => { element(id).textContent = copy[index]; });
copy.slice(5, 9).forEach((label) => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; element('columns').append(cell); });
let controller;
let budget;
function publicUrl(value, base) {
  const url = new URL(value, base);
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // Deliberately reject numeric/IPv6 hosts and local names; DNS rebinding cannot be ruled out client-side.
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443' || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /\.(localhost|local|localdomain|internal|lan|test)$/.test(host) || host === 'home.arpa' || host.endsWith('.home.arpa')) throw new Error(copy[15]);
  url.hash = ''; return url.href;
}
async function readUrl(url, limit, signal) {
  const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal });
  if (!response.ok || !response.body) throw new Error(copy[10]);
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; budget -= value.length;
      if (size > limit || budget < 0) throw new Error(copy[10]);
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });
}
function imageEntries(html, base) {
  const template = document.createElement('template'); template.innerHTML = html;
  const entries = new Map();
  for (const image of template.content.querySelectorAll('img, picture source')) {
    const candidates = [image.getAttribute('src'), image.getAttribute('data-src')];
    for (const item of (image.getAttribute('srcset') || '').split(',')) candidates.push(item.trim().split(/\s+/)[0]);
    for (const candidate of candidates.filter(Boolean)) {
      try {
        const url = publicUrl(candidate, base);
        if (!entries.has(url) && entries.size < 100) entries.set(url, { url, alt: image.getAttribute('alt'), image: image.tagName === 'IMG', lazy: image.getAttribute('loading') === 'lazy' });
      } catch { /* Skip unsafe or unsupported resource URLs. */ }
    }
  }
  return [...entries.values()];
}
async function run(file) {
  if (element('analyze').disabled) return;
  controller?.abort(); controller = new AbortController();
  const signal = controller.signal; const timeout = setTimeout(() => controller.abort(), 120000);
  budget = 80 * 1024 * 1024; element('results').replaceChildren(); element('analyze').disabled = true; element('html-file').disabled = true; element('cancel').disabled = false; element('status').textContent = copy[9];
  try {
    const base = publicUrl(element('page-url').value);
    if (file && file.size > 2 * 1024 * 1024) throw new Error(copy[16]);
    const html = file ? await file.text() : await (await readUrl(base, 2 * 1024 * 1024, signal)).text();
    signal.throwIfAborted();
    const entries = imageEntries(html, base);
    document.querySelector('table').hidden = false;
    for (const [index, entry] of entries.entries()) {
      signal.throwIfAborted();
      const row = document.createElement('tr'); const cells = [entry.url, '—', '—', '']; const notes = [];
      if (entry.image && entry.alt === null) notes.push(copy[11]);
      if (entry.image && !entry.lazy && index > 1) notes.push(copy[12]);
      try {
        const blob = await readUrl(entry.url, 40 * 1024 * 1024, signal);
        cells[1] = `${blob.type.split(';')[0]} · ${(blob.size / 1024).toFixed(1)} KB`;
        if (blob.type.startsWith('image/') && !blob.type.includes('svg')) {
          const bitmap = await createImageBitmap(blob); cells[2] = `${bitmap.width} × ${bitmap.height}`; bitmap.close();
        }
        if (/image\/(jpeg|png)/.test(blob.type) && blob.size > 50000) notes.push(copy[17]);
      } catch { signal.throwIfAborted(); notes.push(copy[10]); }
      cells[3] = notes.join(' · ');
      cells.forEach((text) => { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }); element('results').append(row);
      element('status').textContent = `${copy[14]}: ${entries.length} · ${index + 1}/${entries.length}`;
    }
    if (!entries.length) element('status').textContent = `${copy[14]}: 0`;
  } catch (error) { element('status').textContent = signal.aborted ? copy[13] : `${copy[16]} ${error.message}`; }
  finally { clearTimeout(timeout); element('analyze').disabled = false; element('html-file').disabled = false; element('cancel').disabled = true; }
}
element('analyze').addEventListener('click', () => { if (element('page-url').reportValidity()) run(); });
element('page-url').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); if (element('page-url').reportValidity()) run(); } });
element('html-file').addEventListener('change', (event) => { if (event.target.files[0]) run(event.target.files[0]); event.target.value = ''; });
element('cancel').addEventListener('click', () => controller?.abort());
