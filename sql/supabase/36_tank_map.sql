-- =============================================================================
-- Supabase layer — Photo-tile tank map, Coral Location Tracking v2 (36_tank_map.sql)
-- =============================================================================
-- Incremental migration for an already-live project. Companion to
-- work-order "Photo-Tile Tank Map" (2026-07-20). Additive only — the
-- existing grid_slots/specimens.grid_slot_id X/Y/Z system is UNCHANGED and
-- stays the coarse fallback; this is an opt-in enrichment layer, same
-- relationship badge_enabled has to is_public (see 32_tank_badge.sql).
--
-- tank_map_tiles: one row per uploaded photo tile placed on the canvas.
-- Reuses the existing 'coral-photos' storage bucket (05_storage.sql) — no
-- new bucket, no new upload path. Crop fields are non-destructive (source-
-- image pixel offsets, independent of the on-canvas placement transform)
-- so a user can nudge a tile's crop back and forth while aligning it
-- against its neighbor's overlap, without re-uploading.
--
-- coral_map_pins: one row per coral tagged to a point on a tile. Position is
-- stored RELATIVE TO THE TILE (0..tile width/height in source-crop pixel
-- space), not canvas space, so dragging/rotating/resizing a tile never
-- requires recalculating pins on it — they're transformed into canvas space
-- at render time alongside the tile itself. coral_id references specimens
-- (this project's actual per-individual-coral table; the work order's
-- generic "corals" was just loose wording, not a real table name).
--
-- Caps (30 tiles / 50 pins per tank) are enforced at the application layer
-- (lib/tank-map.ts + app/tank/map-actions.ts), same convention as
-- MAX_GRID_SLOTS in lib/grid.ts — no DB-level trigger, kept consistent with
-- how grid_slots' cap already works.
--
-- Public-showcase visibility is intentionally NOT addressed here (no public
-- read policy). Map data stays owner-only until a future migration extends
-- the public-read policies the same way 32_tank_badge.sql did, if product
-- decides the map should appear on /showcase.
-- Idempotent.
-- =============================================================================

ALTER TABLE tanks ADD COLUMN IF NOT EXISTS map_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS tank_map_tiles (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id          uuid NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
    storage_path     text NOT NULL,        -- Supabase Storage object path, 'coral-photos' bucket
    -- On-canvas placement transform.
    pos_x            numeric NOT NULL DEFAULT 0,
    pos_y            numeric NOT NULL DEFAULT 0,
    width            numeric NOT NULL,
    height           numeric NOT NULL,
    rotation         numeric NOT NULL DEFAULT 0,   -- degrees
    z_index          integer NOT NULL DEFAULT 0,   -- layering order for overlap
    -- Non-destructive crop, source-image pixel space. Defaults = full image.
    crop_x           numeric NOT NULL DEFAULT 0,
    crop_y           numeric NOT NULL DEFAULT 0,
    crop_width       numeric,   -- NULL => full source width
    crop_height      numeric,   -- NULL => full source height
    created_by       uuid NOT NULL REFERENCES auth.users(id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    -- Phase 2: version chain for re-photographed tiles (alignment overlay +
    -- growth/color timelapse). Nullable for MVP; a re-uploaded tile points
    -- back at the one it replaces instead of overwriting it.
    replaces_tile_id uuid REFERENCES tank_map_tiles(id)
);
CREATE INDEX IF NOT EXISTS idx_tank_map_tiles_tank ON tank_map_tiles (tank_id);
CREATE INDEX IF NOT EXISTS idx_tank_map_tiles_replaces ON tank_map_tiles (replaces_tile_id);

DROP TRIGGER IF EXISTS trg_tank_map_tiles_updated_at ON tank_map_tiles;
CREATE TRIGGER trg_tank_map_tiles_updated_at
    BEFORE UPDATE ON tank_map_tiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS coral_map_pins (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coral_id   uuid NOT NULL REFERENCES specimens(id) ON DELETE CASCADE,
    tile_id    uuid NOT NULL REFERENCES tank_map_tiles(id) ON DELETE CASCADE,
    pos_x      numeric NOT NULL,   -- relative to the tile's crop (0..crop width)
    pos_y      numeric NOT NULL,   -- relative to the tile's crop (0..crop height)
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coral_map_pins_tile ON coral_map_pins (tile_id);
CREATE INDEX IF NOT EXISTS idx_coral_map_pins_coral ON coral_map_pins (coral_id);
-- One map pin per coral for MVP — re-tagging (dragging/updating this row) is
-- the intended way to handle coral movement, not multiple simultaneous pins.
CREATE UNIQUE INDEX IF NOT EXISTS uq_coral_map_pins_coral ON coral_map_pins (coral_id);

DROP TRIGGER IF EXISTS trg_coral_map_pins_updated_at ON coral_map_pins;
CREATE TRIGGER trg_coral_map_pins_updated_at
    BEFORE UPDATE ON coral_map_pins
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: default-deny already applied to every public-schema table by
-- 02_rls_policies.sql's DO block. Scope both new tables to the tank owner,
-- same tank-scoped pattern as grid_slots/parameter_readings/equipment (one
-- hop for tank_map_tiles, two hops via tile_id for coral_map_pins — same
-- shape as equipment_levels/equipment_events -> equipment -> tanks).
ALTER TABLE tank_map_tiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE coral_map_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tank_map_tiles_owner_all ON public.tank_map_tiles;
CREATE POLICY tank_map_tiles_owner_all ON public.tank_map_tiles
    FOR ALL TO authenticated
    USING (tank_id IN (SELECT id FROM public.tanks WHERE user_id = auth.uid()))
    WITH CHECK (tank_id IN (SELECT id FROM public.tanks WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS coral_map_pins_owner_all ON public.coral_map_pins;
CREATE POLICY coral_map_pins_owner_all ON public.coral_map_pins
    FOR ALL TO authenticated
    USING (tile_id IN (
        SELECT tmt.id FROM public.tank_map_tiles tmt
        JOIN public.tanks t ON t.id = tmt.tank_id
        WHERE t.user_id = auth.uid()
    ))
    WITH CHECK (tile_id IN (
        SELECT tmt.id FROM public.tank_map_tiles tmt
        JOIN public.tanks t ON t.id = tmt.tank_id
        WHERE t.user_id = auth.uid()
    ));
