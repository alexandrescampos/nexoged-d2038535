-- 1. Estrutura Hierárquica: Setores e Pastas
CREATE TABLE public.sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sector_id UUID REFERENCES public.sectors(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Documentos e Metadados
CREATE TABLE public.ged_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    document_type TEXT, -- ex: Contrato, Nota Fiscal, Relatório
    taxonomy TEXT,      -- classificação ex: Jurídico > Contratos > Fornecedores
    status TEXT DEFAULT 'active', -- active, draft, archived, deleted (lixeira)
    tags TEXT[] DEFAULT '{}',
    keywords TEXT[] DEFAULT '{}',
    is_favorite BOOLEAN DEFAULT false, -- Este é global, idealmente deveria ser por usuário, mas seguindo o requisito simplificado.
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Versionamento de Arquivos
CREATE TABLE public.ged_document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.ged_documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_path TEXT NOT NULL, -- Caminho no Storage
    file_name TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    checksum TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Favoritos por Usuário
CREATE TABLE public.ged_user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.ged_documents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, document_id)
);

-- 5. Auditoria GED (Ação detalhada)
CREATE TABLE public.ged_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    document_id UUID REFERENCES public.ged_documents(id) ON DELETE SET NULL,
    version_id UUID REFERENCES public.ged_document_versions(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- upload, download, view, delete, restore
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Segurança (RLS e Grants)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sectors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ged_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ged_document_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ged_user_favorites TO authenticated;
GRANT SELECT, INSERT ON public.ged_audit_log TO authenticated;

GRANT ALL ON public.sectors TO service_role;
GRANT ALL ON public.folders TO service_role;
GRANT ALL ON public.ged_documents TO service_role;
GRANT ALL ON public.ged_document_versions TO service_role;
GRANT ALL ON public.ged_user_favorites TO service_role;
GRANT ALL ON public.ged_audit_log TO service_role;

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ged_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ged_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ged_user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ged_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS simplificadas por organização
CREATE POLICY "Users can manage sectors of their organization" ON public.sectors FOR ALL TO authenticated 
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage folders of their organization" ON public.folders FOR ALL TO authenticated 
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage documents of their organization" ON public.ged_documents FOR ALL TO authenticated 
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage versions of their organization docs" ON public.ged_document_versions FOR ALL TO authenticated 
USING (document_id IN (SELECT id FROM public.ged_documents WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())));

CREATE POLICY "Users can manage their own favorites" ON public.ged_user_favorites FOR ALL TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Users can view audit log of their organization" ON public.ged_audit_log FOR SELECT TO authenticated 
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 7. Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sectors_updated_at BEFORE UPDATE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ged_documents_updated_at BEFORE UPDATE ON public.ged_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Bucket de Armazenamento para Documentos
-- Nota: A criação de bucket é via ferramenta dedicada, mas vou preparar a permissão SQL aqui se o bucket existir.
-- O bucket deve se chamar 'ged_files'
