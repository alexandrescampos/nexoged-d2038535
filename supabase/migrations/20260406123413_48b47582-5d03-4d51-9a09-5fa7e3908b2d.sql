-- Allow managers to update their own requests when status is awaiting_signature (for signing terms)
DROP POLICY IF EXISTS "Managers podem cancelar suas solicitações" ON public.epi_requests;
CREATE POLICY "Managers podem atualizar suas solicitações pendentes ou aguardando assinatura"
ON public.epi_requests
FOR UPDATE
TO public
USING (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(), 'manager'::app_role)
  AND requested_by = auth.uid()
  AND status IN ('pending', 'awaiting_signature')
);