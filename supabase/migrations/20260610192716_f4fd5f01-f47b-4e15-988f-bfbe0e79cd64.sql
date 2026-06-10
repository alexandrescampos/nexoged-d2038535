-- 1. Atualizar a política de RLS para ged_documents
DROP POLICY IF EXISTS "Acesso Documentos Seguros" ON public.ged_documents;

CREATE POLICY "Acesso Documentos Seguros" ON public.ged_documents
FOR SELECT TO authenticated
USING (
    -- Administrador tem acesso total
    public.check_user_is_admin(auth.uid()) OR
    -- Proprietário tem acesso total (Explicitamente garantido conforme pedido)
    owner_id = auth.uid() OR
    created_by = auth.uid() OR
    -- Documento Autorizado Especificamente
    EXISTS (SELECT 1 FROM public.documento_usuario_autorizado WHERE documento_id = id AND usuario_id = auth.uid()) OR
    -- Sigilo e Escopo (Mesma lógica anterior, mas com o check de organização simplificado para performance)
    (
        (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())) AND
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
        )
    )
);

-- 2. Atualizar políticas de storage para o bucket 'documents'
-- O bucket 'documents' armazena os arquivos do GED. 
-- Precisamos permitir que o proprietário do registro no ged_documents consiga ler o arquivo.

DROP POLICY IF EXISTS "Acesso Proprietário Documento Storage" ON storage.objects;

CREATE POLICY "Acesso Proprietário Documento Storage"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'documents' AND (
        -- Permite se for o criador do objeto no storage
        owner = auth.uid() OR
        -- Permite se houver um registro correspondente em ged_documents onde ele é proprietário
        -- A estrutura do path geralmente é documents/id_do_documento/...
        EXISTS (
            SELECT 1 FROM public.ged_documents
            WHERE id::text = (storage.foldername(name))[1]
            AND (owner_id = auth.uid() OR created_by = auth.uid())
        ) OR
        -- Permite para administradores
        public.check_user_is_admin(auth.uid())
    )
);