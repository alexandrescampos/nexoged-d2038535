-- Ensure profiles has password_updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'password_updated_at') THEN
        ALTER TABLE public.profiles ADD COLUMN password_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
END $$;

-- Ensure password_history table exists with correct structure
CREATE TABLE IF NOT EXISTS public.password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on password_history
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

-- Only service role or specialized functions should access this
CREATE POLICY "System can manage password history" ON public.password_history
    FOR ALL USING (false) WITH CHECK (false);

-- Function to check if password is in history
CREATE OR REPLACE FUNCTION public.is_password_in_history(p_user_id UUID, p_new_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    is_repeated BOOLEAN := FALSE;
    hist_record RECORD;
BEGIN
    -- Check against the last 3 passwords
    FOR hist_record IN (
        SELECT password_hash 
        FROM public.password_history 
        WHERE user_id = p_user_id 
        ORDER BY created_at DESC 
        LIMIT 3
    ) LOOP
        IF hist_record.password_hash = crypt(p_new_password, hist_record.password_hash) THEN
            is_repeated := TRUE;
            EXIT;
        END IF;
    END LOOP;
    
    RETURN is_repeated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add password to history and update profile timestamp
CREATE OR REPLACE FUNCTION public.record_password_change(p_user_id UUID, p_new_password TEXT)
RETURNS VOID AS $$
BEGIN
    -- Add new hash
    INSERT INTO public.password_history (user_id, password_hash)
    VALUES (p_user_id, crypt(p_new_password, gen_salt('bf')));
    
    -- Update profile
    UPDATE public.profiles 
    SET password_updated_at = now(),
        must_reset_password = false
    WHERE id = p_user_id;
    
    -- Cleanup: Keep only last 10 entries per user (just in case, though we only check 3)
    DELETE FROM public.password_history
    WHERE id IN (
        SELECT id FROM public.password_history
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        OFFSET 10
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
