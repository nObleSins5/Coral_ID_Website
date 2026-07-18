-- =============================================================================
-- Supabase layer — Per-stop color percent (30_color_stop_percent.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the same
-- column in sql/coral_trait_schema.sql.
--
-- Gap this closes (reported live): a moderator documenting Homewrecker
-- Acropora's growth tip as a blue-to-purple gradient had nowhere to record
-- "roughly 80% electric blue, 20% purple" — color_ranges.approx_percent
-- (26_color_lighting_condition.sql's sibling column, added 2026-07-14) is
-- ONE number per RANGE, describing how much of a whole anatomy position
-- (e.g. "the growth tip") that range covers when a position has several
-- separate ranges. It has no way to express the blend ratio BETWEEN two
-- stops inside one gradient/rainbow/etc range that already covers the
-- entire position.
--
-- color_stops.approx_percent is the sibling fact at the right grain: how
-- much of THIS RANGE's own blend is this one stop. Nullable — most
-- existing single-stop rows have no reason to set it (a solid color is
-- trivially 100% of its own range), and "not recorded" stays distinct from
-- "0%", same rule already applied to the range-level column.
-- Idempotent.
-- =============================================================================

ALTER TABLE color_stops
    ADD COLUMN IF NOT EXISTS approx_percent numeric;

ALTER TABLE color_stops
    DROP CONSTRAINT IF EXISTS color_stops_approx_percent_check;
ALTER TABLE color_stops
    ADD CONSTRAINT color_stops_approx_percent_check
    CHECK (approx_percent IS NULL OR (approx_percent >= 0 AND approx_percent <= 100));
