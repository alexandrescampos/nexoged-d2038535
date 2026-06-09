-- Add RLS policy to allow managers to see members of projects they belong to
CREATE POLICY "Gestores podem ver membros de projetos associados"
ON public.project_members
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND organization_id = get_user_org_id(auth.uid())
  AND project_id IN (
    SELECT pm2.project_id 
    FROM public.project_members pm2 
    WHERE pm2.user_id = auth.uid()
  )
);