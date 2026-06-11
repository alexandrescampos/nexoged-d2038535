UPDATE public.system_settings
SET value = (
  SELECT jsonb_agg(DISTINCT v)::text
  FROM (
    SELECT jsonb_array_elements_text(value::jsonb) AS v
    FROM public.system_settings WHERE key = 'ocr_allowed_mime_types'
    UNION ALL
    SELECT unnest(ARRAY['application/xml','text/xml'])
  ) t
)
WHERE key = 'ocr_allowed_mime_types';

INSERT INTO public.system_settings (key, value)
SELECT 'ocr_allowed_mime_types', '["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-excel","text/csv","text/plain","application/xml","text/xml","image/png","image/jpeg","image/webp","image/gif","image/bmp","image/tiff","image/heic"]'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'ocr_allowed_mime_types');