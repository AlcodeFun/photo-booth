import { requireSupabase, supabase } from './supabase';
import { detectOverlayWindow } from '../utils/overlayWindow';
import { FULL_GIF_WINDOW, type GifWindow } from '../utils/gifAdjust';

/**
 * GIF frames (public.gif_frames): overlay PNGs with a transparent window that
 * the guest can put on the animated GIF. Like a print frame with a single
 * photo slot: the GIF keeps the overlay's own shape and every photo fills the
 * slot behind it (see createResultGif).
 */
export interface GifFrame {
  id: string;
  name: string;
  image_url: string;
  storage_path: string;
  width: number;
  height: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  /** Where the photo goes (fractions of the overlay); null = auto-detect the window. */
  photo_slot: GifWindow | null;
}

const BUCKET = 'gif-frames';
export const GIF_FRAME_MAX_BYTES = 10 * 1024 * 1024;

/** A stored slot, or null when it is missing / not a sane rectangle. */
export const parseGifSlot = (value: unknown): GifWindow | null => {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const [x, y, width, height] = [v.x, v.y, v.width, v.height].map(Number);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width < 0.02 || height < 0.02 || x < -0.001 || y < -0.001 || x + width > 1.001 || y + height > 1.001) return null;
  return { x, y, width, height };
};

const mapRow = (row: Record<string, unknown>): GifFrame => ({
  id: String(row.id ?? ''),
  name: String(row.name ?? ''),
  image_url: String(row.image_url ?? ''),
  storage_path: String(row.storage_path ?? ''),
  width: Number(row.width ?? 0),
  height: Number(row.height ?? 0),
  sort_order: Number(row.sort_order ?? 0),
  is_active: Boolean(row.is_active),
  created_at: String(row.created_at ?? ''),
  photo_slot: parseGifSlot(row.photo_slot),
});

/**
 * Runs a write that includes `photo_slot`; if the database does not have the
 * column yet (migration not applied), retries without it so saving still works
 * and the slot falls back to auto-detection.
 */
const withSlotFallback = async <T extends { error: { message: string; code?: string } | null }>(
  write: (includeSlot: boolean) => PromiseLike<T>,
): Promise<T> => {
  const result = await write(true);
  if (result.error && /photo_slot/.test(result.error.message)) return write(false);
  return result;
};

const slotCache = new Map<string, Promise<GifWindow>>();

/**
 * The photo slot for an overlay URL: the slot saved with the frame, else the
 * overlay's detected transparent window (whole canvas without an overlay).
 * Used by the encoder and the previews, which only know the overlay URL.
 */
export const resolveGifSlot = (url: string | null | undefined, known?: GifWindow | null): Promise<GifWindow> => {
  if (!url) return Promise.resolve(FULL_GIF_WINDOW);
  if (known) return Promise.resolve(known);
  let job = slotCache.get(url);
  if (!job) {
    job = (async () => {
      if (supabase) {
        const { data } = await supabase.from('gif_frames').select('photo_slot').eq('image_url', url).limit(1).maybeSingle();
        const saved = parseGifSlot((data as Record<string, unknown> | null)?.photo_slot);
        if (saved) return saved;
      }
      return detectOverlayWindow(url);
    })().catch(() => detectOverlayWindow(url));
    slotCache.set(url, job);
  }
  return job;
};

/** All frames in display order (admin). */
export const listGifFrames = async (): Promise<GifFrame[]> => {
  const { data, error } = await requireSupabase()
    .from('gif_frames')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
};

/** Enabled frames only, for the booth's effects screen. */
export const listActiveGifFrames = async (): Promise<GifFrame[]> =>
  (await listGifFrames()).filter((frame) => frame.is_active);

const readImageSize = (file: File) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not a readable image'));
    };
    image.src = url;
  });

/** Uploads an overlay image to the bucket; returns its path, public URL and size. */
const uploadOverlay = async (file: File) => {
  if (!/^image\/(png|webp)$/.test(file.type)) throw new Error('Use a PNG (or WebP) with a transparent window');
  if (file.size > GIF_FRAME_MAX_BYTES) throw new Error('Image is larger than 10 MB');
  const { width, height } = await readImageSize(file);
  const client = requireSupabase();
  const ext = file.type === 'image/webp' ? 'webp' : 'png';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: '31536000',
  });
  if (uploadError) throw new Error(uploadError.message);
  return { path, width, height, imageUrl: client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
};

/** Uploads a PNG/WebP overlay and creates its row at the end of the list. */
export const createGifFrame = async (
  file: File,
  name: string,
  sortOrder: number,
  isActive = true,
  photoSlot: GifWindow | null = null,
): Promise<GifFrame> => {
  const client = requireSupabase();
  const { path, width, height, imageUrl } = await uploadOverlay(file);
  const { data, error } = await withSlotFallback((includeSlot) =>
    client
      .from('gif_frames')
      .insert({
        name: name.trim() || 'GIF frame',
        image_url: imageUrl,
        storage_path: path,
        width,
        height,
        sort_order: sortOrder,
        is_active: isActive,
        ...(includeSlot ? { photo_slot: photoSlot } : {}),
      })
      .select('*')
      .single(),
  );
  if (error) {
    await client.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return mapRow(data as Record<string, unknown>);
};

export const updateGifFrame = async (
  id: string,
  patch: Partial<Pick<GifFrame, 'name' | 'is_active' | 'sort_order' | 'photo_slot'>>,
) => {
  const client = requireSupabase();
  const { error } = await withSlotFallback((includeSlot) => {
    const { photo_slot: photoSlot, ...rest } = patch;
    return client
      .from('gif_frames')
      .update(includeSlot && 'photo_slot' in patch ? { ...rest, photo_slot: photoSlot } : rest)
      .eq('id', id);
  });
  if (error) throw new Error(error.message);
  slotCache.clear();
};

/** Swaps a frame's overlay image; the old file is removed once the row points at the new one. */
export const replaceGifFrameImage = async (frame: GifFrame, file: File): Promise<void> => {
  const client = requireSupabase();
  const { path, width, height, imageUrl } = await uploadOverlay(file);
  const { error } = await client
    .from('gif_frames')
    .update({ image_url: imageUrl, storage_path: path, width, height })
    .eq('id', frame.id);
  if (error) {
    await client.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  if (frame.storage_path) await client.storage.from(BUCKET).remove([frame.storage_path]);
  slotCache.clear();
};

/** Persists a new order (index = sort_order). */
export const reorderGifFrames = async (ids: string[]) => {
  const client = requireSupabase();
  const results = await Promise.all(
    ids.map((id, index) => client.from('gif_frames').update({ sort_order: index }).eq('id', id)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
};

export const deleteGifFrame = async (frame: GifFrame) => {
  const client = requireSupabase();
  const { error } = await client.from('gif_frames').delete().eq('id', frame.id);
  if (error) throw new Error(error.message);
  if (frame.storage_path) await client.storage.from(BUCKET).remove([frame.storage_path]);
};
