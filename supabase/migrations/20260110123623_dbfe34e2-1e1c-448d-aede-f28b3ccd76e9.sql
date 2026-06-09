-- Remover política antiga que não inclui managers
DROP POLICY IF EXISTS "OrgAdmins podem ver perfis da sua organização" ON public.profiles;

-- Criar nova política que inclui managers
CREATE POLICY "Usuários autorizados podem ver perfis da organização"
ON public.profiles
FOR SELECT
USING (
  (organization_id = get_user_org_id(auth.uid())) 
  AND (
    has_role(auth.uid(), 'org_admin'::app_role) 
    OR has_role(auth.uid(), 'analyst'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);