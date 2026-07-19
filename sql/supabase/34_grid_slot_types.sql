-- =============================================================================
-- Supabase layer — Grid slot substrate type + "not usable" flag (34_grid_slot_types.sql)
-- =============================================================================
-- grid_slots previously had no notion of what a slot physically IS (sand,
-- rock, open water, a frag rack) or whether it's usable at all (e.g. a
-- corner blocked by an overflow box) — every slot rendered identically.
-- slot_type_code stays nullable: an existing/unconfigured slot renders
-- neutral, never a forced guess (product decision, see PROGRESS.md-style
-- migrations elsewhere in this set — never force-default a color-bearing
-- classification the owner hasn't actually chosen).
--
-- grid_slots write access is already covered by the generic owner-all RLS
-- policy loop (02_rls_policies.sql) via the parent tanks.user_id, same as
-- every other grid_slots column — no new policy needed for the ALTER.
-- grid_slot_types is a plain lookup table (id_statuses/care_difficulties
-- shape) and needs its own public-read policy, added here.
-- Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS grid_slot_types (
    code  text PRIMARY KEY,
    label text NOT NULL
);
INSERT INTO grid_slot_types (code, label) VALUES
    ('sand', 'Sand'),
    ('rock', 'Rock'),
    ('open_water', 'Open water'),
    ('frag_rack', 'Frag rack')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE grid_slots
    ADD COLUMN IF NOT EXISTS slot_type_code text REFERENCES grid_slot_types(code),
    ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;

ALTER TABLE grid_slot_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grid_slot_types_public_read ON public.grid_slot_types;
CREATE POLICY grid_slot_types_public_read ON public.grid_slot_types
    FOR SELECT TO anon, authenticated USING (true);
