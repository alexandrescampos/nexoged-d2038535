-- 1. Departamentos
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view departments of their organization" 
ON public.departments FOR SELECT TO authenticated 
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage departments" 
ON public.departments FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'org_admin') AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 2. Permissões (RBAC)
CREATE TYPE public.ged_permission AS ENUM (
    'visualizar_documento',
    'inserir_documento',
    'editar_documento',
    'excluir_documento',
    'restaurar_documento',
    'assinar_documento',
    'administrar_sistema'
);

CREATE TABLE public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission ged_permission NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, permission, organization_id)
);

GRANT SELECT, INSERT, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- 3. Auditoria
CREATE TABLE public.system_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.system_audit_log TO authenticated;
GRANT ALL ON public.system_audit_log TO service_role;
ALTER TABLE public.system_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. Extensão de Perfis (Departamento)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- 5. Função para checar permissão
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission public.ged_permission)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions 
    WHERE user_id = _user_id AND permission = _permission
  ) OR public.has_role(_user_id, 'super_admin') OR public.has_role(_user_id, 'org_admin');
$$;