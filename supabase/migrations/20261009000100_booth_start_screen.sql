-- Start screen (attract loop) preset for the booth appearance.
--
-- Shape mirrors BoothStartScreen from @photo-booth/types: { "style": ... }
-- where style is 'gradient3d' | 'flat' | 'camera'. An empty object keeps the
-- shipped default (gradient3d), so existing installs render exactly as before.

alter table public.booth_appearance
  add column if not exists start_screen jsonb not null default '{}'::jsonb;

comment on column public.booth_appearance.start_screen is
  'Start screen preset: { "style": "gradient3d" | "flat" | "camera" }.';

notify pgrst, 'reload schema';
