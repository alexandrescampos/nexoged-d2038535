-- Adicionar colunas extras ao log de auditoria para maior detalhamento
ALTER TABLE public.user_audit_log 
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS method TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Criar índice para performance em buscas por data
CREATE INDEX IF NOT EXISTS idx_user_audit_log_created_at ON public.user_audit_log(created_at DESC);

-- Atualizar a função de gatilho para capturar o método inicial no self-signup (legado ou se reativado)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );

  INSERT INTO public.user_audit_log (target_user_id, performed_by, action, source, details, method)
  VALUES (
    NEW.id,
    NEW.id,
    'created',
    'self-signup',
    jsonb_build_object('email', NEW.email, 'full_name', COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)),
    'auth_signup'
  );

  RETURN NEW;
END;
$function$;