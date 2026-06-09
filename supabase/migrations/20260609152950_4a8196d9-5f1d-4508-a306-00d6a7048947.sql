
-- Restrict signed-terms DELETE to super_admin only (matches table immutability)
DROP POLICY IF EXISTS "signed_terms_delete_org" ON storage.objects;

CREATE POLICY "signed_terms_delete_super_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'signed-terms'
  AND public.has_role(auth.uid(), 'super_admin')
);

-- Explicitly deny UPDATE on employee-documents bucket to make intent clear
CREATE POLICY "employee_documents_no_update"
ON storage.objects
FOR UPDATE
TO authenticated, anon
USING (bucket_id = 'employee-documents' AND false)
WITH CHECK (bucket_id = 'employee-documents' AND false);
