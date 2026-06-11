CREATE OR REPLACE FUNCTION public.search_documents_fts(
  p_query TEXT, p_filters JSONB DEFAULT '{}'::jsonb, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  documento_id UUID, versao_id UUID, documento_nome TEXT, tipo_documento_id UUID,
  classificacao TEXT, folder_id UUID, numero_pagina INTEGER, trecho TEXT, rank REAL,
  created_at TIMESTAMPTZ, total_count BIGINT
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_tsquery tsquery;
  v_folder_id UUID := NULLIF(p_filters->>'folder_id','')::UUID;
  v_tipo UUID := NULLIF(p_filters->>'tipo_documento_id','')::UUID;
  v_sigilo TEXT := NULLIF(p_filters->>'classificacao','');
  v_status TEXT := NULLIF(p_filters->>'status','');
  v_date_from TIMESTAMPTZ := NULLIF(p_filters->>'date_from','')::TIMESTAMPTZ;
  v_date_to TIMESTAMPTZ := NULLIF(p_filters->>'date_to','')::TIMESTAMPTZ;
BEGIN
  IF p_query IS NULL OR length(trim(p_query)) = 0 THEN
    v_tsquery := NULL;
  ELSE
    BEGIN v_tsquery := websearch_to_tsquery('portuguese', p_query);
    EXCEPTION WHEN OTHERS THEN v_tsquery := plainto_tsquery('portuguese', p_query); END;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT d.id AS documento_id, p.ocr_id, p.numero_pagina, p.texto_pagina,
      d.title AS documento_nome, d.document_type_id AS tipo_documento_id,
      d.sigilo::TEXT AS classificacao, d.folder_id, d.created_at,
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
  SELECT r.documento_id, NULL::UUID, r.documento_nome, r.tipo_documento_id,
    r.classificacao, r.folder_id, r.numero_pagina,
    CASE WHEN v_tsquery IS NULL THEN left(coalesce(r.texto_pagina,''), 240)
         ELSE ts_headline('portuguese', coalesce(r.texto_pagina,''), v_tsquery,
              'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=2, FragmentDelimiter=" ... "') END,
    r.rank, r.created_at, r.total_count
  FROM ranked r ORDER BY r.rank DESC, r.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;