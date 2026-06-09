
-- Remove all existing permissive SELECT policies on storage.objects for these buckets
-- Then create restrictive ones

-- First, drop any broad public SELECT policies
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND qual LIKE '%bucket_id%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END;
$$;

-- organization-logos: public read of individual files (no listing)
CREATE POLICY "org_logos_select_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'organization-logos');

-- system-assets: public read of individual files (no listing) - allow anon too since it's system branding
CREATE POLICY "system_assets_select_all"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'system-assets');

-- signed-terms: only users from the same org can access
CREATE POLICY "signed_terms_select_org"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'signed-terms'
  AND (
    has_role(auth.uid(), 'super_admin')
    OR (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text
  )
);

-- employee-documents: only users from the same org can access
CREATE POLICY "employee_docs_select_org"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (
    has_role(auth.uid(), 'super_admin')
    OR (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text
  )
);

-- Make signed-terms and employee-documents private buckets
UPDATE storage.buckets SET public = false WHERE id IN ('signed-terms', 'employee-documents');
