**Problema real identificado**
- O backend já criou o fluxo para o documento enviado: há **2 aprovações** e **2 assinaturas** para `Contrato_Bussola_NEXO_Representacao_Comercial_V2_assinado`.
- A tela mostra “ainda não possui fluxo aplicado” porque as consultas do frontend estão falhando com `PGRST200`.
- O erro acontece porque `policyExecutionRepository.ts` usa joins automáticos como `aprovador:aprovador_id(full_name)` e `assinante:assinante_id(full_name)`, mas essas colunas não têm relacionamento/foreign key cadastrado no schema exposto pela API.
- Do I know what the issue is? **Sim**: os dados existem, mas o frontend não consegue carregá-los por causa dos relacionamentos automáticos inválidos nas consultas.

**Plano de correção**
1. Alterar `src/repository/policyExecutionRepository.ts` para não depender de joins automáticos inexistentes.
2. Buscar `documento_aprovacao` e `documento_assinatura` com selects simples.
3. Enriquecer os resultados em consultas separadas:
   - perfis em `perfil` para mostrar `perfil_nome`;
   - usuários em `profiles` para mostrar `aprovador_nome` e `assinante_nome`;
   - documentos em `ged_documents` para relatórios/listas, mapeando `title` para o campo esperado pela UI.
4. Aplicar o mesmo padrão nas listas:
   - detalhe do documento;
   - “Minhas Aprovações”;
   - “Minhas Assinaturas”;
   - relatórios de aprovação/assinatura.
5. Manter a lógica de criação/aplicação do fluxo como está, pois o banco já confirmou que ela está funcionando.
6. Validar depois que as abas “Aprovações” e “Assinaturas” passam a mostrar os registros existentes no documento atual.