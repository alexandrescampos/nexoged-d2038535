-- Ensure ged_user_favorites exists and has correct structure
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ged_user_favorites') THEN
        CREATE TABLE public.ged_user_favorites (
            id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            document_id UUID NOT NULL REFERENCES public.ged_documents(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            UNIQUE(user_id, document_id)
        );

        GRANT SELECT, INSERT, DELETE ON public.ged_user_favorites TO authenticated;
        GRANT ALL ON public.ged_user_favorites TO service_role;

        ALTER TABLE public.ged_user_favorites ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can manage their own favorites" 
        ON public.ged_user_favorites 
        FOR ALL 
        USING (auth.uid() = user_id) 
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
