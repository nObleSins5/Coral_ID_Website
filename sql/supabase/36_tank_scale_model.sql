-- =============================================================================
-- Supabase layer — Tank scale model / calibrated photo placement (36_tank_scale_model.sql)
-- =============================================================================
-- Incremental migration for an already-live project. Introduces the
-- "calibrated photo of the actual tank" placement model designed in
-- docs/tank-scale-model-brief.md, which coexists opt-in with the existing
-- grid_slots layout — nothing here touches grid_slots or existing placements.
--
-- Fork decisions baked in (brief §4):
--   1. COEXIST, OPT-IN. tanks.placement_mode gates which model a tank uses;
--      defaults 'grid', so every existing tank keeps its current behaviour.
--      grid_slots is NOT retired here.
--   2. CONTINUOUS coordinates. A placement stores a real (x,y,z) position, not
--      a cell reference — no one-per-cell uniqueness constraint.
--   3. NESTED SCENES ARE PHASE 2, schema-ready only. tank_scenes carries
--      parent_scene_id + kind so a later detail-scene tree is additive; v1 code
--      only ever writes kind='tank', parent_scene_id=NULL.
--   4. Canonical unit is MILLIMETRES. Inches are a display conversion only
--      (mm / 25.4), never a second column, so the two units can't drift.
--
-- RLS: all three tables are owned via the parent tank -> tanks.user_id, the
-- same tank-scoped owner-all shape as grid_slots (02_rls_policies.sql §4), plus
-- additional public-read policies scoped to is_public tanks so the showcase
-- page can render a published scene (mirrors 28_public_tank_showcase.sql).
-- Idempotent.
-- =============================================================================

-- Which placement model this tank uses. 'grid' keeps the legacy grid_slots UI;
-- 'scene' opts into the calibrated-photo model below. Default 'grid' so live
-- tanks are untouched.
ALTER TABLE tanks
    ADD COLUMN IF NOT EXISTS placement_mode text NOT NULL DEFAULT 'grid'
        CHECK (placement_mode IN ('grid', 'scene'));

-- A calibrated coordinate space. In v1 there is exactly one per scene-mode tank
-- (kind='tank'). parent_scene_id + kind='detail' are the phase-2 seam for the
-- nested close-up scenes that resolve dense clusters (brief §7) — always
-- NULL/'tank' in v1. Dimensions are the known real-world size of what the scene
-- frames, in millimetres.
CREATE TABLE IF NOT EXISTS tank_scenes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id         uuid NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
    parent_scene_id uuid REFERENCES tank_scenes(id) ON DELETE CASCADE,  -- phase-2; NULL in v1
    kind            text NOT NULL DEFAULT 'tank' CHECK (kind IN ('tank', 'detail')),
    width_mm        numeric,   -- X extent (left-right)
    height_mm       numeric,   -- Y extent (up-down)
    depth_mm        numeric,   -- Z extent (front-back)
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tank_scenes_tank ON tank_scenes (tank_id);
CREATE INDEX IF NOT EXISTS idx_tank_scenes_parent ON tank_scenes (parent_scene_id);

-- The calibrated photo(s) for a scene. 'front' (face-on) is the primary canvas;
-- 'side' calibrates the depth scale the placement slider uses (it is an aid,
-- not a source of truth — rockwork occludes most of the tank from the side,
-- brief §5); 'top' is a deferred, optional cross-check. calibration stores the
-- pixel<->mm mapping (marked reference points and/or derived transform); exact
-- shape is settled in the app layer, hence jsonb.
CREATE TABLE IF NOT EXISTS scene_views (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id    uuid NOT NULL REFERENCES tank_scenes(id) ON DELETE CASCADE,
    facing      text NOT NULL CHECK (facing IN ('front', 'side', 'top')),
    image_path  text NOT NULL,   -- storage key, same bucket/pattern as coral photos
    calibration jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    -- One photo per facing per scene; re-shooting a facing UPDATEs in place.
    UNIQUE (scene_id, facing)
);
CREATE INDEX IF NOT EXISTS idx_scene_views_scene ON scene_views (scene_id);

