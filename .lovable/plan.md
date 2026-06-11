# Módulo OCR e Pesquisa Full Text — GED

Objetivo: extrair texto de documentos enviados ao GED, indexar e permitir busca textual com destaque de trechos e navegação até a página. Sem IA nesta fase, mas com arquitetura preparada.

## Fluxo

```text
Upload → Enfileira OCR → Edge Function processa → Extrai texto (Tesseract/OCRmyPDF)
       → Salva texto por documento e por página → Indexa (tsvector + GIN)
       → Pesquisa Full Text com filtros e ACL → Destaque + navegação por página
```

## 1. Banco de Dados

Novas tabelas (em `public`, com GRANTs e RLS por `organization_id` herdado de `ged_documents`):

- **documento_ocr**
  - `ocr_id` UUID PK
  - `documento_id` UUID FK → `ged_documents.id` (cascade)
  - `versao_id` UUID FK → `ged_document_versions.id` (nullable)
  - `organization_id` UUID (denormalizado p/ RLS rápida)
  - `texto_extraido` TEXT
  - `texto_tsv` tsvector (gerado, `portuguese`) — índice GIN
  - `total_paginas` INTEGER
  - `status` ENUM `ocr_status` (`pendente`,`processando`,`processado`,`erro`)
  - `tentativas` INTEGER default 0
  - `data_processamento` TIMESTAMPTZ
  - `tempo_processamento_ms` INTEGER
  - `erro_processamento` TEXT
  - `idioma` TEXT default `por` (preparado p/ `eng`, `spa`)
  - `created_at`, `updated_at`

- **documento_ocr_pagina**
  - `ocr_pagina_id` UUID PK
  - `ocr_id` UUID FK (cascade)
  - `documento_id` UUID (denormalizado p/ join rápido na busca)
  - `organization_id` UUID
  - `numero_pagina` INTEGER
  - `texto_pagina` TEXT
  - `texto_tsv` tsvector gerado — índice GIN
  - UNIQUE (`ocr_id`,`numero_pagina`)

- **documento_ocr_fila** (fila de processamento)
  - `id` UUID PK
  - `documento_id`, `versao_id`, `organization_id`
  - `status` (`pendente`,`processando`,`processado`,`erro`)
  - `prioridade` INTEGER
  - `agendado_para` TIMESTAMPTZ
  - `iniciado_em`, `finalizado_em`
  - `worker_id` TEXT
  - `tentativas` INTEGER

- **documento_ocr_auditoria**
  - `id`, `organization_id`, `user_id`, `documento_id`
  - `acao` (`ocr_executado`,`pesquisa`,`resultado_aberto`,`pagina_visualizada`)
  - `payload` JSONB (termo, filtros, página, etc.)
  - `created_at`

Índices:
- GIN em `texto_tsv` (ambas tabelas)
- B-tree em `documento_id`, `organization_id`, `status`

RLS: `SELECT` permitido quando o usuário tem permissão de visualização no `ged_documents` correspondente (reaproveitar `has_permission` + escopos de pasta / nível de sigilo já existentes). `INSERT/UPDATE` somente via `service_role` (edge function).

## 2. Pipeline OCR (Edge Function)

Edge Function `process-document-ocr`:
- Disparada após upload concluído (chamada do client/`useGED` após `createDocument`) e por job agendado (`pg_cron` a cada minuto puxando `documento_ocr_fila` pendente).
- Baixa o arquivo do bucket `ged_files`.
- Decide pipeline pelo mime:
  - **PDF nativo com texto**: extrai texto direto (`pdf-parse`/`unpdf`).
  - **PDF escaneado / imagem (PNG/JPG/JPEG/TIFF)**: usa Tesseract via WASM (`tesseract.js` em Deno) com `lang=por`. Para PDFs escaneados, renderiza páginas (pdfium WASM) e OCR por página.
  - **DOCX**: extrai texto com `mammoth`/`docx` (sem OCR).
- Persiste `documento_ocr` + N linhas em `documento_ocr_pagina`.
- Atualiza fila e marca status. Em erro, incrementa `tentativas` (retry até 3, backoff).

Observação técnica: como Edge Functions Deno têm limites, OCRmyPDF/Tesseract binário não roda nativo — usamos `tesseract.js` WASM. A descrição do usuário cita "Tesseract/OCRmyPDF" como tecnologia; mantemos Tesseract (via WASM) e deixamos hook para futura migração para worker externo (ex.: container) sem mudar contrato da fila.

## 3. Pesquisa Full Text

