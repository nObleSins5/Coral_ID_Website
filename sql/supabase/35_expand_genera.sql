-- =============================================================================
-- Supabase layer — Expand the genus listing (35_expand_genera.sql)
-- =============================================================================
-- Product decision: the wiki's genus list only ever covered the ~26 genera
-- that had seeded morphs — a small fraction of what's actually sold in the
-- hobby trade. This adds every additional genus commonly listed by major
-- coral retailers (cross-referenced against tidalgardens.com,
-- worldwidecorals.com, and aquaticlog.com's own category/genus breakdowns)
-- so the wiki's browse tree reflects the real trade, not just what happened
-- to get a morph seeded first. Deliberately NO morphs added here — genus
-- pages, empty, ready for morphs to be added over time (either by hand or
-- via the existing community-proposal pipeline).
--
-- Every genus gets care_difficulty_code/light_level_code/flow_level_code set
-- directly (same fields 16_genus_care_defaults.sql backfilled onto the
-- original 26) — standard reef-keeping consensus per genus, not sourced from
-- any single retailer. anatomy_template_code picked from the existing
-- template set (coral_trait_schema.sql) by each genus's actual growth form,
-- same convention as every other genus.
-- Idempotent: INSERT ... ON CONFLICT (slug) DO NOTHING.
-- =============================================================================

INSERT INTO taxon_nodes (rank_code, name, slug, is_visible, parent_id, anatomy_template_code, care_difficulty_code, light_level_code, flow_level_code)
VALUES
    -- --- SPS (sql/supabase/24_coral_categories.sql category slug 'sps') ---
    ('genus', 'Anacropora',     'anacropora',     true, (SELECT id FROM taxon_nodes WHERE slug = 'sps'), 'branching_sps', 'difficult', 'high',   'high'),
    ('genus', 'Cyphastrea',     'cyphastrea',     true, (SELECT id FROM taxon_nodes WHERE slug = 'sps'), 'branching_sps', 'easy',      'medium', 'medium'),
    ('genus', 'Hydnophora',     'hydnophora',     true, (SELECT id FROM taxon_nodes WHERE slug = 'sps'), 'branching_sps', 'moderate',  'high',   'high'),
    ('genus', 'Leptoseris',     'leptoseris',     true, (SELECT id FROM taxon_nodes WHERE slug = 'sps'), 'branching_sps', 'moderate',  'medium', 'low'),
    ('genus', 'Porites',        'porites',        true, (SELECT id FROM taxon_nodes WHERE slug = 'sps'), 'branching_sps', 'easy',      'medium', 'medium'),
    ('genus', 'Psammocora',     'psammocora',     true, (SELECT id FROM taxon_nodes WHERE slug = 'sps'), 'branching_sps', 'moderate',  'medium', 'medium'),
    ('genus', 'Stylocoeniella', 'stylocoeniella', true, (SELECT id FROM taxon_nodes WHERE slug = 'sps'), 'branching_sps', 'easy',      'medium', 'medium'),
    ('genus', 'Lithophyllon',   'lithophyllon',   true, (SELECT id FROM taxon_nodes WHERE slug = 'sps'), 'branching_sps', 'moderate',  'medium', 'low'),
    ('genus', 'Plesiastrea',    'plesiastrea',    true, (SELECT id FROM taxon_nodes WHERE slug = 'sps'), 'branching_sps', 'easy',      'medium', 'medium'),

    -- --- LPS (category slug 'lps') ---
    ('genus', 'Acanthastrea',   'acanthastrea',   true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'easy',      'low',    'low'),
    ('genus', 'Acanthophyllia', 'acanthophyllia', true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'easy',      'low',    'low'),
    ('genus', 'Alveopora',      'alveopora',      true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_tentacled', 'moderate',  'medium', 'medium'),
    ('genus', 'Plerogyra',      'plerogyra',      true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_tentacled', 'easy',      'low',    'low'),
    ('genus', 'Echinopora',     'echinopora',     true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'moderate',  'medium', 'medium'),
    ('genus', 'Cynarina',       'cynarina',       true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'easy',      'low',    'low'),
    ('genus', 'Catalaphyllia',  'catalaphyllia',  true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_tentacled', 'moderate',  'medium', 'low'),
    ('genus', 'Favia',          'favia',          true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'easy',      'medium', 'low'),
    ('genus', 'Favites',        'favites',        true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'easy',      'medium', 'low'),
    ('genus', 'Fungia',         'fungia',         true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'easy',      'medium', 'medium'),
    ('genus', 'Galaxea',        'galaxea',        true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_tentacled', 'moderate',  'medium', 'medium'),
    ('genus', 'Leptastrea',     'leptastrea',     true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'easy',      'medium', 'medium'),
    ('genus', 'Oulophyllia',    'oulophyllia',    true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'easy',      'medium', 'low'),
    ('genus', 'Pectinia',       'pectinia',       true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'moderate',  'low',    'low'),
    ('genus', 'Platygyra',      'platygyra',      true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'easy',      'medium', 'low'),
    ('genus', 'Scolymia',       'scolymia',       true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'easy',      'low',    'low'),
    ('genus', 'Tubastrea',      'tubastrea',      true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_tentacled', 'moderate',  'low',    'medium'),
    ('genus', 'Symphyllia',     'symphyllia',     true, (SELECT id FROM taxon_nodes WHERE slug = 'lps'), 'lps_corallite', 'easy',      'medium', 'low'),

    -- --- Soft Coral (category slug 'soft-coral') ---
    ('genus', 'Anthelia',       'anthelia',       true, (SELECT id FROM taxon_nodes WHERE slug = 'soft-coral'), 'mat_soft_coral',     'easy',     'medium', 'medium'),
    ('genus', 'Heliopora',      'heliopora',      true, (SELECT id FROM taxon_nodes WHERE slug = 'soft-coral'), 'leather_soft_coral', 'moderate', 'medium', 'medium'),
    ('genus', 'Lobophytum',     'lobophytum',     true, (SELECT id FROM taxon_nodes WHERE slug = 'soft-coral'), 'leather_soft_coral', 'easy',     'medium', 'medium'),
    ('genus', 'Nephthea',       'nephthea',       true, (SELECT id FROM taxon_nodes WHERE slug = 'soft-coral'), 'leather_soft_coral', 'moderate', 'medium', 'medium'),
    ('genus', 'Tubipora',       'tubipora',       true, (SELECT id FROM taxon_nodes WHERE slug = 'soft-coral'), 'mat_soft_coral',     'easy',     'medium', 'medium'),
    ('genus', 'Pachyclavularia','pachyclavularia',true, (SELECT id FROM taxon_nodes WHERE slug = 'soft-coral'), 'mat_soft_coral',     'easy',     'medium', 'medium'),

    -- --- Zoanthid (category slug 'zoanthid') ---
    ('genus', 'Parazoanthus',   'parazoanthus',   true, (SELECT id FROM taxon_nodes WHERE slug = 'zoanthid'), 'zoanthid_paly', 'easy', 'low', 'medium'),

    -- --- Mushroom (category slug 'mushroom') ---
    ('genus', 'Pseudocorynactis','pseudocorynactis', true, (SELECT id FROM taxon_nodes WHERE slug = 'mushroom'), 'mushroom_coral', 'moderate', 'low', 'low')
ON CONFLICT (slug) DO NOTHING;
