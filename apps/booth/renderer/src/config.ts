/**
 * Booth runtime configuration.
 *
 * VITE_GALLERY_URL points to the deployed Cloudflare Worker (e.g.
 * https://photo-booth-gallery.YOUR-ACCOUNT.workers.dev). When set, the booth
 * uploads session files to R2 through the Worker and shows a real gallery QR.
 * When unset, the booth keeps the previous offline/simulated upload behavior.
 */
const galleryUrlRaw = (import.meta.env.VITE_GALLERY_URL as string | undefined) ?? '';

export const GALLERY_URL = (galleryUrlRaw.trim().length > 0 ? galleryUrlRaw.trim().replace(/\/+$/, '') : null) as
  | string
  | null;

/**
 * VITE_APP_URL points to the hosted web app (the Vercel-deployed booth renderer,
 * e.g. https://photobooth.vercel.app). The flow-2 arrange page (/organize/:token)
 * is served there alongside the admin console, so the customer QR must target it
 * rather than the Cloudflare Worker. Falls back to GALLERY_URL when unset.
 */
const appUrlRaw = (import.meta.env.VITE_APP_URL as string | undefined) ?? '';

export const APP_URL = (appUrlRaw.trim().length > 0 ? appUrlRaw.trim().replace(/\/+$/, '') : GALLERY_URL) as
  | string
  | null;