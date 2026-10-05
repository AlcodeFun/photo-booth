import {
  BoothAppearance,
  BoothAppearanceMode,
  BoothAppearanceSettings,
  BoothBackground,
  BoothBackgroundFit,
  BoothBackgroundType,
  BoothCopywriting,
  BoothTheme,
  DEFAULT_BOOTH_APPEARANCE,
  DEFAULT_BOOTH_APPEARANCE_SETTINGS,
} from '@photo-booth/types';
import { requireSupabase } from './supabase';

/**
 * Booth appearance is stored in Supabase (source of truth) with localStorage as
 * an offline cache: the booth must render the right look instantly at start-up
 * and keep working when Supabase is unreachable. Images never live in either —
 * they go to the public `booth-appearance` storage bucket and only the URL is
 * persisted here.
 */

/** Row shape of the public.booth_appearance table. */
export interface BoothAppearanceRow {
  id: string;
  mode: BoothAppearanceMode | string;
  copy: Partial<BoothCopywriting> | null;
  theme: Partial<BoothTheme> | null;
  background: Partial<BoothBackground> | null;
  updated_at?: string;
}

export const APPEARANCE_ROW_ID = 'default';
export const APPEARANCE_BUCKET = 'booth-appearance';

const CACHE_KEY = 'pb-booth-appearance';

/** Largest background image the bucket accepts (matches the migration's limit). */
export const APPEARANCE_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && HEX_COLOR.test(value.trim());

/**
 * Applies an alpha channel to a `#rgb` / `#rrggbb` / `#rrggbbaa` color. Screens
 * that need translucent surfaces (scrims, shadows, tinted overlays) go through
 * this so the alpha is derived from the appearance token rather than hardcoded.
 */
export const withAlpha = (hex: string, alpha: number): string => {
  const value = hex.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
  if (!match) return value;
  const digits = match[1].length <= 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  const clamped = Math.min(1, Math.max(0, alpha));
  const r = parseInt(digits.slice(0, 2), 16);
  const g = parseInt(digits.slice(2, 4), 16);
  const b = parseInt(digits.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Number(clamped.toFixed(3))})`;
};

const BACKGROUND_FITS: BoothBackgroundFit[] = ['cover', 'contain', 'repeat'];
const BACKGROUND_TYPES: BoothBackgroundType[] = ['color', 'image'];

/** Resolves the appearance the booth actually renders for the given settings. */
export const resolveActiveAppearance = (settings: BoothAppearanceSettings): BoothAppearance =>
  settings.mode === 'default' ? DEFAULT_BOOTH_APPEARANCE : settings.appearance;

/**
 * Merges a stored (possibly partial, possibly from an older schema) document
 * over the shipped defaults so a missing key never renders as `undefined`.
 */
const mergeAppearance = (value: Partial<BoothAppearance> | null | undefined): BoothAppearance => ({
  copy: { ...DEFAULT_BOOTH_APPEARANCE.copy, ...(value?.copy ?? {}) },
  theme: { ...DEFAULT_BOOTH_APPEARANCE.theme, ...(value?.theme ?? {}) },
  background: { ...DEFAULT_BOOTH_APPEARANCE.background, ...(value?.background ?? {}) },
});

const normalizeSettings = (row: BoothAppearanceRow | null | undefined): BoothAppearanceSettings => {
  if (!row) return DEFAULT_BOOTH_APPEARANCE_SETTINGS;
  const mode: BoothAppearanceMode = row.mode === 'custom' ? 'custom' : 'default';
  return { mode, appearance: mergeAppearance(row as Partial<BoothAppearance>) };
};

/**
 * Writes are governed by RLS policies scoped to the `authenticated` role, so
 * they need an active session. Fails fast with a clear message when signed out.
 */
const requireAuthClient = async () => {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session) {
    throw new Error(
      'You must be signed in to save the appearance (row-level security restricts writes to authenticated users).',
    );
  }
  return client;
};

const mapSettingsToRow = (settings: BoothAppearanceSettings): BoothAppearanceRow => ({
  id: APPEARANCE_ROW_ID,
  mode: settings.mode,
  copy: settings.appearance.copy,
  theme: settings.appearance.theme,
  background: settings.appearance.background,
});

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

export interface AppearanceValidationResult {
  ok: boolean;
  errors: string[];
}

/** Blocks saving so a typo can never persist a broken theme to every booth. */
export const validateAppearance = (settings: BoothAppearanceSettings): AppearanceValidationResult => {
  // In default mode nothing from the document is rendered — the booth uses the
  // appearance shipped in code — so there is nothing meaningful to validate. The
  // document is still persisted (that is where custom values are parked) but any
  // problem in it surfaces the moment the operator switches back to custom.
  if (settings.mode === 'default') {
    return { ok: true, errors: [] };
  }

  const errors: string[] = [];
  const { copy, theme, background } = settings.appearance;

  for (const [key, value] of Object.entries(theme)) {
    if (!isHexColor(value)) {
      errors.push(`"${key}" is not a valid hex color.`);
    }
  }

  if (!isHexColor(background.color)) {
    errors.push('Background color is not a valid hex color.');
  }

  if (!(BACKGROUND_TYPES as string[]).includes(background.type)) {
    errors.push('Background type must be either "color" or "image".');
  }

  if (!(BACKGROUND_FITS as string[]).includes(background.fit)) {
    errors.push('Background fit must be cover, contain or repeat.');
  }

  if (background.type === 'image' && !background.imageUrl) {
    errors.push('Upload a background image, or switch the background type back to color.');
  }

  for (const [key, value] of Object.entries(copy)) {
    if (typeof value !== 'string') {
      errors.push(`Copy field "${key}" must be text.`);
    } else if (value.trim() === '') {
      errors.push(`Copy field "${key}" cannot be empty.`);
    }
  }

  return { ok: errors.length === 0, errors };
};

/** Fills in any copy key the admin has not explicitly set yet. */
export const withDefaultCopy = (copy: Partial<BoothCopywriting>): BoothCopywriting => ({
  ...DEFAULT_BOOTH_APPEARANCE.copy,
  ...copy,
});

/* ------------------------------------------------------------------ *
 * Cache
 * ------------------------------------------------------------------ */

const canUseLocalStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

/**
 * Last known good settings. Read synchronously at boot so the booth paints the
 * correct theme before any network round-trip.
 */
export const getCachedAppearanceSettings = (): BoothAppearanceSettings | null => {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BoothAppearanceSettings>;
    const mode: BoothAppearanceMode = parsed?.mode === 'custom' ? 'custom' : 'default';
    return { mode, appearance: mergeAppearance(parsed?.appearance) };
  } catch {
    return null;
  }
};

export const cacheAppearanceSettings = (settings: BoothAppearanceSettings): void => {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    // A full/blocked localStorage must never break the booth.
  }
};

/* ------------------------------------------------------------------ *
 * Supabase
 * ------------------------------------------------------------------ */

/** Reads the stored appearance, normalizing it against the shipped defaults. */
export const getBoothAppearanceSettings = async (): Promise<BoothAppearanceSettings> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('booth_appearance')
    .select('*')
    .eq('id', APPEARANCE_ROW_ID)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeSettings(data as BoothAppearanceRow | null);
};

/** Upserts the single appearance row. Requires an authenticated admin session. */
export const saveBoothAppearanceSettings = async (
  settings: BoothAppearanceSettings,
): Promise<BoothAppearanceSettings> => {
  const validation = validateAppearance(settings);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  const client = await requireAuthClient();
  const { error } = await client.from('booth_appearance').upsert(mapSettingsToRow(settings), {
    onConflict: 'id',
  });

  if (error) {
    throw new Error(error.message);
  }

  cacheAppearanceSettings(settings);
  return settings;
};

/** Uploads a booth background into the public booth-appearance bucket. */
export const uploadBoothBackground = async (file: File): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Background must be an image file.');
  }
  if (file.size > APPEARANCE_MAX_IMAGE_BYTES) {
    throw new Error('Background image must be 10 MB or smaller.');
  }

  const client = await requireAuthClient();
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'background.png';
  // Folder per upload so each admin pick keeps its own URL (so switching back
  // and forth in the editor never fights the storage cache).
  const objectPath = `backgrounds/${Date.now()}-${safeName}`;

  const { error } = await client.storage.from(APPEARANCE_BUCKET).upload(objectPath, file, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return client.storage.from(APPEARANCE_BUCKET).getPublicUrl(objectPath).data.publicUrl;
};