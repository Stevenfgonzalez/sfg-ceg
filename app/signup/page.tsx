'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthBrowserClient } from '@/lib/supabase-auth';
import { logEvent } from '@/lib/analytics';

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    const supabase = createAuthBrowserClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      phone: phone || undefined,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        data: {
          phone_recovery: phone || null,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      logEvent('auth_signup_failed', { reason: authError.message });
      return;
    }

    logEvent('auth_signup_success');
    setSuccess(true);
    setLoading(false);
  };

  // Confirmation screen
  if (success) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex flex-col">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <a
            href="/"
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
          >
            ←
          </a>
          <h1 className="text-lg font-bold">Check Your Email</h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-4xl mx-auto mb-5 shadow-lg shadow-green-900/30">
              ✉️
            </div>
            <h2 className="text-xl font-extrabold">Confirm Your Email</h2>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              We sent a confirmation link to<br/>
              <span className="font-semibold text-white">{email}</span>
            </p>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              Click the link in that email to activate your account,<br/>
              then come back and sign in.
            </p>
            <a
              href="/login"
              className="inline-block mt-6 bg-blue-600 rounded-xl px-6 py-3 font-bold text-sm active:bg-blue-700 transition-colors"
            >
              Go to Sign In
            </a>
          </div>
        </div>
      </main>
    );
  }

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
        <h1 className="text-lg font-bold">Create Account</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Branding */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-blue-900/30">
              🏠
            </div>
            <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">Safety For Generations</p>
            <h2 className="text-xl font-extrabold mt-2">Create Your CEG Account</h2>
            <p className="text-sm text-slate-400 mt-1">Set up Field Care Cards for your household</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-xl px-4 py-3 mb-4">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
                Email <span className="text-red-400">*</span>
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
                Password <span className="text-red-400">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-semibold mb-1.5">
                Phone <span className="text-xs text-slate-400 font-normal">(for account recovery)</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="(310) 555-0100"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 rounded-xl px-4 py-3.5 font-bold text-sm active:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Why */}
          <div className="mt-6 bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-2">Why create an account?</p>
            <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
              <li>Your care card contains DNR status, medications, and home access details</li>
              <li>Only you should be able to create, edit, and view access logs</li>
              <li>EMS still accesses profiles via code — no account needed for them</li>
            </ul>
          </div>

          {/* Link to login */}
          <div className="mt-5 text-center">
            <a
              href="/login"
              className="text-sm text-blue-400 font-semibold active:text-blue-300"
            >
              Already have an account? Sign in
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
