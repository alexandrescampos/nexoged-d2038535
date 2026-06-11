CREATE TABLE public.organization_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google_drive'
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_integrations TO authenticated;
GRANT ALL ON public.organization_integrations TO service_role;

ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization integrations" 
  ON public.organization_integrations FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Organization admins can manage integrations" 
  ON public.organization_integrations FOR ALL 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE TRIGGER update_organization_integrations_updated_at 
  BEFORE UPDATE ON public.organization_integrations 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();