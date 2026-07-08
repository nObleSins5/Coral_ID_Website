-- =============================================================================
-- Supabase layer — Affiliate links (11_affiliate_links.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the
-- affiliate_links.link_type column and affiliate_link_reports table/trigger
-- added in sql/reef-platform-schema.sql (§10), plus the RLS these need.
--
-- Vendors (any authenticated user, no separate "business" onboarding
-- required for v1) upload their own listing photo via the existing
-- photo-logging feature and attach a link to it — see
-- docs/future-considerations.md idea 6a. The dead-link problem that doc
-- raised is addressed here with:
--   1. An explicit link_type (wysiwyg vs representative) so the UI can set
--      the right trust expectation (idea 1).
--   2. Community "report dead link" flagging that auto-deactivates a link
--      once enough reports come in — cheap, requires no vendor cooperation
--      (idea 3).
-- Automated health checks / TTLs (ideas 4-5) are still not built.
-- Idempotent.
-- =============================================================================

ALTER TABLE affiliate_links
    ADD COLUMN IF NOT EXISTS link_type text NOT NULL DEFAULT 'representative';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_links_link_type_check'
    ) THEN
        ALTER TABLE affiliate_links
            ADD CONSTRAINT affiliate_links_link_type_check
            CHECK (link_type IN ('wysiwyg', 'representative'));
    END IF;
END $$;

-- One report per user per link (append-only; no update/delete policy below).
CREATE TABLE IF NOT EXISTS affiliate_link_reports (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_link_id uuid NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
    user_id           uuid NOT NULL REFERENCES users(id),
    reported_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (affiliate_link_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_affiliate_link_reports_link
    ON affiliate_link_reports (affiliate_link_id);

INSERT INTO app_settings (key, value, description) VALUES
    ('affiliate_dead_link_report_threshold', '3'::jsonb,
     'Number of distinct-user "report dead link" flags before a link auto-deactivates (is_active = false).')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION handle_affiliate_link_report() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_link_id   uuid := NEW.affiliate_link_id;
    v_count     integer;
    v_threshold integer;
BEGIN
    SELECT COUNT(*) INTO v_count
        FROM affiliate_link_reports WHERE affiliate_link_id = v_link_id;
    SELECT (value #>> '{}')::integer INTO v_threshold
        FROM app_settings WHERE key = 'affiliate_dead_link_report_threshold';

    IF v_count >= v_threshold THEN
        UPDATE affiliate_links SET is_active = false WHERE id = v_link_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_link_reports_check ON affiliate_link_reports;
CREATE TRIGGER trg_affiliate_link_reports_check
    AFTER INSERT ON affiliate_link_reports
    FOR EACH ROW EXECUTE FUNCTION handle_affiliate_link_report();

-- Owner-write on affiliate_links, scoped via the underlying photo (only the
-- photo's own uploader manages links on it). Public read of active links
-- already exists (affiliate_links_public_read, 02_rls_policies.sql); this
-- adds a second, independent policy so the owner can also see/manage their
-- own inactive (deactivated / reported-off) links — Postgres RLS policies
-- for the same command are OR'd together.
DROP POLICY IF EXISTS affiliate_links_owner_write ON public.affiliate_links;
CREATE POLICY affiliate_links_owner_write ON public.affiliate_links
    FOR ALL TO authenticated
    USING (coral_photo_id IN (SELECT id FROM public.coral_photos WHERE uploader_user_id = auth.uid()))
    WITH CHECK (coral_photo_id IN (SELECT id FROM public.coral_photos WHERE uploader_user_id = auth.uid()));

CREATE POLICY affiliate_link_reports_insert ON public.affiliate_link_reports
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY affiliate_link_reports_select_own ON public.affiliate_link_reports
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Click-log insert (append-only; no SELECT policy — reconciliation is a
-- service-role/admin concern, not exposed to the app). anon and
-- authenticated may both log a click; user_id must be absent or their own.
CREATE POLICY affiliate_clicks_insert ON public.affiliate_clicks
    FOR INSERT TO anon, authenticated
    WITH CHECK (user_id IS NULL OR user_id = auth.uid());
