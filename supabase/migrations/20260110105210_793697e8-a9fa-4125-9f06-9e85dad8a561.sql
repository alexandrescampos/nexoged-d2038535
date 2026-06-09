-- Dropar política atual de SELECT
DROP POLICY IF EXISTS "OrgAdmins e Analistas podem ver clientes da organização" ON clients;

-- Criar nova política que inclui managers para ver clientes dos projetos associados
CREATE POLICY "Usuários autorizados podem ver clientes da organização" 
ON clients FOR SELECT
USING (
  (organization_id = get_user_org_id(auth.uid())) 
  AND (
    has_role(auth.uid(), 'org_admin'::app_role) 
    OR has_role(auth.uid(), 'analyst'::app_role)
    OR (
      has_role(auth.uid(), 'manager'::app_role) 
      AND id IN (
        SELECT DISTINCT c.id FROM clients c
        JOIN projects p ON p.client_id = c.id
        JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = auth.uid()
      )
    )
  )
);