DROP POLICY IF EXISTS "Managers podem atualizar solicitações da org" ON public.epi_requests;

CREATE POLICY "Managers podem atualizar solicitações da org"
ON public.epi_requests
FOR UPDATE
USING (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(), 'manager'::app_role)
  AND (
    (requested_by = auth.uid() AND status = ANY (ARRAY['pending'::text, 'awaiting_signature'::text]))
    OR status = 'awaiting_signature'::text
  )
)
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(), 'manager'::app_role)
  AND status = ANY (ARRAY['pending'::text, 'awaiting_signature'::text, 'approved'::text, 'cancelled'::text])
);