
-- Fix RLS for perfil and related access-control tables
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.perfil;
DROP POLICY IF EXISTS "Admins can manage perfil_permissao" ON public.perfil_permissao;
DROP POLICY IF EXISTS "Admins can manage usuario_perfil" ON public.usuario_perfil;
DROP POLICY IF EXISTS "Users can view their profile assignments" ON public.usuario_perfil;
DROP POLICY IF EXISTS "Admins can manage usuario_escopo" ON public.usuario_escopo;
DROP POLICY IF EXISTS "Admins can manage documento_usuario_autorizado" ON public.documento_usuario_autorizado;

-- perfil
CREATE POLICY "OrgAdmins manage perfis"
ON public.perfil FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (organization_id = public.get_user_org_id(auth.uid())
      AND public.has_role(auth.uid(), 'org_admin'))
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (organization_id = public.get_user_org_id(auth.uid())
      AND public.has_role(auth.uid(), 'org_admin'))
);

-- perfil_permissao
ALTER TABLE public.perfil_permissao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "OrgAdmins manage perfil_permissao"
ON public.perfil_permissao FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.perfil p
    WHERE p.perfil_id = perfil_permissao.perfil_id
      AND p.organization_id = public.get_user_org_id(auth.uid())
      AND public.has_role(auth.uid(), 'org_admin')
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.perfil p
    WHERE p.perfil_id = perfil_permissao.perfil_id
      AND p.organization_id = public.get_user_org_id(auth.uid())
      AND public.has_role(auth.uid(), 'org_admin')
  )
);
CREATE POLICY "Authenticated can view perfil_permissao"
ON public.perfil_permissao FOR SELECT TO authenticated
USING (true);

-- usuario_perfil
ALTER TABLE public.usuario_perfil ENABLE ROW LEVEL SECURITY;
CREATE POLICY "OrgAdmins manage usuario_perfil"
ON public.usuario_perfil FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.get_user_org_id(usuario_id) = public.get_user_org_id(auth.uid())
      AND public.has_role(auth.uid(), 'org_admin'))
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.get_user_org_id(usuario_id) = public.get_user_org_id(auth.uid())
      AND public.has_role(auth.uid(), 'org_admin'))
);
CREATE POLICY "Users view own usuario_perfil"
ON public.usuario_perfil FOR SELECT TO authenticated
USING (usuario_id = auth.uid());

-- usuario_escopo
ALTER TABLE public.usuario_escopo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "OrgAdmins manage usuario_escopo"
ON public.usuario_escopo FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.get_user_org_id(usuario_id) = public.get_user_org_id(auth.uid())
      AND public.has_role(auth.uid(), 'org_admin'))
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.get_user_org_id(usuario_id) = public.get_user_org_id(auth.uid())
      AND public.has_role(auth.uid(), 'org_admin'))
);
CREATE POLICY "Users view own usuario_escopo"
ON public.usuario_escopo FOR SELECT TO authenticated
USING (usuario_id = auth.uid());

-- documento_usuario_autorizado
ALTER TABLE public.documento_usuario_autorizado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "OrgAdmins manage documento_usuario_autorizado"
ON public.documento_usuario_autorizado FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.get_user_org_id(usuario_id) = public.get_user_org_id(auth.uid())
      AND public.has_role(auth.uid(), 'org_admin'))
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.get_user_org_id(usuario_id) = public.get_user_org_id(auth.uid())
      AND public.has_role(auth.uid(), 'org_admin'))
);
CREATE POLICY "Users view own documento_usuario_autorizado"
ON public.documento_usuario_autorizado FOR SELECT TO authenticated
USING (usuario_id = auth.uid());

-- Ensure grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_permissao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_perfil TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_escopo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_usuario_autorizado TO authenticated;
GRANT ALL ON public.perfil TO service_role;
GRANT ALL ON public.perfil_permissao TO service_role;
GRANT ALL ON public.usuario_perfil TO service_role;
GRANT ALL ON public.usuario_escopo TO service_role;
GRANT ALL ON public.documento_usuario_autorizado TO service_role;
