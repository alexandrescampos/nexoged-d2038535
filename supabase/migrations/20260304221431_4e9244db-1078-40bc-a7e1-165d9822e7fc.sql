
-- 1. Limpar registros órfãos
DELETE FROM user_roles WHERE role IN ('analyst', 'client');

-- 2. Dropar TODAS as policies que referenciam app_role

-- user_roles
DROP POLICY IF EXISTS "OrgAdmins podem gerenciar roles da sua organização (exceto su" ON user_roles;
DROP POLICY IF EXISTS "OrgAdmins podem ver roles da sua organização" ON user_roles;
DROP POLICY IF EXISTS "SuperAdmins podem gerenciar roles" ON user_roles;
DROP POLICY IF EXISTS "SuperAdmins podem ver todas as roles" ON user_roles;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias roles" ON user_roles;

-- profiles
DROP POLICY IF EXISTS "Usuários autorizados podem ver perfis da organização" ON profiles;
DROP POLICY IF EXISTS "SuperAdmins podem atualizar perfis" ON profiles;
DROP POLICY IF EXISTS "SuperAdmins podem inserir perfis" ON profiles;
DROP POLICY IF EXISTS "SuperAdmins podem ver todos os perfis" ON profiles;

-- organizations
DROP POLICY IF EXISTS "OrgAdmins podem atualizar sua própria organização" ON organizations;
DROP POLICY IF EXISTS "SuperAdmins podem atualizar organizações" ON organizations;
DROP POLICY IF EXISTS "SuperAdmins podem criar organizações" ON organizations;
DROP POLICY IF EXISTS "SuperAdmins podem ver todas as organizações" ON organizations;

-- subscription_cancellations
DROP POLICY IF EXISTS "OrgAdmins podem registrar cancelamentos" ON subscription_cancellations;
DROP POLICY IF EXISTS "OrgAdmins podem ver cancelamentos da organização" ON subscription_cancellations;
DROP POLICY IF EXISTS "SuperAdmins podem ver todos cancelamentos" ON subscription_cancellations;

-- stripe_config
DROP POLICY IF EXISTS "OrgAdmins podem ver sua própria configuração Stripe" ON stripe_config;
DROP POLICY IF EXISTS "SuperAdmins podem gerenciar stripe_config" ON stripe_config;

-- plans
DROP POLICY IF EXISTS "SuperAdmins podem gerenciar planos" ON plans;

-- system_settings
DROP POLICY IF EXISTS "SuperAdmins podem gerenciar system_settings" ON system_settings;

-- epi_categories
DROP POLICY IF EXISTS "SuperAdmins podem gerenciar epi_categories" ON epi_categories;
DROP POLICY IF EXISTS "OrgAdmins podem criar categorias" ON epi_categories;
DROP POLICY IF EXISTS "OrgAdmins podem atualizar categorias" ON epi_categories;
DROP POLICY IF EXISTS "OrgAdmins podem deletar categorias" ON epi_categories;

-- epis
DROP POLICY IF EXISTS "SuperAdmins podem gerenciar epis" ON epis;
DROP POLICY IF EXISTS "OrgAdmins podem criar EPIs" ON epis;
DROP POLICY IF EXISTS "OrgAdmins podem atualizar EPIs" ON epis;
DROP POLICY IF EXISTS "OrgAdmins podem deletar EPIs" ON epis;

-- epi_deliveries
DROP POLICY IF EXISTS "SuperAdmins podem gerenciar epi_deliveries" ON epi_deliveries;
DROP POLICY IF EXISTS "OrgAdmins podem criar entregas" ON epi_deliveries;
DROP POLICY IF EXISTS "Managers podem criar entregas" ON epi_deliveries;
DROP POLICY IF EXISTS "OrgAdmins podem atualizar entregas" ON epi_deliveries;
DROP POLICY IF EXISTS "Managers podem atualizar entregas" ON epi_deliveries;
DROP POLICY IF EXISTS "OrgAdmins podem deletar entregas" ON epi_deliveries;

-- sectors
DROP POLICY IF EXISTS "SuperAdmins podem gerenciar sectors" ON sectors;
DROP POLICY IF EXISTS "OrgAdmins podem criar setores" ON sectors;
DROP POLICY IF EXISTS "OrgAdmins podem atualizar setores" ON sectors;
DROP POLICY IF EXISTS "Managers podem criar setores" ON sectors;
DROP POLICY IF EXISTS "Managers podem atualizar setores" ON sectors;
DROP POLICY IF EXISTS "OrgAdmins podem deletar setores" ON sectors;

-- job_functions
DROP POLICY IF EXISTS "SuperAdmins podem gerenciar job_functions" ON job_functions;
DROP POLICY IF EXISTS "OrgAdmins podem criar funções" ON job_functions;
DROP POLICY IF EXISTS "OrgAdmins podem atualizar funções" ON job_functions;
DROP POLICY IF EXISTS "Managers podem criar funções" ON job_functions;
DROP POLICY IF EXISTS "Managers podem atualizar funções" ON job_functions;
DROP POLICY IF EXISTS "OrgAdmins podem deletar funções" ON job_functions;

-- employees
DROP POLICY IF EXISTS "SuperAdmins podem gerenciar employees" ON employees;
DROP POLICY IF EXISTS "OrgAdmins podem criar funcionários" ON employees;
DROP POLICY IF EXISTS "OrgAdmins podem atualizar funcionários" ON employees;
DROP POLICY IF EXISTS "Managers podem criar funcionários" ON employees;
DROP POLICY IF EXISTS "Managers podem atualizar funcionários" ON employees;
DROP POLICY IF EXISTS "OrgAdmins podem deletar funcionários" ON employees;

