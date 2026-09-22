import React, { useCallback, useEffect, useState } from 'react';
import { SessionRecord, listSessions } from '../../lib/sessions';
import { RefreshIcon, UploadBadge, PrintBadge, formatTimestamp } from '../../components/admin/StatusBadge';
import { SkeletonTable } from '../../components/admin/Skeleton';
import { AdminNavArea } from '../../components/admin/AdminLayout';

interface AdminDashboardScreenProps {
  onNavigate: (area: AdminNavArea) => void;
}

const StatCard: React.FC<{ label: string; value: number; accent: string; pulse?: boolean }> = ({
  label,
  value,
  accent,
  pulse,
}) => (
  <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#241341] p-5">
    <span className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
    <p className="text-sm text-white/50">{label}</p>
    <p className={`mt-2 text-3xl font-bold tabular-nums ${pulse ? 'animate-pulse' : 'text-white'}`}>{value}</p>
  </div>
);

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ onNavigate }) => {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setSessions(await listSessions());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 30000);
    return () => clearInterval(timer);
  }, [load]);

  const synced = sessions.filter((s) => s.upload_status === 'success').length;
  const failedUploads = sessions.filter((s) => s.upload_status === 'error').length;
  const failedPrints = sessions.filter((s) => s.print_status === 'error').length;
  const recent = sessions.slice(0, 7);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-0.5 text-sm text-white/50">Session and booth health at a glance</p>
        </div>
        <RefreshIcon onClick={() => { setRefreshing(true); load(true); }} spinning={refreshing} />
      </header>

      {error && (
        <div className="rounded-lg border border-[#ff5e87]/40 bg-[#ff5e87]/10 px-4 py-3 text-sm text-[#ff8aa8]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total sessions" value={sessions.length} accent="bg-[#a35ef6]" />
        <StatCard label="Synced" value={synced} accent="bg-[#d9f85a]" />
        <StatCard label="Upload failed" value={failedUploads} accent="bg-[#ff5e87]" />
        <StatCard label="Print failed" value={failedPrints} accent={failedPrints > 0 ? 'bg-[#ff5e87]' : 'bg-white/20'} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#241341]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-semibold text-white">Recent sessions</h2>
          <button
            onClick={() => onNavigate('sesi')}
            className="text-sm font-medium text-[#d9f85a] transition hover:text-[#bae32f]"
          >
            View all →
          </button>
        </div>
        {loading ? (
          <div className="p-5">
            <SkeletonTable rows={5} />
          </div>
        ) : recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-white/40">
            No sessions yet. Finish a booth round and it will show up here.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {recent.map((session) => (
              <li key={session.token} className="flex items-center gap-4 px-5 py-3.5">
                <span className="w-32 shrink-0 font-mono text-xs text-white/80">{session.token}</span> 
                <p className="hidden shrink-0 text-sm text-white/45 sm:block">
                  {formatTimestamp(session.created_at)}
                </p>
                <span className="ml-auto flex shrink-0 items-center gap-2">
                  <UploadBadge status={session.upload_status} />
                  <PrintBadge status={session.print_status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};