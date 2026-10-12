import { useEffect, useState } from 'react';
import { getAdminSession, onAdminAuthStateChange } from './adminAuth';
import { supabase } from './supabase';

/**
 * True while an admin is signed in on this device (same Supabase session the
 * admin dashboard uses). Booth Setup uses it to decide whether the global
 * booth settings are editable here or read-only.
 */
export const useAdminSignedIn = (): boolean => {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void getAdminSession()
      .then((session) => alive && setSignedIn(Boolean(session)))
      .catch(() => undefined);
    const unsubscribe = onAdminAuthStateChange((session) => setSignedIn(Boolean(session)));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return signedIn;
};
