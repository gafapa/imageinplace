import { t } from '../i18n/index.js';
/**
 * Opt-in recovery of the gallery after a reload or closed tab. The workspace is stored as a
 * regular .iip project blob in this browser's IndexedDB: nothing leaves the device, and opening
 * it reuses the project integrity checks.
 */
const PREFERENCE_KEY = 'imageinplace-session-recovery';
const DB_NAME = 'imageinplace';
const STORE = 'session';
const RECORD = 'current';

/** Hold one recovery writer for this origin. Never silently overwrite another open tab. */
export function acquireRecoveryWriter() {
  if (!globalThis.navigator?.locks) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    navigator.locks.request('imageinplace-recovery-writer', { ifAvailable: true }, async (lock) => {
      if (!lock) { resolve(null); return; }
      await new Promise((release) => resolve(release));
    }).catch(reject);
  });
}

export function readRecoveryPreference(storage) {
  try { return (storage ?? globalThis.localStorage)?.getItem(PREFERENCE_KEY) === 'true'; } catch { return false; }
}

export function writeRecoveryPreference(enabled, storage) {
  try { (storage ?? globalThis.localStorage)?.setItem(PREFERENCE_KEY, enabled ? 'true' : 'false'); } catch { /* preference is optional */ }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error(t('Este navegador no permite guardar la sesión.'))); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error(t('No se pudo abrir el almacenamiento local.')));
  });
}

let writeQueue = Promise.resolve();
function transact(mode, action) {
  if (mode !== 'readwrite') return runTransaction(mode, action);
  const result = writeQueue.then(() => runTransaction(mode, action));
  writeQueue = result.catch(() => {});
  return result;
}

async function runTransaction(mode, action) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error || new Error(t('No se pudo guardar la sesión.')));
      transaction.onabort = () => reject(transaction.error || new Error(t('Almacenamiento lleno o bloqueado.')));
    });
  } finally { db.close(); }
}

/** Store the workspace snapshot (a project blob) with a summary shown before recovery. */
export function storeSession(blob, count, canWrite = () => true) {
  return transact('readwrite', (store) => {
    // Recheck after opening IndexedDB, inside the transaction: opt-out may have happened meanwhile.
    if (!readRecoveryPreference() || !canWrite()) return;
    return store.put({ blob, count, savedAt: Date.now() }, RECORD);
  });
}

/** The stored snapshot `{ blob, count, savedAt }`, or null. */
export async function loadSession() {
  try {
    const record = await transact('readonly', (store) => store.get(RECORD));
    return record?.blob instanceof Blob ? record : null;
  } catch { return null; }
}

export async function clearSession(canClear = () => true) {
  await transact('readwrite', (store) => { if (canClear()) return store.delete(RECORD); });
}
