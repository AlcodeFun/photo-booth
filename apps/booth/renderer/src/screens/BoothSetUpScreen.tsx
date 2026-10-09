import React, { useState } from 'react';
import CameraSetupPanel from './setup/CameraSetupPanel';
import PrinterSetupPanel from './setup/PrinterSetupPanel';
import FlowSetupPanel from './setup/FlowSetupPanel';
import OutputSetupPanel from './setup/OutputSetupPanel';
import { navigateToBooth } from '../lib/navigation';

type SetupTab = 'camera' | 'printer' | 'flow' | 'output';

const TABS: { id: SetupTab; label: string; icon: string }[] = [
  { id: 'camera', label: 'Camera', icon: '📷' },
  { id: 'printer', label: 'Printer', icon: '🖨️' },
  { id: 'flow', label: 'Flow', icon: '🎬' },
  { id: 'output', label: 'Output', icon: '📤' },
];

const TAB_DESCRIPTIONS: Record<SetupTab, string> = {
  camera: 'Tethered Canon camera, live view and test captures.',
  printer: 'Canon Selphy CP1000 over CUPS — queue, paper and quality.',
  flow: 'How customers capture: retake, timed session or auto sequence.',
  output: 'Which results are produced and uploaded to the gallery.',
};

export const BoothSetUpScreen: React.FC = () => {
  const [tab, setTab] = useState<SetupTab>('camera');

  return (
    <div className="relative flex min-h-[calc(100dvh-3rem)] select-none flex-col items-center justify-center">
      <div className="w-full max-w-[1200px] rounded-[18px] border-[4px] border-pbx-brand bg-pbx-brand p-4 shadow-[0_0_0_6px_rgba(255,255,255,0.08)]">
        <div className="rounded-[14px] bg-white p-4 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-[0.7rem] font-black uppercase tracking-[0.24em] text-pbx-secondary">
                Admin
              </div>
              <h1 className="text-2xl font-black uppercase tracking-[-0.04em] text-pbx-ink">
                Booth Setup
              </h1>
            </div>
            <div className="hidden max-w-[240px] text-right text-xs font-semibold text-pbx-ink/70 sm:block">
              {TAB_DESCRIPTIONS[tab]}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
            {/* Setup nav — left rail on desktop, horizontal pills on mobile */}
            <nav className="flex flex-row gap-2 overflow-x-auto lg:flex-col">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-[12px] border-[3px] px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] lg:justify-start lg:gap-3 ${
                    tab === item.id
                      ? 'border-pbx-accent bg-pbx-accent-tint text-pbx-accent-strong'
                      : 'border-pbx-secondary bg-pbx-paper text-pbx-ink hover:border-pbx-accent'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>

            <section className="min-w-0 rounded-[14px] border-[3px] border-pbx-tint bg-pbx-paper p-4 md:p-5">
              {tab === 'camera' && <CameraSetupPanel />}
              {tab === 'printer' && <PrinterSetupPanel />}
              {tab === 'flow' && <FlowSetupPanel />}
              {tab === 'output' && <OutputSetupPanel />}
            </section>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/"
              onClick={(event) => {
                event.preventDefault();
                navigateToBooth();
              }}
              className="inline-block rounded-[10px] border-[3px] border-pbx-secondary bg-pbx-tertiary px-6 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-pbx-tertiary-fg"
            >
              Back to Booth
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoothSetUpScreen;
