-- TEMPORARY diagnostic read for investigating the stuck "uploading" sessions.
-- Reverted once the investigation concludes.
drop policy if exists sessions_select_temp_diag on public.sessions;

create policy sessions_select_temp_diag on public.sessions
  for select
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';