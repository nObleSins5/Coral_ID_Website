-- =============================================================================
-- Supabase layer — Alias/catalog moderation queue (14_alias_moderation.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the column and
-- RLS additions in sql/reef-platform-schema.sql (users, husbandry_products)
-- and sql/supabase/02_rls_policies.sql.
--
-- Gap this closes: coral_aliases and husbandry_products both already had a
-- moderation_status_code (proposed/approved/rejected) but NOTHING ever
-- reviewed a 'proposed' row — no admin/moderator concept existed anywhere in
-- the schema (account_types was only hobbyist/business), and no RLS policy
-- even let anyone but the service role SELECT a non-approved row. Product
-- decision (2026-07): moderator is a boolean flag on users, independent of
-- account_type_code, so a moderator can still be a hobbyist or business
-- account at the same time (mutually-exclusive account types would have been
-- the wrong shape for a role that layers on top, not replaces, the existing
-- type). Covers both coral_aliases and husbandry_products since they share
-- the identical "proposed, never reviewed" gap (docs/schema-decisions.md
-- calls husbandry_products a catalog "parallel to coral_aliases").
-- Idempotent.
-- =============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_moderator boolean NOT NULL DEFAULT false;

-- husbandry_products never had coral_aliases' approved_by_user_id sibling —
-- add it now so both queues can record who reviewed a row the same way.
ALTER TABLE husbandry_products
    ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES users(id);

-- Moderators can see every row regardless of status (the existing
-- *_public_read policies already cover 'approved' for everyone else; this is
-- an additional, OR'd SELECT policy, not a replacement).
DROP POLICY IF EXISTS coral_aliases_moderator_read ON public.coral_aliases;
CREATE POLICY coral_aliases_moderator_read ON public.coral_aliases
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));

DROP POLICY IF EXISTS husbandry_products_moderator_read ON public.husbandry_products;
CREATE POLICY husbandry_products_moderator_read ON public.husbandry_products
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));

-- Moderators can update moderation_status_code / approved_by_user_id (the
-- app-layer action further restricts which columns actually get written).
DROP POLICY IF EXISTS coral_aliases_moderator_update ON public.coral_aliases;
CREATE POLICY coral_aliases_moderator_update ON public.coral_aliases
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator))
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));

DROP POLICY IF EXISTS husbandry_products_moderator_update ON public.husbandry_products;
CREATE POLICY husbandry_products_moderator_update ON public.husbandry_products
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator))
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));
