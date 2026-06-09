-- Create SECURITY DEFINER function to get users from projects
-- This avoids RLS issues when managers query profiles through project_members
CREATE OR REPLACE FUNCTION public.get_project_members_profiles(_project_ids uuid[])
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT DISTINCT p.id, p.full_name
  FROM public.profiles p
  INNER JOIN public.project_members pm ON pm.user_id = p.id
  WHERE pm.project_id = ANY(_project_ids)
    AND p.is_active = true
  ORDER BY p.full_name
$$;