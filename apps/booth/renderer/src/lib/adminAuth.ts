import { Session, SupabaseClient } from '@supabase/supabase-js';
import { requireSupabase } from './supabase';

/**
 * Admin authentication thin-wrapper over the shared Supabase client. Kept
 * separate from lib/sessions.ts so the booth's insert-side code never pulls
 * in auth logic, and both stay decoupled.
 */

export type AdminSession = Session | null;

export const getAdminSession = async (): Promise<AdminSession> => {
  const { data } = await requireSupabase().auth.getSession();
  return data.session;
};

export const signInAdmin = async (email: string, password: string): Promise<void> => {
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message);
  }
};

export const signOutAdmin = async (): Promise<void> => {
  const { error } = await requireSupabase().auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
};

export const onAdminAuthStateChange = (
  callback: (session: Session | null) => void,
): (() => void) => {
  const client: SupabaseClient = requireSupabase();
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session ?? null);
  });
  return () => data.subscription.unsubscribe();
};