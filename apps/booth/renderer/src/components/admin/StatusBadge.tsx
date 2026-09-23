import React from 'react';
import { SessionPrintStatus, SessionUploadStatus } from '../../lib/sessions';
import { IconCheck, IconPrinter, IconRefresh, IconUpload } from './AdminIcons';

const LIME = 'border-[#d9f85a]/30 bg-[#d9f85a]/10 text-[#d9f85a]';
const ROSE = 'border-[#ff5e87]/30 bg-[#ff5e87]/10 text-[#ff8aa8]';
const AMBER = 'border-amber-400/30 bg-amber-400/10 text-amber-300';
const VIOLET = 'border-[#a35ef6]/40 bg-[#a35ef6]/10 text-[#d9b8ff]';

export const UploadBadge: React.FC<{ status: SessionUploadStatus }> = ({ status }) => {
  if (status === 'success') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${LIME}`}>
        <IconCheck className="h-3.5 w-3.5" />
        Synced
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${ROSE}`}>
        <IconUpload className="h-3.5 w-3.5" />
        Upload failed
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${AMBER}`}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
      </span>
      Uploading
    </span>
  );
};

export const PrintBadge: React.FC<{ status: SessionPrintStatus }> = ({ status }) => {
  if (status === 'success') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${LIME}`}>
        <IconCheck className="h-3.5 w-3.5" />
        Printed
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${ROSE}`}>
        <IconPrinter className="h-3.5 w-3.5" />
        Print failed
      </span>
    );
  }
  if (status === 'ready_to_print') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${VIOLET}`}>
        <IconPrinter className="h-3.5 w-3.5" />
        Ready to print
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${AMBER}`}>
      <IconPrinter className="h-3.5 w-3.5 animate-pulse" />
      Printing
    </span>
  );
};

export const RefreshIcon: React.FC<{ onClick: () => void; spinning?: boolean }> = ({ onClick, spinning }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
  >
    <span className={spinning ? 'animate-spin' : ''}>
      <IconRefresh className="h-4 w-4" />
    </span>
    Refresh
  </button>
);

export const shortToken = (token: string): string =>
  token.length > 9 ? `${token.slice(0, 4)}…${token.slice(-4)}` : token;

export const formatTimestamp = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};