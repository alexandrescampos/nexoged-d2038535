-- Mesclar funções duplicadas: move associações e funcionários para a canônica e desativa duplicadas
CREATE OR REPLACE FUNCTION public.merge_job_functions(
  _canonical_id uuid,
  _duplicate_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  _canonical_org uuid;
  _canonical_sector uuid;
  _moved_associations int := 0;
  _moved_employees int := 0;
  _deleted_associations int := 0;
  _disabled_functions int := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'org_admin')) THEN
    RAISE EXCEPTION 'Permissao negada';
  END IF;

  SELECT organization_id, sector_id INTO _canonical_org, _canonical_sector
  FROM job_functions WHERE id = _canonical_id;

  IF _canonical_org IS NULL THEN
    RAISE EXCEPTION 'Funcao canonica nao encontrada';
  END IF;

  IF NOT has_role(auth.uid(), 'super_admin') THEN
    IF _canonical_org <> get_user_org_id(auth.uid()) THEN
      RAISE EXCEPTION 'Funcao canonica fora da sua organizacao';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM job_functions
    WHERE id = ANY(_duplicate_ids)
      AND organization_id <> _canonical_org
  ) THEN
    RAISE EXCEPTION 'Duplicatas pertencem a outra organizacao';
  END IF;

  -- Mover funcionarios
  UPDATE employees
  SET job_function_id = _canonical_id, updated_at = now()
  WHERE job_function_id = ANY(_duplicate_ids);
  GET DIAGNOSTICS _moved_employees = ROW_COUNT;

  -- Mover associacoes que nao colidem com canonica
  WITH moved AS (
    UPDATE sector_function_epis sfe
    SET job_function_id = _canonical_id, updated_at = now()
    WHERE sfe.job_function_id = ANY(_duplicate_ids)
      AND NOT EXISTS (
        SELECT 1 FROM sector_function_epis c
        WHERE c.job_function_id = _canonical_id
          AND c.epi_id = sfe.epi_id
          AND c.sector_id = sfe.sector_id
      )
    RETURNING 1
  )
  SELECT count(*) INTO _moved_associations FROM moved;

  -- Apagar associacoes restantes (colisoes - canonica ja tem)
  WITH deleted AS (
    DELETE FROM sector_function_epis
    WHERE job_function_id = ANY(_duplicate_ids)
    RETURNING 1
  )
  SELECT count(*) INTO _deleted_associations FROM deleted;

  -- Desativar funcoes duplicadas
  UPDATE job_functions
  SET is_active = false, updated_at = now()
  WHERE id = ANY(_duplicate_ids);
  GET DIAGNOSTICS _disabled_functions = ROW_COUNT;

  RETURN jsonb_build_object(
    'moved_employees', _moved_employees,
    'moved_associations', _moved_associations,
    'deleted_associations', _deleted_associations,
    'disabled_functions', _disabled_functions
  );
END;
$func$;

