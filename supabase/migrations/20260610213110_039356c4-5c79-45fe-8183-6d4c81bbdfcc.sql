-- Atualizar política de visualização para considerar o escopo do perfil
DROP POLICY IF EXISTS "Acesso por nível de sigilo do perfil" ON public.ged_documents;

CREATE POLICY "Acesso por sigilo e escopo do perfil" ON public.ged_documents
FOR SELECT
TO authenticated
USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  AND (
    -- Admin da organização vê tudo
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND (role::text = 'admin' OR role::text = 'org_admin')
    )
    OR
    -- Criador ou Dono sempre vê
    created_by = auth.uid()
    OR
    -- Usuário vê se atende aos critérios de Sigilo E Escopo
    EXISTS (
      SELECT 1 FROM public.usuario_perfil up
      JOIN public.perfil perf ON up.perfil_id = perf.perfil_id
      WHERE up.usuario_id = auth.uid() 
      AND perf.ativo = true
      AND ged_documents.sigilo::text = ANY(perf.niveis_sigilo_permitidos)
      AND (
        -- Verifica se o documento está no escopo do perfil (considerando a hierarquia)
        EXISTS (
          SELECT 1 FROM public.perfil_escopo pe
          WHERE pe.perfil_id = perf.perfil_id
          AND (
            (pe.tipo_escopo = 'PASTA' AND ged_documents.folder_id = pe.referencia_id)
            OR
            (pe.tipo_escopo = 'SETOR' AND EXISTS (
                SELECT 1 FROM public.folders f WHERE f.past_id = ged_documents.folder_id AND f.set_id = pe.referencia_id
            ))
            OR
            (pe.tipo_escopo = 'DEPARTAMENTO' AND EXISTS (
                SELECT 1 FROM public.folders f 
                JOIN public.sectors s ON f.set_id = s.set_id
                WHERE f.past_id = ged_documents.folder_id AND s.dept_id = pe.referencia_id
            ))
          )
        )
      )
    )
  )
);
