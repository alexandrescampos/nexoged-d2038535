ALTER TABLE public.epi_requests
ADD COLUMN IF NOT EXISTS stock_source text NOT NULL DEFAULT 'new'
CHECK (stock_source IN ('new','used'));