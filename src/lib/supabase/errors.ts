/**
 * True when a Supabase/PostgREST query error indicates "no rows found"
 * (e.g. a `.single()` call matching zero rows) — distinguished from
 * generic fetch errors so callers can show a dedicated not-found state
 * instead of a raw error message.
 */
export function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'PGRST116'
  );
}
