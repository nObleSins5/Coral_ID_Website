-- =============================================================================
-- Phase 0 seed — curated easy-ID corals (PROVISIONAL)
-- =============================================================================
-- ~36 common, easy-to-identify hobby corals across the naming hierarchy
-- (Coral category -> genus -> morph), each with care guidance and a signature
-- element coloration, so the wiki / Door 1 features have real content.
--
-- ⚠ PARTIALLY PROVISIONAL DATA. Genus/morph names are real hobby names, and
-- care_difficulty/light/flow/growth_form per morph are reasoned per-morph
-- judgments. Two things are still coarser than that:
--   - The signature-coloration hex values below are curated PLACEHOLDERS,
--     not verified against real photos of each named morph — a cited-source
--     pass is still an open decision (spec §9).
--   - Recommended parameters (bottom of file, added 2026-07-08) are
--     genus-category generalizations (softies / LPS / SPS), not verified
--     per exact named morph — before this pass they were entirely NULL
--     (every wiki page's parameter table rendered as all dashes).
-- Refine both further as real domain expertise / citations become available;
-- the structure is production-shaped.
--
-- Idempotent: taxon_nodes upsert on slug; element profiles on
-- (taxon, element); colorations are guarded by label. Safe to re-run.
-- Requires coral_trait_schema.sql (and its 'coral' category seed).
-- =============================================================================

-- Genera (attached under the existing hidden 'coral' category).
INSERT INTO taxon_nodes (parent_id, rank_code, name, scientific_name, slug)
SELECT (SELECT id FROM taxon_nodes WHERE slug = 'coral'), 'genus', v.name, v.name, v.slug
FROM (VALUES
    ('Zoanthus','zoanthus'), ('Palythoa','palythoa'), ('Briareum','briareum'),
    ('Sarcophyton','sarcophyton'), ('Sinularia','sinularia'), ('Xenia','xenia'),
    ('Clavularia','clavularia'), ('Discosoma','discosoma'), ('Rhodactis','rhodactis'),
    ('Ricordea','ricordea'), ('Euphyllia','euphyllia'), ('Duncanopsammia','duncanopsammia'),
    ('Caulastraea','caulastraea'), ('Blastomussa','blastomussa'), ('Trachyphyllia','trachyphyllia'),
    ('Lobophyllia','lobophyllia'), ('Dipsastraea','dipsastraea'), ('Goniopora','goniopora'),
    ('Turbinaria','turbinaria'), ('Cycloseris','cycloseris'), ('Montipora','montipora'),
    ('Seriatopora','seriatopora'), ('Stylophora','stylophora'), ('Pocillopora','pocillopora'),
    ('Pavona','pavona'), ('Acropora','acropora'), ('Micromussa','micromussa')
) AS v(name, slug)
ON CONFLICT (slug) DO NOTHING;

-- Morphs (attached directly under their genus; species level omitted where the
-- hobby name doesn't pin one, which the hierarchy permits).
INSERT INTO taxon_nodes (parent_id, rank_code, name, slug,
    care_difficulty_code, light_level_code, flow_level_code, growth_form_code, placement, description)
SELECT g.id, 'morph', m.name, m.slug, m.diff, m.light, m.flow, m.gf, m.placement, m.descr
FROM (VALUES
    -- Softies
    ('zoanthus','Fire & Ice Zoanthid','fire-and-ice-zoa','easy','medium','medium','encrusting','Low to mid rock','Blue-faced zoanthid with an orange-red skirt.'),
    ('zoanthus','Utter Chaos Zoanthid','utter-chaos-zoa','easy','medium','medium','encrusting','Low to mid rock','Multicolor zoanthid — purple, red, gold and green.'),
    ('zoanthus','Rasta Zoanthid','rasta-zoa','easy','medium','medium','encrusting','Low to mid rock','Green face with a red-orange skirt.'),
    ('palythoa','Grandis Paly','grandis-paly','easy','medium','medium','encrusting','Low rock','Large paly with concentric ring coloration.'),
    ('briareum','Green Star Polyps','green-star-polyps','easy','low','medium','encrusting','Low rock / bare bottom','Fast-spreading neon-green polyp mat.'),
    ('sarcophyton','Toadstool Leather','toadstool-leather','easy','medium','low','massive','Mid rock','Mushroom-shaped leather with a tan cap.'),
    ('sinularia','Green Finger Leather','green-finger-leather','easy','medium','medium','branching','Mid rock','Finger-lobed green leather coral.'),
    ('xenia','Pulsing Xenia','pulsing-xenia','easy','medium','medium','branching','Mid rock','Cream polyps that pulse rhythmically.'),
    ('clavularia','Clove Polyps','clove-polyps','easy','low','medium','encrusting','Low rock','Eight-tentacle brown-green clove polyps.'),
    ('discosoma','Red Mushroom','red-mushroom','easy','low','low','encrusting','Low rock / sand','Deep-red discosoma mushroom.'),
    ('rhodactis','OG Bounce Mushroom','og-bounce-mushroom','moderate','low','low','encrusting','Low rock / sand','Green rhodactis with raised bubble vesicles.'),
    ('ricordea','Ricordea Yuma','ricordea-yuma','moderate','medium','low','encrusting','Low rock','Pacific ricordea with orange-green bubbles.'),
    ('ricordea','Ricordea Florida','ricordea-florida','easy','medium','low','encrusting','Low rock / sand','Caribbean ricordea, blue-green.'),
    -- LPS
    ('euphyllia','Gold Torch','gold-torch','moderate','medium','low','branching','Mid rock, space to sweep','Long tentacles with gold tips.'),
    ('euphyllia','Hammer Coral','hammer-coral','easy','medium','low','branching','Mid rock','Hammer/anchor-tipped tentacles.'),
    ('euphyllia','Frogspawn','frogspawn','easy','medium','low','branching','Mid rock','Branching tentacles with rounded tips.'),
    ('duncanopsammia','Duncan Coral','duncan-coral','easy','medium','medium','branching','Low to mid rock','Green discs with orange centers; hardy.'),
    ('caulastraea','Candy Cane','candy-cane','easy','medium','low','branching','Low to mid rock','Trumpet corallites with teal-cream stripes.'),
    ('micromussa','Sunset Micromussa','sunset-micromussa','easy','low','low','submassive','Low rock / sand','Acan with orange-to-purple oral discs.'),
    ('blastomussa','Blasto Merletti','blasto-merletti','easy','low','low','submassive','Low rock / sand','Small-polyp blasto, red rim / green center.'),
    ('trachyphyllia','Rainbow Trachy','rainbow-trachy','easy','low','low','massive','Sand bed','Free-living open brain with rainbow flesh.'),
    ('lobophyllia','Meat Coral','meat-coral','easy','low','low','massive','Low rock / sand','Fleshy brain, mottled red-green.'),
    ('dipsastraea','War Coral','war-coral','moderate','medium','low','massive','Mid rock','Favia brain with red-green "war" contrast.'),
    ('goniopora','Red Goniopora','red-goniopora','moderate','medium','medium','massive','Sand bed','Flowerpot coral with long red polyps.'),
    ('turbinaria','Yellow Scroll','yellow-scroll','easy','medium','medium','plating_laminar','Mid rock','Cup/scroll coral, mustard-yellow.'),
    ('cycloseris','Plate Coral','plate-coral','easy','low','low','massive','Sand bed','Free-living disc plate coral.'),
    -- SPS
    ('montipora','Red Cap Montipora','red-cap-montipora','moderate','high','medium','plating_laminar','Mid to upper rock','Plating monti, red skin with green polyps.'),
    ('montipora','Green Digitata','green-digitata','moderate','high','high','digitate','Upper rock','Finger-like green digitate montipora.'),
    ('montipora','Sunset Montipora','sunset-montipora','moderate','high','medium','encrusting','Mid to upper rock','Encrusting monti, orange body with red polyps.'),
    ('acropora','Walt Disney Acropora','walt-disney-acropora','difficult','high','high','branching','Upper rock, high flow','Multicolor tabling Acropora; lavender, lime and gold.'),
    ('acropora','Green Slimer','green-slimer','moderate','high','high','branching','Upper rock','Hardy neon-green staghorn Acropora.'),
    ('acropora','Tricolor Valida','tricolor-valida','moderate','high','high','branching','Upper rock','Acropora valida with purple tips and green base.'),
    ('seriatopora','Bird''s Nest','birds-nest','moderate','high','high','branching','Upper rock','Thin-branched pink birdsnest.'),
    ('stylophora','Milka Stylophora','milka-stylophora','moderate','high','high','branching','Mid to upper rock','Pastel purple cats-paw stylophora.'),
    ('pocillopora','Pocillopora','pocillopora','easy','high','high','branching','Mid to upper rock','Hardy pink-brown cauliflower coral.'),
    ('pavona','Pavona Cactus','pavona-cactus','moderate','medium','medium','foliose','Mid rock','Folded green cactus/lettuce coral.')
) AS m(genus_slug, name, slug, diff, light, flow, gf, placement, descr)
JOIN taxon_nodes g ON g.slug = m.genus_slug
ON CONFLICT (slug) DO NOTHING;

-- Helper: attach a signature element + coloration to a morph (idempotent).
CREATE OR REPLACE FUNCTION public.seed_coral_color(
    p_slug text, p_element text, p_desc text,
    p_pattern text, p_label text, p_hexes text[]
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_taxon uuid; v_profile uuid; v_range uuid; i int;
BEGIN
    SELECT id INTO v_taxon FROM taxon_nodes WHERE slug = p_slug;
    IF v_taxon IS NULL THEN RETURN; END IF;
    INSERT INTO element_profiles (taxon_node_id, element_type_code, description)
        VALUES (v_taxon, p_element, p_desc)
        ON CONFLICT (taxon_node_id, element_type_code) DO UPDATE SET description = EXCLUDED.description
        RETURNING id INTO v_profile;
    IF EXISTS (SELECT 1 FROM color_ranges WHERE element_profile_id = v_profile AND label = p_label) THEN
        RETURN;
    END IF;
    INSERT INTO color_ranges (element_profile_id, color_pattern_code, label)
        VALUES (v_profile, p_pattern, p_label) RETURNING id INTO v_range;
    FOR i IN 1 .. array_length(p_hexes, 1) LOOP
        INSERT INTO color_stops (color_range_id, ordinal, hex) VALUES (v_range, i - 1, upper(p_hexes[i]));
    END LOOP;
END $$;

-- Signature colorations (provisional hexes).
SELECT public.seed_coral_color('fire-and-ice-zoa','mouth_oral_disc','Blue face, orange skirt.','range','Blue to orange',ARRAY['#2E6FE2','#FF7A18']);
SELECT public.seed_coral_color('utter-chaos-zoa','mouth_oral_disc','Multicolor face.','rainbow','Utter chaos',ARRAY['#7A2FBE','#E23B3B','#FFD700','#2E8B57']);
SELECT public.seed_coral_color('rasta-zoa','mouth_oral_disc','Green face, red skirt.','range','Green to red',ARRAY['#2E8B57','#E23B3B']);
SELECT public.seed_coral_color('grandis-paly','mouth_oral_disc','Concentric rings.','ringed','Grandis rings',ARRAY['#3B2A1A','#2E8B57','#FF8C00']);
SELECT public.seed_coral_color('green-star-polyps','polyp','Neon green polyps.','solid','Neon green',ARRAY['#39FF14']);
SELECT public.seed_coral_color('toadstool-leather','base_body','Tan cap.','solid','Tan body',ARRAY['#C8A96B']);
SELECT public.seed_coral_color('green-finger-leather','base_body','Green fingers.','solid','Green',ARRAY['#6FA84B']);
SELECT public.seed_coral_color('pulsing-xenia','polyp','Cream pulsing polyps.','solid','Cream',ARRAY['#E8E0C8']);
SELECT public.seed_coral_color('clove-polyps','polyp','Brown-green cloves.','solid','Brown-green',ARRAY['#5B7A3A']);
SELECT public.seed_coral_color('red-mushroom','mouth_oral_disc','Deep red disc.','solid','Deep red',ARRAY['#B02222']);
SELECT public.seed_coral_color('og-bounce-mushroom','base_body','Green with bubbles.','mottled','Green / gold bubbles',ARRAY['#2E8B57','#FFD700']);
SELECT public.seed_coral_color('ricordea-yuma','mouth_oral_disc','Orange-green bubbles.','mottled','Orange-green yuma',ARRAY['#FF8C00','#2E8B57']);
SELECT public.seed_coral_color('ricordea-florida','mouth_oral_disc','Blue-green.','spotted','Blue-green florida',ARRAY['#1E90FF','#2E8B57']);
SELECT public.seed_coral_color('gold-torch','tentacle','Gold-tipped tentacles.','tipped','Gold tips',ARRAY['#B8860B','#FFD700']);
SELECT public.seed_coral_color('hammer-coral','tentacle','Hammer-tipped tentacles.','range','Gold-green hammer',ARRAY['#2E8B57','#FFD700']);
SELECT public.seed_coral_color('frogspawn','tentacle','Rounded green tips.','tipped','Green tips',ARRAY['#2E8B57','#ADD8E6']);
SELECT public.seed_coral_color('duncan-coral','mouth_oral_disc','Green disc, orange center.','range','Green to orange',ARRAY['#2E8B57','#FF8C00']);
SELECT public.seed_coral_color('candy-cane','corallite','Teal-cream striped corallites.','banded','Teal-cream stripes',ARRAY['#008080','#FFF3D6']);
SELECT public.seed_coral_color('sunset-micromussa','mouth_oral_disc','Orange-to-purple disc.','range','Sunset',ARRAY['#FF8C00','#800080']);
SELECT public.seed_coral_color('blasto-merletti','mouth_oral_disc','Red rim, green center.','range','Red to green',ARRAY['#E23B3B','#2E8B57']);
SELECT public.seed_coral_color('rainbow-trachy','mouth_oral_disc','Rainbow flesh.','rainbow','Rainbow trach',ARRAY['#E23B3B','#FF8C00','#FFD700','#2E8B57','#1E90FF']);
SELECT public.seed_coral_color('meat-coral','mouth_oral_disc','Mottled red-green flesh.','mottled','Red-green meat',ARRAY['#B02222','#2E8B57']);
SELECT public.seed_coral_color('war-coral','corallite','Red-green contrast.','mottled','Red-green war',ARRAY['#E23B3B','#2E8B57']);
SELECT public.seed_coral_color('red-goniopora','polyp','Long red polyps.','solid','Red',ARRAY['#C0392B']);
SELECT public.seed_coral_color('yellow-scroll','base_body','Mustard-yellow.','solid','Yellow',ARRAY['#F2C200']);
SELECT public.seed_coral_color('plate-coral','mouth_oral_disc','Green disc.','solid','Green',ARRAY['#2E8B57']);
SELECT public.seed_coral_color('red-cap-montipora','base_body','Red plating skin.','solid','Red',ARRAY['#C0392B']);
SELECT public.seed_coral_color('red-cap-montipora','polyp','Contrasting green polyps.','solid','Green polyps',ARRAY['#39FF14']);
SELECT public.seed_coral_color('green-digitata','base_body','Green digitate skin.','solid','Green',ARRAY['#4CAF50']);
SELECT public.seed_coral_color('sunset-montipora','base_body','Orange body.','range','Orange to green',ARRAY['#FF8C00','#2E8B57']);
SELECT public.seed_coral_color('sunset-montipora','polyp','Red polyps.','solid','Red polyps',ARRAY['#C0392B']);
SELECT public.seed_coral_color('walt-disney-acropora','growth_tip','Blue-grey growth tips.','solid','Blue-grey tips',ARRAY['#546E7A']);
SELECT public.seed_coral_color('walt-disney-acropora','coenosarc_skin','Lime coenosarc.','solid','Lime',ARRAY['#7CB342']);
SELECT public.seed_coral_color('walt-disney-acropora','radial_corallite','Lavender radial corallites.','solid','Lavender',ARRAY['#B39DDB']);
SELECT public.seed_coral_color('green-slimer','coenosarc_skin','Neon green skin.','solid','Neon green',ARRAY['#39FF14']);
SELECT public.seed_coral_color('tricolor-valida','radial_corallite','Purple-to-blue corallites.','range','Purple to blue',ARRAY['#800080','#1E90FF']);
SELECT public.seed_coral_color('tricolor-valida','coenosarc_skin','Green base.','solid','Green base',ARRAY['#2E8B57']);
SELECT public.seed_coral_color('birds-nest','base_body','Pink branches.','solid','Pink',ARRAY['#FF69B4']);
SELECT public.seed_coral_color('milka-stylophora','base_body','Pastel purple.','solid','Milka purple',ARRAY['#9B7FD4']);
SELECT public.seed_coral_color('pocillopora','base_body','Pink-brown.','solid','Pink-brown',ARRAY['#B5726F']);
SELECT public.seed_coral_color('pavona-cactus','base_body','Folded green blades.','solid','Green',ARRAY['#6FA84B']);

DROP FUNCTION public.seed_coral_color(text, text, text, text, text, text[]);

-- =============================================================================
-- Recommended parameters (seed data accuracy pass, 2026-07-08)
-- =============================================================================
-- Every morph above was seeded with rec_alkalinity_dkh_min/max etc. left
-- NULL, so the wiki's "Recommended parameters" table rendered as all dashes
-- for all 36 corals. Filled in here from standard, widely-published reef
-- husbandry target ranges, grouped by care category (softies / LPS / SPS) —
-- genus-level generalizations, not individually verified per exact named
-- morph (see the file header). Plain UPDATE by slug: idempotent, safe to
-- re-run, and safe to apply retroactively to rows the INSERT above already
-- skipped via ON CONFLICT DO NOTHING.
-- =============================================================================

-- Softies: tolerate a wider swing; several actually want some standing
-- nutrients rather than none.
UPDATE taxon_nodes SET
    rec_alkalinity_dkh_min = 7,    rec_alkalinity_dkh_max = 10,
    rec_calcium_ppm_min    = 380,  rec_calcium_ppm_max    = 430,
    rec_magnesium_ppm_min  = 1250, rec_magnesium_ppm_max  = 1350,
    rec_nitrate_ppm_min    = 2,    rec_nitrate_ppm_max    = 10,
    rec_phosphate_ppm_min  = 0.05, rec_phosphate_ppm_max  = 0.15,
    rec_temperature_c_min  = 24,   rec_temperature_c_max  = 27
WHERE slug IN (
    'fire-and-ice-zoa','utter-chaos-zoa','rasta-zoa','grandis-paly',
    'green-star-polyps','toadstool-leather','green-finger-leather',
    'pulsing-xenia','clove-polyps','red-mushroom','og-bounce-mushroom',
    'ricordea-yuma','ricordea-florida'
);

-- LPS: moderate, fairly stable range; most want low-to-moderate nutrients.
UPDATE taxon_nodes SET
    rec_alkalinity_dkh_min = 8,    rec_alkalinity_dkh_max = 11,
    rec_calcium_ppm_min    = 400,  rec_calcium_ppm_max    = 440,
    rec_magnesium_ppm_min  = 1300, rec_magnesium_ppm_max  = 1400,
    rec_nitrate_ppm_min    = 1,    rec_nitrate_ppm_max    = 5,
    rec_phosphate_ppm_min  = 0.02, rec_phosphate_ppm_max  = 0.08,
    rec_temperature_c_min  = 24,   rec_temperature_c_max  = 26
WHERE slug IN (
    'gold-torch','hammer-coral','frogspawn','duncan-coral','candy-cane',
    'sunset-micromussa','blasto-merletti','rainbow-trachy','meat-coral',
    'war-coral','red-goniopora','yellow-scroll','plate-coral',
    -- Rainbow Acan is the schema's own worked example (coral_trait_schema.sql
    -- §6), not part of the 36 morphs seeded above, but it's the same
    -- Micromussa/Acan-type LPS profile as sunset-micromussa and shipped live
    -- with the same NULL recommended-parameters gap.
    'rainbow-acan'
);

-- SPS: narrower, more stable range; low nutrients, but not zero.
UPDATE taxon_nodes SET
    rec_alkalinity_dkh_min = 8,    rec_alkalinity_dkh_max = 9.5,
    rec_calcium_ppm_min    = 420,  rec_calcium_ppm_max    = 450,
    rec_magnesium_ppm_min  = 1300, rec_magnesium_ppm_max  = 1400,
    rec_nitrate_ppm_min    = 0.5,  rec_nitrate_ppm_max    = 3,
    rec_phosphate_ppm_min  = 0.03, rec_phosphate_ppm_max  = 0.07,
    rec_temperature_c_min  = 25,   rec_temperature_c_max  = 27
WHERE slug IN (
    'red-cap-montipora','green-digitata','sunset-montipora',
    'walt-disney-acropora','green-slimer','tricolor-valida','birds-nest',
    'milka-stylophora','pocillopora','pavona-cactus'
);

-- Reusable "not sure which genus" bucket for /identify's brand-new-morph
-- path (id_suggestions_new_morph_needs_genus requires a genus even when the
-- proposer doesn't know it) — mirrored in
-- sql/supabase/15_unknown_genus_placeholder.sql for the already-live project.
-- Hidden from the public wiki grid (is_visible = false).
INSERT INTO taxon_nodes (parent_id, rank_code, name, slug, is_visible)
SELECT id, 'genus', 'Genus unknown', 'genus-unknown', false
FROM taxon_nodes
WHERE rank_code = 'category' AND slug = 'coral'
ON CONFLICT (slug) DO NOTHING;
