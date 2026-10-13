import { requireSupabase } from './supabase';

/**
 * GIF frames (public.gif_frames): overlay PNGs with a transparent window that
 * the guest can put on the animated GIF. The GIF takes the overlay's aspect
 * ratio and every photo fills the canvas behind it (see createResultGif).
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
}

const BUCKET = 'gif-frames';
export const GIF_FRAME_MAX_BYTES = 10 * 1024 * 1024;

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
});

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
export const createGifFrame = async (file: File, name: string, sortOrder: number, isActive = true): Promise<GifFrame> => {
  const client = requireSupabase();
  const { path, width, height, imageUrl } = await uploadOverlay(file);
  const { data, error } = await client
    .from('gif_frames')
    .insert({
      name: name.trim() || 'GIF frame',
      image_url: imageUrl,
      storage_path: path,
      width,
      height,
      sort_order: sortOrder,
      is_active: isActive,
    })
    .select('*')
    .single();
  if (error) {
    await client.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return mapRow(data as Record<string, unknown>);
};

export const updateGifFrame = async (id: string, patch: Partial<Pick<GifFrame, 'name' | 'is_active' | 'sort_order'>>) => {
  const { error } = await requireSupabase().from('gif_frames').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
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
