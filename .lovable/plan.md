## Problema

Na tela do Google Drive aparecem apenas alguns arquivos/pastas. Causas no edge function `google-drive-integration`:

1. **Sem paginação** — usa `pageSize=100` e descarta `nextPageToken`. Pastas com mais de 100 itens ficam truncadas.
2. **Drives compartilhados ignorados** — faltam `supportsAllDrives=true` e `includeItemsFromAllDrives=true`. Arquivos em Drives de equipe não aparecem.
3. **Sem ordenação** — Google devolve em ordem arbitrária, dando sensação de "faltando".
4. **Sem `corpora=allDrives`** na busca — pesquisa só varre Meu Drive.

## Mudanças

### `supabase/functions/google-drive-integration/index.ts`

**Action `list`:**
- Acumular páginas em loop usando `nextPageToken` (limite de segurança: 10 páginas = 1.000 itens, para não estourar o tempo da function).
- Adicionar `pageSize=1000`, `orderBy=folder,name`, `supportsAllDrives=true`, `includeItemsFromAllDrives=true`.
- Devolver `{ files: [...] }` agregado.

**Action `search`:**
- Mesma paginação (limite menor, 3 páginas).
- Adicionar `corpora=allDrives`, `supportsAllDrives=true`, `includeItemsFromAllDrives=true`, `orderBy=folder,name`.

**Action `download`:**
- Adicionar `supportsAllDrives=true` nas chamadas de metadata e media/export para baixar de Drives compartilhados.

### Frontend
Sem mudanças — o `GoogleDrivePicker` já consome `data.files`.

## Detalhe técnico

```text
GET /files
  ?q='<folderId>' in parents and trashed=false
  &fields=nextPageToken,files(id,name,mimeType,size,iconLink)
  &pageSize=1000
  &orderBy=folder,name
  &supportsAllDrives=true
  &includeItemsFromAllDrives=true
  &pageToken=<token>   ← repetir até acabar ou bater no limite
```

Observação: arquivos em "Compartilhados comigo" que **não** foram adicionados ao Meu Drive ainda assim não aparecem como filhos de `root` (limitação da API do Google). Se isso for desejado, podemos adicionar depois uma ação separada `sharedWithMe` (`q=sharedWithMe=true`). Inclua isso no plano? Se preferir, fica para próximo passo.