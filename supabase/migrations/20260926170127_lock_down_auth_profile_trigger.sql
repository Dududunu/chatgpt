-- This function is called only by the auth.users trigger, never through RPC.
revoke all on function public.handle_new_auth_user_profile() from public, anon, authenticated;

-- The account-history queries currently fetch by user_id and sort locally;
-- the primary keys already support that filter, so these two unused indexes
-- add write cost without serving an existing query.
drop index if exists public.workouts_user_started_idx;
drop index if exists public.body_entries_user_date_idx;
