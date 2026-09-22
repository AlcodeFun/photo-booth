-- Corrected diagnostic: run as invoker so current_user is the role PostgREST
-- SET ROLE'd the request to (i.e. the one RLS evaluates), not the function owner.
drop function if exists public.debug_current_role();

create function public.debug_current_role()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'current_user', current_user::text,
    'session_user', session_user::text
  )
$$;

grant execute on function public.debug_current_role() to anon, authenticated;

notify pgrst, 'reload schema';