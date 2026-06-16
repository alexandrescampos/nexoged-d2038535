
-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.tipo_assinatura AS ENUM ('NENHUMA','SIMPLES','AVANCADA','QUALIFICADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_etapa_aprovacao AS ENUM ('PENDENTE','APROVADA','REPROVADA','PULADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_assinatura AS ENUM ('PENDENTE','ASSINADA','RECUSADA','CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- politica_assinatura
-- ============================================================
CREATE TABLE IF NOT EXISTS public.politica_assinatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  assinatura_obrigatoria BOOLEAN NOT NULL DEFAULT false,
  tipo_assinatura public.tipo_assinatura NOT NULL DEFAULT 'NENHUMA',
  quantidade_minima_assinaturas INT NOT NULL DEFAULT 0,
  permite_coassinatura BOOLEAN NOT NULL DEFAULT true,
  ordem_assinatura BOOLEAN NOT NULL DEFAULT false,
  carimbo_tempo BOOLEAN NOT NULL DEFAULT false,
  certificado_obrigatorio BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.politica_assinatura TO authenticated;
GRANT ALL ON public.politica_assinatura TO service_role;
ALTER TABLE public.politica_assinatura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "politica_assinatura_select" ON public.politica_assinatura
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "politica_assinatura_manage" ON public.politica_assinatura
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role_in_org(auth.uid(),'org_admin', organization_id))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role_in_org(auth.uid(),'org_admin', organization_id));

CREATE TRIGGER trg_politica_assinatura_updated BEFORE UPDATE ON public.politica_assinatura
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- fluxo_aprovacao
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fluxo_aprovacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fluxo_aprovacao TO authenticated;
GRANT ALL ON public.fluxo_aprovacao TO service_role;
ALTER TABLE public.fluxo_aprovacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fluxo_aprovacao_select" ON public.fluxo_aprovacao
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "fluxo_aprovacao_manage" ON public.fluxo_aprovacao
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role_in_org(auth.uid(),'org_admin', organization_id))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role_in_org(auth.uid(),'org_admin', organization_id));

CREATE TRIGGER trg_fluxo_aprovacao_updated BEFORE UPDATE ON public.fluxo_aprovacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- fluxo_aprovacao_etapa
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fluxo_aprovacao_etapa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id UUID NOT NULL REFERENCES public.fluxo_aprovacao(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  nome_etapa TEXT NOT NULL,
  perfil_responsavel_id UUID REFERENCES public.perfil(perfil_id) ON DELETE SET NULL,
  aprovacao_obrigatoria BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fluxo_id, ordem)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fluxo_aprovacao_etapa TO authenticated;
GRANT ALL ON public.fluxo_aprovacao_etapa TO service_role;
ALTER TABLE public.fluxo_aprovacao_etapa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fluxo_etapa_all" ON public.fluxo_aprovacao_etapa
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fluxo_aprovacao f WHERE f.id = fluxo_id
                  AND (public.has_role(auth.uid(),'super_admin') OR f.organization_id = public.get_user_org_id(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fluxo_aprovacao f WHERE f.id = fluxo_id
                  AND (public.has_role(auth.uid(),'super_admin') OR public.has_role_in_org(auth.uid(),'org_admin', f.organization_id))));

