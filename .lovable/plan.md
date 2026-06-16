## Problema

Em `src/pages/dashboard/Documents.tsx`, `currentFolder` e `folderPath` são `useState` locais. Quando o usuário muda de aba e volta, o componente desmonta/remonta e a navegação volta para a raiz.

## Solução

Persistir a pasta atual na URL via `useSearchParams` (`?folder=<past_id>`), que já está importado na página. Isso:
- Sobrevive ao desmontar/remontar do componente quando se troca de aba.
- Permite compartilhar/recarregar o link já dentro da pasta.
- Mantém o histórico do navegador coerente (voltar funciona).

`folderPath` (breadcrumb) será reconstruído a partir do `folder` da URL usando a hierarquia já buscada em `allOrgFolders` (query `ged-folders-all` que já existe no arquivo), subindo pelos `parent_id` até a raiz.

## Mudanças

Em `src/pages/dashboard/Documents.tsx`:

1. Derivar `currentFolder` de `searchParams.get("folder")` em vez de `useState`.
2. Substituir todos os `setCurrentFolder(id)` por `setSearchParams` preservando outros params (ex.: `status`). Para voltar à raiz, remover o param `folder`.
3. Adicionar um `useEffect` que recomputa `folderPath` quando `currentFolder` ou a lista de pastas da org muda — percorrendo `parent_id` da pasta atual até a raiz.
4. Remover as atualizações manuais de `setFolderPath` nos cliques (passam a vir do efeito acima); manter apenas `setSearchParams`.

Nenhuma mudança em rotas, contexto de abas, hooks de dados ou backend. Apenas estado de UI da página Documentos.