RPC `search_documents_fts(p_query, p_filters jsonb, p_limit, p_offset)`:
- Converte query do usuário em `websearch_to_tsquery('portuguese', ...)` (suporta frases entre aspas, operadores).
- Pesquisa em `documento_ocr_pagina.texto_tsv` para obter `documento_id` + `numero_pagina` + `ts_headline` (trecho com destaque `<mark>...</mark>`).
- Aplica filtros: departamento, setor, pasta, tipo, classificação, datas, status, nível de sigilo.
- Aplica ACL respeitando as policies já existentes do GED (a função roda como `SECURITY INVOKER` em cima de views que reutilizam RLS, ou faz `JOIN` com `has_permission`/escopos).
- Ordena por `ts_rank_cd` + data.
- Retorna: documento (metadados), versão, página, trecho destacado, score.
- Paginação server-side.

Normalização de CPF/CNPJ/valores: pre-processar query no client — se a string casar com regex de CPF/CNPJ, gerar variantes com/sem máscara e combiná-las com `OR` no tsquery. Mesmo para valores monetários (`R$ 1.234,56` ↔ `1234.56`).

## 4. Frontend

### Página `Pesquisa Avançada` (`/dashboard/search`)
- Formulário de filtros: texto livre + departamento, setor, pasta, tipo documento, classificação, intervalo de datas, status, nível de sigilo.
- Tabela de resultados (usando padrões existentes `TablePagination`, `useTableSort`, `usePagination`):
  - Documento, Versão, Tipo, Classificação, Pasta, Página, Trecho (com `<mark>` destacado), Data.
  - Clique no resultado → abre o visualizador na página correta.
- Estado dos filtros em querystring (compartilhável).

### Visualizador de Documento
- Painel lateral "Ocorrências" listando páginas + trechos do termo pesquisado (passado via state/URL).
- Clique em ocorrência → scroll/jump para a página.
- Destaque visual amarelo (`<mark>`).

### Indicadores de OCR no card do documento
- Badge "OCR pendente / processando / processado / erro" na listagem.
- Botão "Reprocessar OCR" (admin) em caso de erro.

### Dashboard OCR (`/dashboard/ocr-dashboard`, admin)
- Métricas: Documentos processados, pendentes, erros, total de páginas OCR, tempo médio.
- Lista das últimas execuções e erros recentes (link para reprocessar).

## 5. Auditoria

Inserir em `documento_ocr_auditoria`:
- Processamento OCR concluído/erro (edge function).
- Pesquisa executada (RPC registra termo + filtros, sem PII além do já permitido).
- Resultado aberto e página visualizada (client → tabela via RPC dedicada).

## 6. Segurança / ACL

- Toda RPC de busca e de leitura de OCR aplica as mesmas regras do GED (departamento, setor, pasta, nível de sigilo, restritos, `has_permission('visualizar_documento')`).
- Bucket `ged_files` continua privado; OCR não expõe arquivos novos.
- Edge function valida JWT do solicitante para ações sob demanda (reprocessar).

## 7. Performance

- `tsvector` materializado em coluna gerada + GIN.
- Paginação no servidor com `LIMIT/OFFSET` e count separado (cache curto via React Query).
- `ts_headline` apenas nas linhas da página retornada.
- `pg_cron` puxa fila em lotes pequenos para não saturar.

## 8. Preparação para futuro

- Coluna `idioma` e parâmetro `language` em todas as RPCs (default `portuguese`).
- Tabela `documento_ocr` com campos JSONB livres (`metadata`) prevista para futura classificação automática / embeddings.
- Contrato da fila desacoplado do worker (permite migrar para serviço externo OCRmyPDF/Tesseract nativo sem mudar schema).
- Estrutura de busca pronta para evoluir para Elasticsearch/pgvector mantendo a mesma API de RPC.

## Entregáveis

1. Migração: enums, 4 tabelas, índices GIN, RLS, RPC `search_documents_fts`, RPC `enqueue_ocr`, RPC `reprocess_ocr`, RPC `ocr_dashboard_stats`.
2. Edge function `process-document-ocr` (com pipelines PDF texto / PDF escaneado / imagem / DOCX) + cron job.
3. Hook `useDocumentSearch` + página `Pesquisa Avançada`.
4. Painel lateral de ocorrências no visualizador atual de documentos.
5. Badges de status OCR + ação "Reprocessar".
6. Página `Dashboard OCR` (admin).
7. Registros de auditoria nas ações acima.

## Pontos a confirmar

1. **OCR de PDFs escaneados/TIFF em Edge Function**: usaremos Tesseract via WASM (limitação de runtime Deno). Documentos muito grandes podem exceder limites — ok manter assim agora e migrar p/ worker externo depois? 
2. **Disparo do OCR**: enfileirar automaticamente em todo upload, ou somente quando o tipo de documento estiver marcado como "indexável"?
3. **Idioma**: fixar `por` por enquanto, com campo já preparado para `eng`/`spa` futuramente — ok?