-- storage.objects
DROP POLICY IF EXISTS "OrgAdmins podem atualizar logo" ON storage.objects;
DROP POLICY IF EXISTS "OrgAdmins podem deletar logo" ON storage.objects;
DROP POLICY IF EXISTS "OrgAdmins podem fazer upload de logo" ON storage.objects;
DROP POLICY IF EXISTS "SuperAdmins podem atualizar em system-assets" ON storage.objects;
DROP POLICY IF EXISTS "SuperAdmins podem fazer upload em system-assets" ON storage.objects;

-- 3. Dropar funções que usam app_role
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.has_role_in_org(uuid, app_role, uuid);

-- 4. Recriar enum
ALTER TYPE app_role RENAME TO app_role_old;
CREATE TYPE app_role AS ENUM ('super_admin', 'org_admin', 'manager');

ALTER TABLE user_roles 
  ALTER COLUMN role TYPE app_role USING role::text::app_role;

DROP TYPE app_role_old;

-- 5. Recriar funções
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_org(_user_id uuid, _role app_role, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role AND organization_id = _org_id
  )
$$;

-- 6. Recriar TODAS as policies

-- user_roles
CREATE POLICY "OrgAdmins podem gerenciar roles da sua organização (exceto su"
ON user_roles FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role) AND role <> 'super_admin'::app_role);

CREATE POLICY "OrgAdmins podem ver roles da sua organização"
ON user_roles FOR SELECT TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "SuperAdmins podem gerenciar roles"
ON user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "SuperAdmins podem ver todas as roles"
ON user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Usuários podem ver suas próprias roles"
ON user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- profiles
CREATE POLICY "Usuários autorizados podem ver perfis da organização"
ON profiles FOR SELECT TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND (has_role(auth.uid(), 'org_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "SuperAdmins podem atualizar perfis"
ON profiles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "SuperAdmins podem inserir perfis"
ON profiles FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "SuperAdmins podem ver todos os perfis"
ON profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- organizations
CREATE POLICY "OrgAdmins podem atualizar sua própria organização"
ON organizations FOR UPDATE TO authenticated
USING (id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role))
WITH CHECK (id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "SuperAdmins podem atualizar organizações"
ON organizations FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "SuperAdmins podem criar organizações"
ON organizations FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "SuperAdmins podem ver todas as organizações"
ON organizations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- subscription_cancellations
CREATE POLICY "OrgAdmins podem registrar cancelamentos"
ON subscription_cancellations FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem ver cancelamentos da organização"
ON subscription_cancellations FOR SELECT TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "SuperAdmins podem ver todos cancelamentos"
ON subscription_cancellations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- stripe_config
CREATE POLICY "OrgAdmins podem ver sua própria configuração Stripe"
ON stripe_config FOR SELECT TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "SuperAdmins podem gerenciar stripe_config"
ON stripe_config FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- plans
CREATE POLICY "SuperAdmins podem gerenciar planos"
ON plans FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- system_settings
CREATE POLICY "SuperAdmins podem gerenciar system_settings"
ON system_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- epi_categories
CREATE POLICY "SuperAdmins podem gerenciar epi_categories"
ON epi_categories FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "OrgAdmins podem criar categorias"
ON epi_categories FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar categorias"
ON epi_categories FOR UPDATE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem deletar categorias"
ON epi_categories FOR DELETE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- epis
CREATE POLICY "SuperAdmins podem gerenciar epis"
ON epis FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "OrgAdmins podem criar EPIs"
ON epis FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar EPIs"
ON epis FOR UPDATE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem deletar EPIs"
ON epis FOR DELETE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- epi_deliveries
CREATE POLICY "SuperAdmins podem gerenciar epi_deliveries"
ON epi_deliveries FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "OrgAdmins podem criar entregas"
ON epi_deliveries FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem criar entregas"
ON epi_deliveries FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "OrgAdmins podem atualizar entregas"
ON epi_deliveries FOR UPDATE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem atualizar entregas"
ON epi_deliveries FOR UPDATE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "OrgAdmins podem deletar entregas"
ON epi_deliveries FOR DELETE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- sectors
CREATE POLICY "SuperAdmins podem gerenciar sectors"
ON sectors FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "OrgAdmins podem criar setores"
ON sectors FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar setores"
ON sectors FOR UPDATE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem criar setores"
ON sectors FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers podem atualizar setores"
ON sectors FOR UPDATE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "OrgAdmins podem deletar setores"
ON sectors FOR DELETE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- job_functions
CREATE POLICY "SuperAdmins podem gerenciar job_functions"
ON job_functions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "OrgAdmins podem criar funções"
ON job_functions FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar funções"
ON job_functions FOR UPDATE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem criar funções"
ON job_functions FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers podem atualizar funções"
ON job_functions FOR UPDATE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "OrgAdmins podem deletar funções"
ON job_functions FOR DELETE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- employees
CREATE POLICY "SuperAdmins podem gerenciar employees"
ON employees FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "OrgAdmins podem criar funcionários"
ON employees FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar funcionários"
ON employees FOR UPDATE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem criar funcionários"
ON employees FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers podem atualizar funcionários"
ON employees FOR UPDATE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "OrgAdmins podem deletar funcionários"
ON employees FOR DELETE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- storage.objects
CREATE POLICY "OrgAdmins podem atualizar logo"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'organization-logos' AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem deletar logo"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'organization-logos' AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem fazer upload de logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'organization-logos' AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "SuperAdmins podem atualizar em system-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'system-assets' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "SuperAdmins podem fazer upload em system-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'system-assets' AND has_role(auth.uid(), 'super_admin'::app_role));
