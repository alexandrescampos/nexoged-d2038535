-- Fix RLS policies from RESTRICTIVE to PERMISSIVE for SELECT operations

-- =============================================
-- TABLE: profiles - Fix SELECT policies
-- =============================================

-- Drop existing RESTRICTIVE SELECT policies
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários autorizados podem ver perfis da organização" ON public.profiles;
DROP POLICY IF EXISTS "SuperAdmins podem ver todos os perfis" ON public.profiles;

-- Recreate as PERMISSIVE (default behavior when not specifying AS RESTRICTIVE)
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Usuários autorizados podem ver perfis da organização"
ON public.profiles FOR SELECT TO authenticated
USING (
  organization_id = get_user_org_id(auth.uid()) 
  AND (
    has_role(auth.uid(), 'org_admin'::app_role) 
    OR has_role(auth.uid(), 'analyst'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "SuperAdmins podem ver todos os perfis"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- =============================================
-- TABLE: project_members - Fix SELECT policies
-- =============================================

-- Drop existing RESTRICTIVE SELECT policies
DROP POLICY IF EXISTS "Usuários podem ver suas associações" ON public.project_members;
DROP POLICY IF EXISTS "Gestores podem ver membros de projetos associados" ON public.project_members;
DROP POLICY IF EXISTS "OrgAdmins podem ver project_members da org" ON public.project_members;

-- Recreate as PERMISSIVE
CREATE POLICY "Usuários podem ver suas associações"
ON public.project_members FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Gestores podem ver membros de projetos associados"
ON public.project_members FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND organization_id = get_user_org_id(auth.uid())
  AND project_id IN (
    SELECT pm2.project_id 
    FROM public.project_members pm2 
    WHERE pm2.user_id = auth.uid()
  )
);

CREATE POLICY "OrgAdmins podem ver project_members da org"
ON public.project_members FOR SELECT TO authenticated
USING (
  organization_id = get_user_org_id(auth.uid()) 
  AND has_role(auth.uid(), 'org_admin'::app_role)
);