-- =============================================================================
-- Supabase layer — Tank grid placement (10_tank_grid.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the tanks
-- grid_columns/grid_rows columns and the specimens grid-slot uniqueness
-- constraint added in sql/reef-platform-schema.sql (§3, §6). Backs the tank
-- grid view: generate-slots-on-create, place/move/remove a specimen from a
-- slot. No RLS changes needed: existing tanks_owner_all / specimens_owner_all
-- policies already cover these new columns. Idempotent.
-- =============================================================================

-- Chosen layout dimensions, recorded once the grid is generated (NULL until
-- then, distinguishing "not yet configured" from "configured with 0 slots").
ALTER TABLE tanks
    ADD COLUMN IF NOT EXISTS grid_columns integer,
    ADD COLUMN IF NOT EXISTS grid_rows integer;

-- One specimen per slot. NULL grid_slot_id (unplaced) is unrestricted — a
-- partial unique index only constrains non-null values. Moving a specimen to
-- a new slot is a single UPDATE of this column, so the old slot is vacated
-- automatically; no occupancy history table needed (see schema-decisions.md
-- §4). Soft-deleted specimens don't hold a slot.
CREATE UNIQUE INDEX IF NOT EXISTS uq_specimens_grid_slot
    ON specimens (grid_slot_id)
    WHERE grid_slot_id IS NOT NULL AND deleted_at IS NULL;
