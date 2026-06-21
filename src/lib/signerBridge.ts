// NexoGED Assinador — cliente da ponte local (desktop bridge).
// O app desktop "NexoGED Assinador" expõe HTTP em 127.0.0.1:59123.
// Esta camada substitui o antigo Lacuna Web PKI mantendo a mesma API pública
// (initPki / listCertificates / readCertificate / signHash / sha256Hex)
// para reduzir o impacto no SignatureCaptureModal.

const BRIDGE_PORTS = [59123, 59124, 59125]; // tenta portas alternativas se ocupada
const PAIR_KEY = "nexoged.signer.pairToken";
const ENDPOINT_KEY = "nexoged.signer.endpoint";

export interface PkiCertificate {
  thumbprint: string;
  subjectName: string;
  issuerName: string;
  email?: string;
  validityStart?: string;
  validityEnd?: string;
  pkiBrazil?: {
    cpf?: string;
    cnpj?: string;
    responsavel?: string;
    [k: string]: unknown;
  };
  serialNumber?: string;
  source?: "A1-OS" | "A3-PKCS11";
}

export interface BridgeHealth {
  ok: true;
  version: string;
  platform: "win32" | "darwin" | "linux";
}

type BridgeProbeErrorReason = "http-error" | "timeout" | "network-or-cors" | "invalid-response";

type LoopbackRequestInit = RequestInit & {
  targetAddressSpace?: "loopback";
};

interface BridgeProbeError {
  port: number;
  reason: BridgeProbeErrorReason;
  status?: number;
  message?: string;
}

let cachedEndpoint: string | null = null;

function fetchLoopback(input: string, init: RequestInit = {}): Promise<Response> {
  const requestInit: LoopbackRequestInit = {
    ...init,
    mode: "cors",
    targetAddressSpace: "loopback",
  };
  return fetch(input, requestInit);
}

function getStoredPairToken(): string | null {
  try { return localStorage.getItem(PAIR_KEY); } catch { return null; }
}

function getStoredEndpoint(): string | null {
  try { return localStorage.getItem(ENDPOINT_KEY); } catch { return null; }
}

export function getBridgePort(): string {
  const endpoint = cachedEndpoint || getStoredEndpoint() || `http://127.0.0.1:${BRIDGE_PORTS[0]}`;
  return endpoint.split(":").pop() || String(BRIDGE_PORTS[0]);
}

export function setBridgePort(port: string | number) {
  const normalized = Number(String(port).replace(/\D/g, ""));
  if (!BRIDGE_PORTS.includes(normalized)) throw new Error("invalid-bridge-port");
  cachedEndpoint = `http://127.0.0.1:${normalized}`;
  try { localStorage.setItem(ENDPOINT_KEY, cachedEndpoint); } catch { /* localStorage unavailable */ }
}

export function setPairToken(token: string) {
  try { localStorage.setItem(PAIR_KEY, token.trim()); } catch { /* localStorage unavailable */ }
}

export function clearPairToken() {
  try { localStorage.removeItem(PAIR_KEY); } catch { /* localStorage unavailable */ }
}

export function getPairToken(): string | null {
  return getStoredPairToken();
}

async function probe(port: number): Promise<{ health: BridgeHealth | null; error?: BridgeProbeError }> {
  try {
    const r = await fetchLoopback(`http://127.0.0.1:${port}/health`, {
      method: "GET",
      cache: "no-store",
      // 1.5s budget per port
      signal: AbortSignal.timeout(1500),
    });
    if (!r.ok) return { health: null, error: { port, reason: "http-error", status: r.status } };
    const j = await r.json();
    if (j && j.ok) return { health: j as BridgeHealth };
    return { health: null, error: { port, reason: "invalid-response" } };
  } catch (e: unknown) {
    const name = String((e as { name?: unknown })?.name || "");
    return {
      health: null,
      error: {
        port,
        reason: name === "TimeoutError" ? "timeout" : "network-or-cors",
        message: String((e as { message?: unknown })?.message || e || ""),
      },
    };
  }
}

