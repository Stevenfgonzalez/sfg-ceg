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

// Map outbox type to API route (cloud — relative URLs)
const CLOUD_ROUTES: Record<OutboxType, string> = {
  checkin: '/api/public/checkin',
  help: '/api/public/help',
  ems: '/api/public/ems',
  shelter: '/api/public/checkin',    // shelter submits to checkin endpoint
  stuck: '/api/public/checkin',      // stuck submits to checkin endpoint
  reunify: '/api/public/reunify',
};

// Map outbox type to edge-api route (field Wi-Fi — absolute URL to Pi 5)
// No default — edge routing is disabled unless explicitly configured
const EDGE_API_BASE = process.env.NEXT_PUBLIC_EDGE_API_BASE || '';
const EDGE_ROUTES: Record<OutboxType, string> = {
  checkin: `${EDGE_API_BASE}/api/checkin`,
  help: `${EDGE_API_BASE}/api/checkin`,
  ems: `${EDGE_API_BASE}/api/checkin`,
  shelter: `${EDGE_API_BASE}/api/checkin`,
  stuck: `${EDGE_API_BASE}/api/checkin`,
  reunify: `${EDGE_API_BASE}/api/checkin`,
};

// Edge-api detection — cached for 60 seconds
let edgeAvailable = false;
let edgeCheckedAt = 0;
const EDGE_CACHE_MS = 60_000;

/**
 * Probe the edge-api to see if we're on field Wi-Fi (SFG-FIELD-xx AP).
 * Caches the result for 60s to avoid spamming the edge node.
 */
async function isEdgeReachable(): Promise<boolean> {
  if (!EDGE_API_BASE) return false;
  if (Date.now() - edgeCheckedAt < EDGE_CACHE_MS) return edgeAvailable;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${EDGE_API_BASE}/api/edge/status`, {
      signal: ctrl.signal,
      mode: 'no-cors',
    });
    clearTimeout(timeout);
    edgeAvailable = res.ok || res.type === 'opaque'; // no-cors returns opaque
  } catch {
    edgeAvailable = false;
  }
  edgeCheckedAt = Date.now();
  return edgeAvailable;
}

/** Force a fresh edge-api probe on next sync */
export function resetEdgeDetection(): void {
  edgeCheckedAt = 0;
  edgeAvailable = false;
}

/** Check if currently routing to edge-api */
export function isEdgeMode(): boolean {
  return edgeAvailable;
}

// Keep backward compat — re-export as API_ROUTES
const API_ROUTES = CLOUD_ROUTES;

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

    // Detect if we're on field Wi-Fi (edge-api reachable)
    const useEdge = await isEdgeReachable();
    const routes = useEdge ? EDGE_ROUTES : CLOUD_ROUTES;

    for (const item of items) {
      if (!isOnline()) break; // Stop if we went offline mid-sync

      const url = routes[item.type];
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
          signal: AbortSignal.timeout(8000),
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
        // Network error — if on edge, fall back to cloud routes and retry
        if (useEdge) {
          resetEdgeDetection();
        }
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
