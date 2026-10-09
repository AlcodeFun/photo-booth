import { requireSupabase } from './supabase';

/**
 * Events (public.events) group sessions. At most one event is active; the
 * database stamps it onto every new session row (see the
 * 20261009000000_session_events migration), so the booth never deals with it.
 */
export interface BoothEvent {
  id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export interface BoothEventInput {
  name: string;
  starts_on?: string | null;
  ends_on?: string | null;
  notes?: string;
}

const mapEventRow = (row: Record<string, unknown>): BoothEvent => ({
  id: String(row.id ?? ''),
  name: String(row.name ?? ''),
  starts_on: typeof row.starts_on === 'string' ? row.starts_on : null,
  ends_on: typeof row.ends_on === 'string' ? row.ends_on : null,
  notes: String(row.notes ?? ''),
  is_active: Boolean(row.is_active),
  created_at: String(row.created_at ?? ''),
});

const normalizeInput = (input: BoothEventInput) => ({
  name: input.name.trim(),
  starts_on: input.starts_on || null,
  ends_on: input.ends_on || null,
  notes: input.notes?.trim() ?? '',
});

/** Newest event first; the active one is not special-cased in the order. */
export const listEvents = async (): Promise<BoothEvent[]> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('events')
    .select('*')
    .order('starts_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapEventRow);
};

export const createEvent = async (input: BoothEventInput): Promise<BoothEvent> => {
  const client = requireSupabase();
  const { data, error } = await client.from('events').insert(normalizeInput(input)).select('*').single();
  if (error) throw new Error(error.message);
  return mapEventRow(data as Record<string, unknown>);
};

export const updateEvent = async (id: string, input: BoothEventInput): Promise<void> => {
  const client = requireSupabase();
  const { error } = await client.from('events').update(normalizeInput(input)).eq('id', id);
  if (error) throw new Error(error.message);
};

/** Deleting an event keeps its sessions; they become unassigned. */
export const deleteEvent = async (id: string): Promise<void> => {
  const client = requireSupabase();
  const { error } = await client.from('events').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

/**
 * Makes `id` the active event (or clears the active event when null). The
 * current one is deactivated first so the single-active unique index holds.
 */
export const setActiveEvent = async (id: string | null): Promise<void> => {
  const client = requireSupabase();
  const { error: clearError } = await client.from('events').update({ is_active: false }).eq('is_active', true);
  if (clearError) throw new Error(clearError.message);
  if (!id) return;
  const { error } = await client.from('events').update({ is_active: true }).eq('id', id);
  if (error) throw new Error(error.message);
};

/** Moves sessions to an event (null = unassigned). */
export const assignSessionsToEvent = async (tokens: string[], eventId: string | null): Promise<void> => {
  if (tokens.length === 0) return;
  const client = requireSupabase();
  const { error } = await client.from('sessions').update({ event_id: eventId }).in('token', tokens);
  if (error) throw new Error(error.message);
};
