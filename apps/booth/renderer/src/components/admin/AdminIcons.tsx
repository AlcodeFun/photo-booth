import React from 'react';

interface IconProps {
  className?: string;
}

const base = 'h-5 w-5';

const Icon: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className ?? base} aria-hidden="true">
    {children}
  </svg>
);

export const IconDashboard: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
  </Icon>
);

export const IconSessions: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M9 6h12M9 12h12M9 18h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="4.5" cy="6" r="1.4" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="4.5" cy="18" r="1.4" fill="currentColor" />
  </Icon>
);

export const IconTemplates: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="2" />
  </Icon>
);

export const IconSearch: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);

export const IconLogout: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M15 12H3m0 0l4-4m-4 4l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);

export const IconChevronLeft: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
);

export const IconChevronDown: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
);

export const IconChevronRight: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
);

export const IconEye: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </Icon>
);

export const IconPencil: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M17 3l4 4L8 20H4v-4L17 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
);

export const IconTrash: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m3 0l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);

export const IconUpload: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M12 15V3m0 0L8 7m4-4l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);

export const IconPrinter: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M7 8V4h10v4M7 20h10v-6H7v6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <rect x="4" y="8" width="16" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" />
  </Icon>
);

export const IconQr: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    <path d="M7 7h2M7 7h-2m3 3v1M3 14h2m2 0h4v4H7z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    <path d="M17 17h1M17 17h-1m4 2h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </Icon>
);

export const IconPlus: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </Icon>
);

export const IconX: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </Icon>
);

export const IconRefresh: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M20 5v5h-5M4 19v-5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18.5 9A7.5 7.5 0 0 0 5.5 5.5M5.5 15A7.5 7.5 0 0 0 18.5 18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);

export const IconImage: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="9" cy="10" r="2" stroke="currentColor" strokeWidth="2" />
    <path d="M5.5 19l4.5-4 3 2.5L16 14l3 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
);

export const IconGif: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M7 10h3M8.5 10v4M13 14v-4h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);

export const IconStar: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </Icon>
);

export const IconMenu: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </Icon>
);

export const IconPhotoBooth: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
    <rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="2" />
    <path d="M7 7L5 5M17 7l2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);

export const IconLink: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
);

export const IconCheck: React.FC<IconProps> = ({ className }) => (
  <Icon className={className}>
    <path d="M4 12.5l5 5L20 6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
);