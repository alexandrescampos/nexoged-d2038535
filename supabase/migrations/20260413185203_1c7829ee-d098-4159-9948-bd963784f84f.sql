
-- 1. Create epi_cnpj_stock table
CREATE TABLE public.epi_cnpj_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epi_id uuid NOT NULL REFERENCES public.epis(id) ON DELETE CASCADE,
  organization_cnpj_id uuid NOT NULL REFERENCES public.organization_cnpjs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stock_quantity integer NOT NULL DEFAULT 0,
  used_stock_quantity integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (epi_id, organization_cnpj_id)
);

-- 2. Enable RLS
ALTER TABLE public.epi_cnpj_stock ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Usuários podem ver estoque da org"
  ON public.epi_cnpj_stock FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem criar estoque"
  ON public.epi_cnpj_stock FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'));

CREATE POLICY "OrgAdmins podem atualizar estoque"
  ON public.epi_cnpj_stock FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'));

CREATE POLICY "OrgAdmins podem deletar estoque"
  ON public.epi_cnpj_stock FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'));

CREATE POLICY "Managers podem atualizar estoque"
  ON public.epi_cnpj_stock FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers podem criar estoque"
  ON public.epi_cnpj_stock FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'));

CREATE POLICY "SuperAdmins podem gerenciar epi_cnpj_stock"
  ON public.epi_cnpj_stock FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- 4. Updated_at trigger
CREATE TRIGGER update_epi_cnpj_stock_updated_at
  BEFORE UPDATE ON public.epi_cnpj_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Migrate existing stock data to main CNPJ
INSERT INTO public.epi_cnpj_stock (epi_id, organization_cnpj_id, organization_id, stock_quantity, used_stock_quantity, min_stock)
SELECT
  e.id,
  c.id,
  e.organization_id,
  e.stock_quantity,
  e.used_stock_quantity,
  e.min_stock
FROM public.epis e
JOIN public.organization_cnpjs c
  ON c.organization_id = e.organization_id AND c.is_main = true
WHERE e.stock_quantity > 0 OR e.used_stock_quantity > 0 OR e.min_stock > 0;

-- 6. Trigger to sync consolidated stock back to epis table
CREATE OR REPLACE FUNCTION public.sync_epi_consolidated_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.epis
  SET
    stock_quantity = COALESCE(sub.total_stock, 0),
    used_stock_quantity = COALESCE(sub.total_used, 0),
    min_stock = COALESCE(sub.total_min, 0)
  FROM (
    SELECT
      epi_id,
      SUM(stock_quantity) AS total_stock,
      SUM(used_stock_quantity) AS total_used,
      SUM(min_stock) AS total_min
    FROM public.epi_cnpj_stock
    WHERE epi_id = COALESCE(NEW.epi_id, OLD.epi_id)
    GROUP BY epi_id
  ) sub
  WHERE epis.id = sub.epi_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_epi_stock_after_change
  AFTER INSERT OR UPDATE OR DELETE ON public.epi_cnpj_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_epi_consolidated_stock();

-- 7. Index for performance
CREATE INDEX idx_epi_cnpj_stock_org ON public.epi_cnpj_stock(organization_id);
CREATE INDEX idx_epi_cnpj_stock_epi ON public.epi_cnpj_stock(epi_id);
