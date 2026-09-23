import React from 'react';
import { useBoothConfig, BoothOutputSettings } from '../../store/boothConfigStore';

interface OutputOption {
  key: keyof BoothOutputSettings;
  icon: string;
  title: string;
  description: string;
}

const OUTPUT_OPTIONS: OutputOption[] = [
  {
    key: 'framed',
    icon: '🖼️',
    title: 'Framed photo',
    description: 'The composed frame with the selected photos. This is the sheet sent to the printer.',
  },
  {
    key: 'gif',
    icon: '🎞️',
    title: 'Animated GIF',
    description: 'The quick looping GIF of your selected photos in capture order.',
  },
  {
    key: 'framedLive',
    icon: '📹',
    title: 'Framed live photo',
    description:
      'The animated framed sheet: every slot plays its recorded live view clip in a short loop. Sits alongside the animated GIF — toggle each independently.',
  },
  {
    key: 'allPhotos',
    icon: '📷',
    title: 'All photos',
    description: 'Upload every individual raw photo so they are downloadable from the gallery.',
  },
];

export const OutputSetupPanel: React.FC = () => {
  const outputs = useBoothConfig((state) => state.outputs);
  const updateOutputs = useBoothConfig((state) => state.updateOutputs);

  return (
    <div>
      <p className="mb-4 text-sm font-semibold text-[#4d2d85]/80">
        Choose which results the booth produces and uploads to the gallery. Unchecked outputs are
        skipped — they are neither generated locally nor sent to the hosted gallery.
      </p>
      <div className="space-y-3">
        {OUTPUT_OPTIONS.map((option) => {
          const enabled = outputs[option.key];
          return (
            <label
              key={option.key}
              className={`flex cursor-pointer items-center gap-4 rounded-[12px] border-[3px] p-4 transition-colors ${
                enabled ? 'border-[#4acaf1] bg-[#f7f5ff]' : 'border-[#e3d9f5] bg-white'
              }`}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => updateOutputs({ [option.key]: e.target.checked })}
                className="h-5 w-5 accent-[#4acaf1]"
              />
              <div className="text-2xl">{option.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black uppercase tracking-[0.12em] text-[#4d2d85]">
                  {option.title}
                </div>
                <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#4d2d85]/75">
                  {option.description}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[0.6rem] font-black uppercase tracking-[0.14em] ${
                  enabled ? 'bg-[#4acaf1] text-white' : 'bg-[#efe8ff] text-[#7a4de3]'
                }`}
              >
                {enabled ? 'On' : 'Off'}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default OutputSetupPanel;