-- A specimen's continuous position within a scene, in scene-local millimetres.
-- Replaces specimens.grid_slot_id for scene-mode tanks (grid_slot_id stays as-is
-- for grid-mode tanks). No uniqueness on coordinates — pins may sit anywhere,
-- including overlapping at low zoom (the phase-2 detail scene is what separates
-- a dense cluster). One placement row per specimen per scene.
CREATE TABLE IF NOT EXISTS specimen_placements (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id    uuid NOT NULL REFERENCES tank_scenes(id) ON DELETE CASCADE,
    specimen_id uuid NOT NULL REFERENCES specimens(id) ON DELETE CASCADE,
    x_mm        numeric NOT NULL,   -- left-right, from scene's left edge
    y_mm        numeric NOT NULL,   -- up-down, from scene's bottom (substrate)
    z_mm        numeric NOT NULL,   -- front-back, from front glass (depth)
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (scene_id, specimen_id)
);
CREATE INDEX IF NOT EXISTS idx_specimen_placements_scene ON specimen_placements (scene_id);
CREATE INDEX IF NOT EXISTS idx_specimen_placements_specimen ON specimen_placements (specimen_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE tank_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE specimen_placements ENABLE ROW LEVEL SECURITY;

-- Owner-all: tank_scenes is directly tank-scoped, same shape as grid_slots.
DROP POLICY IF EXISTS tank_scenes_owner_all ON public.tank_scenes;
CREATE POLICY tank_scenes_owner_all ON public.tank_scenes
    FOR ALL TO authenticated
    USING (tank_id IN (SELECT id FROM public.tanks WHERE user_id = auth.uid()))
    WITH CHECK (tank_id IN (SELECT id FROM public.tanks WHERE user_id = auth.uid()));

-- Owner-all: scene_views owned via scene -> tank.
DROP POLICY IF EXISTS scene_views_owner_all ON public.scene_views;
CREATE POLICY scene_views_owner_all ON public.scene_views
    FOR ALL TO authenticated
    USING (scene_id IN (
        SELECT s.id FROM public.tank_scenes s
        JOIN public.tanks t ON t.id = s.tank_id
        WHERE t.user_id = auth.uid()))
    WITH CHECK (scene_id IN (
        SELECT s.id FROM public.tank_scenes s
        JOIN public.tanks t ON t.id = s.tank_id
        WHERE t.user_id = auth.uid()));

-- Owner-all: specimen_placements owned via scene -> tank.
DROP POLICY IF EXISTS specimen_placements_owner_all ON public.specimen_placements;
CREATE POLICY specimen_placements_owner_all ON public.specimen_placements
    FOR ALL TO authenticated
    USING (scene_id IN (
        SELECT s.id FROM public.tank_scenes s
        JOIN public.tanks t ON t.id = s.tank_id
        WHERE t.user_id = auth.uid()))
    WITH CHECK (scene_id IN (
        SELECT s.id FROM public.tank_scenes s
        JOIN public.tanks t ON t.id = s.tank_id
        WHERE t.user_id = auth.uid()));

-- Public read for the showcase page: scoped to is_public tanks, mirroring the
-- grid_slots/specimens public-read policies in 28_public_tank_showcase.sql.
-- Additional permissive SELECT policies OR'd with the owner-all policies above,
-- so owners keep seeing their private scenes exactly as before.
DROP POLICY IF EXISTS tank_scenes_public_read ON public.tank_scenes;
CREATE POLICY tank_scenes_public_read ON public.tank_scenes
    FOR SELECT TO anon, authenticated
    USING (tank_id IN (SELECT id FROM public.tanks WHERE is_public));

DROP POLICY IF EXISTS scene_views_public_read ON public.scene_views;
CREATE POLICY scene_views_public_read ON public.scene_views
    FOR SELECT TO anon, authenticated
    USING (scene_id IN (
        SELECT s.id FROM public.tank_scenes s
        JOIN public.tanks t ON t.id = s.tank_id
        WHERE t.is_public));

DROP POLICY IF EXISTS specimen_placements_public_read ON public.specimen_placements;
CREATE POLICY specimen_placements_public_read ON public.specimen_placements
    FOR SELECT TO anon, authenticated
    USING (scene_id IN (
        SELECT s.id FROM public.tank_scenes s
        JOIN public.tanks t ON t.id = s.tank_id
        WHERE t.is_public));
