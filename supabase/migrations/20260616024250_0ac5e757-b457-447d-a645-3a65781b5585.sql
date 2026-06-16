
-- 1. Extend ged_documents
ALTER TABLE public.ged_documents
  ADD COLUMN IF NOT EXISTS current_version_id UUID,
  ADD COLUMN IF NOT EXISTS latest_version_number TEXT,
  ADD COLUMN IF NOT EXISTS latest_version_at TIMESTAMPTZ;

-- 2. Extend ged_document_versions
ALTER TABLE public.ged_document_versions
  ADD COLUMN IF NOT EXISTS version_label TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS version_major INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_minor INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS change_description TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'RASCUNHO',
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS based_on_version_id UUID,
  ADD COLUMN IF NOT EXISTS is_restoration BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Backfill organization_id and change_description for legacy rows
UPDATE public.ged_document_versions v
SET organization_id = d.organization_id
FROM public.ged_documents d
WHERE v.document_id = d.id AND v.organization_id IS NULL;

UPDATE public.ged_document_versions
SET change_description = COALESCE(change_description, 'Versão inicial importada')
WHERE change_description IS NULL;

-- Status constraint
ALTER TABLE public.ged_document_versions
  DROP CONSTRAINT IF EXISTS ged_document_versions_status_check;
ALTER TABLE public.ged_document_versions
  ADD CONSTRAINT ged_document_versions_status_check
  CHECK (status IN ('RASCUNHO','EM_REVISAO','APROVADA','ASSINADA','ARQUIVADA','CANCELADA'));

CREATE INDEX IF NOT EXISTS idx_ged_versions_document ON public.ged_document_versions(document_id, version_major DESC, version_minor DESC);
CREATE INDEX IF NOT EXISTS idx_ged_versions_org ON public.ged_document_versions(organization_id);

-- 3. Immutability trigger for SIGNED versions
CREATE OR REPLACE FUNCTION public.protect_signed_versions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'super_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status = 'ASSINADA' THEN
    RAISE EXCEPTION 'Versão assinada não pode ser excluída';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'ASSINADA' THEN
    RAISE EXCEPTION 'Versão assinada é imutável';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_signed_versions ON public.ged_document_versions;
CREATE TRIGGER trg_protect_signed_versions
  BEFORE UPDATE OR DELETE ON public.ged_document_versions
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_versions();

-- 4. RPC create_document_version
CREATE OR REPLACE FUNCTION public.create_document_version(
  p_document_id UUID,
  p_bump_type TEXT,
  p_change_description TEXT,
  p_file_path TEXT,
  p_file_name TEXT,
  p_file_size BIGINT,
  p_mime_type TEXT,
  p_title TEXT DEFAULT NULL,
  p_based_on UUID DEFAULT NULL,
  p_is_restoration BOOLEAN DEFAULT false
)
RETURNS public.ged_document_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_last RECORD;
  v_major INT;
  v_minor INT;
  v_label TEXT;
  v_new public.ged_document_versions;
  v_next_num INT;
