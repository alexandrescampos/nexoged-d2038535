-- Add new columns to time_entries for enhanced timesheet functionality
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS justification TEXT,
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN public.time_entries.justification IS 'Justificativa obrigatória para o lançamento';
COMMENT ON COLUMN public.time_entries.start_time IS 'Hora de início do trabalho';
COMMENT ON COLUMN public.time_entries.end_time IS 'Hora de término do trabalho';
COMMENT ON COLUMN public.time_entries.is_billable IS 'Indica se as horas são faturáveis';