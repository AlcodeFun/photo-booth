-- Cleanup: remove diagnostic probe rows + the temporary debug function, and
-- restore the narrow insert policy (anon + authenticated only). The public
-- policy from the diagnostic pass was only needed to work around `Prefer:
-- return=representation` probes, which the booth never sends.
delete from public.sessions where token like 'probe-test-%';

drop function if exists public.debug_current_role();

drop policy if exists sessions_insert on public.sessions;

create policy sessions_insert on public.sessions
  for insert
  to anon, authenticated
  with check (true);

notify pgrst, 'reload schema';