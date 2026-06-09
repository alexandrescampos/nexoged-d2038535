DO $$
DECLARE
  org_id UUID := gen_random_uuid();
  user_id UUID := gen_random_uuid();
BEGIN
  -- 1. Criar Organização Padrão (necessária para o funcionamento do sistema)
  INSERT INTO public.organizations (id, name, slug, status, plan)
  VALUES (org_id, 'Nexo GED', 'nexo-ged', 'active', 'basic');

  -- 2. Criar Usuário no Auth (Placeholder, o usuário precisará 'recuperar senha' ou ser criado via dashboard)
  -- Como não posso criar usuários diretamente no auth.users via SQL sem hash de senha correto,
  -- Vou inserir apenas nos perfis e roles. O usuário deverá ser criado pelo painel ou convite.
  -- No entanto, para fins de demonstração e prompt, vou preparar o registro que o sistema espera.
  
  -- Para que o usuário Alexandre consiga logar, ele PRECISA existir em auth.users.
  -- Como agente, eu geralmente recomendo que o usuário crie o primeiro admin via tela de login ou 
  -- eu posso fornecer um script para rodar no dashboard do Supabase (SQL Editor).
  
  -- Vou inserir o perfil e o cargo para quando ele se cadastrar/logar
  -- Mas o ideal é que ele use a função de "Criar Usuário" se já houvesse um admin.
  -- Como é o PRIMEIRO, vou criar um registro manual se possível, ou dar as instruções.
  
  -- Na verdade, vou criar um registro na tabela profiles e user_roles usando um ID que ele possa vincular.
  -- Melhor: Vou sugerir que o usuário utilize a tela de cadastro se estiver disponível,
  -- OU eu posso tentar inserir diretamente no auth.users se o ambiente permitir extensões.
END $$;