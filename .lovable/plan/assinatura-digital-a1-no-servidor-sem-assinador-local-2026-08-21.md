# Assinatura digital A1 no servidor (sem assinador local)

Substituir o app desktop por certificados A1 (.pfx) guardados cifrados no backend. O usuário cadastra o certificado uma vez e passa a assinar PDFs direto no navegador, em um clique, inclusive em lote.

## Como fica para o usuário

1. **Nova página "Certificados Digitais"** (grupo Configurações), com duas abas:
   - **Meu certificado (e-CPF)** — qualquer usuário cadastra o próprio `.pfx` + senha.
   - **Certificado da organização (e-CNPJ)** — somente `org_admin`/`super_admin`.
   Cada cartão mostra titular, CPF/CNPJ, emissor, validade (verde / amarelo <30 dias / vermelho vencido) e botões Substituir e Remover. Nunca exibe o arquivo nem a senha.
2. **Assinar Digitalmente** (ação individual e em lote) abre um modal que:
   - usa direto o certificado disponível quando só há um;
   - **pede para escolher entre e-CPF e e-CNPJ quando os dois existem**;
   - bloqueia certificados vencidos com aviso claro;
   - permite informar a finalidade/intenção da assinatura (opcional).
3. Ao confirmar, o servidor assina o PDF e devolve o documento já assinado: o selo "Assinado" aparece na hora e o download traz o PDF com assinatura embutida (validável no Adobe Reader/ITI), além do carimbo visual e do Manifesto de Assinaturas que já existem hoje.
4. **Remoção completa do assinador desktop**: página `/dashboard/assinador`, item de menu, ponte local e a pasta `signer-desktop` saem do projeto.

## Segurança

- O `.pfx` é gravado cifrado (AES via `pgp_sym_encrypt` com a chave mestra do Vault, mesmo padrão já usado para tokens do Google Drive). Nunca em texto aberto.
- A senha do PFX é gravada cifrada junto (decisão aprovada) para permitir assinatura em 1 clique e em lote.
- Nenhuma rota do cliente lê o certificado: as colunas cifradas ficam sem GRANT de SELECT para `authenticated`; a leitura só acontece dentro de função `SECURITY DEFINER` chamada pela edge function de assinatura.
- Toda assinatura gera registro em `ged_audit_log` e em `documento_assinatura` (hash do PDF, titular, emissor, número de série, data).
- Logs nunca imprimem PFX, PEM ou senha.

## Detalhes técnicos

### Banco (migração)

```
public.digital_certificates
  id, organization_id, owner_type ('USUARIO'|'ORGANIZACAO'), user_id (null p/ org),
  titular_nome, titular_documento (CPF/CNPJ), emissor, serial_number,
  valido_de, valido_ate, fingerprint, status ('valido'|'vencido'|'revogado'),
  pfx_enc BYTEA, senha_enc BYTEA, created_by, created_at, updated_at
  UNIQUE parcial: um ativo por usuário e um por organização
```

- GRANT: `SELECT (colunas de metadados), INSERT/UPDATE/DELETE` para `authenticated`; `ALL` para `service_role`. RLS: usuário lê/gerencia o próprio; `org_admin` gerencia o da organização; ninguém lê `pfx_enc`/`senha_enc` (revogado no nível de coluna).
- Uma view `digital_certificates_view` expõe apenas metadados para o front.
- RPCs `SECURITY DEFINER`:
  - `cert_upsert(...)` — grava cifrando com `_app_enc_key()`.
  - `cert_get_material(p_id)` — retorna pfx/senha decifrados; restrita a `service_role`.
  - `cert_list_available()` — devolve os certificados utilizáveis pelo usuário atual (metadados).

### Edge functions (Deno, `npm:node-forge`)

- `certificate-upload`: valida JWT, recebe `{ scope, base64Pfx, password }`, abre o PKCS#12 com node-forge (senha errada → 400 `senha_incorreta`), extrai titular/CNPJ ou CPF/emissor/validade/serial/fingerprint, chama `cert_upsert`. Limite de 2 MB, extensão `.pfx`/`.p12`.
- `sign-document-pdf`: valida JWT e permissão sobre o documento, busca material via `cert_get_material` (service role), baixa o PDF da versão atual, aplica carimbo visual + manifesto (`src/lib/pdfSignedStamp.ts` portado para a função), insere assinatura PAdES/PKCS#7 (`npm:@signpdf/signpdf` + `placeholder-plain` + `signer-p12`), sobe o PDF assinado como nova versão e registra a assinatura via `sign_document_adhoc` (ou `sign_document`, quando houver etapa pendente do usuário no fluxo).
  Aceita lista de documentos para assinatura em lote, processando sequencialmente e devolvendo sucesso/erro por item.

### Front-end

- Novo `src/pages/dashboard/DigitalCertificates.tsx` + `src/repository/certificateRepository.ts` + hook `useDigitalCertificates` (TanStack Query).
- `SignatureCaptureModal.tsx` reescrito: sem PKI local; seleção de certificado (e-CPF / e-CNPJ) quando houver mais de um, campo de finalidade, estado de progresso.
- `BulkSignDialog.tsx` passa a chamar a edge function em lote, com barra de progresso por documento.
- `Documents.tsx` e `DocumentDetailDialog.tsx`: mesma UX de hoje, apenas trocando a origem da assinatura; invalidação de queries mantida.
- Remoções: `src/lib/signerBridge.ts`, `src/pages/dashboard/Assinador.tsx`, rota e item de menu em `DashboardLayout.tsx`, assets `nexoged-assinador-*`, pasta `signer-desktop/` e o workflow `build-signer.yml`.

### Risco conhecido

A biblioteca de assinatura PAdES roda sobre compatibilidade Node no Deno. Se `@signpdf` não rodar na edge function, o fallback é montar o PKCS#7 destacado com `node-forge` diretamente sobre o ByteRange do PDF — mesmo resultado, mais código. Isso será validado logo no início da implementação.
