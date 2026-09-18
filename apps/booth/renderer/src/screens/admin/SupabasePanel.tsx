import { FormEvent, useState } from 'react';

interface SupabasePanelProps {
  remoteActive: boolean;
  sessionEmail: string | null;
  isNewFrame: boolean;
  onSignIn: (email: string, password: string) => void;
  onSignOut: () => void;
  onSave: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

const inputClass =
  'h-10 w-full rounded-[10px] border-[3px] border-[#c9b8ff] bg-white px-3 text-sm font-bold text-[#4d2d85] outline-none focus:border-[#a35ef6]';

export const SupabasePanel = ({
  remoteActive,
  sessionEmail,
  isNewFrame,
  onSignIn,
  onSignOut,
  onSave,
  onDelete,
  onRefresh,
}: SupabasePanelProps) => {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  const handleSignIn = (event: FormEvent) => {
    event.preventDefault();
    onSignIn(authEmail, authPassword);
  };

  const writeHint = sessionEmail ? undefined : 'Sign in to save and delete';

  return (
    <div className="grid gap-3 rounded-[12px] border-[3px] border-[#e5c9ff] bg-[#fbf3ff] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">Supabase</h2>
        <span
          className={`rounded-[8px] border-2 px-2 py-0.5 text-xs font-black uppercase tracking-wide ${
            remoteActive
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-rose-300 bg-rose-50 text-rose-600'
          }`}
        >
          {remoteActive ? 'Connected' : 'Local only'}
        </span>
        <span className="ml-auto text-xs font-bold text-[#7a4de3]">
          {sessionEmail ? `Signed in as ${sessionEmail}` : 'Read-only: sign in to write'}
        </span>
      </div>

      {sessionEmail ? (
        <button
          type="button"
          onClick={onSignOut}
          className="h-10 rounded-[10px] border-[3px] border-[#c9b8ff] bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-[#5b3aa8] transition-colors hover:bg-[#efe8ff]"
        >
          Sign Out
        </button>
      ) : (
        <form onSubmit={handleSignIn} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="Admin email"
            className={inputClass}
          />
          <input
            type="password"
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            placeholder="Password"
            className={inputClass}
          />
          <button
            type="submit"
            className="h-10 rounded-[10px] border-[3px] border-[#a35ef6] bg-[#d9f85a] px-4 text-xs font-black uppercase tracking-[0.12em] text-[#4d2d85] transition-colors hover:bg-[#e9ff9e]"
          >
            Sign In
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!sessionEmail}
          title={writeHint}
          className="h-10 rounded-[10px] border-[3px] border-emerald-300 bg-emerald-100 px-4 text-xs font-black uppercase tracking-[0.12em] text-emerald-700 transition-colors hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save to Supabase
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="h-10 rounded-[10px] border-[3px] border-[#c9b8ff] bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-[#5b3aa8] transition-colors hover:bg-[#efe8ff]"
        >
          Refresh List
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isNewFrame || !sessionEmail}
          title={writeHint}
          className="h-10 rounded-[10px] border-[3px] border-[#ff9ecb] bg-[#ffe0ef] px-4 text-xs font-black uppercase tracking-[0.12em] text-[#b3206e] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Delete
        </button>
      </div>
      <p className="text-xs font-semibold leading-relaxed text-[#7a4de3]">
        Save writes the current photo template into{' '}
        <code className="font-black text-[#5b3aa8]">templates_by_photo_slots</code>.
      </p>
    </div>
  );
};