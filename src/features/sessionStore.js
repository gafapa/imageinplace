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

export function readRecoveryPreference(storage = globalThis.localStorage) {
  try { return storage?.getItem(PREFERENCE_KEY) === 'true'; } catch { return false; }
}

export function writeRecoveryPreference(enabled, storage = globalThis.localStorage) {
  try { storage?.setItem(PREFERENCE_KEY, enabled ? 'true' : 'false'); } catch { /* preference is optional */ }
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

async function transact(mode, action) {
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
export function storeSession(blob, count) {
  return transact('readwrite', (store) => store.put({ blob, count, savedAt: Date.now() }, RECORD));
}

/** The stored snapshot `{ blob, count, savedAt }`, or null. */
export async function loadSession() {
  try {
    const record = await transact('readonly', (store) => store.get(RECORD));
    return record?.blob instanceof Blob ? record : null;
  } catch { return null; }
}

export async function clearSession() {
  try { await transact('readwrite', (store) => store.delete(RECORD)); } catch { /* nothing stored */ }
}
