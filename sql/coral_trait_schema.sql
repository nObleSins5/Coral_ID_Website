-- =============================================================================
-- Reef Platform — Coral Trait & Naming Schema (coral_trait_schema.sql)
-- =============================================================================
-- Companion to reef-platform-schema.sql. This file owns the WIKI ENTRY itself:
-- the universal reef-organism naming hierarchy plus the coral identification
-- trait profiles (elements, colors, morphology) and care guidance.
--
--   * coral_trait_schema.sql (this file) -> taxon_nodes (naming tree),
--       element_profiles, color_ranges/color_stops, care guidance,
--       reference images, recommended products.
--   * reef-platform-schema.sql -> users, tanks, specimens, photos, etc.
--
-- LOAD ORDER: apply THIS file FIRST, then reef-platform-schema.sql. The platform
-- file's final "Cross-schema foreign keys" section references taxon_nodes,
-- which is created here.
--
-- Naming tree design:
--   * taxon_nodes is self-referencing and UNIVERSAL across reef organisms.
--     The top rank is `category` (Coral, Fish, Invertebrate, Plant, Other) so
--     the tree is not coral-specific; Coral is just one category node.
--   * The coral trait tables below attach only to nodes in the Coral subtree.
--     Other organism types (e.g. Fish) would get their own trait tables later;
--     they share taxon_nodes but not element_profiles/color_ranges.
--
-- Cross-file links that are intentionally SOFT (uuid column, no enforced FK, to
-- avoid a circular dependency between the two SQL files):
--   * color_stops.source_photo_id      -> coral_photos(id)      (platform file)
--   * taxon_recommended_products.product_id -> husbandry_products(id) (platform)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy name search

-- Shared with reef-platform-schema.sql; CREATE OR REPLACE is safe either order.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. Lookup / controlled-vocabulary tables
-- =============================================================================

-- Ranks are ordered by depth so the tree can be walked/rendered generically.
-- category(1) -> genus(2) -> species(3) -> morph(4). Fish, if ever added, get
-- their own rank values (e.g. family/variant) without disturbing these.
CREATE TABLE ranks (
    code  text PRIMARY KEY,
    depth smallint NOT NULL,
    label text NOT NULL
);
INSERT INTO ranks (code, depth, label) VALUES
    ('category', 1, 'Category'),
    ('genus',    2, 'Genus'),
    ('species',  3, 'Species'),
    ('morph',    4, 'Hobbyist morph');

-- Identifiable coral parts. Flags tell the UI which trait inputs to show.
CREATE TABLE element_types (
    code           text PRIMARY KEY,
    label          text NOT NULL,
    allows_color   boolean NOT NULL DEFAULT false,
    allows_shape   boolean NOT NULL DEFAULT false,
    allows_size    boolean NOT NULL DEFAULT false,
    allows_texture boolean NOT NULL DEFAULT false,
    sort_order     smallint NOT NULL DEFAULT 0
);
INSERT INTO element_types (code, label, allows_color, allows_shape, allows_size, allows_texture, sort_order) VALUES
    ('corallite',        'Corallite (cup / calyx)',            true,  true,  false, false, 1),
    ('axial_corallite',  'Axial corallite (growth-tip cup)',   true,  true,  false, false, 2),
    ('radial_corallite', 'Radial corallite (branch-side cup)', true,  true,  false, false, 3),
    ('polyp',            'Polyp',                              true,  false, true,  false, 4),
    ('tentacle',         'Tentacle / tips',                    true,  false, false, false, 5),
    ('mouth_oral_disc',  'Mouth / oral disc',                  true,  false, false, false, 6),
    ('coenosarc_skin',   'Coenosarc / skin (tissue)',          true,  false, false, true,  7),
    ('base_body',        'Base / body',                        true,  false, false, false, 8),
    ('growth_tip',       'Growth tip / growing edge',          true,  false, false, false, 9),
    ('surface_texture',  'Surface texture (verrucae/papillae)',false, false, false, true, 10),
    -- Added for the zoanthid/paly/mushroom/soft-coral anatomy realignment
    -- (2026-07). "polyp" is retired as a position (a polyp is tentacle +
    -- mouth, which can differ in color — never one element); these replace
    -- it with the loose, beginner-friendly regions hobbyists actually see.
    ('oral_disc_center', 'Oral disc / face (center)',          true,  false, false, false, 11),
    ('skirt_1',          'Skirt color 1',                      true,  false, false, false, 12),
    ('skirt_2',          'Skirt color 2',                      true,  false, false, false, 13),
    ('skirt_3',          'Skirt color 3',                      true,  false, false, false, 14),
    ('stalk',            'Stalk / capitulum base',              true,  false, false, false, 15);

