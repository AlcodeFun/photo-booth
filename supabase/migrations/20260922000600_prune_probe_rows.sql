-- Prune verification/probe rows written while testing the anon persist path
-- against the hosted database.
delete from public.sessions
where token like 'js-probe-%' or token like 'js-insert-%' or token in ('iso-a');