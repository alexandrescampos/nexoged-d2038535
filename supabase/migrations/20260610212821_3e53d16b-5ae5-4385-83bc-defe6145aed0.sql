-- Remover política de visualização anterior para ged_documents (ajustar nome se necessário)
DROP POLICY IF EXISTS "Users can view their organization's documents" ON public.ged_documents;
DROP POLICY IF EXISTS "Visualização baseada em nível de sigilo" ON public.ged_documents;

-- Criar nova política robusta baseada em perfis
CREATE POLICY "Acesso por nível de sigilo do perfil" ON public.ged_documents
FOR SELECT
TO authenticated
USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  AND (
    -- Criador ou Dono sempre vê
    created_by = auth.uid()
    OR
    -- Admin da organização vê tudo (ajustado para a estrutura real de roles)
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND (role::text = 'admin' OR role::text = 'org_admin')
    )
    OR
    -- Usuário vê se o nível de sigilo do documento está entre os permitidos em seus perfis
    EXISTS (
      SELECT 1 FROM public.usuario_perfil up
      JOIN public.perfil perf ON up.perfil_id = perf.perfil_id
      WHERE up.usuario_id = auth.uid() 
      AND perf.ativo = true
      AND ged_documents.sigilo::text = ANY(perf.niveis_sigilo_permitidos)
    )
  )
);
