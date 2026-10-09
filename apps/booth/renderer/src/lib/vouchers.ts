import { requireSupabase } from './supabase';

/**
 * Single-use booth vouchers (public.vouchers, see the 20261010000000_vouchers
 * migration). One voucher = one session.
 *
 * The booth only ever calls redeemVoucher(), which goes through the
 * redeem_voucher() database function: it validates and consumes the code in
 * one atomic step. Everything else here is for the admin dashboard.
 */

/** No look-alikes (0/O, 1/I/L). Must match the CHECK constraint in SQL. */
export const VOUCHER_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const VOUCHER_LENGTH = 8;
const CODE_RE = new RegExp(`^[${VOUCHER_ALPHABET}]{${VOUCHER_LENGTH}}$`);
const CODE_TAIL_RE = new RegExp(`[${VOUCHER_ALPHABET}]{${VOUCHER_LENGTH}}$`);

/** Uppercases and strips separators: "abcd-2345" -> "ABCD2345". */
export const normalizeVoucherCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Pulls a voucher code out of whatever a scanner returned: the bare code, a
 * dashed code, or a longer payload ending in the code. Null when nothing fits.
 */
export const parseVoucherPayload = (raw: string): string | null => {
  const code = normalizeVoucherCode(raw);
  if (CODE_RE.test(code)) return code;
  return code.match(CODE_TAIL_RE)?.[0] ?? null;
};

/** "ABCD2345" -> "ABCD-2345" for display and printing. */
export const formatVoucherCode = (code: string): string =>
  code.length === VOUCHER_LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

/** Cryptographically random code (rejection sampling keeps it unbiased). */
export const generateVoucherCode = (): string => {
  const n = VOUCHER_ALPHABET.length;
  const limit = 256 - (256 % n);
  let code = '';
  while (code.length < VOUCHER_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte < limit && code.length < VOUCHER_LENGTH) code += VOUCHER_ALPHABET[byte % n];
    }
  }
  return code;
};

export type RedeemFailure = 'invalid' | 'used' | 'expired' | 'rate_limited' | 'offline';
export type RedeemResult = { ok: true; voucherId: string } | { ok: false; reason: RedeemFailure };

/** Validates and consumes a voucher. Never throws. */
export const redeemVoucher = async (rawCode: string): Promise<RedeemResult> => {
  const code = parseVoucherPayload(rawCode);
  if (!code) return { ok: false, reason: 'invalid' };
  try {
    const { data, error } = await requireSupabase().rpc('redeem_voucher', { p_code: code });
    if (error) return { ok: false, reason: 'offline' };
    const result = data as { ok?: boolean; voucher_id?: string; reason?: string } | null;
    if (result?.ok && result.voucher_id) return { ok: true, voucherId: result.voucher_id };
    const reason = result?.reason;
    return {
      ok: false,
      reason: reason === 'used' || reason === 'expired' || reason === 'rate_limited' ? reason : 'invalid',
    };
  } catch {
    return { ok: false, reason: 'offline' };
  }
};

// ---------------------------------------------------------------- admin ----

export type VoucherStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface Voucher {
  id: string;
  code: string;
  batch: string;
  note: string;
  event_id: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  redeemed_at: string | null;
  created_at: string;
  /** Token of the session it paid for, when that session uploaded. */
  session_token: string | null;
}

export const voucherStatus = (voucher: Voucher, now = Date.now()): VoucherStatus => {
  if (voucher.revoked_at) return 'revoked';
  if (voucher.redeemed_at) return 'used';
  if (voucher.expires_at && Date.parse(voucher.expires_at) <= now) return 'expired';
  return 'active';
};

const mapVoucherRow = (row: Record<string, unknown>): Voucher => {
  const sessions = row.sessions as Array<{ token?: string }> | null | undefined;
  const str = (value: unknown) => (typeof value === 'string' ? value : null);
  return {
    id: String(row.id ?? ''),
    code: String(row.code ?? ''),
    batch: String(row.batch ?? ''),
    note: String(row.note ?? ''),
    event_id: str(row.event_id),
    expires_at: str(row.expires_at),
    revoked_at: str(row.revoked_at),
    redeemed_at: str(row.redeemed_at),
    created_at: String(row.created_at ?? ''),
    session_token: sessions?.[0]?.token ?? null,
  };
};

/** Newest first, with the session each one paid for. */
export const listVouchers = async (): Promise<Voucher[]> => {
  const { data, error } = await requireSupabase()
    .from('vouchers')
    .select('*, sessions(token)')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapVoucherRow);
};

export interface VoucherBatchInput {
  count: number;
  batch: string;
  note?: string;
  eventId?: string | null;
  /** ISO timestamp, or null for no expiry. */
  expiresAt?: string | null;
}

export const MAX_VOUCHER_BATCH = 500;

/** Creates `count` fresh codes; retries the rare duplicate-code collision. */
export const createVouchers = async (input: VoucherBatchInput): Promise<Voucher[]> => {
  const count = Math.max(1, Math.min(MAX_VOUCHER_BATCH, Math.floor(input.count)));
  const client = requireSupabase();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const codes = new Set<string>();
    while (codes.size < count) codes.add(generateVoucherCode());
    const rows = [...codes].map((code) => ({
      code,
      batch: input.batch.trim(),
      note: input.note?.trim() ?? '',
      event_id: input.eventId || null,
      expires_at: input.expiresAt || null,
    }));
    const { data, error } = await client.from('vouchers').insert(rows).select('*');
    if (!error) return ((data ?? []) as Array<Record<string, unknown>>).map(mapVoucherRow);
    // 23505 = a code already exists; draw a new set and try again.
    if (error.code !== '23505') throw new Error(error.message);
  }
  throw new Error('Could not generate unique voucher codes, try again.');
};

const patchVouchers = async (ids: string[], patch: Record<string, string | null>) => {
  if (ids.length === 0) return;
  const { error } = await requireSupabase().from('vouchers').update(patch).in('id', ids);
  if (error) throw new Error(error.message);
};

export const revokeVouchers = (ids: string[]) => patchVouchers(ids, { revoked_at: new Date().toISOString() });

/** Makes revoked or used vouchers usable again (e.g. a guest's session failed). */
export const reactivateVouchers = (ids: string[]) => patchVouchers(ids, { revoked_at: null, redeemed_at: null });

export const deleteVouchers = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const { error } = await requireSupabase().from('vouchers').delete().in('id', ids);
  if (error) throw new Error(error.message);
};
