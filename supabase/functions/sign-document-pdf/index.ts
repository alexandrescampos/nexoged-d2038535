// Assina digitalmente PDFs no servidor usando o certificado A1 cifrado do usuário
// ou da organização. Substitui o antigo assinador desktop.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { Buffer } from "node:buffer";
import signpdfDefault from "npm:@signpdf/signpdf@3.2.4";
import { pdflibAddPlaceholder } from "npm:@signpdf/placeholder-pdf-lib@3.2.4";
import { P12Signer } from "npm:@signpdf/signer-p12@3.2.4";

const signpdf = (signpdfDefault as unknown as { sign: (b: Buffer, s: unknown) => Promise<Buffer> });

const BodySchema = z.object({
  certificateId: z.string().uuid(),
  documentIds: z.array(z.string().uuid()).min(1).max(50),
  intent: z.string().max(500).optional(),
  // Quando informado, conclui uma etapa de assinatura do fluxo em vez de criar uma avulsa
  assinaturaId: z.string().uuid().optional(),
  tipo: z.enum(["SIMPLES", "AVANCADA", "QUALIFICADA"]).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface SignatureEntry {
  signer_name: string;
  tipo_assinatura: string;
  assinado_em: string | null;
  hash_evidencia: string | null;
  titular_documento?: string | null;
  emissor?: string | null;
}

/** Aplica rodapé em todas as páginas, o manifesto e o placeholder da assinatura. */
async function buildStampedPdf(
  originalBytes: Uint8Array,
  signatures: SignatureEntry[],
  documentTitle: string,
  signerName: string,
  contactInfo: string,
  reason: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();
  const firstHash = signatures[0]?.hash_evidencia?.slice(0, 12) || "";
  const footerText =
    `Assinado digitalmente • ${signatures.length} assinatura(s) • Hash ${firstHash}… • Manifesto na última página`;

  pages.forEach((page, idx) => {
    const { width } = page.getSize();
    page.drawRectangle({ x: 0, y: 0, width, height: 18, color: rgb(0.082, 0.137, 0.255) });
    page.drawText(footerText, { x: 10, y: 6, size: 7, font, color: rgb(1, 1, 1) });
    page.drawText(`Pág. ${idx + 1}/${pages.length}`, {
      x: width - 60, y: 6, size: 7, font, color: rgb(1, 1, 1),
    });
  });

  const manifest = pdfDoc.addPage();
  const { width, height } = manifest.getSize();
  const primary = rgb(0.082, 0.396, 0.753);
  const dark = rgb(0.082, 0.137, 0.255);

  manifest.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: dark });
  manifest.drawText("MANIFESTO DE ASSINATURAS DIGITAIS", {
    x: 40, y: height - 38, size: 16, font: fontBold, color: rgb(1, 1, 1),
  });

  let y = height - 90;
  manifest.drawText(`Documento: ${documentTitle.slice(0, 80)}`, { x: 40, y, size: 11, font: fontBold });
  y -= 16;
  manifest.drawText(`Total de assinaturas: ${signatures.length}`, { x: 40, y, size: 10, font });
  y -= 14;
  manifest.drawText(`Gerado em: ${formatDate(new Date().toISOString())}`, { x: 40, y, size: 10, font });
  y -= 24;
  manifest.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: primary });
  y -= 20;

  let page = manifest;
  for (let idx = 0; idx < signatures.length; idx++) {
    if (y < 130) {
      page = pdfDoc.addPage();
      y = page.getHeight() - 60;
    }
    const sig = signatures[idx];
    page.drawRectangle({
      x: 40, y: y - 88, width: page.getWidth() - 80, height: 92,
      borderColor: primary, borderWidth: 0.8, color: rgb(0.97, 0.98, 1),
    });
    page.drawText(`#${idx + 1} — ${(sig.signer_name || "Signatário").slice(0, 70)}`, {
      x: 50, y: y - 14, size: 11, font: fontBold, color: primary,
    });
    const lines = [
      `Documento do titular: ${sig.titular_documento || "—"}`,
      `Emissor: ${(sig.emissor || "—").slice(0, 95)}`,
      `Tipo: ${sig.tipo_assinatura || "—"}`,
      `Assinado em: ${formatDate(sig.assinado_em)}`,
      `Hash de evidência: ${sig.hash_evidencia || "—"}`,
    ];
    let ly = y - 30;
    for (const l of lines) {
      page.drawText(l.length > 110 ? l.slice(0, 107) + "..." : l, { x: 50, y: ly, size: 8.5, font });
      ly -= 12;
    }
    y -= 100;
  }

  manifest.drawText("Este manifesto comprova as assinaturas registradas no sistema Nexo GED.", {
    x: 40, y: 30, size: 8, font, color: rgb(0.4, 0.4, 0.4),
  });

  pdflibAddPlaceholder({
    pdfDoc,
    reason: reason || "Assinatura digital de documento",
    contactInfo: contactInfo || "nexoged",
    name: signerName.slice(0, 90),
    location: "Nexo GED",
  });

  return await pdfDoc.save({ useObjectStreams: false });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "not-authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "not-authenticated" }, 401);
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { certificateId, documentIds, intent } = parsed.data;

    // Confere se o certificado pertence ao usuário/organização dele
    const { data: available } = await userClient.rpc("cert_list_available");
    const allowed = (available ?? []).find((c: { id: string }) => c.id === certificateId);
    if (!allowed) return json({ error: "certificado_indisponivel" }, 403);
    if (new Date(allowed.valido_ate) < new Date()) return json({ error: "certificado_vencido" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: material, error: matErr } = await admin
      .rpc("cert_get_material", { p_id: certificateId })
      .maybeSingle();
    if (matErr || !material) return json({ error: "certificado_indisponivel" }, 403);

    const p12Buffer = Buffer.from(material.pfx_b64, "base64");
    const signer = new P12Signer(p12Buffer, { passphrase: material.senha });

    const { data: profile } = await userClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    const results: Array<{ documentId: string; ok: boolean; error?: string }> = [];

    for (const documentId of documentIds) {
      try {
        const { data: doc, error: docErr } = await userClient
          .from("ged_documents")
          .select("id, title, organization_id, current_version_id")
          .eq("id", documentId)
          .maybeSingle();
        if (docErr || !doc) throw new Error("documento_nao_encontrado");

        const { data: version } = await userClient
          .from("ged_document_versions")
          .select("id, file_path, file_name, mime_type")
          .eq("id", doc.current_version_id)
          .maybeSingle();
        if (!version) throw new Error("versao_nao_encontrada");
        const isPdf = (version.mime_type || "").includes("pdf") ||
          version.file_name.toLowerCase().endsWith(".pdf");
        if (!isPdf) throw new Error("apenas_pdf");

        const { data: fileBlob, error: dlErr } = await userClient.storage
          .from("ged_files")
          .download(version.file_path);
        if (dlErr || !fileBlob) throw new Error("falha_download");
        const originalBytes = new Uint8Array(await fileBlob.arrayBuffer());

        const { data: previous } = await userClient
          .from("documento_assinatura")
          .select("assinado_em, hash_evidencia, tipo_assinatura, certificado_info")
          .eq("documento_id", documentId)
          .eq("status", "ASSINADA");

        const history: SignatureEntry[] = (previous ?? []).map((s: Record<string, unknown>) => {
          const info = (s.certificado_info ?? {}) as Record<string, unknown>;
          return {
            signer_name: String(info.titular_nome ?? profile?.full_name ?? "Signatário"),
            titular_documento: (info.titular_documento as string) ?? null,
            emissor: (info.emissor as string) ?? null,
            tipo_assinatura: String(s.tipo_assinatura ?? "QUALIFICADA"),
            assinado_em: (s.assinado_em as string) ?? null,
            hash_evidencia: (s.hash_evidencia as string) ?? null,
          };
        });

        const newEntry: SignatureEntry = {
          signer_name: material.titular_nome,
          titular_documento: material.titular_documento,
          emissor: material.emissor,
          tipo_assinatura: "QUALIFICADA",
          assinado_em: new Date().toISOString(),
          hash_evidencia: await sha256Hex(originalBytes),
        };

        const stamped = await buildStampedPdf(
          originalBytes,
          [...history, newEntry],
          doc.title,
          material.titular_nome,
          profile?.email ?? "",
          intent ?? "Assinatura digital de documento",
        );

        const signedBuffer = await signpdf.sign(Buffer.from(stamped), signer);
        const signedBytes = new Uint8Array(signedBuffer);
        const finalHash = await sha256Hex(signedBytes);

        const baseName = version.file_name.replace(/\.pdf$/i, "");
        const newFileName = `${baseName}-assinado.pdf`;
        const path = `${doc.organization_id}/${documentId}/${Date.now()}_${newFileName}`;
        const { error: upErr } = await userClient.storage
          .from("ged_files")
          .upload(path, signedBytes, { contentType: "application/pdf", upsert: false });
        if (upErr) throw new Error("falha_upload");

        const { data: newVersion, error: verErr } = await userClient.rpc("create_document_version", {
          p_document_id: documentId,
          p_bump_type: "minor",
          p_change_description: `Assinatura digital por ${material.titular_nome}`,
          p_file_path: path,
          p_file_name: newFileName,
          p_file_size: signedBytes.byteLength,
          p_mime_type: "application/pdf",
          p_title: null,
          p_based_on: version.id,
          p_is_restoration: false,
        });
        if (verErr) throw new Error("falha_versao");

        const { error: signErr } = await userClient.rpc("sign_document_adhoc", {
          p_documento_id: documentId,
          p_versao_id: (newVersion as { id: string }).id,
          p_hash: finalHash,
          p_certificado: {
            tipo: "A1",
            origem: "servidor",
            titular_nome: material.titular_nome,
            titular_documento: material.titular_documento,
            emissor: material.emissor,
            serial_number: material.serial_number,
            valido_ate: material.valido_ate,
            certificado_id: certificateId,
          },
          p_intent: intent ?? null,
        });
        if (signErr) throw new Error("falha_registro_assinatura");

        results.push({ documentId, ok: true });
      } catch (e) {
        results.push({ documentId, ok: false, error: String((e as Error).message || "erro") });
      }
    }

    return json({ results });
  } catch (_e) {
    return json({ error: "erro_inesperado" }, 500);
  }
});
