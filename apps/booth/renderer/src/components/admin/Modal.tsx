import React, { useEffect } from 'react';
import { IconX } from './AdminIcons';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export const Modal: React.FC<ModalProps> = ({ open, title, onClose, children, width }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#1f1140] shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
        style={{ maxWidth: width ?? '640px' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
            <h3 className="font-semibold text-white">{title}</h3>
            <button
              className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
              onClick={onClose}
              aria-label="Close"
            >
              <IconX />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  danger = false,
  onConfirm,
  onCancel,
}) => (
  <Modal open={open} title={title} onClose={onCancel} width="440px">
    <p className="text-sm leading-relaxed text-white/70">{message}</p>
    <div className="mt-6 flex justify-end gap-3">
      <button
        className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white/80 transition hover:bg-white/20"
        onClick={onCancel}
        disabled={busy}
      >
        {cancelLabel}
      </button>
      <button
        className={`rounded-full px-5 py-2 text-sm font-semibold transition disabled:opacity-60 ${
          danger
            ? 'bg-[#ff4b78] text-white hover:bg-[#ff5e87]'
            : 'bg-[#d9f85a] text-[#140b26] hover:bg-[#bae32f]'
        }`}
        onClick={onConfirm}
        disabled={busy}
      >
        {busy ? 'Working…' : confirmLabel}
      </button>
    </div>
  </Modal>
);