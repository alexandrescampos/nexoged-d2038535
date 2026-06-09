-- Update function to include org_admins in the user list
CREATE OR REPLACE FUNCTION public.get_project_members_profiles(_project_ids uuid[])
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Usuários explicitamente membros dos projetos
  SELECT DISTINCT p.id, p.full_name
  FROM public.profiles p
  INNER JOIN public.project_members pm ON pm.user_id = p.id
  WHERE pm.project_id = ANY(_project_ids)
    AND p.is_active = true
  
  UNION
  
  -- Org admins da mesma organização (podem lançar em qualquer projeto)
  SELECT DISTINCT p.id, p.full_name
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'org_admin'
    AND ur.organization_id = (
      SELECT organization_id 
      FROM public.projects 
      WHERE id = ANY(_project_ids) 
      LIMIT 1
    )
    AND p.is_active = true
  
  ORDER BY full_name
$$;