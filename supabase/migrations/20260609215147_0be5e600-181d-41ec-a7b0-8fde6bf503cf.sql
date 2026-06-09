ALTER TABLE public.employee_documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
COMMENT ON COLUMN public.employee_documents.file_size IS 'Tamanho do arquivo em bytes';
