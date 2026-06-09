CREATE POLICY "Users can insert audit logs in their organization"
ON public.ged_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  AND user_id = auth.uid()
);