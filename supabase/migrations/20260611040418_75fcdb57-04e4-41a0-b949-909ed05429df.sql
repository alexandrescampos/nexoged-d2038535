
INSERT INTO public.documento_ocr_fila (documento_id, versao_id, organization_id, prioridade, status, agendado_para)
SELECT DISTINCT d.id, NULL::uuid, d.organization_id, 1, 'pendente'::ocr_status, now()
FROM public.ged_documents d
JOIN public.ged_document_versions v ON v.document_id = d.id
WHERE v.mime_type LIKE 'image/%';
