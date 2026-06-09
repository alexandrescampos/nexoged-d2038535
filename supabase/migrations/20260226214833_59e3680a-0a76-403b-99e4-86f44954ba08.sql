
-- Enum para status de entrega de EPI
CREATE TYPE public.epi_delivery_status AS ENUM ('delivered', 'returned', 'lost', 'damaged');

-- Categorias de EPI
CREATE TABLE public.epi_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_categories ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_epi_categories_updated_at
  BEFORE UPDATE ON public.epi_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS epi_categories
CREATE POLICY "SuperAdmins podem gerenciar epi_categories"
  ON public.epi_categories FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Usuários podem ver categorias da org"
  ON public.epi_categories FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem criar categorias"
  ON public.epi_categories FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar categorias"
  ON public.epi_categories FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem deletar categorias"
  ON public.epi_categories FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- Catálogo de EPIs
CREATE TABLE public.epis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.epi_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  ca_number text,
  ca_expiration date,
  manufacturer text,
  model text,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.epis ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_epis_updated_at
  BEFORE UPDATE ON public.epis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS epis
CREATE POLICY "SuperAdmins podem gerenciar epis"
  ON public.epis FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Usuários podem ver EPIs da org"
  ON public.epis FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem criar EPIs"
  ON public.epis FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar EPIs"
  ON public.epis FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem deletar EPIs"
  ON public.epis FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- Entregas de EPI
CREATE TABLE public.epi_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  epi_id uuid NOT NULL REFERENCES public.epis(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id),
  delivered_by uuid NOT NULL REFERENCES public.profiles(id),
  quantity integer NOT NULL DEFAULT 1,
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  status epi_delivery_status NOT NULL DEFAULT 'delivered',
  return_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_deliveries ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_epi_deliveries_updated_at
  BEFORE UPDATE ON public.epi_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS epi_deliveries
CREATE POLICY "SuperAdmins podem gerenciar epi_deliveries"
  ON public.epi_deliveries FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Usuários podem ver entregas da org"
  ON public.epi_deliveries FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem criar entregas"
  ON public.epi_deliveries FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem criar entregas"
  ON public.epi_deliveries FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "OrgAdmins podem atualizar entregas"
  ON public.epi_deliveries FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem atualizar entregas"
  ON public.epi_deliveries FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "OrgAdmins podem deletar entregas"
  ON public.epi_deliveries FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));
