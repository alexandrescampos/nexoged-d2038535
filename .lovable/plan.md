
## Objetivo

Evitar bloqueios indevidos na fila de OCR quando o MIME type informado pelo upload diverge do real (ex.: Excel enviado como `application/octet-stream`, `.xls` legado, variações de imagem como `image/jpg`, `image/x-png`, HEIC, etc.). A whitelist passará a operar sobre uma "família canônica" do arquivo, derivada de MIME + extensão + assinatura binária (magic bytes), em vez de comparar a string crua.

## Mudanças

### 1. `supabase/functions/process-document-ocr/index.ts`

Substituir as funções `inferMime()` e o trecho de validação da whitelist por um pipeline em 3 camadas:

**Camada A — Tabela canônica única**
Criar `MIME_REGISTRY`: um array de entradas `{ canonical, aliases[], extensions[], family }`, onde:
- `canonical`: o MIME oficial (ex.: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)
- `aliases`: variações comuns (`application/vnd.ms-excel.sheet.macroEnabled.12`, `application/x-excel`, `image/jpg`, `image/x-png`, `image/pjpeg`, `application/x-pdf`, etc.)
- `extensions`: `["xlsx","xlsm"]`, `["jpg","jpeg","jpe","jfif"]`, etc.
- `family`: `pdf | docx | spreadsheet | text | csv | image`

**Camada B — `resolveFileType(fname, mimeRaw, buffer)`**
Retorna `{ canonicalMime, family, ext, source: 'mime'|'extension'|'magic'|'fallback' }`. Ordem de resolução:
1. MIME informado (normalizado lowercase/trim) bate com algum `canonical` ou `aliases`.
2. Extensão do nome do arquivo bate com algum `extensions`.
3. Assinatura binária dos primeiros bytes (magic numbers): `%PDF`, `PK\x03\x04` (zip → DOCX/XLSX, refina pelo nome interno), `\xFF\xD8\xFF` (JPEG), `\x89PNG`, `GIF8`, `BM` (BMP), `II*\x00`/`MM\x00*` (TIFF), `RIFF...WEBP`.
4. Fallback: retorna o MIME bruto + `family: 'unknown'`.

**Camada C — Validação contra whitelist**
A whitelist em `system_settings` continua armazenando MIMEs canônicos. Antes de bloquear, comparar:
- `canonicalMime` ∈ whitelist, **ou**
- qualquer alias de `canonicalMime` ∈ whitelist (compatibilidade retroativa).

Mensagem de erro passa a incluir `mimeRaw`, `canonicalMime`, `ext` e `source`, facilitando diagnóstico.

**Dispatcher**
O `if/else` que escolhe o extrator passa a usar `family` em vez de comparar strings de MIME:
- `pdf` → `extractPdfPages`
- `docx` → `extractDocx`
- `spreadsheet` → `extractXlsx`
- `csv` / `text` → `extractText`
- `image` → `extractImageWithOCR` (passando `canonicalMime`)
- `unknown` → erro explícito

### 2. `supabase/functions/process-document-ocr/mime-registry.ts` (novo)

Isolar o `MIME_REGISTRY` e as funções `resolveFileType`, `sniffMagic`, `normalizeMime` em um módulo só, para manter `index.ts` legível e permitir testes futuros.

### 3. Whitelist padrão em `system_settings`

Sem migração obrigatória: a whitelist atual já contém os MIMEs canônicos. Apenas garantir que o `DEFAULT_ALLOWED_MIMES` da função reflita exatamente os canônicos do registry (sem aliases). Aliases ficam implícitos via `resolveFileType`.

### 4. `src/pages/super-admin/Settings.tsx`

Pequena melhoria de UX (opcional, dentro do escopo):
- Mostrar abaixo de cada checkbox os principais aliases/extensões que aquele canônico já cobre (ex.: "Excel (.xlsx) — também aceita .xlsm, octet-stream com magic bytes XLSX").
- Sem mudança de lógica de persistência.

## Diagnóstico — saída de erro enriquecida

Quando um arquivo for bloqueado, o registro em `documento_ocr.erro_processamento` e em `documento_ocr_auditoria.payload` passará a conter:

```json
{
  "mime_raw": "application/octet-stream",
  "mime_canonical": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "ext": "xlsx",
  "resolved_by": "magic",
  "family": "spreadsheet",
  "allowed": false
}
```

Isso permite, no futuro, um painel de "tipos rejeitados" sem precisar reabrir cada arquivo.

## Fora de escopo

- Nenhuma mudança de schema de banco.
- Nenhuma mudança no fluxo de upload do GED (o tratamento ocorre no momento do OCR).
- Reprocessamento em massa de itens já marcados como erro: pode ser feito sob demanda em um passo separado depois que a função estiver no ar.

## Validação

1. Reenfileirar manualmente 1 Excel, 1 PDF, 1 DOCX, 1 JPG, 1 PNG e 1 arquivo com MIME `application/octet-stream` mas extensão `.xlsx`.
2. Conferir nos logs da edge function que `resolved_by` aparece como `mime`, `extension` ou `magic` conforme esperado.
3. Conferir que `documento_ocr.status = 'processado'` em todos os casos válidos e que a mensagem de erro do caso inválido traz o JSON enriquecido.
