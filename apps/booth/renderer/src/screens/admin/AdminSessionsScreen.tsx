import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SessionFileState,
  SessionPrintStatus,
  SessionRecord,
  SessionUploadStatus,
  deleteSessions,
  getUploadedBlob,
  listSessions,
  sessionFileUrl,
  updateSessionRecord,
} from '../../lib/sessions';
import { registerGallerySession, SessionUploadFile, uploadSessionFiles, deleteGallerySession } from '../../utils/sessionUpload';
import { generateQrDataUrl } from '../../utils/qr';
import { GALLERY_URL } from '../../config';
import { dropPendingUploads } from '../../lib/uploadJob';
import { ConfirmModal } from '../../components/admin/Modal';
import { SkeletonCard } from '../../components/admin/Skeleton';
import { EventsManager } from '../../components/admin/EventsManager';
import { assignSessionsToEvent, BoothEvent, listEvents } from '../../lib/events';
import {
  formatTimestamp,
  PrintBadge,
  RefreshIcon,
  UploadBadge,
} from '../../components/admin/StatusBadge';
import {
  IconEye,
  IconGif,
  IconImage,
  IconQr,
  IconSearch,
  IconTrash,
  IconUpload,
} from '../../components/admin/AdminIcons';

type DatePreset = 'all' | 'today' | '7d' | '30d' | 'custom';
type StatusFilter = 'all' | SessionUploadStatus | SessionPrintStatus;
/** 'all', 'none' (unassigned) or an event id. */
type EventFilter = 'all' | 'none' | string;

/**
 * Worker gallery URL for a token. This is what every admin QR/link points at —
 * timed sessions store the /organize/:token page as download_url so the QR on
 * the booth routes the customer to arranging, but by the time the admin opens a
 * session the finished outputs live on the gallery page.
 */
const galleryUrl = (token: string): string => (GALLERY_URL ? `${GALLERY_URL}/p/${token}` : '');

interface ResultLinkProps {
  src: string | null;
  label: string;
  icon: React.ReactNode;
  fit?: 'cover' | 'contain';
}

/**
 * The outputs the booth produces AFTER the customer arranges (see
 * printListener.handleRequest): framed.png is always generated, the two GIFs
 * only when their toggles are on. These belong to the session record so the
 * results modal can show them, but the booth's patch can be missed (offline
 * snapshot, killed renderer, race) even though the gallery holds the files.
 */
const GENERATED_OUTPUTS = ['framed.png', 'result.gif', 'result-live.gif'];

/** Whether a session's record is missing one of the generated outputs. */
const needsGallerySync = (row: SessionRecord): boolean =>
  GENERATED_OUTPUTS.some((name) => !row.files.some((file) => file.name === name && file.uploaded));

/** Merge the gallery's file list into a session record's files by name. */
const mergeGalleryFiles = (
  row: SessionRecord,
  galleryFiles: Array<{ name?: unknown; size?: unknown; url?: unknown }>,
): SessionFileState[] => {
  const next: SessionFileState[] = row.files.slice();
  for (const file of galleryFiles) {
    const name = String(file.name ?? '');
    if (!name || /[.]json$/i.test(name)) continue;
    const url = String(file.url ?? '') || sessionFileUrl(row.token, name) || '';
    const index = next.findIndex((entry) => entry.name === name);
    if (index >= 0) {
      const existing = next[index];
      if (!existing.uploaded) {
        next[index] = {
          ...existing,
          uploaded: true,
          size: existing.size ?? (typeof file.size === 'number' ? file.size : undefined),
          url: url || existing.url,
        };
      } else if (!existing.url && url) {
        next[index] = { ...existing, url };
      }
    } else {
      next.push({ name, uploaded: true, size: typeof file.size === 'number' ? file.size : undefined, url });
    }
  }
  return next;
};

/**
 * Safety net: the gallery is the source of truth for whether files actually
 * uploaded. Sessions left stuck on "uploading" (e.g. the booth was killed or
 * its renderer lost the final patch) get healed here from the gallery's own
 * record, and any session whose generated outputs (framed.png + GIFs) were
 * never recorded gets them merged back in — so the dashboard always shows
 * reality, raw photos and produced outputs alike.
 */
