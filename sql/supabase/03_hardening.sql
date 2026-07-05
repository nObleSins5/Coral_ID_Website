-- =============================================================================
-- Supabase layer — Security hardening (03_hardening.sql)
-- =============================================================================
-- Apply after 01_auth_integration.sql and 02_rls_policies.sql. Clears the
-- actionable WARN-level findings from Supabase's security advisor.
-- =============================================================================

-- Pin the trigger helper's search_path (it references no tables, so empty is
-- safe) — avoids the "function search_path mutable" advisory.
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- handle_new_user is only meant to fire as the auth.users trigger, never as a
-- PostgREST RPC. Revoking EXECUTE stops anon/authenticated from calling this
-- SECURITY DEFINER function directly; the trigger still fires normally.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- Remaining advisor notes are intentional / low-risk:
--   * rls_enabled_no_policy (INFO) on deferred-feature tables (businesses,
--     inquiries, messages, ...) — RLS on with no policy = service-role only
--     until those features are built. This is the intended locked state.
--   * extension_in_public (WARN) for citext / pg_trgm — left as-is; citext is a
--     live column type on users, so relocating the extension is riskier than
--     the low-severity warning it resolves. Revisit if desired.
