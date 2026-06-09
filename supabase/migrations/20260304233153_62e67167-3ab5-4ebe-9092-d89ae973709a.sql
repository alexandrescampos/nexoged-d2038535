
-- Create storage bucket for signed terms
INSERT INTO storage.buckets (id, name, public)
VALUES ('signed-terms', 'signed-terms', true);

-- Create table for signed term metadata
CREATE TABLE public.epi_signed_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_record_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  delivery_date date NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_signed_terms ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Usuários podem ver termos da org"
  ON public.epi_signed_terms FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem inserir termos"
  ON public.epi_signed_terms FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem inserir termos"
  ON public.epi_signed_terms FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "OrgAdmins podem deletar termos"
  ON public.epi_signed_terms FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "SuperAdmins podem gerenciar epi_signed_terms"
  ON public.epi_signed_terms FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload signed terms"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'signed-terms');

CREATE POLICY "Authenticated users can read signed terms"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'signed-terms');
