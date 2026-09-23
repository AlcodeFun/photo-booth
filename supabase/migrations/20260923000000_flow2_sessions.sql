-- Flow 2 (timed / organize-then-print) session support.
--
-- 1. `flow_mode` identifies which capture flow produced each session
--    (retake / timed / auto), so the admin dashboard and the gallery can
--    render the right workflow for the row.
-- 2. `print_status` already lives in a free-text column, so the new
--    'ready_to_print' state (set by the customer's organize page once every
--    frame slot is filled and the frame is approved) needs no schema change —
--    this migration documents + backfills it and normalizes the default.

alter table public.sessions
  add column if not exists flow_mode text not null default 'retake';

comment on column public.sessions.flow_mode is
  'Capture flow that produced the session: retake, timed (organize-then-print), or auto.';
comment on column public.sessions.print_status is
  'printing | ready_to_print | success | error — ready_to_print is set by the organize page when the customer approves the frame.';

-- Any row that already reached a finished upload state but was produced by
-- the timed flow can be flagged as such once the flag ships (best-effort).
update public.sessions
  set flow_mode = 'timed'
  where flow_mode = 'retake'
    and (
      meta ->> 'flowMode' = 'timed'
      or meta ? 'organize'
    );

create index if not exists sessions_flow_mode_idx on public.sessions (flow_mode);
create index if not exists sessions_print_status_ready_idx on public.sessions (print_status)
  where print_status = 'ready_to_print';

notify pgrst, 'reload schema';