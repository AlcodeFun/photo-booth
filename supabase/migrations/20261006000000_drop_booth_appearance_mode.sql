-- Drop the appearance mode switch.
--
-- The booth no longer has a "default vs custom" rendering mode: it always
-- renders whatever appearance is saved in this row. The look the booth shipped
-- with lives on as the `Default` entry in BOOTH_THEME_PRESETS (@photo-booth/types),
-- which the admin editor applies like any other preset, so nothing here has to
-- gate rendering anymore.
alter table public.booth_appearance drop column mode;

comment on table public.booth_appearance is
  'Customer-facing booth appearance (copy, theme colors, background) editable via the web admin. Single row with id = ''default''; the booth always renders what is stored here.';
