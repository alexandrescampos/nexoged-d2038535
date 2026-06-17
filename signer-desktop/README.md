# NexoGED Assinador

Aplicativo desktop leve que faz a ponte entre o seu certificado/token ICP-Brasil e o web app NexoGED.

## Arquitetura

```
NexoGED Web (browser)  ⇄  http://127.0.0.1:59123  ⇄  Este app (Electron)
                                                           ↓
                                              Windows CertStore  (A1)
                                              macOS Keychain     (A1)
                                              PKCS#11 driver     (A3 token)
```

- Escuta APENAS em `127.0.0.1` (inacessível pela rede).
- Apenas origens autorizadas (`nexoged.lovable.app`, `nexoged.tecnologianexo.com.br`, `*.lovable.app`, `localhost`) podem chamar.
- Cada `/sign` exige confirmação por diálogo nativo + PIN do token (A3).
- Pareamento por código de 6 dígitos exibido na bandeja (X-Pair-Token).

## Endpoints

| Método | Path | Auth | Body | Retorno |
|---|---|---|---|---|
| GET  | `/health` | — | — | `{ ok, version, platform }` |
| GET  | `/certs`  | X-Pair-Token | — | `{ certs: [...] }` |
| POST | `/cert`   | X-Pair-Token | `{ thumbprint }` | `{ certificateB64 }` |
| POST | `/sign`   | X-Pair-Token | `{ thumbprint, hashHex, intent? }` | `{ signatureB64 }` |

## Desenvolvimento

```bash
cd signer-desktop
npm install
npm start
```

## Empacotamento

```bash
npm run package:win    # Windows .exe
npm run package:mac    # macOS .app
npm run package:linux  # Linux executável
```

Os artefatos vão para `dist/`. Compactar em `.zip` (Win/Mac) ou `.tar.gz` (Linux) e publicar em `public/downloads/` no projeto principal.

## Pré-requisitos no PC do usuário

- **A1**: certificado importado no repositório do SO (Windows CertStore / Keychain).
- **A3**: driver PKCS#11 do fabricante já instalado (SafeNet Authentication Client, Watchdata, Valid, GemPC etc.).
  Caminhos detectados automaticamente; override via `NEXOGED_PKCS11_MODULE=/path/to/lib.so`.

## Limitações conhecidas

- Assinatura A1 no macOS ainda não implementada (Keychain não expõe `SignHash` via CLI). Use A3 ou aguarde próxima versão.
- Assinatura A1 no Linux: idem (sem cert store padrão).
- Sem auto-update ainda.
- Sem code signing (Windows SmartScreen avisa "publisher desconhecido" no 1º install).
- macOS sem notarização (clique direito → Abrir no 1º uso).
