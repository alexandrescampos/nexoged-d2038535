# Refletir assinatura imediatamente após assinar

Hoje, ao assinar um documento pela ação "Assinar Digitalmente", o registro é gravado no banco, mas a lista da tela não é recarregada — só após um refresh manual o selo "Assinado" aparece. O motivo confirmado: a função que conclui a assinatura avulsa exibe o toast e fecha o modal, sem invalidar nenhuma query de documentos (a assinatura em massa já faz isso).

## O que muda

- Ao concluir a assinatura de um documento, a lista/detalhes recarregam automaticamente e o selo "Assinado" aparece na hora, sem refresh.
- O mesmo comportamento vale para as duas visões (tabela e grade) e para a contagem de assinaturas exibida no tooltip.

## Detalhes técnicos

Em `src/pages/dashboard/Documents.tsx`, dentro de `handleAdhocSignConfirm`, após o sucesso do RPC `sign_document_adhoc`:

- Invalidar as queries: `ged-documents`, `ged-documents-total`, `doc-signatures`, `my-pending-signatures`, `org-pending-signatures`, `document-versions`.
- Fechar o modal apenas depois de disparar a invalidação.

Observação sobre "status": o selo "Assinado" é derivado das assinaturas com `status = 'ASSINADA'` (já corrigido anteriormente no `gedRepository`), não do campo `status` do documento — que continua representando o ciclo do documento (rascunho/publicado/arquivado). Portanto não altero o campo `status` do documento; o indicador de assinatura passa a atualizar sozinho.