-- Colony-level morphology (describes the whole colony, not one colored part).
CREATE TABLE growth_forms (
    code       text PRIMARY KEY,
    label      text NOT NULL,
    sort_order smallint NOT NULL DEFAULT 0
);
INSERT INTO growth_forms (code, label, sort_order) VALUES
    ('branching',      'Branching',        1),
    ('encrusting',     'Encrusting',       2),
    ('plating_laminar','Plating / laminar',3),
    ('massive',        'Massive',          4),
    ('columnar',       'Columnar',         5),
    ('tabling',        'Tabling',          6),
    ('foliose',        'Foliose',          7),
    ('digitate',       'Digitate',         8),
    ('submassive',     'Submassive',       9);

-- Which of the element_types above actually apply to a given coral's real
-- anatomy — assigned at the GENUS level (anatomy is a genus property, not a
-- morph one). Standardizes the element color key instead of each morph
-- freely logging whatever single element happened to get picked at seed
-- time — see sql/supabase/20_anatomy_templates.sql.
CREATE TABLE anatomy_templates (
    code       text PRIMARY KEY,
    label      text NOT NULL,
    sort_order smallint NOT NULL DEFAULT 0
);
INSERT INTO anatomy_templates (code, label, sort_order) VALUES
    ('branching_sps',     'Branching/SPS', 1),
    ('lps_corallite',     'LPS with corallite', 2),
    ('lps_tentacled',     'Tentacled LPS', 3),
    -- Retired 2026-07: was a catch-all for zoanthids, mushrooms, and soft
    -- corals alike, which don't share an anatomy. Left in place (unused,
    -- not dropped) rather than deleted, since taxon_nodes FKs into it and
    -- old rows shouldn't need a cascade.
    ('polyp_soft',        'Polyp-based soft coral / zoanthid (retired)', 4),
    ('zoanthid_paly',     'Zoanthid / palythoa', 5),
    ('mushroom_coral',    'Mushroom coral (disc)', 6),
    ('leather_soft_coral','Leather soft coral (stalk + cap)', 7),
    ('mat_soft_coral',    'Matting/encrusting soft coral', 8);

CREATE TABLE anatomy_template_elements (
    template_code     text NOT NULL REFERENCES anatomy_templates(code) ON DELETE CASCADE,
    element_type_code text NOT NULL REFERENCES element_types(code),
    sort_order        smallint NOT NULL DEFAULT 0,
    PRIMARY KEY (template_code, element_type_code)
);
INSERT INTO anatomy_template_elements (template_code, element_type_code, sort_order) VALUES
    ('branching_sps', 'coenosarc_skin',    1),
    ('branching_sps', 'axial_corallite',   2),
    ('branching_sps', 'radial_corallite',  3),
    ('branching_sps', 'growth_tip',        4),
    ('lps_corallite', 'coenosarc_skin',    1),
    ('lps_corallite', 'corallite',         2),
    ('lps_corallite', 'mouth_oral_disc',   3),
    ('lps_tentacled', 'coenosarc_skin',    1),
    ('lps_tentacled', 'tentacle',          2),
    ('lps_tentacled', 'mouth_oral_disc',   3),
    ('polyp_soft',    'base_body',         1),
    ('polyp_soft',    'polyp',             2),
    ('polyp_soft',    'tentacle',          3),
    ('polyp_soft',    'mouth_oral_disc',   4),
    -- Suggested (not required) positions — see element_types comment above.
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
    ('mat_soft_coral',     'tentacle',         2);

