CREATE POLICY "OrgAdmins podem atualizar perfis da organização"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(), 'org_admin'::app_role)
)
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(), 'org_admin'::app_role)
);