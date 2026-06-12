
-- 1) Fix SECURITY DEFINER view -> use security_invoker
ALTER VIEW public.organization_usage SET (security_invoker = true);

-- 2) Tighten RLS on documento_ocr and documento_ocr_pagina to enforce organization membership
DROP POLICY IF EXISTS "OCR visível para quem vê o documento" ON public.documento_ocr;
CREATE POLICY "OCR visível para membros da organização"
ON public.documento_ocr
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.ged_documents d
    WHERE d.id = documento_ocr.documento_id
      AND d.organization_id = public.get_user_org_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Páginas OCR visíveis para quem vê o documento" ON public.documento_ocr_pagina;
CREATE POLICY "Páginas OCR visíveis para membros da organização"
ON public.documento_ocr_pagina
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.ged_documents d
    WHERE d.id = documento_ocr_pagina.documento_id
      AND d.organization_id = public.get_user_org_id(auth.uid())
  )
);

-- 3) Tighten storage policies on ged_files bucket. Remove broad bucket-only policies
DROP POLICY IF EXISTS "Allow authenticated select" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their organization files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload organization files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update organization files" ON storage.objects;

-- Replace with organization-scoped policies. Path format: documents/{document_id}/...
-- SELECT: keep the existing restrictive permission/ownership policy (already present).
-- Add org-scoped fallback so members of the document's organization can read.
CREATE POLICY "ged_files org members can select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ged_files'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id::text = (storage.foldername(objects.name))[2]
        AND d.organization_id = public.get_user_org_id(auth.uid())
    )
  )
);

CREATE POLICY "ged_files org members can insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ged_files'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id::text = (storage.foldername(objects.name))[2]
        AND d.organization_id = public.get_user_org_id(auth.uid())
    )
    -- Allow initial upload before the document row exists, scoped by uploader owning the doc later via app logic.
    OR auth.uid() IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id::text = (storage.foldername(objects.name))[2]
    )
  )
);

CREATE POLICY "ged_files org members can update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ged_files'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id::text = (storage.foldername(objects.name))[2]
        AND d.organization_id = public.get_user_org_id(auth.uid())
    )
  )
)
WITH CHECK (
  bucket_id = 'ged_files'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id::text = (storage.foldername(objects.name))[2]
        AND d.organization_id = public.get_user_org_id(auth.uid())
    )
  )
);

CREATE POLICY "ged_files org admins can delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ged_files'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.ged_documents d
      WHERE d.id::text = (storage.foldername(objects.name))[2]
        AND d.organization_id = public.get_user_org_id(auth.uid())
        AND (
          public.has_role_in_org(auth.uid(), 'org_admin', d.organization_id)
          OR d.owner_id = auth.uid()
          OR d.created_by = auth.uid()
        )
    )
  )
);