CREATE TABLE care_difficulties (
    code       text PRIMARY KEY,
    label      text NOT NULL,
    sort_order smallint NOT NULL DEFAULT 0
);
INSERT INTO care_difficulties (code, label, sort_order) VALUES
    ('easy',      'Easy',      1),
    ('moderate',  'Moderate',  2),
    ('difficult', 'Difficult', 3),
    ('expert',    'Expert',    4);

-- Low/Medium/High, reused for both light and flow guidance.
CREATE TABLE care_levels (
    code       text PRIMARY KEY,
    label      text NOT NULL,
    sort_order smallint NOT NULL DEFAULT 0
);
INSERT INTO care_levels (code, label, sort_order) VALUES
    ('low',    'Low',    1),
    ('medium', 'Medium', 2),
    ('high',   'High',   3);

CREATE TABLE corallite_shapes (
    code  text PRIMARY KEY,
    label text NOT NULL
);
INSERT INTO corallite_shapes (code, label) VALUES
    ('immersed',  'Immersed'),
    ('appressed', 'Appressed'),
    ('tubular',   'Tubular'),
    ('nariform',  'Nariform'),
    ('exsert',    'Exsert'),
    ('plocoid',   'Plocoid');

CREATE TABLE skin_textures (
    code  text PRIMARY KEY,
    label text NOT NULL
);
INSERT INTO skin_textures (code, label) VALUES
    ('smooth',    'Smooth'),
    ('papillose', 'Papillose (small bumps)'),
    ('verrucose', 'Verrucose (warty)'),
    ('hispid',    'Hispid (spiny)'),
    ('granular',  'Granular'),
    ('ridged',    'Ridged');

-- Coarse size buckets, each carrying a typical mm range for reference. A given
-- coral's element_profile may also store its own measured size_min_mm/max_mm.
CREATE TABLE polyp_sizes (
    code           text PRIMARY KEY,
    label          text NOT NULL,
    typical_min_mm numeric,
    typical_max_mm numeric,
    sort_order     smallint NOT NULL DEFAULT 0
);
INSERT INTO polyp_sizes (code, label, typical_min_mm, typical_max_mm, sort_order) VALUES
    ('small',  'Small',  0,  5,  1),
    ('medium', 'Medium', 5,  15, 2),
    ('large',  'Large',  15, 40, 3);

-- How a described coloration is laid out across an element.
CREATE TABLE color_patterns (
    code       text PRIMARY KEY,
    label      text NOT NULL,
    sort_order smallint NOT NULL DEFAULT 0
);
INSERT INTO color_patterns (code, label, sort_order) VALUES
    ('solid',   'Solid (single color)',       1),
    ('range',   'Range / gradient (from-to)', 2),
    ('rainbow', 'Rainbow / multicolor',       3),
    ('banded',  'Banded',                     4),
    ('spotted', 'Spotted / speckled',         5),
    ('mottled', 'Mottled',                    6),
    ('tipped',  'Tipped',                     7),
    ('ringed',  'Ringed',                     8);

-- Optional human-friendly base palette to name color_stops against. hex is the
-- source of truth on a stop; this is just a naming helper.
CREATE TABLE named_colors (
    code  text PRIMARY KEY,
    label text NOT NULL,
    hex   text NOT NULL CHECK (hex ~ '^#[0-9A-Fa-f]{6}$')
);
INSERT INTO named_colors (code, label, hex) VALUES
    ('green',      'Green',      '#2E8B57'),
    ('teal',       'Teal',       '#008080'),
    ('blue',       'Blue',       '#1E90FF'),
    ('light_blue', 'Light blue', '#ADD8E6'),
    ('purple',     'Purple',     '#800080'),
    ('red',        'Red',        '#E23B3B'),
    ('orange',     'Orange',     '#FF8C00'),
    ('yellow',     'Yellow',     '#FFD700'),
    ('pink',       'Pink',       '#FF69B4'),
    ('cream',      'Cream',      '#FFF3D6'),
    ('brown',      'Brown',      '#8B4513'),
    ('white',      'White',      '#FFFFFF');

