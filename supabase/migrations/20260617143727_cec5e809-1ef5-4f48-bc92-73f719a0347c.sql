CREATE OR REPLACE FUNCTION public.apply_document_type_policy(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  DELETE FROM public.documento_aprovacao WHERE documento_id = p_document_id AND status = 'PENDENTE';
  DELETE FROM public.documento_assinatura WHERE documento_id = p_document_id AND status = 'PENDENTE';

  IF v_tipo.fluxo_aprovacao_id IS NOT NULL THEN
    FOR r IN SELECT * FROM public.fluxo_aprovacao_etapa WHERE fluxo_id = v_tipo.fluxo_aprovacao_id ORDER BY ordem
    LOOP
      INSERT INTO public.documento_aprovacao(organization_id, documento_id, fluxo_id, etapa_id, ordem, nome_etapa, perfil_responsavel_id)
      VALUES (v_doc.organization_id, p_document_id, v_tipo.fluxo_aprovacao_id, r.id, r.ordem, r.nome_etapa, r.perfil_responsavel_id);
      v_etapas_count := v_etapas_count + 1;
    END LOOP;
  END IF;

  SELECT * INTO v_politica FROM public.politica_assinatura WHERE id = v_tipo.politica_assinatura_id;
  FOR r IN SELECT * FROM public.fluxo_assinatura WHERE tipo_documento_id = v_tipo.id ORDER BY ordem
  LOOP
    INSERT INTO public.documento_assinatura(organization_id, documento_id, versao_id, ordem, perfil_assinante_id, assinatura_obrigatoria, tipo_assinatura)
    VALUES (v_doc.organization_id, p_document_id, v_doc.current_version_id, r.ordem, r.perfil_assinante_id, r.assinatura_obrigatoria,
            COALESCE(v_politica.tipo_assinatura, r.tipo_assinatura));
    v_assin_count := v_assin_count + 1;
  END LOOP;

  UPDATE public.ged_documents
    SET sigilo = COALESCE(v_doc.sigilo, COALESCE(v_tipo.nivel_sigilo_padrao::public.sigilo_nivel, 'INTERNO'::public.sigilo_nivel))
  WHERE id = p_document_id;

  INSERT INTO public.ged_audit_log(organization_id, document_id, user_id, action, details)
  VALUES (v_doc.organization_id, p_document_id, auth.uid(), 'policy_applied',
          jsonb_build_object('tipo_id', v_tipo.id, 'etapas', v_etapas_count, 'assinantes', v_assin_count));

  RETURN jsonb_build_object('applied', true, 'etapas', v_etapas_count, 'assinantes', v_assin_count);
END $function$;

SELECT public.apply_document_type_policy(id) FROM public.ged_documents WHERE id IN ('a2f1f7d7-d594-4aa6-8b8f-21f46402ca5e','63174898-a0d4-4e50-a66e-2fdae0082c66');