-- Função para disparar o processamento da fila de OCR
CREATE OR REPLACE FUNCTION public.trigger_ocr_queue()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_ref TEXT := 'qxziabldmmhlugyvssyi';
  v_service_key TEXT := 'sb_secret_wIEP3uOKCL6BQvOUOFVZnQ_j8LqgpfF';
BEGIN
  PERFORM net.http_post(
    url := 'https://' || v_project_ref || '.supabase.co/functions/v1/process-document-ocr',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := '{"processQueue": true}'::jsonb
  );
END;
$$;

-- Agendamento do cron job (remove se já existir para evitar erro)
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'process-ocr-every-minute';
SELECT cron.schedule('process-ocr-every-minute', '* * * * *', 'SELECT public.trigger_ocr_queue()');