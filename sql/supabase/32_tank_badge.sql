-- =============================================================================
-- Supabase layer — Pastable tank badge (32_tank_badge.sql)
-- =============================================================================
-- Incremental migration for an already-live project.
--
-- Gap this closes: 28_public_tank_showcase.sql's is_public flag is business-
-- tier only (app-layer gate in setTankPublic) and publishes the WHOLE visual
-- grid. Product decision (2026-07-19): any account — hobbyist or business —
-- should be able to share a compact "current parameters + species" badge for
-- forum signatures without being forced to publish their full grid. This adds
-- a second, narrower opt-in (badge_enabled) so the two stay independent:
-- a hobbyist can enable badge_enabled without ever touching is_public, and a
-- business can keep both, either, or neither.
--
-- badge_enabled defaults false (opt-in), no account-type gate at all (unlike
-- is_public) — enforced by having NO app-layer check in setTankBadgeEnabled,
-- mirroring is_public's "app layer decides who may flip it, RLS decides what
-- is visible once flipped" split, just without the business-tier condition.
--
-- tanks/grid_slots/specimens' existing public-read policies are widened from
-- USING (is_public) to USING (is_public OR badge_enabled) — both flags share
-- the same public-visibility shape for these three tables, so one policy per
-- table still covers both features. parameter_readings gets a NEW public-read
-- policy (had none before — only needed once tank-level parameters could ever
-- be shown to a visitor, which is exactly what the badge does).
-- Idempotent.
-- =============================================================================

ALTER TABLE tanks ADD COLUMN IF NOT EXISTS badge_enabled boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS tanks_public_read ON public.tanks;
CREATE POLICY tanks_public_read ON public.tanks
    FOR SELECT TO anon, authenticated
    USING (is_public OR badge_enabled);

DROP POLICY IF EXISTS grid_slots_public_read ON public.grid_slots;
CREATE POLICY grid_slots_public_read ON public.grid_slots
    FOR SELECT TO anon, authenticated
    USING (tank_id IN (SELECT id FROM public.tanks WHERE is_public OR badge_enabled));

DROP POLICY IF EXISTS specimens_public_read ON public.specimens;
CREATE POLICY specimens_public_read ON public.specimens
    FOR SELECT TO anon, authenticated
    USING (
        deleted_at IS NULL
        AND tank_id IN (SELECT id FROM public.tanks WHERE is_public OR badge_enabled)
    );

DROP POLICY IF EXISTS parameter_readings_public_read ON public.parameter_readings;
CREATE POLICY parameter_readings_public_read ON public.parameter_readings
    FOR SELECT TO anon, authenticated
    USING (tank_id IN (SELECT id FROM public.tanks WHERE is_public OR badge_enabled));
