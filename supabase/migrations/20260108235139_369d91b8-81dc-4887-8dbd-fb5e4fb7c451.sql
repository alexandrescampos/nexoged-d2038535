-- Criar trigger para inserir profile automaticamente quando um usuário é criado
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Inserir profiles para usuários existentes que não têm
INSERT INTO public.profiles (id, full_name, email)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', u.email),
  u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Atualizar organization_id para usuários que têm roles com organização
UPDATE public.profiles p
SET organization_id = ur.organization_id
FROM public.user_roles ur
WHERE ur.user_id = p.id 
  AND ur.organization_id IS NOT NULL
  AND p.organization_id IS NULL;