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