-- =============================================================================
-- Supabase layer — Anatomy template refinements (29_anatomy_template_refinements.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the same
-- tables/columns/seed data in sql/coral_trait_schema.sql.
--
-- Two real corrections from user feedback while shaping the identify
-- funnel's anatomy-aware color step-through (web/lib/anatomy-steps.ts):
--
-- 1. `branching_sps` gets a `tentacle` position. SPS polyp tentacles aren't
--    usually shown extended in trade photos, but their color still
--    contributes to the coral's overall look, so it's a real step in the
--    funnel/moderator entry, not a faked one.
-- 2. New `bubble_tip` element type, added to `mushroom_coral`. Some
--    mushrooms show a distinct bubble-textured patch on the skirt; most
--    don't — the funnel/moderator UI must be able to mark this step
--    "not on this coral" rather than force a color pick (see the
--    `optional` flag on AnatomyStep in web/lib/anatomy-steps.ts).
--
-- Idempotent.
-- =============================================================================

INSERT INTO element_types (code, label, allows_color, allows_shape, allows_size, allows_texture, sort_order) VALUES
    ('bubble_tip', 'Bubble on skirt', true, false, false, true, 16)
ON CONFLICT (code) DO NOTHING;

INSERT INTO anatomy_template_elements (template_code, element_type_code, sort_order) VALUES
    ('branching_sps',  'tentacle',   5),
    ('mushroom_coral', 'bubble_tip', 5)
ON CONFLICT (template_code, element_type_code) DO NOTHING;
