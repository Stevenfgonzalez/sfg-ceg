// ═══════════════════════════════════════════════════════════════════════════
// FCC CACHE — IndexedDB client-side cache for unlock responses
//
// When EMS unlocks a care card online, the response is cached here.
// If the device goes offline before the session expires, reloading the page
// can recover the cached data instead of showing a blank screen.
//
// TTL: 4 hours (matches session expiry).
// No external dependencies — uses native IndexedDB API only.
// ═══════════════════════════════════════════════════════════════════════════

const DB_NAME = 'fcc-cache-v1';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface CachedSession {
  householdId: string;
  data: Record<string, unknown>;
  cachedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'householdId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Cache an FCC unlock response keyed by household ID. */
export async function cacheFccSession(
  householdId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const db = await openDB();
  const entry: CachedSession = { householdId, data, cachedAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Retrieve a cached session if it exists and is less than 4 hours old. */
export async function getCachedFccSession(
  householdId: string,
): Promise<Record<string, unknown> | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(householdId);
    req.onsuccess = () => {
      const entry = req.result as CachedSession | undefined;
      if (!entry) {
        resolve(null);
        return;
      }
      if (Date.now() - entry.cachedAt > TTL_MS) {
        // Expired — delete and return null
        store.delete(householdId);
        resolve(null);
        return;
      }
      resolve(entry.data);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Delete all cached FCC sessions. */
export async function clearFccCache(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
