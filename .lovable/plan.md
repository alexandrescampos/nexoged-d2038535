# Módulo de Gestão de Versões de Documentos

Este é um módulo grande. Vou entregá-lo em **4 fases sequenciais** para garantir qualidade e permitir validação intermediária.

## Visão geral

O projeto já possui a tabela `ged_document_versions` (10 colunas) usada apenas como "arquivos versionados". Vamos **estender** esse modelo para um sistema completo de versões com numeração semântica (1.0, 1.1, 2.0), status, aprovação, comparação, restauração e auditoria — sem quebrar a estrutura atual.

---

## Fase 1 — Backend / Banco de dados

### 1.1 Estender `ged_documents`
Adicionar colunas:
- `current_version_id UUID` (FK → ged_document_versions)
- `latest_version_number TEXT` (ex: "2.1")
- `latest_version_at TIMESTAMPTZ`

### 1.2 Estender `ged_document_versions`
Adicionar colunas (mantendo `version_number INT` legado):
- `version_label TEXT NOT NULL DEFAULT '1.0'` (ex: "1.0", "1.1", "2.0")
- `version_major INT NOT NULL DEFAULT 1`
- `version_minor INT NOT NULL DEFAULT 0`
- `title TEXT`
- `change_description TEXT NOT NULL` (observação obrigatória)
- `status TEXT NOT NULL DEFAULT 'RASCUNHO'` — enum: RASCUNHO, EM_REVISAO, APROVADA, ASSINADA, ARQUIVADA, CANCELADA
- `approved_by UUID`, `approved_at TIMESTAMPTZ`
- `based_on_version_id UUID` (para rastrear restaurações)
- `is_restoration BOOLEAN DEFAULT false`

Criar **enum** `ged_version_status` e **tipo** `ged_permission` adicionando: `visualizar_versoes`, `criar_versoes`, `restaurar_versoes`, `comparar_versoes`, `baixar_versoes`, `cancelar_versoes`.

### 1.3 Função RPC `create_document_version`
Parâmetros: `p_document_id`, `p_bump_type` ('minor' | 'major'), `p_change_description`, `p_file_path`, `p_file_name`, `p_file_size`, `p_mime_type`, `p_title`.

Lógica:
- Validar permissão (`criar_versoes`)
- Validar `change_description` não vazia
- Calcular próximo número: minor → (major, minor+1); major → (major+1, 0)
- Inserir em `ged_document_versions`
- Atualizar `ged_documents.current_version_id`, `latest_version_number`, `latest_version_at`
- Registrar em `ged_audit_log` (ação: `version_created`)
- Disparar enfileiramento OCR via `enqueue_document_ocr`
- Retornar a nova versão

### 1.4 Função RPC `restore_document_version`
- Cria nova versão (minor bump) copiando arquivo da versão antiga
- `is_restoration = true`, `based_on_version_id = <antiga>`
- `change_description` = "Restauração da versão X.Y"
- Registra auditoria `version_restored`

### 1.5 Função RPC `cancel_document_version`
- Atualiza `status = 'CANCELADA'` (nunca delete físico)
- Bloqueia se versão for `ASSINADA`
- Audit `version_cancelled`

### 1.6 Trigger de imutabilidade
Trigger em `ged_document_versions`: se `OLD.status = 'ASSINADA'`, bloquear UPDATE/DELETE (exceto super_admin).

### 1.7 RLS
Manter políticas existentes; adicionar política para ler todas as versões respeitando acesso ao documento pai.

---

## Fase 2 — Repositório e hooks (frontend)

- `src/repository/documentVersionRepository.ts` — `listVersions`, `createVersion`, `restoreVersion`, `cancelVersion`, `approveVersion`, `getVersionDownloadUrl`, `compareVersions`.
- `src/hooks/useDocumentVersions.ts` — React Query hook (list + mutations + invalidations).
- Estender `useDocumentPermissions` para incluir as 6 novas permissões.

---

## Fase 3 — Interface

### 3.1 Tabs do documento
Refatorar o dialog de detalhes de documento para abas:
```
Documento
├─ Informações
├─ Arquivos
├─ Histórico de Versões  ← NOVO
├─ OCR
├─ Assinaturas (placeholder)
├─ Auditoria
```

### 3.2 Aba "Histórico de Versões"
Componente `DocumentVersionsTab.tsx`:
- Badge "Versão Atual: 2.1" no topo
- Tabela: Versão | Status | Usuário | Data | Observação | Tamanho | Ações (download, restaurar, cancelar, comparar)
- Botão "Nova Versão" → dialog `NewVersionDialog`
- Botão "Comparar Versões" → dialog `CompareVersionsDialog`

### 3.3 Dialog "Nova Versão"
- Radio: **Nova revisão** (minor) / **Nova versão principal** (major)
- Upload de arquivo (PDF/DOCX/TXT)
- Textarea **observação obrigatória** (validação Zod)
- Preview da próxima numeração

### 3.4 Dialog "Comparar Versões"
- Dois selects: Versão Origem / Destino
- Para arquivos textuais (TXT, OCR do PDF/DOCX): diff linha-a-linha com `diff` lib — destaque verde (incluído), vermelho (removido), amarelo (alterado)
- Para PDFs sem OCR: comparar texto extraído via `documento_ocr_pagina`

### 3.5 Permissões
Esconder botões via `PermissionGate` conforme as 6 novas permissões.

---

## Fase 4 — Dashboard e auditoria

### 4.1 Indicadores
Adicionar à RPC `dashboard_indicators`:
- `docs_with_multiple_versions`
- `versions_created_in_period`
- `versions_approved`
- `versions_signed`
- `versions_cancelled`

Renderizar 4 cards novos em `src/pages/dashboard/Dashboard.tsx`.

### 4.2 Auditoria
Toda mudança de versão grava em `ged_audit_log` (action: version_created, version_restored, version_cancelled, version_approved, version_downloaded, version_viewed, version_compared).

---

## Detalhes técnicos

**Lib de diff:** `diff` (npm) — leve, sem dependências pesadas.
**OCR:** chamar `enqueue_document_ocr(documento_id, versao_id)` que já existe — cada versão gera seu próprio índice.
**Storage:** arquivos continuam em `ged_files` bucket. Cada versão tem seu próprio `file_path` — nunca sobrescrever.
**Numeração:** calculada no servidor (RPC) com lock por `document_id` para evitar race.
**Permissões novas:** adicionadas ao enum `ged_permission` e ao seed inicial de `permissao`.

---

## Entrega

Devido ao tamanho, sugiro:
- **Esta resposta (após aprovação):** executo **Fase 1 + Fase 2** (banco, RPCs, repositório, hooks).
- **Próxima:** Fase 3 (UI completa com abas, dialogs, comparação).
- **Próxima:** Fase 4 (dashboard, indicadores, ajustes finais).

Posso ajustar essa divisão se preferir tudo de uma vez (será uma resposta muito grande) ou em mais fases menores.

Aprovar este plano para começar pela **Fase 1 + 2**?
