import React, { useEffect, useState } from 'react';

export type SnackbarVariant = 'success' | 'error';

interface SnackbarProps {
  variant: SnackbarVariant;
  message: string;
  duration?: number;
  onDone: () => void;
}

export const Snackbar: React.FC<SnackbarProps> = ({ variant, message, duration = 3200, onDone }) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const hideTimer = setTimeout(() => setLeaving(true), duration);
    return () => clearTimeout(hideTimer);
  }, [duration]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(onDone, 350);
    return () => clearTimeout(timer);
  }, [leaving, onDone]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[120] flex justify-center px-4">
      <div
        role="status"
        className={`flex max-w-full items-center gap-3 rounded-2xl border-2 px-5 py-3 text-sm font-bold shadow-[0_10px_30px_rgba(0,0,0,0.45)] ${
          leaving ? 'pb-snackbar-out' : 'pb-snackbar-in'
        } ${
          variant === 'success'
            ? 'border-[#d9f85a] bg-[#140b26] text-[#d9f85a]'
            : 'border-[#ff5e87] bg-[#140b26] text-[#ff5e87]'
        }`}
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            variant === 'success' ? 'bg-[#d9f85a]' : 'bg-[#ff5e87]'
          }`}
        />
        {message}
      </div>
    </div>
  );
};