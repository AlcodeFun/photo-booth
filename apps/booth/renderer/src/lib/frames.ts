import { FrameConfig, FrameTemplateConfig } from '@photo-booth/types';
import { requireSupabase } from './supabase';

/** Row shape of the public.frame_templates table. */
export interface FrameTemplateRow {
  id: string;
  name: string;
  preview_url: string;
  photo_slots: number | null;
  template: FrameTemplateConfig | null;
  templates_by_photo_slots: Record<string, FrameTemplateConfig> | null;
  enabled: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

const mapRowToFrame = (row: FrameTemplateRow): FrameConfig => ({
  id: row.id,
  name: row.name,
  previewUrl: row.preview_url,
  photoSlots: row.photo_slots ?? undefined,
  template: row.template ?? undefined,
  templatesByPhotoSlots: row.templates_by_photo_slots ?? undefined,
});

/**
 * Writes are governed by RLS policies scoped to the `authenticated` role, so
 * they need an active session. Returns the client with the user access token
 * attached automatically and fails fast with a clear message when signed out.
 */
const requireAuthClient = async () => {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session) {
    throw new Error(
      'You must be signed in to save changes (row-level security restricts writes to authenticated users).',
    );
  }
  return client;
};

const mapFrameToRow = (frame: FrameConfig): FrameTemplateRow => ({
  id: frame.id,
  name: frame.name,
  preview_url: frame.previewUrl,
  photo_slots: frame.photoSlots ?? null,
  template: frame.template ?? null,
  templates_by_photo_slots: (frame.templatesByPhotoSlots as Record<string, FrameTemplateConfig> | undefined) ?? null,
  enabled: true,
  sort_order: 0,
});

/** Loads templates shared with the booth, ordered for display. */
export const listFrameTemplates = async (): Promise<FrameConfig[]> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('frame_templates')
    .select('*')
    .eq('enabled', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as FrameTemplateRow[] | null)?.map(mapRowToFrame) ?? [];
};

/** Admin view of the catalog — includes disabled templates, newest first. */
export const listAdminFrameTemplates = async (): Promise<FrameConfig[]> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('frame_templates')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as FrameTemplateRow[] | null)?.map(mapRowToFrame) ?? [];
};

/** Upserts a template by id (insert for new ids, update for existing). */
export const saveFrameTemplate = async (frame: FrameConfig): Promise<void> => {
  const client = await requireAuthClient();
  const { error } = await client.from('frame_templates').upsert(mapFrameToRow(frame), {
    onConflict: 'id',
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const deleteFrameTemplate = async (id: string): Promise<void> => {
  const client = await requireAuthClient();
  const { error } = await client.from('frame_templates').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
};

/** Uploads the .png overlay into the public frame-templates bucket, returns its public URL. */
export const uploadFrameAsset = async (frameId: string, file: File): Promise<string> => {
  const client = await requireAuthClient();
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'frame.png';
  const objectPath = `${frameId}/${Date.now()}-${safeName}`;

  const { error } = await client.storage.from('frame-templates').upload(objectPath, file, {
    contentType: file.type || 'image/png',
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return client.storage.from('frame-templates').getPublicUrl(objectPath).data.publicUrl;
};

export const getAuthStatus = async (): Promise<{ email: string | null }> => {
  const { data } = await requireSupabase().auth.getSession();
  return { email: data.session?.user.email ?? null };
};

export const onAuthStateChange = (callback: (email: string | null) => void): (() => void) => {
  const { data } = requireSupabase().auth.onAuthStateChange((_event, session) => {
    callback(session?.user.email ?? null);
  });
  return () => data.subscription.unsubscribe();
};

export const signInToSupabase = async (email: string, password: string): Promise<void> => {
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message);
  }
};

export const signOutOfSupabase = async (): Promise<void> => {
  const { error } = await requireSupabase().auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
};