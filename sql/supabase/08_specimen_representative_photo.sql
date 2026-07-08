-- =============================================================================
-- Supabase layer — Specimen representative photo (08_specimen_representative_photo.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the
-- representative_photo_id column added to specimens in
-- sql/reef-platform-schema.sql (§6). Distinct from coral_photos.specimen_id
-- (true provenance, settable only by the photo's uploader) — this is the
-- specimen owner's display pick, which may reference anyone's public photo.
-- No RLS changes needed: the existing specimens_owner_all policy already
-- covers this new column. Idempotent.
-- =============================================================================

ALTER TABLE specimens
    ADD COLUMN IF NOT EXISTS representative_photo_id uuid REFERENCES coral_photos(id);
