-- Criar tabela system_settings para configurações do sistema
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Super Admins podem gerenciar todas as configurações
CREATE POLICY "SuperAdmins podem gerenciar system_settings"
  ON public.system_settings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Todos os usuários autenticados podem ler configurações do sistema
CREATE POLICY "Usuários autenticados podem ler system_settings"
  ON public.system_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Trigger para atualizar updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar bucket de storage para assets do sistema
INSERT INTO storage.buckets (id, name, public)
VALUES ('system-assets', 'system-assets', true);

-- Super Admins podem fazer upload em system-assets
CREATE POLICY "SuperAdmins podem fazer upload em system-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'system-assets' AND 
    has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Super Admins podem atualizar em system-assets
CREATE POLICY "SuperAdmins podem atualizar em system-assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'system-assets' AND 
    has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Qualquer um pode ver system-assets (bucket público)
CREATE POLICY "Qualquer um pode ver system-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'system-assets');