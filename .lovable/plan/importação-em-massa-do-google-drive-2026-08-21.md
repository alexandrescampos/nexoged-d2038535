# Importação em massa do Google Drive

Hoje o seletor do Google Drive só permite baixar um arquivo por vez, clicando no ícone de download de cada linha. A proposta é permitir seleção múltipla e importação de uma pasta inteira.

## O que muda para o usuário

1. **Checkbox em cada arquivo** da lista, mais um checkbox "Selecionar todos" no cabeçalho (seleciona todos os arquivos visíveis da pasta/busca atual, ignorando subpastas).
2. **Checkbox também nas pastas**: marcar uma pasta importa todos os arquivos dela (opcionalmente incluindo subpastas, via um switch "Incluir subpastas").
3. **Botão "Importar selecionados (N)"** no rodapé, com barra de progresso ("Baixando 3 de 12...") e resumo de erros ao final.
4. Clicar na pasta continua navegando; o download individual continua disponível.
5. Um limite de segurança (ex.: 100 arquivos por importação) com aviso quando excedido.

## Detalhes técnicos

**Edge function `google-drive-integration`** — adicionar action `folder-files`:
- Parâmetros: `folderId`, `recursive` (bool), `maxFiles`.
- Lista os arquivos da pasta reutilizando `fetchAllPages`; quando `recursive=true`, percorre subpastas em fila (BFS) com limite de profundidade e de total de arquivos.
- Retorna `{ files: [...], truncated: boolean }`, filtrando pastas do resultado.
- Deploy da função após a alteração.

**`GoogleDrivePicker.tsx`**:
- Estado `selectedIds: Set<string>` e `includeSubfolders: boolean`, limpos ao trocar de pasta ou fazer nova busca.
- Extrair a lógica de download atual (`downloadFile`) para uma função que retorna o `File` em vez de chamar `onFileSelect` direto, permitindo reuso.
- `handleImportSelected`: expande as pastas selecionadas via a nova action, junta com os arquivos marcados, deduplica por id, baixa sequencialmente (concorrência 3) atualizando progresso, e no final chama `onFileSelect(files)` uma única vez com o lote completo.
- Erros por arquivo não abortam o lote: contabiliza e mostra toast com o total de falhas.

**`MultiFileUploader.tsx`**: já recebe `File[]` no `onFileSelect` e faz append à lista — nenhuma mudança necessária além de validar que o lote grande é aceito.
