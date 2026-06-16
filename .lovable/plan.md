## Causa real

Minha mudança anterior persiste a pasta em `?folder=...`, mas o sistema de abas (`TabsContext` / `TabsBar`) usa `location.pathname` como `tab.id` e navega com `navigate(tab.id)` ao clicar. Resultado: ao voltar para a aba "Documentos", a URL é reescrita para `/dashboard/documents` sem o query string, e a página volta à raiz.

## Solução

Ensinar o sistema de abas a lembrar a URL completa (pathname + search) da aba.

1. **`src/contexts/TabsContext.tsx`**:
   - Adicionar campo opcional `path: string` em `Tab` (default = `id`).
   - `openTab` aceita `path`; persistir `path` no sessionStorage junto com `id`/`title`.
   - Novo método `updateTabPath(id, path)` para sincronizar a URL atual.

2. **`src/components/TabsBar.tsx`**: `navigate(tab.path ?? tab.id)` ao clicar.

3. **`src/components/layouts/DashboardLayout.tsx`** (e `SuperAdminLayout.tsx` por simetria): no `useEffect` de sync, sempre que a rota muda, chamar `updateTabPath(menuItem.url, location.pathname + location.search)` para a aba já aberta — assim a aba "Documentos" guarda `/dashboard/documents?folder=xyz`.

Sem mudanças em `Documents.tsx` além do que já foi feito (URL com `?folder=`).
