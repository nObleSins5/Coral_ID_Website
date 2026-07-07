-- =============================================================================
-- Supabase layer — Narrow public username lookup (06_public_usernames.sql)
-- =============================================================================
-- Photo attribution needs SOME public identity, but the `users` table's RLS
-- deliberately restricts SELECT to your own row (users_select_self), and —
-- important nuance — Postgres RLS is row-level, not column-level. Supabase's
-- default anon/authenticated roles already hold blanket column grants on every
-- table, so simply adding a permissive "public read" policy on `users` would
-- expose EVERY column (email, zip, region, ...) of EVERY row, not just
-- username. That is not an acceptable trade for a byline.
--
-- Instead: a SECURITY DEFINER function that returns ONLY id + username, for a
-- batch of ids. It bypasses RLS by design (that's what SECURITY DEFINER is
-- for) but the function's own return shape is the entire security boundary —
-- there is no path from calling it to reading anything else about a user.
-- This leaves the users table's grants/policies completely untouched.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_public_usernames(user_ids uuid[])
RETURNS TABLE(id uuid, username text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id, username FROM public.users WHERE id = ANY(user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_usernames(uuid[]) TO anon, authenticated;
