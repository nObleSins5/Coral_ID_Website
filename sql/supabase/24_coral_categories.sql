-- =============================================================================
-- Supabase layer — Real coral categories above genus (24_coral_categories.sql)
-- =============================================================================
-- The schema always had a "category" rank above genus (see taxon_root_is_category
-- in coral_trait_schema.sql), but every genus was seeded under one single
-- hidden bucket (slug 'coral', is_visible=false) — a placeholder, not real
-- taxonomy. This migration adds the real hobbyist-facing categories and
-- re-parents each genus to the one it actually belongs to, so the wiki index
-- can group genera under a fold-out category header instead of one flat list.
--
-- Six categories (not the generic "soft coral" catch-all alone) because
-- lumping Zoanthids and Leather corals both under "Soft Coral" would bury two
-- genuinely distinct, commonly-searched hobby categories inside a vague one:
--   - Small Polyp Stony (SPS): Acropora, Montipora, Seriatopora, Stylophora,
--     Pocillopora, Pavona
--   - Large Polyp Stony (LPS): Euphyllia, Duncanopsammia, Caulastraea,
--     Micromussa, Blastomussa, Trachyphyllia, Lobophyllia, Dipsastraea,
--     Goniopora, Turbinaria, Cycloseris
--   - Leather: Sarcophyton, Sinularia (true leather corals, Alcyoniidae)
--   - Mushroom: Discosoma, Rhodactis, Ricordea (Corallimorpharia)
--   - Zoanthid: Zoanthus, Palythoa (Zoantharia — a distinct order, not a
--     "leather")
--   - Soft Coral: Xenia, Clavularia, Briareum — the remaining polyp-form
--     octocorals that aren't true leathers
--
-- The old hidden 'coral' bucket and the 'genus-unknown' placeholder
-- (sql/supabase/15_unknown_genus_placeholder.sql) are left exactly where
-- they are — genus-unknown must keep SOME category parent (taxon_root_is_category
-- forbids a genus with a null parent) and it's hidden, so which one doesn't
-- matter. Idempotent: category rows upsert on slug; genus re-parenting is a
-- plain UPDATE, safe to re-run.
-- =============================================================================

INSERT INTO taxon_nodes (rank_code, name, slug, is_visible)
VALUES
    ('category', 'Small Polyp Stony (SPS)', 'sps', true),
    ('category', 'Large Polyp Stony (LPS)', 'lps', true),
    ('category', 'Mushroom', 'mushroom', true),
    ('category', 'Leather', 'leather', true),
    ('category', 'Zoanthid', 'zoanthid', true),
    ('category', 'Soft Coral', 'soft-coral', true)
ON CONFLICT (slug) DO NOTHING;

UPDATE taxon_nodes SET parent_id = (SELECT id FROM taxon_nodes WHERE slug = 'sps')
WHERE rank_code = 'genus' AND slug IN (
    'acropora', 'montipora', 'seriatopora', 'stylophora', 'pocillopora', 'pavona'
);

UPDATE taxon_nodes SET parent_id = (SELECT id FROM taxon_nodes WHERE slug = 'lps')
WHERE rank_code = 'genus' AND slug IN (
    'euphyllia', 'duncanopsammia', 'caulastraea', 'micromussa', 'blastomussa',
    'trachyphyllia', 'lobophyllia', 'dipsastraea', 'goniopora', 'turbinaria', 'cycloseris'
);

UPDATE taxon_nodes SET parent_id = (SELECT id FROM taxon_nodes WHERE slug = 'mushroom')
WHERE rank_code = 'genus' AND slug IN ('discosoma', 'rhodactis', 'ricordea');

UPDATE taxon_nodes SET parent_id = (SELECT id FROM taxon_nodes WHERE slug = 'leather')
WHERE rank_code = 'genus' AND slug IN ('sarcophyton', 'sinularia');

UPDATE taxon_nodes SET parent_id = (SELECT id FROM taxon_nodes WHERE slug = 'zoanthid')
WHERE rank_code = 'genus' AND slug IN ('zoanthus', 'palythoa');

UPDATE taxon_nodes SET parent_id = (SELECT id FROM taxon_nodes WHERE slug = 'soft-coral')
WHERE rank_code = 'genus' AND slug IN ('xenia', 'clavularia', 'briareum');
