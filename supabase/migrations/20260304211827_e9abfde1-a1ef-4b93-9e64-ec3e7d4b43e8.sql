-- Recreate the trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix the stuck user: insert missing profile
INSERT INTO public.profiles (id, full_name, email, organization_id)
VALUES (
  '51a50964-0c19-4bc4-9e35-2b3fccbcfd6f',
  'Alexandre',
  'alexandre.scampos1973@gmail.com',
  '6a32b540-a4e2-4668-8907-acb2d0834c0d'
)
ON CONFLICT (id) DO NOTHING;