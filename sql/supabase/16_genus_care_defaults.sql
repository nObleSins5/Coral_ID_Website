-- =============================================================================
-- Supabase layer — Genus-level care/light/flow defaults (16_genus_care_defaults.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the same UPDATEs
-- appended to sql/seed/phase0_corals.sql.
--
-- Care difficulty, light level, and flow level are substantially a GENUS
-- property, not a morph one (every Acropora wants high light/high flow
-- regardless of morph; every Euphyllia wants moderate difficulty and lower
-- light/flow) — see docs/future-considerations.md, "Genus-level care
-- defaults...". This sets that default on each genus-rank taxon_nodes row.
-- The app resolves it at READ time (web/lib/wiki.ts, withGenusCareDefaults):
-- a morph with these fields already set keeps its own value; a morph left
-- null (in particular, every new community-confirmed morph, which only ever
-- gets name/slug/genus set — see handle_id_vote_change()) falls back to its
-- parent genus's value. No existing morph row is touched by this migration.
--
-- Values are the majority vote among each genus's own already-seeded morphs
-- (sql/seed/phase0_corals.sql) where more than one exists, standard reef-
-- keeping consensus for genera with only one seeded morph, and Acropora /
-- Euphyllia set per an explicit product decision (2026-07-11) that genus-
-- level knowledge should win even where it differs from an individual
-- seeded morph's rating.
-- Idempotent (plain UPDATE by slug; safe to rerun).
-- =============================================================================

UPDATE taxon_nodes SET care_difficulty_code = 'difficult', light_level_code = 'high',   flow_level_code = 'high'   WHERE rank_code = 'genus' AND slug = 'acropora';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'low',    flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'blastomussa';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'low',    flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'briareum';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'caulastraea';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'low',    flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'clavularia';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'low',    flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'cycloseris';
UPDATE taxon_nodes SET care_difficulty_code = 'moderate',  light_level_code = 'medium', flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'dipsastraea';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'low',    flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'discosoma';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'duncanopsammia';
UPDATE taxon_nodes SET care_difficulty_code = 'moderate',  light_level_code = 'medium', flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'euphyllia';
UPDATE taxon_nodes SET care_difficulty_code = 'moderate',  light_level_code = 'medium', flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'goniopora';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'low',    flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'lobophyllia';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'low',    flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'micromussa';
UPDATE taxon_nodes SET care_difficulty_code = 'moderate',  light_level_code = 'high',   flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'montipora';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'palythoa';
UPDATE taxon_nodes SET care_difficulty_code = 'moderate',  light_level_code = 'medium', flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'pavona';
UPDATE taxon_nodes SET care_difficulty_code = 'moderate',  light_level_code = 'low',    flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'rhodactis';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'ricordea';
-- No morphs seeded under Pocillopora yet — set from the same Pocilloporidae-
-- family consensus as its seeded relatives Seriatopora/Stylophora, below.
UPDATE taxon_nodes SET care_difficulty_code = 'moderate',  light_level_code = 'high',   flow_level_code = 'high'   WHERE rank_code = 'genus' AND slug = 'pocillopora';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'sarcophyton';
UPDATE taxon_nodes SET care_difficulty_code = 'moderate',  light_level_code = 'high',   flow_level_code = 'high'   WHERE rank_code = 'genus' AND slug = 'seriatopora';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'sinularia';
UPDATE taxon_nodes SET care_difficulty_code = 'moderate',  light_level_code = 'high',   flow_level_code = 'high'   WHERE rank_code = 'genus' AND slug = 'stylophora';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'low',    flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'trachyphyllia';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'turbinaria';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'xenia';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'zoanthus';
