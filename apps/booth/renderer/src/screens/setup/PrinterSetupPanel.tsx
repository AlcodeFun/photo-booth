import React, { useCallback, useEffect, useState } from 'react';
import { useBoothConfig } from '../../store/boothConfigStore';
import { IElectronAPIPrinterStatusResult } from '../../global';

const PAPER_SIZES = [
  { value: '100x148mm', label: '4×6 — 100×148mm' },
  { value: '100x150mm', label: '4×6 — 100×150mm' },
  { value: 'a6', label: 'A6' },
  { value: '54x86mm', label: 'Card — 54×86mm' },
];

const MEDIA_TYPES = ['photo', 'photo-silk', 'photo-glossy', 'plain'];
const QUALITIES = [
  { value: 3, label: 'Draft' },
  { value: 4, label: 'Normal' },
  { value: 5, label: 'High' },
];

/** Tiny self-generated test sheet (colored blocks + text) for the Selphy. */
const makeTestSheet = (): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const colors = ['#ff4bb5', '#4acaf1', '#d9f85a', '#a35ef6', '#ff7d57', '#4d2d85'];
  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(60 + (i % 3) * 300, 160 + Math.floor(i / 3) * 300, 260, 260);
  });
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SELPHY CP1000 TEST', canvas.width / 2, 100);
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('Photo Booth print test', canvas.width / 2, canvas.height - 90);
  return canvas.toDataURL('image/jpeg', 0.92);
};

const hasElectronPrinter = () => typeof window.electronAPI?.printer?.list === 'function';

