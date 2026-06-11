## Problema
No formulário de upload, o campo adicional do tipo "Lista" (ex: Tipo de Licença) não mostra opções porque o componente `CustomFieldsForm` consulta colunas inexistentes em `list_items`.

A tabela real tem as colunas: `id`, `list_id`, `value`, `created_at`.
O código atual usa `item_value` (não existe), e por isso o `select` retorna vazio.

## Correção
Arquivo: `src/components/dashboard/ged/CustomFieldsForm.tsx`

- Trocar `.order("item_value", ...)` por `.order("value", ...)`.
- Trocar o render `<SelectItem value={item.item_value}>{item.item_value}</SelectItem>` por `<SelectItem value={item.value}>{item.value}</SelectItem>`.

Ajuste mínimo, apenas nomes de coluna. Nenhuma mudança de schema ou de outras telas.