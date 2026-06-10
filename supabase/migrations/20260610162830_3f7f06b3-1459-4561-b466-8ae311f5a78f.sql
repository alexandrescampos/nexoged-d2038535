-- Indices for sorting on core tables
CREATE INDEX IF NOT EXISTS idx_departments_name_sort ON public.departments (dept_nm_departamento);
CREATE INDEX IF NOT EXISTS idx_departments_code_sort ON public.departments (dept_cd_departamento);
CREATE INDEX IF NOT EXISTS idx_sectors_name_sort ON public.sectors (set_nm_setor);
CREATE INDEX IF NOT EXISTS idx_folders_name_sort ON public.folders (past_nm_pasta);
CREATE INDEX IF NOT EXISTS idx_documents_title_sort ON public.ged_documents (title);
CREATE INDEX IF NOT EXISTS idx_documents_created_at_sort ON public.ged_documents (created_at);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at_sort ON public.ged_documents (updated_at);
