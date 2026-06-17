// Lacuna Web PKI wrapper for ICP-Brasil A1/A3 token signing.
// Docs: https://docs.lacunasoftware.com/articles/web-pki/get-started
import { LacunaWebPKI } from "web-pki";

export interface PkiCertificate {
  thumbprint: string;
  subjectName: string;
  issuerName: string;
  email?: string;
  validityStart?: string;
  validityEnd?: string;
  pkiBrazil?: any;
  serialNumber?: string;
}

export interface PkiSignResult {
  signature: string; // base64
  certificate: PkiCertificate;
  certificateBase64: string;
}

let pkiInstance: any = null;
let initPromise: Promise<any> | null = null;

const LICENSE = (import.meta as any).env?.VITE_LACUNA_WEB_PKI_LICENSE || null;

function getPki() {
  if (!pkiInstance) pkiInstance = new (LacunaWebPKI as any)(LICENSE);
  return pkiInstance;
}

/** Initializes Web PKI. Resolves when the extension/component is ready. */
export function initPki(): Promise<void> {
  if (initPromise) return initPromise;
  const pki = getPki();
  initPromise = new Promise((resolve, reject) => {
    pki.init({
      ready: () => resolve(undefined),
      notInstalled: (status: any, message: string) => {
        reject(new Error(`web-pki-not-installed:${status}:${message}`));
      },
      defaultError: (msg: string, error: any) => {
        reject(new Error(`web-pki-error:${msg}:${JSON.stringify(error)}`));
      },
    });
  });
  return initPromise;
}

export function resetPki() {
  pkiInstance = null;
  initPromise = null;
}

export async function listCertificates(): Promise<PkiCertificate[]> {
  await initPki();
  return new Promise((resolve, reject) => {
    getPki()
      .listCertificates()
      .success((certs: PkiCertificate[]) => resolve(certs || []))
      .error((err: any) => reject(new Error(typeof err === "string" ? err : JSON.stringify(err))));
  });
}

export async function readCertificate(thumbprint: string): Promise<string> {
  await initPki();
  return new Promise((resolve, reject) => {
    getPki()
      .readCertificate({ thumbprint })
      .success((b64: string) => resolve(b64))
      .error((err: any) => reject(new Error(typeof err === "string" ? err : JSON.stringify(err))));
  });
}

/** Signs a SHA-256 hash (hex) with the chosen certificate. */
export async function signHash(thumbprint: string, hashHex: string): Promise<string> {
  await initPki();
  // Convert hex to base64 (Lacuna expects base64).
  const bytes = new Uint8Array(hashHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const hashBase64 = btoa(String.fromCharCode(...bytes));
  return new Promise((resolve, reject) => {
    getPki()
      .signHash({ thumbprint, hash: hashBase64, digestAlgorithm: "SHA-256" })
      .success((signatureB64: string) => resolve(signatureB64))
      .error((err: any) => reject(new Error(typeof err === "string" ? err : JSON.stringify(err))));
  });
}

export const WEB_PKI_INSTALL_URL = "https://get.webpkiplugin.com/";

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
