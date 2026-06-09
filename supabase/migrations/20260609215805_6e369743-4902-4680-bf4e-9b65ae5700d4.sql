-- 1. Ensure the trigger exists for handle_new_user if it was missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;

-- 2. Manually fix the profile for Alan da Silva if it's missing or unlinked
DO $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
BEGIN
    -- Get Alan's ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'alan@gmail.com';
    -- Get Nexo GED Org ID
    SELECT id INTO v_org_id FROM public.organizations WHERE name = 'Nexo GED' LIMIT 1;

    IF v_user_id IS NOT NULL AND v_org_id IS NOT NULL THEN
        -- Upsert profile
        INSERT INTO public.profiles (id, full_name, email, organization_id, is_active, must_reset_password)
        VALUES (v_user_id, 'Alan da Silva', 'alan@gmail.com', v_org_id, true, true)
        ON CONFLICT (id) DO UPDATE SET 
            organization_id = EXCLUDED.organization_id,
            full_name = EXCLUDED.full_name,
            is_active = true;
            
        -- Ensure role is set
        INSERT INTO public.user_roles (user_id, organization_id, role)
        VALUES (v_user_id, v_org_id, 'user')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
