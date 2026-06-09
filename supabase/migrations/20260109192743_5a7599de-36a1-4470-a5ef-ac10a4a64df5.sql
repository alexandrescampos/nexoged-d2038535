-- Criar tabela de associação de usuários a projetos
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(project_id, user_id)
);

-- Índices para performance
CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_project_members_org ON public.project_members(organization_id);

-- Habilitar RLS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- SuperAdmins podem gerenciar todas as associações
CREATE POLICY "SuperAdmins podem gerenciar project_members"
  ON public.project_members FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- OrgAdmins podem ver membros da sua organização
CREATE POLICY "OrgAdmins podem ver project_members da org"
  ON public.project_members FOR SELECT
  USING (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'org_admin')
  );

-- OrgAdmins podem inserir membros na sua organização
CREATE POLICY "OrgAdmins podem inserir project_members"
  ON public.project_members FOR INSERT
  WITH CHECK (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'org_admin')
  );

-- OrgAdmins podem deletar membros da sua organização
CREATE POLICY "OrgAdmins podem deletar project_members"
  ON public.project_members FOR DELETE
  USING (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'org_admin')
  );

-- Usuários podem ver seus próprios projetos
CREATE POLICY "Usuários podem ver suas associações"
  ON public.project_members FOR SELECT
  USING (user_id = auth.uid());

-- Função helper para verificar se usuário é membro do projeto
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE user_id = _user_id
      AND project_id = _project_id
  ) OR has_role(_user_id, 'org_admin') OR has_role(_user_id, 'super_admin')
$$;

-- Atualizar política de INSERT da time_entries para validar associação
DROP POLICY IF EXISTS "Usuários podem criar seus próprios registros" ON public.time_entries;

CREATE POLICY "Usuários podem criar registros em projetos associados"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    AND organization_id = get_user_org_id(auth.uid())
    AND is_project_member(auth.uid(), project_id)
  );