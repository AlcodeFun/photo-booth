import React, { useState } from 'react';
import {
  BoothEvent,
  BoothEventInput,
  createEvent,
  deleteEvent,
  setActiveEvent,
  updateEvent,
} from '../../lib/events';
import { Modal, ConfirmModal } from './Modal';
import { IconPencil, IconPlus, IconTrash } from './AdminIcons';

interface EventsManagerProps {
  open: boolean;
  events: BoothEvent[];
  /** Session count per event id, shown next to each event. */
  counts: Map<string, number>;
  onClose: () => void;
  /** Called after any write so the parent reloads events (and sessions). */
  onChanged: () => Promise<void> | void;
}

const EMPTY_DRAFT: BoothEventInput = { name: '', starts_on: '', ends_on: '', notes: '' };

const inputClass =
  'w-full rounded-lg border border-white/10 bg-pbx-ui-raised px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-pbx-ui-brand/60 focus:outline-none [color-scheme:dark]';

export const formatEventDates = (event: Pick<BoothEvent, 'starts_on' | 'ends_on'>): string => {
  const fmt = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (event.starts_on && event.ends_on && event.starts_on !== event.ends_on) {
    return `${fmt(event.starts_on)} – ${fmt(event.ends_on)}`;
  }
  if (event.starts_on) return fmt(event.starts_on);
  if (event.ends_on) return `until ${fmt(event.ends_on)}`;
  return 'No dates';
};

/**
 * Create, edit, delete and activate events. The active event is stamped onto
 * every new booth session by the database.
 */
export const EventsManager: React.FC<EventsManagerProps> = ({ open, events, counts, onClose, onChanged }) => {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<BoothEventInput>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BoothEvent | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (event: BoothEvent | null) => {
    setError(null);
    setEditingId(event ? event.id : 'new');
    setDraft(
      event
        ? { name: event.name, starts_on: event.starts_on ?? '', ends_on: event.ends_on ?? '', notes: event.notes }
        : EMPTY_DRAFT,
    );
  };

  const save = () => {
    if (!draft.name.trim()) {
      setError('Event name is required.');
      return;
    }
    if (draft.starts_on && draft.ends_on && draft.ends_on < draft.starts_on) {
      setError('End date must be on or after the start date.');
      return;
    }
    void run(async () => {
      if (editingId === 'new') {
        const created = await createEvent(draft);
        // The first event is almost always the one being run right now.
        if (!events.some((event) => event.is_active)) await setActiveEvent(created.id);
      } else if (editingId) {
        await updateEvent(editingId, draft);
      }
      setEditingId(null);
    });
  };

  const form = (
    <div className="space-y-3 rounded-xl border border-pbx-ui-brand/30 bg-white/5 p-4">
      <input
        className={inputClass}
        placeholder="Event name (e.g. Wedding Rina & Dimas)"
        value={draft.name}
        autoFocus
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-white/50">
          Start
          <input
            type="date"
            className={`${inputClass} mt-1`}
            value={draft.starts_on ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, starts_on: e.target.value }))}
          />
        </label>
        <label className="text-xs text-white/50">
          End
          <input
            type="date"
            className={`${inputClass} mt-1`}
            value={draft.ends_on ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, ends_on: e.target.value }))}
          />
        </label>
      </div>
      <textarea
        className={`${inputClass} min-h-[64px]`}
        placeholder="Notes (venue, client, package…)"
        value={draft.notes}
        onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
      />
      <div className="flex justify-end gap-2">
        <button
          className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80 transition hover:bg-white/20"
          onClick={() => setEditingId(null)}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          className="rounded-full bg-pbx-ui-hi px-4 py-1.5 text-sm font-semibold text-pbx-ui-hi-fg transition hover:bg-pbx-ui-hi-strong disabled:opacity-60"
          onClick={save}
          disabled={busy}
        >
          {busy ? 'Saving…' : editingId === 'new' ? 'Create event' : 'Save'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Modal open={open} title="Events" onClose={onClose} width="600px">
        <p className="mb-4 text-sm text-white/55">
          New booth sessions are filed under the <span className="font-semibold text-pbx-ui-hi">active</span> event.
          Deleting an event keeps its sessions as unassigned.
        </p>

        {error && (
          <div className="mb-3 rounded-lg border border-[#ff5e87]/40 bg-[#ff5e87]/10 px-3 py-2 text-sm text-[#ff8aa8]">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {editingId === 'new' ? (
            form
          ) : (
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-3 text-sm font-medium text-white/70 transition hover:border-pbx-ui-hi/60 hover:text-pbx-ui-hi"
              onClick={() => startEdit(null)}
              disabled={busy}
            >
              <IconPlus className="h-4 w-4" />
              New event
            </button>
          )}

          {events.map((event) =>
            editingId === event.id ? (
              <div key={event.id}>{form}</div>
            ) : (
              <div
                key={event.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  event.is_active ? 'border-pbx-ui-hi/50 bg-pbx-ui-hi/10' : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-white">{event.name}</p>
                    {event.is_active && (
                      <span className="shrink-0 rounded-full bg-pbx-ui-hi px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-pbx-ui-hi-fg">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-white/45">
                    {formatEventDates(event)} · {counts.get(event.id) ?? 0} session
                    {(counts.get(event.id) ?? 0) === 1 ? '' : 's'}
                    {event.notes ? ` · ${event.notes}` : ''}
                  </p>
                </div>
                <button
                  className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/75 transition hover:bg-white/10 disabled:opacity-50"
                  onClick={() => void run(() => setActiveEvent(event.is_active ? null : event.id))}
                  disabled={busy}
                >
                  {event.is_active ? 'Deactivate' : 'Set active'}
                </button>
                <button
                  className="shrink-0 rounded-lg p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"
                  onClick={() => startEdit(event)}
                  disabled={busy}
                  aria-label={`Edit ${event.name}`}
                >
                  <IconPencil className="h-4 w-4" />
                </button>
                <button
                  className="shrink-0 rounded-lg p-1.5 text-white/55 transition hover:bg-[#ff5e87]/15 hover:text-[#ff8aa8]"
                  onClick={() => setDeleting(event)}
                  disabled={busy}
                  aria-label={`Delete ${event.name}`}
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            ),
          )}

          {events.length === 0 && editingId !== 'new' && (
            <p className="py-6 text-center text-sm text-white/40">No events yet.</p>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        title={`Delete "${deleting?.name ?? ''}"?`}
        message="Its sessions stay in the dashboard as unassigned. This cannot be undone."
        confirmLabel="Delete event"
        danger
        busy={busy}
        onConfirm={() =>
          deleting &&
          void run(async () => {
            await deleteEvent(deleting.id);
            setDeleting(null);
          })
        }
        onCancel={() => setDeleting(null)}
      />
    </>
  );
};

export default EventsManager;
