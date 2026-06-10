-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Acesso Proprietário Documento Storage" ON storage.objects;
DROP POLICY IF EXISTS "Permitir download apenas com permissão ou propriedade" ON storage.objects;

-- Create a robust policy for downloading files from 'ged_files' bucket
CREATE POLICY "Permitir download apenas com permissão ou propriedade"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'ged_files' AND (
        -- 1. Admins have full access
        public.check_user_is_admin(auth.uid()) OR
        -- 2. Check if user is owner/creator of the document or has explicit download permission
        EXISTS (
            SELECT 1 FROM public.ged_documents d
            WHERE d.id::text = (storage.foldername(name))[2] -- Standard path: documents/DOCUMENT_ID/file.ext
            AND (
                -- Owner or creator
                d.owner_id = auth.uid() OR 
                d.created_by = auth.uid() OR
                -- Has explicit authorization for this document
                EXISTS (SELECT 1 FROM public.documento_usuario_autorizado dua WHERE dua.documento_id = d.id AND dua.usuario_id = auth.uid()) OR
                -- Has the 'baixar_documento' permission through a profile
                EXISTS (
                    SELECT 1 FROM public.usuario_perfil up
                    JOIN public.perfil_permissao pp ON up.perfil_id = pp.perfil_id
                    JOIN public.permissao p ON pp.perm_id = p.perm_id
                    WHERE up.usuario_id = auth.uid() 
                    AND p.perm_codigo = 'baixar_documento'
                    AND up.organization_id = d.organization_id
                )
            )
        )
    )
);