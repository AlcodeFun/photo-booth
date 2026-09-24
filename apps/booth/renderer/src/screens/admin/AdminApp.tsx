import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { getAdminSession, onAdminAuthStateChange, signOutAdmin } from '../../lib/adminAuth';
import { navigateToAdmin, navigateToBooth } from '../../lib/navigation';
import { takeSnackbar } from '../../lib/snackbarBus';
import { AdminLayout, AdminNavArea } from '../../components/admin/AdminLayout';
import { Snackbar, SnackbarVariant } from '../../components/admin/Snackbar';
import { AdminLoginScreen } from './AdminLoginScreen';
import { AdminDashboardScreen } from './AdminDashboardScreen';
import { AdminSessionsScreen } from './AdminSessionsScreen';
import { AdminFramesScreen } from './AdminFramesScreen';
import { PrintQueueScreen } from './PrintQueueScreen';
import { FrameAdminScreen } from '../FrameAdminScreen';

type AdminArea = AdminNavArea | 'frame-fit' | 'login';

const parseArea = (): AdminArea => {
  const { hash, pathname } = window.location;
  const tail = (hash.startsWith('#/admin')
    ? hash.slice('#/admin'.length)
    : pathname.startsWith('/admin')
      ? pathname.slice('/admin'.length)
      : ''
  ).replace(/\/+$/, '');
  const segment = tail.split('/').filter(Boolean)[0] ?? '';
  if (segment === 'login') return 'login';
  if (
    segment === 'dashboard' ||
    segment === 'sesi' ||
    segment === 'templates' ||
    segment === 'print-queue' ||
    segment === 'frame-fit'
  ) {
    return segment;
  }
  return 'dashboard';
};

const setHash = (area: AdminArea) => {
  navigateToAdmin(area);
};

const Splash = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#140b26]">
    <div className="grid h-16 w-16 animate-pulse place-items-center rounded-2xl bg-gradient-to-br from-[#ff4bb5] to-[#a35ef6] text-2xl font-black text-[#140b26]">
      PB
    </div>
  </div>
);

/** Original destination before an unauthenticated visit forced the login redirect. */
let pendingTarget: { area: AdminArea; query?: string } | null = null;

/** Parse the admin-relative query string (hash-first fallback, matching path-based). */
const adminQuery = (): string | undefined => {
  const { hash, search } = window.location;
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.split('?')[1] ?? '');
  const merged = new URLSearchParams({ ...Object.fromEntries(searchParams), ...Object.fromEntries(hashParams) });
  const text = merged.toString();
  return text || undefined;
};

export const AdminApp: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'authed' | 'anon'>('checking');
  const [session, setSession] = useState<Session | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; variant: SnackbarVariant } | null>(null);
  const area = parseArea();

  useEffect(() => {
    const pending = takeSnackbar();
    if (pending) {
      setSnackbar(pending);
    }
  }, [area]);

  useEffect(() => {
    let alive = true;
    getAdminSession()
      .then((value) => {
        if (!alive) return;
        setSession(value);
        setStatus(value ? 'authed' : 'anon');
      })
      .catch(() => {
        if (alive) setStatus('anon');
      });
    const unsubscribe = onAdminAuthStateChange((value) => {
      setSession(value);
      setStatus(value ? 'authed' : 'anon');
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const handleAnonRedirect = () => {
    pendingTarget = { area, query: adminQuery() };
    setHash('login');
  };

  useEffect(() => {
    if (status === 'anon' && area !== 'login') {
      handleAnonRedirect();
    }
  }, [status, area]);

  useEffect(() => {
    if (status === 'authed' && area === 'login') {
      const target = pendingTarget;
      pendingTarget = null;
      navigateToAdmin(target?.area ?? 'dashboard', target?.query);
    }
  }, [status, area]);

  if (status === 'checking') {
    return <Splash />;
  }

  if (status === 'anon' || area === 'login') {
    return <AdminLoginScreen />;
  }

  const handleLogout = async () => {
    try {
      await signOutAdmin();
    } catch {
      // even if the request fails, drop the user back to the login screen
    }
    setHash('login');
  };

  if (area === 'frame-fit') {
    return (
      <>
        <FrameAdminScreen />
        {snackbar && (
          <Snackbar
            message={snackbar.message}
            variant={snackbar.variant}
            onDone={() => setSnackbar(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <AdminLayout
        active={area}
        userEmail={session?.user?.email ?? 'admin'}
        onNavigate={setHash}
        onLogout={handleLogout}
        onBackToBooth={() => {
          navigateToBooth();
        }}
      >
        {area === 'dashboard' && <AdminDashboardScreen onNavigate={setHash} />}
        {area === 'sesi' && <AdminSessionsScreen />}
        {area === 'print-queue' && <PrintQueueScreen />}
        {area === 'templates' && <AdminFramesScreen />}
      </AdminLayout>
      {snackbar && (
        <Snackbar
          message={snackbar.message}
          variant={snackbar.variant}
          onDone={() => setSnackbar(null)}
        />
      )}
    </>
  );
};