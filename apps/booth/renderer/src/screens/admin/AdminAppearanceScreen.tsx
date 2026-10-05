import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BoothAppearanceSettings,
  BoothBackgroundFit,
  BOOTH_COPY_GROUPS,
  BOOTH_THEME_GROUPS,
  BOOTH_THEME_PRESETS,
  BoothCopywriting,
  BoothTheme,
  DEFAULT_BOOTH_APPEARANCE,
} from '@photo-booth/types';
import {
  APPEARANCE_MAX_IMAGE_BYTES,
  isHexColor,
  resolveActiveAppearance,
  uploadBoothBackground,
  validateAppearance,
} from '../../lib/appearance';
import { useBoothAppearance } from '../../store/appearanceStore';
import { BoothAppearancePreview, type PreviewFlow } from '../../components/admin/BoothAppearancePreview';
import { ConfirmModal } from '../../components/admin/Modal';
import { IconImage, IconPalette, IconUpload } from '../../components/admin/AdminIcons';
import { Snackbar, SnackbarVariant } from '../../components/admin/Snackbar';

/**
 * Admin editor for the customer-facing booth appearance.
 *
 * Scope is deliberately narrow: this changes what guests see (copy, palette,
 * background) and never the dashboard itself. Editing happens against a local
 * draft so the preview updates instantly; nothing reaches the booth until Save.
 */

const BACKDROP_FITS: BoothBackgroundFit[] = ['cover', 'contain', 'repeat'];

const BACKDROP_POSITIONS = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

const Section: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <section className="rounded-2xl border border-white/10 bg-[#241341]">
    <header className="border-b border-white/10 px-5 py-4">
      <h2 className="font-semibold text-white">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-white/45">{description}</p>}
    </header>
    <div className="p-5">{children}</div>
  </section>
);

const TextField: React.FC<{
  label: string;
  hint?: string;
  multiline?: boolean;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, hint, multiline, value, onChange }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-medium text-white/60">{label}</span>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full resize-y rounded-lg border border-white/10 bg-[#1a0b2e] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#ff4bb5]/60 focus:outline-none"
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-[#1a0b2e] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#ff4bb5]/60 focus:outline-none"
      />
    )}
    {hint && <span className="mt-1 block text-[11px] text-white/35">{hint}</span>}
  </label>
);

