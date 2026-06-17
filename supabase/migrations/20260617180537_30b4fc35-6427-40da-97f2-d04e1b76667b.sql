
-- Backfill: garantir version_label/major/minor em versões antigas
UPDATE public.ged_document_versions
SET version_major = COALESCE(version_major, version_number),
    version_minor = COALESCE(version_minor, 0),
    version_label = COALESCE(version_label, version_number || '.0'),
    change_description = COALESCE(NULLIF(change_description,''), 'Versão inicial'),
    status = COALESCE(status, 'APROVADA')
WHERE version_label IS NULL OR version_major IS NULL;

-- Backfill: setar current_version_id no documento com a versão mais recente não cancelada
WITH latest AS (
  SELECT DISTINCT ON (document_id) document_id, id, version_label, created_at
  FROM public.ged_document_versions
  WHERE status <> 'CANCELADA'
  ORDER BY document_id, version_number DESC, created_at DESC
)
UPDATE public.ged_documents d
SET current_version_id = l.id,
    latest_version_number = COALESCE(d.latest_version_number, l.version_label),
    latest_version_at = COALESCE(d.latest_version_at, l.created_at)
FROM latest l
WHERE d.id = l.document_id AND d.current_version_id IS NULL;

-- Backfill: assinaturas pendentes sem versao_id apontam para current_version_id do doc
UPDATE public.documento_assinatura a
SET versao_id = d.current_version_id
FROM public.ged_documents d
WHERE a.documento_id = d.id
  AND a.versao_id IS NULL
  AND a.status = 'PENDENTE'
  AND d.current_version_id IS NOT NULL;
