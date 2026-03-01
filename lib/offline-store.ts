// ═══════════════════════════════════════════════════════════════════════════
// OFFLINE STORE — IndexedDB outbox for local-first form submissions
//
// Core survivability feature: check-ins must work when the network is down
// (wildfire cell tower loss). Every submission is captured locally FIRST,
// then synced to the server when connectivity returns.
//
// Database: ceg-offline-v1
// Object stores:
//   outbox    — pending submissions (keyed by event_id UUID)
//   submitted — successfully synced items (dedup + user confirmation)
//
// No external dependencies — uses native IndexedDB API only.
// Compatible with Safari iOS 15+, Chrome Android.
// ═══════════════════════════════════════════════════════════════════════════

export type OutboxType = 'checkin' | 'help' | 'reunify' | 'shelter' | 'stuck' | 'ems';

export interface OutboxItem {
  event_id: string;
  type: OutboxType;
  payload: Record<string, unknown>;
  created_at: number;
}

export interface SubmittedItem extends OutboxItem {
  synced_at: number;
}

const DB_NAME = 'ceg-offline-v1';
const DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';
const SUBMITTED_STORE = 'submitted';

// ── IndexedDB helpers ──

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = db.createObjectStore(OUTBOX_STORE, { keyPath: 'event_id' });
        outbox.createIndex('created_at', 'created_at', { unique: false });
      }
      if (!db.objectStoreNames.contains(SUBMITTED_STORE)) {
        db.createObjectStore(SUBMITTED_STORE, { keyPath: 'event_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Public API ──

/**
 * Save a submission to the local outbox.
 * Returns the event_id (a UUID generated client-side).
 */
export async function saveToOutbox(
  type: OutboxType,
  payload: Record<string, unknown>,
): Promise<string> {
  const event_id = crypto.randomUUID();
  const item: OutboxItem = {
    event_id,
    type,
    payload: { ...payload, event_id },
    created_at: Date.now(),
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    tx.objectStore(OUTBOX_STORE).put(item);
    tx.oncomplete = () => resolve(event_id);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all pending outbox items, sorted FIFO (oldest first).
 */
export async function getOutboxItems(): Promise<OutboxItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readonly');
    const store = tx.objectStore(OUTBOX_STORE);
    const index = store.index('created_at');
    const req = index.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Move an item from outbox to submitted (for dedup and user confirmation).
 */
export async function markSynced(eventId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([OUTBOX_STORE, SUBMITTED_STORE], 'readwrite');
    const outbox = tx.objectStore(OUTBOX_STORE);
    const submitted = tx.objectStore(SUBMITTED_STORE);

    const getReq = outbox.get(eventId);
    getReq.onsuccess = () => {
      const item = getReq.result as OutboxItem | undefined;
      if (item) {
        const synced: SubmittedItem = { ...item, synced_at: Date.now() };
        submitted.put(synced);
      }
      outbox.delete(eventId);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get the count of pending outbox items.
 */
export async function getOutboxCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readonly');
    const req = tx.objectStore(OUTBOX_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Wrapper around navigator.onLine.
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}
