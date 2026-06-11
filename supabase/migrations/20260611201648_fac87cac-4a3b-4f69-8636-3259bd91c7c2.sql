-- Join table for document types and custom fields
CREATE TABLE public.ged_document_type_custom_fields (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    document_type_id UUID NOT NULL REFERENCES public.ged_document_types(id) ON DELETE CASCADE,
    custom_field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(document_type_id, custom_field_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ged_document_type_custom_fields TO authenticated;
GRANT ALL ON public.ged_document_type_custom_fields TO service_role;
ALTER TABLE public.ged_document_type_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage document type custom fields" 
ON public.ged_document_type_custom_fields 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.ged_document_types dt 
        JOIN public.profiles p ON p.organization_id = dt.organization_id
        WHERE dt.id = ged_document_type_custom_fields.document_type_id 
        AND p.id = auth.uid()
    )
);

-- Table for storing the actual values on documents
CREATE TABLE public.ged_document_custom_field_values (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES public.ged_documents(id) ON DELETE CASCADE,
    custom_field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(document_id, custom_field_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ged_document_custom_field_values TO authenticated;
GRANT ALL ON public.ged_document_custom_field_values TO service_role;
ALTER TABLE public.ged_document_custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage document custom field values" 
ON public.ged_document_custom_field_values 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.ged_documents d
        JOIN public.profiles p ON p.organization_id = d.organization_id
        WHERE d.id = ged_document_custom_field_values.document_id 
        AND p.id = auth.uid()
    )
);

-- Trigger for updated_at on values if it doesn't exist for public
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ged_document_custom_field_values_updated_at') THEN
        CREATE TRIGGER update_ged_document_custom_field_values_updated_at
        BEFORE UPDATE ON public.ged_document_custom_field_values
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
