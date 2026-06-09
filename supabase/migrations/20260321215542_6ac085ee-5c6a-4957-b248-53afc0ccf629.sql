CREATE UNIQUE INDEX uq_organization_api_keys_one_active_per_org
ON public.organization_api_keys (organization_id)
WHERE is_active = true;