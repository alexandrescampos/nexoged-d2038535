
CREATE OR REPLACE FUNCTION public.dashboard_indicators(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_total_docs int;
  v_total_folders int;
  v_total_users int;
  v_max_users int;
  v_used_pages bigint;
  v_used_bytes numeric;
  v_used_gb numeric;
  v_contracted_gb int;
  v_contracted_pages int;
  v_monthly jsonb;
  v_by_folder jsonb;
  v_top_users jsonb;
  v_pages_by_user jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR public.get_user_org_id(auth.uid()) = p_org_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COUNT(*) INTO v_total_docs
    FROM public.ged_documents
    WHERE organization_id = p_org_id AND status <> 'deleted';

  SELECT COUNT(*) INTO v_total_folders
    FROM public.folders WHERE organization_id = p_org_id AND past_in_ativa = true;

  SELECT COUNT(*) INTO v_total_users
    FROM public.profiles WHERE organization_id = p_org_id AND is_active = true;

  SELECT COALESCE(max_users, 999999) INTO v_max_users
    FROM public.organizations WHERE id = p_org_id;

  SELECT COALESCE(used_pages,0), COALESCE(used_storage_bytes,0), COALESCE(used_storage_gb,0),
         COALESCE(contracted_storage_gb,0), COALESCE(contracted_pages,0)
    INTO v_used_pages, v_used_bytes, v_used_gb, v_contracted_gb, v_contracted_pages
    FROM public.organization_usage WHERE organization_id = p_org_id;

  -- Monthly uploads (last 12 months)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.month_start), '[]'::jsonb) INTO v_monthly
  FROM (
    SELECT
      to_char(m.month_start, 'Mon/YY') AS label,
      m.month_start,
      COALESCE(c.cnt, 0) AS total
    FROM (
      SELECT date_trunc('month', (now() - (i || ' months')::interval))::date AS month_start
      FROM generate_series(0, 11) AS i
    ) m
    LEFT JOIN (
      SELECT date_trunc('month', created_at)::date AS month_start, COUNT(*) AS cnt
      FROM public.ged_documents
      WHERE organization_id = p_org_id
        AND status <> 'deleted'
        AND created_at >= date_trunc('month', now() - interval '11 months')
      GROUP BY 1
    ) c ON c.month_start = m.month_start
  ) t;

  -- GBs por pasta raiz
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.bytes DESC), '[]'::jsonb) INTO v_by_folder
  FROM (
    SELECT
      COALESCE(f.past_nm_pasta, 'Sem pasta') AS name,
      COALESCE(SUM(v.file_size), 0)::bigint AS bytes
    FROM public.ged_documents d
    LEFT JOIN public.folders f ON f.past_id = d.folder_id
    LEFT JOIN public.ged_document_versions v ON v.document_id = d.id
    WHERE d.organization_id = p_org_id AND d.status <> 'deleted'
    GROUP BY f.past_nm_pasta
    LIMIT 10
  ) t;

  -- Usuários mais ativos (últimos 30 dias)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.total DESC), '[]'::jsonb) INTO v_top_users
  FROM (
    SELECT p.full_name AS name, COUNT(*)::int AS total
    FROM public.ged_audit_log a
    JOIN public.profiles p ON p.id = a.user_id
    WHERE a.organization_id = p_org_id
      AND a.created_at >= now() - interval '30 days'
    GROUP BY p.full_name
    ORDER BY 2 DESC
    LIMIT 5
  ) t;

  -- Páginas indexadas por usuário (30 dias) — soma de páginas OCR processadas pertencentes a docs criados pelo usuário
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.total DESC), '[]'::jsonb) INTO v_pages_by_user
  FROM (
    SELECT p.full_name AS name, COALESCE(SUM(o.total_paginas),0)::int AS total
    FROM public.documento_ocr o
    JOIN public.ged_documents d ON d.id = o.documento_id
    JOIN public.profiles p ON p.id = d.created_by
    WHERE o.organization_id = p_org_id
      AND o.status = 'processado'
      AND o.data_processamento >= now() - interval '30 days'
    GROUP BY p.full_name
    ORDER BY 2 DESC
    LIMIT 5
  ) t;

  v_result := jsonb_build_object(
    'total_docs', v_total_docs,
    'total_folders', v_total_folders,
    'total_users', v_total_users,
    'max_users', v_max_users,
    'used_pages', v_used_pages,
    'contracted_pages', v_contracted_pages,
    'used_storage_bytes', v_used_bytes,
    'used_storage_gb', v_used_gb,
    'contracted_storage_gb', v_contracted_gb,
    'monthly_uploads', v_monthly,
    'storage_by_folder', v_by_folder,
    'top_users', v_top_users,
    'pages_by_user', v_pages_by_user
  );

  RETURN v_result;
END;
$$;
