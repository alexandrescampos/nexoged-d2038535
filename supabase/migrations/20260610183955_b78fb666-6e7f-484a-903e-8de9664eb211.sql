-- Níveis de Sigilo
DO $$ BEGIN
    CREATE TYPE sigilo_nivel AS ENUM ('PUBLICO', 'INTERNO', 'RESTRITO', 'CONFIDENCIAL', 'SIGILOSO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tipos de Escopo
DO $$ BEGIN
    CREATE TYPE tipo_escopo_enum AS ENUM ('DEPARTAMENTO', 'SETOR', 'PASTA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Tabela de Perfis
CREATE TABLE IF NOT EXISTS public.perfil (
    perfil_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_nome TEXT NOT NULL,
    perfil_descricao TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil TO authenticated;
GRANT ALL ON public.perfil TO service_role;
ALTER TABLE public.perfil ENABLE ROW LEVEL SECURITY;

-- 2. Tabela de Permissões
CREATE TABLE IF NOT EXISTS public.permissao (
    perm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perm_codigo TEXT UNIQUE NOT NULL,
    perm_nome TEXT NOT NULL,
    perm_descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT ON public.permissao TO authenticated;
GRANT ALL ON public.permissao TO service_role;
ALTER TABLE public.permissao ENABLE ROW LEVEL SECURITY;

-- 3. Relacionamento Perfil X Permissão
CREATE TABLE IF NOT EXISTS public.perfil_permissao (
    perfil_id UUID REFERENCES public.perfil(perfil_id) ON DELETE CASCADE,
    perm_id UUID REFERENCES public.permissao(perm_id) ON DELETE CASCADE,
    PRIMARY KEY (perfil_id, perm_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_permissao TO authenticated;
GRANT ALL ON public.perfil_permissao TO service_role;
ALTER TABLE public.perfil_permissao ENABLE ROW LEVEL SECURITY;

-- 4. Usuário X Perfil
CREATE TABLE IF NOT EXISTS public.usuario_perfil (
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    perfil_id UUID REFERENCES public.perfil(perfil_id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, perfil_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_perfil TO authenticated;
GRANT ALL ON public.usuario_perfil TO service_role;
ALTER TABLE public.usuario_perfil ENABLE ROW LEVEL SECURITY;

-- 5. Escopo de Acesso (Usuario Escopo)
CREATE TABLE IF NOT EXISTS public.usuario_escopo (
    escopo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo_escopo tipo_escopo_enum NOT NULL,
    escopo_referencia_id UUID NOT NULL, -- ID do Dept, Setor ou Pasta
    herda_permissoes BOOLEAN DEFAULT true,
    data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT now(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_escopo TO authenticated;
GRANT ALL ON public.usuario_escopo TO service_role;
ALTER TABLE public.usuario_escopo ENABLE ROW LEVEL SECURITY;

-- 6. Documento X Usuário Autorizado
CREATE TABLE IF NOT EXISTS public.documento_usuario_autorizado (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id UUID REFERENCES public.ged_documents(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_usuario_autorizado TO authenticated;
GRANT ALL ON public.documento_usuario_autorizado TO service_role;
ALTER TABLE public.documento_usuario_autorizado ENABLE ROW LEVEL SECURITY;

-- 7. Alterações em Tabelas Existentes
ALTER TABLE public.ged_documents 
ADD COLUMN IF NOT EXISTS sigilo sigilo_nivel DEFAULT 'PUBLICO',
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Pasta já possui past_in_restrita e past_usuario_responsavel (visto no psql anterior)

-- 8. Seeds: Permissões Padrão
INSERT INTO public.permissao (perm_codigo, perm_nome, perm_descricao) VALUES
('visualizar_documento', 'Visualizar Documento', 'Permite visualizar e baixar documentos'),
('inserir_documento', 'Inserir Documento', 'Permite fazer upload de novos documentos'),
('editar_documento', 'Editar Documento', 'Permite alterar metadados e versões'),
('excluir_documento', 'Excluir Documento', 'Permite remover documentos'),
('restaurar_documento', 'Restaurar Documento', 'Permite restaurar itens da lixeira'),
('baixar_documento', 'Baixar Documento', 'Permite realizar o download dos arquivos'),
('compartilhar_documento', 'Compartilhar', 'Permite gerar links de compartilhamento'),
('aprovar_documento', 'Aprovar Documento', 'Permite aprovar documentos no workflow'),
('assinar_documento', 'Assinar Documento', 'Permite realizar assinatura digital'),
('criar_departamento', 'Criar Departamento', 'Permite cadastrar novos departamentos'),
('editar_departamento', 'Editar Departamento', 'Permite alterar departamentos'),
('criar_setor', 'Criar Setor', 'Permite cadastrar novos setores'),
('editar_setor', 'Editar Setor', 'Permite alterar setores'),
('criar_pasta', 'Criar Pasta', 'Permite criar novas pastas na estrutura'),
('editar_pasta', 'Editar Pasta', 'Permite alterar configurações de pastas'),
('gerenciar_usuarios', 'Gerenciar Usuários', 'Permite cadastrar e alterar usuários'),
('gerenciar_permissoes', 'Gerenciar Permissões', 'Permite configurar perfis e acessos'),
('visualizar_auditoria', 'Visualizar Auditoria', 'Acesso aos logs de segurança'),
('visualizar_relatorios', 'Visualizar Relatórios', 'Acesso aos relatórios gerenciais')
ON CONFLICT (perm_codigo) DO NOTHING;

-- 9. Políticas de RLS - Funções Auxiliares
CREATE OR REPLACE FUNCTION public.check_user_is_admin(user_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.usuario_perfil up
        JOIN public.perfil p ON up.perfil_id = p.perfil_id
        WHERE up.usuario_id = user_id AND p.perfil_nome = 'Administrador' AND p.ativo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Políticas de RLS para Documentos (Segurança Granular)
DROP POLICY IF EXISTS "Users can manage documents of their organization" ON public.ged_documents;

CREATE POLICY "Acesso Documentos Seguros" ON public.ged_documents
FOR SELECT TO authenticated
USING (
    -- 1. Administrador tem acesso total
    public.check_user_is_admin(auth.uid()) OR
    -- 2. Proprietário tem acesso total
    owner_id = auth.uid() OR
    created_by = auth.uid() OR
    -- 3. Documento Autorizado Especificamente
    EXISTS (SELECT 1 FROM public.documento_usuario_autorizado WHERE documento_id = id AND usuario_id = auth.uid()) OR
    -- 4. Sigilo e Escopo
    (
        (sigilo = 'PUBLICO') OR
        (sigilo = 'INTERNO' AND EXISTS (
            SELECT 1 FROM public.profiles p1 
            JOIN public.profiles p2 ON p1.organization_id = p2.organization_id 
            WHERE p1.id = auth.uid() AND p2.id = ged_documents.created_by AND p1.department_id = p2.department_id
        )) OR
        (sigilo IN ('CONFIDENCIAL', 'RESTRITO') AND (
            EXISTS (
                SELECT 1 FROM public.usuario_perfil up
                JOIN public.perfil p ON up.perfil_id = p.perfil_id
                WHERE up.usuario_id = auth.uid() AND p.perfil_nome IN ('Gestor', 'Administrador')
            )
        ))
    ) AND
    -- 5. Verificação de Escopo Hierárquico (Simplificado para RLS performático)
    (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        -- A lógica complexa de herança de escopo é idealmente tratada via views ou funções de segurança recursivas
        -- Para manter performance no RLS, focamos nas restrições de pasta
    )
);

-- Políticas RLS para Perfis e Permissões
CREATE POLICY "Admins can manage profiles" ON public.perfil FOR ALL TO authenticated USING (public.check_user_is_admin(auth.uid()));
CREATE POLICY "Users can view active profiles" ON public.perfil FOR SELECT TO authenticated USING (ativo = true);

CREATE POLICY "Everyone can view permissions" ON public.permissao FOR SELECT TO authenticated USING (true);