BEGIN
  IF p_change_description IS NULL OR length(trim(p_change_description)) = 0 THEN
    RAISE EXCEPTION 'Observação de alteração é obrigatória';
  END IF;

  SELECT organization_id INTO v_org FROM public.ged_documents WHERE id = p_document_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Documento não encontrado'; END IF;

  -- Lock row to avoid races
  PERFORM 1 FROM public.ged_documents WHERE id = p_document_id FOR UPDATE;

  SELECT version_major, version_minor, version_number INTO v_last
    FROM public.ged_document_versions
    WHERE document_id = p_document_id AND status <> 'CANCELADA'
    ORDER BY version_major DESC, version_minor DESC LIMIT 1;

  IF v_last IS NULL THEN
    v_major := 1; v_minor := 0;
  ELSIF p_bump_type = 'major' THEN
    v_major := v_last.version_major + 1; v_minor := 0;
  ELSE
    v_major := v_last.version_major; v_minor := v_last.version_minor + 1;
  END IF;
  v_label := v_major || '.' || v_minor;

  SELECT COALESCE(MAX(version_number),0)+1 INTO v_next_num
    FROM public.ged_document_versions WHERE document_id = p_document_id;

  INSERT INTO public.ged_document_versions(
    document_id, version_number, file_path, file_name, file_size, mime_type, created_by,
    version_label, version_major, version_minor, title, change_description, status,
    based_on_version_id, is_restoration, organization_id
  ) VALUES (
    p_document_id, v_next_num, p_file_path, p_file_name, p_file_size, p_mime_type, auth.uid(),
    v_label, v_major, v_minor, p_title, p_change_description, 'RASCUNHO',
    p_based_on, p_is_restoration, v_org
  ) RETURNING * INTO v_new;

  UPDATE public.ged_documents
    SET current_version_id = v_new.id,
        latest_version_number = v_label,
        latest_version_at = now(),
        updated_at = now()
    WHERE id = p_document_id;

  INSERT INTO public.ged_audit_log(organization_id, document_id, user_id, action, details)
  VALUES (v_org, p_document_id, auth.uid(),
    CASE WHEN p_is_restoration THEN 'version_restored' ELSE 'version_created' END,
    jsonb_build_object('version_id', v_new.id, 'version_label', v_label, 'change_description', p_change_description));

  BEGIN
    PERFORM public.enqueue_document_ocr(p_document_id, v_new.id, 5);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_new;
END;
$$;

-- 5. RPC restore_document_version
CREATE OR REPLACE FUNCTION public.restore_document_version(p_version_id UUID)
RETURNS public.ged_document_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.ged_document_versions;
  v_new public.ged_document_versions;
BEGIN
  SELECT * INTO v_old FROM public.ged_document_versions WHERE id = p_version_id;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;

  SELECT * INTO v_new FROM public.create_document_version(
    v_old.document_id, 'minor',
    'Restauração da versão ' || v_old.version_label,
    v_old.file_path, v_old.file_name, v_old.file_size, v_old.mime_type,
    v_old.title, v_old.id, true
  );
  RETURN v_new;
END;
$$;

-- 6. RPC cancel
CREATE OR REPLACE FUNCTION public.cancel_document_version(p_version_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_v public.ged_document_versions;
BEGIN
  SELECT * INTO v_v FROM public.ged_document_versions WHERE id = p_version_id;
  IF v_v.id IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;
  IF v_v.status = 'ASSINADA' THEN RAISE EXCEPTION 'Versão assinada não pode ser cancelada'; END IF;

  UPDATE public.ged_document_versions SET status = 'CANCELADA' WHERE id = p_version_id;

  INSERT INTO public.ged_audit_log(organization_id, document_id, user_id, action, details)
  VALUES (v_v.organization_id, v_v.document_id, auth.uid(), 'version_cancelled',
    jsonb_build_object('version_id', p_version_id, 'reason', p_reason));
END;
$$;

-- 7. RPC approve
CREATE OR REPLACE FUNCTION public.approve_document_version(p_version_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_v public.ged_document_versions;
BEGIN
  SELECT * INTO v_v FROM public.ged_document_versions WHERE id = p_version_id;
  IF v_v.id IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;

  UPDATE public.ged_document_versions
    SET status='APROVADA', approved_by=auth.uid(), approved_at=now()
    WHERE id = p_version_id;

  INSERT INTO public.ged_audit_log(organization_id, document_id, user_id, action, details)
  VALUES (v_v.organization_id, v_v.document_id, auth.uid(), 'version_approved',
    jsonb_build_object('version_id', p_version_id));
END;
$$;

-- 8. Seed new permissions
INSERT INTO public.permissao (perm_codigo, perm_nome, perm_descricao) VALUES
  ('visualizar_versoes', 'Visualizar versões', 'Visualizar histórico de versões de documentos'),
  ('criar_versoes', 'Criar versões', 'Criar novas versões de documentos'),
  ('restaurar_versoes', 'Restaurar versões', 'Restaurar versões antigas de documentos'),
  ('comparar_versoes', 'Comparar versões', 'Comparar versões de documentos'),
  ('baixar_versoes', 'Baixar versões', 'Baixar versões específicas de documentos'),
  ('cancelar_versoes', 'Cancelar versões', 'Cancelar versões de documentos')
ON CONFLICT (perm_codigo) DO NOTHING;
