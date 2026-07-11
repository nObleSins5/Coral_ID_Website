-- =============================================================================
-- Supabase layer — "Genus unknown" placeholder taxon (15_unknown_genus_placeholder.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the seed row
-- added at the end of sql/seed/phase0_corals.sql.
--
-- Gap this closes: proposing a brand-new (undocumented) morph on /identify
-- required picking a real genus — id_suggestions has a hard CHECK
-- (id_suggestions_new_morph_needs_genus, sql/reef-platform-schema.sql) that a
-- new-morph proposal must carry a proposed_genus_id, since the confirmation
-- trigger needs a parent to INSERT the new taxon_node into. There was no way
-- to say "I don't know which genus this is" without violating that
-- constraint. This adds one reusable placeholder genus (is_visible = false,
-- so it never appears in the public wiki's genus grid) that "not sure" bucket
-- proposals point to instead — a moderator can later reassign an individual
-- morph's parent_id to the correct genus once it's determined, the same way
-- test-data cleanup has been done directly via SQL elsewhere in this project.
-- Idempotent (ON CONFLICT DO NOTHING on the unique slug).
-- =============================================================================

INSERT INTO taxon_nodes (parent_id, rank_code, name, slug, is_visible)
SELECT id, 'genus', 'Genus unknown', 'genus-unknown', false
FROM taxon_nodes
WHERE rank_code = 'category' AND slug = 'coral'
ON CONFLICT (slug) DO NOTHING;
