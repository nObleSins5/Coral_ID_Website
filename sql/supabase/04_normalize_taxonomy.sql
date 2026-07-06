-- =============================================================================
-- Supabase layer — Normalize browse tree to Genus -> Morph (04_normalize_taxonomy.sql)
-- =============================================================================
-- Product decision: the wiki browse tree is two levels — genus, then morph.
-- Species is not a browse level; for well-known corals it is shown as an
-- attribute (scientific_name) on the morph detail page only. This keeps the
-- tree uniform (no mixed depth). New corals attach morphs directly under a
-- genus (see sql/seed/phase0_corals.sql); this migration collapses the two
-- demo corals that were originally seeded under a species node.
-- Idempotent.
-- =============================================================================

-- Re-parent the demo morphs from their species node up to the genus, and keep
-- the species binomial as scientific_name for display on the detail page.
UPDATE taxon_nodes
SET parent_id = (SELECT id FROM taxon_nodes WHERE slug = 'acropora'),
    scientific_name = COALESCE(scientific_name, 'Acropora millepora')
WHERE slug = 'pink-stardust';

UPDATE taxon_nodes
SET parent_id = (SELECT id FROM taxon_nodes WHERE slug = 'micromussa'),
    scientific_name = COALESCE(scientific_name, 'Micromussa lordhowensis')
WHERE slug = 'rainbow-acan';

-- Remove the now-childless species nodes so the tree is purely genus -> morph.
DELETE FROM taxon_nodes
WHERE rank_code = 'species'
  AND slug IN ('acropora-millepora', 'micromussa-lordhowensis');
