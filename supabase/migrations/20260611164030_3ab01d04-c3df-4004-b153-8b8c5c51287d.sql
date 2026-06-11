DROP FUNCTION IF EXISTS public.dashboard_indicators(uuid, date, date);

CREATE OR REPLACE FUNCTION public.dashboard_indicators(
  p_org_id uuid,
  p_start_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_end_date date DEFAULT CURRENT_DATE
)
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
  v_expired_docs int;
  v_expiring_soon_docs int;
  v_org_logo text;
  v_org_name text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR public.get_user_org_id(auth.uid()) = p_org_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Info básica da org
  SELECT name, logo_url INTO v_org_name, v_org_logo
    FROM public.organizations WHERE id = p_org_id;

  -- Total de documentos enviados no PERÍODO
  SELECT COUNT(*) INTO v_total_docs
    FROM public.ged_documents
    WHERE organization_id = p_org_id 
      AND status <> 'deleted'
      AND created_at::date BETWEEN p_start_date AND p_end_date;

  -- Total de pastas (geral)
  SELECT COUNT(*) INTO v_total_folders
    FROM public.folders WHERE organization_id = p_org_id AND past_in_ativa = true;

  -- Total de usuários ativos
  SELECT COUNT(*) INTO v_total_users
    FROM public.profiles WHERE organization_id = p_org_id AND is_active = true;

  -- Limites da org
  SELECT COALESCE(max_users, 999999) INTO v_max_users
    FROM public.organizations WHERE id = p_org_id;

  -- Uso de armazenamento e páginas (no período para páginas, geral para storage)
  SELECT COALESCE(used_storage_bytes,0), COALESCE(used_storage_gb,0),
         COALESCE(contracted_storage_gb,0), COALESCE(contracted_pages,0)
    INTO v_used_bytes, v_used_gb, v_contracted_gb, v_contracted_pages
    FROM public.organization_usage WHERE organization_id = p_org_id;

  -- Páginas consumidas no período
  SELECT COALESCE(SUM(page_count), 0) INTO v_used_pages
    FROM public.ged_documents
    WHERE organization_id = p_org_id 
      AND status <> 'deleted'
      AND created_at::date BETWEEN p_start_date AND p_end_date;

  -- Documentos vencidos (geral)
  SELECT COUNT(*) INTO v_expired_docs
    FROM public.ged_documents
    WHERE organization_id = p_org_id 
      AND status <> 'deleted' 
      AND expiration_date < CURRENT_DATE;

  -- Vencendo em 30 dias (geral)
  SELECT COUNT(*) INTO v_expiring_soon_docs
    FROM public.ged_documents
    WHERE organization_id = p_org_id 
      AND status <> 'deleted' 
      AND expiration_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days');

  -- Evolução mensal de uploads no período
  SELECT jsonb_agg(t) INTO v_monthly
  FROM (
    SELECT 
      to_char(created_at, 'MM/YYYY') as label,
      COUNT(*) as total,
      min(created_at) as sort_date
    FROM public.ged_documents
    WHERE organization_id = p_org_id 
      AND status <> 'deleted'
      AND created_at::date BETWEEN p_start_date AND p_end_date
    GROUP BY 1
    ORDER BY sort_date
  ) t;

  -- Armazenamento por pasta (geral)
  SELECT jsonb_agg(t) INTO v_by_folder
  FROM (
    SELECT 
      f.name,
      SUM(COALESCE(v.file_size, 0)) as bytes
    FROM public.folders f
    LEFT JOIN public.ged_documents d ON d.folder_id = f.id AND d.status <> 'deleted'
    LEFT JOIN public.ged_document_versions v ON v.document_id = d.id -- assume a versão mais recente ou soma tudo? Geralmente soma-se o storage ocupado
    WHERE f.organization_id = p_org_id AND f.past_in_ativa = true
    GROUP BY f.name
    HAVING SUM(COALESCE(v.file_size, 0)) > 0
    ORDER BY bytes DESC
    LIMIT 10
  ) t;

  -- Usuários mais ativos no período (via log de auditoria)
  SELECT jsonb_agg(t) INTO v_top_users
  FROM (
    SELECT 
      p.full_name as name,
      COUNT(*) as total
    FROM public.ged_audit_log l
    JOIN public.profiles p ON p.id = l.user_id
    WHERE l.organization_id = p_org_id
      AND l.created_at::date BETWEEN p_start_date AND p_end_date
    GROUP BY p.full_name
    ORDER BY total DESC
    LIMIT 5
  ) t;

  -- Páginas indexadas por usuário no período
  SELECT jsonb_agg(t) INTO v_pages_by_user
  FROM (
    SELECT 
      p.full_name as name,
      SUM(COALESCE(d.page_count, 0)) as total
    FROM public.ged_documents d
    JOIN public.profiles p ON p.id = d.owner_id -- ou d.created_by, mas usei owner_id pois parece mais correto para indexação
    WHERE d.organization_id = p_org_id
      AND d.status <> 'deleted'
      AND d.created_at::date BETWEEN p_start_date AND p_end_date
    GROUP BY p.full_name
    HAVING SUM(COALESCE(d.page_count, 0)) > 0
    ORDER BY total DESC
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
    'monthly_uploads', COALESCE(v_monthly, '[]'::jsonb),
    'storage_by_folder', COALESCE(v_by_folder, '[]'::jsonb),
    'top_users', COALESCE(v_top_users, '[]'::jsonb),
    'pages_by_user', COALESCE(v_pages_by_user, '[]'::jsonb),
    'expired_docs_count', v_expired_docs,
    'expiring_soon_docs_count', v_expiring_soon_docs,
    'org_logo', v_org_logo,
    'org_name', v_org_name,
    'start_date', p_start_date,
    'end_date', p_end_date
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_indicators(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_indicators(uuid, date, date) TO service_role;
