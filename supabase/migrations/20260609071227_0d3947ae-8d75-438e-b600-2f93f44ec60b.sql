DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload evidence') THEN
    CREATE POLICY "Authenticated users can upload evidence"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'evidence');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can view evidence') THEN
    CREATE POLICY "Authenticated users can view evidence"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'evidence');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can update own evidence') THEN
    CREATE POLICY "Authenticated users can update own evidence"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'evidence' AND owner = auth.uid())
    WITH CHECK (bucket_id = 'evidence' AND owner = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can delete own evidence') THEN
    CREATE POLICY "Authenticated users can delete own evidence"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'evidence' AND owner = auth.uid());
  END IF;
END $$;