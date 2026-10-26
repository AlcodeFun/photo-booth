import { create } from 'zustand';
import { supabase } from './supabase';
import { useBoothConfig, type BoothAccessMode } from '../store/boothConfigStore';

/**
 * Global booth settings (public.booth_settings, single row 'default').
 *
 * Every booth device mirrors the row into its local config
 * (access.mode, printer.printMode), so the rest of the app keeps reading
 * local settings and simply follows whatever the admin set. The row is
 * loaded at boot, re-checked on demand (each return to the start screen) and
 * pushed live through Supabase Realtime. Offline, the last applied values
 * (persisted locally) stay in force.
 */

export type BoothPrintMode = 'manual' | 'auto';

export interface GlobalBoothSettings {
  accessMode: BoothAccessMode;
  printMode: BoothPrintMode;
  /** Ask guests at the end of a session whether Kelana may post their photos. */
  socialConsent: boolean;
  updatedAt: string | null;
}

interface BoothSettingsState {
  settings: GlobalBoothSettings | null;
  /** 'live' once the first fetch worked; 'offline' when it could not be read. */
  status: 'loading' | 'live' | 'offline';
}

export const useGlobalBoothSettings = create<BoothSettingsState>(() => ({ settings: null, status: 'loading' }));

const ROW_ID = 'default';

const mapRow = (row: Record<string, unknown>): GlobalBoothSettings => ({
  accessMode: row.access_mode === 'voucher' ? 'voucher' : 'open',
  printMode: row.print_mode === 'auto' ? 'auto' : 'manual',
  socialConsent: row.social_consent_enabled === true,
  updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
});

/** Copies the global values into this device's local config. */
const apply = (settings: GlobalBoothSettings) => {
  useGlobalBoothSettings.setState({ settings, status: 'live' });
  const config = useBoothConfig.getState();
  if (config.access.mode !== settings.accessMode) config.updateAccess({ mode: settings.accessMode });
  if (config.printer.printMode !== settings.printMode) config.updatePrinter({ printMode: settings.printMode });
};

/** Fetches the row and applies it. Never throws. */
export const refreshBoothSettings = async (): Promise<void> => {
  if (!supabase) {
    useGlobalBoothSettings.setState({ status: 'offline' });
    return;
  }
  try {
    const { data, error } = await supabase.from('booth_settings').select('*').eq('id', ROW_ID).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'missing row');
    apply(mapRow(data as Record<string, unknown>));
  } catch {
    useGlobalBoothSettings.setState((s) => ({ status: s.settings ? s.status : 'offline' }));
  }
};

let started = false;

/** Boot once: first fetch, live updates, and a slow safety poll. */
export const startBoothSettingsSync = () => {
  if (started || !supabase) return;
  started = true;
  void refreshBoothSettings();
  supabase
    .channel('booth-settings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'booth_settings', filter: `id=eq.${ROW_ID}` }, (payload) => {
      if (payload.new && typeof payload.new === 'object') apply(mapRow(payload.new as Record<string, unknown>));
    })
    .subscribe();
  // Realtime can drop on flaky venue Wi-Fi; a light poll keeps booths honest.
  window.setInterval(() => void refreshBoothSettings(), 60_000);
};

/** Admin only (RLS): changes the global settings for every booth. */
export const saveBoothSettings = async (
  patch: Partial<Pick<GlobalBoothSettings, 'accessMode' | 'printMode' | 'socialConsent'>>,
) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const row: Record<string, string | boolean> = {};
  if (patch.accessMode) row.access_mode = patch.accessMode;
  if (patch.printMode) row.print_mode = patch.printMode;
  if (typeof patch.socialConsent === 'boolean') row.social_consent_enabled = patch.socialConsent;
  const { data, error } = await supabase.from('booth_settings').update(row).eq('id', ROW_ID).select('*');
  if (error) throw new Error(error.message);
  // RLS hides the update from non-admins as "0 rows" rather than an error.
  if (!data || data.length === 0) throw new Error('Only a signed-in admin can change booth settings');
  apply(mapRow(data[0] as Record<string, unknown>));
};
