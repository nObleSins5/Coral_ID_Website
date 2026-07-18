-- =============================================================================
-- Supabase layer — Public tank showcase (28_public_tank_showcase.sql)
-- =============================================================================
-- Incremental migration for an already-live project.
--
-- Gap this closes: tanks/grid_slots/specimens are owner-only under
-- 02_rls_policies.sql's default loop — there was no way for anyone but the
-- owner to see a tank's grid at all. Product decision (2026-07-18): a
-- business account should be able to publish its tank's grid as a public,
-- read-only showcase page (see app/showcase/[id]/page.tsx) — "here's what's
-- in our display tank, linked to the real community wiki page and
-- parameters for each coral" — without opening up hobbyist tanks by default.
--
-- is_public defaults false (opt-in, matches affiliate_links' hidden_by_owner
-- default-safe pattern). Business-tier gating on WHO may flip it true is
-- enforced in the app layer (app/tank/actions.ts's setTankPublic, mirroring
-- requireModerator()-style checks elsewhere in this codebase) rather than in
-- RLS — Postgres RLS has no column-level granularity, and the existing
-- owner-ALL policy from the 02_rls_policies.sql loop already lets an owner
-- update every other column on their own tank row; adding a second,
-- narrower UPDATE policy here would only duplicate that grant, not restrict
-- it further.
--
-- grid_slots/specimens public-read policies below are ADDITIONAL permissive
-- SELECT policies alongside the existing owner-only ones from
-- 02_rls_policies.sql's loop — Postgres OR's multiple permissive policies
-- together, so the owner keeps seeing their own private tanks exactly as
-- before. coral_photos needs no new policy: coral_photos_public_read
-- (09_unidentified_id_flow.sql) already scopes public photo access to
-- is_public = true, which is also what keeps a quickAddLocal-style private
-- specimen's photo out of a showcase even if its tank is public.
-- Idempotent.
-- =============================================================================

ALTER TABLE tanks ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS tanks_public_read ON public.tanks;
CREATE POLICY tanks_public_read ON public.tanks
    FOR SELECT TO anon, authenticated
    USING (is_public);

DROP POLICY IF EXISTS grid_slots_public_read ON public.grid_slots;
CREATE POLICY grid_slots_public_read ON public.grid_slots
    FOR SELECT TO anon, authenticated
    USING (tank_id IN (SELECT id FROM public.tanks WHERE is_public));

DROP POLICY IF EXISTS specimens_public_read ON public.specimens;
CREATE POLICY specimens_public_read ON public.specimens
    FOR SELECT TO anon, authenticated
    USING (
        deleted_at IS NULL
        AND tank_id IN (SELECT id FROM public.tanks WHERE is_public)
    );
