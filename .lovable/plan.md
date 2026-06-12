## Problema

O chatbot exibe um menu fixo de **Perguntas Frequentes** definido no componente `SupportChatWidget.tsx` (array `faqCategories`). Esse menu está desatualizado e não reflete:

- O perfil do usuário logado (Super Admin / Administrador / Gestor / Usuário).
- Os módulos reais do sistema (Tipos de Documento, Listas de Cadastro, Campos Adicionais, Controle de Acesso, Google Drive, Vencimentos, Favoritos, etc.).
- O fato de que o **GED ainda não possui API pública** (a categoria atual ainda traz "Como utilizar a API de documentos?").

O prompt da Edge Function `support-chat` já foi atualizado por papel, mas a **lista visível de FAQ** no widget não acompanhou.

## O que vai mudar

Editar **apenas o frontend** (`src/components/dashboard/SupportChatWidget.tsx`) — sem alterar Edge Function nem regras de negócio.

1. Substituir o array fixo `faqCategories` por **três conjuntos de FAQ por papel**, escolhidos em runtime via `useAuth()` (`isSuperAdmin`, `isOrgAdmin`, senão usuário/gestor).
2. Remover a pergunta sobre API e qualquer menção a "API de documentos" da FAQ — o GED ainda não tem API.
3. Garantir que cada pergunta clicada continue sendo enviada ao chatbot (`sendMessage`), que já responde com o prompt correto por papel.

### FAQ por papel (conteúdo planejado)

**Super Admin**
- Visão Geral: dashboard global, organizações ativas, uso consolidado.
- Organizações & Planos: criar organização, alterar limites contratados (páginas/GB), planos comerciais, Stripe.
- Usuários & Segurança: gerir usuários de qualquer organização, redefinir senha, auditoria global.
- Conteúdo & Legal: termos de uso, política de privacidade (LGPD), análise do chatbot, configurações globais.

**Administrador da Organização**
- Cadastros: CNPJ/filial, usuários da organização, tipos de documento, listas de cadastro, campos adicionais.
- Documentos: upload simples e em lote, versionamento, vigência/vencimentos, lixeira.
- Controle de Acesso: perfis de permissão, escopo de usuário, simulador de acesso, dashboard de segurança.
- Configurações: dados da organização, regras do GED, Google Drive, exportação de dados.
- Conta & Suporte: alterar senha, versão do sistema, contato de suporte.

**Gestor / Usuário**
- Documentos: como pesquisar, abrir, favoritar, baixar e (se autorizado) enviar.
- Vencimentos & Favoritos: acompanhar vigência, marcar favoritos, últimos acessos.
- Conta: alterar senha, atualizar dados pessoais.
- Acesso: "não consigo ver um menu/pasta, o que fazer?" (orientação para falar com o Administrador).

Nenhum grupo terá pergunta sobre API.

## Detalhes técnicos

- Em `SupportChatWidget.tsx`:
  - Trocar a constante única `faqCategories` por uma função `getFaqCategories(role)` ou três constantes (`SUPER_ADMIN_FAQ`, `ORG_ADMIN_FAQ`, `USER_FAQ`).
  - Selecionar a lista com base em `isSuperAdmin` / `isOrgAdmin` (vindos de `useAuth`); fallback = usuário.
  - Remover o filtro `adminOnly` (substituído pela seleção por papel) e remover a entrada "Como utilizar a API de documentos?".
  - Manter toda a UI atual (header azul, ScrollArea, input, accordion das categorias).
- Não tocar em `useSupportChat.ts`, na Edge Function `support-chat`, em `useAuth`, em rotas ou em RLS.
- Sem migrações, sem mudanças de backend.

## Como validar

1. Logar como **Administrador** (caso atual da Paula) → abrir o chatbot → ver categorias *Cadastros, Documentos, Controle de Acesso, Configurações, Conta & Suporte* com as perguntas listadas acima; **sem** pergunta sobre API.
2. Logar como **Super Admin** → ver categorias específicas de Super Admin (Organizações & Planos, Stripe, etc.).
3. Logar como **Usuário comum / Gestor** → ver apenas as categorias simplificadas.
4. Clicar em qualquer pergunta envia a mensagem ao chatbot, que responde conforme o prompt por papel já existente.
