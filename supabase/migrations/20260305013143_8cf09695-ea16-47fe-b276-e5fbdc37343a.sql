
-- Update check constraint to allow 'cancelled' status
ALTER TABLE public.epi_requests DROP CONSTRAINT epi_requests_status_check;
ALTER TABLE public.epi_requests ADD CONSTRAINT epi_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

-- Allow managers to update their own requests (for cancellation)
CREATE POLICY "Managers podem cancelar suas solicitações"
  ON public.epi_requests FOR UPDATE
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND has_role(auth.uid(), 'manager')
    AND requested_by = auth.uid()
    AND status = 'pending'
  );
