-- Idempotent corrective pass for public.sessions RLS.
--
-- The original 20260922000000 migration may not have fully applied on remote
-- (anon REST inserts were returning 42501 "new row violates row-level security
-- policy" despite the intended open insert policy). This re-runs the
-- table-guard, policies and grants defensively so the booth's anon-key inserts
-- succeed and the dashboard's authenticated reads/updates/deletes keep working.
create table if not exists public.sessions (
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

create index if not exists sessions_created_at_idx on public.sessions (created_at desc);
create index if not exists sessions_upload_status_idx on public.sessions (upload_status);
create index if not exists sessions_print_status_idx on public.sessions (print_status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at
  before update on public.sessions
  for each row
  execute function public.set_updated_at();

-- Role privileges (idempotent). Supabase cloud usually grants these by default
-- for tables created in public, but explicit grants remove any doubt.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.sessions to anon, authenticated;

alter table public.sessions enable row level security;

-- Recreate policies from scratch so the anon insert path is guaranteed open.
drop policy if exists sessions_insert on public.sessions;
drop policy if exists sessions_select on public.sessions;
drop policy if exists sessions_update on public.sessions;
drop policy if exists sessions_delete on public.sessions;

create policy sessions_insert on public.sessions
  for insert
  to anon, authenticated
  with check (true);

create policy sessions_select on public.sessions
  for select
  to authenticated
  using (true);

create policy sessions_update on public.sessions
  for update
  to authenticated
  using (true)
  with check (true);

create policy sessions_delete on public.sessions
  for delete
  to authenticated
  using (true);