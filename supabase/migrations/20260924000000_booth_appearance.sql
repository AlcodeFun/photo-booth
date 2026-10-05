-- Booth appearance (customer-facing look & feel) managed from the web admin.
--
-- Shape mirrors BoothAppearanceSettings from @photo-booth/types:
--   mode       'default' -> the booth renders DEFAULT_BOOTH_APPEARANCE shipped in
--               code (always available as a fallback, never duplicated here).
--               'custom'  -> the booth renders the saved copy/theme/background.
--   copy       customer-facing strings (text for every guest-facing screen)
--   theme      design-system colors applied as `--pb-*` CSS variables
--   background background color or uploaded image (URL points at Storage)
--
-- Exactly one row is used (id = 'default'); the table is a single-row document
-- store so it can grow without a migration later. localStorage is only a cache of
-- this row, never the source of truth.
create table public.booth_appearance (
  id text primary key,
  mode text not null default 'default' check (mode in ('default', 'custom')),
  copy jsonb not null default '{}'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  background jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.booth_appearance is
  'Customer-facing booth appearance (copy, theme colors, background) editable via the web admin. Single row with id = ''default''.';

-- Seed the row. Empty jsonb keeps the shipped defaults authoritative until an
-- operator switches to custom mode, so a fresh install renders exactly as before.
insert into public.booth_appearance (id, mode, copy, theme, background)
values (
  'default',
  'default',
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb
)
on conflict (id) do nothing;

-- Keep updated_at in sync on row changes (set_updated_at() comes from
-- 20260917000000_frame_templates.sql).
create trigger booth_appearance_set_updated_at
  before update on public.booth_appearance
  for each row
  execute function public.set_updated_at();

-- RLS: the booth renders with the anon key (appearance read), the admin writes
-- as an authenticated user.
alter table public.booth_appearance enable row level security;

create policy "booth_appearance_select" on public.booth_appearance
  for select
  to anon, authenticated
  using (true);

create policy "booth_appearance_insert" on public.booth_appearance
  for insert
  to authenticated
  with check (true);

create policy "booth_appearance_update" on public.booth_appearance
  for update
  to authenticated
  using (true)
  with check (true);

-- No delete policy: the appearance row must always exist so the booth can fall
-- back to the shipped default. Restoring defaults is a mode switch, not a delete.

-- Storage bucket for booth background images. Public so the booth and the
-- gallery render them over HTTPS without auth.
insert into storage.buckets (id, name, public, file_size_limit)
values ('booth-appearance', 'booth-appearance', true, 10485760)
on conflict (id) do nothing;

-- Admins upload appearance assets; anyone may read them.
create policy "booth_appearance_bucket_read" on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'booth-appearance');

create policy "booth_appearance_bucket_insert" on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'booth-appearance');

create policy "booth_appearance_bucket_update" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'booth-appearance');

create policy "booth_appearance_bucket_delete" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'booth-appearance');