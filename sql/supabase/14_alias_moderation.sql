-- =============================================================================
-- Supabase layer — Alias moderation queue (14_alias_moderation.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the column and
-- policy added in sql/reef-platform-schema.sql (users table) and
-- sql/supabase/02_rls_policies.sql.
--
-- coral_aliases proposals from the /identify flow accumulate with
-- moderation_status_code = 'proposed' and nothing has ever reviewed them —
-- the spec's sitemap (§6, Admin / Moderation) always called for a queue.
-- This adds the minimal gate: a boolean on users, not a new role/entity
-- table, since only one moderation surface exists so far. Idempotent.
-- =============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_moderator boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS coral_aliases_moderator_all ON public.coral_aliases;
CREATE POLICY coral_aliases_moderator_all ON public.coral_aliases
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator))
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));
