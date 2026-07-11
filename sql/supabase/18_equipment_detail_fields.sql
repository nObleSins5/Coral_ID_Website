-- =============================================================================
-- Supabase layer — Flow/light equipment detail fields (18_equipment_detail_fields.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the same
-- ADD COLUMNs in sql/reef-platform-schema.sql.
--
-- Splits the generic "Equipment" logging form into real Flow and Light
-- sections per explicit product feedback (2026-07-11) on the first pass of
-- /tank/[id]/husbandry. All new columns are nullable and shared on the one
-- `equipment` table rather than per-type subtables, matching this schema's
-- existing convention of one shared table with type-specific nullable
-- columns (e.g. tank_additives' deferred dose fields).
--
-- - placement: shared by both — flow's "right/left/back" position in the
--   tank and light's "slot #" position are both just where the thing sits.
-- - flow_pattern: flow-only (pulsing/wave_crest/random/laminar/other).
-- - light_mode, peak_hours, wattage: light-only.
--
-- No new RLS needed — equipment's existing owner-scoped policy
-- (02_rls_policies.sql) is row-level via tank ownership, not column-scoped.
-- Idempotent.
-- =============================================================================

ALTER TABLE equipment
    ADD COLUMN IF NOT EXISTS placement text,
    ADD COLUMN IF NOT EXISTS flow_pattern text
        CHECK (flow_pattern IN ('pulsing', 'wave_crest', 'random', 'laminar', 'other')),
    ADD COLUMN IF NOT EXISTS light_mode text
        CHECK (light_mode IN ('ramping', 'on_off')),
    ADD COLUMN IF NOT EXISTS peak_hours numeric,
    ADD COLUMN IF NOT EXISTS wattage numeric;
