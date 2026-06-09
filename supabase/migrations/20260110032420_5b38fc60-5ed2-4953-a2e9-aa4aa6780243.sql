-- Permitir que todos (inclusive não autenticados) leiam system_settings
CREATE POLICY "Público pode ler system_settings"
  ON public.system_settings FOR SELECT
  USING (true);

-- Remover a política antiga mais restritiva
DROP POLICY IF EXISTS "Usuários autenticados podem ler system_settings" 
  ON public.system_settings;