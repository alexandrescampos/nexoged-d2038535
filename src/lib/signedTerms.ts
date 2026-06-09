import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { captureGeolocation, type CapturedGeo } from "./geo";

export interface SealResult {
  file_path: string;
  file_name: string;
  signed_url: string | null;
  pdf_sha256: string;
  doc_sha256: string;
  signed_at_server: string;
  ip_address: string | null;
  geo_source: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Envia um PDF jsPDF (já com a assinatura embutida) para a edge function
 * `sign-epi-term`, que adiciona página de evidências, calcula SHA-256,
 * captura IP/User-Agent (servidor) + geolocalização (GPS ou fallback IP),
 * sela o documento em bucket privado e grava o registro imutável.
 */
export async function sealSignedTerm(params: {
  doc: jsPDF;
  employeeRecordId: string;
  deliveryDate: string;
  geo?: CapturedGeo;
  deliveryIds?: string[];
}): Promise<SealResult> {
  const { doc, employeeRecordId, deliveryDate, deliveryIds } = params;

  const geo = params.geo ?? (await captureGeolocation());
  const signedAtClient = new Date().toISOString();
  const blob = doc.output("blob") as Blob;
  const pdf_base64 = await blobToBase64(blob);

  const { data, error } = await supabase.functions.invoke("sign-epi-term", {
    body: {
      pdf_base64,
      employee_record_id: employeeRecordId,
      delivery_date: deliveryDate,
      signed_at_client: signedAtClient,
      geo,
      delivery_ids: deliveryIds ?? [],
    },
  });

  if (error) throw new Error(error.message || "Falha ao selar o termo assinado");
  if (!data) throw new Error("Resposta vazia do servidor");
  return data as SealResult;
}

/**
 * Resolve uma URL temporária (1h) para baixar/visualizar um termo assinado
 * a partir do `file_url` armazenado (path do bucket privado).
 * Aceita também URLs públicas legadas: nesse caso retorna a URL como está.
 */
export async function resolveSignedTermUrl(fileUrl: string): Promise<string> {
  // Legacy: full https URL stored
  if (/^https?:\/\//i.test(fileUrl)) {
    try {
      const u = new URL(fileUrl);
      const m = u.pathname.match(/\/signed-terms\/(.+)$/);
      if (!m) return fileUrl;
      const path = decodeURIComponent(m[1]);
      const { data } = await supabase.storage.from("signed-terms").createSignedUrl(path, 60 * 60);
      return data?.signedUrl ?? fileUrl;
    } catch {
      return fileUrl;
    }
  }
  // Stored as bucket path
  const { data, error } = await supabase.storage.from("signed-terms").createSignedUrl(fileUrl, 60 * 60);
  if (error || !data) throw new Error("Não foi possível gerar link do termo");
  return data.signedUrl;
}

/**
 * Faz download do termo assinado, aceitando tanto `file_url` legado (URL pública)
 * quanto novo formato (path do bucket privado).
 */
export async function downloadSignedTerm(fileUrl: string): Promise<Blob> {
  let path = fileUrl;
  if (/^https?:\/\//i.test(fileUrl)) {
    try {
      const u = new URL(fileUrl);
      const m = u.pathname.match(/\/signed-terms\/(.+)$/);
      if (m) path = decodeURIComponent(m[1]);
    } catch {
      // ignore, tentaremos como path
    }
  }
  const { data, error } = await supabase.storage.from("signed-terms").download(path);
  if (error || !data) throw error ?? new Error("Arquivo não encontrado");
  return data;
}

/** Abre um termo assinado em nova aba a partir do `file_url` armazenado. */
export async function openSignedTerm(fileUrl: string, fileName?: string): Promise<void> {
  const blob = await downloadSignedTerm(fileUrl);
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  
  if (fileName) {
    link.download = fileName;
  }
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}
