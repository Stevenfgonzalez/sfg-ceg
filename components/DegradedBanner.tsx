'use client';

import { useState, useEffect, useCallback } from 'react';
import { getOutboxCount, isOnline } from '@/lib/offline-store';
import { onSyncChange } from '@/lib/outbox-sync';

/**
 * DegradedBanner — shown at the top of all pages when:
 *   - navigator.onLine === false, OR
 *   - outbox has pending items (count > 0)
 *
 * Disappears when online and all items are synced.
 * Must not block or slow down the main UI.
 */
export default function DegradedBanner() {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshState = useCallback(async () => {
    setOnline(isOnline());
    try {
      const count = await getOutboxCount();
      setPendingCount(count);
    } catch {
      // IndexedDB unavailable — treat as 0
    }
  }, []);

  useEffect(() => {
    // Initial state
    refreshState();

    // Listen for online/offline changes
    const handleOnline = () => {
      setOnline(true);
      refreshState();
    };
    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for sync engine changes (items synced, new items added)
    const unsubscribe = onSyncChange(refreshState);

    // Also poll every 5 seconds for pending count changes
    const pollId = setInterval(refreshState, 5_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      clearInterval(pollId);
    };
  }, [refreshState]);

  // Don't show banner if online and nothing pending
  if (online && pendingCount === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-500 text-amber-950 text-sm font-semibold px-4 py-2 text-center"
    >
      {!online ? (
        'You are offline. Your submissions are saved on this device and will upload when connectivity returns.'
      ) : (
        `Uploading ${pendingCount} pending submission${pendingCount === 1 ? '' : 's'}...`
      )}
    </div>
  );
}
