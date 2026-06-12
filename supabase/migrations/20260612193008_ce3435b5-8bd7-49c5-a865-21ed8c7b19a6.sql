
-- ged_hierarchy_audit: scope to authenticated role
DROP POLICY IF EXISTS "Users can view audit log of their organization" ON public.ged_hierarchy_audit;
CREATE POLICY "Users can view audit log of their organization"
ON public.ged_hierarchy_audit FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

-- system_settings: drop support_phone from anon-accessible keys
DROP POLICY IF EXISTS "Public can read public-safe system_settings" ON public.system_settings;
CREATE POLICY "Public can read public-safe system_settings"
ON public.system_settings FOR SELECT
TO anon
USING (
  key = ANY (ARRAY[
    'system_logo','system_name','system_version',
    'terms_of_service','privacy_policy','terms_version'
  ])
);
