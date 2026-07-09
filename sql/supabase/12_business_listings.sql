-- =============================================================================
-- Supabase layer — Business-tier listing fields (12_business_listings.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the listing
-- fields and tightened RLS added in sql/reef-platform-schema.sql (§10) and
-- sql/supabase/02_rls_policies.sql.
--
-- Product decision (2026-07): affiliate links are a BUSINESS-tier feature —
-- only users.account_type_code = 'business' may attach one, via a separate
-- managed dashboard (/business) listing all of their submissions. Hobbyist-
-- to-hobbyist trade/sale flagging uses a similar shape but is intentionally
-- NOT built yet (needs messaging + zip search first, per docs/PROGRESS.md).
-- Idempotent.
-- =============================================================================

ALTER TABLE affiliate_links
    ADD COLUMN IF NOT EXISTS for_sale_or_trade boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS price numeric,
    ADD COLUMN IF NOT EXISTS hidden_by_owner boolean NOT NULL DEFAULT false,
    -- Reserved for a future paid "sticky to front of page" placement. No UI
    -- surfaces this yet — the column exists now so the dashboard table shape
    -- doesn't need another migration when that ships.
    ADD COLUMN IF NOT EXISTS promote boolean NOT NULL DEFAULT false;

-- Public read must not leak listings the owner has hidden from their own
-- dashboard view.
DROP POLICY IF EXISTS affiliate_links_public_read ON public.affiliate_links;
CREATE POLICY affiliate_links_public_read ON public.affiliate_links
    FOR SELECT TO anon, authenticated
    USING (is_active AND deleted_at IS NULL AND NOT hidden_by_owner);

-- Tighten owner-write to business-tier accounts only (was: any photo
-- uploader). Still scoped to the caller's own photos.
DROP POLICY IF EXISTS affiliate_links_owner_write ON public.affiliate_links;
CREATE POLICY affiliate_links_owner_write ON public.affiliate_links
    FOR ALL TO authenticated
    USING (
        coral_photo_id IN (SELECT id FROM public.coral_photos WHERE uploader_user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type_code = 'business')
    )
    WITH CHECK (
        coral_photo_id IN (SELECT id FROM public.coral_photos WHERE uploader_user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type_code = 'business')
    );
