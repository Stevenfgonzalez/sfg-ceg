// ═══════════════════════════════════════════════════════════════════════════
// OUTBOX SYNC ENGINE
//
// Processes the IndexedDB outbox in FIFO order:
//  1. Listens for the 'online' event
//  2. On connectivity restore, POSTs each item to the appropriate API route
//  3. On success: marks item as synced (moves to 'submitted' store)
//  4. On failure: leaves in outbox, retries on next online event or 30s tick
//
// Call startOutboxSync() once on app mount.
// Call trySyncNow() after saving to the outbox for an immediate attempt.
// ═══════════════════════════════════════════════════════════════════════════

import {
  getOutboxItems,
  markSynced,
  isOnline,
  type OutboxType,
} from './offline-store';

// Map outbox type to API route
const API_ROUTES: Record<OutboxType, string> = {
  checkin: '/api/public/checkin',
  help: '/api/public/help',
  ems: '/api/public/ems',
  shelter: '/api/public/checkin',    // shelter submits to checkin endpoint
  stuck: '/api/public/checkin',      // stuck submits to checkin endpoint
  reunify: '/api/public/reunify',
};

let syncing = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let started = false;

// Sync listeners — components can subscribe to know when sync state changes
type SyncListener = () => void;
const listeners: Set<SyncListener> = new Set();

export function onSyncChange(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notifyListeners() {
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore listener errors */ }
  });
}

/**
 * Process all outbox items in FIFO order.
 * Returns the number of successfully synced items.
 */
async function processOutbox(): Promise<number> {
  if (syncing || !isOnline()) return 0;
  syncing = true;

  let syncedCount = 0;

  try {
    const items = await getOutboxItems();
    if (items.length === 0) {
      syncing = false;
      return 0;
    }

    for (const item of items) {
      if (!isOnline()) break; // Stop if we went offline mid-sync

      const url = API_ROUTES[item.type];
      if (!url) {
        // Unknown type — mark as synced to clear it
        await markSynced(item.event_id);
        syncedCount++;
        continue;
      }

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });

        if (res.ok || res.status === 400) {
          // Success or validation error (e.g., incident closed, duplicate) — remove from outbox
          await markSynced(item.event_id);
          syncedCount++;
        } else if (res.status === 429) {
          // Rate limited — stop processing, retry later
          break;
        }
        // Other server errors (5xx) — leave in outbox, try next item
      } catch {
        // Network error — stop processing (we're likely offline)
        break;
      }
    }
  } finally {
    syncing = false;
    notifyListeners();
  }

  return syncedCount;
}

/**
 * Start the outbox sync engine. Call once on app mount.
 * Sets up:
 *  - 'online' event listener
 *  - 30s periodic check (in case the online event is missed)
 *  - Initial flush if already online
 */
export function startOutboxSync(): void {
  if (started) return;
  if (typeof window === 'undefined') return;
  started = true;

  // Sync when connectivity returns
  window.addEventListener('online', () => {
    processOutbox();
  });

  // Notify listeners when going offline
  window.addEventListener('offline', () => {
    notifyListeners();
  });

  // Periodic check every 30 seconds
  intervalId = setInterval(() => {
    if (isOnline()) {
      processOutbox();
    }
  }, 30_000);

  // Initial flush if online
  if (isOnline()) {
    processOutbox();
  }
}

/**
 * Try to sync immediately (non-blocking).
 * Called after saving to the outbox so the item syncs right away if possible.
 */
export function trySyncNow(): void {
  if (typeof window === 'undefined') return;
  // Use setTimeout to not block the caller
  setTimeout(() => {
    if (isOnline()) {
      processOutbox();
    }
  }, 0);
}

/**
 * Stop the sync engine (for cleanup / testing).
 */
export function stopOutboxSync(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  started = false;
}
