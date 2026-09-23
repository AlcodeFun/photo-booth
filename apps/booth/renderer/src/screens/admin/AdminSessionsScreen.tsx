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
import { useBoothConfig } from '../../store/boothConfigStore';
import { dropPendingUploads } from '../../lib/uploadJob';
import { ConfirmModal } from '../../components/admin/Modal';
import { SkeletonTable } from '../../components/admin/Skeleton';
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
  IconPrinter,
  IconQr,
  IconSearch,
  IconTrash,
  IconUpload,
} from '../../components/admin/AdminIcons';

type DatePreset = 'all' | 'today' | '7d' | '30d' | 'custom';
type StatusFilter = 'all' | SessionUploadStatus | SessionPrintStatus;

const printSheet = (src: string) => {
  const frame = document.createElement('iframe');
  frame.style.cssText =
    'position:fixed;right:0;bottom:0;width:210px;height:297px;border:0;opacity:0.01;z-index:-1;pointer-events:none;';
  document.body.appendChild(frame);
  frame.onload = () => {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html><head><style>
      @page { size: 101.6mm 152.4mm; margin: 0; }
      html, body { margin: 0; }
      .print-sheet { width: 4in; height: 6in; overflow: hidden; }
      .print-sheet img { width: 100%; height: 100%; object-fit: cover; display: block; }
    </style></head><body>
      <div class="print-sheet"><img src="${src}" onload="setTimeout(function(){ window.focus(); window.print(); }, 250)" /></div>
    </body></html>`);
    doc.close();
  };
  setTimeout(() => {
    document.body.removeChild(frame);
    if (src.startsWith('blob:')) URL.revokeObjectURL(src);
  }, 60000);
};

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

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = await listSessions();
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
      if (query && !session.token.toLowerCase().includes(query)) return false;
      if (uploadFilter !== 'all' && session.upload_status !== uploadFilter) return false;
      if (printFilter !== 'all' && session.print_status !== printFilter) return false;
      const created = new Date(session.created_at).getTime();
      if (from && created < from.getTime()) return false;
      if (to && created > to.getTime()) return false;
      return true;
    });
  }, [sessions, searchQuery, datePreset, customFrom, customTo, uploadFilter, printFilter]);

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

  const handleReprint = async (session: SessionRecord) => {
    setBusy(`print:${session.token}`);
    try {
      let src: string | null = null;
      const cached = await getUploadedBlob(session.token, 'framed.png');
      if (cached) {
        src = URL.createObjectURL(cached);
      } else {
        src = sessionFileUrl(session.token, 'framed.png');
      }
      if (!src) {
        setError('No framed photo to print was found.');
        return;
      }
      printSheet(src);
      updateSessionRecord(session.token, { print_status: 'success' });
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reprint failed');
    } finally {
      setBusy(null);
    }
  };

  /**
   * Manual print for flow-2 (timed) sessions: the customer approved an
   * arrangement on the /organize/:token page and the booth listener already
   * generated framed.png (plus the GIF/live outputs), leaving the row at
   * 'ready_to_print'. This is the ONLY thing that moves that row to
   * 'success'/'error' — the booth never auto-prints. Prints the framed sheet
   * through the configured CUPS queue when available, else falls back to the
   * browser print dialog.
   */
  const handlePrint = async (session: SessionRecord) => {
    const { printer } = useBoothConfig.getState();
    const busyKey = `print:${session.token}`;
    setBusy(busyKey);
    try {
      let src: string | null = null;
      const cached = await getUploadedBlob(session.token, 'framed.png');
      if (cached) {
        src = URL.createObjectURL(cached);
      } else {
        src = sessionFileUrl(session.token, 'framed.png');
      }
      if (!src) {
        setError('The framed photo has not been generated yet for this session.');
        return;
      }

      let printed = false;
      const api = window.electronAPI?.printer;
      if (printer.enabled && printer.queueName && api) {
        try {
          const response = await fetch(src);
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Reading the framed photo failed.'));
            reader.readAsDataURL(blob);
          });
          const result = await api.print({
            dataUrl,
            fileName: 'photo-booth-print.jpg',
            queueName: printer.queueName,
            copies: printer.copies,
            paperSize: printer.paperSize,
            mediaType: printer.mediaType,
            quality: printer.quality,
            colorMode: printer.colorMode,
          });
          printed = result.ok;
          if (!result.ok) {
            setError('The printer rejected the job.');
          }
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Printing failed.');
        }
      } else {
        printSheet(src);
        printed = true;
      }

      updateSessionRecord(session.token, { print_status: printed ? 'success' : 'error' });
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setBusy(null);
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
        className="group relative block overflow-hidden rounded-xl border border-white/10 bg-[#2b1a4a]"
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
            {filteredSessions.length} of {sessions.length} record{sessions.length === 1 ? '' : 's'} — re-upload or reprint failed work, inspect results
          </p>
        </div>
        <div className="flex items-center gap-3">
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

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#241341] p-3 mb-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <IconSearch className="h-4 w-4 shrink-0 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by session id…"
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
              className="rounded-lg border border-white/10 bg-[#1a0b2e] px-2.5 py-1.5 text-sm text-white focus:outline-none"
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
                className="rounded-lg border border-white/10 bg-[#1a0b2e] px-2 py-1.5 text-sm text-white focus:outline-none [color-scheme:dark]"
                aria-label="From date"
              />
              <span className="text-xs text-white/40">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#1a0b2e] px-2 py-1.5 text-sm text-white focus:outline-none [color-scheme:dark]"
                aria-label="To date"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-white/50">
            Upload
            <select
              value={uploadFilter}
              onChange={(e) => setUploadFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-white/10 bg-[#1a0b2e] px-2.5 py-1.5 text-sm text-white focus:outline-none"
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
              className="rounded-lg border border-white/10 bg-[#1a0b2e] px-2.5 py-1.5 text-sm text-white focus:outline-none"
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
        <SkeletonTable rows={7} />
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#241341] px-8 py-16 text-center">
          <p className="text-lg font-semibold text-white">No sessions yet</p>
          <p className="mt-1 text-sm text-white/45">Finished booth rounds will appear here once a session is saved.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#241341]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-[#d9f85a]"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Upload</th>
                <th className="px-4 py-3">Print</th>
                <th className="px-4 py-3 text-right">Results</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-white/40">
                    No sessions match the current filters.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                const isSelected = selected.has(session.token);
                const uploadBusy = busy === `upload:${session.token}`;
                const printBusy = busy === `print:${session.token}`;
                return (
                  <tr key={session.token} className={`transition ${isSelected ? 'bg-white/5' : 'hover:bg-white/5'}`}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(session.token)}
                        className="h-4 w-4 accent-[#d9f85a]"
                        aria-label={`Select ${session.token}`}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div
                        className="max-w-[16rem] truncate font-mono text-[0.8rem] leading-snug text-white/85"
                        title={session.token}
                      >
                        {session.token}
                      </div>
                      <div className="mt-0.5 text-xs text-white/40">
                        {formatTimestamp(session.created_at)}
                        {galleryUrl(session.token) && (
                          <a
                            href={galleryUrl(session.token)}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 text-[#a35ef6] hover:text-[#b87dff]"
                          >
                            view gallery
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <UploadBadge status={session.upload_status} />
                        {session.upload_status === 'error' && (
                          <button
                            onClick={() => handleReupload(session)}
                            disabled={uploadBusy}
                            title="Re-upload failed files"
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-60"
                          >
                            {uploadBusy ? (
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                              <IconUpload className="h-3.5 w-3.5" />
                            )}
                            Re-upload
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <PrintBadge status={session.print_status} />
                        {session.print_status === 'ready_to_print' && (
                          <button
                            onClick={() => handlePrint(session)}
                            disabled={printBusy}
                            title="Print the framed photo on the booth printer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#d9f85a]/10 text-[#d9f85a] px-3 py-1 text-xs font-medium transition hover:bg-[#d9f85a]/20 disabled:opacity-60"
                          >
                            {printBusy ? (
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                              <IconPrinter className="h-3.5 w-3.5" />
                            )}
                            Print
                          </button>
                        )}
                        {session.print_status === 'error' && (
                          <button
                            onClick={() => handleReprint(session)}
                            disabled={printBusy}
                            title="Reprint the framed photo"
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-60"
                          >
                            {printBusy ? (
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                              <IconPrinter className="h-3.5 w-3.5" />
                            )}
                            Reprint
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => setResultsToken(session.token)}
                        title="View results"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                      >
                        <IconEye className="h-4 w-4" />
                        Results
                      </button>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

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
            background: 'rgba(10,5,25,0.96)',
            animation: 'pb-modal-fade 0.25s ease-out both',
          }}
          onMouseDown={() => setResultsToken(null)}
        >
          <header
            className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1a0b2e]/80 px-5 py-4 backdrop-blur"
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
                <p className="text-xs text-white/40">{formatTimestamp(resultsSession.created_at)}</p>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-3">
              {galleryUrl(resultsSession.token) && (
                <a
                  href={galleryUrl(resultsSession.token)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-[#d9f85a] transition hover:bg-white/10"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <IconQr className="h-3.5 w-3.5" />
                  Open gallery
                </a>
              )}
              <button
                onClick={() => setResultsToken(null)}
                className="grid h-9 w-9 place-items-center rounded-full bg-[#ff4bb5] text-white shadow-[0_4px_12px_rgba(0,0,0,0.45)] transition-transform hover:scale-110 active:scale-95"
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
                      <IconImage className="h-4 w-4 text-[#ff4bb5]" />
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
                      <IconGif className="h-4 w-4 text-[#a35ef6]" />
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
                      <IconGif className="h-4 w-4 text-[#ff4bb5]" />
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
                    <IconImage className="h-4 w-4 text-[#d9f85a]" />
                    Photos ({photoFiles.length})
                  </h4>
                  {photoFiles.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-[#241341] px-4 py-8 text-center text-sm text-white/40">
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
          className="fixed inset-0 z-[210] flex items-center justify-center bg-[#1a0b2e]/95 p-4"
          style={{ animation: 'pb-modal-fade 0.25s ease-out both' }}
          onClick={() => setResultsQrFull(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[18px] border-[4px] border-[#ff4bb5] bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-center text-[0.9rem] font-black uppercase tracking-[0.14em] text-[#4d2d85]">
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
              <p className="max-w-full break-all text-center text-[0.6rem] font-bold text-[#4d2d85]">
                {galleryUrl(resultsSession.token)}
              </p>
            )}
            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => fullQr && downloadDataUrl(fullQr, 'gallery-qr.png')}
                disabled={!fullQr}
                className="rounded-full bg-[#ff4bb5] px-5 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-white shadow-[0_3px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                Download QR
              </button>
              <button
                onClick={() => setResultsQrFull(false)}
                className="rounded-full bg-[#4d2d85] px-5 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-white shadow-[0_3px_0_rgba(0,0,0,0.15)]"
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