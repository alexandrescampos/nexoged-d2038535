-- Adicionar coluna de níveis de sigilo permitidos à tabela perfil
ALTER TABLE public.perfil ADD COLUMN IF NOT EXISTS niveis_sigilo_permitidos TEXT[] DEFAULT ARRAY['PUBLICO', 'INTERNO']::TEXT[];

-- Atualizar perfis existentes para terem o padrão inicial
UPDATE public.perfil SET niveis_sigilo_permitidos = ARRAY['PUBLICO', 'INTERNO']::TEXT[] WHERE niveis_sigilo_permitidos IS NULL;

-- Garantir privilégios
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil TO authenticated;
GRANT ALL ON public.perfil TO service_role;
