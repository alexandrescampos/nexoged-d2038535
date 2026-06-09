-- Add column to indicate if plan is managed by super admin
ALTER TABLE public.organizations 
ADD COLUMN is_plan_managed BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.organizations.is_plan_managed IS 
  'Indica se o plano foi atribuído manualmente pelo Super Admin';