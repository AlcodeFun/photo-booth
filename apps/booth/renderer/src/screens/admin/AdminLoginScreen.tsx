import React, { useState } from 'react';
import { signInAdmin } from '../../lib/adminAuth';

interface AdminLoginScreenProps {
  onAuthenticated?: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await signInAdmin(email.trim(), password);
      onAuthenticated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#140b26] px-4 text-white">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#ff4bb5] to-[#a35ef6] shadow-[0_0_36px_rgba(255,75,181,0.45)]">
            <span className="text-2xl font-black text-[#140b26]">PB</span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-wide">Booth Admin</h1>
            <p className="mt-1 text-sm text-white/50">Sign in to manage sessions and frames</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-[#1a0b2e] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]"
        >
          {error && (
            <div className="mb-4 rounded-lg border border-[#ff5e87]/40 bg-[#ff5e87]/10 px-4 py-3 text-sm text-[#ff8aa8]">
              {error}
            </div>
          )}

          <label className="mb-1.5 block text-sm font-medium text-white/70" htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mb-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#ff4bb5]/60 focus:outline-none"
          />

          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm font-medium text-white/70" htmlFor="admin-password">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="text-xs text-white/40 transition hover:text-white/70"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            id="admin-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mb-6 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#ff4bb5]/60 focus:outline-none"
          />

          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#d9f85a] py-2.5 text-sm font-bold text-[#140b26] transition hover:bg-[#bae32f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#140b26] border-t-transparent" />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
};