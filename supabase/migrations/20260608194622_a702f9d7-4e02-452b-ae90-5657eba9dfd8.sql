-- Restrict org_admin logo policies to their own organization folder
DROP POLICY IF EXISTS "OrgAdmins podem fazer upload de logo" ON storage.objects;
DROP POLICY IF EXISTS "OrgAdmins podem atualizar logo" ON storage.objects;
DROP POLICY IF EXISTS "OrgAdmins podem deletar logo" ON storage.objects;

CREATE POLICY "OrgAdmins podem fazer upload de logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'organization-logos'
  AND has_role(auth.uid(), 'org_admin')
  AND (storage.foldername(name))[1] = (public.get_user_org_id(auth.uid()))::text
);

CREATE POLICY "OrgAdmins podem atualizar logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND has_role(auth.uid(), 'org_admin')
  AND (storage.foldername(name))[1] = (public.get_user_org_id(auth.uid()))::text
)
WITH CHECK (
  bucket_id = 'organization-logos'
  AND has_role(auth.uid(), 'org_admin')
  AND (storage.foldername(name))[1] = (public.get_user_org_id(auth.uid()))::text
);

CREATE POLICY "OrgAdmins podem deletar logo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND has_role(auth.uid(), 'org_admin')
  AND (storage.foldername(name))[1] = (public.get_user_org_id(auth.uid()))::text
);

-- Restrict authenticated read on system_settings to the same public-safe whitelist
DROP POLICY IF EXISTS "Authenticated can read system_settings" ON public.system_settings;

CREATE POLICY "Authenticated can read public-safe system_settings"
ON public.system_settings FOR SELECT TO authenticated
USING (
  key = ANY (ARRAY[
    'system_logo','system_name','system_version','support_phone',
    'terms_of_service','privacy_policy','terms_version'
  ])
);