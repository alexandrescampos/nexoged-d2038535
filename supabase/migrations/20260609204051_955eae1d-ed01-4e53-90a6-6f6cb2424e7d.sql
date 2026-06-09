
-- 1. Restrict SELECT on epi_signed_terms to org_admin / super_admin (super_admin already covered by ALL policy)
DROP POLICY IF EXISTS "Usuários podem ver termos da org" ON public.epi_signed_terms;
CREATE POLICY "OrgAdmins podem ver termos da org"
ON public.epi_signed_terms
FOR SELECT
USING (
  organization_id = public.get_user_org_id(auth.uid())
  AND public.has_role(auth.uid(), 'org_admin'::public.app_role)
);

-- 2. Tighten user_roles INSERT: target user must belong to same org
DROP POLICY IF EXISTS "OrgAdmins podem gerenciar roles da sua organização (exceto su" ON public.user_roles;
CREATE POLICY "OrgAdmins podem inserir roles da sua organização (exceto super_a"
ON public.user_roles
FOR INSERT
WITH CHECK (
  organization_id = public.get_user_org_id(auth.uid())
  AND has_role(auth.uid(), 'org_admin'::public.app_role)
  AND role <> 'super_admin'::public.app_role
  AND public.get_user_org_id(user_id) = public.get_user_org_id(auth.uid())
);

-- 3. Tighten storage INSERT on signed-terms bucket: require manager or org_admin
DROP POLICY IF EXISTS "Signed terms: insert own org" ON storage.objects;
CREATE POLICY "Signed terms: insert own org"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'signed-terms'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      (storage.foldername(name))[1] = (public.get_user_org_id(auth.uid()))::text
      AND (
        public.has_role(auth.uid(), 'org_admin'::public.app_role)
        OR public.has_role(auth.uid(), 'manager'::public.app_role)
      )
    )
  )
);
