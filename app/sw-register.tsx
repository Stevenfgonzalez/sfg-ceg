'use client';

import { useEffect } from 'react';
import { flush } from '@/lib/offline-queue';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration failed — app still works without it
      });
    }

    // Flush offline queue when coming back online
    const handleOnline = () => {
      flush().catch(() => {
        // Flush failed — will retry next time we come online
      });
    };

    window.addEventListener('online', handleOnline);

    // Also try to flush on load (in case we came back online while page was closed)
    if (navigator.onLine) {
      flush().catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return null;
}
