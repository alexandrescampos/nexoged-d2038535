
DO $$ BEGIN
  CREATE TYPE public.ocr_status AS ENUM ('pendente','processando','processado','erro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ocr_audit_action AS ENUM ('ocr_executado','ocr_erro','pesquisa','resultado_aberto','pagina_visualizada','reprocessar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.documento_ocr (
  ocr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES public.ged_documents(id) ON DELETE CASCADE,
  versao_id UUID REFERENCES public.ged_document_versions(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL,
  texto_extraido TEXT,
  texto_tsv tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(texto_extraido,''))) STORED,
  total_paginas INTEGER DEFAULT 0,
  status public.ocr_status NOT NULL DEFAULT 'pendente',
  tentativas INTEGER NOT NULL DEFAULT 0,
  idioma TEXT NOT NULL DEFAULT 'por',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_processamento TIMESTAMPTZ,
  tempo_processamento_ms INTEGER,
  erro_processamento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(documento_id, versao_id)
);
GRANT SELECT ON public.documento_ocr TO authenticated;
GRANT ALL ON public.documento_ocr TO service_role;
ALTER TABLE public.documento_ocr ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_documento_ocr_tsv ON public.documento_ocr USING GIN (texto_tsv);
CREATE INDEX IF NOT EXISTS idx_documento_ocr_doc ON public.documento_ocr (documento_id);
CREATE INDEX IF NOT EXISTS idx_documento_ocr_org ON public.documento_ocr (organization_id);
CREATE INDEX IF NOT EXISTS idx_documento_ocr_status ON public.documento_ocr (status);
CREATE POLICY "OCR visível para quem vê o documento"
ON public.documento_ocr FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ged_documents d WHERE d.id = documento_ocr.documento_id));

CREATE TABLE IF NOT EXISTS public.documento_ocr_pagina (
  ocr_pagina_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_id UUID NOT NULL REFERENCES public.documento_ocr(ocr_id) ON DELETE CASCADE,
  documento_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  numero_pagina INTEGER NOT NULL,
  texto_pagina TEXT,
  texto_tsv tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(texto_pagina,''))) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ocr_id, numero_pagina)
);
GRANT SELECT ON public.documento_ocr_pagina TO authenticated;
GRANT ALL ON public.documento_ocr_pagina TO service_role;
ALTER TABLE public.documento_ocr_pagina ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ocr_pagina_tsv ON public.documento_ocr_pagina USING GIN (texto_tsv);
CREATE INDEX IF NOT EXISTS idx_ocr_pagina_doc ON public.documento_ocr_pagina (documento_id);
CREATE INDEX IF NOT EXISTS idx_ocr_pagina_org ON public.documento_ocr_pagina (organization_id);
CREATE POLICY "Páginas OCR visíveis para quem vê o documento"
ON public.documento_ocr_pagina FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ged_documents d WHERE d.id = documento_ocr_pagina.documento_id));

