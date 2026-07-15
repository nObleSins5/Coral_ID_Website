-- =============================================================================
-- Phase 0 seed — curated easy-ID corals (PROVISIONAL)
-- =============================================================================
-- 100+ common, easy-to-identify hobby corals across the naming hierarchy
-- (Coral category -> genus -> morph), each with care guidance and a signature
-- element coloration, so the wiki / Door 1 features have real content.
-- Started at ~36 (2026-07-06); expanded to 100+ (2026-07-15, still spanning
-- the same 27 genera rather than adding new ones) to give the identify-MVP
-- color-match funnel a real spread to match against ahead of a deeper
-- real-photo testing pass.
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
    ('zoanthus','Rasta Zoanthid','rasta-zoa','easy','medium','medium','encrusting','Low to mid rock','Orange face with an olive-green skirt.'),
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
    ('pavona','Pavona Cactus','pavona-cactus','moderate','medium','medium','foliose','Mid rock','Folded green cactus/lettuce coral.'),
    -- =========================================================================
    -- Expansion pass (2026-07-15) — same provisional-data caveats as above
    -- (real hobby names, placeholder hexes). Broadens coverage across all 27
    -- existing genera rather than adding new ones, so the identify-MVP color
    -- funnel has a real spread to match against. See docs/PROGRESS.md.
    -- =========================================================================
    -- SPS
    ('acropora','Miyagi Tort Acropora','miyagi-tort-acropora','difficult','high','high','tabling','Upper rock, high flow','Deep purple tabling Acro with green polyps.'),
    ('acropora','Homewrecker Acropora','homewrecker-acropora','difficult','high','high','branching','Upper rock','Blue-purple branches with hot-pink polyps.'),
    ('acropora','Pink Lemonade Acropora','pink-lemonade-acropora','moderate','high','high','branching','Upper rock','Pink base fading to yellow branch tips.'),
    ('acropora','Nuclear Green Acropora','nuclear-green-acropora','moderate','high','high','branching','Upper rock','Extremely bright, uniform neon-green staghorn.'),
    ('acropora','Ultra Fiji Purple Acropora','ultra-fiji-purple-acropora','difficult','high','high','branching','Upper rock, high flow','Deep purple branches with blue growth tips.'),
    ('acropora','Sunset Acropora','sunset-acropora','difficult','high','high','tabling','Upper rock','Orange-pink tabling Acro with cream polyps.'),
    ('acropora','Bali Slimer','bali-slimer','moderate','high','high','branching','Upper rock','Two-tone green-and-gold staghorn.'),
    ('montipora','Superman Montipora','superman-montipora','moderate','high','medium','plating_laminar','Mid to upper rock','Blue plating skin with red polyps.'),
    ('montipora','Rainbow Montipora','rainbow-montipora','moderate','high','medium','encrusting','Mid rock','Multicolor encrusting cap — purple, green and pink patches.'),
    ('montipora','Miami Hurricane Montipora','miami-hurricane-montipora','moderate','high','medium','plating_laminar','Mid to upper rock','Orange-red plate with green polyps.'),
    ('montipora','Confetti Montipora','confetti-montipora','moderate','high','medium','encrusting','Mid rock','Speckled cream-and-purple encrusting montipora.'),
    ('montipora','Undata Montipora','undata-montipora','moderate','high','high','digitate','Upper rock','Thick green digitate growth, hardier than most digitata.'),
    ('seriatopora','Green Bird''s Nest','green-birds-nest','moderate','high','high','branching','Upper rock','Thin-branched green birdsnest.'),
    ('seriatopora','Pink Tipped Bird''s Nest','pink-tipped-birds-nest','moderate','high','high','branching','Upper rock','Pale branches with hot-pink growth tips.'),
    ('stylophora','Pink Cats Paw Stylophora','pink-cats-paw-stylophora','moderate','high','high','branching','Mid to upper rock','Classic bubblegum-pink cats-paw stylophora.'),
    ('stylophora','Green Stylophora','green-stylophora','moderate','high','high','branching','Mid to upper rock','Hardy green cats-paw stylophora.'),
    ('pocillopora','Pink Cauliflower Pocillopora','pink-cauliflower-pocillopora','easy','high','high','branching','Mid to upper rock','Vivid pink cauliflower coral.'),
    ('pocillopora','Green Cauliflower Pocillopora','green-cauliflower-pocillopora','easy','high','high','branching','Mid to upper rock','Green-brown cauliflower coral.'),
    ('pavona','Pavona Danai','pavona-danai','moderate','medium','medium','plating_laminar','Mid rock','Chunky green-brown plating pavona.'),
    ('pavona','Pavona Duerdeni','pavona-duerdeni','moderate','medium','medium','massive','Mid rock','Bumpy massive pavona, tan-green.'),
    -- LPS
    ('euphyllia','Green Torch','green-torch','moderate','medium','low','branching','Mid rock, space to sweep','Green torch coral with sweeper tentacles.'),
    ('euphyllia','Purple Hammer','purple-hammer','easy','medium','low','branching','Mid rock','Deep purple hammer coral.'),
    ('euphyllia','Orange Frogspawn','orange-frogspawn','easy','medium','low','branching','Mid rock','Orange-tipped branching frogspawn.'),
    ('duncanopsammia','Whisker Coral','whisker-coral','easy','medium','medium','branching','Low to mid rock','Duncan-like polyps with long clear-white "whisker" tentacles.'),
    ('caulastraea','Green Trumpet Coral','green-trumpet-coral','easy','medium','low','branching','Low to mid rock','All-green trumpet-shaped corallites.'),
    ('caulastraea','Neon Candy Cane','neon-candy-cane','easy','medium','low','branching','Low to mid rock','Bright green-and-purple striped trumpet coral.'),
    ('micromussa','Rainbow Micromussa','rainbow-micromussa','easy','low','low','submassive','Low rock / sand','Multicolor acan-type with red, orange and green discs.'),
    ('micromussa','Purple People Eater Micromussa','purple-people-eater-micromussa','easy','low','low','submassive','Low rock / sand','Deep purple oral discs.'),
    ('micromussa','War Micromussa','war-micromussa','easy','low','low','submassive','Low rock / sand','Red rim, green center, high contrast.'),
    ('micromussa','Bubblegum Micromussa','bubblegum-micromussa','easy','low','low','submassive','Low rock / sand','Solid pink oral discs.'),
    ('blastomussa','Blasto Wellsi','blasto-wellsi','easy','low','low','submassive','Low rock / sand','Larger-polyp blastomussa, orange-red.'),
    ('blastomussa','Green Blastomussa','green-blastomussa','easy','low','low','submassive','Low rock / sand','All-green blasto merletti variant.'),
    ('trachyphyllia','Green Trachyphyllia','green-trachyphyllia','easy','low','low','massive','Sand bed','Open brain coral, uniform green flesh.'),
    ('lobophyllia','Rainbow Lobophyllia','rainbow-lobophyllia','easy','low','low','massive','Low rock / sand','Multicolor fleshy brain coral.'),
    ('lobophyllia','Green Lobophyllia','green-lobophyllia','easy','low','low','massive','Low rock / sand','Solid green fleshy brain coral.'),
    ('dipsastraea','Rainbow Favia','rainbow-favia','moderate','medium','low','massive','Mid rock','Multicolor favia with distinct corallite rings.'),
    ('goniopora','Green Goniopora','green-goniopora','moderate','medium','medium','massive','Sand bed','Long green flowing polyps.'),
    ('goniopora','Pink Goniopora','pink-goniopora','moderate','medium','medium','massive','Sand bed','Pastel-pink flowerpot coral.'),
    ('turbinaria','Green Cup Turbinaria','green-cup-turbinaria','easy','medium','medium','plating_laminar','Mid rock','Green cup/scroll coral.'),
    ('cycloseris','Red Plate Coral','red-plate-coral','easy','low','low','massive','Sand bed','Free-living disc coral, deep red.'),
    -- Mushroom
    ('discosoma','Green Hairy Mushroom','green-hairy-mushroom','easy','low','low','encrusting','Low rock / sand','Green discosoma with fine tentacle fringe.'),
    ('discosoma','Purple People Eater Mushroom','purple-mushroom','easy','low','low','encrusting','Low rock / sand','Deep purple discosoma.'),
    ('discosoma','Rainbow Mushroom','rainbow-mushroom','easy','low','low','encrusting','Low rock / sand','Multicolor speckled discosoma.'),
    ('rhodactis','Red Rhodactis','red-rhodactis','moderate','low','low','encrusting','Low rock / sand','Deep-red bounce mushroom.'),
    ('rhodactis','Green Bullseye Mushroom','green-bullseye-mushroom','moderate','low','low','encrusting','Low rock / sand','Green mushroom with a distinct darker center ring.'),
    ('ricordea','Rainbow Ricordea','rainbow-ricordea','moderate','medium','low','encrusting','Low rock','Multicolor yuma ricordea — orange, pink and green patches.'),
    ('ricordea','Blue Ricordea Florida','blue-ricordea-florida','easy','medium','low','encrusting','Low rock / sand','Uniform electric-blue Caribbean ricordea.'),
    -- Leather
    ('sarcophyton','Green Toadstool Leather','green-toadstool-leather','easy','medium','low','massive','Mid rock','Green-capped toadstool leather.'),
    ('sarcophyton','Neon Green Sarcophyton','neon-sarcophyton','easy','medium','low','massive','Mid rock','Bright neon-green toadstool cap.'),
    ('sinularia','Flower Tree Leather','flower-tree-leather','easy','medium','medium','branching','Mid rock','Tan-brown branching leather with flower-like polyps.'),
    ('sinularia','Devil''s Hand Leather','devils-hand-leather','easy','medium','medium','branching','Mid rock','Broad-lobed brown leather coral resembling a hand.'),
    -- Zoanthid
    ('zoanthus','Superman Zoa','superman-zoa','easy','medium','medium','encrusting','Low to mid rock','Blue face with a bold red skirt.'),
    ('zoanthus','Eagle Eye Zoa','eagle-eye-zoa','easy','medium','medium','encrusting','Low to mid rock','Yellow-green face with an orange ring.'),
    ('zoanthus','Radioactive Dragon Eye Zoa','radioactive-dragon-eye-zoa','easy','medium','medium','encrusting','Low to mid rock','Neon-green face, near-black skirt.'),
    ('zoanthus','Purple People Eater Zoa','purple-people-eater-zoa','easy','medium','medium','encrusting','Low to mid rock','Solid deep-purple polyps.'),
    ('zoanthus','Pink Panther Zoa','pink-panther-zoa','easy','medium','medium','encrusting','Low to mid rock','Pink face with a cream skirt.'),
    ('zoanthus','Blue Hornet Zoa','blue-hornet-zoa','easy','medium','medium','encrusting','Low to mid rock','Blue-grey face with yellow skirt banding.'),
    ('palythoa','President Lincoln Paly','president-lincoln-paly','easy','medium','medium','encrusting','Low rock','Deep brown-red polyps with a cream rim.'),
    ('palythoa','Space Monster Paly','space-monster-paly','easy','medium','medium','encrusting','Low rock','Dark-green polyps with a purple-ringed mouth.'),
    ('palythoa','Atomic Green Paly','atomic-green-paly','easy','medium','medium','encrusting','Low rock','Uniform bright-green polyps.'),
    -- Soft coral
    ('xenia','Red Xenia','red-xenia','easy','medium','medium','branching','Mid rock','Pulsing xenia with a reddish stalk.'),
    ('xenia','Blue Xenia','blue-xenia','easy','medium','medium','branching','Mid rock','Pulsing xenia with a blue-grey cast.'),
    ('clavularia','Green Clove Polyps','green-clove-polyps','easy','low','medium','encrusting','Low rock','All-green eight-tentacle clove polyps.'),
    ('briareum','Purple Star Polyps','purple-star-polyps','easy','low','medium','encrusting','Low rock / bare bottom','Fast-spreading mat with reddish-purple polyps.')
) AS m(genus_slug, name, slug, diff, light, flow, gf, placement, descr)
JOIN taxon_nodes g ON g.slug = m.genus_slug
ON CONFLICT (slug) DO NOTHING;

