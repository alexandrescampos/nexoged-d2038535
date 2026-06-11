CREATE TABLE public.custom_fields (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    name TEXT NOT NULL,
    description TEXT,
    field_type TEXT NOT NULL, -- boolean, integer, decimal, text, textarea, date, list
    list_id UUID REFERENCES public.lists(id) ON DELETE SET NULL,
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_fields TO authenticated;
GRANT ALL ON public.custom_fields TO service_role;

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own custom fields" 
ON public.custom_fields 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_custom_fields_updated_at 
BEFORE UPDATE ON public.custom_fields 
FOR EACH ROW 
EXECUTE FUNCTION public.update_updated_at_column();