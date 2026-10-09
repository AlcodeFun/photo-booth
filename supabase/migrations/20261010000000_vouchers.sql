-- Vouchers: lock the booth until a guest scans (or types) a valid code.
--
-- One voucher = one session. The admin generates codes in the dashboard and
-- prints them as QR cards; the booth (anon) never reads this table. It can
-- only call redeem_voucher(), which validates and consumes a code in a single
-- atomic UPDATE, so the same code can never start two sessions, even when two
-- booths scan it at the same moment.
--
-- Whether the booth is locked at all is a per-device booth setting (Booth
-- Setup -> Access); this table only answers "is this code good?".

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  -- 8 chars from an alphabet without look-alikes (no 0/O, 1/I/L).
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  batch text not null default '',
  note text not null default '',
  event_id uuid references public.events (id) on delete set null,
  expires_at timestamptz,
  revoked_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.vouchers is
  'Single-use booth vouchers. Redeemed only through redeem_voucher(); the booth never reads this table.';

create index if not exists vouchers_created_at_idx on public.vouchers (created_at desc);
create index if not exists vouchers_event_id_idx on public.vouchers (event_id);

alter table public.vouchers enable row level security;

-- Admin (authenticated) manages vouchers; anon has no direct access at all.
create policy "vouchers_admin_select" on public.vouchers
  for select to authenticated using (true);
create policy "vouchers_admin_insert" on public.vouchers
  for insert to authenticated with check (true);
create policy "vouchers_admin_update" on public.vouchers
  for update to authenticated using (true) with check (true);
create policy "vouchers_admin_delete" on public.vouchers
  for delete to authenticated using (true);

-- Which voucher paid for a session (null = open access / staff).
alter table public.sessions
  add column if not exists voucher_id uuid references public.vouchers (id) on delete set null;

create index if not exists sessions_voucher_id_idx on public.sessions (voucher_id);

-- Failed-attempt log for throttling guessing. Only redeem_voucher touches it.
create table if not exists public.voucher_attempts (
  id bigint generated always as identity primary key,
  ok boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists voucher_attempts_at_idx on public.voucher_attempts (attempted_at);

alter table public.voucher_attempts enable row level security;
-- No policies: not readable or writable through the API.

create or replace function public.redeem_voucher(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_id uuid;
  v_row public.vouchers%rowtype;
  v_reason text;
begin
  -- Throttle: too many wrong codes in the last minute -> refuse for a while.
  if (
    select count(*) from public.voucher_attempts
    where not ok and attempted_at > now() - interval '1 minute'
  ) >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  update public.vouchers
     set redeemed_at = now()
   where code = v_code
     and redeemed_at is null
     and revoked_at is null
     and (expires_at is null or expires_at > now())
  returning id into v_id;

  if v_id is not null then
    insert into public.voucher_attempts (ok) values (true);
    return jsonb_build_object('ok', true, 'voucher_id', v_id);
  end if;

  select * into v_row from public.vouchers where code = v_code;
  v_reason := case
    when not found then 'invalid'
    when v_row.revoked_at is not null then 'invalid'
    when v_row.redeemed_at is not null then 'used'
    else 'expired'
  end;

  insert into public.voucher_attempts (ok) values (false);
  -- Keep the log small.
  delete from public.voucher_attempts where attempted_at < now() - interval '1 day';

  return jsonb_build_object('ok', false, 'reason', v_reason);
end;
$$;

revoke all on function public.redeem_voucher(text) from public;
grant execute on function public.redeem_voucher(text) to anon, authenticated;

notify pgrst, 'reload schema';
