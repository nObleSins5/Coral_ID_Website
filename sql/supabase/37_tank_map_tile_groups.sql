-- =============================================================================
-- Supabase layer — Photo-tile tank map: tile grouping (37_tank_map_tile_groups.sql)
-- =============================================================================
-- Incremental migration for an already-live project. Companion to
-- 36_tank_map.sql's photo-tile map.
--
-- Lets an owner lock several tiles together (PowerPoint-style "Group") so
-- they drag/resize/rotate as one rigid unit while staying individually
-- selectable (double-click, in the UI). No separate groups table — the
-- group_id column itself IS the group identity; grouping/ungrouping just
-- sets/clears it across the selected tiles' rows. A NULL tile_group_id
-- means "not in a group" (the default, untouched behavior for every
-- existing tile).
-- Idempotent.
-- =============================================================================

ALTER TABLE tank_map_tiles ADD COLUMN IF NOT EXISTS tile_group_id uuid;
CREATE INDEX IF NOT EXISTS idx_tank_map_tiles_group ON tank_map_tiles (tile_group_id);