/** Detecta a ponte local. Lança erro tipado se ausente. */
export async function initPki(): Promise<BridgeHealth> {
  // tenta endpoint cacheado primeiro
  if (cachedEndpoint) {
    const port = Number(cachedEndpoint.split(":").pop());
    const result = await probe(port);
    if (result.health) return result.health;
    cachedEndpoint = null;
  }
  const stored = getStoredEndpoint();
  const ports = stored ? [Number(stored.split(":").pop()), ...BRIDGE_PORTS] : BRIDGE_PORTS;
  const errors: BridgeProbeError[] = [];
  for (const p of ports) {
    if (!p) continue;
    const result = await probe(p);
    if (result.health) {
      cachedEndpoint = `http://127.0.0.1:${p}`;
      try { localStorage.setItem(ENDPOINT_KEY, cachedEndpoint); } catch { /* localStorage unavailable */ }
      return result.health;
    }
    if (result.error) errors.push(result.error);
  }
  const firstNetworkOrCors = errors.find((e) => e.reason === "network-or-cors");
  if (firstNetworkOrCors) throw new Error(`bridge-local-blocked:${firstNetworkOrCors.port}:${firstNetworkOrCors.message || "failed-to-fetch"}`);
  const firstHttp = errors.find((e) => e.reason === "http-error");
  if (firstHttp) throw new Error(`bridge-http-error:${firstHttp.port}:${firstHttp.status}`);
  throw new Error("bridge-not-running");
}

export function resetPki() {
  cachedEndpoint = null;
}

async function bridgeFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!cachedEndpoint) await initPki();
  const token = getStoredPairToken();
  const headers = new Headers(init?.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("X-Pair-Token", token);
  const r = await fetchLoopback(`${cachedEndpoint}${path}`, { ...init, headers });
  if (r.status === 401) throw new Error("bridge-unpaired");
  if (r.status === 403) throw new Error("bridge-origin-blocked");
  return r;
}

export async function listCertificates(): Promise<PkiCertificate[]> {
  const r = await bridgeFetch("/certs", { method: "GET" });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error("bridge-list-failed:" + r.status + ":" + t);
  }
  const j = await r.json();
  return (j?.certs || []) as PkiCertificate[];
}

export async function readCertificate(thumbprint: string): Promise<string> {
  const r = await bridgeFetch("/cert", {
    method: "POST",
    body: JSON.stringify({ thumbprint }),
  });
  if (!r.ok) throw new Error("bridge-readcert-failed:" + r.status);
  const j = await r.json();
  return j.certificateB64 as string;
}

export async function signHash(thumbprint: string, hashHex: string, intent?: string): Promise<string> {
  const r = await bridgeFetch("/sign", {
    method: "POST",
    body: JSON.stringify({ thumbprint, hashHex, digestAlgorithm: "SHA-256", intent: intent || "" }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    if (r.status === 409) throw new Error("user-cancelled");
    if (r.status === 423) throw new Error("token-pin-failed");
    throw new Error("bridge-sign-failed:" + r.status + ":" + t);
  }
  const j = await r.json();
  return j.signatureB64 as string;
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** URL da página interna de download/pareamento do assinador. */
export const SIGNER_INSTALL_URL = "/dashboard/assinador";

/** Mensagens user-friendly por código de erro do bridge. */
export function describeBridgeError(err: unknown): string {
  const msg = String((err as { message?: unknown })?.message || err || "");
  if (msg.includes("bridge-local-blocked")) return "O app NexoGED Assinador está aberto, mas o navegador bloqueou a conexão local com 127.0.0.1. Feche totalmente versões antigas na bandeja, abra a versão 0.1.3 ou superior e permita acesso à rede local se o navegador solicitar.";
  if (msg.includes("bridge-http-error")) return "O navegador chegou até a porta local, mas o assinador recusou a requisição. Feche o assinador pela bandeja, abra a versão 0.1.3 ou superior e tente novamente.";
  if (msg.includes("bridge-not-running")) return "O app NexoGED Assinador não está em execução nesta máquina.";
  if (msg.includes("bridge-unpaired")) return "Assinador detectado, mas não pareado. Cole o código de 6 dígitos exibido na bandeja do sistema.";
  if (msg.includes("bridge-origin-blocked")) return "Este domínio não está autorizado no assinador. Verifique a allowlist do app desktop.";
  if (msg.includes("user-cancelled")) return "Assinatura cancelada pelo usuário.";
  if (msg.includes("token-pin-failed")) return "PIN do token incorreto ou cancelado.";
  return msg;
}
