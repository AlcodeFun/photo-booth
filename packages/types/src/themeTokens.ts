import type { BoothTheme } from './index';

/**
 * Derived "tool" tokens: the admin dashboard, booth set-up, organize screen and
 * the public gallery are not styled from the raw theme colors directly, because
 * a brand color is not guaranteed to read on every surface those tools use
 * (e.g. an olive primary on a near-black admin sidebar). Each token is derived
 * from the theme here, with contrast-checked fallbacks, so any preset reskins
 * the tools without breaking legibility.
 *
 * Two families:
 *  - `ui-*`  the dark chrome (admin shell, gallery page), built on `deep`.
 *  - light   the paper-like cards of set-up/organize, built on `card`.
 *
 * Every token is emitted twice: `--pbx-<name>` (hex) and `--pbx-<name>-rgb`
 * (space-separated channels) so Tailwind opacity modifiers keep working.
 */

type Rgb = [number, number, number];

const parseHex = (hex: string): Rgb | null => {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as Rgb;
};

const toHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

/** Linear sRGB mix: `amount` 0 returns `a`, 1 returns `b`. */
export const mixHex = (a: string, b: string, amount: number): string => {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return a;
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * amount) as Rgb);
};

const luminance = (hex: string): number => {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two hex colors (1–21). */
export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const firstReadable = (candidates: string[], against: string, min: number, fallback: string) =>
  candidates.find((c) => contrastRatio(c, against) >= min) ?? fallback;

export type ThemeTokenName =
  | 'ui-bg'
  | 'ui-panel'
  | 'ui-raised'
  | 'ui-raised-2'
  | 'ui-hi'
  | 'ui-hi-strong'
  | 'ui-hi-fg'
  | 'ui-brand'
  | 'ui-brand-fg'
  | 'ui-secondary'
  | 'ui-accent'
  | 'paper'
  | 'tint'
  | 'line'
  | 'ink'
  | 'ink-muted'
  | 'brand'
  | 'brand-fg'
  | 'brand-soft'
  | 'brand-tint'
  | 'brand-strong'
  | 'secondary'
  | 'secondary-fg'
  | 'secondary-strong'
  | 'tertiary'
  | 'tertiary-fg'
  | 'tertiary-strong'
  | 'tertiary-soft'
  | 'accent'
  | 'accent-fg'
  | 'accent-strong'
  | 'accent-tint'
  | 'action'
  | 'action-fg';

export const deriveThemeTokens = (theme: BoothTheme): Record<ThemeTokenName, string> => {
  const deep = theme.deep;
  const paper = mixHex(theme.card, '#ffffff', 0.4);
  const ink = firstReadable([theme.foreground, theme.cardForeground], paper, 4.5, deep);

  // Highlight on the dark chrome: the first brand color that reads on `deep`.
  const hi = firstReadable(
    [theme.tertiary, theme.accent, theme.action, theme.primary, theme.secondary],
    deep,
    4.5,
    '#ffffff',
  );
  const line = mixHex(paper, theme.secondary, 0.35);
  const uiBrand = contrastRatio(theme.primary, deep) >= 3 ? theme.primary : hi;

  return {
    'ui-bg': mixHex(deep, '#000000', 0.25),
    'ui-panel': deep,
    'ui-raised': mixHex(deep, theme.secondary, 0.12),
    'ui-raised-2': mixHex(deep, theme.secondary, 0.22),
    'ui-hi': hi,
    'ui-hi-strong': mixHex(hi, '#000000', 0.15),
    'ui-hi-fg': deep,
    'ui-brand': uiBrand,
    'ui-brand-fg': uiBrand === theme.primary ? theme.primaryForeground : deep,
    'ui-secondary': contrastRatio(theme.secondary, deep) >= 3 ? theme.secondary : line,
    'ui-accent': contrastRatio(theme.accent, deep) >= 3 ? theme.accent : hi,

    paper,
    tint: mixHex(paper, theme.secondary, 0.12),
    line,
    ink,
    'ink-muted': mixHex(ink, paper, 0.35),

    brand: theme.primary,
    'brand-fg': theme.primaryForeground,
    'brand-soft': mixHex(theme.primary, '#ffffff', 0.4),
    'brand-tint': mixHex(theme.primary, '#ffffff', 0.85),
    'brand-strong': mixHex(theme.primary, '#000000', 0.3),
    secondary: theme.secondary,
    'secondary-fg': theme.secondaryForeground,
    'secondary-strong': firstReadable(
      [mixHex(theme.secondary, '#000000', 0.3), mixHex(theme.secondary, '#000000', 0.5)],
      paper,
      4.5,
      ink,
    ),
    tertiary: theme.tertiary,
    'tertiary-fg': theme.tertiaryForeground,
    'tertiary-strong': mixHex(theme.tertiary, '#000000', 0.15),
    'tertiary-soft': mixHex(theme.tertiary, '#ffffff', 0.5),
    accent: theme.accent,
    'accent-fg': theme.accentForeground,
    'accent-strong': firstReadable(
      [mixHex(theme.accent, '#000000', 0.45), mixHex(theme.accent, '#000000', 0.6)],
      paper,
      4.5,
      ink,
    ),
    'accent-tint': mixHex(theme.accent, '#ffffff', 0.85),
    action: theme.action,
    'action-fg': theme.actionForeground,
  };
};

const hexToChannels = (hex: string): string => (parseHex(hex) ?? [0, 0, 0]).join(' ');

/** CSS custom properties (`--pbx-*` and `--pbx-*-rgb`) for the derived tokens. */
export const themeTokenCssVars = (theme: BoothTheme): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(deriveThemeTokens(theme))) {
    vars[`--pbx-${name}`] = value;
    vars[`--pbx-${name}-rgb`] = hexToChannels(value);
  }
  return vars;
};
