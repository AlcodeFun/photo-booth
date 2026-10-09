import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { GALLERY_URL } from '../../config';
import { listEvents, type BoothEvent } from '../../lib/events';
import {
  MAX_VOUCHER_BATCH,
  createVouchers,
  deleteVouchers,
  formatVoucherCode,
  listVouchers,
  reactivateVouchers,
  revokeVouchers,
  voucherStatus,
  type Voucher,
  type VoucherStatus,
} from '../../lib/vouchers';
import { generateQrDataUrl } from '../../utils/qr';
import { downloadVoucherCard, downloadVoucherCardsZip } from '../../lib/voucherCard';
import { useBoothAppearance } from '../../store/appearanceStore';
import { Modal, ConfirmModal } from '../../components/admin/Modal';
import { Snackbar, type SnackbarVariant } from '../../components/admin/Snackbar';
import { IconPlus, IconTrash } from '../../components/admin/AdminIcons';

type StatusFilter = 'all' | VoucherStatus;

const STATUS_STYLE: Record<VoucherStatus, string> = {
  active: 'border-[#3ecf7a]/40 bg-[#3ecf7a]/10 text-[#7be3a6]',
  used: 'border-white/15 bg-white/5 text-white/60',
  expired: 'border-[#f5b942]/40 bg-[#f5b942]/10 text-[#f7cd73]',
  revoked: 'border-[#ff5e87]/40 bg-[#ff5e87]/10 text-[#ff8aa8]',
};

const STATUS_LABEL: Record<VoucherStatus, string> = {
  active: 'Active',
  used: 'Used',
  expired: 'Expired',
  revoked: 'Revoked',
};

const inputClass =
  'w-full rounded-lg border border-white/10 bg-pbx-ui-raised px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-pbx-ui-brand/60 focus:outline-none [color-scheme:dark]';

const formatDateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const defaultBatchName = () =>
  `Batch ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

/** Admin -> Vouchers: generate, print and manage single-use booth vouchers. */
export const AdminVouchersScreen: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [events, setEvents] = useState<BoothEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [batchFilter, setBatchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generateOpen, setGenerateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; variant: SnackbarVariant } | null>(null);
  const [printSheet, setPrintSheet] = useState<Array<{ voucher: Voucher; qr: string }> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [rows, eventRows] = await Promise.all([listVouchers(), listEvents().catch(() => [])]);
      setVouchers(rows);
      setEvents(eventRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load vouchers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const batches = useMemo(() => [...new Set(vouchers.map((v) => v.batch).filter(Boolean))], [vouchers]);

  const counts = useMemo(() => {
    const result: Record<VoucherStatus, number> = { active: 0, used: 0, expired: 0, revoked: 0 };
    for (const voucher of vouchers) result[voucherStatus(voucher)] += 1;
    return result;
  }, [vouchers]);

  const visible = useMemo(() => {
    const query = search.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return vouchers.filter(
      (voucher) =>
        (filter === 'all' || voucherStatus(voucher) === filter) &&
        (!batchFilter || voucher.batch === batchFilter) &&
        (!query || voucher.code.includes(query)),
    );
  }, [vouchers, filter, batchFilter, search]);

  const selectedVouchers = useMemo(() => vouchers.filter((v) => selected.has(v.id)), [vouchers, selected]);
  const allVisibleSelected = visible.length > 0 && visible.every((v) => selected.has(v.id));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((v) => next.delete(v.id));
      else visible.forEach((v) => next.add(v.id));
      return next;
    });

  const runBulk = async (label: string, action: (ids: string[]) => Promise<void>) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await action(ids);
      setSnackbar({ message: `${label} ${ids.length} voucher${ids.length === 1 ? '' : 's'}`, variant: 'success' });
      setSelected(new Set());
      await refresh();
    } catch (err) {
      setSnackbar({ message: err instanceof Error ? err.message : 'Action failed', variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  /** Prints the given vouchers as cut-out QR cards (browser print dialog). */
  const print = async (list: Voucher[]) => {
    const printable = list.filter((v) => voucherStatus(v) === 'active');
    if (printable.length === 0) {
      setSnackbar({ message: 'Only active vouchers can be printed', variant: 'error' });
      return;
    }
    setBusy(true);
    try {
      const sheet = await Promise.all(
        printable.map(async (voucher) => ({ voucher, qr: await generateQrDataUrl(voucher.code, 360) })),
      );
      setPrintSheet(sheet);
    } finally {
      setBusy(false);
    }
  };

  // Once the sheet is in the DOM, hand it to the print dialog and clean up after.
  useEffect(() => {
    if (!printSheet) return;
    document.body.classList.add('pb-printing-vouchers');
    const done = () => {
      document.body.classList.remove('pb-printing-vouchers');
      setPrintSheet(null);
    };
    window.addEventListener('afterprint', done, { once: true });
    const timer = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('pb-printing-vouchers');
    };
  }, [printSheet]);

  const eventNameOf = (voucher: Voucher) => (voucher.event_id ? (eventsById.get(voucher.event_id)?.name ?? null) : null);

  /** One active voucher -> PNG card; several -> ZIP of PNG cards. */
  const downloadCards = async (list: Voucher[]) => {
    const active = list.filter((v) => voucherStatus(v) === 'active');
    if (active.length === 0) {
      setSnackbar({ message: 'Only active vouchers can be downloaded', variant: 'error' });
      return;
    }
    setBusy(true);
    try {
      if (active.length === 1) await downloadVoucherCard(active[0], eventNameOf(active[0]));
      else await downloadVoucherCardsZip(active, eventNameOf, `vouchers-${new Date().toISOString().slice(0, 10)}.zip`);
      setSnackbar({
        message: active.length === 1 ? 'Voucher card downloaded' : `Downloaded ${active.length} voucher cards (ZIP)`,
        variant: 'success',
      });
    } catch (err) {
      setSnackbar({ message: err instanceof Error ? err.message : 'Download failed', variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = (list: Voucher[]) => {
    const header = ['code', 'status', 'batch', 'event', 'expires_at', 'redeemed_at', 'session_token', 'note'];
    const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const rows = list.map((v) =>
      [
        formatVoucherCode(v.code),
        voucherStatus(v),
        v.batch,
        v.event_id ? (eventsById.get(v.event_id)?.name ?? '') : '',
        v.expires_at ?? '',
        v.redeemed_at ?? '',
        v.session_token ?? '',
        v.note,
      ]
        .map(escape)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vouchers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const targetList = selectedVouchers.length > 0 ? selectedVouchers : visible;

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Vouchers</h1>
          <p className="mt-0.5 text-sm text-white/50">
            One voucher = one session. Turn the lock on in Booth Setup → Access.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setGenerateOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-pbx-ui-hi px-4 py-2 text-sm font-semibold text-pbx-ui-hi-fg transition hover:bg-pbx-ui-hi-strong"
          >
            <IconPlus className="h-4 w-4" />
            Generate
          </button>
          <button
            onClick={() => void print(targetList)}
            disabled={busy || targetList.length === 0}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-50"
          >
            🖨 Print {selectedVouchers.length > 0 ? `${selectedVouchers.length} selected` : 'shown'}
          </button>
          <button
            onClick={() => void downloadCards(targetList)}
            disabled={busy || targetList.length === 0}
            title="PNG card with QR for each active voucher (ZIP when more than one)"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-50"
          >
            ⤓ QR {selectedVouchers.length > 0 ? `(${selectedVouchers.length})` : ''}
          </button>
          <button
            onClick={() => exportCsv(targetList)}
            disabled={targetList.length === 0}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-50"
          >
            ⤓ CSV
          </button>
        </div>
      </header>

      {/* Status chips double as the filter */}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
        {(['all', 'active', 'used', 'expired', 'revoked'] as const).map((key) => {
          const count = key === 'all' ? vouchers.length : counts[key];
          const activeChip = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                activeChip
                  ? 'border-pbx-ui-hi bg-pbx-ui-hi/15 text-white'
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {key === 'all' ? 'All' : STATUS_LABEL[key]} <span className="ml-1 text-white/45">{count}</span>
            </button>
          );
        })}
        <select
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
          className="rounded-full border border-white/10 bg-pbx-ui-raised px-3 py-1.5 text-xs text-white focus:outline-none"
          aria-label="Filter by batch"
        >
          <option value="">All batches</option>
          {batches.map((batch) => (
            <option key={batch} value={batch}>
              {batch}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code…"
          className="w-40 rounded-full border border-white/10 bg-pbx-ui-raised px-3 py-1.5 text-xs text-white placeholder:text-white/35 focus:outline-none"
        />
      </div>

      {selected.size > 0 && (
        <div className="mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-pbx-ui-hi/30 bg-pbx-ui-hi/10 px-3 py-2 text-sm text-white">
          <span className="mr-auto font-semibold">{selected.size} selected</span>
          <button
            onClick={() => void runBulk('Revoked', revokeVouchers)}
            disabled={busy}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
          >
            Revoke
          </button>
          <button
            onClick={() => void runBulk('Reactivated', reactivateVouchers)}
            disabled={busy}
            title="Makes used or revoked vouchers usable again"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
          >
            Reactivate
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ff5e87]/40 bg-[#ff5e87]/10 px-3 py-1.5 text-xs font-semibold text-[#ff8aa8] hover:bg-[#ff5e87]/20 disabled:opacity-50"
          >
            <IconTrash className="h-3.5 w-3.5" />
            Delete
          </button>
          <button onClick={() => setSelected(new Set())} className="px-2 text-xs text-white/60 hover:text-white">
            Clear
          </button>
        </div>
      )}

      {error && (
        <div className="mx-3 mb-3 rounded-lg border border-[#ff5e87]/40 bg-[#ff5e87]/10 px-4 py-3 text-sm text-[#ff8aa8]">
          {error}
        </div>
      )}

      <div className="mx-3 overflow-x-auto rounded-xl border border-white/10 bg-pbx-ui-raised">
        <table className="w-full min-w-[760px] text-left text-sm text-white/85">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  className="h-4 w-4 accent-pbx-ui-hi"
                  aria-label="Select all shown"
                />
              </th>
              <th className="px-3 py-2.5">Code</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Batch / event</th>
              <th className="px-3 py-2.5">Expires</th>
              <th className="px-3 py-2.5">Used</th>
              <th className="px-3 py-2.5">Session</th>
              <th className="w-12 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-white/45">
                  Loading vouchers…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-white/45">
                  {vouchers.length === 0 ? 'No vouchers yet. Click Generate to create a batch.' : 'No vouchers match this filter.'}
                </td>
              </tr>
            ) : (
              visible.map((voucher) => {
                const status = voucherStatus(voucher);
                const event = voucher.event_id ? eventsById.get(voucher.event_id) : null;
                return (
                  <tr key={voucher.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(voucher.id)}
                        onChange={() => toggle(voucher.id)}
                        className="h-4 w-4 accent-pbx-ui-hi"
                        aria-label={`Select ${voucher.code}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-[0.95rem] font-semibold tracking-wider text-white">
                      {formatVoucherCode(voucher.code)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="truncate">{voucher.batch || <span className="text-white/35">—</span>}</div>
                      {event && <div className="truncate text-xs text-white/45">{event.name}</div>}
                    </td>
                    <td className="px-3 py-2 text-white/60">{formatDateTime(voucher.expires_at)}</td>
                    <td className="px-3 py-2 text-white/60">{formatDateTime(voucher.redeemed_at)}</td>
                    <td className="px-3 py-2">
                      {voucher.session_token && GALLERY_URL ? (
                        <a
                          href={`${GALLERY_URL}/p/${voucher.session_token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-pbx-ui-hi hover:underline"
                        >
                          {voucher.session_token.slice(0, 8)}
                        </a>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {status === 'active' && (
                        <button
                          onClick={() => void downloadCards([voucher])}
                          disabled={busy}
                          title="Download QR card (PNG)"
                          aria-label={`Download QR card ${voucher.code}`}
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-sm text-white transition hover:bg-white/20 disabled:opacity-50"
                        >
                          ⤓
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <GenerateModal
        open={generateOpen}
        events={events}
        onClose={() => setGenerateOpen(false)}
        onCreated={async (created) => {
          setGenerateOpen(false);
          await refresh();
          setFilter('all');
          setBatchFilter(created[0]?.batch ?? '');
          setSelected(new Set(created.map((v) => v.id)));
          setSnackbar({ message: `Created ${created.length} vouchers, selected and ready to print`, variant: 'success' });
        }}
      />

      <ConfirmModal
        open={deleteOpen}
        title="Delete vouchers?"
        message={`Delete ${selected.size} voucher${selected.size === 1 ? '' : 's'} permanently. Sessions they paid for are kept. To stop a code working but keep the record, use Revoke instead.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          void runBulk('Deleted', deleteVouchers);
        }}
      />

      {printSheet && <VoucherPrintSheet items={printSheet} eventsById={eventsById} />}

      {snackbar && <Snackbar message={snackbar.message} variant={snackbar.variant} onDone={() => setSnackbar(null)} />}
    </div>
  );
};

