CREATE TABLE public.ged_document_types (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    initials TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    requires_expiration_date BOOLEAN DEFAULT false,
    requires_creation_date BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ged_document_types TO authenticated;
GRANT ALL ON public.ged_document_types TO service_role;

ALTER TABLE public.ged_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view document types in their organization"
ON public.ged_document_types FOR SELECT
TO authenticated
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage document types in their organization"
ON public.ged_document_types FOR ALL
TO authenticated
USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND organization_id = public.ged_document_types.organization_id 
    AND role = 'org_admin'
  )
)
WITH CHECK (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND organization_id = public.ged_document_types.organization_id 
    AND role = 'org_admin'
  )
);

-- Add columns to ged_documents
ALTER TABLE public.ged_documents ADD COLUMN document_type_id UUID REFERENCES public.ged_document_types(id);
ALTER TABLE public.ged_documents ADD COLUMN expiration_date DATE;
ALTER TABLE public.ged_documents ADD COLUMN document_creation_date DATE;

-- Update trigger for updated_at on ged_document_types
CREATE TRIGGER update_ged_document_types_updated_at 
BEFORE UPDATE ON public.ged_document_types 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();