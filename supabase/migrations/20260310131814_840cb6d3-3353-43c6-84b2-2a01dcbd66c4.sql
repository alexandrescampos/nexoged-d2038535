
-- Add DELETE policy on epi_request_items for managers (pending requests they own)
CREATE POLICY "Managers podem deletar itens de solicitações pendentes"
ON public.epi_request_items
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM epi_requests r
    WHERE r.id = epi_request_items.request_id
      AND r.organization_id = get_user_org_id(auth.uid())
      AND r.requested_by = auth.uid()
      AND r.status = 'pending'
      AND has_role(auth.uid(), 'manager'::app_role)
  )
);

-- Add DELETE policy on epi_request_items for org_admins
CREATE POLICY "OrgAdmins podem deletar itens de solicitações"
ON public.epi_request_items
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM epi_requests r
    WHERE r.id = epi_request_items.request_id
      AND r.organization_id = get_user_org_id(auth.uid())
      AND has_role(auth.uid(), 'org_admin'::app_role)
  )
);

-- Add UPDATE policy on epi_request_items for managers (pending requests they own)
CREATE POLICY "Managers podem atualizar itens de solicitações pendentes"
ON public.epi_request_items
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM epi_requests r
    WHERE r.id = epi_request_items.request_id
      AND r.organization_id = get_user_org_id(auth.uid())
      AND r.requested_by = auth.uid()
      AND r.status = 'pending'
      AND has_role(auth.uid(), 'manager'::app_role)
  )
);

-- Add UPDATE policy on epi_request_items for org_admins
CREATE POLICY "OrgAdmins podem atualizar itens de solicitações"
ON public.epi_request_items
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM epi_requests r
    WHERE r.id = epi_request_items.request_id
      AND r.organization_id = get_user_org_id(auth.uid())
      AND has_role(auth.uid(), 'org_admin'::app_role)
  )
);
