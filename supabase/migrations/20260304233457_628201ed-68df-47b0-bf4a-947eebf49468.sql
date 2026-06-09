
CREATE POLICY "Authenticated users can delete signed terms"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'signed-terms');
