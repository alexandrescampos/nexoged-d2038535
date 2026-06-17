# Fase 3 — Execução de Fluxos (Aprovações e Assinaturas)

Objetivo: tornar as políticas e fluxos da Fase 2 **operacionais** — usuários conseguem submeter, aprovar/rejeitar e assinar documentos diretamente do GED, com as RPCs já existentes do banco.

## Entregas

### 1. Repository de execução (`policyExecutionRepository.ts`)
Wrappers tipados para as RPCs já criadas no banco:
- `applyDocumentTypePolicy(documentId)` → instancia etapas de aprovação e signatários conforme o tipo do documento.
- `submitForApproval(documentId)` → muda status para `AGUARDANDO_APROVACAO`.
- `approveStep(approvalId, comentario?)` / `rejectStep(approvalId, motivo)`.
- `signDocument(signatureId, evidencia)` → grava assinatura + carimbo de tempo.
- `archiveDocument(documentId)`.
- `listApprovals(documentId)` / `listSignatures(documentId)` com join no perfil/usuário responsável.

### 2. Hook `useDocumentWorkflow(documentId)`
- Queries: `approvals`, `signatures`, `currentApprovalStep`, `currentSignerSlot`.
- Mutations com `toast` e invalidação de `["ged-documents"]` + workflow queries.
- Helpers: `canCurrentUserApprove`, `canCurrentUserSign`, `nextActionLabel`.

### 3. Dialog de Detalhes do Documento (`DocumentDetailDialog.tsx`)
Novo componente acionado ao clicar em um documento na listagem. Estrutura com tabs:
- **Visão Geral** — metadados, tipo, pasta, tags, status, botão "Submeter para aprovação".
- **Aprovações** — timeline das etapas (`documento_aprovacao` ordenadas), badge de status, comentário, botões **Aprovar** / **Rejeitar** visíveis somente ao perfil responsável da etapa atual.
- **Assinaturas** — lista ordenada de signatários (`documento_assinatura`), badge (Pendente/Assinado), botão **Assinar** que abre `SignatureCaptureModal` exigindo evidência conforme `tipo_assinatura` (senha / Gov.br / certificado ICP — mock para SIMPLES, placeholders para AVANCADA/QUALIFICADA).
- **Histórico** — usa `ged_audit_log` já existente.

### 4. Integração na listagem (`Documents.tsx`)
- Linha/cartão do documento abre `DocumentDetailDialog`.
- Filtros de status já existem; adicionar **chips rápidos** para `AGUARDANDO_APROVACAO` e `AGUARDANDO_ASSINATURA`.
- Badge na coluna Status com cores: amarelo (aguardando aprovação), azul (aguardando assinatura), verde (assinado/arquivado), vermelho (rejeitado).

### 5. Criação de documento com política aplicada
- `useGED.uploadDocument` passa a chamar `create_document_with_policy` (RPC já existente) quando o tipo possui política/fluxo, garantindo que as instâncias `documento_aprovacao` e `documento_assinatura` sejam criadas no upload.

## Fora do escopo (vai para Fase 4)
- Dashboard com cards "Minhas Aprovações" / "Minhas Assinaturas".
- Página `WorkflowReport` consolidada com export.
- Itens de menu na sidebar para pendências do usuário.
- Notificações por e-mail.

## Detalhes técnicos
- Todas as ações server-side via RPCs `SECURITY DEFINER` já existentes — sem novas migrations.
- Tipos `Aprovacao` e `Assinatura` adicionados em `policyFlowRepository.ts` (ou novo `policyExecutionRepository.ts`).
- `SignatureCaptureModal` valida `tipo_assinatura`:
  - `SIMPLES`: confirmação por senha do usuário logado.
  - `AVANCADA`: token Gov.br (campo texto, validação placeholder).
  - `QUALIFICADA`: upload de certificado .pfx (placeholder até integração ICP).
- Reuso de `useAuth().profile.id` para checar `perfil_responsavel_id` / `perfil_assinante_id`.

## Próxima fase (Fase 4 — resumo)
Dashboard de pendências do usuário + relatório consolidado de workflows + notificações. É a **última fase planejada** do módulo de fluxos.