-- Helper: attach a distinct coloration to a morph (idempotent). p_element is
-- a suggested position label (element_types.code) — NULL is valid ("just a
-- distinct color, no specific region claimed"). Colors hang directly off
-- the taxon, not through element_profiles (2026-07-12 decoupling).
-- p_lighting (added for 26_color_lighting_condition.sql) is optional and
-- defaults to NULL/unrecorded — only pass it when it's a directly observable
-- fact about a real reference photo (e.g. rasta-zoa below), never a guess.
CREATE OR REPLACE FUNCTION public.seed_coral_color(
    p_slug text, p_element text, p_desc text,
    p_pattern text, p_label text, p_hexes text[],
    p_lighting text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_taxon uuid; v_range uuid; i int;
BEGIN
    SELECT id INTO v_taxon FROM taxon_nodes WHERE slug = p_slug;
    IF v_taxon IS NULL THEN RETURN; END IF;
    IF EXISTS (SELECT 1 FROM color_ranges WHERE taxon_node_id = v_taxon AND label = p_label) THEN
        RETURN;
    END IF;
    INSERT INTO color_ranges (taxon_node_id, position_label, color_pattern_code, label, notes, lighting_condition)
        VALUES (v_taxon, NULLIF(p_element, ''), p_pattern, p_label, NULLIF(p_desc, ''), p_lighting)
        RETURNING id INTO v_range;
    FOR i IN 1 .. array_length(p_hexes, 1) LOOP
        INSERT INTO color_stops (color_range_id, ordinal, hex) VALUES (v_range, i - 1, upper(p_hexes[i]));
    END LOOP;
END $$;

-- Signature colorations (provisional hexes).
-- Zoas/palys: face + skirt are distinct, usually-solid regions, not a blend
-- (2026-07-12 realignment) — see docs/schema-decisions.md.
SELECT public.seed_coral_color('fire-and-ice-zoa','oral_disc_center','Blue face.','solid','Blue face',ARRAY['#2E6FE2']);
SELECT public.seed_coral_color('fire-and-ice-zoa','skirt_1','Orange-red skirt.','solid','Orange skirt',ARRAY['#FF7A18']);
-- Utter Chaos really does show 4 distinct skirt colors, not an abstract
-- "rainbow" label — 3 fit the suggested skirt_1/2/3 slots, the 4th is an
-- extra unlabeled distinct color (position NULL is valid).
SELECT public.seed_coral_color('utter-chaos-zoa','skirt_1',NULL,'solid','Skirt — purple',ARRAY['#7A2FBE']);
SELECT public.seed_coral_color('utter-chaos-zoa','skirt_2',NULL,'solid','Skirt — red',ARRAY['#E23B3B']);
SELECT public.seed_coral_color('utter-chaos-zoa','skirt_3',NULL,'solid','Skirt — gold',ARRAY['#FFD700']);
SELECT public.seed_coral_color('utter-chaos-zoa',NULL,'A 4th distinct skirt color beyond the 3 suggested slots.','solid','Skirt — green',ARRAY['#2E8B57']);
-- Corrected 2026-07-14 from the coral's own confirmed reference photo
-- (pixel-sampled, not externally cited) — the photo shows an orange/gold
-- face and an olive-green skirt with zero red present. See
-- sql/supabase/25_correct_rasta_zoa_colors.sql. lighting_condition is
-- 'actinic' because the reference photo's black background + fluorescing
-- colors are the standard visual signature of blue-LED reef photography, a
-- directly observable fact about that photo (see 26_color_lighting_condition.sql).
SELECT public.seed_coral_color('rasta-zoa','oral_disc_center','Orange face.','solid','Orange face',ARRAY['#F28C00'],'actinic');
SELECT public.seed_coral_color('rasta-zoa','skirt_1','Olive-green skirt.','solid','Olive-green skirt',ARRAY['#5B7A3A'],'actinic');
SELECT public.seed_coral_color('grandis-paly','oral_disc_center','Dark center.','solid','Dark center',ARRAY['#3B2A1A']);
SELECT public.seed_coral_color('grandis-paly','skirt_1','Concentric rings within the skirt.','ringed','Grandis rings',ARRAY['#2E8B57','#FF8C00']);
SELECT public.seed_coral_color('green-star-polyps','tentacle','Neon green polyps.','solid','Neon green',ARRAY['#39FF14']);
SELECT public.seed_coral_color('toadstool-leather','base_body','Tan cap.','solid','Tan body',ARRAY['#C8A96B']);
SELECT public.seed_coral_color('green-finger-leather','base_body','Green fingers.','solid','Green',ARRAY['#6FA84B']);
SELECT public.seed_coral_color('pulsing-xenia','tentacle','Cream pulsing polyps.','solid','Cream',ARRAY['#E8E0C8']);
SELECT public.seed_coral_color('clove-polyps','tentacle','Brown-green cloves.','solid','Brown-green',ARRAY['#5B7A3A']);
SELECT public.seed_coral_color('red-mushroom','oral_disc_center','Deep red disc.','solid','Deep red',ARRAY['#B02222']);
SELECT public.seed_coral_color('og-bounce-mushroom','base_body','Green with bubbles.','mottled','Green / gold bubbles',ARRAY['#2E8B57','#FFD700']);
UPDATE taxon_nodes SET has_bubble_texture = true WHERE slug = 'og-bounce-mushroom';
SELECT public.seed_coral_color('ricordea-yuma','oral_disc_center','Orange-green bubbles.','mottled','Orange-green yuma',ARRAY['#FF8C00','#2E8B57']);
SELECT public.seed_coral_color('ricordea-florida','oral_disc_center','Blue-green.','spotted','Blue-green florida',ARRAY['#1E90FF','#2E8B57']);
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
SELECT public.seed_coral_color('red-goniopora','tentacle','Long red polyps.','solid','Red',ARRAY['#C0392B']);
SELECT public.seed_coral_color('yellow-scroll','base_body','Mustard-yellow.','solid','Yellow',ARRAY['#F2C200']);
SELECT public.seed_coral_color('plate-coral','mouth_oral_disc','Green disc.','solid','Green',ARRAY['#2E8B57']);
SELECT public.seed_coral_color('red-cap-montipora','base_body','Red plating skin.','solid','Red',ARRAY['#C0392B']);
SELECT public.seed_coral_color('red-cap-montipora','tentacle','Contrasting green polyps.','solid','Green polyps',ARRAY['#39FF14']);
SELECT public.seed_coral_color('green-digitata','base_body','Green digitate skin.','solid','Green',ARRAY['#4CAF50']);
SELECT public.seed_coral_color('sunset-montipora','base_body','Orange body.','range','Orange to green',ARRAY['#FF8C00','#2E8B57']);
SELECT public.seed_coral_color('sunset-montipora','tentacle','Red polyps.','solid','Red polyps',ARRAY['#C0392B']);
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

-- Expansion pass (2026-07-15) colorations — same provisional-placeholder
-- caveat as everything above.
-- SPS
SELECT public.seed_coral_color('miyagi-tort-acropora','growth_tip','Purple tips.','solid','Purple tips',ARRAY['#4B0082']);
SELECT public.seed_coral_color('miyagi-tort-acropora','coenosarc_skin','Green polyps.','solid','Green polyps',ARRAY['#39FF14']);
SELECT public.seed_coral_color('homewrecker-acropora','coenosarc_skin','Blue-purple base.','solid','Blue-purple',ARRAY['#5B4FCF']);
SELECT public.seed_coral_color('homewrecker-acropora','radial_corallite','Hot-pink polyps.','solid','Pink polyps',ARRAY['#FF69B4']);
SELECT public.seed_coral_color('pink-lemonade-acropora','coenosarc_skin','Pink fading to yellow.','range','Pink to yellow',ARRAY['#FF69B4','#FFD700']);
SELECT public.seed_coral_color('nuclear-green-acropora','coenosarc_skin','Neon green.','solid','Neon green',ARRAY['#39FF14']);
SELECT public.seed_coral_color('ultra-fiji-purple-acropora','coenosarc_skin','Deep purple.','solid','Purple',ARRAY['#800080']);
SELECT public.seed_coral_color('ultra-fiji-purple-acropora','growth_tip','Blue tips.','solid','Blue tips',ARRAY['#1E90FF']);
SELECT public.seed_coral_color('sunset-acropora','coenosarc_skin','Orange to pink.','range','Orange to pink',ARRAY['#FF8C00','#FF69B4']);
SELECT public.seed_coral_color('sunset-acropora','radial_corallite','Cream polyps.','solid','Cream polyps',ARRAY['#FFF3D6']);
SELECT public.seed_coral_color('bali-slimer','coenosarc_skin','Green to gold.','range','Green to gold',ARRAY['#2E8B57','#FFD700']);
SELECT public.seed_coral_color('superman-montipora','coenosarc_skin','Blue plating skin.','solid','Blue',ARRAY['#1E90FF']);
SELECT public.seed_coral_color('superman-montipora','radial_corallite','Red polyps.','solid','Red polyps',ARRAY['#E23B3B']);
SELECT public.seed_coral_color('rainbow-montipora','coenosarc_skin','Purple, green and pink patches.','rainbow','Rainbow monti',ARRAY['#800080','#2E8B57','#FF69B4']);
SELECT public.seed_coral_color('miami-hurricane-montipora','coenosarc_skin','Orange plate.','solid','Orange',ARRAY['#FF8C00']);
SELECT public.seed_coral_color('miami-hurricane-montipora','radial_corallite','Green polyps.','solid','Green polyps',ARRAY['#2E8B57']);
SELECT public.seed_coral_color('confetti-montipora','coenosarc_skin','Cream base, purple speckles.','spotted','Confetti',ARRAY['#FFF3D6','#800080']);
SELECT public.seed_coral_color('undata-montipora','coenosarc_skin','Thick green growth.','solid','Green',ARRAY['#4CAF50']);
SELECT public.seed_coral_color('green-birds-nest','base_body','Green branches.','solid','Green',ARRAY['#39FF14']);
SELECT public.seed_coral_color('pink-tipped-birds-nest','base_body','Pale cream base.','solid','Cream base',ARRAY['#FFF3D6']);
SELECT public.seed_coral_color('pink-tipped-birds-nest','growth_tip','Pink tips.','solid','Pink tips',ARRAY['#FF69B4']);
SELECT public.seed_coral_color('pink-cats-paw-stylophora','base_body','Bubblegum pink.','solid','Pink',ARRAY['#FF69B4']);
SELECT public.seed_coral_color('green-stylophora','base_body','Hardy green.','solid','Green',ARRAY['#4CAF50']);
SELECT public.seed_coral_color('pink-cauliflower-pocillopora','base_body','Vivid pink.','solid','Pink',ARRAY['#FF69B4']);
SELECT public.seed_coral_color('green-cauliflower-pocillopora','base_body','Green-brown.','solid','Green-brown',ARRAY['#6FA84B']);
SELECT public.seed_coral_color('pavona-danai','base_body','Green-brown plate.','solid','Green-brown',ARRAY['#5B7A3A']);
SELECT public.seed_coral_color('pavona-duerdeni','base_body','Tan-green, bumpy.','solid','Tan-green',ARRAY['#6FA84B']);
-- LPS
SELECT public.seed_coral_color('green-torch','tentacle','Green tips.','solid','Green tips',ARRAY['#2E8B57']);
SELECT public.seed_coral_color('purple-hammer','tentacle','Deep purple.','solid','Purple',ARRAY['#7A2FBE']);
SELECT public.seed_coral_color('orange-frogspawn','tentacle','Orange tips.','solid','Orange tips',ARRAY['#FF8C00']);
SELECT public.seed_coral_color('whisker-coral','tentacle','Clear-white whiskers.','solid','White',ARRAY['#FFFFFF']);
SELECT public.seed_coral_color('whisker-coral','mouth_oral_disc','Green disc.','solid','Green disc',ARRAY['#2E8B57']);
SELECT public.seed_coral_color('green-trumpet-coral','corallite','All-green corallites.','solid','Green',ARRAY['#4CAF50']);
SELECT public.seed_coral_color('neon-candy-cane','corallite','Green-purple stripes.','banded','Green-purple stripes',ARRAY['#39FF14','#800080']);
SELECT public.seed_coral_color('rainbow-micromussa','mouth_oral_disc','Red, orange and green.','rainbow','Rainbow',ARRAY['#E23B3B','#FF8C00','#2E8B57']);
SELECT public.seed_coral_color('purple-people-eater-micromussa','mouth_oral_disc','Deep purple.','solid','Purple',ARRAY['#800080']);
SELECT public.seed_coral_color('war-micromussa','mouth_oral_disc','Red to green.','range','Red to green',ARRAY['#E23B3B','#2E8B57']);
SELECT public.seed_coral_color('bubblegum-micromussa','mouth_oral_disc','Solid pink.','solid','Pink',ARRAY['#FF69B4']);
SELECT public.seed_coral_color('blasto-wellsi','mouth_oral_disc','Orange-red.','solid','Orange-red',ARRAY['#C0392B']);
SELECT public.seed_coral_color('green-blastomussa','mouth_oral_disc','All-green.','solid','Green',ARRAY['#2E8B57']);
SELECT public.seed_coral_color('green-trachyphyllia','mouth_oral_disc','Uniform green flesh.','solid','Green',ARRAY['#4CAF50']);
SELECT public.seed_coral_color('rainbow-lobophyllia','mouth_oral_disc','Multicolor flesh.','rainbow','Rainbow',ARRAY['#E23B3B','#FFD700','#2E8B57']);
SELECT public.seed_coral_color('green-lobophyllia','mouth_oral_disc','Solid green flesh.','solid','Green',ARRAY['#5B7A3A']);
SELECT public.seed_coral_color('rainbow-favia','corallite','Multicolor rings.','rainbow','Rainbow',ARRAY['#E23B3B','#FFD700','#2E8B57','#1E90FF']);
SELECT public.seed_coral_color('green-goniopora','tentacle','Long green polyps.','solid','Green',ARRAY['#4CAF50']);
SELECT public.seed_coral_color('pink-goniopora','tentacle','Pastel pink polyps.','solid','Pink',ARRAY['#FF69B4']);
SELECT public.seed_coral_color('green-cup-turbinaria','base_body','Green cup.','solid','Green',ARRAY['#2E8B57']);
SELECT public.seed_coral_color('red-plate-coral','mouth_oral_disc','Deep red disc.','solid','Red',ARRAY['#E23B3B']);
-- Mushroom
SELECT public.seed_coral_color('green-hairy-mushroom','oral_disc_center','Green disc.','solid','Green',ARRAY['#2E8B57']);
SELECT public.seed_coral_color('purple-mushroom','oral_disc_center','Deep purple.','solid','Purple',ARRAY['#800080']);
SELECT public.seed_coral_color('rainbow-mushroom','oral_disc_center','Multicolor speckles.','spotted','Rainbow speckle',ARRAY['#FF8C00','#2E8B57']);
SELECT public.seed_coral_color('red-rhodactis','oral_disc_center','Deep red.','solid','Red',ARRAY['#B02222']);
SELECT public.seed_coral_color('green-bullseye-mushroom','oral_disc_center','Green with a dark center ring.','ringed','Bullseye',ARRAY['#2E8B57','#3B2A1A']);
SELECT public.seed_coral_color('rainbow-ricordea','oral_disc_center','Orange, pink and green patches.','rainbow','Rainbow',ARRAY['#FF8C00','#FF69B4','#2E8B57']);
SELECT public.seed_coral_color('blue-ricordea-florida','oral_disc_center','Electric blue.','solid','Blue',ARRAY['#1E90FF']);
-- Leather
SELECT public.seed_coral_color('green-toadstool-leather','base_body','Green cap.','solid','Green',ARRAY['#6FA84B']);
SELECT public.seed_coral_color('neon-sarcophyton','base_body','Neon-green cap.','solid','Neon green',ARRAY['#39FF14']);
SELECT public.seed_coral_color('flower-tree-leather','base_body','Tan-brown.','solid','Tan-brown',ARRAY['#C8A96B']);
SELECT public.seed_coral_color('devils-hand-leather','base_body','Brown lobes.','solid','Brown',ARRAY['#8B4513']);
-- Zoanthid
SELECT public.seed_coral_color('superman-zoa','oral_disc_center','Blue face.','solid','Blue face',ARRAY['#1E90FF']);
SELECT public.seed_coral_color('superman-zoa','skirt_1','Red skirt.','solid','Red skirt',ARRAY['#E23B3B']);
SELECT public.seed_coral_color('eagle-eye-zoa','oral_disc_center','Yellow-green face.','solid','Yellow-green face',ARRAY['#7CB342']);
SELECT public.seed_coral_color('eagle-eye-zoa','skirt_1','Orange ring.','solid','Orange ring',ARRAY['#FF8C00']);
SELECT public.seed_coral_color('radioactive-dragon-eye-zoa','oral_disc_center','Neon-green face.','solid','Neon-green face',ARRAY['#39FF14']);
SELECT public.seed_coral_color('radioactive-dragon-eye-zoa','skirt_1','Near-black skirt.','solid','Near-black skirt',ARRAY['#1C1A06']);
SELECT public.seed_coral_color('purple-people-eater-zoa','oral_disc_center','Deep purple.','solid','Purple',ARRAY['#7A2FBE']);
SELECT public.seed_coral_color('pink-panther-zoa','oral_disc_center','Pink face.','solid','Pink face',ARRAY['#FF69B4']);
SELECT public.seed_coral_color('pink-panther-zoa','skirt_1','Cream skirt.','solid','Cream skirt',ARRAY['#FFF3D6']);
SELECT public.seed_coral_color('blue-hornet-zoa','oral_disc_center','Blue-grey face.','solid','Blue-grey face',ARRAY['#546E7A']);
SELECT public.seed_coral_color('blue-hornet-zoa','skirt_1','Yellow skirt.','solid','Yellow skirt',ARRAY['#FFD700']);
SELECT public.seed_coral_color('president-lincoln-paly','oral_disc_center','Brown-red.','solid','Brown-red',ARRAY['#8B4513']);
SELECT public.seed_coral_color('president-lincoln-paly','skirt_1','Cream rim.','solid','Cream rim',ARRAY['#FFF3D6']);
SELECT public.seed_coral_color('space-monster-paly','oral_disc_center','Dark green.','solid','Dark green',ARRAY['#2E8B57']);
SELECT public.seed_coral_color('space-monster-paly','skirt_1','Purple ring.','solid','Purple ring',ARRAY['#7A2FBE']);
SELECT public.seed_coral_color('atomic-green-paly','oral_disc_center','Bright green.','solid','Green',ARRAY['#39FF14']);
-- Soft coral
SELECT public.seed_coral_color('red-xenia','base_body','Red-brown stalk.','solid','Red-brown stalk',ARRAY['#8B4513']);
SELECT public.seed_coral_color('red-xenia','tentacle','Cream polyps.','solid','Cream polyps',ARRAY['#E8E0C8']);
SELECT public.seed_coral_color('blue-xenia','tentacle','Blue-grey cast.','solid','Blue-grey',ARRAY['#546E7A']);
SELECT public.seed_coral_color('green-clove-polyps','tentacle','All-green.','solid','Green',ARRAY['#4CAF50']);
SELECT public.seed_coral_color('purple-star-polyps','tentacle','Reddish-purple polyps.','solid','Reddish-purple',ARRAY['#B5726F']);

DROP FUNCTION public.seed_coral_color(text, text, text, text, text, text[], text);

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
    'ricordea-yuma','ricordea-florida',
    -- Expansion pass (2026-07-15) — mushroom/leather/zoanthid/soft-coral
    'green-hairy-mushroom','purple-mushroom','rainbow-mushroom',
    'red-rhodactis','green-bullseye-mushroom','rainbow-ricordea',
    'blue-ricordea-florida','green-toadstool-leather','neon-sarcophyton',
    'flower-tree-leather','devils-hand-leather','superman-zoa',
    'eagle-eye-zoa','radioactive-dragon-eye-zoa','purple-people-eater-zoa',
    'pink-panther-zoa','blue-hornet-zoa','president-lincoln-paly',
    'space-monster-paly','atomic-green-paly','red-xenia','blue-xenia',
    'green-clove-polyps','purple-star-polyps'
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
    'rainbow-acan',
    -- Expansion pass (2026-07-15)
    'green-torch','purple-hammer','orange-frogspawn','whisker-coral',
    'green-trumpet-coral','neon-candy-cane','rainbow-micromussa',
    'purple-people-eater-micromussa','war-micromussa','bubblegum-micromussa',
    'blasto-wellsi','green-blastomussa','green-trachyphyllia',
    'rainbow-lobophyllia','green-lobophyllia','rainbow-favia',
    'green-goniopora','pink-goniopora','green-cup-turbinaria',
    'red-plate-coral'
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
    'milka-stylophora','pocillopora','pavona-cactus',
    -- Expansion pass (2026-07-15)
    'miyagi-tort-acropora','homewrecker-acropora','pink-lemonade-acropora',
    'nuclear-green-acropora','ultra-fiji-purple-acropora','sunset-acropora',
    'bali-slimer','superman-montipora','rainbow-montipora',
    'miami-hurricane-montipora','confetti-montipora','undata-montipora',
    'green-birds-nest','pink-tipped-birds-nest','pink-cats-paw-stylophora',
    'green-stylophora','pink-cauliflower-pocillopora',
    'green-cauliflower-pocillopora','pavona-danai','pavona-duerdeni'
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

-- Genus-level care/light/flow defaults — mirrored in
-- sql/supabase/16_genus_care_defaults.sql (see that file for rationale).
-- Resolved at read time (web/lib/wiki.ts, withGenusCareDefaults) as a
-- fallback for any morph that doesn't set its own value; no existing morph
-- row is touched.
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
UPDATE taxon_nodes SET care_difficulty_code = 'moderate',  light_level_code = 'high',   flow_level_code = 'high'   WHERE rank_code = 'genus' AND slug = 'pocillopora';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'sarcophyton';
UPDATE taxon_nodes SET care_difficulty_code = 'moderate',  light_level_code = 'high',   flow_level_code = 'high'   WHERE rank_code = 'genus' AND slug = 'seriatopora';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'sinularia';
UPDATE taxon_nodes SET care_difficulty_code = 'moderate',  light_level_code = 'high',   flow_level_code = 'high'   WHERE rank_code = 'genus' AND slug = 'stylophora';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'low',    flow_level_code = 'low'    WHERE rank_code = 'genus' AND slug = 'trachyphyllia';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'turbinaria';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'xenia';
UPDATE taxon_nodes SET care_difficulty_code = 'easy',      light_level_code = 'medium', flow_level_code = 'medium' WHERE rank_code = 'genus' AND slug = 'zoanthus';

-- Anatomy templates (which elements a genus actually has) — mirrored in
-- sql/supabase/20_anatomy_templates.sql and sql/supabase/22_decouple_color_from_elements.sql
-- (see those files for rationale; polyp_soft was split 2026-07-12).
UPDATE taxon_nodes SET anatomy_template_code = 'branching_sps' WHERE rank_code = 'genus' AND slug IN
    ('acropora', 'montipora', 'pavona', 'pocillopora', 'seriatopora', 'stylophora');
UPDATE taxon_nodes SET anatomy_template_code = 'lps_corallite' WHERE rank_code = 'genus' AND slug IN
    ('blastomussa', 'caulastraea', 'cycloseris', 'dipsastraea', 'lobophyllia', 'micromussa', 'trachyphyllia', 'turbinaria');
UPDATE taxon_nodes SET anatomy_template_code = 'lps_tentacled' WHERE rank_code = 'genus' AND slug IN
    ('duncanopsammia', 'euphyllia', 'goniopora');
UPDATE taxon_nodes SET anatomy_template_code = 'zoanthid_paly' WHERE rank_code = 'genus' AND slug IN
    ('zoanthus', 'palythoa');
UPDATE taxon_nodes SET anatomy_template_code = 'mushroom_coral' WHERE rank_code = 'genus' AND slug IN
    ('discosoma', 'rhodactis', 'ricordea');
UPDATE taxon_nodes SET anatomy_template_code = 'leather_soft_coral' WHERE rank_code = 'genus' AND slug IN
    ('sarcophyton', 'sinularia');
UPDATE taxon_nodes SET anatomy_template_code = 'mat_soft_coral' WHERE rank_code = 'genus' AND slug IN
    ('briareum', 'xenia', 'clavularia');
