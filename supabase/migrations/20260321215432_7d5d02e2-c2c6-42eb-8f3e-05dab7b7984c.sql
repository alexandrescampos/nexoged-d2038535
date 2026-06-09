-- Create table for per-organization API integration keys
CREATE TABLE public.organization_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Chave principal',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ NULL,
  created_by UUID NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_api_keys_prefix_unique UNIQUE (key_prefix),
  CONSTRAINT organization_api_keys_hash_unique UNIQUE (key_hash)
);

CREATE INDEX idx_organization_api_keys_organization_id
  ON public.organization_api_keys (organization_id);

CREATE INDEX idx_organization_api_keys_active_org
  ON public.organization_api_keys (organization_id, is_active);

ALTER TABLE public.organization_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OrgAdmins podem ver chaves da propria organizacao"
ON public.organization_api_keys
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_org_id(auth.uid())
  AND public.has_role(auth.uid(), 'org_admin')
);

CREATE POLICY "OrgAdmins podem inserir chaves da propria organizacao"
ON public.organization_api_keys
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_org_id(auth.uid())
  AND created_by = auth.uid()
  AND public.has_role(auth.uid(), 'org_admin')
);

CREATE POLICY "OrgAdmins podem atualizar chaves da propria organizacao"
ON public.organization_api_keys
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_org_id(auth.uid())
  AND public.has_role(auth.uid(), 'org_admin')
)
WITH CHECK (
  organization_id = public.get_user_org_id(auth.uid())
  AND public.has_role(auth.uid(), 'org_admin')
);

CREATE POLICY "SuperAdmins podem gerenciar chaves API"
ON public.organization_api_keys
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_organization_api_keys_updated_at
BEFORE UPDATE ON public.organization_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();