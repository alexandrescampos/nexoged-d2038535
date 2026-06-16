# Módulo: Políticas de Assinatura e Workflow por Tipo de Documento

Módulo corporativo grande. Proponho **4 fases sequenciais** para garantir qualidade e permitir validação intermediária. Cada fase é autossuficiente e o sistema continua funcional ao final de cada uma.

---

## Visão geral

O Tipo de Documento passa a ser o "controlador" do comportamento documental. Ao criar um documento, herdamos automaticamente:

```text
Tipo Documento
   ├─ Política de Assinatura  → tipo, qtd mínima, ordem, carimbo, certificado
   ├─ Fluxo de Aprovação      → etapas (Elaborador → Jurídico → Diretoria …)
   ├─ Fluxo de Assinatura     → assinantes ordenados (Diretor → Cliente …)
   ├─ Nível de Sigilo padrão
   ├─ OCR obrigatório
   ├─ PDF/A obrigatório
   └─ Dias de retenção
```

O status do documento avança por essa máquina:

```text
RASCUNHO → EM_REVISAO → AGUARDANDO_APROVACAO → APROVADO
        → AGUARDANDO_ASSINATURA → ASSINADO → ARQUIVADO
                                                (ou CANCELADO em qualquer ponto)
```

---

## Fase 1 — Banco de dados e políticas

### 1.1 Estender `ged_document_types`
Adicionar colunas:
- `politica_assinatura_id UUID` (FK)
- `fluxo_aprovacao_id UUID` (FK)
- `nivel_sigilo_padrao ged_sigilo` (default `INTERNO`)
- `ocr_obrigatorio BOOLEAN DEFAULT false`
- `pdfa_obrigatorio BOOLEAN DEFAULT false`
- `dias_retencao INT`
- `ativo BOOLEAN DEFAULT true`

### 1.2 Nova tabela `politica_assinatura`
Campos: `id`, `organization_id`, `nome`, `descricao`, `assinatura_obrigatoria`, `tipo_assinatura` (enum NENHUMA / SIMPLES / AVANCADA / QUALIFICADA), `quantidade_minima_assinaturas`, `permite_coassinatura`, `ordem_assinatura`, `carimbo_tempo`, `certificado_obrigatorio`, `ativo`.

### 1.3 Fluxo de Aprovação
- `fluxo_aprovacao` (id, organization_id, nome, descricao, ativo)
- `fluxo_aprovacao_etapa` (id, fluxo_id, ordem, nome_etapa, perfil_responsavel_id, aprovacao_obrigatoria)

### 1.4 Fluxo de Assinatura por Tipo
- `fluxo_assinatura` (id, tipo_documento_id, ordem, perfil_assinante_id, assinatura_obrigatoria, tipo_assinatura)

### 1.5 Instâncias por documento
- `documento_aprovacao` (id, documento_id, fluxo_id, etapa_id, ordem, status, aprovador_id, decidido_em, comentario)
- `documento_assinatura` (id, documento_id, ordem, perfil_assinante_id, assinante_id, tipo_assinatura, status, assinado_em, hash, certificado_info)

### 1.6 Status do documento
Adicionar valores ao enum/status de `ged_documents`: `AGUARDANDO_APROVACAO`, `APROVADO`, `AGUARDANDO_ASSINATURA`, `ASSINADO`, `ARQUIVADO`. (Mantém RASCUNHO, EM_REVISAO, CANCELADO já existentes.)

### 1.7 RPCs (toda lógica server-side)
- `create_document_with_policy(...)` — herda política/sigilo/OCR do tipo e instancia aprovações + assinaturas.
- `submit_for_approval(doc_id)` — gera as etapas em `documento_aprovacao`.
- `approve_step(etapa_id, comentario)` / `reject_step(...)` — avança ou bloqueia o fluxo.
- `sign_document(doc_id, tipo, evidencia)` — valida que `tipo_assinatura` cumpre o exigido pela política (QUALIFICADA exige ICP-Brasil; AVANCADA permite Gov.br/MFA/OTP; SIMPLES permite login).
- `archive_document(doc_id)` — bloqueia se assinatura obrigatória não cumprida.

