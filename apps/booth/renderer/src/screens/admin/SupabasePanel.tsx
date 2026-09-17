import { ChangeEvent, FormEvent, useState } from 'react';

interface SupabasePanelProps {
  remoteActive: boolean;
  sessionEmail: string | null;
  isNewFrame: boolean;
  onSignIn: (email: string, password: string) => void;
  onSignOut: () => void;
  onSave: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  onUploadAsset: (file: File) => void;
}

export const SupabasePanel = ({
  remoteActive,
  sessionEmail,
  isNewFrame,
  onSignIn,
  onSignOut,
  onSave,
  onDelete,
  onRefresh,
  onUploadAsset,
}: SupabasePanelProps) => {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  const handleSignIn = (event: FormEvent) => {
    event.preventDefault();
    onSignIn(authEmail, authPassword);
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      onUploadAsset(file);
    }
  };

  const writeHint = sessionEmail
    ? undefined
    : 'Sign in to save, delete, and upload assets';

  return (
    <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-sky-300">Supabase</h2>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-bold ${
            remoteActive ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'
          }`}
        >
          {remoteActive ? 'Connected' : 'Local only'}
        </span>
        <span className="ml-auto text-xs font-medium text-zinc-400">
          {sessionEmail
            ? `Signed in as ${sessionEmail}`
            : 'Read-only: sign in to save, delete, and upload assets'}
        </span>
      </div>

      {sessionEmail ? (
        <button
          type="button"
          onClick={onSignOut}
          className="h-10 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500"
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
            className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-zinc-100 outline-none focus:border-sky-400"
          />
          <input
            type="password"
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            placeholder="Password"
            className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-zinc-100 outline-none focus:border-sky-400"
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-bold text-white transition-colors hover:bg-sky-500"
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
          className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save to Supabase
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="h-10 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500"
        >
          Refresh List
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isNewFrame || !sessionEmail}
          title={writeHint}
          className="h-10 rounded-lg border border-rose-800 px-4 text-sm font-semibold text-rose-200 transition-colors hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Delete
        </button>
        <label className="flex h-10 cursor-pointer items-center rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40">
          Upload PNG
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={!sessionEmail} />
        </label>
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">
        Save writes the current photo template into <code className="text-zinc-400">templates_by_photo_slots</code>.
        Upload PNG pushes the frame overlay to the <code className="text-zinc-400">frame-templates</code> storage bucket.
      </p>
    </div>
  );
};