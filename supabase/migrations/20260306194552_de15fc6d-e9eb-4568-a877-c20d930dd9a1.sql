-- Create employee_documents table
CREATE TABLE public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL DEFAULT 'Outro',
  document_date DATE,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Usuários podem ver documentos da org"
  ON public.employee_documents FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem inserir documentos"
  ON public.employee_documents FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'));

CREATE POLICY "Managers podem inserir documentos"
  ON public.employee_documents FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'));

CREATE POLICY "OrgAdmins podem deletar documentos"
  ON public.employee_documents FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'));

CREATE POLICY "SuperAdmins podem gerenciar employee_documents"
  ON public.employee_documents FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', true);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload employee documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'employee-documents');

CREATE POLICY "Authenticated users can read employee documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'employee-documents');

CREATE POLICY "Authenticated users can delete employee documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'employee-documents');