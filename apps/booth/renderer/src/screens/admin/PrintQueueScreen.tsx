import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SessionRecord,
  getUploadedBlob,
  listSessions,
  sessionFileUrl,
} from '../../lib/sessions';
import { useBoothConfig } from '../../store/boothConfigStore';
import { Modal } from '../../components/admin/Modal';
import { SkeletonTable } from '../../components/admin/Skeleton';
import { formatTimestamp, shortToken } from '../../components/admin/StatusBadge';
import { IconPrinter, IconRefresh, IconTrash, IconX } from '../../components/admin/AdminIcons';
import {
  IElectronAPIPrintJob,
  IElectronAPIPrintJobState,
  IElectronAPIPrintQueueSnapshot,
  IElectronAPIPrinterStatusResult,
} from '../../global';

const STATE_STYLES: Record<IElectronAPIPrintJobState, string> = {
  pending: 'border-[#a35ef6]/40 bg-[#a35ef6]/10 text-[#d9b8ff]',
  submitted: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  processing: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  completed: 'border-[#d9f85a]/30 bg-[#d9f85a]/10 text-[#d9f85a]',
  failed: 'border-[#ff5e87]/30 bg-[#ff5e87]/10 text-[#ff8aa8]',
  canceled: 'border-white/10 bg-white/5 text-white/60',
};

const STATE_LABELS: Record<IElectronAPIPrintJobState, string> = {
  pending: 'Queued',
  submitted: 'Sending',
  processing: 'Printing',
  completed: 'Printed',
  failed: 'Failed',
  canceled: 'Canceled',
};

/** Reasons that mean the operator must physically attend to the printer. */
const ATTENTION_REASONS = [
  'media-empty',
  'media-needed',
  'media-jam',
  'marker-supply-empty',
  'marker-supply-low',
  'cover-open',
  'offline',
  'paused',
];

const hasElectronPrinter = () => typeof window.electronAPI?.printer?.queue === 'function';

