
-- Fix 1: ged_files INSERT — require document ownership or admin role, not just org membership
DROP POLICY IF EXISTS "ged_files insert requires matching document" ON storage.objects;
CREATE POLICY "ged_files insert requires document ownership or admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ged_files'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id::text = (storage.foldername(objects.name))[2]
        AND d.organization_id = public.get_user_org_id(auth.uid())
        AND (
          d.owner_id = auth.uid()
          OR d.created_by = auth.uid()
          OR has_role_in_org(auth.uid(), 'org_admin'::app_role, d.organization_id)
        )
    )
  )
);

-- Fix 2: ged_files UPDATE — restrict to owner/creator/org_admin/super_admin
DROP POLICY IF EXISTS "ged_files org members can update" ON storage.objects;
CREATE POLICY "ged_files update requires document ownership or admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'ged_files'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id::text = (storage.foldername(objects.name))[2]
        AND d.organization_id = public.get_user_org_id(auth.uid())
        AND (
          d.owner_id = auth.uid()
          OR d.created_by = auth.uid()
          OR has_role_in_org(auth.uid(), 'org_admin'::app_role, d.organization_id)
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'ged_files'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id::text = (storage.foldername(objects.name))[2]
        AND d.organization_id = public.get_user_org_id(auth.uid())
        AND (
          d.owner_id = auth.uid()
          OR d.created_by = auth.uid()
          OR has_role_in_org(auth.uid(), 'org_admin'::app_role, d.organization_id)
        )
    )
  )
);

-- Fix 3: ged_hierarchy_audit — add INSERT policy restricting writes
CREATE POLICY "ged_hierarchy_audit insert restricted to admins/service"
ON public.ged_hierarchy_audit FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role_in_org(auth.uid(), 'org_admin'::app_role, organization_id)
);

-- Fix 4: perfil_permissao SELECT — restrict to rows belonging to user's org
DROP POLICY IF EXISTS "Authenticated can view perfil_permissao" ON public.perfil_permissao;
CREATE POLICY "Users view perfil_permissao of their org"
ON public.perfil_permissao FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.perfil p
    WHERE p.perfil_id = perfil_permissao.perfil_id
      AND p.organization_id = public.get_user_org_id(auth.uid())
  )
);

-- Fix 5: system_audit_log — explicit super_admin-only SELECT and INSERT policies
CREATE POLICY "system_audit_log super_admin select"
ON public.system_audit_log FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "system_audit_log super_admin insert"
ON public.system_audit_log FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