const GenerateModal: React.FC<{
  open: boolean;
  events: BoothEvent[];
  onClose: () => void;
  onCreated: (vouchers: Voucher[]) => Promise<void> | void;
}> = ({ open, events, onClose, onCreated }) => {
  const [count, setCount] = useState(20);
  const [batch, setBatch] = useState(defaultBatchName);
  const [eventId, setEventId] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBatch(defaultBatchName());
    setEventId(events.find((event) => event.is_active)?.id ?? '');
    setError(null);
  }, [open, events]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // A date means "valid through that whole day" (local time).
      const expiresAt = expiresOn ? new Date(`${expiresOn}T23:59:59`).toISOString() : null;
      const created = await createVouchers({ count, batch, note, eventId: eventId || null, expiresAt });
      await onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create vouchers');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Generate vouchers" onClose={onClose} width="480px">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">How many</span>
          <input
            type="number"
            min={1}
            max={MAX_VOUCHER_BATCH}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(MAX_VOUCHER_BATCH, Number(e.target.value) || 1)))}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-white/40">Each one starts a single session. Up to {MAX_VOUCHER_BATCH} at a time.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">Batch name</span>
          <input value={batch} onChange={(e) => setBatch(e.target.value)} className={inputClass} placeholder="e.g. Wedding Rina & Dimas" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">Event</span>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={inputClass}>
              <option value="">None</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                  {event.is_active ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">Valid until</span>
            <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Internal note" />
        </label>
        {error && <p className="text-sm text-[#ff8aa8]">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-white/70 hover:text-white">
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy || !batch.trim()}
            className="rounded-full bg-pbx-ui-hi px-5 py-2 text-sm font-semibold text-pbx-ui-hi-fg transition hover:bg-pbx-ui-hi-strong disabled:opacity-50"
          >
            {busy ? 'Creating…' : `Create ${count}`}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/**
 * Print-only sheet of cut-out voucher cards (hidden on screen; shown by the
 * `pb-printing-vouchers` body class in index.css while the dialog is open).
 */
const VoucherPrintSheet: React.FC<{
  items: Array<{ voucher: Voucher; qr: string }>;
  eventsById: Map<string, BoothEvent>;
}> = ({ items, eventsById }) => {
  const theme = useBoothAppearance((state) => state.appearance.theme);
  return createPortal(
    <div id="voucher-print-sheet">
      <div className="voucher-print-grid">
        {items.map(({ voucher, qr }) => {
          const event = voucher.event_id ? eventsById.get(voucher.event_id) : null;
          return (
            <div key={voucher.id} className="voucher-card" style={{ borderColor: theme.deep }}>
              <div className="voucher-card-band" style={{ backgroundColor: theme.primary, color: theme.primaryForeground }}>
                VOUCHER PHOTOBOOTH
              </div>
              <img src={qr} alt="" className="voucher-card-qr" />
              <div className="voucher-card-code">{formatVoucherCode(voucher.code)}</div>
              <div className="voucher-card-meta">
                Berlaku untuk 1 sesi
                {event ? ` · ${event.name}` : ''}
                {voucher.expires_at ? ` · s/d ${formatDate(voucher.expires_at)}` : ''}
              </div>
              <div className="voucher-card-hint">Scan QR ini di kamera booth untuk mulai</div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
};

export default AdminVouchersScreen;
