import { create } from 'zustand';
import {
  BoothAppearance,
  BoothAppearanceSettings,
  DEFAULT_BOOTH_APPEARANCE_SETTINGS,
} from '@photo-booth/types';
import {
  cacheAppearanceSettings,
  getBoothAppearanceSettings,
  getCachedAppearanceSettings,
  resolveActiveAppearance,
  saveBoothAppearanceSettings,
  withAlpha,
} from '../lib/appearance';

/**
 * Booth appearance state for the customer-facing flow.
 *
 * The booth seeds from the localStorage cache so it paints the correct theme on
 * the first frame, then refreshes from Supabase in the background. Admin screens
 * write through `saveAppearance`, which persists to Supabase and updates the
 * cache so the booth picks the change up on its next mount.
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
  mode: BoothAppearanceSettings['mode'];
  /** The editable document (what the admin form edits and what gets saved). */
  appearance: BoothAppearance;
  /** What the booth actually renders — `DEFAULT_BOOTH_APPEARANCE` in default mode. */
  active: BoothAppearance;
  /** True until the first Supabase read settles. */
  loading: boolean;
  /** Last error from a background refresh or a save. */
  error: string | null;

  loadAppearance: () => Promise<void>;
  /** Applies settings locally + to the DOM without persisting (editor preview). */
  previewAppearance: (settings: BoothAppearanceSettings) => void;
  /** Persists settings to Supabase, then refreshes the local state. */
  saveAppearance: (settings: BoothAppearanceSettings) => Promise<void>;
  /** Switches the booth back to the appearance shipped in code. */
  useDefaultAppearance: () => BoothAppearanceSettings;
}

const initial = getCachedAppearanceSettings() ?? DEFAULT_BOOTH_APPEARANCE_SETTINGS;

// Apply the cached appearance before React mounts so the booth never flashes the
// CSS defaults on top of the operator's real theme.
applyAppearanceToDocument(resolveActiveAppearance(initial));

export const useBoothAppearance = create<BoothAppearanceState>((set) => ({
  mode: initial.mode,
  appearance: initial.appearance,
  active: resolveActiveAppearance(initial),
  loading: true,
  error: null,

  loadAppearance: async () => {
    try {
      const settings = await getBoothAppearanceSettings();
      cacheAppearanceSettings(settings);
      const active = resolveActiveAppearance(settings);
      applyAppearanceToDocument(active);
      set({
        mode: settings.mode,
        appearance: settings.appearance,
        active,
        loading: false,
        error: null,
      });
    } catch (err) {
      // Offline / unconfigured Supabase: keep whatever the cache gave us so the
      // booth still runs with its last known appearance.
      const fallback = getCachedAppearanceSettings() ?? DEFAULT_BOOTH_APPEARANCE_SETTINGS;
      const active = resolveActiveAppearance(fallback);
      applyAppearanceToDocument(active);
      set({
        mode: fallback.mode,
        appearance: fallback.appearance,
        active,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load booth appearance',
      });
    }
  },

  previewAppearance: (settings) => {
    const active = resolveActiveAppearance(settings);
    applyAppearanceToDocument(active);
    set({ mode: settings.mode, appearance: settings.appearance, active });
  },

  saveAppearance: async (settings) => {
    const saved = await saveBoothAppearanceSettings(settings);
    cacheAppearanceSettings(saved);
    const active = resolveActiveAppearance(saved);
    applyAppearanceToDocument(active);
    set({
      mode: saved.mode,
      appearance: saved.appearance,
      active,
      error: null,
    });
  },

  useDefaultAppearance: () => {
    const settings: BoothAppearanceSettings = {
      mode: 'default',
      appearance: DEFAULT_BOOTH_APPEARANCE_SETTINGS.appearance,
    };
    const active = resolveActiveAppearance(settings);
    applyAppearanceToDocument(active);
    set({ mode: settings.mode, appearance: settings.appearance, active });
    return settings;
  },
}));

/** Convenience selector for the resolved appearance the booth should render. */
export const useActiveAppearance = (): BoothAppearance => useBoothAppearance((state) => state.active);

/** Convenience selector for the resolved copy map. */
export const useBoothCopy = () => useBoothAppearance((state) => state.active.copy);