// Offline queue — IndexedDB outbox for form submissions
// Stores pending requests when offline, auto-flushes when connectivity returns
// Max 50 entries, oldest dropped when full

const DB_NAME = 'ceg-offline';
const DB_VERSION = 1;
const STORE_NAME = 'outbox';
const MAX_QUEUE_SIZE = 50;

export interface QueuedRequest {
  id: string;
  url: string;
  method: 'POST';
  body: string;
  headers: Record<string, string>;
  createdAt: number;
  retries: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Add a request to the offline queue
export async function enqueue(url: string, body: string, headers: Record<string, string> = {}): Promise<string> {
  const db = await openDB();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: QueuedRequest = {
    id,
    url,
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json', ...headers },
    createdAt: Date.now(),
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Count existing entries
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result >= MAX_QUEUE_SIZE) {
        // Drop oldest entry
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            cursor.delete();
          }
        };
      }
      store.put(entry);
    };

    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

// Get all queued requests
export async function getAll(): Promise<QueuedRequest[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Remove a specific entry from the queue
export async function remove(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Get queue size
export async function queueSize(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Flush all queued requests — replay in order
// Returns count of successfully flushed items
export async function flush(): Promise<{ flushed: number; failed: number }> {
  const items = await getAll();
  let flushed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });

      if (res.ok || res.status === 400) {
        // Success or validation error (e.g., incident closed) — remove from queue
        await remove(item.id);
        flushed++;
      } else if (res.status === 429) {
        // Rate limited — stop flushing, try again later
        break;
      } else {
        // Server error — increment retries, keep in queue
        failed++;
      }
    } catch {
      // Network error — still offline, stop flushing
      break;
    }
  }

  return { flushed, failed };
}

// Submit with offline fallback — the main API for form pages
// Returns { online: true } if submitted directly, { online: false, queueId } if queued
export async function submitWithFallback(
  url: string,
  body: Record<string, unknown>,
): Promise<{ online: boolean; queueId?: string; response?: Response }> {
  const bodyStr = JSON.stringify(body);

  if (!navigator.onLine) {
    const queueId = await enqueue(url, bodyStr);
    return { online: false, queueId };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    });
    return { online: true, response: res };
  } catch {
    // Network error despite navigator.onLine — queue it
    const queueId = await enqueue(url, bodyStr);
    return { online: false, queueId };
  }
}
