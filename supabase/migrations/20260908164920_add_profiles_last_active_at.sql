-- Heartbeat timestamp for "last active"/online status on profile pages.
-- No new RLS policy needed: `profiles` already has an UPDATE policy
-- scoped to the row's own owner (dark/language/etc. already update this
-- way), and RLS is row-scoped, not column-scoped.
alter table public.profiles add column last_active_at timestamptz;
