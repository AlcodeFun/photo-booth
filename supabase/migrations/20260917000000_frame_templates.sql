-- Frame templates served to the booth and managed via the web admin.
-- Mirrors FrameConfig / FrameTemplateConfig from @photo-booth/types.
create table public.frame_templates (
  id text primary key,
  name text not null,
  theme text not null default '',
  preview_url text not null default '',
  photo_slots integer,
  template jsonb,
  templates_by_photo_slots jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.frame_templates is 'Selectable frames for the photo booth, editable via the web admin.';

create index frame_templates_enabled_sort_idx on public.frame_templates (enabled, sort_order);

-- Keep updated_at in sync on row changes.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger frame_templates_set_updated_at
  before update on public.frame_templates
  for each row
  execute function public.set_updated_at();

-- RLS: the booth renders with the anon key (catalog read), the web admin
-- writes as an authenticated user. Tighten the select policy later if needed.
alter table public.frame_templates enable row level security;

create policy "frame_templates_select" on public.frame_templates
  for select
  to anon, authenticated
  using (true);

create policy "frame_templates_insert" on public.frame_templates
  for insert
  to authenticated
  with check (true);

create policy "frame_templates_update" on public.frame_templates
  for update
  to authenticated
  using (true)
  with check (true);

create policy "frame_templates_delete" on public.frame_templates
  for delete
  to authenticated
  using (true);

-- Storage bucket for the .png frame overlay assets. Public so the booth and
-- the gallery can render them over HTTPS without auth.
insert into storage.buckets (id, name, public, file_size_limit)
values ('frame-templates', 'frame-templates', true, 10485760)
on conflict (id) do nothing;

-- Admins upload frame assets; anyone may read them.
create policy "frame_templates_bucket_read" on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'frame-templates');

create policy "frame_templates_bucket_insert" on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'frame-templates');

create policy "frame_templates_bucket_update" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'frame-templates');

create policy "frame_templates_bucket_delete" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'frame-templates');