const ColorField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => {
  // A native color input can't hold an invalid hex, so fall back to a mid-grey
  // swatch and let the text field surface the error.
  const valid = isHexColor(value);
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-white/60">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={valid ? value : '#808080'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-white/20 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className={`w-full rounded-lg border bg-[#1a0b2e] px-3 py-2 font-mono text-xs uppercase text-white focus:outline-none ${
            valid ? 'border-white/10 focus:border-[#ff4bb5]/60' : 'border-[#ff5e87]'
          }`}
        />
      </div>
    </label>
  );
};

export const AdminAppearanceScreen: React.FC = () => {
  // Selected individually: a selector returning a fresh object would give
  // useSyncExternalStore a new snapshot on every call and loop forever.
  const storedMode = useBoothAppearance((state) => state.mode);
  const storedAppearance = useBoothAppearance((state) => state.appearance);
  const loadError = useBoothAppearance((state) => state.error);
  const saveAppearance = useBoothAppearance((state) => state.saveAppearance);

  const [draft, setDraft] = useState<BoothAppearanceSettings>({
    mode: storedMode,
    appearance: storedAppearance,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; variant: SnackbarVariant } | null>(null);
  const [confirmDefault, setConfirmDefault] = useState(false);
  const [previewFlow, setPreviewFlow] = useState<PreviewFlow>('retake');
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-sync when the store finishes its background Supabase refresh.
  useEffect(() => {
    setDraft({ mode: storedMode, appearance: storedAppearance });
  }, [storedMode, storedAppearance]);

  const preview = useMemo(() => resolveActiveAppearance(draft), [draft]);

  const validation = useMemo(() => validateAppearance(draft), [draft]);

  const updateCopy = useCallback((key: keyof BoothCopywriting, value: string) => {
    setDraft((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        copy: { ...current.appearance.copy, [key]: value },
      },
    }));
  }, []);

  const updateTheme = useCallback(<K extends keyof BoothTheme>(key: K, value: BoothTheme[K]) => {
    setDraft((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        theme: { ...current.appearance.theme, [key]: value },
      },
    }));
  }, []);

  const applyThemePreset = useCallback((presetId: string) => {
    const preset = BOOTH_THEME_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    setDraft((current) => ({
      ...current,
      mode: 'custom',
      appearance: {
        ...current.appearance,
        theme: { ...preset.theme },
        // A flat color background matches the preset; an uploaded image is kept.
        background:
          current.appearance.background.type === 'image'
            ? current.appearance.background
            : { ...current.appearance.background, color: preset.backgroundColor },
      },
    }));
  }, []);

  const updateBackground = useCallback(
    (patch: Partial<BoothAppearanceSettings['appearance']['background']>) => {
      setDraft((current) => ({
        ...current,
        appearance: {
          ...current.appearance,
          background: { ...current.appearance.background, ...patch },
        },
      }));
    },
    [],
  );

  const dirty = useMemo(() => {
    if (draft.mode !== storedMode) return true;
    return JSON.stringify(draft.appearance) !== JSON.stringify(storedAppearance);
  }, [draft, storedMode, storedAppearance]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAppearance(draft);
      setSnackbar({
        message: draft.mode === 'default' ? 'Booth restored to the default look' : 'Booth appearance saved',
        variant: 'success',
      });
    } catch (err) {
      setSnackbar({
        message: err instanceof Error ? err.message : 'Failed to save appearance',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToDefault = async () => {
    setConfirmDefault(false);
    setSaving(true);
    try {
      await saveAppearance({
        mode: 'default',
        appearance: draft.appearance,
      });
      setSnackbar({ message: 'Booth restored to the default look', variant: 'success' });
    } catch (err) {
      setSnackbar({
        message: err instanceof Error ? err.message : 'Failed to switch appearance',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  /** Keeps the mode but pulls every value back to the shipped look. */
  const handleResetValues = () => {
    setDraft((current) => ({ ...current, appearance: DEFAULT_BOOTH_APPEARANCE }));
    setSnackbar({ message: 'Editor reset to the default values — save to apply', variant: 'success' });
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadBoothBackground(file);
      updateBackground({ type: 'image', imageUrl: url });
      setSnackbar({ message: 'Background uploaded — save to apply', variant: 'success' });
    } catch (err) {
      setSnackbar({
        message: err instanceof Error ? err.message : 'Upload failed',
        variant: 'error',
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const isDefaultMode = draft.mode === 'default';

  return (
    <div className="space-y-6 pb-24">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <IconPalette className="h-6 w-6" />
            Appearance
          </h1>
          <p className="mt-0.5 text-sm text-white/50">
            Customize what guests see on the booth. The dashboard is unaffected.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <button
              onClick={handleResetValues}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              Discard changes
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty || !validation.ok}
            title={validation.ok ? undefined : validation.errors.join(' ')}
            className="inline-flex items-center gap-2 rounded-full bg-[#d9f85a] px-5 py-2 text-sm font-bold text-[#140b26] transition hover:bg-[#bae32f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save appearance'}
          </button>
        </div>
      </header>

      {loadError && (
        <div className="rounded-lg border border-[#ffec5a]/40 bg-[#ffec5a]/10 px-4 py-3 text-sm text-[#ffec5a]">
          <p className="font-semibold">Showing the cached appearance</p>
          <p className="mt-0.5 text-white/60">
            Supabase could not be reached ({loadError}). Saving may overwrite the stored appearance with
            these values.
          </p>
        </div>
      )}

      {!validation.ok && (
        <div className="rounded-lg border border-[#ff5e87]/40 bg-[#ff5e87]/10 px-4 py-3 text-sm text-[#ff8aa8]">
          <p className="font-semibold">Fix before saving</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {validation.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Mode switch ---- */}
      <Section
        title="Appearance mode"
        description="Switch back to the default look at any time — your custom values are kept."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setDraft((current) => ({ ...current, mode: 'default' }))}
            aria-pressed={isDefaultMode}
            className={`rounded-xl border-2 p-4 text-left transition ${
              isDefaultMode
                ? 'border-[#d9f85a] bg-[#d9f85a]/10'
                : 'border-white/10 bg-[#1a0b2e] hover:border-white/25'
            }`}
          >
            <p className="flex items-center gap-2 font-semibold text-white">
              {isDefaultMode && <span className="text-[#d9f85a]">●</span>}
              Current default appearance
            </p>
            <p className="mt-1 text-sm text-white/45">
              The look the booth shipped with. Editing stays available below, but saving keeps this mode.
            </p>
          </button>

          <button
            onClick={() => setDraft((current) => ({ ...current, mode: 'custom' }))}
            aria-pressed={!isDefaultMode}
            className={`rounded-xl border-2 p-4 text-left transition ${
              !isDefaultMode
                ? 'border-[#d9f85a] bg-[#d9f85a]/10'
                : 'border-white/10 bg-[#1a0b2e] hover:border-white/25'
            }`}
          >
            <p className="flex items-center gap-2 font-semibold text-white">
              {!isDefaultMode && <span className="text-[#d9f85a]">●</span>}
              Custom appearance
            </p>
            <p className="mt-1 text-sm text-white/45">
              Applies your saved copy, colors and background to the booth.
            </p>
          </button>
        </div>

        {isDefaultMode && dirty && (
          <button
            onClick={() => {
              setDraft((current) => ({ ...current, mode: 'custom' }));
              setConfirmDefault(false);
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ff4bb5] px-4 py-2 text-sm font-bold text-[#140b26] transition hover:bg-[#ff6ec4]"
          >
            Customize from the default look
          </button>
        )}
      </Section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
        <div className="space-y-6">
          {/* ---- Copywriting ---- */}
          <Section
            title="Copywriting"
            description="Every customer-facing string on the booth. Tokens like {current} are replaced at runtime."
          >
            <div className="space-y-6">
              {BOOTH_COPY_GROUPS.map((group) => (
                <details key={group.id} open={group.id === 'bumper'} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-1 py-1 text-sm font-semibold text-white/85 transition hover:text-white">
                    {group.label}
                    <span className="text-xs text-white/35 group-open:hidden">Show</span>
                    <span className="hidden text-xs text-white/35 group-open:inline">Hide</span>
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {group.fields.map((field) => (
                      <TextField
                        key={field.key}
                        label={field.label}
                        hint={field.hint}
                        multiline={field.multiline}
                        value={draft.appearance.copy[field.key]}
                        onChange={(value) => updateCopy(field.key, value)}
                      />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </Section>

          {/* ---- Theme colors ---- */}
          <Section
            title="Design system colors"
            description="Applied to the booth as CSS variables, so every screen follows these."
          >
            <div className="space-y-6">
              {/* Presets — one click replaces every theme token at once. */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-white/70">Presets</h3>
                <div className="flex flex-wrap gap-2">
                  {BOOTH_THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyThemePreset(preset.id)}
                      title={`Apply the ${preset.label} palette`}
                      className="group flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1.5 pl-2 pr-3 transition hover:border-white/40 hover:bg-white/10"
                    >
                      <span className="flex overflow-hidden rounded-full">
                        {preset.swatches.map((color) => (
                          <span
                            key={color}
                            className="h-5 w-5 border-r border-black/20 last:border-r-0"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>
                      <span className="text-xs font-semibold text-white/80">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {BOOTH_THEME_GROUPS.map((group) => (
                <div key={group.id}>
                  <h3 className="mb-2 text-sm font-semibold text-white/70">{group.label}</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.fields.map((field) => (
                      <ColorField
                        key={field.key}
                        label={field.label}
                        value={draft.appearance.theme[field.key]}
                        onChange={(value) => updateTheme(field.key, value)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ---- Background ---- */}
          <Section title="Background" description="A flat color, or an uploaded image behind the booth screens.">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(['color', 'image'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => updateBackground({ type })}
                    aria-pressed={draft.appearance.background.type === type}
                    className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
                      draft.appearance.background.type === type
                        ? 'bg-[#d9f85a] text-[#140b26]'
                        : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ColorField
                  label="Background color"
                  value={draft.appearance.background.color}
                  onChange={(value) => updateBackground({ color: value })}
                />

                {draft.appearance.background.type === 'image' && (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-white/60">Image fit</span>
                      <select
                        value={draft.appearance.background.fit}
                        onChange={(e) =>
                          updateBackground({ fit: e.target.value as BoothBackgroundFit })
                        }
                        className="w-full rounded-lg border border-white/10 bg-[#1a0b2e] px-3 py-2 text-sm text-white focus:border-[#ff4bb5]/60 focus:outline-none"
                      >
                        {BACKDROP_FITS.map((fit) => (
                          <option key={fit} value={fit}>
                            {fit}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-white/60">Image position</span>
                      <select
                        value={draft.appearance.background.position}
                        onChange={(e) => updateBackground({ position: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-[#1a0b2e] px-3 py-2 text-sm text-white focus:border-[#ff4bb5]/60 focus:outline-none"
                      >
                        {BACKDROP_POSITIONS.map((position) => (
                          <option key={position.value} value={position.value}>
                            {position.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </div>

              {draft.appearance.background.type === 'image' && (
                <div className="space-y-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void handleUpload(e.target.files?.[0])}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-2 rounded-full bg-[#ff4bb5] px-4 py-2 text-sm font-bold text-[#140b26] transition hover:bg-[#ff6ec4] disabled:opacity-50"
                    >
                      <IconUpload className="h-4 w-4" />
                      {uploading ? 'Uploading…' : 'Upload image'}
                    </button>
                    {draft.appearance.background.imageUrl && (
                      <button
                        onClick={() => updateBackground({ imageUrl: undefined, type: 'color' })}
                        className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                      >
                        Remove image
                      </button>
                    )}
                    <span className="text-xs text-white/40">
                      PNG, JPG or WebP up to {Math.round(APPEARANCE_MAX_IMAGE_BYTES / (1024 * 1024))} MB
                    </span>
                  </div>

                  {draft.appearance.background.imageUrl && (
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1a0b2e] p-3">
                      <img
                        src={draft.appearance.background.imageUrl}
                        alt="Uploaded booth background"
                        className="h-16 w-24 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-white/70">
                          <IconImage className="h-3.5 w-3.5" />
                          Current background
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-white/35">
                          {draft.appearance.background.imageUrl}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* ---- Live preview ---- */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Section title="Preview" description="Updates as you type. Nothing is saved until you press Save.">
            <BoothAppearancePreview
              appearance={preview}
              flowMode={previewFlow}
              onFlowChange={setPreviewFlow}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !dirty || !validation.ok}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#d9f85a] px-4 py-2 text-sm font-bold text-[#140b26] transition hover:bg-[#bae32f] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save appearance'}
              </button>
              <button
                onClick={() => setConfirmDefault(true)}
                disabled={saving || isDefaultMode}
                title={isDefaultMode ? 'Already using the default look' : undefined}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Use default
              </button>
            </div>
          </Section>
        </div>
      </div>

      <ConfirmModal
        open={confirmDefault}
        title="Switch to the default look?"
        message="The booth will go back to the appearance it shipped with. Your custom copy, colors and background are kept and can be restored by switching back to Custom."
        confirmLabel="Switch to default"
        cancelLabel="Stay"
        busy={saving}
        onConfirm={() => void handleSwitchToDefault()}
        onCancel={() => setConfirmDefault(false)}
      />

      {snackbar && (
        <Snackbar
          message={snackbar.message}
          variant={snackbar.variant}
          onDone={() => setSnackbar(null)}
        />
      )}
    </div>
  );
};

export default AdminAppearanceScreen;