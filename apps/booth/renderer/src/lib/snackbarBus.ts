import { SnackbarVariant } from '../components/admin/Snackbar';

const STORAGE_KEY = 'pb-admin-snackbar';

interface PendingSnackbar {
  message: string;
  variant: SnackbarVariant;
}

/** Queue a snackbar to be shown after a route change (e.g. save → templates). */
export const pushSnackbar = (message: string, variant: SnackbarVariant) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ message, variant }));
  } catch {
    // storage unavailable — snackbar just won't survive the navigation
  }
};

/** Pop (and clear) the pending snackbar that was queued across a navigation. */
export const takeSnackbar = (): PendingSnackbar | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as PendingSnackbar;
  } catch {
    return null;
  }
};