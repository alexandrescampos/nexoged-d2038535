## Problema

A criação de novo perfil falha por causa de duas falhas na política RLS atual da tabela `perfil`:

1. **Ovo e galinha**: a política `"Admins can manage profiles"` usa `check_user_is_admin()`, que verifica se o usuário já tem um perfil "Administrador" atribuído em `usuario_perfil`. Como nenhum perfil ainda existe, ninguém passa — é impossível criar o primeiro.
2. **Falta `WITH CHECK`**: a política é `FOR ALL` mas só tem `USING`, então `INSERT` é sempre negado.

A mesma lógica problemática afeta `perfil_permissao`, `usuario_perfil`, `usuario_escopo` e `documento_usuario_autorizado`.

## Solução

Migração SQL que substitui as políticas pelas baseadas em `has_role()` + `get_user_org_id()` (já SECURITY DEFINER, sem recursão):

- **`perfil`**: super_admin OU (org_admin do mesmo `organization_id`) — com `USING` e `WITH CHECK`.
- **`perfil_permissao`**: mesma regra, validada via JOIN com `perfil`.
- **`usuario_perfil`, `usuario_escopo`, `documento_usuario_autorizado`**: escopo por organização do usuário-alvo.
- Mantém a política de leitura "Users can view active profiles".
- Não altera frontend — o formulário já envia `organization_id` corretamente.

## Resultado esperado

Org admins conseguem criar perfis na sua organização; super_admin gerencia todas; usuários comuns continuam apenas com leitura.
