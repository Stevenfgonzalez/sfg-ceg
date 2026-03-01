'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// /ems now redirects to /help — consolidated in Phase 2.
// The API route /api/public/ems remains functional for external integrations.

function EmsRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    // Preserve query params (incident, ap, etc.)
    const qs = params.toString();
    router.replace(`/help${qs ? `?${qs}` : ''}`);
  }, [router, params]);

  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <p className="text-slate-400">Redirecting to Help page...</p>
    </main>
  );
}

export default function EmsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <EmsRedirect />
    </Suspense>
  );
}
