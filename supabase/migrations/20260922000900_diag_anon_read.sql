-- TEMPORARY diagnostic: let anon read sessions so the raw rows can be inspected.
-- Reverted again by the next migration.
drop policy if exists sessions_select_temp_diag on public.sessions;

create policy sessions_select_temp_diag on public.sessions
  for select
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';