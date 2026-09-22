-- Revert the temporary anon-read diagnostic policy and prune the rows created
-- while investigating the stuck "uploading" status.
drop policy if exists sessions_select_temp_diag on public.sessions;

delete from public.sessions where token like 'shapes-%';

notify pgrst, 'reload schema';