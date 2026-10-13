import React, { useCallback, useEffect, useState } from 'react';
import {
  deleteGifFrame,
  listGifFrames,
  reorderGifFrames,
  updateGifFrame,
  type GifFrame,
} from '../../lib/gifFrames';
import { ConfirmModal, Modal } from '../../components/admin/Modal';
import { Snackbar, type SnackbarVariant } from '../../components/admin/Snackbar';
import { IconPencil, IconPlus, IconTrash } from '../../components/admin/AdminIcons';
import { GifFrameEditor } from '../../components/admin/GifFrameEditor';

const SAMPLE_PHOTO = `${import.meta.env.BASE_URL}photos/1.jpg`;

/** Overlay on a sample photo, exactly how the GIF composes it. */
const GifFramePreview: React.FC<{ frame: GifFrame; className?: string }> = ({ frame, className }) => (
  <div
    className={`relative overflow-hidden bg-black ${className ?? ''}`}
    style={{ aspectRatio: frame.width && frame.height ? `${frame.width} / ${frame.height}` : '4 / 3' }}
  >
    <img src={SAMPLE_PHOTO} alt="" className="absolute inset-0 h-full w-full object-cover" />
    <img src={frame.image_url} alt={frame.name} className="absolute inset-0 h-full w-full object-fill" />
  </div>
);

/** Admin -> GIF Frames: upload, name, order and enable GIF overlays. */
export const AdminGifFramesScreen: React.FC = () => {
  const [frames, setFrames] = useState<GifFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<GifFrame | null>(null);
  const [toDelete, setToDelete] = useState<GifFrame | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; variant: SnackbarVariant } | null>(null);
  // undefined = closed, null = adding, a frame = editing it
  const [editing, setEditing] = useState<GifFrame | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      setFrames(await listGifFrames());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load GIF frames');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    try {
      await action();
      if (success) setSnackbar({ message: success, variant: 'success' });
    } catch (err) {
      setSnackbar({ message: err instanceof Error ? err.message : 'Action failed', variant: 'error' });
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= frames.length) return;
    const next = [...frames];
    [next[index], next[target]] = [next[target], next[index]];
    setFrames(next);
    void run(() => reorderGifFrames(next.map((f) => f.id)));
  };

  const activeCount = frames.filter((f) => f.is_active).length;

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div>
          <h1 className="text-2xl font-bold text-white">GIF Frames</h1>
          <p className="mt-0.5 text-sm text-white/50">
            {frames.length} frame{frames.length === 1 ? '' : 's'} · {activeCount} shown to guests on the effects screen
          </p>
        </div>
        <button
          onClick={() => setEditing(null)}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-pbx-ui-hi px-4 py-2 text-sm font-semibold text-pbx-ui-hi-fg transition hover:bg-pbx-ui-hi-strong disabled:opacity-50"
        >
          <IconPlus className="h-4 w-4" />
          Add GIF frame
        </button>
      </header>

      <div className="mx-3 mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
        Add a <b className="text-white">PNG with a transparent window</b>, or any image with the photo area painted{' '}
        <b className="text-white">green</b> (it is removed automatically, like frames). The GIF takes the image&apos;s shape
        and the guest&apos;s photos fill the window. Turn a frame off to hide it from guests without deleting it.
      </div>

      {error && (
        <div className="mx-3 mb-3 rounded-lg border border-[#ff5e87]/40 bg-[#ff5e87]/10 px-4 py-3 text-sm text-[#ff8aa8]">
          {error}
        </div>
      )}

      {loading ? (
        <p className="px-3 py-10 text-center text-white/45">Loading GIF frames…</p>
      ) : frames.length === 0 ? (
        <div className="mx-3 rounded-2xl border border-white/10 bg-pbx-ui-raised px-8 py-14 text-center">
          <p className="text-lg font-semibold text-white">No GIF frames yet</p>
          <p className="mt-1 text-sm text-white/45">Add a GIF frame to offer it on the booth.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 px-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {frames.map((frame, index) => (
            <div
              key={frame.id}
              className={`overflow-hidden rounded-xl border bg-pbx-ui-raised shadow-lg transition ${
                frame.is_active ? 'border-white/10' : 'border-white/5 opacity-60'
              }`}
            >
              <button onClick={() => setPreview(frame)} className="block w-full" title="Preview">
                <GifFramePreview frame={frame} />
              </button>
              <div className="space-y-3 p-3">
                <input
                  defaultValue={frame.name}
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name && name !== frame.name) void run(() => updateGifFrame(frame.id, { name }), 'Renamed');
                  }}
                  className="w-full rounded-lg border border-white/10 bg-pbx-ui-panel px-2.5 py-1.5 text-sm font-semibold text-white focus:border-pbx-ui-brand/60 focus:outline-none"
                  aria-label="GIF frame name"
                />
                <div className="flex items-center gap-1.5">
                  <label className="mr-auto inline-flex cursor-pointer items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={frame.is_active}
                      disabled={busy}
                      onChange={(event) =>
                        void run(
                          () => updateGifFrame(frame.id, { is_active: event.target.checked }),
                          event.target.checked ? 'Shown to guests' : 'Hidden from guests',
                        )
                      }
                      className="h-4 w-4 accent-pbx-ui-hi"
                    />
                    {frame.is_active ? 'Shown' : 'Hidden'}
                  </label>
                  <button
                    onClick={() => setEditing(frame)}
                    disabled={busy}
                    title="Edit"
                    aria-label={`Edit ${frame.name}`}
                    className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30"
                  >
                    <IconPencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => move(index, -1)}
                    disabled={busy || index === 0}
                    title="Move earlier"
                    className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={busy || index === frames.length - 1}
                    title="Move later"
                    className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30"
                  >
                    →
                  </button>
                  <button
                    onClick={() => setToDelete(frame)}
                    disabled={busy}
                    title="Delete"
                    className="grid h-8 w-8 place-items-center rounded-full bg-[#ff5e87]/15 text-[#ff8aa8] transition hover:bg-[#ff5e87]/25 disabled:opacity-30"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(preview)} title={preview?.name} onClose={() => setPreview(null)} width="720px">
        {preview && <GifFramePreview frame={preview} className="rounded-lg" />}
      </Modal>

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete GIF frame?"
        message={`"${toDelete?.name ?? ''}" will be removed for good. To only hide it from guests, untick Shown instead.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const frame = toDelete;
          setToDelete(null);
          if (frame) void run(() => deleteGifFrame(frame), 'Deleted');
        }}
      />

      <GifFrameEditor
        open={editing !== undefined}
        frame={editing ?? null}
        nextSortOrder={frames.length}
        onClose={() => setEditing(undefined)}
        onSaved={(message) => {
          setEditing(undefined);
          setSnackbar({ message, variant: 'success' });
          void refresh();
        }}
      />

      {snackbar && <Snackbar message={snackbar.message} variant={snackbar.variant} onDone={() => setSnackbar(null)} />}
    </div>
  );
};

export default AdminGifFramesScreen;
