-- Diagnose + harden the sessions INSERT path.
--
-- anon inserts were still rejected (42501) after the policy re-creation in
-- 20260922000100, so this (1) reveals the actual REST role via an RPC,
-- (2) makes the insert policy apply to every role that holds INSERT
-- privilege instead of listing roles by name, and (3) nudges PostgREST to
-- reload its cached schema metadata.
create or replace function public.debug_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select current_user::text
$$;

grant execute on function public.debug_current_role() to anon, authenticated;

drop policy if exists sessions_insert on public.sessions;

-- No `to` clause: applies to any role that has the underlying INSERT
-- privilege (anon + authenticated, granted above). Keeps inserts open for
-- the booth exactly as intended.
create policy sessions_insert on public.sessions
  for insert
  with check (true);

-- Ask PostgREST to refresh its schema cache (also fired by Supabase's
-- DDL event triggers; belt-and-suspenders in case the CLI's role missed them).
notify pgrst, 'reload schema';