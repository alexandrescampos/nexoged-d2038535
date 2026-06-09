
-- Create epi_requests table
CREATE TABLE public.epi_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  request_type text NOT NULL CHECK (request_type IN ('new', 'exchange')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid NOT NULL,
  responded_by uuid,
  responded_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create epi_request_items table
CREATE TABLE public.epi_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.epi_requests(id) ON DELETE CASCADE,
  epi_id uuid NOT NULL REFERENCES public.epis(id),
  quantity integer NOT NULL DEFAULT 1,
  delivery_id uuid REFERENCES public.epi_deliveries(id),
  reason text
);

-- Enable RLS
ALTER TABLE public.epi_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epi_request_items ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE TRIGGER update_epi_requests_updated_at
  BEFORE UPDATE ON public.epi_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for epi_requests
CREATE POLICY "Usuários podem ver solicitações da org"
  ON public.epi_requests FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Managers podem criar solicitações"
  ON public.epi_requests FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'));

CREATE POLICY "OrgAdmins podem criar solicitações"
  ON public.epi_requests FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'));

CREATE POLICY "OrgAdmins podem atualizar solicitações"
  ON public.epi_requests FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'));

CREATE POLICY "SuperAdmins podem gerenciar epi_requests"
  ON public.epi_requests FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- RLS for epi_request_items
CREATE POLICY "Usuários podem ver itens de solicitações da org"
  ON public.epi_request_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.epi_requests r
    WHERE r.id = request_id AND r.organization_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "Managers podem criar itens de solicitações"
  ON public.epi_request_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.epi_requests r
    WHERE r.id = request_id AND r.organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager')
  ));

CREATE POLICY "OrgAdmins podem criar itens de solicitações"
  ON public.epi_request_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.epi_requests r
    WHERE r.id = request_id AND r.organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin')
  ));

CREATE POLICY "SuperAdmins podem gerenciar epi_request_items"
  ON public.epi_request_items FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));
