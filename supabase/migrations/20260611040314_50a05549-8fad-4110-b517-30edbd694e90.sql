
-- Re-enfileira documentos que falharam ou são imagens
INSERT INTO public.documento_ocr_fila (documento_id, versao_id, organization_id, prioridade, status, agendado_para)
SELECT o.documento_id, o.versao_id, o.organization_id, 5, 'pendente', now()
FROM public.documento_ocr o
WHERE o.status = 'erro'
   OR o.texto_extraido LIKE '%Indexação de imagem%'
   OR o.texto_extraido LIKE '%não suportado%';
