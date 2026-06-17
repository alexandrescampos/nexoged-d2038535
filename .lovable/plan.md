## Arquitetura

Substituir o Lacuna Web PKI por uma **ponte nativa local** (app desktop leve) que o usuário instala uma vez. O web app conversa com ela via `http://127.0.0.1` — sem extensão de navegador, sem licença por domínio, sem dependência da Lacuna.

```text
┌─────────────────────┐         HTTP localhost          ┌──────────────────────────┐
│  Web app (browser)  │ ──────  GET  /certs        ───▶ │  NexoGED Assinador       │
│  nexoged.lovable... │ ──────  POST /sign         ───▶ │  (Electron, roda local)  │
│                     │ ◀────── { signature, cert }     │  Acessa cert store + A3  │
└─────────────────────┘                                  └──────────────────────────┘
                                                                    │
                                                                    ▼
                                                       Windows CertStore (A1)
                                                       macOS Keychain     (A1)
                                                       PKCS#11 driver     (A3 token)
```

### Por quê desktop bridge
- Funciona em **qualquer domínio** (preview, prod, custom) sem licença.
- Suporta **A1** (cert no SO) e **A3** (token USB) usando o módulo PKCS#11 oficial do fabricante (SafeNet, GemPC, Watchdata, etc.) já instalado na máquina do usuário com o token.
- Stack 100% open-source: Electron + `pkcs11js` (A3) + `win-ca` / `node-forge` (A1).
- Nenhum custo recorrente. Distribuímos como `.exe`/`.dmg`/`.AppImage` direto pelo nosso domínio.

## Componentes

### 1. App desktop `signer-desktop/` (novo, Electron)

Arquivos principais:
- `package.json` — Electron + `pkcs11js` + `fastify` + `node-forge`.
- `main.cjs` — janela tray, sem UI principal; só ícone na bandeja com status, "Pareado com nexoged.tecnologianexo.com.br", "Sair".
- `bridge.cjs` — Fastify em `127.0.0.1:59123`:
  - `GET  /health` → `{ version, platform }`
  - `GET  /pair` → gera token de pareamento de 6 dígitos (UI mostra), retorna `{ token }` apenas para Origin na allowlist.
  - `GET  /certs` (header `X-Pair-Token`) → lista certificados: CertStore do SO (A1) + slots PKCS#11 (A3).
  - `POST /sign` (header `X-Pair-Token`, body `{ thumbprint, hashHex, intent }`) → pede PIN do token via diálogo nativo (Electron), assina SHA256withRSA, devolve `{ signatureB64, certificateB64, subject, issuer, validity, serial, cpf }`.
- `cert-store-win.cjs` / `cert-store-mac.cjs` / `cert-store-linux.cjs` — wrappers do CertStore nativo (Windows: spawn `powershell Get-ChildItem Cert:\CurrentUser\My`; macOS: `security find-identity`; Linux: NSS via `certutil`).
- `pkcs11.cjs` — carrega o `.dll`/`.so` do token (caminho configurável; defaults conhecidos: SafeNet, GemPC, Watchdata, eToken), lista certs e assina via `pkcs11js`.
- `installer/` — empacotamento com `@electron/packager` (build no sandbox, conforme `electron-desktop-app`).

Segurança:
- CORS estrito: só aceita `Origin` em allowlist (`nexoged.tecnologianexo.com.br`, `nexoged.lovable.app`, `*.lovable.app`, `localhost`).
- Header `X-Pair-Token` obrigatório em `/certs` e `/sign`. Token mostrado na tray UI; usuário cola no app web no primeiro uso (salvo em `localStorage`).
- Listen apenas em `127.0.0.1` (nunca `0.0.0.0`).
- Cada `/sign` exibe diálogo nativo "Assinar documento `<nome>`? Hash `<...>` — [Permitir] [Cancelar]" antes de pedir PIN.

### 2. Web app

Trocar:
- **`src/lib/lacunaPki.ts`** → renomear/reescrever como **`src/lib/signerBridge.ts`** com mesma interface pública (`initPki`, `listCertificates`, `signHash`, `readCertificate`) batendo em `http://127.0.0.1:59123`. Isso minimiza mudanças no modal.
- **`src/components/dashboard/ged/SignatureCaptureModal.tsx`**:
  - Substituir mensagens "Web PKI não instalado" por "Assinador NexoGED não detectado" + botão de download do instalador (`/downloads/NexoGED-Assinador-{win,mac,linux}.zip`).
  - Adicionar campo de "Token de pareamento" (6 dígitos) no primeiro uso; persistir em `localStorage`.
  - Manter SIMPLES/AVANCADA por senha como estão.

Remover:
- Dependência `web-pki` do `package.json`.
- `VITE_LACUNA_WEB_PKI_LICENSE` (não usado mais).

### 3. Distribuição dos instaladores

- Build dos 3 binários (Windows, macOS, Linux) gerados via `@electron/packager` no próprio sandbox e empacotados em `.zip`.
- Copiar para `public/downloads/` para serem servidos estáticos pelo app.
- Página `/dashboard/assinador` com instruções: baixar → instalar → abrir tray → copiar token de pareamento → colar no modal.

### 4. Migração

- Documentos já assinados via Lacuna ficam intactos.
- Coluna `documento_assinatura.certificado` (jsonb) absorve o novo payload sem migration.
- Sem mudanças em RLS, políticas, fluxos ou banco.

## Tarefas (ordem de execução)

1. Criar `signer-desktop/` com Electron + Fastify + endpoints `/health`, `/certs`, `/sign` (mock inicialmente; PKCS#11 logo depois).
2. Implementar lookup de cert A1 no Windows + macOS (cobre 90% dos usuários).
3. Implementar PKCS#11 para A3 com 2-3 drivers populares (SafeNet eToken, Watchdata).
4. Empacotar (`@electron/packager` win32/darwin/linux) e copiar `.zip`s para `public/downloads/`.
5. Criar `src/lib/signerBridge.ts` substituindo `lacunaPki.ts`.
6. Atualizar `SignatureCaptureModal.tsx` (estados de "não instalado", "não pareado", "pronto", "assinando").
7. Criar página `/dashboard/assinador` (download + instruções + status atual).
8. Remover dep `web-pki`.
9. Testar fluxo end-to-end no sandbox com um cert mock antes de você testar com token real.

## Fora do escopo
- Auto-update do instalador (faremos em iteração futura).
- Assinatura em lote (mais de 1 doc por clique).
- Assinatura PAdES embutida no PDF — gravamos só a evidência (hash + cert + assinatura detached); embedding pode entrar depois.
- Assinatura no mobile (impossível por esta via — A3 precisa de USB).

## Riscos
- PKCS#11 depende do driver do fabricante estar instalado no PC do usuário (não é nosso, é da Certisign/Valid/Serasa). Documentamos no onboarding.
- macOS exige notarização do `.app` para abrir sem aviso (custo: conta Apple Developer $99/ano). Sem notarização, usuário precisa clicar em "Abrir mesmo assim" na primeira execução — aceitável MVP.
- Windows SmartScreen pode avisar até o binário ganhar reputação — mitigado com code signing (custo: ~$300/ano). Sem isso, aviso de "publisher desconhecido" no primeiro install.

Se aprovar, começo pela etapa 1 (esqueleto do app Electron) e seguimos incremental.
