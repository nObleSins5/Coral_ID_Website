-- =============================================================================
-- Supabase layer — Anatomy templates: standardized element sets (20_anatomy_templates.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the same
-- tables/columns/seed data in sql/reef-platform-schema.sql.
--
-- Gap this closes (raised 2026-07-11, checking the /identify + element-color-
-- key data): 29 of 37 seeded morphs have only ONE element_profiles row —
-- whichever one happened to get picked at seed time, with no consistency by
-- growth form (one branching Acropora logged only coenosarc_skin, another
-- only base_body). There was no defined "which elements does THIS kind of
-- coral actually have" concept anywhere — element_profiles was always just
-- freely attached per-taxon with whatever the seeder chose.
--
-- anatomy_templates + anatomy_template_elements define, once, which of the
-- 10 element_types apply to which broad coral anatomy (branching/SPS, LPS
-- with a hard corallite, tentacled LPS, polyp-based soft coral/zoanthid).
-- taxon_nodes.anatomy_template_code is set at the GENUS level (anatomy is a
-- genus property, not a morph one, same reasoning as the care/light/flow
-- genus defaults) and resolved by the app when rendering a morph's element
-- key — filling in "not yet documented" for any template element the morph
-- doesn't have real color data for yet, instead of silently omitting it.
-- Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS anatomy_templates (
    code       text PRIMARY KEY,
    label      text NOT NULL,
    sort_order smallint NOT NULL DEFAULT 0
);
INSERT INTO anatomy_templates (code, label, sort_order) VALUES
    ('branching_sps', 'Branching/SPS', 1),
    ('lps_corallite', 'LPS with corallite', 2),
    ('lps_tentacled', 'Tentacled LPS', 3),
    ('polyp_soft',    'Polyp-based soft coral / zoanthid', 4)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS anatomy_template_elements (
    template_code   text NOT NULL REFERENCES anatomy_templates(code) ON DELETE CASCADE,
    element_type_code text NOT NULL REFERENCES element_types(code),
    sort_order      smallint NOT NULL DEFAULT 0,
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
    ('polyp_soft',    'mouth_oral_disc',   4)
ON CONFLICT (template_code, element_type_code) DO NOTHING;

ALTER TABLE taxon_nodes
    ADD COLUMN IF NOT EXISTS anatomy_template_code text REFERENCES anatomy_templates(code);

-- Assigned at the genus level, per the 27 seeded genera's real anatomy.
UPDATE taxon_nodes SET anatomy_template_code = 'branching_sps' WHERE rank_code = 'genus' AND slug IN
    ('acropora', 'montipora', 'pavona', 'pocillopora', 'seriatopora', 'stylophora');
UPDATE taxon_nodes SET anatomy_template_code = 'lps_corallite' WHERE rank_code = 'genus' AND slug IN
    ('blastomussa', 'caulastraea', 'cycloseris', 'dipsastraea', 'lobophyllia', 'micromussa', 'trachyphyllia', 'turbinaria');
UPDATE taxon_nodes SET anatomy_template_code = 'lps_tentacled' WHERE rank_code = 'genus' AND slug IN
    ('duncanopsammia', 'euphyllia', 'goniopora');
UPDATE taxon_nodes SET anatomy_template_code = 'polyp_soft' WHERE rank_code = 'genus' AND slug IN
    ('briareum', 'clavularia', 'discosoma', 'palythoa', 'rhodactis', 'ricordea', 'sarcophyton', 'sinularia', 'xenia', 'zoanthus');

-- Public-read lookup, same as element_types/growth_forms (new tables aren't
-- covered by 02_rls_policies.sql's default-deny loop, which only ran once,
-- at initial setup, over the tables that existed then).
ALTER TABLE anatomy_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE anatomy_template_elements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anatomy_templates_public_read ON public.anatomy_templates;
CREATE POLICY anatomy_templates_public_read ON public.anatomy_templates
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS anatomy_template_elements_public_read ON public.anatomy_template_elements;
CREATE POLICY anatomy_template_elements_public_read ON public.anatomy_template_elements
    FOR SELECT TO anon, authenticated USING (true);