### 1.8 RLS e GRANTs
RLS por `organization_id` em todas as novas tabelas; GRANT a `authenticated` e `service_role`.

### 1.9 Auditoria
Cada RPC grava em `ged_audit_log` com ações: `type_policy_changed`, `approval_submitted`, `approval_approved`, `approval_rejected`, `document_signed`, `document_archived`, `document_cancelled`.

---

## Fase 2 — Tela administrativa (cadastro de Tipos e Políticas)

Em `Administração → Tipos de Documento`:

1. **Aba Política de Assinatura** — selecionar política existente ou criar nova (form com todos os campos da seção 1.2). Preview textual: "Documentos deste tipo exigirão 2 assinaturas QUALIFICADAS com certificado ICP-Brasil obrigatório."
2. **Aba Fluxo de Aprovação** — seleciona fluxo + visualiza etapas; permite criar fluxo novo com editor de etapas (drag-and-drop de ordem).
3. **Aba Fluxo de Assinatura** — editor de assinantes por ordem (perfil + obrigatório).
4. **Aba Configurações Documentais** — toggles para OCR, PDF/A, sigilo padrão, dias de retenção.

Páginas novas:
- `src/pages/dashboard/SignaturePolicies.tsx`
- `src/pages/dashboard/ApprovalFlows.tsx`
- Refatorar `DocumentTypesSettings.tsx` em abas.

---

## Fase 3 — Execução do fluxo no documento

1. **Criação de documento** chama `create_document_with_policy` — usuário não precisa configurar nada, herda tudo do tipo.
2. **Aba "Aprovações"** no diálogo de documento — lista etapas, botões Aprovar/Reprovar (visíveis para o perfil responsável da etapa atual).
3. **Aba "Assinaturas"** no diálogo de documento — lista assinantes, botão "Assinar" abre modal pedindo o tipo de evidência exigido pela política:
   - QUALIFICADA → upload do certificado A1/A3 ou integração ICP-Brasil
   - AVANCADA → Gov.br / código MFA / OTP
   - SIMPLES → confirmar senha
4. **Botão "Arquivar"** habilitado apenas quando todos os requisitos forem cumpridos.
5. **Badges de status** atualizados em toda a listagem de documentos.

---

## Fase 4 — Dashboard e relatórios

Estender `dashboard_indicators`:
- `docs_by_type` (gráfico)
- `docs_pending_approval`
- `docs_pending_signature`
- `docs_signed`
- `flows_in_progress`

Adicionar 5 cards em `Dashboard.tsx` + gráfico de "Documentos por Tipo".

Relatório dedicado em `src/pages/dashboard/WorkflowReport.tsx` com filtros (tipo, status, período, responsável).

---

## Detalhes técnicos

- **Enum `tipo_assinatura`**: `NENHUMA | SIMPLES | AVANCADA | QUALIFICADA`. Validação server-side em `sign_document`.
- **Imutabilidade**: documentos com status `ASSINADO` ou `ARQUIVADO` são protegidos por trigger (similar ao `protect_signed_versions` existente).
- **Reaproveitamento**: o módulo de versões já implementado fica integrado — toda assinatura é vinculada à versão atual (`current_version_id`), garantindo que a evidência aponte para o arquivo exato.
- **Permissões novas** (adicionar ao enum `ged_permission`): `gerenciar_politicas`, `gerenciar_fluxos`, `aprovar_etapa`, `assinar_documento_qualificado`.
- **ICP-Brasil / Gov.br**: nesta entrega ficam como *placeholders* — o RPC valida o `tipo_assinatura` e armazena a evidência, mas a integração com provedores externos (ITI, Gov.br OAuth) é tratada em iteração futura.

---

## Entrega

Sugestão de divisão:

| Resposta | Conteúdo |
|---|---|
| Após este plano | Fase 1 (banco + RPCs + RLS) |
| Próxima | Fase 2 (telas administrativas) |
| Próxima | Fase 3 (execução do fluxo no documento) |
| Próxima | Fase 4 (dashboard e relatórios) |

Posso ajustar (entregar tudo de uma vez = resposta muito grande, ou em fases menores). 

**Aprovar este plano para começar pela Fase 1?**
