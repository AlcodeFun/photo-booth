-- Admin-facing session records. The booth writes these (upload/print status,
-- exported files, gallery link) as a session completes; the web admin reads,
-- re-uploads, reprints and deletes them.
--
-- The booth runs with the anon key (no sign-in), so inserts are open to anon;
-- every admin operation (read / update / delete) requires an authenticated
-- user, which is what gates the /admin dashboard.
create table public.sessions (
  token text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  upload_status text not null default 'uploading',
  print_status text not null default 'printing',
  download_url text not null default '',
  files jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb
);

comment on table public.sessions is 'Session metadata written by the booth and managed via the web admin.';

create index sessions_created_at_idx on public.sessions (created_at desc);
create index sessions_upload_status_idx on public.sessions (upload_status);
create index sessions_print_status_idx on public.sessions (print_status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row
  execute function public.set_updated_at();

alter table public.sessions enable row level security;

create policy "sessions_insert" on public.sessions
  for insert
  to anon, authenticated
  with check (true);

create policy "sessions_select" on public.sessions
  for select
  to authenticated
  using (true);

create policy "sessions_update" on public.sessions
  for update
  to authenticated
  using (true)
  with check (true);

create policy "sessions_delete" on public.sessions
  for delete
  to authenticated
  using (true);