-- Update plans table
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_pages INTEGER DEFAULT 1000;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_storage_gb INTEGER DEFAULT 10;

-- Update organizations table
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS contracted_pages INTEGER DEFAULT 1000;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS contracted_storage_gb INTEGER DEFAULT 10;

-- Update ged_documents table
ALTER TABLE public.ged_documents ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1;

-- Create a view for organization usage
CREATE OR REPLACE VIEW public.organization_usage AS
SELECT 
    o.id AS organization_id,
    o.name AS organization_name,
    o.contracted_pages,
    o.contracted_storage_gb,
    COALESCE(SUM(d.page_count), 0) AS used_pages,
    COALESCE(SUM(v.file_size), 0) AS used_storage_bytes,
    ROUND(COALESCE(SUM(v.file_size), 0) / (1024.0 * 1024.0 * 1024.0), 2) AS used_storage_gb
FROM 
    public.organizations o
LEFT JOIN 
    public.ged_documents d ON d.organization_id = o.id AND d.deleted_at IS NULL
LEFT JOIN 
    public.ged_document_versions v ON v.document_id = d.id
GROUP BY 
    o.id, o.name, o.contracted_pages, o.contracted_storage_gb;

-- Grant permissions for the new view
GRANT SELECT ON public.organization_usage TO authenticated;
GRANT SELECT ON public.organization_usage TO service_role;

-- Seed some default plans if table is empty
INSERT INTO public.plans (name, slug, description, price_monthly, max_pages, max_storage_gb, is_active, display_order)
VALUES 
('Básico', 'basico', 'Ideal para pequenas empresas', 9900, 5000, 10, true, 1),
('Profissional', 'profissional', 'Para empresas em crescimento', 19900, 20000, 50, true, 2),
('Enterprise', 'enterprise', 'Solução completa para grandes volumes', 49900, 100000, 250, true, 3)
ON CONFLICT (slug) DO UPDATE 
SET max_pages = EXCLUDED.max_pages, 
    max_storage_gb = EXCLUDED.max_storage_gb;