CREATE TRIGGER trg_fluxo_etapa_updated BEFORE UPDATE ON public.fluxo_aprovacao_etapa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Estender ged_document_types
-- ============================================================
ALTER TABLE public.ged_document_types
  ADD COLUMN IF NOT EXISTS politica_assinatura_id UUID REFERENCES public.politica_assinatura(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fluxo_aprovacao_id UUID REFERENCES public.fluxo_aprovacao(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nivel_sigilo_padrao TEXT DEFAULT 'INTERNO',
  ADD COLUMN IF NOT EXISTS ocr_obrigatorio BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdfa_obrigatorio BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dias_retencao INT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- fluxo_assinatura (por tipo de documento)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fluxo_assinatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento_id UUID NOT NULL REFERENCES public.ged_document_types(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  perfil_assinante_id UUID REFERENCES public.perfil(perfil_id) ON DELETE SET NULL,
  assinatura_obrigatoria BOOLEAN NOT NULL DEFAULT true,
  tipo_assinatura public.tipo_assinatura NOT NULL DEFAULT 'SIMPLES',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo_documento_id, ordem)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fluxo_assinatura TO authenticated;
GRANT ALL ON public.fluxo_assinatura TO service_role;
ALTER TABLE public.fluxo_assinatura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fluxo_assinatura_all" ON public.fluxo_assinatura
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ged_document_types t WHERE t.id = tipo_documento_id
                  AND (public.has_role(auth.uid(),'super_admin') OR t.organization_id = public.get_user_org_id(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ged_document_types t WHERE t.id = tipo_documento_id
                  AND (public.has_role(auth.uid(),'super_admin') OR public.has_role_in_org(auth.uid(),'org_admin', t.organization_id))));

CREATE TRIGGER trg_fluxo_assinatura_updated BEFORE UPDATE ON public.fluxo_assinatura
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- documento_aprovacao (instâncias por documento)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documento_aprovacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  documento_id UUID NOT NULL REFERENCES public.ged_documents(id) ON DELETE CASCADE,
  fluxo_id UUID REFERENCES public.fluxo_aprovacao(id) ON DELETE SET NULL,
  etapa_id UUID REFERENCES public.fluxo_aprovacao_etapa(id) ON DELETE SET NULL,
  ordem INT NOT NULL,
  nome_etapa TEXT NOT NULL,
  perfil_responsavel_id UUID REFERENCES public.perfil(perfil_id) ON DELETE SET NULL,
  status public.status_etapa_aprovacao NOT NULL DEFAULT 'PENDENTE',
  aprovador_id UUID,
  decidido_em TIMESTAMPTZ,
  comentario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_aprovacao TO authenticated;
GRANT ALL ON public.documento_aprovacao TO service_role;
ALTER TABLE public.documento_aprovacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documento_aprovacao_select" ON public.documento_aprovacao
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "documento_aprovacao_manage" ON public.documento_aprovacao
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role_in_org(auth.uid(),'org_admin', organization_id))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role_in_org(auth.uid(),'org_admin', organization_id));

CREATE TRIGGER trg_documento_aprovacao_updated BEFORE UPDATE ON public.documento_aprovacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_doc_aprov_doc ON public.documento_aprovacao(documento_id, ordem);

-- ============================================================
-- documento_assinatura
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documento_assinatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  documento_id UUID NOT NULL REFERENCES public.ged_documents(id) ON DELETE CASCADE,
  versao_id UUID REFERENCES public.ged_document_versions(id) ON DELETE SET NULL,
  ordem INT NOT NULL,
  perfil_assinante_id UUID REFERENCES public.perfil(perfil_id) ON DELETE SET NULL,
  assinante_id UUID,
  tipo_assinatura public.tipo_assinatura NOT NULL DEFAULT 'SIMPLES',
  assinatura_obrigatoria BOOLEAN NOT NULL DEFAULT true,
  status public.status_assinatura NOT NULL DEFAULT 'PENDENTE',
  assinado_em TIMESTAMPTZ,
  hash_evidencia TEXT,
  certificado_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_assinatura TO authenticated;
GRANT ALL ON public.documento_assinatura TO service_role;
ALTER TABLE public.documento_assinatura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documento_assinatura_select" ON public.documento_assinatura
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "documento_assinatura_manage" ON public.documento_assinatura
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role_in_org(auth.uid(),'org_admin', organization_id))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role_in_org(auth.uid(),'org_admin', organization_id));

CREATE TRIGGER trg_documento_assinatura_updated BEFORE UPDATE ON public.documento_assinatura
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_doc_assin_doc ON public.documento_assinatura(documento_id, ordem);

