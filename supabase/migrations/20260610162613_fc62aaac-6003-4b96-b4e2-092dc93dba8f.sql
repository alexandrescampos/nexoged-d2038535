-- Rename columns for departments
ALTER TABLE public.departments RENAME COLUMN id TO dept_id;
ALTER TABLE public.departments RENAME COLUMN code TO dept_cd_departamento;
ALTER TABLE public.departments RENAME COLUMN name TO dept_nm_departamento;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS dept_ds_departamento TEXT;
ALTER TABLE public.departments RENAME COLUMN is_active TO dept_in_ativo;
ALTER TABLE public.departments RENAME COLUMN created_at TO dept_dt_cadastro;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS dept_usuario_responsavel UUID REFERENCES auth.users(id);

-- Rename columns for sectors
ALTER TABLE public.sectors RENAME COLUMN id TO set_id;
ALTER TABLE public.sectors RENAME COLUMN department_id TO dept_id;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS set_cd_setor VARCHAR(30);
ALTER TABLE public.sectors RENAME COLUMN name TO set_nm_setor;
ALTER TABLE public.sectors RENAME COLUMN description TO set_ds_setor;
ALTER TABLE public.sectors RENAME COLUMN is_active TO set_in_ativo;
ALTER TABLE public.sectors RENAME COLUMN created_at TO set_dt_cadastro;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS set_usuario_responsavel UUID REFERENCES auth.users(id);

-- Rename columns for folders
ALTER TABLE public.folders RENAME COLUMN id TO past_id;
ALTER TABLE public.folders RENAME COLUMN sector_id TO set_id;
ALTER TABLE public.folders RENAME COLUMN parent_id TO past_id_pai;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS past_cd_pasta VARCHAR(50);
ALTER TABLE public.folders RENAME COLUMN name TO past_nm_pasta;
ALTER TABLE public.folders RENAME COLUMN description TO past_ds_pasta;
ALTER TABLE public.folders RENAME COLUMN is_active TO past_in_ativa;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS past_in_restrita BOOLEAN DEFAULT false;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS past_in_permite_subpastas BOOLEAN DEFAULT true;
ALTER TABLE public.folders RENAME COLUMN created_at TO past_dt_cadastro;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS past_usuario_responsavel UUID REFERENCES auth.users(id);

-- 4. Folder Allowed Document Types
CREATE TABLE IF NOT EXISTS public.folder_document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    past_id UUID REFERENCES public.folders(past_id) ON DELETE CASCADE,
    tipo_id UUID REFERENCES public.ged_document_types(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT ALL ON public.folder_document_types TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folder_document_types TO authenticated;
ALTER TABLE public.folder_document_types ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage folder doc types' AND tablename = 'folder_document_types') THEN
        CREATE POLICY "Users can manage folder doc types" 
        ON public.folder_document_types FOR ALL 
        USING (past_id IN (SELECT past_id FROM public.folders WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())));
    END IF;
END $$;

-- 5. User Scope
CREATE TABLE IF NOT EXISTS public.user_scope (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo_escopo VARCHAR(20) NOT NULL CHECK (tipo_escopo IN ('DEPARTMENT', 'SECTOR', 'FOLDER')),
    escopo_id UUID NOT NULL,
    herda_permissoes BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT ALL ON public.user_scope TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_scope TO authenticated;
ALTER TABLE public.user_scope ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their organization''s scope rules' AND tablename = 'user_scope') THEN
        CREATE POLICY "Users can manage their organization's scope rules" 
        ON public.user_scope FOR ALL 
        USING (usuario_id IN (SELECT id FROM public.profiles WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())));
    END IF;
END $$;

-- 6. Restricted Folders Authorized Users
CREATE TABLE IF NOT EXISTS public.folder_authorized_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    past_id UUID REFERENCES public.folders(past_id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT ALL ON public.folder_authorized_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folder_authorized_users TO authenticated;
ALTER TABLE public.folder_authorized_users ENABLE ROW LEVEL SECURITY;

-- 7. Audit Log Expansion
CREATE TABLE IF NOT EXISTS public.ged_hierarchy_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES auth.users(id),
    acao VARCHAR(100) NOT NULL,
    entidade_tipo VARCHAR(50),
    entidade_id UUID,
    detalhes JSONB,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT ALL ON public.ged_hierarchy_audit TO service_role;
GRANT SELECT, INSERT ON public.ged_hierarchy_audit TO authenticated;
ALTER TABLE public.ged_hierarchy_audit ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view audit log of their organization' AND tablename = 'ged_hierarchy_audit') THEN
        CREATE POLICY "Users can view audit log of their organization" 
        ON public.ged_hierarchy_audit FOR SELECT
        USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 8. Update Document table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ged_documents' AND column_name = 'past_id') THEN
        ALTER TABLE public.ged_documents ADD COLUMN past_id UUID REFERENCES public.folders(past_id);
    END IF;
END $$;
