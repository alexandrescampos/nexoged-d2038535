
-- perfil_escopo: restrict writes to org admins
DROP POLICY IF EXISTS "Users can manage profile scopes within their org" ON public.perfil_escopo;
CREATE POLICY "Org members can view profile scopes" ON public.perfil_escopo
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfil p
      WHERE p.perfil_id = perfil_escopo.perfil_id
        AND p.organization_id = public.get_user_org_id(auth.uid())
    )
  );
CREATE POLICY "Admins can manage profile scopes" ON public.perfil_escopo
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.perfil p
      WHERE p.perfil_id = perfil_escopo.perfil_id
        AND public.has_role_in_org(auth.uid(),'org_admin', p.organization_id)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.perfil p
      WHERE p.perfil_id = perfil_escopo.perfil_id
        AND public.has_role_in_org(auth.uid(),'org_admin', p.organization_id)
    )
  );

-- sectors: restrict writes to org admins
DROP POLICY IF EXISTS "Users can manage sectors of their organization" ON public.sectors;
CREATE POLICY "Org members can view sectors" ON public.sectors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.dept_id = sectors.dept_id
        AND d.organization_id = public.get_user_org_id(auth.uid())
    )
  );
CREATE POLICY "Admins can manage sectors" ON public.sectors
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.dept_id = sectors.dept_id
        AND public.has_role_in_org(auth.uid(),'org_admin', d.organization_id)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.dept_id = sectors.dept_id
        AND public.has_role_in_org(auth.uid(),'org_admin', d.organization_id)
    )
  );

-- folders: restrict writes to org admins
DROP POLICY IF EXISTS "Users can manage folders of their organization" ON public.folders;
CREATE POLICY "Org members can view folders" ON public.folders
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins can manage folders" ON public.folders
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role_in_org(auth.uid(),'org_admin', organization_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role_in_org(auth.uid(),'org_admin', organization_id)
  );

-- ged_document_type_custom_fields: restrict writes to org admins
DROP POLICY IF EXISTS "Users can manage type field associations" ON public.ged_document_type_custom_fields;
CREATE POLICY "Org members can view type custom fields" ON public.ged_document_type_custom_fields
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ged_document_types t
      WHERE t.id = ged_document_type_custom_fields.document_type_id
        AND t.organization_id = public.get_user_org_id(auth.uid())
    )
  );
CREATE POLICY "Admins manage type custom fields" ON public.ged_document_type_custom_fields
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.ged_document_types t
      WHERE t.id = ged_document_type_custom_fields.document_type_id
        AND public.has_role_in_org(auth.uid(),'org_admin', t.organization_id)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.ged_document_types t
      WHERE t.id = ged_document_type_custom_fields.document_type_id
        AND public.has_role_in_org(auth.uid(),'org_admin', t.organization_id)
    )
  );

-- ged_document_versions: writes restricted to doc owner / admins
DROP POLICY IF EXISTS "Users can manage versions of their organization docs" ON public.ged_document_versions;
CREATE POLICY "Org members can view versions" ON public.ged_document_versions
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  );
CREATE POLICY "Owners and admins can manage versions" ON public.ged_document_versions
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role_in_org(auth.uid(),'org_admin', organization_id)
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id = ged_document_versions.document_id
        AND (d.owner_id = auth.uid() OR d.created_by = auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role_in_org(auth.uid(),'org_admin', organization_id)
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id = ged_document_versions.document_id
        AND (d.owner_id = auth.uid() OR d.created_by = auth.uid())
    )
  );

-- ged_document_custom_field_values: writes restricted to owner/admin
DROP POLICY IF EXISTS "Users can manage custom field values" ON public.ged_document_custom_field_values;
CREATE POLICY "Org members can view custom field values" ON public.ged_document_custom_field_values
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id = ged_document_custom_field_values.document_id
        AND d.organization_id = public.get_user_org_id(auth.uid())
    )
    OR public.has_role(auth.uid(),'super_admin')
  );
CREATE POLICY "Owners and admins manage custom field values" ON public.ged_document_custom_field_values
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id = ged_document_custom_field_values.document_id
        AND (
          d.owner_id = auth.uid()
          OR d.created_by = auth.uid()
          OR public.has_role_in_org(auth.uid(),'org_admin', d.organization_id)
        )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id = ged_document_custom_field_values.document_id
        AND (
          d.owner_id = auth.uid()
          OR d.created_by = auth.uid()
          OR public.has_role_in_org(auth.uid(),'org_admin', d.organization_id)
        )
    )
  );

-- ged_audit_log: block direct user inserts (allow service_role / SECURITY DEFINER funcs only)
DROP POLICY IF EXISTS "Users can insert audit logs for their org" ON public.ged_audit_log;
DROP POLICY IF EXISTS "Inserir auditoria GED" ON public.ged_audit_log;
-- Note: SECURITY DEFINER functions bypass RLS; no INSERT policy needed for them.

-- documento_ocr_auditoria: block direct user inserts
DROP POLICY IF EXISTS "Inserir auditoria OCR (próprio user e org)" ON public.documento_ocr_auditoria;