-- =============================================================================
-- 2. taxon_nodes — the universal naming tree + coral care guidance
-- =============================================================================

CREATE TABLE taxon_nodes (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id             uuid REFERENCES taxon_nodes(id),
    rank_code             text NOT NULL REFERENCES ranks(code),
    name                  text NOT NULL,          -- display name
    scientific_name       text,
    slug                  text NOT NULL UNIQUE,   -- SEO URL
    is_visible            boolean NOT NULL DEFAULT true,  -- levels may be hidden

    -- Care guidance (chiefly at morph level; morphs can differ). All optional.
    care_difficulty_code  text REFERENCES care_difficulties(code),
    light_level_code      text REFERENCES care_levels(code),
    flow_level_code       text REFERENCES care_levels(code),
    growth_form_code      text REFERENCES growth_forms(code),
    -- Genus-level (see anatomy_templates above) — suggested color positions
    -- for this kind of coral's entry UI (not a required checklist).
    anatomy_template_code text REFERENCES anatomy_templates(code),
    -- Mushroom-specific texture flag (e.g. "bounce"/bubble-vesicle
    -- rhodactis) — a standalone feature, not a color position.
    has_bubble_texture    boolean,
    placement             text,
    description           text,

    -- Recommended parameter ranges ("what conditions make it thrive").
    rec_alkalinity_dkh_min numeric, rec_alkalinity_dkh_max numeric,
    rec_calcium_ppm_min    numeric, rec_calcium_ppm_max    numeric,
    rec_magnesium_ppm_min  numeric, rec_magnesium_ppm_max  numeric,
    rec_nitrate_ppm_min    numeric, rec_nitrate_ppm_max    numeric,
    rec_phosphate_ppm_min  numeric, rec_phosphate_ppm_max  numeric,
    rec_temperature_c_min  numeric, rec_temperature_c_max  numeric,

    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    deleted_at            timestamptz,

    -- Category nodes are the roots; every other node has a parent.
    CONSTRAINT taxon_root_is_category CHECK (
        (rank_code = 'category' AND parent_id IS NULL) OR
        (rank_code <> 'category' AND parent_id IS NOT NULL)
    )
);
CREATE INDEX idx_taxon_nodes_parent ON taxon_nodes (parent_id);
CREATE INDEX idx_taxon_nodes_rank ON taxon_nodes (rank_code);
CREATE INDEX idx_taxon_nodes_name_trgm ON taxon_nodes USING gin (name gin_trgm_ops);

-- =============================================================================
-- 3. Element profiles, color ranges, color stops
-- =============================================================================

-- One profile per identifiable element per taxon. Morphology fields are
-- controlled-vocabulary (dropdowns); only those relevant to the element_type
-- are populated (see element_types.allows_*).
CREATE TABLE element_profiles (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    taxon_node_id       uuid NOT NULL REFERENCES taxon_nodes(id) ON DELETE CASCADE,
    element_type_code   text NOT NULL REFERENCES element_types(code),
    corallite_shape_code text REFERENCES corallite_shapes(code),
    skin_texture_code   text REFERENCES skin_textures(code),
    polyp_size_code     text REFERENCES polyp_sizes(code),
    size_min_mm         numeric,   -- this coral's measured element size range
    size_max_mm         numeric,
    description         text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (taxon_node_id, element_type_code)
);
CREATE INDEX idx_element_profiles_taxon ON element_profiles (taxon_node_id);

