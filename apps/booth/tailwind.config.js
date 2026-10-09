/**
 * Derived tool tokens (see packages/types/src/themeTokens.ts). Set on :root as
 * `--pbx-<name>-rgb` channels at runtime, so `bg-pbx-ui-hi/60` keeps working.
 */
const PBX_TOKENS = [
  'ui-bg', 'ui-panel', 'ui-raised', 'ui-raised-2', 'ui-hi', 'ui-hi-strong', 'ui-hi-fg',
  'ui-brand', 'ui-brand-fg', 'ui-secondary', 'ui-accent',
  'paper', 'tint', 'line', 'ink', 'ink-muted',
  'brand', 'brand-fg', 'brand-soft', 'brand-tint', 'brand-strong',
  'secondary', 'secondary-fg', 'secondary-strong',
  'tertiary', 'tertiary-fg', 'tertiary-strong', 'tertiary-soft',
  'accent', 'accent-fg', 'accent-strong', 'accent-tint',
  'action', 'action-fg',
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './renderer/index.html',
    './renderer/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        /**
         * Customer-facing booth palette, driven by the admin appearance editor.
         * Values are set on :root as `--pb-*` at runtime by appearanceStore, so
         * the booth can be reskinned without a rebuild. The admin/tools use the
         * derived `pbx` tokens below instead.
         */
        pbx: Object.fromEntries(
          PBX_TOKENS.map((name) => [name, `rgb(var(--pbx-${name}-rgb) / <alpha-value>)`])
        ),
        pb: {
          primary: 'var(--pb-primary)',
          'primary-foreground': 'var(--pb-primary-foreground)',
          secondary: 'var(--pb-secondary)',
          'secondary-foreground': 'var(--pb-secondary-foreground)',
          tertiary: 'var(--pb-tertiary)',
          'tertiary-foreground': 'var(--pb-tertiary-foreground)',
          accent: 'var(--pb-accent)',
          'accent-foreground': 'var(--pb-accent-foreground)',
          action: 'var(--pb-action)',
          'action-foreground': 'var(--pb-action-foreground)',
          background: 'var(--pb-background)',
          foreground: 'var(--pb-foreground)',
          card: 'var(--pb-card)',
          'card-foreground': 'var(--pb-card-foreground)',
          surface: 'var(--pb-surface)',
          'surface-foreground': 'var(--pb-surface-foreground)',
          deep: 'var(--pb-deep)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
