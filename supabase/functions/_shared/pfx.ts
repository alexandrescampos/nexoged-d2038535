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

/**
 * Abre o PKCS#12 e extrai metadados do certificado do titular.
 * Lança "senha_incorreta" quando a senha não abre o arquivo.
 */
export function inspectPfx(pfxBase64: string, password: string): CertInspection {
  const binary = b64ToBinary(pfxBase64);
  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(binary), false, password);
  } catch (_e) {
    throw new Error("senha_incorreta");
  }

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
