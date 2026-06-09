
-- 1. Fix employee-documents storage policies: enforce org_id folder check
DROP POLICY IF EXISTS "Authenticated users can upload employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete employee documents" ON storage.objects;

CREATE POLICY "employee_docs_insert_org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = (get_user_org_id(auth.uid()))::text
  )
);

CREATE POLICY "employee_docs_delete_org"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = (get_user_org_id(auth.uid()))::text
  )
);

-- 2. Fix signed-terms storage policies: enforce org_id folder check on insert/delete
DROP POLICY IF EXISTS "Authenticated users can upload signed terms" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete signed terms" ON storage.objects;

-- (Insert policy "Signed terms: insert own org" already exists with proper folder check.)
CREATE POLICY "signed_terms_delete_org"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'signed-terms'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = (get_user_org_id(auth.uid()))::text
  )
);

-- 3. Allow org_admins to read their own org's API usage logs
CREATE POLICY "OrgAdmins podem ver logs de uso da API da org"
ON public.organization_api_usage_log FOR SELECT TO authenticated
USING (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(), 'org_admin'::app_role)
);

-- 4. Restrict system_settings public read to public-safe keys only
DROP POLICY IF EXISTS "Público pode ler system_settings" ON public.system_settings;

CREATE POLICY "Public can read public-safe system_settings"
ON public.system_settings FOR SELECT
TO anon, authenticated
USING (
  key IN (
    'system_logo',
    'system_name',
    'system_version',
    'support_phone',
    'terms_of_service',
    'privacy_policy',
    'terms_version'
  )
);

-- Authenticated users can also read all settings beyond the whitelist when needed
CREATE POLICY "Authenticated can read system_settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (true);
