
CREATE POLICY "SuperAdmins podem fazer upload de logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'organization-logos' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "SuperAdmins podem atualizar logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'organization-logos' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "SuperAdmins podem deletar logo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'organization-logos' AND public.has_role(auth.uid(), 'super_admin'));
