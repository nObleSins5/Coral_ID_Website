-- =============================================================================
-- Supabase layer — Decouple color from anatomy position (22_decouple_color_from_elements.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the same
-- tables/columns/seed data now baked directly into coral_trait_schema.sql
-- (the source of truth for fresh installs).
--
-- Gap this closes (raised 2026-07-12, working from a reference zoanthid
-- color-guide chart): requiring a user or moderator to know "skirt" vs.
-- "radial corallite" vs. "coenosarc" before recording or comparing a color
-- is unnecessarily technical, and the rigid element_profiles->color_ranges
-- hierarchy forced unrelated regions into one element (a zoa's face+skirt
-- were one `mouth_oral_disc` row with a 2-stop "range" pattern, rendering as
-- a gradient blend instead of two distinct solid regions). color_ranges now
-- hangs directly off the taxon; position_label is an optional, suggested
-- hint (not a required checklist item) rather than a hard FK through
-- element_profiles. element_profiles itself is untouched and still exists
-- for genuine morphology capture (shape/texture/size).
--
-- Also retires `polyp` as a position (a polyp is tentacle + mouth, which
-- can differ in color — never one element) and splits the old catch-all
-- `polyp_soft` anatomy template into four templates that actually match
-- zoanthid/paly, mushroom, leather, and matting-soft-coral anatomy.
-- Idempotent.
-- =============================================================================

-- --- 1. color_ranges: hang directly off the taxon -----------------------

ALTER TABLE color_ranges
    ADD COLUMN IF NOT EXISTS taxon_node_id  uuid REFERENCES taxon_nodes(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS position_label text REFERENCES element_types(code),
    ADD COLUMN IF NOT EXISTS approx_percent numeric;

ALTER TABLE color_ranges
    DROP CONSTRAINT IF EXISTS color_ranges_approx_percent_check;
ALTER TABLE color_ranges
    ADD CONSTRAINT color_ranges_approx_percent_check
        CHECK (approx_percent IS NULL OR (approx_percent >= 0 AND approx_percent <= 100));

-- Backfill from the existing element_profiles link, then make it nullable
-- (kept only for the rare case morphology data needs linking back to a
-- specific color; no longer required for color to exist).
UPDATE color_ranges cr
SET taxon_node_id = ep.taxon_node_id,
    position_label = ep.element_type_code
FROM element_profiles ep
WHERE cr.element_profile_id = ep.id
  AND cr.taxon_node_id IS NULL;

ALTER TABLE color_ranges ALTER COLUMN taxon_node_id SET NOT NULL;
ALTER TABLE color_ranges ALTER COLUMN element_profile_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_color_ranges_taxon ON color_ranges (taxon_node_id);

-- --- 2. New element_types (suggested position labels only) --------------

INSERT INTO element_types (code, label, allows_color, allows_shape, allows_size, allows_texture, sort_order) VALUES
    ('oral_disc_center', 'Oral disc / face (center)', true, false, false, false, 11),
    ('skirt_1',          'Skirt color 1',             true, false, false, false, 12),
    ('skirt_2',          'Skirt color 2',             true, false, false, false, 13),
    ('skirt_3',          'Skirt color 3',             true, false, false, false, 14),
    ('stalk',            'Stalk / capitulum base',    true, false, false, false, 15)
ON CONFLICT (code) DO NOTHING;

-- --- 3. Mushroom-specific texture flag -----------------------------------

ALTER TABLE taxon_nodes ADD COLUMN IF NOT EXISTS has_bubble_texture boolean;

-- --- 4. New anatomy templates + suggested elements -----------------------
-- polyp_soft is retired (relabeled, left in place — taxon_nodes FKs into it
-- and old rows shouldn't need a cascade) rather than dropped.

UPDATE anatomy_templates SET label = 'Polyp-based soft coral / zoanthid (retired)'
WHERE code = 'polyp_soft';

INSERT INTO anatomy_templates (code, label, sort_order) VALUES
    ('zoanthid_paly',      'Zoanthid / palythoa', 5),
    ('mushroom_coral',     'Mushroom coral (disc)', 6),
    ('leather_soft_coral', 'Leather soft coral (stalk + cap)', 7),
    ('mat_soft_coral',     'Matting/encrusting soft coral', 8)
ON CONFLICT (code) DO NOTHING;

INSERT INTO anatomy_template_elements (template_code, element_type_code, sort_order) VALUES
    ('zoanthid_paly',      'oral_disc_center', 1),
    ('zoanthid_paly',      'tentacle',         2),
    ('zoanthid_paly',      'skirt_1',          3),
    ('zoanthid_paly',      'skirt_2',          4),
    ('zoanthid_paly',      'skirt_3',          5),
    ('mushroom_coral',     'oral_disc_center', 1),
    ('mushroom_coral',     'skirt_1',          2),
    ('mushroom_coral',     'skirt_2',          3),
    ('mushroom_coral',     'skirt_3',          4),
    ('leather_soft_coral', 'stalk',            1),
    ('leather_soft_coral', 'base_body',        2),
    ('leather_soft_coral', 'tentacle',         3),
    ('mat_soft_coral',     'base_body',        1),
    ('mat_soft_coral',     'tentacle',         2)
ON CONFLICT (template_code, element_type_code) DO NOTHING;

-- --- 5. Reassign genera to their real anatomy template -------------------

UPDATE taxon_nodes SET anatomy_template_code = 'zoanthid_paly' WHERE rank_code = 'genus' AND slug IN
    ('zoanthus', 'palythoa');
UPDATE taxon_nodes SET anatomy_template_code = 'mushroom_coral' WHERE rank_code = 'genus' AND slug IN
    ('discosoma', 'rhodactis', 'ricordea');
UPDATE taxon_nodes SET anatomy_template_code = 'leather_soft_coral' WHERE rank_code = 'genus' AND slug IN
    ('sarcophyton', 'sinularia');
UPDATE taxon_nodes SET anatomy_template_code = 'mat_soft_coral' WHERE rank_code = 'genus' AND slug IN
    ('briareum', 'xenia', 'clavularia');

-- --- 6. Retire `polyp` as a position — reassign existing rows to `tentacle` -

UPDATE color_ranges SET position_label = 'tentacle' WHERE position_label = 'polyp';

-- RLS: color_ranges_public_read (02_rls_policies.sql) is a blanket
-- USING (true) unrelated to element_profile_id, so it's unaffected by the
-- new nullable column. New element_types/anatomy_templates rows are
-- covered by the existing public-read policies on those tables.