-- ============================================================
-- RPC: apply_document_type_policy
-- Aplica política/fluxo do tipo a um documento existente,
-- gerando as etapas de aprovação e os slots de assinatura.
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_document_type_policy(p_document_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_doc public.ged_documents;
  v_tipo public.ged_document_types;
  v_politica public.politica_assinatura;
  v_etapas_count INT := 0;
  v_assin_count INT := 0;
  r RECORD;
BEGIN
  SELECT * INTO v_doc FROM public.ged_documents WHERE id = p_document_id;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Documento não encontrado'; END IF;
  IF v_doc.document_type_id IS NULL THEN RETURN jsonb_build_object('applied', false, 'reason','sem tipo'); END IF;

  SELECT * INTO v_tipo FROM public.ged_document_types WHERE id = v_doc.document_type_id;

  -- Limpa instâncias anteriores ainda pendentes
  DELETE FROM public.documento_aprovacao WHERE documento_id = p_document_id AND status = 'PENDENTE';
  DELETE FROM public.documento_assinatura WHERE documento_id = p_document_id AND status = 'PENDENTE';

  -- Gera etapas de aprovação
  IF v_tipo.fluxo_aprovacao_id IS NOT NULL THEN
    FOR r IN
      SELECT * FROM public.fluxo_aprovacao_etapa WHERE fluxo_id = v_tipo.fluxo_aprovacao_id ORDER BY ordem
    LOOP
      INSERT INTO public.documento_aprovacao(organization_id, documento_id, fluxo_id, etapa_id, ordem, nome_etapa, perfil_responsavel_id)
      VALUES (v_doc.organization_id, p_document_id, v_tipo.fluxo_aprovacao_id, r.id, r.ordem, r.nome_etapa, r.perfil_responsavel_id);
      v_etapas_count := v_etapas_count + 1;
    END LOOP;
  END IF;

  -- Gera assinantes
  SELECT * INTO v_politica FROM public.politica_assinatura WHERE id = v_tipo.politica_assinatura_id;
  FOR r IN
    SELECT * FROM public.fluxo_assinatura WHERE tipo_documento_id = v_tipo.id ORDER BY ordem
  LOOP
    INSERT INTO public.documento_assinatura(organization_id, documento_id, versao_id, ordem, perfil_assinante_id, assinatura_obrigatoria, tipo_assinatura)
    VALUES (v_doc.organization_id, p_document_id, v_doc.current_version_id, r.ordem, r.perfil_assinante_id, r.assinatura_obrigatoria,
            COALESCE(v_politica.tipo_assinatura, r.tipo_assinatura));
    v_assin_count := v_assin_count + 1;
  END LOOP;

  -- Aplica sigilo / OCR / PDFA
  UPDATE public.ged_documents
    SET sigilo = COALESCE(v_doc.sigilo, COALESCE(v_tipo.nivel_sigilo_padrao::public.ged_sigilo, 'INTERNO'::public.ged_sigilo))
  WHERE id = p_document_id;

  INSERT INTO public.ged_audit_log(organization_id, document_id, user_id, action, details)
  VALUES (v_doc.organization_id, p_document_id, auth.uid(), 'policy_applied',
          jsonb_build_object('tipo_id', v_tipo.id, 'etapas', v_etapas_count, 'assinantes', v_assin_count));

  RETURN jsonb_build_object('applied', true, 'etapas', v_etapas_count, 'assinantes', v_assin_count);
END $$;

-- ============================================================
-- RPC: submit_for_approval — coloca o documento em AGUARDANDO_APROVACAO
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_for_approval(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_doc public.ged_documents;
BEGIN
  SELECT * INTO v_doc FROM public.ged_documents WHERE id = p_document_id;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Documento não encontrado'; END IF;

  -- Garante que as instâncias existem
  IF NOT EXISTS (SELECT 1 FROM public.documento_aprovacao WHERE documento_id = p_document_id) THEN
    PERFORM public.apply_document_type_policy(p_document_id);
  END IF;

  UPDATE public.ged_documents SET status = 'AGUARDANDO_APROVACAO', updated_at = now() WHERE id = p_document_id;

  INSERT INTO public.ged_audit_log(organization_id, document_id, user_id, action, details)
  VALUES (v_doc.organization_id, p_document_id, auth.uid(), 'approval_submitted', '{}'::jsonb);
END $$;

-- ============================================================
-- RPC: approve_step / reject_step
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_step(p_etapa_instancia_id UUID, p_comentario TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v public.documento_aprovacao;
  v_pendentes INT;
BEGIN
  SELECT * INTO v FROM public.documento_aprovacao WHERE id = p_etapa_instancia_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;
  IF v.status <> 'PENDENTE' THEN RAISE EXCEPTION 'Etapa já decidida'; END IF;

  UPDATE public.documento_aprovacao
    SET status = 'APROVADA', aprovador_id = auth.uid(), decidido_em = now(), comentario = p_comentario
    WHERE id = p_etapa_instancia_id;

  SELECT COUNT(*) INTO v_pendentes FROM public.documento_aprovacao
    WHERE documento_id = v.documento_id AND status = 'PENDENTE';

  IF v_pendentes = 0 THEN
    UPDATE public.ged_documents
      SET status = CASE WHEN EXISTS (SELECT 1 FROM public.documento_assinatura WHERE documento_id = v.documento_id AND status='PENDENTE')
                        THEN 'AGUARDANDO_ASSINATURA' ELSE 'APROVADO' END,
          updated_at = now()
      WHERE id = v.documento_id;
  END IF;

  INSERT INTO public.ged_audit_log(organization_id, document_id, user_id, action, details)
  VALUES (v.organization_id, v.documento_id, auth.uid(), 'approval_approved',
          jsonb_build_object('etapa_id', p_etapa_instancia_id, 'comentario', p_comentario));
END $$;

CREATE OR REPLACE FUNCTION public.reject_step(p_etapa_instancia_id UUID, p_comentario TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v public.documento_aprovacao;
BEGIN
  SELECT * INTO v FROM public.documento_aprovacao WHERE id = p_etapa_instancia_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;

  UPDATE public.documento_aprovacao
    SET status = 'REPROVADA', aprovador_id = auth.uid(), decidido_em = now(), comentario = p_comentario
    WHERE id = p_etapa_instancia_id;

  UPDATE public.ged_documents SET status = 'EM_REVISAO', updated_at = now() WHERE id = v.documento_id;

  INSERT INTO public.ged_audit_log(organization_id, document_id, user_id, action, details)
  VALUES (v.organization_id, v.documento_id, auth.uid(), 'approval_rejected',
          jsonb_build_object('etapa_id', p_etapa_instancia_id, 'comentario', p_comentario));
END $$;

-- ============================================================
-- RPC: sign_document — valida tipo de assinatura conforme política
-- ============================================================
CREATE OR REPLACE FUNCTION public.sign_document(
  p_assinatura_id UUID,
  p_tipo public.tipo_assinatura,
  p_hash_evidencia TEXT DEFAULT NULL,
  p_certificado JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v public.documento_assinatura;
  v_tipo_doc public.ged_document_types;
  v_politica public.politica_assinatura;
  v_doc public.ged_documents;
  v_pendentes INT;
BEGIN
  SELECT * INTO v FROM public.documento_assinatura WHERE id = p_assinatura_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Assinatura não encontrada'; END IF;
  IF v.status <> 'PENDENTE' THEN RAISE EXCEPTION 'Assinatura já registrada'; END IF;

  SELECT * INTO v_doc FROM public.ged_documents WHERE id = v.documento_id;
  SELECT * INTO v_tipo_doc FROM public.ged_document_types WHERE id = v_doc.document_type_id;
  SELECT * INTO v_politica FROM public.politica_assinatura WHERE id = v_tipo_doc.politica_assinatura_id;

  -- Validação de conformidade de tipo
  IF v_politica.id IS NOT NULL THEN
    IF v_politica.tipo_assinatura = 'QUALIFICADA' AND p_tipo <> 'QUALIFICADA' THEN
      RAISE EXCEPTION 'Política exige assinatura QUALIFICADA (ICP-Brasil A1/A3)';
    END IF;
    IF v_politica.tipo_assinatura = 'AVANCADA' AND p_tipo NOT IN ('AVANCADA','QUALIFICADA') THEN
      RAISE EXCEPTION 'Política exige assinatura AVANCADA (Gov.br/MFA/OTP) ou superior';
    END IF;
    IF v_politica.certificado_obrigatorio AND p_certificado IS NULL THEN
      RAISE EXCEPTION 'Certificado obrigatório para esta política';
    END IF;
  END IF;

  UPDATE public.documento_assinatura
    SET status='ASSINADA', assinante_id=auth.uid(), assinado_em=now(),
        tipo_assinatura=p_tipo, hash_evidencia=p_hash_evidencia, certificado_info=p_certificado
    WHERE id = p_assinatura_id;

  SELECT COUNT(*) INTO v_pendentes FROM public.documento_assinatura
    WHERE documento_id = v.documento_id AND status='PENDENTE' AND assinatura_obrigatoria = true;

  IF v_pendentes = 0 THEN
    UPDATE public.ged_documents SET status='ASSINADO', updated_at=now() WHERE id = v.documento_id;
  END IF;

  INSERT INTO public.ged_audit_log(organization_id, document_id, user_id, action, details)
  VALUES (v.organization_id, v.documento_id, auth.uid(), 'document_signed',
          jsonb_build_object('assinatura_id', p_assinatura_id, 'tipo', p_tipo));
END $$;

-- ============================================================
-- RPC: archive_document
-- ============================================================
CREATE OR REPLACE FUNCTION public.archive_document(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_doc public.ged_documents;
  v_tipo public.ged_document_types;
  v_politica public.politica_assinatura;
  v_pendentes INT;
BEGIN
  SELECT * INTO v_doc FROM public.ged_documents WHERE id = p_document_id;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Documento não encontrado'; END IF;

  SELECT * INTO v_tipo FROM public.ged_document_types WHERE id = v_doc.document_type_id;
  SELECT * INTO v_politica FROM public.politica_assinatura WHERE id = v_tipo.politica_assinatura_id;

  IF v_politica.assinatura_obrigatoria THEN
    SELECT COUNT(*) INTO v_pendentes FROM public.documento_assinatura
      WHERE documento_id = p_document_id AND status='PENDENTE' AND assinatura_obrigatoria = true;
    IF v_pendentes > 0 THEN
      RAISE EXCEPTION 'Documento não pode ser arquivado: assinaturas pendentes';
    END IF;
  END IF;

  UPDATE public.ged_documents SET status='ARQUIVADO', updated_at=now() WHERE id = p_document_id;

  INSERT INTO public.ged_audit_log(organization_id, document_id, user_id, action, details)
  VALUES (v_doc.organization_id, p_document_id, auth.uid(), 'document_archived', '{}'::jsonb);
END $$;
