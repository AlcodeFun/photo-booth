-- TEMPORARY diagnostic: let anon read sessions so the raw row can be inspected
-- over PostgREST. Remove again in the very next migration.
drop policy if exists sessions_select_temp_diag on public.sessions;

create policy sessions_select_temp_diag on public.sessions
  for select
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';