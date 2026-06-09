-- Create security definer function to check if a manager can see a client
CREATE OR REPLACE FUNCTION public.can_manager_see_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.project_members pm ON pm.project_id = p.id
    WHERE p.client_id = _client_id
      AND pm.user_id = _user_id
  )
$$;

-- Drop the old policy with infinite recursion
DROP POLICY IF EXISTS "Usuários autorizados podem ver clientes da organização" ON public.clients;

-- Create new policy without recursion
CREATE POLICY "Usuários autorizados podem ver clientes da organização"
ON public.clients
FOR SELECT
USING (
  (organization_id = get_user_org_id(auth.uid())) 
  AND (
    has_role(auth.uid(), 'org_admin'::app_role) 
    OR has_role(auth.uid(), 'analyst'::app_role) 
    OR (has_role(auth.uid(), 'manager'::app_role) AND can_manager_see_client(auth.uid(), id))
  )
);