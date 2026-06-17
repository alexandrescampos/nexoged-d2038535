DROP POLICY IF EXISTS "Users can insert audit logs in their organization" ON public.ged_audit_log;
CREATE POLICY "Only service role and admins can insert audit logs"
ON public.ged_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'org_admin')
);