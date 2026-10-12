import React, { useState } from 'react';
import { saveBoothSettings, useGlobalBoothSettings, type GlobalBoothSettings } from '../../lib/boothSettings';
import { useAdminSignedIn } from '../../lib/useAdminSignedIn';

type Patch = Partial<Pick<GlobalBoothSettings, 'accessMode' | 'printMode'>>;

/**
 * Editing the global (all-booths) settings from Booth Setup: allowed only when
 * an admin is signed in on this device; otherwise the controls are read-only.
 */
export const useGlobalSettingsEditor = () => {
  const canEdit = useAdminSignedIn();
  const status = useGlobalBoothSettings((state) => state.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (patch: Patch) => {
    if (!canEdit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveBoothSettings(patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };
  return { canEdit, busy, error, status, save };
};

export const GlobalSettingNote: React.FC<{ canEdit: boolean; status: string; error: string | null }> = ({
  canEdit,
  status,
  error,
}) => (
  <div className="flex flex-wrap items-center gap-2 text-[0.7rem] font-black uppercase tracking-[0.12em]">
    <span className="rounded-full bg-pbx-ui-accent px-2.5 py-0.5 text-white">🌐 All booths</span>
    {canEdit ? (
      <span className="text-pbx-ink/70">Changes apply to every booth right away</span>
    ) : (
      <span className="text-pbx-ink/70">Read-only here · sign in to Admin → Dashboard to change</span>
    )}
    {status === 'offline' && <span className="text-[#b3541e]">Offline: using the last known setting</span>}
    {error && <span className="normal-case tracking-normal text-[#c0392b]">{error}</span>}
  </div>
);
