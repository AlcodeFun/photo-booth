interface ExportPanelProps {
  exportTemplate: string;
  status: string;
  onSaveDraft: () => void;
  onCopyTemplate: () => void;
  onClearPhotos: () => void;
  onResetDraft: () => void;
}

export const ExportPanel = ({
  exportTemplate,
  status,
  onSaveDraft,
  onCopyTemplate,
  onClearPhotos,
  onResetDraft,
}: ExportPanelProps) => (
  <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onSaveDraft}
        className="h-11 rounded-lg bg-white px-5 text-sm font-black text-black transition-colors hover:bg-zinc-200"
      >
        Save Draft
      </button>
      <button
        type="button"
        onClick={onCopyTemplate}
        className="h-11 rounded-lg border border-zinc-700 px-5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-950"
      >
        Copy Ready Template
      </button>
      <button
        type="button"
        onClick={onClearPhotos}
        className="h-11 rounded-lg border border-zinc-700 px-5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-950"
      >
        Clear Photos
      </button>
      <button
        type="button"
        onClick={onResetDraft}
        className="h-11 rounded-lg border border-rose-800 px-5 text-sm font-semibold text-rose-200 transition-colors hover:border-rose-500 hover:bg-rose-950/40"
      >
        Reset Draft
      </button>
      {status && <span className="self-center text-sm font-semibold text-sky-300">{status}</span>}
    </div>

    <textarea
      value={exportTemplate}
      readOnly
      className="min-h-48 resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-300 outline-none"
    />
  </div>
);