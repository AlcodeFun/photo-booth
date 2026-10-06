import { create } from 'zustand';
import { BoothAppearance, DEFAULT_BOOTH_APPEARANCE } from '@photo-booth/types';
import {
  cacheAppearance,
  getBoothAppearance,
  getCachedAppearance,
  saveBoothAppearance,
  withAlpha,
} from '../lib/appearance';

/**
 * Booth appearance state for the customer-facing flow.
 *
 * The booth seeds from the localStorage cache — the saved theme, never the
 * shipped default — so it paints the operator's look on the first frame, then
 * refreshes from Supabase in the background. Admin screens write through
 * `saveAppearance`, which persists to Supabase and updates the cache so the
 * booth picks the change up on its next mount.
 */

/** `primaryForeground` -> `--pb-primary-foreground`. */
const cssVarName = (key: string) => `--pb-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/** Pushes the theme onto the document root so plain CSS can consume it too. */
export const applyAppearanceToDocument = (appearance: BoothAppearance): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(appearance.theme)) {
    root.style.setProperty(cssVarName(key), value);
  }
};

/** The booth shell background (image over color, or the flat color). */
export const appearanceBackgroundStyle = (
  appearance: BoothAppearance,
): React.CSSProperties => {
  const { background } = appearance;
  if (background.type === 'image' && background.imageUrl) {
    return {
      backgroundColor: background.color,
      backgroundImage: `url("${background.imageUrl}")`,
      backgroundSize: background.fit,
      backgroundPosition: background.position,
      backgroundRepeat: background.fit === 'repeat' ? 'repeat' : 'no-repeat',
    };
  }
  return { backgroundColor: background.type === 'color' ? background.color : appearance.theme.background };
};

/**
 * Background for a screen that owns its own flat surface color.
 *
 * Every customer screen is `fixed inset-0` with an opaque color, which would
 * otherwise hide a configured background image. This layers the image *under* a
 * translucent tint of the screen's own surface, so the image reads through while
 * the screen keeps its themed contrast. With no image configured the result is
 * exactly the flat surface color it was before.
 */
export const appearanceSurfaceStyle = (
  appearance: BoothAppearance,
  surfaceColor: string,
  tint = 0.85,
): React.CSSProperties => {
  const base = appearanceBackgroundStyle(appearance);
  if (appearance.background.type !== 'image' || !appearance.background.imageUrl) {
    return { ...base, backgroundColor: surfaceColor };
  }
  const fill = withAlpha(surfaceColor, tint);
  return {
    ...base,
    backgroundImage: `linear-gradient(${fill}, ${fill}), ${base.backgroundImage}`,
  };
};

export interface BoothAppearanceState {
  /** The saved document — what the admin form edits and the booth renders. */
  appearance: BoothAppearance;
  /** True until the first Supabase read settles. */
  loading: boolean;
  /** Last error from a background refresh or a save. */
  error: string | null;

  loadAppearance: () => Promise<void>;
  /** Persists the appearance to Supabase, then refreshes the local state. */
  saveAppearance: (appearance: BoothAppearance) => Promise<void>;
}

// Apply the saved appearance before React mounts so the booth never flashes the
// shipped default (or the CSS defaults) on top of the operator's real theme.
const initial = getCachedAppearance() ?? DEFAULT_BOOTH_APPEARANCE;

applyAppearanceToDocument(initial);

export const useBoothAppearance = create<BoothAppearanceState>((set) => ({
  appearance: initial,
  loading: true,
  error: null,

  loadAppearance: async () => {
    try {
      const appearance = await getBoothAppearance();
      cacheAppearance(appearance);
      applyAppearanceToDocument(appearance);
      set({ appearance, loading: false, error: null });
    } catch (err) {
      // Offline / unconfigured Supabase: keep whatever the cache gave us so the
      // booth still runs with its last known appearance.
      const fallback = getCachedAppearance() ?? DEFAULT_BOOTH_APPEARANCE;
      applyAppearanceToDocument(fallback);
      set({
        appearance: fallback,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load booth appearance',
      });
    }
  },

  saveAppearance: async (appearance) => {
    const saved = await saveBoothAppearance(appearance);
    cacheAppearance(saved);
    applyAppearanceToDocument(saved);
    set({ appearance: saved, error: null });
  },
}));

/** Convenience selector for the appearance the booth renders. */
export const useActiveAppearance = (): BoothAppearance => useBoothAppearance((state) => state.appearance);

/** Convenience selector for the resolved copy map. */
export const useBoothCopy = () => useBoothAppearance((state) => state.appearance.copy);