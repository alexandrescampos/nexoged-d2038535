-- Create SECURITY DEFINER function to get user's project IDs without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_project_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT project_id
  FROM public.project_members
  WHERE user_id = _user_id
$$;

-- Drop the policy with infinite recursion
DROP POLICY IF EXISTS "Gestores podem ver membros de projetos associados" ON public.project_members;

-- Recreate using the SECURITY DEFINER function to avoid recursion
CREATE POLICY "Gestores podem ver membros de projetos associados"
ON public.project_members FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND organization_id = get_user_org_id(auth.uid())
  AND project_id IN (SELECT get_user_project_ids(auth.uid()))
);