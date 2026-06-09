## Problema

Na página **Análise do Nexo Assistente** (`/super-admin/chatbot-analytics`), ao selecionar uma Organização e/ou um Usuário nos filtros, o resultado fica zerado mesmo havendo registros (confirmei via banco — existem logs da Paula na org "Nexo EPI - Demo").

## Causa

No arquivo `src/pages/super-admin/ChatbotAnalytics.tsx`, a query usa:

```ts
query.ilike("organization.name", `%${orgFilter}%`)
query.ilike("user_name", `%${userFilter}%`)
```

Dois problemas:
1. `organization.name` é uma relação aninhada (embed). No PostgREST, filtrar por coluna de relação só restringe as linhas pai quando o embed é declarado como `!inner`. Sem isso, o filtro é silenciosamente ignorado/ineficaz e pode zerar a resposta.
2. Os comboboxes do CMDK passam o `value` em **lowercase** no `onSelect` (`currentValue`), então o estado `orgFilter` fica `"nexo epi - demo"` em vez de `"Nexo EPI - Demo"`, quebrando comparações estritas.

## Correção (somente UI/presentation)

Editar apenas `src/pages/super-admin/ChatbotAnalytics.tsx`:

1. **Mudar o modelo dos filtros** para usar IDs em vez de nomes:
   - `orgFilter`: passa a guardar `organization_id` (uuid) — ou string vazia.
   - `userFilter`: passa a guardar `user_id` (uuid) — ou string vazia.

2. **Ajustar `filterOptions`** para retornar `{ id, name }` para orgs e `{ id, name }` para usuários (já temos `user_id` e `user_name` em `support_chat_logs`). Deduplicar por id.

3. **Ajustar a query principal**:
   ```ts
   if (orgFilter) query = query.eq("organization_id", orgFilter);
   if (userFilter) query = query.eq("user_id", userFilter);
   ```
   Remover os `ilike` em relação aninhada. O embed `organization:organizations(name)` permanece apenas para exibição.

4. **Ajustar os comboboxes**:
   - `CommandItem value={org.id}` e label exibindo `org.name`.
   - Exibição do botão usa `filterOptions.orgs.find(o => o.id === orgFilter)?.name`.
   - Mesmo padrão para usuários.

Nenhuma mudança de schema, RLS ou edge function — apenas frontend.