const JobStateBadge: React.FC<{ state: IElectronAPIPrintJobState; priority?: boolean }> = ({ state, priority }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STATE_STYLES[state]}`}
  >
    {state === 'processing' && (
      <span className="h-2 w-2 animate-pulse rounded-full bg-current" aria-hidden />
    )}
    {STATE_LABELS[state]}
    {priority && <span className="text-[0.65rem] uppercase tracking-wide opacity-70">priority</span>}
  </span>
);

/** Loads a session's framed.png (IndexedDB → gallery) as an object URL. */
const JobThumb: React.FC<{ token?: string; fileName: string }> = ({ token, fileName }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    const load = async () => {
      if (!token) return;
      const blob = await getUploadedBlob(token, fileName);
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        revoked = objectUrl;
        if (!cancelled) setUrl(objectUrl);
        return;
      }
      const remote = sessionFileUrl(token, fileName);
      if (remote && !cancelled) setUrl(remote);
    };
    void load();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [token, fileName]);

  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-white/30">
          <IconPrinter className="h-4 w-4" />
        </div>
      )}
    </div>
  );
};

export const PrintQueueScreen: React.FC = () => {
  const printer = useBoothConfig((state) => state.printer);
  const [snapshot, setSnapshot] = useState<IElectronAPIPrintQueueSnapshot | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<IElectronAPIPrinterStatusResult | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [queueUnavailable, setQueueUnavailable] = useState(false);
  const mounted = useRef(true);

  const loadSessions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setSessions(await listSessions());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    if (!hasElectronPrinter()) {
      setQueueUnavailable(true);
      return;
    }
    try {
      const next = await window.electronAPI.printer.queue();
      if (mounted.current) setSnapshot(next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadSessions();
    void loadQueue();
    const sessionTimer = setInterval(() => loadSessions(true), 30000);
    return () => {
      mounted.current = false;
      clearInterval(sessionTimer);
    };
  }, [loadSessions, loadQueue]);

  useEffect(() => {
    const api = window.electronAPI?.printer;
    if (!api?.onJobUpdate) {
      setQueueUnavailable(true);
      return;
    }
    return api.onJobUpdate((next) => {
      if (mounted.current) setSnapshot(next);
    });
  }, []);

  useEffect(() => {
    if (!hasElectronPrinter() || !printer.queueName) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const next = await window.electronAPI.printer.status(printer.queueName);
        if (!cancelled) setStatus(next);
      } catch {
        if (!cancelled) setStatus(null);
      }
    };
    void check();
    const timer = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [printer.queueName]);

  const sessionsByToken = useMemo(() => {
    const map = new Map<string, SessionRecord>();
    for (const session of sessions) map.set(session.token, session);
    return map;
  }, [sessions]);

  const jobs = snapshot?.jobs ?? [];
  const pendingJobs = jobs.filter((job) => job.state === 'pending');
  const activeJob = jobs.find((job) => job.state === 'submitted' || job.state === 'processing') ?? null;
  const queuedTokens = useMemo(
    () => new Set(jobs.filter((job) => job.state !== 'canceled').map((job) => job.token).filter(Boolean)),
    [jobs],
  );

  const readySessions = useMemo(
    () =>
      sessions.filter(
        (session) => session.print_status === 'ready_to_print' && !queuedTokens.has(session.token),
      ),
    [sessions, queuedTokens],
  );

  const addCandidates = useMemo(() => {
    const query = addQuery.trim().toLowerCase();
    return sessions
      .filter((session) => !queuedTokens.has(session.token))
      .filter((session) => (query ? session.token.toLowerCase().includes(query) : true))
      .slice(0, 40);
  }, [sessions, queuedTokens, addQuery]);

  const attention = (status?.reasons ?? []).filter((reason) =>
    ATTENTION_REASONS.some((token) => reason.includes(token)),
  );

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enqueueSession = async (session: SessionRecord) => {
    if (!hasElectronPrinter() || !printer.queueName) {
      setError('Configure a printer queue in Setup before adding sessions.');
      return;
    }
    setBusy(`add:${session.token}`);
    try {
      await window.electronAPI.printer.enqueue({
        token: session.token,
        fileName: 'framed.png',
        queueName: printer.queueName,
        copies: printer.copies,
        paperSize: printer.paperSize,
        mediaType: printer.mediaType,
        quality: printer.quality,
        colorMode: printer.colorMode,
      });
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adding the session failed');
    } finally {
      setBusy(null);
    }
  };

  const startBatch = async (ids: string[]) => {
    if (ids.length === 0) {
      setError('Select at least one queued job to print.');
      return;
    }
    setBusy('batch');
    try {
      await window.electronAPI.printer.startBatch(ids);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Starting the batch failed');
    } finally {
      setBusy(null);
    }
  };

  const retryJob = async (id: string) => {
    setBusy(`retry:${id}`);
    try {
      await window.electronAPI.printer.retry(id);
      await loadQueue();
    } finally {
      setBusy(null);
    }
  };

  const cancelJob = async (id: string) => {
    setBusy(`cancel:${id}`);
    try {
      await window.electronAPI.printer.cancel(id);
      await loadQueue();
    } finally {
      setBusy(null);
    }
  };

  const removeJob = async (id: string) => {
    setBusy(`remove:${id}`);
    try {
      await window.electronAPI.printer.remove(id);
      await loadQueue();
    } finally {
      setBusy(null);
    }
  };

  const renderStatusBanner = () => {
    if (queueUnavailable) {
      return (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          The print queue bridge is only available in the packaged Electron app on the booth device.
        </div>
      );
    }
    if (!printer.queueName) {
      return (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
          No printer queue configured. Set one in Admin → Setup → Printer.
        </div>
      );
    }
    if (attention.length > 0) {
      return (
        <div className="rounded-xl border border-[#ff5e87]/40 bg-[#ff5e87]/10 px-4 py-3 text-sm text-[#ff8aa8]">
          <span className="font-semibold">Printer needs attention:</span> {attention.join(', ')}. Check the
          paper/ribbon before retrying.
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
        <span className="font-semibold text-white">{printer.queueName}</span>
        <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs uppercase tracking-wide text-white/70">
          {status?.state ?? 'unknown'}
        </span>
        {activeJob ? <span className="text-xs text-white/50">Printing a job…</span> : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Print Queue</h1>
          <p className="mt-0.5 text-sm text-white/50">
            Release prints in batches — one sheet at a time. Retries jump to the front of the queue.
          </p>
        </div>
        <button
          onClick={() => {
            void loadSessions(true);
            void loadQueue();
          }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <IconRefresh className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {renderStatusBanner()}

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#ff5e87]/30 bg-[#ff5e87]/10 px-4 py-3 text-sm text-[#ff8aa8]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
            Queue ({jobs.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void startBatch([...selected])}
              disabled={busy === 'batch' || selected.size === 0}
              className="inline-flex items-center gap-2 rounded-full bg-[#d9f85a] px-4 py-2 text-sm font-semibold text-[#140b26] transition hover:bg-[#bae32f] disabled:opacity-50"
            >
              <IconPrinter className="h-4 w-4" />
              Print selected ({selected.size})
            </button>
            <button
              onClick={() => void startBatch(pendingJobs.map((job) => job.id))}
              disabled={busy === 'batch' || pendingJobs.length === 0}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-50"
            >
              Print all queued
            </button>
          </div>
        </div>

        {loading && jobs.length === 0 ? (
          <SkeletonTable rows={4} />
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#241341] px-8 py-12 text-center">
            <p className="text-lg font-semibold text-white">The queue is empty</p>
            <p className="mt-1 text-sm text-white/45">
              Sessions are queued automatically (manual mode) or added from Ready to print below.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#241341]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3">Photo</th>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Info</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobs.map((job: IElectronAPIPrintJob) => {
                  const session = job.token ? sessionsByToken.get(job.token) : undefined;
                  const selectable = job.state === 'pending';
                  return (
                    <tr key={job.id} className="transition hover:bg-white/5">
                      <td className="px-4 py-3">
                        {selectable && (
                          <input
                            type="checkbox"
                            checked={selected.has(job.id)}
                            onChange={() => toggleOne(job.id)}
                            className="h-4 w-4 accent-[#d9f85a]"
                            aria-label={`Select job ${job.id}`}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <JobThumb token={job.token} fileName={job.fileName} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-[0.8rem] text-white/85">
                          {job.token ? shortToken(job.token) : '—'}
                        </div>
                        <div className="mt-0.5 text-xs text-white/40">
                          {session ? formatTimestamp(session.created_at) : 'unknown session'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <JobStateBadge state={job.state} priority={job.priority} />
                      </td>
                      <td className="px-4 py-3 text-xs text-white/50">
                        {job.error ? (
                          <span className="text-[#ff8aa8]">{job.error}</span>
                        ) : job.cupsJobId ? (
                          <span className="font-mono">{job.cupsJobId}</span>
                        ) : job.attempts > 0 ? (
                          `attempt ${job.attempts}`
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {(job.state === 'failed' || job.state === 'canceled') && (
                            <button
                              onClick={() => void retryJob(job.id)}
                              disabled={busy === `retry:${job.id}`}
                              className="rounded-full border border-[#d9f85a]/40 bg-[#d9f85a]/10 px-3 py-1 text-xs font-medium text-[#d9f85a] transition hover:bg-[#d9f85a]/20 disabled:opacity-50"
                            >
                              Retry
                            </button>
                          )}
                          {(job.state === 'pending' || job.state === 'submitted' || job.state === 'processing') && (
                            <button
                              onClick={() => void cancelJob(job.id)}
                              disabled={busy === `cancel:${job.id}`}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                          {job.state !== 'submitted' && job.state !== 'processing' && (
                            <button
                              onClick={() => void removeJob(job.id)}
                              disabled={busy === `remove:${job.id}`}
                              title="Remove from queue"
                              className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                            >
                              <IconTrash className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
            Ready to print ({readySessions.length})
          </h2>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Add session (reprint)
          </button>
        </div>

        {readySessions.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/50">
            No arranged sessions are waiting. Flow-2 sessions appear here once the customer approves their frame.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#241341]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <tbody className="divide-y divide-white/5">
                {readySessions.map((session) => (
                  <tr key={session.token} className="transition hover:bg-white/5">
                    <td className="px-4 py-3">
                      <JobThumb token={session.token} fileName="framed.png" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-[0.8rem] text-white/85">{session.token}</div>
                      <div className="mt-0.5 text-xs text-white/40">{formatTimestamp(session.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => void enqueueSession(session)}
                        disabled={busy === `add:${session.token}`}
                        className="rounded-full bg-[#d9f85a] px-4 py-1.5 text-xs font-semibold text-[#140b26] transition hover:bg-[#bae32f] disabled:opacity-50"
                      >
                        Add to queue
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={addOpen} title="Add a session to the print queue" onClose={() => setAddOpen(false)} width="560px">
        <input
          value={addQuery}
          onChange={(event) => setAddQuery(event.target.value)}
          placeholder="Search by session token…"
          className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/35 focus:border-[#ff4bb5]/60 focus:outline-none"
        />
        <div className="mt-4 max-h-[50vh] space-y-1 overflow-y-auto">
          {addCandidates.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-white/40">No matching sessions.</p>
          ) : (
            addCandidates.map((session) => (
              <div
                key={session.token}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-white/85">{session.token}</div>
                  <div className="text-[11px] text-white/40">
                    {formatTimestamp(session.created_at)} · print: {session.print_status}
                  </div>
                </div>
                <button
                  onClick={() => void enqueueSession(session)}
                  disabled={busy === `add:${session.token}`}
                  className="shrink-0 rounded-full border border-[#d9f85a]/40 bg-[#d9f85a]/10 px-3 py-1 text-xs font-medium text-[#d9f85a] transition hover:bg-[#d9f85a]/20 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

export default PrintQueueScreen;