-- Mesclar EPIs duplicados: move estoque, entregas, associacoes
CREATE OR REPLACE FUNCTION public.merge_epis(
  _canonical_id uuid,
  _duplicate_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  _canonical_org uuid;
  _moved_deliveries int := 0;
  _moved_associations int := 0;
  _deleted_associations int := 0;
  _moved_request_items int := 0;
  _disabled_epis int := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'org_admin')) THEN
    RAISE EXCEPTION 'Permissao negada';
  END IF;

  SELECT organization_id INTO _canonical_org FROM epis WHERE id = _canonical_id;
  IF _canonical_org IS NULL THEN
    RAISE EXCEPTION 'EPI canonico nao encontrado';
  END IF;

  IF NOT has_role(auth.uid(), 'super_admin') THEN
    IF _canonical_org <> get_user_org_id(auth.uid()) THEN
      RAISE EXCEPTION 'EPI canonico fora da sua organizacao';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM epis WHERE id = ANY(_duplicate_ids) AND organization_id <> _canonical_org
  ) THEN
    RAISE EXCEPTION 'Duplicatas pertencem a outra organizacao';
  END IF;

  -- Consolidar estoque por CNPJ: somar nas linhas canonicas e remover das duplicadas
  -- 1. Para cada (cnpj, duplicate_epi), se canonica ja tem linha no mesmo CNPJ, somar
  WITH merged AS (
    SELECT cnpj_d.organization_cnpj_id,
           sum(cnpj_d.stock_quantity) as add_stock,
           sum(cnpj_d.used_stock_quantity) as add_used,
           sum(cnpj_d.min_stock) as add_min
    FROM epi_cnpj_stock cnpj_d
    WHERE cnpj_d.epi_id = ANY(_duplicate_ids)
    GROUP BY cnpj_d.organization_cnpj_id
  )
  UPDATE epi_cnpj_stock c
  SET stock_quantity = c.stock_quantity + m.add_stock,
      used_stock_quantity = c.used_stock_quantity + m.add_used,
      min_stock = c.min_stock + m.add_min,
      updated_at = now()
  FROM merged m
  WHERE c.epi_id = _canonical_id
    AND c.organization_cnpj_id = m.organization_cnpj_id;

  -- 2. Mover linhas do CNPJ que canonica nao possui
  UPDATE epi_cnpj_stock cnpj_d
  SET epi_id = _canonical_id, updated_at = now()
  WHERE cnpj_d.epi_id = ANY(_duplicate_ids)
    AND NOT EXISTS (
      SELECT 1 FROM epi_cnpj_stock c
      WHERE c.epi_id = _canonical_id
        AND c.organization_cnpj_id = cnpj_d.organization_cnpj_id
    );

  -- 3. Apagar linhas duplicadas restantes
  DELETE FROM epi_cnpj_stock WHERE epi_id = ANY(_duplicate_ids);

  -- Mover entregas
  UPDATE epi_deliveries
  SET epi_id = _canonical_id, updated_at = now()
  WHERE epi_id = ANY(_duplicate_ids);
  GET DIAGNOSTICS _moved_deliveries = ROW_COUNT;

  -- Mover itens de solicitacao
  UPDATE epi_request_items
  SET epi_id = _canonical_id
  WHERE epi_id = ANY(_duplicate_ids);
  GET DIAGNOSTICS _moved_request_items = ROW_COUNT;

  -- Mover associacoes (sem colidir)
  WITH moved AS (
    UPDATE sector_function_epis sfe
    SET epi_id = _canonical_id, updated_at = now()
    WHERE sfe.epi_id = ANY(_duplicate_ids)
      AND NOT EXISTS (
        SELECT 1 FROM sector_function_epis c
        WHERE c.epi_id = _canonical_id
          AND c.sector_id = sfe.sector_id
          AND c.job_function_id = sfe.job_function_id
      )
    RETURNING 1
  )
  SELECT count(*) INTO _moved_associations FROM moved;

  WITH deleted AS (
    DELETE FROM sector_function_epis WHERE epi_id = ANY(_duplicate_ids) RETURNING 1
  )
  SELECT count(*) INTO _deleted_associations FROM deleted;

  -- Desativar EPIs duplicados
  UPDATE epis
  SET is_active = false, updated_at = now()
  WHERE id = ANY(_duplicate_ids);
  GET DIAGNOSTICS _disabled_epis = ROW_COUNT;

  RETURN jsonb_build_object(
    'moved_deliveries', _moved_deliveries,
    'moved_request_items', _moved_request_items,
    'moved_associations', _moved_associations,
    'deleted_associations', _deleted_associations,
    'disabled_epis', _disabled_epis
  );
END;
$func$;

-- Revogar execucao do publico/anon (apenas authenticated)
REVOKE EXECUTE ON FUNCTION public.merge_job_functions(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merge_epis(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_job_functions(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_epis(uuid, uuid[]) TO authenticated;