-- A described coloration, one of a taxon's distinct colors. pattern says how
-- the stops combine: solid = 1 stop, range = 2 stops (from/to), rainbow/
-- banded/etc. = N stops. Hangs directly off the taxon (not through
-- element_profiles) — position_label is an optional, non-enforced hint
-- (e.g. "oral_disc_center", "skirt_1") for the entry UI and wiki grouping,
-- not a required checklist item; NULL is valid ("just a distinct color, no
-- specific region claimed"). element_profiles still exists separately for
-- genuine morphology capture (shape/texture/size) and a color_range may
-- optionally reference one when useful, but doesn't require it.
CREATE TABLE color_ranges (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    taxon_node_id      uuid NOT NULL REFERENCES taxon_nodes(id) ON DELETE CASCADE,
    position_label     text REFERENCES element_types(code),
    element_profile_id uuid REFERENCES element_profiles(id) ON DELETE SET NULL,
    color_pattern_code text NOT NULL REFERENCES color_patterns(code),
    label              text,     -- e.g. "Rainbow oral disc"
    notes              text,
    -- Rough visual proportion (0-100), for the deferred "I see these colors
    -- + %" self-ID matcher — not yet populated or consumed by any matcher.
    approx_percent     numeric CHECK (approx_percent >= 0 AND approx_percent <= 100),
    -- What lighting the color was actually observed under. Reef lighting is
    -- commonly actinic (blue-shifted) and materially changes a coral's
    -- apparent color from how it reads under daylight/white light — see
    -- PRODUCT.md's multi-lighting reference note. NULL = not recorded
    -- (true for every color entered before this column existed). Sibling to
    -- approx_percent: both go here so future color entry (moderator or
    -- AI-assisted, see identify-MVP Phase 2) has somewhere to put this
    -- instead of silently dropping it, even though nothing backfills it yet.
    lighting_condition text CHECK (lighting_condition IN ('daylight', 'actinic', 'mixed', 'unsure')),
    sort_order         smallint NOT NULL DEFAULT 0,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_color_ranges_taxon ON color_ranges (taxon_node_id);

-- The actual color point(s). hex is the source of truth; HSL is optional for
-- machine comparison (Phase 3). A stop can be pinpoint-sampled from a real
-- photo (source_photo_id + normalized coordinates) rather than hand-entered.
CREATE TABLE color_stops (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    color_range_id   uuid NOT NULL REFERENCES color_ranges(id) ON DELETE CASCADE,
    ordinal          smallint NOT NULL DEFAULT 0,   -- order within the range
    hex              text NOT NULL CHECK (hex ~ '^#[0-9A-Fa-f]{6}$'),
    hue              numeric CHECK (hue >= 0 AND hue <= 360),
    saturation       numeric CHECK (saturation >= 0 AND saturation <= 100),
    lightness        numeric CHECK (lightness >= 0 AND lightness <= 100),
    named_color_code text REFERENCES named_colors(code),
    -- SOFT link to coral_photos(id) in the platform schema (no enforced FK):
    source_photo_id  uuid,
    sample_x         numeric CHECK (sample_x >= 0 AND sample_x <= 1),
    sample_y         numeric CHECK (sample_y >= 0 AND sample_y <= 1),
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (color_range_id, ordinal)
);
CREATE INDEX idx_color_stops_range ON color_stops (color_range_id);

-- =============================================================================
-- 4. Reference images (curated seed) & recommended products
-- =============================================================================

-- Curated hero/reference images so a wiki page is never blank before community
-- photos exist. Community galleries still come from coral_photos (platform).
CREATE TABLE taxon_reference_images (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    taxon_node_id uuid NOT NULL REFERENCES taxon_nodes(id) ON DELETE CASCADE,
    url           text NOT NULL,
    caption       text,
    credit        text,
    sort_order    smallint NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_taxon_reference_images_taxon ON taxon_reference_images (taxon_node_id);

-- Additional elements/additives associated with better health & coloration for
-- a given coral. product_id is a SOFT link to husbandry_products (platform).
CREATE TABLE taxon_recommended_products (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    taxon_node_id uuid NOT NULL REFERENCES taxon_nodes(id) ON DELETE CASCADE,
    product_id    uuid NOT NULL,   -- SOFT link to husbandry_products(id)
    note          text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (taxon_node_id, product_id)
);
CREATE INDEX idx_taxon_recommended_products_taxon
    ON taxon_recommended_products (taxon_node_id);

-- =============================================================================
-- 5. updated_at triggers
-- =============================================================================

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'taxon_nodes', 'element_profiles', 'color_ranges',
        'taxon_reference_images', 'taxon_recommended_products'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$I '
            'FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
    END LOOP;
END $$;

-- =============================================================================
-- 6. Seed data — a worked example of the hierarchy and every color pattern
-- =============================================================================
-- Demonstrates: category -> genus -> species -> morph; element profiles with
-- morphology dropdowns; and solid / range / rainbow colorations. FK references
-- use unique slugs so no hard-coded UUIDs are needed.

-- 6a. Coral category (hidden L1) and an SPS branch.
INSERT INTO taxon_nodes (rank_code, name, slug, is_visible) VALUES
    ('category', 'Coral', 'coral', false);

INSERT INTO taxon_nodes (parent_id, rank_code, name, scientific_name, slug) VALUES
    ((SELECT id FROM taxon_nodes WHERE slug = 'coral'),
     'genus', 'Acropora', 'Acropora', 'acropora');

INSERT INTO taxon_nodes (parent_id, rank_code, name, scientific_name, slug) VALUES
    ((SELECT id FROM taxon_nodes WHERE slug = 'acropora'),
     'species', 'Acropora millepora', 'Acropora millepora', 'acropora-millepora');

INSERT INTO taxon_nodes (
    parent_id, rank_code, name, slug,
    care_difficulty_code, light_level_code, flow_level_code, growth_form_code,
    placement, description,
    rec_alkalinity_dkh_min, rec_alkalinity_dkh_max,
    rec_calcium_ppm_min, rec_calcium_ppm_max,
    rec_magnesium_ppm_min, rec_magnesium_ppm_max,
    rec_nitrate_ppm_min, rec_nitrate_ppm_max,
    rec_phosphate_ppm_min, rec_phosphate_ppm_max,
    rec_temperature_c_min, rec_temperature_c_max
) VALUES (
    (SELECT id FROM taxon_nodes WHERE slug = 'acropora-millepora'),
    'morph', 'Pink Stardust', 'pink-stardust',
    'moderate', 'high', 'high', 'branching',
    'Mid-to-upper rockwork with strong flow.',
    'A pink-polyped Acropora millepora morph with blue growth tips.',
    8.0, 9.0, 420, 440, 1350, 1450, 1, 5, 0.02, 0.08, 25, 27
);

-- 6b. An LPS branch to demonstrate a rainbow (multi-stop) coloration.
INSERT INTO taxon_nodes (parent_id, rank_code, name, scientific_name, slug) VALUES
    ((SELECT id FROM taxon_nodes WHERE slug = 'coral'),
     'genus', 'Micromussa', 'Micromussa', 'micromussa');

INSERT INTO taxon_nodes (parent_id, rank_code, name, scientific_name, slug) VALUES
    ((SELECT id FROM taxon_nodes WHERE slug = 'micromussa'),
     'species', 'Micromussa lordhowensis', 'Micromussa lordhowensis',
     'micromussa-lordhowensis');

INSERT INTO taxon_nodes (
    parent_id, rank_code, name, slug,
    care_difficulty_code, light_level_code, flow_level_code, growth_form_code,
    placement, description
) VALUES (
    (SELECT id FROM taxon_nodes WHERE slug = 'micromussa-lordhowensis'),
    'morph', 'Rainbow Acan', 'rainbow-acan',
    'easy', 'low', 'low', 'submassive',
    'Sand bed to low rock, gentle flow, target feed.',
    'A multicolor Micromussa lordhowensis ("Acan") with rainbow oral discs.'
);

-- 6c. Element profiles for Pink Stardust.
INSERT INTO element_profiles (taxon_node_id, element_type_code, corallite_shape_code, description) VALUES
    ((SELECT id FROM taxon_nodes WHERE slug = 'pink-stardust'), 'axial_corallite', 'exsert', 'Blue-tinted axial corallites at growth tips.'),
    ((SELECT id FROM taxon_nodes WHERE slug = 'pink-stardust'), 'radial_corallite', 'appressed', 'Appressed radial corallites along branches.');
INSERT INTO element_profiles (taxon_node_id, element_type_code, description) VALUES
    ((SELECT id FROM taxon_nodes WHERE slug = 'pink-stardust'), 'growth_tip', 'Blue growth tips.'),
    ((SELECT id FROM taxon_nodes WHERE slug = 'pink-stardust'), 'coenosarc_skin', 'Cream-to-green skin between corallites.');
INSERT INTO element_profiles (taxon_node_id, element_type_code, polyp_size_code, size_min_mm, size_max_mm, description) VALUES
    ((SELECT id FROM taxon_nodes WHERE slug = 'pink-stardust'), 'polyp', 'small', 1, 3, 'Small pink polyps.');

-- 6d. Element profiles for Rainbow Acan.
INSERT INTO element_profiles (taxon_node_id, element_type_code, description) VALUES
    ((SELECT id FROM taxon_nodes WHERE slug = 'rainbow-acan'), 'mouth_oral_disc', 'Rainbow oral discs.');
INSERT INTO element_profiles (taxon_node_id, element_type_code, skin_texture_code, description) VALUES
    ((SELECT id FROM taxon_nodes WHERE slug = 'rainbow-acan'), 'coenosarc_skin', 'smooth', 'Fleshy tissue, gradient wall color.');

-- 6e. Colorations — hang directly off the taxon (position_label is just a
-- suggested hint, matching the element_profiles rows above where relevant).

-- Pink Stardust growth tip: SOLID blue.
WITH cr AS (
    INSERT INTO color_ranges (taxon_node_id, position_label, color_pattern_code, label)
    SELECT id, 'growth_tip', 'solid', 'Blue tips' FROM taxon_nodes WHERE slug = 'pink-stardust'
    RETURNING id
)
INSERT INTO color_stops (color_range_id, ordinal, hex, named_color_code)
SELECT id, 0, '#1E90FF', 'blue' FROM cr;

-- Pink Stardust skin: RANGE cream -> green (2 stops).
WITH cr AS (
    INSERT INTO color_ranges (taxon_node_id, position_label, color_pattern_code, label)
    SELECT id, 'coenosarc_skin', 'range', 'Cream to green' FROM taxon_nodes WHERE slug = 'pink-stardust'
    RETURNING id
)
INSERT INTO color_stops (color_range_id, ordinal, hex, named_color_code)
SELECT id, 0, '#FFF3D6', 'cream' FROM cr
UNION ALL
SELECT id, 1, '#2E8B57', 'green' FROM cr;

-- Rainbow Acan oral disc: RAINBOW (4 stops).
WITH cr AS (
    INSERT INTO color_ranges (taxon_node_id, position_label, color_pattern_code, label)
    SELECT id, 'mouth_oral_disc', 'rainbow', 'Rainbow oral disc' FROM taxon_nodes WHERE slug = 'rainbow-acan'
    RETURNING id
)
INSERT INTO color_stops (color_range_id, ordinal, hex, named_color_code)
SELECT id, 0, '#E23B3B', 'red'    FROM cr
UNION ALL SELECT id, 1, '#FF8C00', 'orange' FROM cr
UNION ALL SELECT id, 2, '#FFD700', 'yellow' FROM cr
UNION ALL SELECT id, 3, '#2E8B57', 'green'  FROM cr;

-- =============================================================================
-- End of coral_trait_schema.sql
-- =============================================================================