const reconcileFromGallery = async (rows: SessionRecord[]): Promise<SessionRecord[]> => {
  if (!GALLERY_URL) {
    return rows;
  }
  const now = Date.now();
  const candidates = rows.filter((row) => {
    if (needsGallerySync(row)) return true;
    return (
      row.upload_status === 'uploading' &&
      row.created_at &&
      now - new Date(row.created_at).getTime() > 60_000
    );
  });
  if (candidates.length === 0) {
    return rows;
  }

  const synced = new Map<string, SessionRecord>();
  await Promise.all(
    candidates.map(async (row) => {
      try {
        const response = await fetch(`${GALLERY_URL}/api/sessions/${encodeURIComponent(row.token)}`);
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as { files?: Array<{ name?: unknown; size?: unknown; url?: unknown }> };
        const merged = mergeGalleryFiles(row, body.files ?? []);
        const changed = merged.length !== row.files.length;
        const staleUploading =
          row.upload_status === 'uploading' && row.created_at && now - new Date(row.created_at).getTime() > 60_000;
        if (!changed && !staleUploading) {
          return;
        }
        const patch: Parameters<typeof updateSessionRecord>[1] = { files: merged };
        if (staleUploading) {
          patch.upload_status = 'success';
          patch.print_status = 'success';
        }
        updateSessionRecord(row.token, patch);
        synced.set(row.token, {
          ...row,
          files: merged,
          upload_status: patch.upload_status ?? row.upload_status,
          print_status: patch.print_status ?? row.print_status,
        });
      } catch {
        // Gallery unreachable — leave the row untouched; next refresh retries.
      }
    }),
  );
  if (synced.size === 0) {
    return rows;
  }
  return rows.map((row) => synced.get(row.token) ?? row);
};

/** Best available preview: the framed result, else the first photo. */
const sessionPreviewUrl = (session: SessionRecord): string | null => {
  const framed = session.files.find((file) => file.name === 'framed.png' && file.uploaded);
  const photo = session.files
    .filter((file) => file.name.startsWith('photo-') && file.uploaded)
    .sort((a, b) => a.name.localeCompare(b.name))[0];
  const file = framed ?? photo;
  return file ? sessionFileUrl(session.token, file.name) : null;
};

interface SessionCardProps {
  session: SessionRecord;
  event: BoothEvent | null;
  selected: boolean;
  uploadBusy: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onReupload: () => void;
}

type SessionsView = 'gallery' | 'list';
const SESSIONS_VIEW_KEY = 'pb-admin-sessions-view';

const readSessionsView = (): SessionsView => {
  try {
    return localStorage.getItem(SESSIONS_VIEW_KEY) === 'list' ? 'list' : 'gallery';
  } catch {
    return 'gallery';
  }
};