CREATE TABLE IF NOT EXISTS public.documento_ocr_fila (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES public.ged_documents(id) ON DELETE CASCADE,
  versao_id UUID REFERENCES public.ged_document_versions(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL,
  status public.ocr_status NOT NULL DEFAULT 'pendente',
  prioridade INTEGER NOT NULL DEFAULT 5,
  agendado_para TIMESTAMPTZ NOT NULL DEFAULT now(),
  iniciado_em TIMESTAMPTZ,
  finalizado_em TIMESTAMPTZ,
  worker_id TEXT,
  tentativas INTEGER NOT NULL DEFAULT 0,
  ultimo_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.documento_ocr_fila TO authenticated;
GRANT ALL ON public.documento_ocr_fila TO service_role;
ALTER TABLE public.documento_ocr_fila ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ocr_fila_status ON public.documento_ocr_fila (status, agendado_para);
CREATE INDEX IF NOT EXISTS idx_ocr_fila_org ON public.documento_ocr_fila (organization_id);
CREATE POLICY "Fila OCR visível para admins da org"
ON public.documento_ocr_fila FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role_in_org(auth.uid(), 'org_admin', organization_id));

CREATE TABLE IF NOT EXISTS public.documento_ocr_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,
  documento_id UUID,
  acao public.ocr_audit_action NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.documento_ocr_auditoria TO authenticated;
GRANT ALL ON public.documento_ocr_auditoria TO service_role;
ALTER TABLE public.documento_ocr_auditoria ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ocr_audit_org ON public.documento_ocr_auditoria (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_audit_doc ON public.documento_ocr_auditoria (documento_id);
CREATE POLICY "Inserir auditoria OCR (próprio user)"
ON public.documento_ocr_auditoria FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Ver auditoria OCR (admin)"
ON public.documento_ocr_auditoria FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role_in_org(auth.uid(), 'org_admin', organization_id));

DROP TRIGGER IF EXISTS trg_documento_ocr_updated ON public.documento_ocr;
CREATE TRIGGER trg_documento_ocr_updated BEFORE UPDATE ON public.documento_ocr
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_documento_ocr_fila_updated ON public.documento_ocr_fila;
CREATE TRIGGER trg_documento_ocr_fila_updated BEFORE UPDATE ON public.documento_ocr_fila
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enqueue_document_ocr(
  p_documento_id UUID, p_versao_id UUID DEFAULT NULL, p_prioridade INTEGER DEFAULT 5
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID; v_id UUID;
BEGIN
  SELECT organization_id INTO v_org FROM public.ged_documents WHERE id = p_documento_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Documento não encontrado'; END IF;
  INSERT INTO public.documento_ocr_fila (documento_id, versao_id, organization_id, prioridade)
  VALUES (p_documento_id, p_versao_id, v_org, p_prioridade) RETURNING id INTO v_id;
  INSERT INTO public.documento_ocr (documento_id, versao_id, organization_id, status)
  VALUES (p_documento_id, p_versao_id, v_org, 'pendente')
  ON CONFLICT (documento_id, versao_id) DO UPDATE SET status = 'pendente', updated_at = now();
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.enqueue_document_ocr(UUID, UUID, INTEGER) TO authenticated;

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
  v_classificacao TEXT := NULLIF(p_filters->>'classificacao','');
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
      d.name AS documento_nome, d.document_type_id AS tipo_documento_id,
      d.classification AS classificacao, d.folder_id, d.created_at,
      CASE WHEN v_tsquery IS NULL THEN 0.0 ELSE ts_rank_cd(p.texto_tsv, v_tsquery) END AS rank
    FROM public.documento_ocr_pagina p
    JOIN public.ged_documents d ON d.id = p.documento_id
    WHERE (v_tsquery IS NULL OR p.texto_tsv @@ v_tsquery)
      AND (v_folder_id IS NULL OR d.folder_id = v_folder_id)
      AND (v_tipo IS NULL OR d.document_type_id = v_tipo)
      AND (v_classificacao IS NULL OR d.classification = v_classificacao)
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
GRANT EXECUTE ON FUNCTION public.search_documents_fts(TEXT, JSONB, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.ocr_dashboard_stats(p_org_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v JSONB;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR public.has_role_in_org(auth.uid(),'org_admin', p_org_id)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT jsonb_build_object(
    'processados', COUNT(*) FILTER (WHERE status='processado'),
    'pendentes',   COUNT(*) FILTER (WHERE status='pendente'),
    'processando', COUNT(*) FILTER (WHERE status='processando'),
    'erros',       COUNT(*) FILTER (WHERE status='erro'),
    'total_paginas', COALESCE(SUM(total_paginas) FILTER (WHERE status='processado'),0),
    'tempo_medio_ms', COALESCE(AVG(tempo_processamento_ms) FILTER (WHERE status='processado'),0)
  ) INTO v FROM public.documento_ocr WHERE organization_id = p_org_id;
  RETURN v;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ocr_dashboard_stats(UUID) TO authenticated;

-- Correção da policy quebrada do ged_documents
DROP POLICY IF EXISTS "Acesso Documentos Seguros" ON public.ged_documents;
CREATE POLICY "Acesso Documentos Seguros"
ON public.ged_documents FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role_in_org(auth.uid(), 'org_admin', organization_id)
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.documento_usuario_autorizado dua
    WHERE dua.documento_id = ged_documents.id AND dua.usuario_id = auth.uid()
  )
  OR (
    public.has_permission(auth.uid(), 'visualizar_documento'::ged_permission)
    AND organization_id = public.get_user_org_id(auth.uid())
  )
);
