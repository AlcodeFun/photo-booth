-- Events: group sessions by the event the booth was running at.
--
-- The admin creates events and marks at most one as active. New session rows
-- are stamped with the active event by a BEFORE INSERT trigger, so the booth
-- (which inserts as anon and never reads events) needs no change. Sessions can
-- be re-assigned to another event from the admin afterwards.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  starts_on date,
  ends_on date,
  notes text not null default '',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.events is
  'Events the booth runs at. Sessions are grouped by event_id; the single is_active event is stamped onto new sessions.';

-- At most one active event.
create unique index if not exists events_single_active_idx
  on public.events (is_active)
  where is_active;

create trigger events_set_updated_at
  before update on public.events
  for each row
  execute function public.set_updated_at();

alter table public.sessions
  add column if not exists event_id uuid references public.events (id) on delete set null;

comment on column public.sessions.event_id is
  'Event this session belongs to (null = unassigned). Defaults to the active event on insert.';

create index if not exists sessions_event_id_idx on public.sessions (event_id);

-- Security definer: the booth inserts as anon, which cannot read events.
create or replace function public.assign_session_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_id is null then
    select id into new.event_id from public.events where is_active limit 1;
  end if;
  return new;
end;
$$;

revoke all on function public.assign_session_event() from public;

create trigger sessions_assign_event
  before insert on public.sessions
  for each row
  execute function public.assign_session_event();

-- RLS: events are managed and read by the authenticated admin only.
alter table public.events enable row level security;

create policy "events_select" on public.events
  for select to authenticated using (true);

create policy "events_insert" on public.events
  for insert to authenticated with check (true);

create policy "events_update" on public.events
  for update to authenticated using (true) with check (true);

create policy "events_delete" on public.events
  for delete to authenticated using (true);

notify pgrst, 'reload schema';
