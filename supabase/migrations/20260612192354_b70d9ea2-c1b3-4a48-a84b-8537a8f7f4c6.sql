
-- 1. ged_files storage: remove broad/bypass policies, replace with strict ones
DROP POLICY IF EXISTS "ged_files org members can insert" ON storage.objects;
DROP POLICY IF EXISTS "ged_files org members can select" ON storage.objects;

CREATE POLICY "ged_files insert requires matching document"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ged_files'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE (d.id)::text = (storage.foldername(objects.name))[2]
        AND d.organization_id = public.get_user_org_id(auth.uid())
    )
  )
);

-- SELECT: mirror restrictive logic (org + ownership/authorization/permission)
CREATE POLICY "ged_files select restricted by document access"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ged_files'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE (d.id)::text = (storage.foldername(objects.name))[2]
        AND d.organization_id = public.get_user_org_id(auth.uid())
        AND (
          d.owner_id = auth.uid()
          OR d.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.documento_usuario_autorizado dua
            WHERE dua.documento_id = d.id AND dua.usuario_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.usuario_perfil up
            JOIN public.perfil_permissao pp ON up.perfil_id = pp.perfil_id
            JOIN public.permissao p ON pp.perm_id = p.perm_id
            WHERE up.usuario_id = auth.uid()
              AND p.perm_codigo = 'baixar_documento'
              AND up.organization_id = d.organization_id
          )
          OR public.has_role_in_org(auth.uid(), 'org_admin', d.organization_id)
        )
    )
  )
);

-- Also drop the older broad SELECT to keep only one restrictive policy
DROP POLICY IF EXISTS "Permitir download apenas com permissão ou propriedade" ON storage.objects;

-- 2. documento_ocr_auditoria: enforce organization match on insert
DROP POLICY IF EXISTS "Inserir auditoria OCR (próprio user)" ON public.documento_ocr_auditoria;
CREATE POLICY "Inserir auditoria OCR (próprio user e org)"
ON public.documento_ocr_auditoria FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND organization_id = public.get_user_org_id(auth.uid())
);

-- 3. folder_authorized_users: add SELECT policy scoped to user's org
CREATE POLICY "View folder authorized users in own org"
ON public.folder_authorized_users FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.folders f
    WHERE f.past_id = folder_authorized_users.past_id
      AND f.organization_id = public.get_user_org_id(auth.uid())
  )
);

-- 4. organization_integrations: hide credentials column from org admins.
--    Lock SELECT to super_admin only; org admins/edge funcs read via service_role.
DROP POLICY IF EXISTS "Admins read org integrations" ON public.organization_integrations;
DROP POLICY IF EXISTS "Admins manage org integrations" ON public.organization_integrations;

CREATE POLICY "Super admins read org integrations"
ON public.organization_integrations FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins manage org integrations"
ON public.organization_integrations FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 5. support_chat_logs: writes happen via service_role only; revoke client INSERT
REVOKE INSERT ON public.support_chat_logs FROM authenticated;