export const PrinterSetupPanel: React.FC = () => {
  const printer = useBoothConfig((state) => state.printer);
  const updatePrinter = useBoothConfig((state) => state.updatePrinter);

  const [printers, setPrinters] = useState<string[]>([]);
  const [activeJobs, setActiveJobs] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [status, setStatus] = useState<IElectronAPIPrinterStatusResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const scanPrinters = useCallback(async () => {
    if (!hasElectronPrinter()) {
      setScanError('Printer bridge unavailable — running outside Electron.');
      return;
    }
    setBusy(true);
    setScanError(null);
    try {
      const result = await window.electronAPI.printer.list();
      setPrinters(result.printers);
      setActiveJobs(result.activeJobs);
      if (!result.available) {
        setScanError(result.error ?? 'CUPS not available.');
      }
    } catch (error) {
      setScanError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void scanPrinters();
  }, [scanPrinters]);

  useEffect(() => {
    if (!printer.queueName) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    const check = async () => {
      if (!hasElectronPrinter()) {
        setStatus(null);
        return;
      }
      try {
        const next = await window.electronAPI.printer.status(printer.queueName);
        if (!cancelled) {
          setStatus(next);
        }
      } catch {
        if (!cancelled) setStatus(null);
      }
    };
    void check();
    const timer = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [printer.queueName]);

  const handleTestPrint = async () => {
    if (!printer.queueName || !hasElectronPrinter()) {
      setTestResult('Select a printer queue first.');
      return;
    }
    setBusy(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI.printer.print({
        dataUrl: makeTestSheet(),
        fileName: 'selphy-test.jpg',
        queueName: printer.queueName,
        copies: printer.copies,
        paperSize: printer.paperSize,
        mediaType: printer.mediaType,
        quality: printer.quality,
        colorMode: printer.colorMode,
      });
      setTestResult(
        result.ok
          ? `Test print sent to ${printer.queueName}.${result.output ? ` (${result.output})` : ''}`
          : `Test print failed: ${result.error ?? 'unknown error'}`,
      );
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (current: IElectronAPIPrinterStatusResult | null) => {
    if (!current) {
      return <span className="font-bold text-[#7a4de3]/70">Unknown</span>;
    }
    const palette: Record<string, string> = {
      idle: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      printing: 'bg-sky-100 text-sky-700 border-sky-300',
      stopped: 'bg-rose-100 text-rose-700 border-rose-300',
      unavailable: 'bg-amber-100 text-amber-700 border-amber-300',
      unknown: 'bg-slate-100 text-slate-600 border-slate-300',
    };
    return (
      <span className={`rounded-full border-2 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] ${palette[current.state]}`}>
        {current.state}
      </span>
    );
  };

  const Select: React.FC<{
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  }> = ({ label, value, options, onChange }) => (
    <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.14em] text-[#4d2d85]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[8px] border-[3px] border-[#c9b8ff] bg-white px-3 py-2 text-sm font-bold text-[#4d2d85] outline-none focus:border-[#a35ef6]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-[12px] border-[3px] border-[#c9b8ff] bg-[#faf7ff] p-4">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={printer.enabled}
            onChange={(e) => updatePrinter({ enabled: e.target.checked })}
            className="h-5 w-5 accent-[#4acaf1]"
          />
          <span className="text-sm font-black uppercase tracking-[0.14em] text-[#4d2d85]">
            Enable physical printing
          </span>
        </label>
        <p className="mt-2 text-xs font-semibold leading-relaxed text-[#4d2d85]/75">
          Prints the framed photo through CUPS to the Canon Selphy CP1000 when a queue is detected
          and reachable ({' '}
          <span className="font-black">the booth device runs Ubuntu</span> ). When disabled or when
          no printer is available, the booth falls back to the simulated print so the flow never
          blocks.
        </p>

        {printer.enabled && (
          <div className="mt-4 border-t-2 border-[#c9b8ff]/60 pt-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[#4d2d85]">
              Print release mode
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => updatePrinter({ printMode: 'manual' })}
                className={`rounded-[10px] border-[3px] px-3 py-2 text-left transition ${
                  printer.printMode === 'manual'
                    ? 'border-[#a35ef6] bg-[#f3e9ff]'
                    : 'border-[#c9b8ff] bg-white hover:border-[#a35ef6]'
                }`}
              >
                <div className="text-sm font-black text-[#4d2d85]">Manual (batch)</div>
                <div className="mt-0.5 text-[0.7rem] font-semibold leading-snug text-[#4d2d85]/70">
                  Sessions queue up; release them from Admin → Print Queue. Minimizes wasted sheets.
                </div>
              </button>
              <button
                type="button"
                onClick={() => updatePrinter({ printMode: 'auto' })}
                className={`rounded-[10px] border-[3px] px-3 py-2 text-left transition ${
                  printer.printMode === 'auto'
                    ? 'border-[#4acaf1] bg-[#e3f6ff]'
                    : 'border-[#c9b8ff] bg-white hover:border-[#4acaf1]'
                }`}
              >
                <div className="text-sm font-black text-[#4d2d85]">Automatic</div>
                <div className="mt-0.5 text-[0.7rem] font-semibold leading-snug text-[#4d2d85]/70">
                  Prints as soon as the framed photo is ready. The customer waits for the print.
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-[12px] border-[3px] border-[#e5c9ff] bg-[#fbf3ff] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">
                Detected printers
              </div>
              <button
                type="button"
                onClick={() => void scanPrinters()}
                disabled={busy}
                className="rounded-[8px] border-[3px] border-[#a35ef6] bg-[#d9f85a] px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.12em] text-[#4d2d85] disabled:opacity-50"
              >
                {busy ? 'Scanning…' : 'Refresh'}
              </button>
            </div>

            {scanError ? (
              <p className="rounded-[8px] border-2 border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
                {scanError}
              </p>
            ) : printers.length === 0 ? (
              <p className="text-xs font-bold text-[#4d2d85]/60">
                No CUPS queues found. Install the Selphy (PPD) and run{' '}
                <span className="font-mono">sudo lpadmin -p SELPHY_CP1000 -E -m selphycp1000.ppd</span>.
              </p>
            ) : (
              <div className="space-y-1.5">
                {printers.map((name) => (
                  <label
                    key={name}
                    className={`flex cursor-pointer items-center gap-3 rounded-[8px] border-2 px-3 py-2 text-sm font-bold ${
                      printer.queueName === name
                        ? 'border-[#4acaf1] bg-[#e3f6ff] text-[#1b6c8f]'
                        : 'border-transparent bg-white text-[#4d2d85]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="printer-queue"
                      checked={printer.queueName === name}
                      onChange={() => updatePrinter({ queueName: name })}
                      className="accent-[#4acaf1]"
                    />
                    {name}
                  </label>
                ))}
                <div className="pt-1 text-xs font-semibold text-[#4d2d85]/60">
                  Active CUPS jobs: <span className="font-black">{activeJobs}</span>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[12px] border-[3px] border-[#e5c9ff] bg-[#fbf3ff] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">Queue</div>
              {printer.queueName && statusBadge(status)}
            </div>
            <input
              type="text"
              value={printer.queueName}
              onChange={(e) => updatePrinter({ queueName: e.target.value })}
              placeholder="SELPHY_CP1000"
              className="w-full rounded-[8px] border-[3px] border-[#c9b8ff] bg-white px-3 py-2 text-sm font-bold text-[#4d2d85] outline-none focus:border-[#a35ef6]"
            />
            <p className="mt-2 text-xs font-semibold text-[#4d2d85]/60">
              Pick a queue above or type the queue name manually for other booths.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[12px] border-[3px] border-[#e5c9ff] bg-[#fbf3ff] p-4">
            <div className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">
              Paper &amp; quality
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Paper size"
                value={printer.paperSize}
                options={PAPER_SIZES}
                onChange={(paperSize) => updatePrinter({ paperSize })}
              />
              <Select
                label="Media type"
                value={printer.mediaType}
                options={MEDIA_TYPES.map((value) => ({ value, label: value }))}
                onChange={(mediaType) => updatePrinter({ mediaType })}
              />
              <Select
                label="Quality"
                value={String(printer.quality)}
                options={QUALITIES.map(({ value, label }) => ({
                  value: String(value),
                  label,
                }))}
                onChange={(value) => updatePrinter({ quality: Number(value) })}
              />
              <Select
                label="Color mode"
                value={printer.colorMode}
                options={[
                  { value: 'color', label: 'Color' },
                  { value: 'grayscale', label: 'Grayscale' },
                ]}
                onChange={(colorMode) =>
                  updatePrinter({ colorMode: colorMode as 'color' | 'grayscale' })
                }
              />
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.14em] text-[#4d2d85]">
                Copies
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={printer.copies}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isNaN(next)) {
                      updatePrinter({ copies: Math.min(10, Math.max(1, next)) });
                    }
                  }}
                  className="rounded-[8px] border-[3px] border-[#c9b8ff] bg-white px-3 py-2 text-sm font-black text-[#4d2d85] outline-none focus:border-[#a35ef6]"
                />
              </label>
            </div>
          </div>

          <div className="rounded-[12px] border-[3px] border-[#e5c9ff] bg-[#fbf3ff] p-4">
            <div className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">
              Test print
            </div>
            <button
              type="button"
              onClick={() => void handleTestPrint()}
              disabled={busy}
              className="w-full rounded-[10px] bg-[#ff4bb5] px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send Test Print'}
            </button>
            {testResult && (
              <p
                className={`mt-3 rounded-[8px] border-2 px-3 py-2 text-xs font-bold ${
                  testResult.startsWith('Test print failed') || /^Select/.test(testResult)
                    ? 'border-rose-200 bg-rose-50 text-rose-600'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {testResult}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrinterSetupPanel;