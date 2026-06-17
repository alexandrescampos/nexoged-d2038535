-- Drop overly permissive policies that allow any org member to write
DROP POLICY IF EXISTS "Users can manage document custom field values" ON public.ged_document_custom_field_values;
DROP POLICY IF EXISTS "Users can manage document type custom fields" ON public.ged_document_type_custom_fields;