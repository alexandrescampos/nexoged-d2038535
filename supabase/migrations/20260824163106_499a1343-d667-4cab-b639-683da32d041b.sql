CREATE OR REPLACE FUNCTION public.super_admin_org_stats()
RETURNS TABLE(
  organization_id uuid,
  organization_name text,
  status org_status,
  plan text,
  created_at timestamptz,
  contracted_pages integer,
  contracted_storage_gb integer,
  used_pages bigint,
  used_storage_bytes bigint,
  used_storage_gb numeric,
  total_documents bigint,
  documents_last_30d bigint,
  total_users bigint,
  active_users bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.status,
    o.plan,
    o.created_at,
    o.contracted_pages,
    o.contracted_storage_gb,
    COALESCE(d.used_pages, 0)::bigint,
    COALESCE(d.used_bytes, 0)::bigint,
    ROUND(COALESCE(d.used_bytes, 0) / (1024.0 * 1024.0 * 1024.0), 2),
    COALESCE(d.total_documents, 0)::bigint,
    COALESCE(d.documents_last_30d, 0)::bigint,
    COALESCE(p.total_users, 0)::bigint,
    COALESCE(p.active_users, 0)::bigint
  FROM public.organizations o
  LEFT JOIN (
    SELECT
      doc.organization_id,
      COUNT(*) AS total_documents,
      COUNT(*) FILTER (WHERE doc.created_at >= now() - interval '30 days') AS documents_last_30d,
      SUM(COALESCE(doc.page_count, 0)) AS used_pages,
      SUM(COALESCE(v.bytes, 0)) AS used_bytes
    FROM public.ged_documents doc
    LEFT JOIN LATERAL (
      SELECT SUM(COALESCE(gv.file_size, 0)) AS bytes
      FROM public.ged_document_versions gv
      WHERE gv.document_id = doc.id
    ) v ON true
    WHERE doc.deleted_at IS NULL
    GROUP BY doc.organization_id
  ) d ON d.organization_id = o.id
  LEFT JOIN (
    SELECT
      pr.organization_id,
      COUNT(*) AS total_users,
      COUNT(*) FILTER (WHERE pr.is_active) AS active_users
    FROM public.profiles pr
    GROUP BY pr.organization_id
  ) p ON p.organization_id = o.id
  WHERE public.has_role(auth.uid(), 'super_admin')
  ORDER BY o.name;
$$;

REVOKE ALL ON FUNCTION public.super_admin_org_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_org_stats() TO authenticated;