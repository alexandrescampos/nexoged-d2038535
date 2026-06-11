
-- Add whitelist setting for OCR mime types
INSERT INTO public.system_settings (key, value)
VALUES ('ocr_allowed_mime_types', '["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","image/png","image/jpeg","image/webp","image/gif","image/bmp","image/tiff"]')
ON CONFLICT (key) DO NOTHING;

-- Allow authenticated users to read this setting (needed for client-side upload validation)
DROP POLICY IF EXISTS "Authenticated can read public-safe system_settings" ON public.system_settings;
CREATE POLICY "Authenticated can read public-safe system_settings" ON public.system_settings
  FOR SELECT TO authenticated
  USING (key = ANY (ARRAY['system_logo','system_name','system_version','support_phone','terms_of_service','privacy_policy','terms_version','ocr_allowed_mime_types']));
