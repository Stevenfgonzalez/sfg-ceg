'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createAuthBrowserClient } from '@/lib/supabase-auth';
import { logEvent } from '@/lib/analytics';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/fcc';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createAuthBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      logEvent('auth_login_failed', { reason: authError.message });
      return;
    }

    logEvent('auth_login_success');
    router.push(redirect);
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a
          href="/"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
        >
          ←
        </a>
        <h1 className="text-lg font-bold">Sign In</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Branding */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-blue-900/30">
              🏠
            </div>
            <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">SafetyForGenerations.com</p>
            <h2 className="text-xl font-extrabold mt-2">Sign in to CEG</h2>
            <p className="text-sm text-slate-400 mt-1">Access your Field Care Cards</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-xl px-4 py-3 mb-4">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 rounded-xl px-4 py-3.5 font-bold text-sm active:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 text-center space-y-3">
            <a
              href="/signup"
              className="block text-sm text-blue-400 font-semibold active:text-blue-300"
            >
              Don&apos;t have an account? Sign up
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
