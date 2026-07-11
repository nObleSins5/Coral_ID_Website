-- =============================================================================
-- Supabase layer — Husbandry/equipment logging RLS gap fix (17_husbandry_logging.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the same policy
-- addition in sql/supabase/02_rls_policies.sql.
--
-- equipment, dosing_methods, tank_additives, equipment_levels, and
-- equipment_events already had owner-scoped RLS from the original schema
-- build (02_rls_policies.sql §4/owner-scoped array + the equipment-scoped
-- loop) — nothing new needed there. The one real gap, only surfaced now that
-- an app UI actually exercises this path: husbandry_products_public_read only
-- covers moderation_status_code = 'approved' rows, so a user who proposes a
-- brand-new product inline while logging a dosing method or tank additive
-- couldn't read their OWN row back afterward to display its name — only a
-- moderator could see it, via husbandry_products_moderator_read
-- (14_alias_moderation.sql). This adds the missing owner-read policy.
-- Idempotent.
-- =============================================================================

DROP POLICY IF EXISTS husbandry_products_owner_read ON public.husbandry_products;
CREATE POLICY husbandry_products_owner_read ON public.husbandry_products
    FOR SELECT TO authenticated
    USING (added_by_user_id = auth.uid());
