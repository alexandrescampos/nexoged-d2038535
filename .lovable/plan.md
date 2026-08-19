# Corrigir selo "Assinado" aparecendo logo após o upload

## Problema

O selo "Assinado" na lista de documentos é ligado sempre que existe qualquer registro de assinatura vinculado ao documento — inclusive as assinaturas **pendentes** criadas automaticamente quando o tipo de documento tem política/fluxo de assinatura. Por isso um documento recém-enviado, que ninguém assinou, já aparece como assinado.

## Solução

Considerar apenas assinaturas efetivamente concluídas.

- Ao carregar os documentos, trazer também o campo de status da assinatura.
- O selo "Assinado" só aparece quando existir ao menos uma assinatura com status `ASSINADA` (com data de assinatura preenchida).
- O detalhe/tooltip de assinantes e o carimbo aplicado no PDF baixado passam a listar somente as assinaturas concluídas — assinaturas pendentes não entram no manifesto.
- Documentos com assinaturas apenas pendentes ficam sem selo (o acompanhamento do fluxo continua nas telas de Minhas Assinaturas / Relatório de Workflow).

## Detalhes técnicos

- `src/repository/gedRepository.ts`: incluir `status` no embed `documento_assinatura`; calcular `signatures` como a lista filtrada por `status === 'ASSINADA' && assinado_em`, e `has_signatures` a partir dessa lista filtrada (mantendo, se necessário, `pending_signatures_count` para uso futuro).
- Nenhuma mudança de banco de dados é necessária; `src/pages/dashboard/Documents.tsx` continua usando `has_signatures` e `signatures` sem alteração.
