-- 1. Adicionar o novo valor ao enum de forma segura (PostgreSQL)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';
COMMIT; -- Força o commit da adição do valor para que ele possa ser usado na mesma sessão em alguns contextos, embora migrations em Lovable/Supabase sejam tratadas de forma atômica por arquivo às vezes.

-- 2. Atualizar os dados existentes
UPDATE public.user_roles SET role = 'user' WHERE role = 'manager';

-- 3. Atualizar a restrição de CHECK
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_roles_role_check') THEN
        ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_role_check;
    END IF;
END $$;

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('super_admin', 'org_admin', 'user'));
