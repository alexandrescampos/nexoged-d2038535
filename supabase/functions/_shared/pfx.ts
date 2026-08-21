// Utilitários de leitura de certificados A1 (PKCS#12).
// Roda no Deno via compatibilidade npm. Nunca logar buffers, PEM ou senha.
import forge from "npm:node-forge@1.3.1";

export interface CertInspection {
  titularNome: string;
  titularDocumento: string | null;
  emissor: string;
  serialNumber: string;
  validoDe: Date;
  validoAte: Date;
  fingerprint: string;
}

/** Converte base64 -> binary string (formato exigido pelo node-forge). */
export function b64ToBinary(b64: string): string {
  return atob(b64);
}

function sha256HexFromBinary(binary: string): string {
  const md = forge.md.sha256.create();
  md.update(binary);
  return md.digest().toHex();
}

function attrsToMap(attributes: Array<{ name?: string; type?: string; value?: unknown }>) {
  const map: Record<string, string> = {};
  for (const attr of attributes) {
    const key = attr.name || attr.type || "";
    if (key) map[key] = String(attr.value ?? "");
  }
  return map;
}

/** UTF-8 -> "binary string" (1 byte por caractere), formato exigido pelo forge. */
function toUtf8Binary(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((b) => String.fromCharCode(b))
    .join("");
}

/**
 * Abre o PKCS#12 tentando as combinações de codificação de senha aceitas na prática.
 *
 * Porquê: o node-forge trata a senha de formas diferentes em cada etapa —
 * o MAC e o PBES1 (PKCS#12 KDF) usam os code points do texto, enquanto o PBES2
 * (AES/PBKDF2, padrão do OpenSSL 3) espera os bytes UTF-8. Com senha acentuada
 * nenhuma string única funciona nas duas etapas, e o erro resultante era
 * reportado como "senha_incorreta". Aqui aplicamos um patch temporário no
 * pbkdf2 para converter a senha em UTF-8 apenas nessa etapa.
 */
function openPkcs12(asn1: unknown, password: string): any {
  const pwVariants = Array.from(new Set([password, password.trim(), toUtf8Binary(password)]));
  const originalPbkdf2 = forge.pkcs5.pbkdf2;

  let lastError: unknown = null;
  for (const utf8Pbkdf2 of [true, false]) {
    // deno-lint-ignore no-explicit-any
    (forge.pkcs5 as any).pbkdf2 = utf8Pbkdf2
      ? (pw: string, ...rest: unknown[]) =>
        // deno-lint-ignore no-explicit-any
        (originalPbkdf2 as any)(toUtf8Binary(pw), ...rest)
      : originalPbkdf2;
    try {
      for (const candidate of pwVariants) {
        try {
          return forge.pkcs12.pkcs12FromAsn1(asn1, false, candidate);
        } catch (e) {
          lastError = e;
        }
      }
    } finally {
      // deno-lint-ignore no-explicit-any
      (forge.pkcs5 as any).pbkdf2 = originalPbkdf2;
    }
  }

  const msg = String((lastError as Error)?.message || "").toLowerCase();
  // node-forge não suporta alguns algoritmos de PKCS#12 (ex.: RC2 antigo).
  if (msg.includes("unsupported") || msg.includes("cannot read")) {
    throw new Error("formato_nao_suportado");
  }
  throw new Error("senha_incorreta");
}


/**
 * Abre o PKCS#12 e extrai metadados do certificado do titular.
 * Lança "senha_incorreta" quando a senha não abre o arquivo.
 */
export function inspectPfx(pfxBase64: string, password: string): CertInspection {
  const binary = b64ToBinary(pfxBase64);

  let asn1;
  try {
    asn1 = forge.asn1.fromDer(binary);
  } catch (_e) {
    // Não é um PKCS#12 válido (arquivo corrompido ou formato errado).
    throw new Error("arquivo_invalido");
  }

  const p12 = openPkcs12(asn1, password);



  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const bag = certBags.find((b: { cert?: unknown }) => b.cert) ?? certBags[0];
  if (!bag?.cert) throw new Error("certificado_nao_encontrado");

  const cert = bag.cert;
  const subject = attrsToMap(cert.subject.attributes);
  const commonName = subject["commonName"] || subject["CN"] || "Titular desconhecido";

  // CPF/CNPJ costuma vir dentro do CN ("NOME:12345678901") ou em extensões OtherName.
  let documento: string | null = null;
  const cnMatch = commonName.match(/:(\d{11,14})\s*$/);
  if (cnMatch) documento = cnMatch[1];
  if (!documento) {
    const raw = subject["CNPJ"] || subject["CPF"] || "";
    const digits = String(raw).replace(/\D/g, "");
    if (digits.length === 11 || digits.length === 14) documento = digits;
  }

  const emissor = cert.issuer.attributes
    .map((a: { name?: string; type?: string; value?: unknown }) => `${a.name || a.type}=${a.value}`)
    .join(", ");

  return {
    titularNome: commonName.replace(/:(\d{11,14})\s*$/, "").trim(),
    titularDocumento: documento,
    emissor,
    serialNumber: String(cert.serialNumber || ""),
    validoDe: cert.validity.notBefore,
    validoAte: cert.validity.notAfter,
    fingerprint: sha256HexFromBinary(binary),
  };
}
