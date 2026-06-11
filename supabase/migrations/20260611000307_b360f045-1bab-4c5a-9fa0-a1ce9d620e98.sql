-- Política para permitir UPDATE (incluindo deleção lógica)
CREATE POLICY "Users can update documents they own or are admins"
ON public.ged_documents
FOR UPDATE
TO authenticated
USING (
  (created_by = auth.uid()) OR 
  (owner_id = auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND (role = 'org_admin'::app_role)
    AND (organization_id = ged_documents.organization_id)
  ) OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND (role = 'super_admin'::app_role)
  )
)
WITH CHECK (
  (created_by = auth.uid()) OR 
  (owner_id = auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND (role = 'org_admin'::app_role)
    AND (organization_id = ged_documents.organization_id)
  ) OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND (role = 'super_admin'::app_role)
  )
);

-- Política para permitir INSERT
CREATE POLICY "Users can insert documents into their organization"
ON public.ged_documents
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Política para permitir DELETE físico
CREATE POLICY "Users can delete documents they own or are admins"
ON public.ged_documents
FOR DELETE
TO authenticated
USING (
  (created_by = auth.uid()) OR 
  (owner_id = auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND (role = 'org_admin'::app_role)
    AND (organization_id = ged_documents.organization_id)
  ) OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND (role = 'super_admin'::app_role)
  )
);
