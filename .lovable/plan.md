# Plano — Tree View enriquecida em Documentos

## 1. Drag and Drop de Documentos

Hoje só itens da árvore são arrastáveis. Vou tornar cada linha de documento na lista central (`Documents.tsx`) arrastável e cada nó de **Pasta** na Tree View um alvo de drop.

- Em `Documents.tsx`: adicionar `draggable`, `onDragStart` nos cards/linhas de documento, transferindo `{ id, type: 'DOCUMENT' }`.
- Em `GedTreeView.tsx`: no nó tipo `FOLDER`, aceitar drop de `DOCUMENT` chamando `moveItem({ type: 'DOCUMENT', id, targetId: folder.past_id })`.
- O hook `useOrganizationStructure.moveItem` já trata DOCUMENT atualizando `past_id` — após mover, invalidar também `["documents"]` para a lista atualizar.
- Feedback visual: highlight da pasta durante `onDragOver` (borda/destaque).

## 2. Criação direta na Tree View

Atualmente os botões `+` na Tree View não fazem nada. Vou ligá-los a diálogos de criação contextuais:

- `+` no header da Tree → criar **Departamento**.
- `+` em um nó **Departamento** → criar **Setor** (já com `dept_id` preenchido).
- `+` em um nó **Setor** → criar **Pasta** raiz (sectorId preenchido, `past_id_pai = null`).
- `+` em um nó **Pasta** → criar **Subpasta** (mesmo `set_id`, `past_id_pai = pasta atual`).

Implementação:
- Novo componente `GedQuickCreateDialog.tsx` com um único `Dialog` controlado por estado `{ open, mode: 'DEPARTMENT'|'SECTOR'|'FOLDER', parent: {...} }`.
- Campos: apenas Nome (e Descrição opcional). Submete via `createDepartment` / `createSector` / `createFolder` já existentes em `useOrganizationStructure`.
- Após sucesso, expandir automaticamente o nó pai para mostrar o item criado.

## 3. Menu de contexto (Mover/Excluir)

O dropdown `MoreVertical` em cada nó já existe mas é inerte. Para esta entrega:
- "Mover" → ativa modo "selecione destino" (próxima pasta/setor/depto clicado vira target) ou abre um picker. Vou usar um pequeno **Dialog com select hierárquico** reutilizando a mesma árvore, mais simples que estado modal.
- "Excluir" → confirma e chama soft delete (`past_in_ativa=false` / `set_in_ativo=false` / depto).

> Se preferir manter o escopo só em (1) e (2) nesta rodada, posso deixar o menu de contexto para depois — me avise.

## 4. Onde NÃO mexer

- Página `OrganizationStructure` continua funcionando como gestão completa; a Tree em Documentos será um atalho.
- Sem mudanças de schema, RLS ou backend.

## Arquivos afetados

- `src/components/dashboard/ged/GedTreeView.tsx` — botões `+` funcionais, drop de DOCUMENT, highlight de drop.
- `src/components/dashboard/ged/GedQuickCreateDialog.tsx` — **novo**, diálogo único para Depto/Setor/Pasta.
- `src/pages/dashboard/Documents.tsx` — tornar linhas de documento `draggable` com payload correto.
- `src/hooks/useOrganizationStructure.ts` — invalidar `["documents"]` após `moveItem` do tipo DOCUMENT.

## Confirmações

1. Inclui também **Mover/Excluir** no menu de contexto agora (item 3) ou deixo para depois?
2. Os usuários que veem a Tree em Documentos podem criar Depto/Setor livremente, ou devemos restringir a `org_admin`?