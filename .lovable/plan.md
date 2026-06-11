## Visão geral

Hoje a integração com Google Drive usa uma única conta global (via conector do Lovable). Vamos substituir por **OAuth 2.0 por organização**: cada org conecta sua própria conta Google clicando em um botão, autoriza na tela oficial do Google e o sistema passa a baixar arquivos do Drive **daquela** organização. Escopo solicitado: `drive.readonly` (somente leitura).

## Pré-requisitos a cargo do usuário (Google Cloud Console)

1. Criar projeto em https://console.cloud.google.com
2. **APIs & Services → Library** → ativar **Google Drive API**
3. **OAuth consent screen**:
   - Tipo: External (ou Internal se for Google Workspace)
   - Adicionar escopo: `https://www.googleapis.com/auth/drive.readonly`
   - Domínios autorizados: `lovable.app`, `nexoged.lovable.app` e domínio customizado, se houver
4. **Credentials → Create Credentials → OAuth Client ID**:
   - Tipo: Web application
   - Authorized redirect URIs: a URL da edge function de callback (informarei o valor exato depois de criar a função, formato `https://<projeto>.supabase.co/functions/v1/google-oauth-callback`)
5. Copiar **Client ID** e **Client Secret** e me enviar via secrets (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`)

## Modelo de dados

Nova tabela `organization_google_drive_connections` (uma linha por organização):

- `organization_id` (PK, FK organizations)
- `connected_by` (FK profiles) — quem conectou
- `google_email`, `google_display_name`, `google_photo_url`
- `access_token` (criptografado), `refresh_token` (criptografado)
- `token_expires_at`, `scope`, `status` (active/revoked/error)
- `last_used_at`, `last_error`, `created_at`, `updated_at`

RLS: apenas org_admin/super_admin da própria org leem/escrevem; tokens nunca expostos no client (lidos apenas em edge functions com service_role).

## Backend (edge functions)

1. **`google-oauth-start`** — recebe `organization_id`, valida que o usuário é org_admin, gera `state` (assinado + nonce armazenado), monta URL de consent e devolve para o front redirecionar.
2. **`google-oauth-callback`** — recebe `code` e `state` do Google, troca por tokens, busca `about` para obter e-mail/nome/foto, faz upsert em `organization_google_drive_connections`, redireciona de volta para `/dashboard/integrations/google-drive`.
3. **`google-drive-integration`** (existente, será refatorada) — passa a usar o token da organização do usuário logado em vez do conector global. Recebe `action` (`about|list|search|download`), busca a linha da org, **refresca o token** se vencido (usa `refresh_token` + client secret) e chama a Drive API.
4. **`google-drive-disconnect`** — revoga o token no Google (`https://oauth2.googleapis.com/revoke`) e marca a linha como `revoked` (ou deleta).

Refresh de token: quando `token_expires_at < now() + 60s`, faz POST em `https://oauth2.googleapis.com/token` com `grant_type=refresh_token` e atualiza o registro.

## Frontend

Página existente `/dashboard/integrations/google-drive` é reescrita:

- **Quando org NÃO conectada**: card explicativo + botão "Conectar Google Drive" (chama `google-oauth-start`, abre a URL do Google em popup/redirect).
- **Quando conectada**: mostra e-mail, nome, foto, status, data de conexão, quem conectou, botão "Atualizar" (chama `about`), botão "Desconectar" (chama `google-drive-disconnect` com confirmação).
- **Erros**: se token revogado externamente, mostra alerta vermelho com botão "Reconectar".

Atualizar `GoogleDrivePicker.tsx` e `MultiFileUploader.tsx` para:
- Bloquear o botão "Importar do Google Drive" quando a org não tem conexão ativa (toast direcionando para a página de integração).
- Continuar usando a edge function `google-drive-integration`, que agora resolve o token via org.

## Segurança

- Apenas **org_admin** (e super_admin) pode iniciar OAuth, desconectar e ver e-mail conectado.
- Usuários comuns apenas **usam** (baixam arquivos) — verificado dentro das edge functions.
- `state` do OAuth assinado com HMAC usando `LOVABLE_API_KEY` para impedir CSRF.
- Tokens nunca trafegam para o cliente; criptografados em repouso usando `pgcrypto` (`pgp_sym_encrypt` com chave em secret `GDRIVE_TOKEN_ENCRYPTION_KEY`).
- Log de auditoria em `user_audit_log` para conectar/desconectar.

## Migração da configuração atual

- O conector global do Lovable continuará ativo apenas como fallback para super_admin testar; novas chamadas usarão tokens por org.
- Orgs já existentes verão "Desconectado" até o admin conectar a conta da empresa.

## Secrets necessários

- `GOOGLE_OAUTH_CLIENT_ID` (você fornecerá)
- `GOOGLE_OAUTH_CLIENT_SECRET` (você fornecerá)
- `GDRIVE_TOKEN_ENCRYPTION_KEY` (gerado automaticamente, 32 bytes aleatórios)

## Ordem de execução

1. Solicitar os 3 secrets acima.
2. Criar migração: tabela `organization_google_drive_connections` + RLS + funções de criptografia.
3. Criar edge functions `google-oauth-start`, `google-oauth-callback`, `google-drive-disconnect`.
4. Refatorar `google-drive-integration` para resolver token por organização e fazer refresh automático.
5. Reescrever página `/dashboard/integrations/google-drive`.
6. Ajustar `GoogleDrivePicker` / `MultiFileUploader` para checar status da conexão.
7. Eu informo a **Redirect URI** exata após a função de callback estar criada — você adiciona no Google Cloud Console antes de testar.

## Detalhes técnicos (resumo)

```text
[Browser] --click-- [google-oauth-start]
                          |
              redirect to accounts.google.com (consent screen)
                          |
                     [user authorizes]
                          |
              redirect with ?code=&state=
                          v
                  [google-oauth-callback]
                          |
      exchange code -> access_token + refresh_token
                          |
      fetch drive.about -> email, name, photo
                          |
              upsert org_google_drive_connections
                          |
              redirect /dashboard/integrations/google-drive
```

Pronto para implementar assim que você confirmar e enviar Client ID/Secret.