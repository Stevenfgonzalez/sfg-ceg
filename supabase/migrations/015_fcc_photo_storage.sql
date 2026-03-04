-- Migration 015: FCC Photo Storage
-- Creates storage bucket for member photos with RLS

-- Create the fcc-photos bucket (public read for EMS access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fcc-photos', 'fcc-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Owner can upload/update/delete photos in their household folder
CREATE POLICY "fcc_photos_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fcc-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM fcc_households WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "fcc_photos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fcc-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM fcc_households WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "fcc_photos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fcc-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM fcc_households WHERE owner_id = auth.uid()
    )
  );

-- Public read for EMS access (bucket is already public, but explicit policy)
CREATE POLICY "fcc_photos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'fcc-photos');
