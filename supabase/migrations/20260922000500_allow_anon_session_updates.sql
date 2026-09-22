-- Allow the booth (anon key) to INSERT and UPDATE sessions.
--
-- The booth persists session records with supabase-js `.upsert()`, which sends
-- `Prefer: resolution=merge-duplicates&on_conflict=token`. Postgres implements
-- that as `INSERT ... ON CONFLICT DO UPDATE`, and RLS requires the row to pass
-- the UPDATE policies for the role too. The original 20260922000000 migration
-- only granted UPDATE to `authenticated`, so every anon upsert (and the status
-- patches in lib/sessions.ts) were rejected with "new row violates row-level
-- security policy".
--
-- Design stays as intended: the booth can create and update session rows, but
-- reads and deletes remain restricted to signed-in admins.
drop policy if exists sessions_update on public.sessions;

create policy sessions_update on public.sessions
  for update
  to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';