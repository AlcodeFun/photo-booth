export type AdminArea = 'login' | 'dashboard' | 'sesi' | 'templates' | 'frame-fit' | 'camera';

const isFileProtocol = () => window.location.protocol === 'file:';

/** Path-based admin URLs (e.g. `/admin/sesi`) are the canonical form. Hash-based
 * (`#/admin/sesi`) is only used as a fallback on file:// (Electron) hosts where
 * history.pushState with an absolute path would throw. */
const useHashNavigation = () => isFileProtocol();

/** Returns `/admin` (or the current admin root segment) for path-based navigation. */
const adminRootPath = () => '/admin';

const adminAreaPath = (area: AdminArea, query = '') => {
  const base = area === 'dashboard' ? adminRootPath() : `${adminRootPath()}/${area}`;
  return query ? `${base}?${query}` : base;
};

const adminAreaHash = (area: AdminArea, query = '') => {
  const base = area === 'dashboard' ? '#/admin' : `#/admin/${area}`;
  return query ? `${base}?${query}` : base;
};

/** Navigate to an admin area, preferring the clean path form. Returns silently
 * when already on the target URL. */
export const navigateToAdmin = (area: AdminArea, query?: string) => {
  if (useHashNavigation()) {
    const target = adminAreaHash(area, query);
    if (window.location.hash === target) return;
    window.location.hash = target;
    return;
  }

  const target = adminAreaPath(area, query);
  if (window.location.pathname + window.location.search === target) return;
  window.history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

/** Return to the booth at the app root. */
export const navigateToBooth = () => {
  if (useHashNavigation()) {
    if (window.location.hash !== '' && window.location.hash !== '#/') {
      window.location.hash = '#/';
    }
    return;
  }

  const target = window.location.pathname.replace(/\/admin(\/.*)?$/, '') || '/';
  window.history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
};