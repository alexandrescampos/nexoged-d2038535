## Plano: Área de depuração da página Favoritos (somente DEV)

Adicionar painel de depuração visível apenas em desenvolvimento (`import.meta.env.DEV`), invisível para o usuário final em produção.

### Mudanças

1. **`src/repository/gedRepository.ts`** — em `getDocuments`, anexar `debug` ao retorno contendo:
   - `favoriteIds` (IDs vindos de `document_favorites`)
   - `queryParams` (snapshot dos filtros: `isFavorite`, `past_id`, `search`, etc.)
   - `returnedIds` (IDs dos documentos retornados)
   - `count`

2. **`src/hooks/useGED.ts`** — expor `debug: documentsData?.debug` no retorno do hook.

3. **`src/pages/dashboard/Favorites.tsx`** — renderizar painel colapsável "Depuração" com `<pre>` JSON formatado, envolvido em `{import.meta.env.DEV && (...)}` para nunca aparecer em build de produção.

### Detalhes técnicos

- Guard estrito com `import.meta.env.DEV` (Vite remove o bloco no build de produção via tree-shaking).
- Sem flag de runtime, sem toggle persistido — zero risco de vazar em produção.
- Estilo discreto (borda tracejada, fundo muted) para deixar claro que é ferramenta de dev.
