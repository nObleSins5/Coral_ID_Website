-- =============================================================================
-- Supabase layer — Moderator write access for color_ranges/color_stops (27_color_moderation.sql)
-- =============================================================================
-- Every canonical color on the site (including the Rasta Zoanthid correction,
-- 25_correct_rasta_zoa_colors.sql) has only ever been written via a migration
-- run with elevated access — color_ranges/color_stops have had a public READ
-- policy since 02_rls_policies.sql, but never a write policy for anyone.
-- This is the first UI-based color-entry path the product has had (see
-- docs/color-percent-feature-brief.md); a moderator (users.is_moderator,
-- independent of account_type_code — sql/supabase/14_alias_moderation.sql)
-- can now add/edit/delete a taxon's documented colors directly from
-- /moderate, instead of every correction needing a hand-written migration.
--
-- FOR ALL (not just UPDATE, unlike the coral_aliases/husbandry_products
-- moderator policies) because unlike those tables — which only ever review
-- an already-existing proposed row — color entry needs INSERT (a brand-new
-- color for a taxon with none yet) and DELETE (retiring a wrong entry) too.
-- Idempotent (DROP POLICY IF EXISTS guards); mirrored into
-- sql/supabase/02_rls_policies.sql for from-scratch installs.
-- =============================================================================

DROP POLICY IF EXISTS color_ranges_moderator_write ON public.color_ranges;
CREATE POLICY color_ranges_moderator_write ON public.color_ranges
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator))
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));

DROP POLICY IF EXISTS color_stops_moderator_write ON public.color_stops;
CREATE POLICY color_stops_moderator_write ON public.color_stops
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator))
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));
