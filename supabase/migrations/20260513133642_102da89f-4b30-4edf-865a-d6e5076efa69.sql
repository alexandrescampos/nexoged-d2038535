ALTER TABLE public.epi_deliveries
  ADD COLUMN IF NOT EXISTS signed_term_id uuid
  REFERENCES public.epi_signed_terms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_epi_deliveries_signed_term_id
  ON public.epi_deliveries(signed_term_id);

-- Backfill: associar entregas existentes ao termo correspondente
UPDATE public.epi_deliveries d
SET signed_term_id = t.id
FROM public.epi_signed_terms t
WHERE d.signed_term_id IS NULL
  AND d.organization_id = t.organization_id
  AND d.employee_record_id = t.employee_record_id
  AND d.delivery_date = t.delivery_date;