/** Compact table row for the list view: same data and actions as the card. */
const SessionRow: React.FC<SessionCardProps> = ({
  session,
  event,
  selected,
  uploadBusy,
  onToggle,
  onOpen,
  onReupload,
}) => {
  const preview = sessionPreviewUrl(session);
  const isFramed = session.files.some((file) => file.name === 'framed.png' && file.uploaded);
  const photoCount = session.files.filter((file) => file.name.startsWith('photo-')).length;
  return (
    <tr
      className={`border-b border-white/5 transition last:border-0 ${
        selected ? 'bg-pbx-ui-hi/10' : 'hover:bg-white/[0.03]'
      }`}
    >
      <td className="w-10 px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-4 w-4 accent-pbx-ui-hi"
          aria-label={`Select ${session.token}`}
        />
      </td>
      <td className="w-16 py-2">
        <button
          onClick={onOpen}
          title="View results"
          className="block h-14 w-11 overflow-hidden rounded-md bg-black/30 ring-1 ring-white/10 transition hover:ring-pbx-ui-hi/60"
        >
          {preview ? (
            <img
              src={preview}
              alt=""
              loading="lazy"
              className={`h-full w-full ${isFramed ? 'object-contain p-0.5' : 'object-cover'}`}
            />
          ) : (
            <span className="grid h-full place-items-center text-white/25">
              <IconImage className="h-5 w-5" />
            </span>
          )}
        </button>
      </td>
      <td className="px-3 py-2">
        <p className="truncate text-sm font-semibold text-white" title={event?.name ?? 'Unassigned'}>
          {event ? event.name : <span className="text-white/45">Unassigned</span>}
        </p>
        <p className="truncate font-mono text-xs text-white/45" title={session.token}>
          {session.token.slice(0, 8)}
        </p>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-white/60">{formatTimestamp(session.created_at)}</td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-white/60">
        {photoCount} photo{photoCount === 1 ? '' : 's'}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          <UploadBadge status={session.upload_status} />
          <PrintBadge status={session.print_status} />
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1.5">
          {session.upload_status === 'error' && (
            <button
              onClick={onReupload}
              disabled={uploadBusy}
              title="Re-upload failed files"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              {uploadBusy ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <IconUpload className="h-4 w-4" />
              )}
            </button>
          )}
          {galleryUrl(session.token) && (
            <a
              href={galleryUrl(session.token)}
              target="_blank"
              rel="noreferrer"
              title="Open gallery"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <IconQr className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={onOpen}
            title="View results"
            className="grid h-8 w-8 place-items-center rounded-full bg-pbx-ui-hi text-pbx-ui-hi-fg transition hover:bg-pbx-ui-hi-strong"
          >
            <IconEye className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

/** Gallery / list switch (two icon buttons). */
const ViewToggle: React.FC<{ view: SessionsView; onChange: (view: SessionsView) => void }> = ({ view, onChange }) => (
  <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5" role="group" aria-label="Sessions view">
    {(
      [
        {
          id: 'gallery',
          label: 'Gallery view',
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="2" />
              <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="2" />
              <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="2" />
              <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="2" />
            </svg>
          ),
        },
        {
          id: 'list',
          label: 'List view',
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M9 6h12M9 12h12M9 18h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <rect x="3" y="4.5" width="3" height="3" rx="0.8" fill="currentColor" />
              <rect x="3" y="10.5" width="3" height="3" rx="0.8" fill="currentColor" />
              <rect x="3" y="16.5" width="3" height="3" rx="0.8" fill="currentColor" />
            </svg>
          ),
        },
      ] as const
    ).map((option) => (
      <button
        key={option.id}
        onClick={() => onChange(option.id)}
        title={option.label}
        aria-label={option.label}
        aria-pressed={view === option.id}
        className={`grid h-8 w-9 place-items-center rounded-full transition ${
          view === option.id ? 'bg-pbx-ui-hi text-pbx-ui-hi-fg' : 'text-white/60 hover:bg-white/10 hover:text-white'
        }`}
      >
        {option.icon}
      </button>
    ))}
  </div>
);

/** Grid card mirroring the Frames screen: framed result + session info. */
const SessionCard: React.FC<SessionCardProps> = ({
  session,
  event,
  selected,
  uploadBusy,
  onToggle,
  onOpen,
  onReupload,
}) => {
  const preview = sessionPreviewUrl(session);
  const isFramed = session.files.some((file) => file.name === 'framed.png' && file.uploaded);
  const photoCount = session.files.filter((file) => file.name.startsWith('photo-')).length;
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-pbx-ui-raised shadow-lg transition ${
        selected ? 'border-pbx-ui-hi ring-2 ring-pbx-ui-hi/40' : 'border-white/10 hover:border-pbx-ui-brand/40'
      }`}
    >
      <div className="relative aspect-[3/4] bg-black/30">
        {preview ? (
          <img
            src={preview}
            alt={`Session ${session.token}`}
            loading="lazy"
            className={`h-full w-full ${isFramed ? 'object-contain p-2' : 'object-cover'}`}
          />
        ) : (
          <div className="grid h-full place-items-center text-white/25">
            <IconImage className="h-10 w-10" />
          </div>
        )}

        <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-black/55 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
          <button
            onClick={onOpen}
            title="View results"
            className="grid h-10 w-10 place-items-center rounded-full bg-pbx-ui-hi text-pbx-ui-hi-fg transition hover:bg-pbx-ui-hi-strong"
          >
            <IconEye />
          </button>
          {galleryUrl(session.token) && (
            <a
              href={galleryUrl(session.token)}
              target="_blank"
              rel="noreferrer"
              title="Open gallery"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30"
            >
              <IconQr className="h-5 w-5" />
            </a>
          )}
          {session.upload_status === 'error' && (
            <button
              onClick={onReupload}
              disabled={uploadBusy}
              title="Re-upload failed files"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30 disabled:opacity-60"
            >
              {uploadBusy ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <IconUpload className="h-5 w-5" />
              )}
            </button>
          )}
        </div>

        {/* Above the hover overlay so selecting never needs a hover first. */}
        <label className="absolute left-2 top-2 z-20 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-black/55 backdrop-blur">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="h-4 w-4 accent-pbx-ui-hi"
            aria-label={`Select ${session.token}`}
          />
        </label>
      </div>

      <div className="space-y-2 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-white" title={event?.name ?? 'Unassigned'}>
            {event ? event.name : <span className="text-white/45">Unassigned</span>}
          </p>
          <span className="shrink-0 text-xs text-white/40">
            {photoCount} photo{photoCount === 1 ? '' : 's'}
          </span>
        </div>
        <p className="truncate text-xs text-white/50" title={session.token}>
          {formatTimestamp(session.created_at)} · <span className="font-mono">{session.token.slice(0, 8)}</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          <UploadBadge status={session.upload_status} />
          <PrintBadge status={session.print_status} />
        </div>
      </div>
    </div>
  );
};

export const AdminSessionsScreen: React.FC = () => {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [resultsToken, setResultsToken] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [resultsQr, setResultsQr] = useState<string | null>(null);
  const [resultsQrFull, setResultsQrFull] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [uploadFilter, setUploadFilter] = useState<StatusFilter>('all');
  const [printFilter, setPrintFilter] = useState<StatusFilter>('all');
  const [events, setEvents] = useState<BoothEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [eventsOpen, setEventsOpen] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [view, setView] = useState<SessionsView>(readSessionsView);
  const changeView = (next: SessionsView) => {
    setView(next);
    try {
      localStorage.setItem(SESSIONS_VIEW_KEY, next);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  };

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [rows, eventRows] = await Promise.all([
        listSessions(),
        // Events are optional context: a failure here must not hide sessions.
        listEvents().catch(() => null),
      ]);
      if (eventRows) setEvents(eventRows);
      setSessions(await reconcileFromGallery(rows));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh(true), 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const eventCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessions) {
      if (session.event_id) counts.set(session.event_id, (counts.get(session.event_id) ?? 0) + 1);
    }
    return counts;
  }, [sessions]);
  const activeEvent = events.find((event) => event.is_active) ?? null;

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;

    if (datePreset === 'today') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (datePreset === '7d') {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (datePreset === '30d') {
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (datePreset === 'custom') {
      if (customFrom) from = new Date(`${customFrom}T00:00:00`);
      if (customTo) to = new Date(`${customTo}T23:59:59.999`);
    }

    return sessions.filter((session) => {
      if (eventFilter === 'none' && session.event_id) return false;
      if (eventFilter !== 'all' && eventFilter !== 'none' && session.event_id !== eventFilter) return false;
      if (query) {
        const eventName = session.event_id ? eventsById.get(session.event_id)?.name ?? '' : '';
        if (!session.token.toLowerCase().includes(query) && !eventName.toLowerCase().includes(query)) return false;
      }
      if (uploadFilter !== 'all' && session.upload_status !== uploadFilter) return false;
      if (printFilter !== 'all' && session.print_status !== printFilter) return false;
      const created = new Date(session.created_at).getTime();
      if (from && created < from.getTime()) return false;
      if (to && created > to.getTime()) return false;
      return true;
    });
  }, [sessions, searchQuery, datePreset, customFrom, customTo, uploadFilter, printFilter, eventFilter, eventsById]);

  const allVisibleSelected = filteredSessions.length > 0 && filteredSessions.every((s) => selected.has(s.token));

  const toggleAll = () => {
    setSelected(allVisibleSelected ? new Set() : new Set(filteredSessions.map((s) => s.token)));
  };

  const toggleOne = (token: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(token)) next.delete(token);
      else next.add(token);
      return next;
    });
  };

  const handleReupload = async (session: SessionRecord) => {
    setBusy(`upload:${session.token}`);
    try {
      const failed = session.files.filter((file) => !file.uploaded && file.name);
      const uploads: SessionUploadFile[] = [];
      for (const file of failed) {
        const blob = await getUploadedBlob(session.token, file.name);
        if (blob) uploads.push({ blob, name: file.name });
      }
      if (uploads.length === 0) {
        setError('No cached files to re-upload for this session were found on this device.');
        setBusy(null);
        return;
      }
      if (!GALLERY_URL) {
        setError('Gallery is not configured (VITE_GALLERY_URL), cannot re-upload.');
        setBusy(null);
        return;
      }
      await registerGallerySession(GALLERY_URL, session.token);
      const results = await uploadSessionFiles(uploads, GALLERY_URL, session.token);
      const merged = session.files.map((file) => {
        const result = results.find((r) => r.name === file.name);
        if (!result) return file;
        return {
          ...file,
          uploaded: result.ok,
          url: result.ok ? sessionFileUrl(session.token, file.name) ?? undefined : file.url,
        };
      });
      updateSessionRecord(session.token, {
        files: merged,
        download_url: session.download_url,
        upload_status: results.some((r) => !r.ok) ? 'error' : 'success',
      });
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-upload failed');
    } finally {
      setBusy(null);
    }
  };

  const handleMove = async (eventId: string | null) => {
    setMoveBusy(true);
    try {
      await assignSessionsToEvent(Array.from(selected), eventId);
      setSelected(new Set());
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Moving sessions failed');
    } finally {
      setMoveBusy(false);
    }
  };

  const handleDelete = async () => {
    setDeleteBusy(true);
    const tokens = Array.from(selected);
    try {
      // Purge the objects first; if any gallery delete fails, bail before
      // removing rows so nothing is orphaned (DB row without storage).
      const galleryUrl = GALLERY_URL;
      if (galleryUrl) {
        const results = await Promise.all(
          tokens.map((token) =>
            deleteGallerySession(galleryUrl, token).then(
              () => null,
              (error) => error,
            ),
          ),
        );
        const failures = results.filter((result): result is Error => result instanceof Error);
        if (failures.length > 0) {
          throw new Error(`Gallery storage delete failed for ${failures.length} session(s): ${failures[0].message}`);
        }
      }
      await deleteSessions(tokens);
      dropPendingUploads(tokens);
      setSelected(new Set());
      setDeleteOpen(false);
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleteBusy(false);
    }
  };

  const resultsSession = useMemo(() => sessions.find((s) => s.token === resultsToken) ?? null, [sessions, resultsToken]);

  useEffect(() => {
    if (!resultsToken) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (resultsQrFull) {
          setResultsQrFull(false);
        } else {
          setResultsToken(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resultsToken, resultsQrFull]);

  useEffect(() => {
    const url = resultsSession ? galleryUrl(resultsSession.token) : '';
    if (!url) {
      setResultsQr(null);
      return;
    }
    let cancelled = false;
    generateQrDataUrl(url, 220)
      .then((qr) => {
        if (!cancelled) setResultsQr(qr);
      })
      .catch(() => {
        if (!cancelled) setResultsQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [resultsSession]);

  // Larger QR for the enlarged view / download.
  const [fullQr, setFullQr] = useState<string | null>(null);
  useEffect(() => {
    const url = resultsSession && resultsQrFull ? galleryUrl(resultsSession.token) : '';
    if (!resultsQrFull || !url) {
      setFullQr(null);
      return;
    }
    let cancelled = false;
    generateQrDataUrl(url, 512)
      .then((qr) => {
        if (!cancelled) setFullQr(qr);
      })
      .catch(() => {
        if (!cancelled) setFullQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [resultsQrFull, resultsSession]);

  // When the results modal opens, reconcile the row against the gallery
  // immediately so framed/live/gif outputs the booth recorded late are visible
  // without waiting for the next background sync (30s).
  useEffect(() => {
    if (!resultsSession || !GALLERY_URL) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${GALLERY_URL}/api/sessions/${encodeURIComponent(resultsSession.token)}`);
        if (!response.ok) return;
        const body = (await response.json()) as { files?: Array<{ name?: unknown; size?: unknown; url?: unknown }> };
        if (cancelled) return;
        const merged = mergeGalleryFiles(resultsSession, body.files ?? []);
        if (merged.length === resultsSession.files.length) return;
        updateSessionRecord(resultsSession.token, { files: merged });
        setSessions((prev) => prev.map((row) => (row.token === resultsSession.token ? { ...row, files: merged } : row)));
      } catch {
        // Gallery unreachable — the background sync will retry later.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resultsSession]);

  // Download a data URL (QR image) as a file.
  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const photoFiles = useMemo(
    () =>
      resultsSession?.files.filter((file) => file.name.startsWith('photo-')).sort((a, b) => a.name.localeCompare(b.name)) ??
      [],
    [resultsSession],
  );
  const framedFile = resultsSession?.files.find((file) => file.name === 'framed.png');
  const liveFile = resultsSession?.files.find((file) => file.name === 'result-live.gif');
  const gifFile = resultsSession?.files.find((file) => file.name === 'result.gif');

  const resultUrl = (file: SessionFileState | undefined): string | null =>
    file ? sessionFileUrl(resultsSession!.token, file.name) : null;

  const ResultLink: React.FC<ResultLinkProps> = ({ src, label, icon, fit = 'cover' }) =>
    src ? (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="group relative block overflow-hidden rounded-xl border border-white/10 bg-pbx-ui-raised"
      >
        <img
          src={src}
          alt={label}
          className={`w-full ${fit === 'contain' ? 'aspect-square bg-black/30 p-2 object-contain' : 'aspect-square object-cover'} transition group-hover:scale-105`}
        />
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-black/70 px-2 py-1.5 text-xs text-white/90">
          {icon}
          {label}
        </span>
      </a>
    ) : null;

  return (
    <div >
      <header className="flex flex-wrap items-center justify-between gap-3 p-3 ">
        <div>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="mt-0.5 text-sm text-white/50">
            {filteredSessions.length} of {sessions.length} record{sessions.length === 1 ? '' : 's'}
            {' · '}
            {activeEvent ? (
              <>
                filing new sessions under <span className="font-semibold text-pbx-ui-hi">{activeEvent.name}</span>
              </>
            ) : (
              'no active event, new sessions are unassigned'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selected.size > 0 && (
            <select
              value=""
              disabled={moveBusy}
              onChange={(e) => {
                const value = e.target.value;
                if (value) void handleMove(value === 'none' ? null : value);
              }}
              className="rounded-full border border-white/10 bg-pbx-ui-raised px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
              aria-label="Move selected sessions to event"
            >
              <option value="">{moveBusy ? 'Moving…' : `Move ${selected.size} to…`}</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
              <option value="none">Unassigned</option>
            </select>
          )}
          <button
            onClick={() => setEventsOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10"
          >
            Events
          </button>
          {selected.size > 0 && (
            <button
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[#ff5e87]/40 bg-[#ff5e87]/10 px-4 py-2 text-sm font-semibold text-[#ff8aa8] transition hover:bg-[#ff5e87]/20"
            >
              <IconTrash className="h-4 w-4" />
              Delete {selected.size}
            </button>
          )}
          <RefreshIcon onClick={() => { setRefreshing(true); refresh(true); }} spinning={refreshing} />
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-[#ff5e87]/40 bg-[#ff5e87]/10 px-4 py-3 text-sm text-[#ff8aa8]">
          {error}
        </div>
      )}

      <div className="mb-3 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filter by event">
        {(
          [
            { id: 'all', label: 'All events', count: sessions.length },
            ...events.map((event) => ({
              id: event.id,
              label: event.name,
              count: eventCounts.get(event.id) ?? 0,
              active: event.is_active,
            })),
            {
              id: 'none',
              label: 'Unassigned',
              count: sessions.filter((session) => !session.event_id).length,
            },
          ] as Array<{ id: EventFilter; label: string; count: number; active?: boolean }>
        ).map((chip) => (
          <button
            key={chip.id}
            role="tab"
            aria-selected={eventFilter === chip.id}
            onClick={() => {
              setEventFilter(chip.id);
              setSelected(new Set());
            }}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition ${
              eventFilter === chip.id
                ? 'border-pbx-ui-hi/60 bg-pbx-ui-hi/15 font-semibold text-pbx-ui-hi'
                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            {chip.active && <span className="h-2 w-2 rounded-full bg-pbx-ui-hi" aria-label="Active event" />}
            <span className="max-w-[14rem] truncate">{chip.label}</span>
            <span className="text-xs opacity-60">{chip.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-pbx-ui-raised p-3 mb-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <IconSearch className="h-4 w-4 shrink-0 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by session id or event…"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="shrink-0 rounded-full px-2 py-0.5 text-xs text-white/40 transition hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              &#10005;
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-white/50">
            Date
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="rounded-lg border border-white/10 bg-pbx-ui-panel px-2.5 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom…</option>
            </select>
          </label>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-white/10 bg-pbx-ui-panel px-2 py-1.5 text-sm text-white focus:outline-none [color-scheme:dark]"
                aria-label="From date"
              />
              <span className="text-xs text-white/40">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-white/10 bg-pbx-ui-panel px-2 py-1.5 text-sm text-white focus:outline-none [color-scheme:dark]"
                aria-label="To date"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-white/50">
            Upload
            <select
              value={uploadFilter}
              onChange={(e) => setUploadFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-white/10 bg-pbx-ui-panel px-2.5 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="all">All</option>
              <option value="uploading">Uploading</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-white/50">
            Print
            <select
              value={printFilter}
              onChange={(e) => setPrintFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-white/10 bg-pbx-ui-panel px-2.5 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="all">All</option>
              <option value="printing">Printing</option>
              <option value="ready_to_print">Ready to print</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-pbx-ui-raised px-8 py-16 text-center">
          <p className="text-lg font-semibold text-white">No sessions yet</p>
          <p className="mt-1 text-sm text-white/45">Finished booth rounds will appear here once a session is saved.</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-pbx-ui-raised px-8 py-12 text-center">
          <p className="text-sm text-white/45">No sessions match the current filters.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 px-1 text-xs text-white/50">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAll}
              className="h-4 w-4 accent-pbx-ui-hi"
              id="sessions-select-all"
            />
            <label htmlFor="sessions-select-all">Select all {filteredSessions.length} shown</label>
            <div className="ml-auto">
              <ViewToggle view={view} onChange={changeView} />
            </div>
          </div>
          {view === 'gallery' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredSessions.map((session) => (
                <SessionCard
                  key={session.token}
                  session={session}
                  event={session.event_id ? eventsById.get(session.event_id) ?? null : null}
                  selected={selected.has(session.token)}
                  uploadBusy={busy === `upload:${session.token}`}
                  onToggle={() => toggleOne(session.token)}
                  onOpen={() => setResultsToken(session.token)}
                  onReupload={() => handleReupload(session)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-pbx-ui-raised">
              <table className="w-full min-w-[720px] text-left">
                <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                  <tr>
                    <th className="w-10 px-3 py-2.5" />
                    <th className="w-16 py-2.5">Result</th>
                    <th className="px-3 py-2.5">Event / session</th>
                    <th className="px-3 py-2.5">Created</th>
                    <th className="px-3 py-2.5">Photos</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session) => (
                    <SessionRow
                      key={session.token}
                      session={session}
                      event={session.event_id ? eventsById.get(session.event_id) ?? null : null}
                      selected={selected.has(session.token)}
                      uploadBusy={busy === `upload:${session.token}`}
                      onToggle={() => toggleOne(session.token)}
                      onOpen={() => setResultsToken(session.token)}
                      onReupload={() => handleReupload(session)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <EventsManager
        open={eventsOpen}
        events={events}
        counts={eventCounts}
        onClose={() => setEventsOpen(false)}
        onChanged={() => refresh(true)}
      />

      <ConfirmModal
        open={deleteOpen}
        title={`Delete ${selected.size} session${selected.size === 1 ? '' : 's'}?`}
        message="This removes the admin records. Gallery uploads already stored on the server stay in place but become unreachable from the dashboard."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        busy={deleteBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      {resultsSession && (
        <div
          className="fixed inset-0 z-[200] flex flex-col"
          style={{
            background: 'rgb(var(--pbx-ui-bg-rgb)/0.96)',
            animation: 'pb-modal-fade 0.25s ease-out both',
          }}
          onMouseDown={() => setResultsToken(null)}
        >
          <header
            className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-pbx-ui-panel/80 px-5 py-4 backdrop-blur"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-center gap-4">
              {resultsQr ? (
                <button
                  onClick={() => setResultsQrFull(true)}
                  title="Enlarge QR code"
                  className="shrink-0 rounded-lg bg-white p-0.5 transition-transform hover:scale-105"
                >
                  <img src={resultsQr} alt="Gallery QR" className="h-14 w-14" />
                </button>
              ) : (
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-white/10 text-white/30">
                  <IconQr className="h-7 w-7" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white">Session results</h3>
                <p className="truncate font-mono text-xs text-white/70">{resultsSession.token}</p>
                <p className="text-xs text-white/40">
                  {formatTimestamp(resultsSession.created_at)}
                  {resultsSession.event_id && eventsById.get(resultsSession.event_id) && (
                    <> · {eventsById.get(resultsSession.event_id)!.name}</>
                  )}
                </p>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-3">
              {galleryUrl(resultsSession.token) && (
                <a
                  href={galleryUrl(resultsSession.token)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-pbx-ui-hi transition hover:bg-white/10"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <IconQr className="h-3.5 w-3.5" />
                  Open gallery
                </a>
              )}
              <button
                onClick={() => setResultsToken(null)}
                className="grid h-9 w-9 place-items-center rounded-full bg-pbx-ui-brand text-pbx-ui-brand-fg shadow-[0_4px_12px_rgba(0,0,0,0.45)] transition-transform hover:scale-110 active:scale-95"
                aria-label="Close"
              >
                &#10005;
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
            <div
              className="mx-auto w-full max-w-6xl space-y-8 p-5 sm:p-8"
              style={{ animation: 'pb-modal-zoom 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2) both' }}
            >
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="space-y-8 lg:col-span-1">
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/60">
                      <IconImage className="h-4 w-4 text-pbx-ui-brand" />
                      Framed photo
                    </h4>
                    <ResultLink
                      src={framedFile && framedFile.uploaded ? resultUrl(framedFile) : null}
                      label="Framed"
                      icon={<IconImage className="h-3.5 w-3.5" />}
                      fit="contain"
                    />
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/60">
                      <IconGif className="h-4 w-4 text-pbx-ui-secondary" />
                      Framed live photo
                    </h4>
                    <ResultLink
                      src={liveFile && liveFile.uploaded ? resultUrl(liveFile) : null}
                      label="Live"
                      icon={<IconGif className="h-3.5 w-3.5" />}
                      fit="contain"
                    />
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/60">
                      <IconGif className="h-4 w-4 text-pbx-ui-brand" />
                      Animated GIF
                    </h4>
                    <ResultLink
                      src={gifFile && gifFile.uploaded ? resultUrl(gifFile) : null}
                      label="GIF"
                      icon={<IconGif className="h-3.5 w-3.5" />}
                      fit="contain"
                    />
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/60">
                    <IconImage className="h-4 w-4 text-pbx-ui-hi" />
                    Photos ({photoFiles.length})
                  </h4>
                  {photoFiles.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-pbx-ui-raised px-4 py-8 text-center text-sm text-white/40">
                      No individual photos recorded.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                      {photoFiles.map((file) => (
                        <ResultLink
                          key={file.name}
                          src={file.uploaded ? resultUrl(file) : null}
                          label={file.name.replace('photo-', '').replace('.jpg', '')}
                          icon={<IconImage className="h-3.5 w-3.5" />}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {resultsSession.files.length === 0 && (
                <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
                  This session has no uploaded files on record — try Re-upload.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enlarged QR — view and download */}
      {resultsQrFull && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-pbx-ui-panel/95 p-4"
          style={{ animation: 'pb-modal-fade 0.25s ease-out both' }}
          onClick={() => setResultsQrFull(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[18px] border-[4px] border-pbx-ui-brand bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-center text-[0.9rem] font-black uppercase tracking-[0.14em] text-pbx-ink">
              Scan untuk unduh
            </h2>
            {fullQr ? (
              <img src={fullQr} alt="Large QR code" className="h-72 w-72 rounded-[12px]" />
            ) : (
              <div className="flex h-72 w-72 items-center justify-center animate-pulse rounded-[12px] bg-gray-200">
                <span className="animate-spin text-xl">⏳</span>
              </div>
            )}
            {resultsSession && galleryUrl(resultsSession.token) && (
              <p className="max-w-full break-all text-center text-[0.6rem] font-bold text-pbx-ink">
                {galleryUrl(resultsSession.token)}
              </p>
            )}
            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => fullQr && downloadDataUrl(fullQr, 'gallery-qr.png')}
                disabled={!fullQr}
                className="rounded-full bg-pbx-ui-brand px-5 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-pbx-ui-brand-fg shadow-[0_3px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                Download QR
              </button>
              <button
                onClick={() => setResultsQrFull(false)}
                className="rounded-full bg-pbx-ink px-5 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-white shadow-[0_3px_0_rgba(0,0,0,0.15)]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};