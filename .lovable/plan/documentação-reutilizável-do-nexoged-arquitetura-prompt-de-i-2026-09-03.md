# Documentação reutilizável do NexoGED: Arquitetura + Prompt de Interface

Objetivo: gerar arquivos de documentação que permitam recriar as premissas técnicas e o padrão visual do NexoGED em **outro projeto**, sem remix e sem design system publicado — bastando colar/anexar os arquivos no novo projeto.

## Entregáveis (2 arquivos Markdown para download)

### 1. `NexoGED-Especificacao-Tecnica.md`
Especificação de premissas de engenharia, extraída do que o projeto realmente usa hoje:

- **Stack e arquitetura**: React 18 + Vite + TypeScript strict + Tailwind + shadcn/ui; backend Lovable Cloud (Postgres + Auth + Storage + Edge Functions Deno).
- **Camadas**: `pages/` → `components/` → `hooks/` → `repository/` → `services/`; regra de que acesso a dados nunca ocorre direto na página.
- **Multi-tenant**: modelo organização → CNPJs → departamentos → setores → pastas; escopo por `organization_id` em todas as tabelas.
- **Segurança**:
  - RLS obrigatório em 100% das tabelas públicas + GRANTs explícitos.
  - Papéis em tabela separada (`user_roles`) e função `has_role()` SECURITY DEFINER — nunca papel no perfil.
  - Segredos só em Edge Functions; nada de service_role no frontend.
  - Padrões adotados: criptografia de tokens OAuth, credenciais de integração via RPC SECURITY DEFINER, hash de senha de compartilhamento não exposto, auditoria append-only.
  - Certificados digitais A1: armazenamento cifrado e assinatura PAdES server-side.
  - Storage isolado por prefixo `organization_id`.
- **Performance**: TanStack Query com `staleTime`/`gcTime`, paginação e ordenação client-side padronizadas por hooks, batch fetching, code splitting por rota, skeletons obrigatórios.
- **Escalabilidade**: índices em FK e colunas de filtro, RPCs agregadoras para relatórios, jobs em Edge Functions, limites por plano (`max_users`, páginas, storage).
- **Integrações**: Google Drive OAuth, Stripe/billing, servidor MCP com OAuth, chatbot com AI Gateway.
- **Convenções**: nomenclatura, timezone forçado America/Sao_Paulo com formato DD/MM/YYYY, tratamento de erro, validação com Zod.
- **Checklist de qualidade** (pré-deploy) reaproveitável.

### 2. `NexoGED-Prompt-Interface.md`
Um **prompt pronto para colar** em outro projeto Lovable, descrevendo toda a camada de interface:

- Identidade visual: estética limpa/corporativa, tipografia, densidade, raio de borda, sombras.
- **Tokens de cor completos** em HSL (light + dark) copiados de `src/index.css`, mais as 6 paletas alternativas de `src/lib/themes.ts` (Azul Corporativo, Esmeralda, Noir Gold, Ocean Deep, Ruby Fire, Sunset Blaze).
- Regra rígida: apenas tokens semânticos (`bg-primary`, `text-muted-foreground`), nunca cores literais.
- Estrutura de layout: sidebar escura com grupos (Documentos, Gestão, Configurações), topbar de marca, sistema de abas, breadcrumbs, área de conteúdo.
- Padrões de navegação: rotas protegidas por papel e por permissão, acesso rápido, estados vazios.
- Padrões de componentes: tabelas com ordenação + paginação (5–50), diálogos com `max-h-[calc(100vh-2rem)]` e scroll, formulários, badges de status/prioridade, uploaders múltiplos, toasts.
- Chatbot de suporte: widget flutuante, persona, tom de voz, estados de carregamento.
- Dark mode e seletor de tema.
- Acessibilidade e responsividade mobile-first.
- Blocos de código de referência (tokens CSS + config Tailwind) prontos para colar.

## Como você usará

No projeto novo: anexar o arquivo de interface como prompt inicial e o de especificação técnica como referência de arquitetura. Nenhum remix necessário.

## Detalhes técnicos

Ambos os arquivos serão gravados em `/mnt/documents` e disponibilizados para download no chat. Nenhum arquivo do código-fonte do NexoGED será alterado. O conteúdo será derivado da leitura real de `src/index.css`, `tailwind.config.ts`, `src/lib/themes.ts`, `src/components/layouts/*`, hooks de paginação/ordenação, repositórios e das políticas/segurança já aplicadas no backend.

Opcional (diga se quer): gerar também uma versão PDF de cada documento.
