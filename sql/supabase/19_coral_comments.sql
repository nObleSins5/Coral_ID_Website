-- =============================================================================
-- Supabase layer — Per-coral comment board (19_coral_comments.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the same
-- tables/trigger/RLS in sql/reef-platform-schema.sql.
--
-- docs/future-considerations.md, "Idea 3" — a simple, flat (not threaded)
-- discussion thread on each morph page, strongly moderated. Product
-- decision (2026-07-11): post-publish, not pre-publish like coral_aliases/
-- husbandry_products — a comment goes live immediately (low friction, this
-- is meant to be casual engagement), but any user can report one, and
-- enough reports auto-hides it pending review — the exact same reactive
-- shape as affiliate_link_reports / handle_affiliate_link_report()
-- (11_affiliate_links.sql). A moderator can also hide/restore/delete
-- directly from /moderate. No threading (no parent_comment_id) — flat,
-- newest-last, per the same explicit decision.
-- Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS coral_comments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    taxon_node_id     uuid NOT NULL REFERENCES taxon_nodes(id) ON DELETE CASCADE,
    user_id           uuid NOT NULL REFERENCES users(id),
    body              text NOT NULL CHECK (char_length(btrim(body)) > 0 AND char_length(body) <= 2000),
    -- true once auto-hidden by report threshold OR hidden by a moderator;
    -- hidden_by_user_id is null for the former, set for the latter.
    is_hidden         boolean NOT NULL DEFAULT false,
    hidden_by_user_id uuid REFERENCES users(id),
    created_at        timestamptz NOT NULL DEFAULT now(),
    deleted_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_coral_comments_taxon
    ON coral_comments (taxon_node_id, created_at);

-- One report per user per comment (append-only; no update/delete policy below).
CREATE TABLE IF NOT EXISTS coral_comment_reports (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id  uuid NOT NULL REFERENCES coral_comments(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id),
    reported_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_coral_comment_reports_comment
    ON coral_comment_reports (comment_id);

INSERT INTO app_settings (key, value, description) VALUES
    ('coral_comment_report_threshold', '3'::jsonb,
     'Number of distinct-user reports before a comment auto-hides (is_hidden = true), pending moderator review.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION handle_coral_comment_report() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_comment_id uuid := NEW.comment_id;
    v_count      integer;
    v_threshold  integer;
BEGIN
    SELECT COUNT(*) INTO v_count
        FROM coral_comment_reports WHERE comment_id = v_comment_id;
    SELECT (value #>> '{}')::integer INTO v_threshold
        FROM app_settings WHERE key = 'coral_comment_report_threshold';

    IF v_count >= v_threshold THEN
        UPDATE coral_comments SET is_hidden = true WHERE id = v_comment_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coral_comment_reports_check ON coral_comment_reports;
CREATE TRIGGER trg_coral_comment_reports_check
    AFTER INSERT ON coral_comment_reports
    FOR EACH ROW EXECUTE FUNCTION handle_coral_comment_report();

-- RLS. coral_comments/coral_comment_reports both need RLS enabled — they're
-- new tables, not covered by 02_rls_policies.sql's default-deny loop (which
-- only ran once, at initial setup, over the tables that existed then).
ALTER TABLE coral_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coral_comment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coral_comments_public_read ON public.coral_comments;
CREATE POLICY coral_comments_public_read ON public.coral_comments
    FOR SELECT TO anon, authenticated
    USING (NOT is_hidden AND deleted_at IS NULL);

-- A user can always see their OWN comment, even hidden/deleted — same
-- reasoning as husbandry_products_owner_read (17_husbandry_logging.sql).
DROP POLICY IF EXISTS coral_comments_owner_read ON public.coral_comments;
CREATE POLICY coral_comments_owner_read ON public.coral_comments
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS coral_comments_moderator_read ON public.coral_comments;
CREATE POLICY coral_comments_moderator_read ON public.coral_comments
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));

DROP POLICY IF EXISTS coral_comments_auth_insert ON public.coral_comments;
CREATE POLICY coral_comments_auth_insert ON public.coral_comments
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Owner can soft-delete their own comment (app layer only ever writes
-- deleted_at via this policy, not body/is_hidden).
DROP POLICY IF EXISTS coral_comments_owner_delete ON public.coral_comments;
CREATE POLICY coral_comments_owner_delete ON public.coral_comments
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS coral_comments_moderator_update ON public.coral_comments;
CREATE POLICY coral_comments_moderator_update ON public.coral_comments
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator))
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));

DROP POLICY IF EXISTS coral_comment_reports_insert ON public.coral_comment_reports;
CREATE POLICY coral_comment_reports_insert ON public.coral_comment_reports
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS coral_comment_reports_select_own ON public.coral_comment_reports;
CREATE POLICY coral_comment_reports_select_own ON public.coral_comment_reports
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());
