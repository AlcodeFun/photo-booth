import React, { useEffect, useMemo, useState } from 'react';
import {
  useBoothConfig,
  CAPTURE_FLOW_LABELS,
  CaptureFlowMode,
  CaptureFlowSettings,
} from '../../store/boothConfigStore';

interface FlowOption {
  mode: CaptureFlowMode;
  icon: string;
  title: string;
  description: string;
  /** Settings that are editable for this flow — the panel adapts per mode. */
  fields: Array<{ key: keyof CaptureFlowSettings; label: string; suffix: string; min: number; max: number }>;
}

const FLOW_OPTIONS: FlowOption[] = [
  {
    mode: 'retake',
    icon: '🔁',
    title: 'Retake per slot',
    description:
      'Each photo slot lets the customer retake up to the set number of attempts before keeping a shot.',
    fields: [
      { key: 'maxAttempts', label: 'Attempts per slot', suffix: 'retakes', min: 1, max: 10 },
      { key: 'shotCountdown', label: 'Shot countdown', suffix: 'seconds', min: 1, max: 30 },
    ],
  },
  {
    mode: 'timed',
    icon: '⏱️',
    title: 'Timed unlimited session',
    description:
      'Capture as many photos as wanted until the time budget runs out, then filter and share. All raw photos upload to the gallery where the customer picks what goes on the frame.',
    fields: [
      { key: 'timeBudgetSeconds', label: 'Time budget', suffix: 'seconds', min: 10, max: 1800 },
      { key: 'timedStartCountdown', label: 'Start countdown', suffix: 'seconds', min: 0, max: 30 },
    ],
  },
  {
    mode: 'auto',
    icon: '📸',
    title: 'Continuous auto sequence',
    description:
      'The booth fires a countdown and shoots every slot in order automatically — the countdown itself is the gap, so one shot rolls straight into the next.',
    fields: [{ key: 'shotCountdown', label: 'Shot countdown', suffix: 'seconds', min: 1, max: 30 }],
  },
];

const NumberField: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, suffix, onChange }) => (
  <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.14em] text-[#4d2d85]">
    {label}
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isNaN(next)) {
            onChange(Math.min(max, Math.max(min, next)));
          }
        }}
        className="w-24 rounded-[8px] border-[3px] border-[#c9b8ff] bg-white px-3 py-2 text-sm font-black text-[#4d2d85] outline-none focus:border-[#a35ef6]"
      />
      {suffix && <span className="text-xs font-bold text-[#7a4de3]">{suffix}</span>}
    </div>
  </label>
);

