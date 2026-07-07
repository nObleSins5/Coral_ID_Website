-- =============================================================================
-- Supabase layer — Coral photo storage bucket + RLS (05_storage.sql)
-- =============================================================================
-- Public bucket (photos are public-by-default per spec) so served URLs need no
-- signing. Write access is restricted per-user by folder prefix: an uploaded
-- object always lives at "{auth.uid()}/<filename>", enforced below exactly the
-- same way coral_photos rows are owner-scoped in 02_rls_policies.sql.
-- Idempotent.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('coral-photos', 'coral-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "coral_photos_bucket_public_read" ON storage.objects;
CREATE POLICY "coral_photos_bucket_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'coral-photos');

DROP POLICY IF EXISTS "coral_photos_bucket_owner_insert" ON storage.objects;
CREATE POLICY "coral_photos_bucket_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'coral-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "coral_photos_bucket_owner_delete" ON storage.objects;
CREATE POLICY "coral_photos_bucket_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'coral-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
