## Diagnóstico
- Os valores de campos personalizados estão sendo gravados corretamente no upload (verificado direto no banco — valor "Corte" presente).
- O bug é no **modal "Editar Dados"** (`src/pages/dashboard/Documents.tsx`): nos dois pontos onde `setDocumentToEdit(doc)` é chamado (linhas ~840 e ~989), o estado `editCustomFields` não é populado a partir de `doc.custom_field_values`. Como o modal renderiza vazio, dá a impressão de que "não gravou".
- Pior: se o usuário salvar o modal, `updateDocument` apaga todos os `ged_document_custom_field_values` do documento e reinsere apenas o que está em `editCustomFields` (vazio), apagando os dados reais.

## Correção
Arquivo: `src/pages/dashboard/Documents.tsx`

Nos dois handlers de abertura do modal de edição (linhas ~840 e ~989), além de `setEditData(...)`, popular o state de campos personalizados a partir do documento:

```ts
const cfMap: Record<string, any> = {};
(doc.custom_field_values || []).forEach((cv: any) => {
  if (cv.custom_field_id) cfMap[cv.custom_field_id] = cv.value;
});
setEditCustomFields(cfMap);
```

Garantir também o reset ao fechar o modal: no `onOpenChange` do Dialog (linha 1253) e no botão Cancelar (linha 1429), limpar `setEditCustomFields({})` quando `documentToEdit` voltar a `null`, evitando vazamento de valores entre documentos.

Nenhuma alteração de schema ou de RLS. Mudança apenas no front, escopo do modal de edição.