-- Global booth settings shared by every booth device.
--
-- One row (id = 'default'). Booths read it (anon) at boot, on every return to
-- the start screen and live through Realtime, and copy the values into their
-- local config, so the rest of the app keeps reading local settings. Only a
-- signed-in admin (authenticated) can change it: from the admin dashboard, or
-- from Booth Setup on a device where an admin is signed in.

create table if not exists public.booth_settings (
  id text primary key,
  access_mode text not null default 'open' check (access_mode in ('open', 'voucher')),
  print_mode text not null default 'manual' check (print_mode in ('manual', 'auto')),
  updated_at timestamptz not null default now()
);

comment on table public.booth_settings is
  'Global booth behaviour (single row id = ''default''): access_mode open|voucher, print_mode manual|auto.';

insert into public.booth_settings (id) values ('default') on conflict (id) do nothing;

create trigger booth_settings_set_updated_at
  before update on public.booth_settings
  for each row
  execute function public.set_updated_at();

alter table public.booth_settings enable row level security;

create policy "booth_settings_select" on public.booth_settings
  for select to anon, authenticated using (true);

create policy "booth_settings_update" on public.booth_settings
  for update to authenticated using (true) with check (true);

-- Live updates to every booth.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'booth_settings'
  ) then
    alter publication supabase_realtime add table public.booth_settings;
  end if;
end $$;

notify pgrst, 'reload schema';
