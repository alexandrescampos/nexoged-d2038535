-- As políticas de storage devem ser criadas na tabela storage.objects
-- O bucket 'ged_files' já deve existir via storage_create_bucket

-- Política para leitura/download
CREATE POLICY "Users can read their organization files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ged_files');

-- Política para upload
CREATE POLICY "Users can upload organization files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ged_files');

-- Política para atualização (se necessário, ex: versionamento ou renomeação)
CREATE POLICY "Users can update organization files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'ged_files');