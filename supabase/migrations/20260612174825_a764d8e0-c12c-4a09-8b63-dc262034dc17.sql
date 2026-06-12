
DROP POLICY IF EXISTS "Organization admins can manage integrations" ON public.organization_integrations;
DROP POLICY IF EXISTS "Users can view their organization integrations" ON public.organization_integrations;

CREATE POLICY "Admins read org integrations"
ON public.organization_integrations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'org_admin'::app_role)
    AND organization_id = public.get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Admins manage org integrations"
ON public.organization_integrations
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'org_admin'::app_role)
    AND organization_id = public.get_user_org_id(auth.uid())
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'org_admin'::app_role)
    AND organization_id = public.get_user_org_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view active profiles" ON public.perfil;

CREATE POLICY "Users view perfis in their org"
ON public.perfil
FOR SELECT
TO authenticated
USING (
  ativo = true
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR organization_id = public.get_user_org_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can manage their organization's scope rules" ON public.user_scope;

CREATE POLICY "Org members read scope rules"
ON public.user_scope
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_scope.usuario_id
      AND p.organization_id = public.get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Admins manage scope rules"
ON public.user_scope
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'org_admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_scope.usuario_id
        AND p.organization_id = public.get_user_org_id(auth.uid())
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'org_admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_scope.usuario_id
        AND p.organization_id = public.get_user_org_id(auth.uid())
    )
  )
);
