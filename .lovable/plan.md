## Objetivo

Permitir selecionar vários PDFs em **Documentos** e assiná-los digitalmente de uma vez (ICP-Brasil via app desktop NexoGED Assinador).

## UX dentro de `/dashboard/documents`

1. **Modo seleção**
   - Novo botão na barra de ações superior: **"Selecionar"**. Ao ativar, aparece um checkbox em cada linha/cartão (tabela e grid).
   - Checkbox "selecionar todos" no cabeçalho da tabela seleciona apenas os **PDFs visíveis** da página atual (não-PDFs ficam desabilitados, com tooltip "Apenas PDFs podem ser assinados").
   - Barra fixa no rodapé mostra: "N PDFs selecionados · [Limpar] [Assinar digitalmente]".

2. **Diálogo "Assinar em lote"** (`BulkSignDialog`)
   - Verificação do assinador (reaproveita `signerBridge.initPki` / `listCertificates`); se não pareado, mostra link "Configurar assinador" para `/dashboard/assinador`.
   - Dropdown de certificado (lista filtrada por validade).
   - Campo opcional **Intenção/justificativa** (vai junto na evidência).
   - Aviso: "Cada PDF exigirá uma confirmação no app desktop (e PIN, no caso de A3). O processo é sequencial."
   - Botão **Iniciar assinatura**.

3. **Painel de progresso** (mesmo diálogo)
   - Barra de progresso X de N.
   - Lista por arquivo com estado: ⏳ aguardando → 🔵 assinando → ✅ assinado / ❌ erro (mensagem).
   - Botão **Cancelar** interrompe após o item corrente.
   - Ao final: resumo "N assinados, M com erro" + botão **Baixar relatório CSV**.
   - Após fechar: recarrega a listagem para refletir o badge "Assinado".

## Implementação técnica

**Frontend (somente)**

- `src/pages/dashboard/Documents.tsx`
  - Estado `selectionMode: boolean`, `selectedIds: Set<string>`.
  - Render condicional de checkboxes na tabela e nos cards.
  - Barra de seleção flutuante (`fixed bottom-4`) com contagem e ações.
  - Abre `BulkSignDialog` passando os documentos selecionados (apenas os PDFs).
- `src/components/dashboard/documents/BulkSignDialog.tsx` **(novo)**
  - Reusa: `listCertificates`, `readCertificate`, `signHash`, `describeBridgeError` de `@/lib/signerBridge`; `sha256Hex` de `@/lib/hash`.
  - Para cada doc, sequencialmente:
    1. Buscar última versão (`id`, `file_path`, `file_name`) em `ged_document_versions`.
    2. Signed URL → fetch → `ArrayBuffer` → SHA-256.
    3. `signHash(thumb, hash)` + `readCertificate(thumb)`.
    4. RPC `sign_document_adhoc(p_documento_id, p_versao_id, p_hash, p_certificado, p_intent)`.
    5. Atualizar item para sucesso/erro.
  - Concorrência = 1 (evita múltiplos diálogos no desktop). `useRef({cancel:false})` para interromper.

**Backend**

- Nada a fazer. `sign_document_adhoc` já existe e cobre exatamente esse caso.

## Limitações exibidas na UI

- Cada PDF gera uma confirmação no app desktop (não há "auto-aprovar" — exigência de segurança do token).
- Tokens A3 podem pedir PIN a cada assinatura conforme o driver.
- Apenas PDFs entram no lote; outros formatos ficam selecionáveis somente para outras ações futuras (no momento o checkbox fica desabilitado).
- Selo visual + manifesto continuam sendo aplicados no momento do download (lógica já implementada).

## Arquivos

```text
src/pages/dashboard/Documents.tsx                         (modo seleção + barra)
src/components/dashboard/documents/BulkSignDialog.tsx     (novo)
```
