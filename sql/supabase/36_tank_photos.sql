-- =============================================================================
-- Supabase layer — Tank-level photos (36_tank_photos.sql)
-- =============================================================================
-- Incremental migration for an already-live project.
--
-- Gap this closes: every existing photo table is per-CORAL (coral_photos —
-- taxon/specimen/parameter-snapshot linkage baked in). There was no way to
-- post a photo of the tank itself (the whole display, not one coral in it).
-- This is a deliberately small, separate table rather than overloading
-- coral_photos with a nullable taxon_node_id — a tank photo has none of
-- coral_photos' coral-specific columns (taxon, specimen, lighting condition,
-- parameter snapshot) and forcing it into that shape would mean a wall of
-- always-null columns on every row.
--
-- Storage reuses the existing 'coral-photos' bucket (05_storage.sql) — its
-- owner-folder RLS policy (`(storage.foldername(name))[1] = auth.uid()::text`)
-- is keyed on the uploader, not which app table references the object, so no
-- new bucket/storage policy is needed.
--
-- RLS mirrors the tanks/grid_slots/specimens public-read pattern from
-- 28_public_tank_showcase.sql / 32_tank_badge.sql: owner gets full access to
-- their own tank's photos; anon/authenticated get read access only when the
-- parent tank is published (is_public OR badge_enabled).
-- Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tank_photos (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id           uuid NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
    uploader_user_id  uuid NOT NULL REFERENCES users(id),
    storage_provider  text NOT NULL DEFAULT 'supabase',
    storage_key       text NOT NULL,
    url               text NOT NULL,
    mime              text NOT NULL,
    bytes             integer NOT NULL,
    caption           text CHECK (caption IS NULL OR char_length(caption) <= 280),
    created_at        timestamptz NOT NULL DEFAULT now(),
    deleted_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_tank_photos_tank ON tank_photos (tank_id, created_at);

ALTER TABLE tank_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tank_photos_owner_all ON public.tank_photos;
CREATE POLICY tank_photos_owner_all ON public.tank_photos
    FOR ALL TO authenticated
    USING (tank_id IN (SELECT id FROM public.tanks WHERE user_id = auth.uid()))
    WITH CHECK (
        uploader_user_id = auth.uid()
        AND tank_id IN (SELECT id FROM public.tanks WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS tank_photos_public_read ON public.tank_photos;
CREATE POLICY tank_photos_public_read ON public.tank_photos
    FOR SELECT TO anon, authenticated
    USING (
        deleted_at IS NULL
        AND tank_id IN (SELECT id FROM public.tanks WHERE is_public OR badge_enabled)
    );
