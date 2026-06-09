CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'super_admin',
    'org_admin',
    'analyst',
    'client'
);


--
-- Name: org_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.org_status AS ENUM (
    'active',
    'suspended',
    'trial'
);


--
-- Name: can_org_add_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_org_add_user(_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    -- If org doesn't exist, return false
    WHEN NOT EXISTS (SELECT 1 FROM organizations WHERE id = _org_id) THEN false
    -- If max_users is null or >= 999999, it's unlimited
    WHEN (SELECT max_users FROM organizations WHERE id = _org_id) IS NULL THEN true
    WHEN (SELECT max_users FROM organizations WHERE id = _org_id) >= 999999 THEN true
    -- Otherwise, check if current count is below max
    ELSE (
      SELECT COUNT(*)::int < COALESCE((SELECT max_users FROM organizations WHERE id = _org_id), 10)
      FROM profiles
      WHERE organization_id = _org_id AND is_active = true
    )
  END
$$;


--
-- Name: get_org_max_users(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_org_max_users(_org_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(max_users, 999999)
  FROM organizations
  WHERE id = _org_id
$$;


--
-- Name: get_org_user_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_org_user_count(_org_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(*)::int
  FROM profiles
  WHERE organization_id = _org_id AND is_active = true
$$;


--
-- Name: get_super_admin_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_super_admin_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT user_id FROM user_roles WHERE role = 'super_admin'
$$;


--
-- Name: get_user_org_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_org_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = _user_id
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: has_role_in_org(uuid, public.app_role, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role_in_org(_user_id uuid, _role public.app_role, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND organization_id = _org_id
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    document text,
    email text,
    phone text,
    address text,
    is_active boolean DEFAULT true,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    status public.org_status DEFAULT 'active'::public.org_status NOT NULL,
    plan text DEFAULT 'basic'::text,
    max_users integer DEFAULT 10,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    logo_url text,
    cnpj text,
    email text,
    phone text,
    address text,
    address_number text,
    address_complement text,
    neighborhood text,
    city text,
    state text,
    zip_code text
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    price_monthly integer,
    price_yearly integer,
    max_users integer,
    features jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    is_highlighted boolean DEFAULT false,
    stripe_price_id_monthly text,
    stripe_price_id_yearly text,
    stripe_product_id text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    organization_id uuid,
    full_name text,
    email text,
    avatar_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    must_reset_password boolean DEFAULT false
);


--
-- Name: stripe_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    pause_collection_behavior text,
    pause_collection_resumes_at timestamp with time zone
);


--
-- Name: subscription_cancellations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_cancellations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reason text NOT NULL,
    feedback text,
    plan_name text,
    subscription_id text,
    canceled_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_cnpj_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_cnpj_unique UNIQUE (cnpj);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: plans plans_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: stripe_config stripe_config_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_config
    ADD CONSTRAINT stripe_config_organization_id_key UNIQUE (organization_id);


--
-- Name: stripe_config stripe_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_config
    ADD CONSTRAINT stripe_config_pkey PRIMARY KEY (id);


--
-- Name: subscription_cancellations subscription_cancellations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_cancellations
    ADD CONSTRAINT subscription_cancellations_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_organization_id_key UNIQUE (user_id, role, organization_id);


--
-- Name: idx_clients_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_organization_id ON public.clients USING btree (organization_id);


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: plans update_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stripe_config update_stripe_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stripe_config_updated_at BEFORE UPDATE ON public.stripe_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clients clients_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: stripe_config stripe_config_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_config
    ADD CONSTRAINT stripe_config_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: subscription_cancellations subscription_cancellations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_cancellations
    ADD CONSTRAINT subscription_cancellations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clients OrgAdmins e Analistas podem ver clientes da organização; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OrgAdmins e Analistas podem ver clientes da organização" ON public.clients FOR SELECT USING (((organization_id = public.get_user_org_id(auth.uid())) AND (public.has_role(auth.uid(), 'org_admin'::public.app_role) OR public.has_role(auth.uid(), 'analyst'::public.app_role))));


--
-- Name: clients OrgAdmins podem atualizar clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OrgAdmins podem atualizar clientes" ON public.clients FOR UPDATE USING (((organization_id = public.get_user_org_id(auth.uid())) AND public.has_role(auth.uid(), 'org_admin'::public.app_role)));


--
-- Name: organizations OrgAdmins podem atualizar sua própria organização; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OrgAdmins podem atualizar sua própria organização" ON public.organizations FOR UPDATE USING (((id = public.get_user_org_id(auth.uid())) AND public.has_role(auth.uid(), 'org_admin'::public.app_role))) WITH CHECK (((id = public.get_user_org_id(auth.uid())) AND public.has_role(auth.uid(), 'org_admin'::public.app_role)));


--
-- Name: clients OrgAdmins podem criar clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OrgAdmins podem criar clientes" ON public.clients FOR INSERT WITH CHECK (((organization_id = public.get_user_org_id(auth.uid())) AND public.has_role(auth.uid(), 'org_admin'::public.app_role)));


--
-- Name: clients OrgAdmins podem deletar clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OrgAdmins podem deletar clientes" ON public.clients FOR DELETE USING (((organization_id = public.get_user_org_id(auth.uid())) AND public.has_role(auth.uid(), 'org_admin'::public.app_role)));


--
-- Name: user_roles OrgAdmins podem gerenciar roles da sua organização (exceto su; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OrgAdmins podem gerenciar roles da sua organização (exceto su" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (((organization_id = public.get_user_org_id(auth.uid())) AND public.has_role(auth.uid(), 'org_admin'::public.app_role) AND (role <> 'super_admin'::public.app_role)));


--
-- Name: subscription_cancellations OrgAdmins podem registrar cancelamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OrgAdmins podem registrar cancelamentos" ON public.subscription_cancellations FOR INSERT WITH CHECK (((organization_id = public.get_user_org_id(auth.uid())) AND public.has_role(auth.uid(), 'org_admin'::public.app_role)));


--
-- Name: subscription_cancellations OrgAdmins podem ver cancelamentos da organização; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OrgAdmins podem ver cancelamentos da organização" ON public.subscription_cancellations FOR SELECT USING (((organization_id = public.get_user_org_id(auth.uid())) AND public.has_role(auth.uid(), 'org_admin'::public.app_role)));


--
-- Name: profiles OrgAdmins podem ver perfis da sua organização; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OrgAdmins podem ver perfis da sua organização" ON public.profiles FOR SELECT TO authenticated USING (((organization_id = public.get_user_org_id(auth.uid())) AND (public.has_role(auth.uid(), 'org_admin'::public.app_role) OR public.has_role(auth.uid(), 'analyst'::public.app_role))));


--
-- Name: user_roles OrgAdmins podem ver roles da sua organização; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OrgAdmins podem ver roles da sua organização" ON public.user_roles FOR SELECT TO authenticated USING (((organization_id = public.get_user_org_id(auth.uid())) AND public.has_role(auth.uid(), 'org_admin'::public.app_role)));


--
-- Name: stripe_config OrgAdmins podem ver sua própria configuração Stripe; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OrgAdmins podem ver sua própria configuração Stripe" ON public.stripe_config FOR SELECT USING (((organization_id = public.get_user_org_id(auth.uid())) AND public.has_role(auth.uid(), 'org_admin'::public.app_role)));


--
-- Name: profiles Permitir inserção do próprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir inserção do próprio perfil" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: organizations SuperAdmins podem atualizar organizações; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SuperAdmins podem atualizar organizações" ON public.organizations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: profiles SuperAdmins podem atualizar perfis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SuperAdmins podem atualizar perfis" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: organizations SuperAdmins podem criar organizações; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SuperAdmins podem criar organizações" ON public.organizations FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: plans SuperAdmins podem gerenciar planos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SuperAdmins podem gerenciar planos" ON public.plans USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: user_roles SuperAdmins podem gerenciar roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SuperAdmins podem gerenciar roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: stripe_config SuperAdmins podem gerenciar stripe_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SuperAdmins podem gerenciar stripe_config" ON public.stripe_config USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: clients SuperAdmins podem gerenciar todos os clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SuperAdmins podem gerenciar todos os clientes" ON public.clients USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: profiles SuperAdmins podem inserir perfis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SuperAdmins podem inserir perfis" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: organizations SuperAdmins podem ver todas as organizações; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SuperAdmins podem ver todas as organizações" ON public.organizations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: user_roles SuperAdmins podem ver todas as roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SuperAdmins podem ver todas as roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: subscription_cancellations SuperAdmins podem ver todos cancelamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SuperAdmins podem ver todos cancelamentos" ON public.subscription_cancellations FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: profiles SuperAdmins podem ver todos os perfis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SuperAdmins podem ver todos os perfis" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: plans Usuários autenticados podem ver planos ativos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários autenticados podem ver planos ativos" ON public.plans FOR SELECT USING (((is_active = true) AND (auth.role() = 'authenticated'::text)));


--
-- Name: profiles Usuários podem atualizar seu próprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid()));


--
-- Name: profiles Usuários podem ver seu próprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: organizations Usuários podem ver sua própria organização; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver sua própria organização" ON public.organizations FOR SELECT TO authenticated USING ((id = public.get_user_org_id(auth.uid())));


--
-- Name: user_roles Usuários podem ver suas próprias roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver suas próprias roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_config ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_cancellations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_cancellations ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;