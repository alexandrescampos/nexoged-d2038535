import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fmtBrasilia(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

async function geoFromIp(ip: string | null): Promise<
  { lat?: number; lng?: number; accuracy?: number; source: string; raw?: string } | null
> {
  if (!ip) return null;
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.latitude && data?.longitude) {
      return {
        lat: Number(data.latitude),
        lng: Number(data.longitude),
        accuracy: 10000,
        source: "ip",
        raw: `${data.city ?? ""}, ${data.region ?? ""}, ${data.country_name ?? ""}`,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

async function appendEvidencePage(
  pdfBytes: Uint8Array,
  ev: {
    employeeName: string;
    employeeCpf: string;
    employeeId: string;
    operatorName: string;
    operatorEmail: string;
    operatorId: string;
    signedAtServer: string;
    signedAtClient: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    geoLat: number | null;
    geoLng: number | null;
    geoAccuracy: number | null;
    geoSource: string | null;
    docHash: string;
  },
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const drawTitle = (t: string) => {
    page.drawText(t, { x: 40, y, size: 14, font: bold, color: rgb(0, 0, 0) });
    y -= 22;
  };
  const drawRow = (label: string, value: string) => {
    page.drawText(label, { x: 40, y, size: 9, font: bold, color: rgb(0.2, 0.2, 0.2) });
    const wrapped = wrap(value || "—", 75);
    wrapped.forEach((line, i) => {
      page.drawText(line, {
        x: 180,
        y: y - i * 11,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });
    });
    y -= Math.max(14, wrapped.length * 11 + 4);
  };

  drawTitle("REGISTRO DE ASSINATURA ELETRÔNICA");
  page.drawLine({ start: { x: 40, y: y + 6 }, end: { x: 555, y: y + 6 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
  y -= 6;

  drawRow("Signatário (funcionário):", ev.employeeName);
  drawRow("CPF:", ev.employeeCpf);
  drawRow("ID interno do funcionário:", ev.employeeId);
  drawRow("Operador (coletor):", `${ev.operatorName} <${ev.operatorEmail}>`);
  drawRow("ID do operador:", ev.operatorId);
  drawRow("Carimbo de tempo (servidor UTC):", ev.signedAtServer);
  drawRow("Carimbo de tempo (Brasília):", fmtBrasilia(ev.signedAtServer));
  drawRow("Hora declarada pelo cliente:", ev.signedAtClient ?? "—");
  drawRow("Endereço IP:", ev.ipAddress ?? "—");
  drawRow("User-Agent:", ev.userAgent ?? "—");
  const geoStr =
    ev.geoLat != null && ev.geoLng != null
      ? `${ev.geoLat.toFixed(6)}, ${ev.geoLng.toFixed(6)} (precisão ~${Math.round(ev.geoAccuracy ?? 0)}m, fonte: ${ev.geoSource})`
      : `não disponível (fonte: ${ev.geoSource ?? "—"})`;
  drawRow("Geolocalização:", geoStr);
  drawRow("Hash SHA-256 (documento):", ev.docHash);
  drawRow(
    "Base legal:",
    "MP 2.200-2/2001 (ICP-Brasil) e Lei 14.063/2020 — Assinatura eletrônica simples com captura de evidências.",
  );

  y -= 10;
  page.drawText(
    "Este registro comprova a integridade e autoria da assinatura coletada. O hash SHA-256 acima",
    { x: 40, y, size: 8, font, color: rgb(0.3, 0.3, 0.3) },
  );
  y -= 11;
  page.drawText(
    "permite verificação posterior: qualquer alteração no documento original gera hash diferente.",
    { x: 40, y, size: 8, font, color: rgb(0.3, 0.3, 0.3) },
  );

  return await pdfDoc.save();
}

function wrap(text: string, max: number): string[] {
  if (!text) return ["—"];
  if (text.length <= max) return [text];
  const out: string[] = [];
  let s = text;
  while (s.length > max) {
    out.push(s.slice(0, max));
    s = s.slice(max);
  }
  if (s) out.push(s);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userRes?.user) return json(401, { error: "Sessão expirada. Faça login novamente." });

    const admin = createClient(supabaseUrl, serviceKey);
    const userId = userRes.user.id;

    const body = await req.json();
    const {
      pdf_base64,
      employee_record_id,
      delivery_date,
      signed_at_client,
      geo,
      delivery_ids,
    }: {
      pdf_base64?: string;
      employee_record_id?: string;
      delivery_date?: string;
      signed_at_client?: string | null;
      geo?: { source: string; lat?: number; lng?: number; accuracy?: number } | null;
      delivery_ids?: string[];
    } = body ?? {};

    if (!pdf_base64 || !employee_record_id || !delivery_date) {
      return json(400, { error: "pdf_base64, employee_record_id e delivery_date são obrigatórios" });
    }

    const ipHeader = req.headers.get("x-forwarded-for") ?? "";
    const ipAddress = ipHeader.split(",")[0].trim() || null;
    const userAgent = req.headers.get("user-agent") ?? null;
    const signedAtServer = new Date().toISOString();

    const useGps = !!(geo && geo.source === "gps" && geo.lat != null && geo.lng != null);

    // Disparar lookups e geo-IP em paralelo — só aguardamos quando precisarmos
    const profilePromise = admin
      .from("profiles")
      .select("id, full_name, email, organization_id")
      .eq("id", userId)
      .maybeSingle();
    const empPromise = admin
      .from("employees")
      .select("id, name, cpf, organization_id")
      .eq("id", employee_record_id)
      .maybeSingle();
    const ipGeoPromise = useGps ? Promise.resolve(null) : geoFromIp(ipAddress);

    const [{ data: profile }, { data: emp }] = await Promise.all([profilePromise, empPromise]);

    if (!profile?.organization_id) return json(403, { error: "Sem organização" });
    if (!emp || emp.organization_id !== profile.organization_id) {
      return json(403, { error: "Funcionário inválido" });
    }

    let geoLat: number | null = null;
    let geoLng: number | null = null;
    let geoAccuracy: number | null = null;
    let geoSource: string = geo?.source ?? "unavailable";

    if (useGps) {
      geoLat = geo!.lat!;
      geoLng = geo!.lng!;
      geoAccuracy = geo!.accuracy ?? null;
    } else {
      const ipGeo = await ipGeoPromise;
      if (ipGeo) {
        geoLat = ipGeo.lat ?? null;
        geoLng = ipGeo.lng ?? null;
        geoAccuracy = ipGeo.accuracy ?? null;
        geoSource = "ip";
      }
    }

    // Hash do documento original (sem página de evidências) — calculado em paralelo
    const originalBytes = base64ToBytes(pdf_base64);
    const docHashPromise = sha256Hex(originalBytes);
    const docHash = await docHashPromise;

    // Anexa página de evidências
    const finalBytes = await appendEvidencePage(originalBytes, {
      employeeName: emp.name ?? "—",
      employeeCpf: emp.cpf ?? "—",
      employeeId: emp.id,
      operatorName: profile.full_name ?? "—",
      operatorEmail: profile.email ?? "—",
      operatorId: profile.id,
      signedAtServer,
      signedAtClient: signed_at_client ?? null,
      ipAddress,
      userAgent,
      geoLat,
      geoLng,
      geoAccuracy,
      geoSource,
      docHash,
    });

    const finalHash = await sha256Hex(finalBytes);

    // Upload bucket privado: pasta = organization_id (org-isolated RLS)
    const safeDate = delivery_date.replace(/[:T.+]/g, "-");
    const filePath = `${profile.organization_id}/${emp.id}/${safeDate}-${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await admin.storage
      .from("signed-terms")
      .upload(filePath, finalBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) return json(500, { error: `Upload falhou: ${upErr.message}` });

    const { data: signed } = await admin.storage
      .from("signed-terms")
      .createSignedUrl(filePath, 60 * 60);

    const fileName = `Termo_EPI_${(emp.name ?? "func").replace(/\s+/g, "_")}_${safeDate}.pdf`;
    // file_url permanece como referência ao path (não público)
    const { data: insertedTerm, error: dbErr } = await admin
      .from("epi_signed_terms")
      .insert({
        organization_id: profile.organization_id,
        employee_record_id: emp.id,
        delivery_date,
        file_name: fileName,
        file_url: filePath,
        uploaded_by: userId,
        signed_at_server: signedAtServer,
        signed_at_client: signed_at_client ?? null,
        pdf_sha256: finalHash,
        ip_address: ipAddress,
        user_agent: userAgent,
        geo_lat: geoLat,
        geo_lng: geoLng,
        geo_accuracy: geoAccuracy,
        geo_source: geoSource,
        signer_employee_name: emp.name,
        signer_employee_cpf: emp.cpf,
        operator_user_id: userId,
        operator_name: profile.full_name,
      })
      .select("id")
      .single();
    if (dbErr || !insertedTerm) {
      // rollback storage
      await admin.storage.from("signed-terms").remove([filePath]);
      return json(500, { error: `Insert falhou: ${dbErr?.message ?? "sem id"}` });
    }

    // Vincular as entregas específicas a este termo em background (não bloqueia resposta)
    if (Array.isArray(delivery_ids) && delivery_ids.length > 0) {
      const linkTask = admin
        .from("epi_deliveries")
        .update({ signed_term_id: insertedTerm.id })
        .in("id", delivery_ids)
        .eq("organization_id", profile.organization_id)
        .eq("employee_record_id", emp.id)
        .then(({ error: linkErr }) => {
          if (linkErr) console.error("Falha ao vincular entregas ao termo:", linkErr.message);
        });
      try {
        // @ts-ignore - EdgeRuntime é injetado pelo Supabase Edge Runtime
        EdgeRuntime.waitUntil(linkTask);
      } catch {
        await linkTask;
      }
    }

    return json(200, {
      file_path: filePath,
      file_name: fileName,
      signed_url: signed?.signedUrl ?? null,
      pdf_sha256: finalHash,
      doc_sha256: docHash,
      signed_at_server: signedAtServer,
      ip_address: ipAddress,
      geo_source: geoSource,
    });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
