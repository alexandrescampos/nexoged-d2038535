CREATE POLICY "OrgAdmins podem deletar roles da sua organização (exceto super_admin)"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(), 'org_admin'::app_role)
  AND role <> 'super_admin'::app_role
);