export const FlowSetupPanel: React.FC = () => {
  const flowMode = useBoothConfig((state) => state.flowMode);
  const flow = useBoothConfig((state) => state.flow);
  const setFlowMode = useBoothConfig((state) => state.setFlowMode);
  const updateFlow = useBoothConfig((state) => state.updateFlow);

  // Drafts pending an explicit "Save setup flow". Switching tabs unmounts the
  // panel, so a draft is only ever edited while it is visible.
  const [draftMode, setDraftMode] = useState<CaptureFlowMode>(flowMode);
  const [draftFlow, setDraftFlow] = useState<CaptureFlowSettings>(flow);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setDraftMode(flowMode);
    setDraftFlow(flow);
  }, [flowMode, flow]);

  const dirty = useMemo(
    () =>
      draftMode !== flowMode ||
      (Object.keys(draftFlow) as Array<keyof CaptureFlowSettings>).some(
        (key) => draftFlow[key] !== flow[key],
      ),
    [draftMode, draftFlow, flowMode, flow],
  );

  const activeOption = FLOW_OPTIONS.find((option) => option.mode === draftMode) ?? FLOW_OPTIONS[0];

  const saveFlow = () => {
    setFlowMode(draftMode);
    updateFlow(draftFlow);
    setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const resetDraft = () => {
    setDraftMode(flowMode);
    setDraftFlow(flow);
    setSavedAt(null);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {FLOW_OPTIONS.map((option) => {
          const active = draftMode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => setDraftMode(option.mode)}
              className={`rounded-[14px] border-[4px] p-4 text-left transition-all ${
                active
                  ? 'border-[#4acaf1] bg-[#f7f5ff]'
                  : 'border-[#a35ef6] bg-[#fdf3ff] hover:border-[#4acaf1]'
              }`}
            >
              <div className="mb-2 text-2xl">{option.icon}</div>
              <div className="text-sm font-black uppercase tracking-[0.12em] text-[#4d2d85]">
                {CAPTURE_FLOW_LABELS[option.mode]}
              </div>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#4d2d85]/80">
                {option.description}
              </p>
              <div
                className={`mt-3 inline-block rounded-full px-3 py-1 text-[0.6rem] font-black uppercase tracking-[0.14em] ${
                  active ? 'bg-[#4acaf1] text-white' : 'bg-[#efe8ff] text-[#7a4de3]'
                }`}
              >
                {active ? 'Selected' : 'Select'}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-[12px] border-[3px] border-[#c9b8ff] bg-[#faf7ff] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">
          <span>Flow settings</span>
          <span className="rounded-full bg-[#4acaf1] px-3 py-0.5 text-[0.6rem] tracking-[0.14em] text-white">
            {CAPTURE_FLOW_LABELS[draftMode]}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          {activeOption.fields.map((field) => (
            <NumberField
              key={field.key}
              label={field.label}
              value={draftFlow[field.key]}
              min={field.min}
              max={field.max}
              suffix={field.suffix}
              onChange={(next) => setDraftFlow((draft) => ({ ...draft, [field.key]: next }))}
            />
          ))}
        </div>

        <p className="mt-4 text-xs font-semibold text-[#4d2d85]/75">
          {draftMode === 'retake' &&
            `Each slot allows up to ${draftFlow.maxAttempts} ${
              draftFlow.maxAttempts === 1 ? 'attempt' : 'attempts'
            } before "Use photo" is forced; a ${draftFlow.shotCountdown}s countdown runs before every shot.`}
          {draftMode === 'timed' &&
            `The session runs for ${draftFlow.timeBudgetSeconds}s after a ${draftFlow.timedStartCountdown}s start countdown. Tapping the live view captures another photo until the budget ends — every raw photo uploads for the gallery picker.`}
          {draftMode === 'auto' &&
            `The booth fires a ${draftFlow.shotCountdown}s countdown that doubles as the gap, so the next slot starts immediately after each capture.`}
        </p>
      </div>

      {/* Save bar — flow settings are committed to the booth only on Save. */}
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-[12px] border-[3px] border-[#ff4bb5] bg-[#fff1f8] px-4 py-3">
        <div className="mr-auto flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#4d2d85]">
          {dirty ? (
            <>
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff4bb5] shadow-[0_0_6px_rgba(255,75,181,0.8)]" />
              Unsaved changes
            </>
          ) : savedAt ? (
            <span className="text-[#2e9e4f]">✓ Saved at {savedAt}</span>
          ) : (
            <span className="text-[#4d2d85]/60">No changes</span>
          )}
        </div>
        <button
          type="button"
          onClick={resetDraft}
          disabled={!dirty}
          className={`rounded-[10px] border-[3px] px-5 py-2.5 text-[0.7rem] font-black uppercase tracking-[0.16em] transition-all ${
            dirty
              ? 'border-[#a35ef6] bg-white text-[#4d2d85] hover:-translate-y-0.5 active:translate-y-0'
              : 'cursor-not-allowed border-[#c9b8ff] bg-white/60 text-[#7d6ea6]'
          }`}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={saveFlow}
          disabled={!dirty}
          className={`rounded-[10px] px-5 py-2.5 text-[0.7rem] font-black uppercase tracking-[0.16em] text-white transition-all ${
            dirty
              ? 'bg-[#ff4bb5] shadow-[0_4px_0_rgba(122,43,140,0.45)] hover:-translate-y-0.5 active:translate-y-0'
              : 'cursor-not-allowed bg-[#7d6ea6] opacity-70'
          }`}
        >
          Save setup flow
        </button>
      </div>
    </div>
  );
};

export default FlowSetupPanel;