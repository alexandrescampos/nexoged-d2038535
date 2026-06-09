
ALTER TABLE public.job_functions ADD COLUMN IF NOT EXISTS code TEXT;

WITH numbered AS (
  SELECT id,
         organization_id,
         row_number() OVER (PARTITION BY organization_id ORDER BY created_at, id) AS rn
  FROM public.job_functions
  WHERE code IS NULL
)
UPDATE public.job_functions jf
SET code = 'FUN-' || lpad(numbered.rn::text, 4, '0')
FROM numbered
WHERE jf.id = numbered.id;

CREATE UNIQUE INDEX IF NOT EXISTS job_functions_org_code_uniq
  ON public.job_functions(organization_id, code);

ALTER TABLE public.job_functions ALTER COLUMN code SET NOT NULL;
