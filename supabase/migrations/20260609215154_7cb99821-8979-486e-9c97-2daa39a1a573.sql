CREATE OR REPLACE FUNCTION public.sum_org_document_size(p_org_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  SELECT COALESCE(SUM(file_size), 0)
  INTO v_total
  FROM public.employee_documents
  WHERE organization_id = p_org_id;
  
  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sum_org_document_size(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sum_org_document_size(UUID) TO service_role;
