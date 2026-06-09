-- Nova política: Gestores podem ver time entries dos projetos associados
CREATE POLICY "Gestores podem ver time entries de projetos associados"
ON time_entries FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'manager') AND
  organization_id = get_user_org_id(auth.uid()) AND
  is_project_member(auth.uid(), project_id)
);

-- Nova política: Gestores podem aprovar/rejeitar time entries dos projetos associados
CREATE POLICY "Gestores podem aprovar/rejeitar em projetos associados"
ON time_entries FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'manager') AND
  organization_id = get_user_org_id(auth.uid()) AND
  is_project_member(auth.uid(), project_id)
);