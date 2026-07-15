-- =============================================================================
-- Supabase layer — Correct Rasta Zoanthid's documented colors (25_correct_rasta_zoa_colors.sql)
-- =============================================================================
-- Rasta Zoanthid's color_ranges have said "Green face" (#2E8B57) + "Red
-- skirt" (#E23B3B) since the original phase0 seed. A community-confirmed
-- reference photo now exists for this coral (added after seeding), and a
-- grid pixel-scan of that actual photo (identify-MVP color-accuracy pass,
-- see docs/PROGRESS.md) found neither claim true: the dominant non-background
-- colors are an orange/gold polyp center and an olive-green outer ring/
-- tentacles — there are zero red pixels anywhere in the image.
--
-- This is a correction grounded in the coral's own confirmed photo, not an
-- externally cited source — the other 36 seed corals still have provisional,
-- unverified hexes (most have no community photo yet to check against at
-- all) and are deliberately left untouched here. See docs/PROGRESS.md's
-- identify-MVP entry for the fuller cited-source scope.
--
-- Idempotent: the DELETE is a no-op once the old labels are gone; each
-- INSERT is guarded on the new label already existing.
-- =============================================================================

DO $$
DECLARE
    v_taxon uuid;
    v_range uuid;
BEGIN
    SELECT id INTO v_taxon FROM taxon_nodes WHERE slug = 'rasta-zoa';
    IF v_taxon IS NULL THEN RETURN; END IF;

    DELETE FROM color_ranges WHERE taxon_node_id = v_taxon AND label IN ('Green face', 'Red skirt');

    IF NOT EXISTS (SELECT 1 FROM color_ranges WHERE taxon_node_id = v_taxon AND label = 'Orange face') THEN
        INSERT INTO color_ranges (taxon_node_id, position_label, color_pattern_code, label, notes)
        VALUES (
            v_taxon, 'oral_disc_center', 'solid', 'Orange face',
            'Corrected from the coral''s own confirmed reference photo (pixel-sampled) — was wrongly documented as green.'
        )
        RETURNING id INTO v_range;
        INSERT INTO color_stops (color_range_id, ordinal, hex) VALUES (v_range, 0, '#F28C00');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM color_ranges WHERE taxon_node_id = v_taxon AND label = 'Olive-green skirt') THEN
        INSERT INTO color_ranges (taxon_node_id, position_label, color_pattern_code, label, notes)
        VALUES (
            v_taxon, 'skirt_1', 'solid', 'Olive-green skirt',
            'Corrected from the coral''s own confirmed reference photo (pixel-sampled) — no red is present in the photo.'
        )
        RETURNING id INTO v_range;
        INSERT INTO color_stops (color_range_id, ordinal, hex) VALUES (v_range, 0, '#5B7A3A');
    END IF;

    UPDATE taxon_nodes
    SET description = 'Orange face with an olive-green skirt.'
    WHERE id = v_taxon AND description = 'Green face with a red-orange skirt.';
END $$;
