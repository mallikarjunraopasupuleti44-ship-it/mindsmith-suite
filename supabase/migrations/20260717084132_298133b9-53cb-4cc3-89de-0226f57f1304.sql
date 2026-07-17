
CREATE POLICY "own bucket files - select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'business-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own bucket files - insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own bucket files - update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'business-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own bucket files - delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'business-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
