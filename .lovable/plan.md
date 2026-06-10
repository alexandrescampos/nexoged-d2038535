## Problemas identificados

1. **Upload sempre vai para a raiz**: a tabela `ged_documents` tem duas colunas (`folder_id` e `past_id`). A listagem filtra por `past_id`, mas o `createDocument` insere apenas `folder_id`. Resultado: o documento é gravado, mas com `past_id = NULL`, aparecendo sempre na raiz.

2. **Sem retorno ao entrar em uma pasta**: a página `Documents.tsx` atualiza `currentFolder` ao clicar em uma pasta, mas não exibe nenhum controle de "Voltar" / breadcrumb navegável. O único link existente ("Nexo GED") volta direto pra raiz, mas não há indicação visual da pasta atual nem botão Voltar.

## Mudanças

### 1. Salvar a pasta corretamente no upload
Em `src/pages/dashboard/Documents.tsx`, ao montar o payload do `uploadDocument`, enviar a pasta tanto em `past_id` quanto em `folder_id` (mantendo compatibilidade):

```ts
folder_id: currentFolder,
past_id: currentFolder,
```

### 2. Navegação de retorno entre pastas
Em `src/pages/dashboard/Documents.tsx`:

- Manter um estado `folderPath: { id: string; name: string }[]` (pilha de pastas abertas).
- Ao clicar em uma pasta: empilhar `{ id, name }` e setar `currentFolder`.
- Renderizar um cabeçalho com:
  - Botão **← Voltar** (visível quando `folderPath.length > 0`) que faz `pop` da pilha e atualiza `currentFolder` para o topo (ou `null`).
  - Breadcrumb clicável: `Nexo GED / Pasta A / Pasta B`, onde cada segmento navega para aquele nível (corta a pilha até o índice clicado).

O breadcrumb existente no header (`Nexo GED > Explorar`) será substituído pelo breadcrumb dinâmico.

## Resultado

- Upload feito dentro de uma pasta passa a ser corretamente vinculado a ela (aparece dentro da pasta e some da raiz).
- Usuário consegue voltar nível a nível usando o botão Voltar ou clicando em qualquer parte do breadcrumb.

Sem alterações de schema, RLS ou backend — apenas frontend.
