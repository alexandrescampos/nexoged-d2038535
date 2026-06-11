CREATE TABLE public.lists (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.list_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lists TO authenticated;
GRANT ALL ON public.lists TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_items TO authenticated;
GRANT ALL ON public.list_items TO service_role;

-- RLS
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own lists" ON public.lists
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage items of their lists" ON public.list_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid())
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON public.lists
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();