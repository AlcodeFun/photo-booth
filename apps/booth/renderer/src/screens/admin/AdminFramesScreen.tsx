import React, { useCallback, useEffect, useState } from 'react';
import { FrameConfig } from '@photo-booth/types';
import { FrameCanvas } from '../../components/FrameCanvas';
import { deleteFrameTemplate, listAdminFrameTemplates } from '../../lib/frames';
import { resolveFrameTemplate } from '../../utils/frameConfig';
import { navigateToAdmin } from '../../lib/navigation';
import { ConfirmModal } from '../../components/admin/Modal';
import { SkeletonCard } from '../../components/admin/Skeleton';
import { RefreshIcon } from '../../components/admin/StatusBadge';
import { IconEye, IconPencil, IconPlus, IconSearch, IconTrash } from '../../components/admin/AdminIcons';
import { Snackbar, SnackbarVariant } from '../../components/admin/Snackbar';

export const AdminFramesScreen: React.FC = () => {
  const [templates, setTemplates] = useState<FrameConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<FrameConfig | null>(null);
  const [deleting, setDeleting] = useState<FrameConfig | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; variant: SnackbarVariant } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setTemplates(await listAdminFrameTemplates());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load frames');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteFrameTemplate(deleting.id);
      setSnackbar({ message: `Deleted "${deleting.name}"`, variant: 'success' });
      setDeleting(null);
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setSnackbar({ message: `Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`, variant: 'error' });
    } finally {
      setDeleteBusy(false);
    }
  };

  const placeholderPhotos = (count: number): Array<string | undefined> =>
  Array.from({ length: count }, () => undefined);

  const goEdit = (id: string | null, isNew: boolean) => {
    navigateToAdmin(
      'frame-fit',
      isNew ? 'new=1&from=templates' : `edit=${id}&from=templates`,
    );
  };

  const filteredTemplates = searchQuery.trim()
    ? templates.filter((template) => template.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : templates;

  return (
    <div >
      <header className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Frames</h1>
          <p className="mt-0.5 text-sm text-white/50">{filteredTemplates.length} of {templates.length} frames</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 ">
          <div className="relative max-w-[220px]">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by frame name…"
              className="w-full rounded-full border border-white/10 bg-[#241341] py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-[#ff4bb5]/60 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-xs text-white/40 transition hover:text-white"
                aria-label="Clear search"
              >
                &#10005;
              </button>
            )}
          </div>
         
          <RefreshIcon onClick={() => { setRefreshing(true); refresh(true); }} spinning={refreshing} />
             <button
            onClick={() => goEdit(null, true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#d9f85a] px-4 py-2 text-sm font-bold text-[#140b26] transition hover:bg-[#bae32f]"
          >
            <IconPlus className="h-4 w-4" />
            New frame
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-[#ff5e87]/40 bg-[#ff5e87]/10 px-4 py-3 text-sm text-[#ff8aa8]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#241341] px-8 py-16 text-center">
          <p className="text-lg font-semibold text-white">No frames yet</p>
          <p className="mt-1 text-sm text-white/45">Create your first frame to get started.</p>
          <button
            onClick={() => goEdit(null, true)}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#d9f85a] px-5 py-2 text-sm font-bold text-[#140b26] transition hover:bg-[#bae32f]"
          >
            <IconPlus className="h-4 w-4" />
            New frame
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredTemplates.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-white/10 bg-[#241341] px-8 py-12 text-center">
              <p className="text-sm text-white/45">No frames match "{searchQuery}".</p>
            </div>
          ) : (
            filteredTemplates.map((template) => {
            const slotCount = template.photoSlots ?? 3;
            return (
              <div
                key={template.id}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#241341] shadow-lg transition hover:border-[#ff4bb5]/40"
              >
                <div className="relative">
                  <div className="relative z-0 flex">
                    <FrameCanvas
                      frame={template}
                      photos={placeholderPhotos(slotCount)}
                      photoSlotCount={slotCount}
                      className="w-full border-0 shadow-none"
                    />
                  </div>
                  <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-black/55 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                    <button
                      onClick={() => setViewing(template)}
                      title="View"
                      className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30"
                    >
                      <IconEye />
                    </button>
                    <button
                      onClick={() => goEdit(template.id, false)}
                      title="Edit"
                      className="grid h-10 w-10 place-items-center rounded-full bg-[#d9f85a] text-[#140b26] transition hover:bg-[#bae32f]"
                    >
                      <IconPencil />
                    </button>
                    <button
                      onClick={() => setDeleting(template)}
                      title="Delete"
                      className="grid h-10 w-10 place-items-center rounded-full bg-[#ff5e87] text-white transition hover:bg-[#ff7fa3]"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">{template.name}</p>
                  <span className="shrink-0 text-xs text-white/40">{slotCount} slots</span>
                </div>
              </div>
            );
            })
          )}
        </div>
      )}

      {viewing &&
        (() => {
          const resolved = resolveFrameTemplate(viewing, viewing.photoSlots ?? 3);
          const ratio = resolved.width / resolved.height;
          return (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
              style={{
                background: 'rgba(10,5,25,.96)',
                animation: 'pb-modal-fade 0.25s ease-out both',
              }}
              onClick={() => setViewing(null)}
            >
              <div
                className="relative flex max-h-[82vh] max-w-[92vw] items-center justify-center"
                style={{ animation: 'pb-modal-zoom 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2) both' }}
                onClick={(e) => e.stopPropagation()}
              >
                <FrameCanvas
                  frame={viewing}
                  photos={placeholderPhotos(viewing.photoSlots ?? 3)}
                  photoSlotCount={viewing.photoSlots ?? 3}
                  className="rounded-[14px] border-[3px] border-[#4acaf1] shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
                  style={{
                    width: `min(${ratio * 80}vh, 92vw)`,
                    aspectRatio: `${resolved.width} / ${resolved.height}`,
                  }}
                />
              </div>

              <button
                onClick={() => setViewing(null)}
                className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-[#ff4bb5] text-white shadow-[0_4px_12px_rgba(0,0,0,0.45)] transition-transform hover:scale-110 active:scale-95 sm:h-9 sm:w-9"
                aria-label="Close"
              >
                &#10005;
              </button>

              <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 px-6 pb-8 pt-16">
                <div className="mr-auto min-w-0">
                  <p className="truncate text-[0.82rem] font-black uppercase tracking-[0.08em] text-white sm:text-[0.9rem]">
                    {viewing.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-white/55">
                    {viewing.photoSlots ?? 3} slots &middot; {viewing.id}
                  </p>
                  {viewing.previewUrl && (
                    <a
                      href={viewing.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-[#4acaf1] hover:text-[#6fd9f7]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open preview image
                    </a>
                  )}
                </div>
                <button
                  onClick={() => goEdit(viewing.id, false)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#d9f85a] px-6 py-3 text-[0.78rem] font-black uppercase tracking-[0.1em] text-[#140b26] shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0 sm:text-[0.85rem]"
                >
                  <IconPencil className="h-4 w-4" />
                  Edit frame
                </button>
              </div>
            </div>
          );
        })()}

      <ConfirmModal
        open={deleting !== null}
        title="Delete frame?"
        message={`"${deleting?.name ?? ''}" will be removed permanently. Frames on the booth that rely on it will fall back to defaults.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        busy={deleteBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      {snackbar && (
        <Snackbar
          message={snackbar.message}
          variant={snackbar.variant}
          onDone={() => setSnackbar(null)}
        />
      )}
    </div>
  );
};