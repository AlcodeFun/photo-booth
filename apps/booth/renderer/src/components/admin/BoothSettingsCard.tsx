import React, { useEffect, useState } from 'react';
import {
  refreshBoothSettings,
  saveBoothSettings,
  useGlobalBoothSettings,
  type GlobalBoothSettings,
} from '../../lib/boothSettings';

type Patch = Partial<Pick<GlobalBoothSettings, 'accessMode' | 'printMode' | 'socialConsent'>>;

interface Choice<T extends string> {
  value: T;
  label: string;
  hint: string;
}

const ACCESS: Choice<GlobalBoothSettings['accessMode']>[] = [
  { value: 'open', label: 'Open', hint: 'Anyone can start a session' },
  { value: 'voucher', label: 'Voucher', hint: 'Scan or type a voucher to start' },
];

const PRINT: Choice<GlobalBoothSettings['printMode']>[] = [
  { value: 'manual', label: 'Manual', hint: 'Release prints from Print Queue' },
  { value: 'auto', label: 'Automatic', hint: 'Print as soon as the photo is ready' },
];

const CONSENT: Choice<'off' | 'on'>[] = [
  { value: 'off', label: 'Off', hint: 'Do not ask guests' },
  { value: 'on', label: 'On', hint: 'Ask "boleh diupload ke medsos Kelana?" at the end' },
];

const Segmented = <T extends string>({
  title,
  choices,
  value,
  disabled,
  onChange,
}: {
  title: string;
  choices: Choice<T>[];
  value: T | undefined;
  disabled: boolean;
  onChange: (value: T) => void;
}) => (
  <div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">{title}</p>
    <div className="grid grid-cols-2 gap-2">
      {choices.map((choice) => {
        const active = choice.value === value;
        return (
          <button
            key={choice.value}
            onClick={() => !active && onChange(choice.value)}
            disabled={disabled}
            aria-pressed={active}
            className={`rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-60 ${
              active
                ? 'border-pbx-ui-hi bg-pbx-ui-hi/15'
                : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
            }`}
          >
            <span className={`block text-sm font-semibold ${active ? 'text-pbx-ui-hi' : 'text-white'}`}>
              {active ? '● ' : ''}
              {choice.label}
            </span>
            <span className="mt-0.5 block text-xs text-white/50">{choice.hint}</span>
          </button>
        );
      })}
    </div>
  </div>
);

/** Admin dashboard: the global switches every booth follows live. */
export const BoothSettingsCard: React.FC<{ onSaved?: (message: string) => void }> = ({ onSaved }) => {
  const settings = useGlobalBoothSettings((state) => state.settings);
  const status = useGlobalBoothSettings((state) => state.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshBoothSettings();
  }, []);

  const save = async (patch: Patch, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await saveBoothSettings(patch);
      onSaved?.(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-pbx-ui-raised p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-white">Booth settings</h2>
          <p className="text-xs text-white/50">Applies to every booth right away</p>
        </div>
        {status === 'offline' && <span className="text-xs text-[#f7cd73]">Could not reach the database</span>}
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Segmented
          title="Access"
          choices={ACCESS}
          value={settings?.accessMode}
          disabled={busy || !settings}
          onChange={(accessMode) =>
            void save({ accessMode }, accessMode === 'voucher' ? 'Booths now need a voucher' : 'Booths are open to everyone')
          }
        />
        <Segmented
          title="Print"
          choices={PRINT}
          value={settings?.printMode}
          disabled={busy || !settings}
          onChange={(printMode) =>
            void save({ printMode }, printMode === 'auto' ? 'Booths print automatically' : 'Prints wait in Print Queue')
          }
        />
        <Segmented
          title="Social media consent"
          choices={CONSENT}
          value={settings ? (settings.socialConsent ? 'on' : 'off') : undefined}
          disabled={busy || !settings}
          onChange={(value) =>
            void save(
              { socialConsent: value === 'on' },
              value === 'on' ? 'Guests are asked for social media consent' : 'Social media consent question is off',
            )
          }
        />
      </div>
      {error && <p className="mt-3 text-sm text-[#ff8aa8]">{error}</p>}
    </section>
  );
};

export default BoothSettingsCard;
