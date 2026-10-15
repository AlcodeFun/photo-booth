import { create } from 'zustand';
import { BoothAppearance, DEFAULT_BOOTH_APPEARANCE, themeTokenCssVars } from '@photo-booth/types';
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
  // Admin, set-up, organize: contrast-checked tokens derived from the theme.
  const tokens = themeTokenCssVars(appearance.theme);
  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value);
  }
  applyBrowserChromeColor(appearance, tokens);
};

/**
 * iOS / Android browser chrome (Safari toolbar, status bar, overscroll area)
 * takes the color of the page being shown: the admin's UI background, the
 * organize page's paper, or the booth's own background.
 */
const applyBrowserChromeColor = (appearance: BoothAppearance, tokens: Record<string, string>): void => {
  const path = window.location.pathname.replace(/\/+$/, '');
  const isAdmin = window.location.hash.startsWith('#/admin') || path === '/admin' || path.startsWith('/admin/');
  const isOrganize = path.split('/').filter(Boolean)[0] === 'organize';
  const { background } = appearance;
  const color = isAdmin
    ? tokens['--pbx-ui-bg']
    : isOrganize
      ? tokens['--pbx-paper']
      : background.type === 'color' || background.type === 'image'
        ? background.color
        : appearance.theme.background;
  if (!color) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
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
  /**
   * True once the screen may be painted with `appearance`: right away when
   * this device has a cached copy of the saved theme, otherwise once the saved
   * theme has loaded (or after a short timeout when offline, falling back to
   * the default). Until then the app shows a neutral splash instead of the
   * shipped default colors.
   */
  ready: boolean;
  /** Last error from a background refresh or a save. */
  error: string | null;

  loadAppearance: () => Promise<void>;
  /** Persists the appearance to Supabase, then refreshes the local state. */
  saveAppearance: (appearance: BoothAppearance) => Promise<void>;
}

// Apply the saved appearance before React mounts so the booth never flashes the
// shipped default (or the CSS defaults) on top of the operator's real theme.
const cached = getCachedAppearance();
const initial = cached ?? DEFAULT_BOOTH_APPEARANCE;
/** No cached theme on this device: never paint the default first. */
const READY_TIMEOUT_MS = 5000;

applyAppearanceToDocument(initial);

export const useBoothAppearance = create<BoothAppearanceState>((set) => ({
  appearance: initial,
  loading: true,
  ready: Boolean(cached),
  error: null,

  loadAppearance: async () => {
    // Offline / slow network on a device without a cache: stop waiting after a
    // moment and run with the default rather than a blank screen.
    const timer = window.setTimeout(() => set({ ready: true }), READY_TIMEOUT_MS);
    try {
      const appearance = await getBoothAppearance();
      cacheAppearance(appearance);
      applyAppearanceToDocument(appearance);
      set({ appearance, loading: false, ready: true, error: null });
    } catch (err) {
      // Offline / unconfigured Supabase: keep whatever the cache gave us so the
      // booth still runs with its last known appearance.
      const fallback = getCachedAppearance() ?? DEFAULT_BOOTH_APPEARANCE;
      applyAppearanceToDocument(fallback);
      set({
        appearance: fallback,
        loading: false,
        ready: true,
        error: err instanceof Error ? err.message : 'Failed to load booth appearance',
      });
    } finally {
      window.clearTimeout(timer);
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