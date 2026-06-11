-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create normalization function
CREATE OR REPLACE FUNCTION public.normalize_text(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
    normalized TEXT;
BEGIN
    IF input_text IS NULL THEN
        RETURN NULL;
    END IF;

    -- 1. Lowercase and Unaccent
    normalized := unaccent(lower(input_text));

    -- 2. Remove control characters, tabs, newlines (replace with space)
    normalized := regexp_replace(normalized, '[\x00-\x1F\x7F-\x9F]', ' ', 'g');
    normalized := regexp_replace(normalized, '[\t\r\n]', ' ', 'g');

    -- 3. Remove non-alphanumeric (keeping spaces)
    normalized := regexp_replace(normalized, '[^a-z0-9 ]', ' ', 'g');

    -- 4. Collapse multiple spaces
    normalized := regexp_replace(normalized, '\s+', ' ', 'g');

    RETURN trim(normalized);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update table documento_ocr
ALTER TABLE public.documento_ocr 
ADD COLUMN IF NOT EXISTS texto_original TEXT,
ADD COLUMN IF NOT EXISTS texto_normalizado TEXT;

-- Update table documento_ocr_pagina
ALTER TABLE public.documento_ocr_pagina 
ADD COLUMN IF NOT EXISTS texto_original TEXT,
ADD COLUMN IF NOT EXISTS texto_normalizado TEXT;

-- Create GIN index for texto_normalizado using tsvector
-- We'll use a trigger to keep texto_tsv updated based on texto_normalizado
CREATE OR REPLACE FUNCTION public.update_documento_ocr_pagina_tsv()
RETURNS TRIGGER AS $$
BEGIN
    NEW.texto_tsv := to_tsvector('portuguese', coalesce(NEW.texto_normalizado, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_ocr_pagina_tsv ON public.documento_ocr_pagina;
CREATE TRIGGER trg_update_ocr_pagina_tsv
BEFORE INSERT OR UPDATE OF texto_normalizado ON public.documento_ocr_pagina
FOR EACH ROW EXECUTE FUNCTION public.update_documento_ocr_pagina_tsv();

-- Create a GIN index if it doesn't exist (assuming it's on texto_tsv)
CREATE INDEX IF NOT EXISTS idx_documento_ocr_pagina_tsv ON public.documento_ocr_pagina USING GIN (texto_tsv);

-- Create a custom text search configuration that uses unaccent for highlighting
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'ged_config') THEN
    CREATE TEXT SEARCH CONFIGURATION public.ged_config (COPY = portuguese);
    ALTER TEXT SEARCH CONFIGURATION public.ged_config
      ALTER MAPPING FOR hword, hword_part, word
      WITH unaccent, portuguese_stem;
  END IF;
END $$;

-- Update search_documents_fts RPC
CREATE OR REPLACE FUNCTION public.search_documents_fts(
  p_query TEXT,
  p_filters JSONB DEFAULT '{}'::JSONB,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  documento_id UUID,
  versao_id UUID,
  documento_nome TEXT,
  tipo_documento_id UUID,
  classificacao TEXT,
  folder_id UUID,
  numero_pagina INTEGER,
  trecho TEXT,
  rank REAL,
  created_at TIMESTAMPTZ,
  total_count BIGINT
) AS $$
DECLARE
  v_tsquery tsquery;
  v_folder_id UUID := NULLIF(p_filters->>'folder_id','')::UUID;
  v_tipo UUID := NULLIF(p_filters->>'tipo_documento_id','')::UUID;
  v_sigilo TEXT := NULLIF(p_filters->>'classificacao','');
  v_status TEXT := NULLIF(p_filters->>'status','');
  v_date_from TIMESTAMPTZ := NULLIF(p_filters->>'date_from','')::TIMESTAMPTZ;
  v_date_to TIMESTAMPTZ := NULLIF(p_filters->>'date_to','')::TIMESTAMPTZ;
  v_normalized_query TEXT;
BEGIN
  -- Normalize query text
  v_normalized_query := public.normalize_text(p_query);

  IF v_normalized_query IS NULL OR length(trim(v_normalized_query)) = 0 THEN
    v_tsquery := NULL;
  ELSE
    -- Use ged_config for query parsing to ensure unaccent is applied
    BEGIN 
      v_tsquery := websearch_to_tsquery('public.ged_config', v_normalized_query);
    EXCEPTION WHEN OTHERS THEN 
      v_tsquery := plainto_tsquery('public.ged_config', v_normalized_query); 
    END;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT 
      d.id AS documento_id, 
      p.ocr_id, 
      p.numero_pagina, 
      p.texto_original,
      p.texto_normalizado,
      d.title AS documento_nome, 
      d.document_type_id AS tipo_documento_id,
      d.sigilo::TEXT AS classificacao, 
      d.folder_id, 
      d.created_at,
      CASE WHEN v_tsquery IS NULL THEN 0.0 ELSE ts_rank_cd(p.texto_tsv, v_tsquery) END AS rank
    FROM public.documento_ocr_pagina p
    JOIN public.ged_documents d ON d.id = p.documento_id
    WHERE (v_tsquery IS NULL OR p.texto_tsv @@ v_tsquery)
      AND (v_folder_id IS NULL OR d.folder_id = v_folder_id)
      AND (v_tipo IS NULL OR d.document_type_id = v_tipo)
      AND (v_sigilo IS NULL OR d.sigilo::TEXT = v_sigilo)
      AND (v_status IS NULL OR d.status = v_status)
      AND (v_date_from IS NULL OR d.created_at >= v_date_from)
      AND (v_date_to IS NULL OR d.created_at <= v_date_to)
  ),
  ranked AS (SELECT *, count(*) OVER () AS total_count FROM base)
  SELECT 
    r.documento_id, 
    NULL::UUID, 
    r.documento_nome, 
    r.tipo_documento_id,
    r.classificacao, 
    r.folder_id, 
    r.numero_pagina,
    CASE 
      WHEN v_tsquery IS NULL THEN left(coalesce(r.texto_original, r.texto_normalizado, ''), 240)
      ELSE ts_headline('public.ged_config', coalesce(r.texto_original, r.texto_normalizado, ''), v_tsquery,
           'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=2, FragmentDelimiter=" ... "') 
    END,
    r.rank, 
    r.created_at, 
    r.total_count
  FROM ranked r 
  ORDER BY r.rank DESC, r.created_at DESC 
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (standard requirement)
GRANT SELECT ON public.documento_ocr TO authenticated;
GRANT SELECT ON public.documento_ocr_pagina TO authenticated;
GRANT ALL ON public.documento_ocr TO service_role;
GRANT ALL ON public.documento_ocr_pagina TO service_role;
