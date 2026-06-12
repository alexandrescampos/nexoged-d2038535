
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS theme_palette text DEFAULT 'corporate-blue',
  ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'light';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_palette text,
  ADD COLUMN IF NOT EXISTS theme_mode text;
