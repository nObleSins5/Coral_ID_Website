-- =============================================================================
-- Supabase layer — Record lighting condition on color data (26_color_lighting_condition.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the same column
-- now baked directly into coral_trait_schema.sql (the source of truth for
-- fresh installs).
--
-- Sibling to the existing (also-unused) color_ranges.approx_percent: reef
-- lighting is commonly actinic (blue-shifted) and materially changes a
-- coral's apparent color from how it reads under daylight — see PRODUCT.md's
-- multi-lighting reference note. Adding this now, ahead of anything actually
-- populating it, so identify-MVP Phase 2 (vision-LLM trait extraction,
-- see docs/PROGRESS.md) and any future moderator color-entry UI have
-- somewhere real to record a lighting guess instead of losing it. NULL on
-- every existing row (true for all color data entered before this column
-- existed) — nothing here is backfilled or guessed retroactively.
-- Idempotent.
-- =============================================================================

ALTER TABLE color_ranges
    ADD COLUMN IF NOT EXISTS lighting_condition text;

ALTER TABLE color_ranges
    DROP CONSTRAINT IF EXISTS color_ranges_lighting_condition_check;
ALTER TABLE color_ranges
    ADD CONSTRAINT color_ranges_lighting_condition_check
        CHECK (lighting_condition IN ('daylight', 'actinic', 'mixed', 'unsure'));

-- One real backfill, not a guess: Rasta Zoanthid's confirmed reference photo
-- (see 25_correct_rasta_zoa_colors.sql) has a black background with
-- fluorescing colors — the standard visual signature of actinic/blue-LED
-- reef photography, not daylight. Recorded here rather than left NULL like
-- every other row, since it's a directly observable fact about that specific
-- photo. Deliberately scoped to just these two rows (by taxon + the
-- corrected labels) — safe to run whether or not migration 25 has been
-- applied yet; a no-op if those labeled rows don't exist.
UPDATE color_ranges cr
SET lighting_condition = 'actinic'
FROM taxon_nodes t
WHERE cr.taxon_node_id = t.id
  AND t.slug = 'rasta-zoa'
  AND cr.label IN ('Orange face', 'Olive-green skirt')
  AND cr.lighting_condition IS NULL;
