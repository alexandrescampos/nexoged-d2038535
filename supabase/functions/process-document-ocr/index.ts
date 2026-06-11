// Edge Function: process-document-ocr
// Extrai texto de documentos do GED e popula documento_ocr + documento_ocr_pagina.
// Suporta: PDF (texto nativo) via unpdf, DOCX via mammoth, imagens/PDF escaneado via tesseract.js (lang=por).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

async function extractPdfPages(buffer: ArrayBuffer): Promise<string[]> {
  const { getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
  const pdf: any = await getDocumentProxy(new Uint8Array(buffer));
  const pages: string[] = [];
  const total = pdf.numPages || 0;
  for (let i = 1; i <= total; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = (content.items || []) as Array<{ str?: string; hasEOL?: boolean }>;
      let text = "";
      for (const it of items) {
        text += (it.str || "");
        if (it.hasEOL) text += "\n";
        else text += " ";
      }
      pages.push(text.trim());
    } catch (err) {
      console.error("Erro extraindo página", i, err);
      pages.push("");
    }
  }
  return pages;
}



async function extractDocx(buffer: ArrayBuffer): Promise<string[]> {
  const mammoth = await import("https://esm.sh/mammoth@1.8.0");
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return [result.value || ""];
}

async function extractImageWithTesseract(buffer: ArrayBuffer, mime: string): Promise<string[]> {
  // Lazy import - tesseract.js is heavy
  // We use the 'worker-less' or single-threaded approach suitable for Edge Functions
  const { recognize } = await import("https://esm.sh/tesseract.js@5.1.1");
  const blob = new Blob([buffer], { type: mime });
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
  
  // Directly calling recognize without manual worker creation/termination
  // which is more compatible with environments lacking full Web Worker support
  const { data } = await recognize(dataUrl, "por", {
    logger: m => console.log(m)
  });
  
  return [data.text || ""];
}

async function processDocument(documentId: string, versionId: string | null) {
  const supa = admin();
  const start = Date.now();

  // Resolve organização e versão real ANTES de criar o registro de OCR
  const { data: docRow } = await supa.from("ged_documents").select("organization_id").eq("id", documentId).maybeSingle();
  const orgId = docRow?.organization_id;

  let version: any;
  if (versionId) {
    const { data } = await supa.from("ged_document_versions").select("*").eq("id", versionId).maybeSingle();
    version = data;
  } else {
    const { data } = await supa.from("ged_document_versions").select("*")
      .eq("document_id", documentId).order("version_number", { ascending: false }).limit(1).maybeSingle();
    version = data;
  }
  if (!version) throw new Error("Versão do documento não encontrada");

  const resolvedVersionId = version.id;

  // Limpa quaisquer OCRs antigos para este documento (mantém apenas um registro por documento — sempre o mais recente)
  await supa.from("documento_ocr").delete().eq("documento_id", documentId);

  // Cria registro inicial como "processando"
  await supa.from("documento_ocr").insert({
    documento_id: documentId,
    versao_id: resolvedVersionId,
    organization_id: orgId,
    status: "processando",
  });

  try {
    const { data: file, error: dlErr } = await supa.storage.from("ged_files").download(version.file_path);
    if (dlErr || !file) throw new Error("Falha ao baixar arquivo: " + (dlErr?.message || "desconhecido"));

    const buffer = await file.arrayBuffer();
    const mime = (version.mime_type || "").toLowerCase();
    const fname = (version.file_name || "").toLowerCase();

    let pages: string[] = [];
    if (mime.includes("pdf") || fname.endsWith(".pdf")) {
      try {
        pages = await extractPdfPages(buffer);
        const totalChars = pages.reduce((s, p) => s + (p?.length || 0), 0);
        if (totalChars < 30) {
          pages = pages.map((p, i) => p || `[Página ${i + 1}: PDF escaneado — OCR pendente]`);
        }
      } catch (e) {
        console.error("Erro pdf:", e);
        pages = ["[Falha ao extrair texto do PDF]"];
      }
    } else if (mime.includes("word") || fname.endsWith(".docx")) {
      pages = await extractDocx(buffer);
    } else if (mime.startsWith("image/") || /\.(png|jpe?g|tiff?)$/i.test(fname)) {
      pages = await extractImageWithTesseract(buffer, mime || "image/png");
    } else {
      pages = ["[Tipo de arquivo não suportado para OCR]"];
    }

    const fullText = pages.join("\n\n");

    // Atualiza o registro de OCR com o resultado final
    const { data: ocrRow, error: ocrErr } = await supa.from("documento_ocr").update({
      texto_extraido: fullText,
      total_paginas: pages.length,
      status: "processado",
      data_processamento: new Date().toISOString(),
      tempo_processamento_ms: Date.now() - start,
      erro_processamento: null,
    }).eq("documento_id", documentId).eq("versao_id", resolvedVersionId).select("ocr_id").single();
    if (ocrErr) throw ocrErr;

    // Insere as páginas (a tabela já estava limpa pela cascade do delete inicial)
    if (pages.length) {
      const rows = pages.map((texto, idx) => ({
        ocr_id: ocrRow.ocr_id,
        documento_id: documentId,
        organization_id: orgId,
        numero_pagina: idx + 1,
        texto_pagina: texto,
      }));
      await supa.from("documento_ocr_pagina").insert(rows);
    }

    // Atualiza fila
    await supa.from("documento_ocr_fila")
      .update({ status: "processado", finalizado_em: new Date().toISOString() })
      .eq("documento_id", documentId).in("status", ["pendente", "processando"]);

    await supa.from("documento_ocr_auditoria").insert({
      organization_id: orgId,
      documento_id: documentId,
      acao: "ocr_executado",
      payload: { total_paginas: pages.length, tempo_ms: Date.now() - start },
    });

    return { ok: true, pages: pages.length };

  } catch (e: any) {
    console.error("OCR erro:", e);
    const { data: orgRow } = await supa.from("ged_documents").select("organization_id").eq("id", documentId).maybeSingle();
    await supa.from("documento_ocr").upsert({
      documento_id: documentId,
      versao_id: versionId,
      organization_id: orgRow?.organization_id,
      status: "erro",
      erro_processamento: String(e?.message || e),
      data_processamento: new Date().toISOString(),
    }, { onConflict: "documento_id,versao_id" });

    await supa.from("documento_ocr_fila")
      .update({ status: "erro", ultimo_erro: String(e?.message || e), finalizado_em: new Date().toISOString() })
      .eq("documento_id", documentId).in("status", ["pendente", "processando"]);

    await supa.from("documento_ocr_auditoria").insert({
      organization_id: orgRow?.organization_id,
      documento_id: documentId,
      acao: "ocr_erro",
      payload: { erro: String(e?.message || e) },
    });
    return { ok: false, error: String(e?.message || e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { documentId, versionId, processQueue } = body;

    // Modo: processar fila (pg_cron pode chamar com processQueue=true)
    if (processQueue) {
      const supa = admin();
      const { data: items } = await supa.from("documento_ocr_fila")
        .select("documento_id, versao_id")
        .eq("status", "pendente")
        .lte("agendado_para", new Date().toISOString())
        .order("prioridade", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(3);
      const results = [];
      for (const it of items || []) {
        await supa.from("documento_ocr_fila")
          .update({ status: "processando", iniciado_em: new Date().toISOString() })
          .eq("documento_id", it.documento_id).eq("status", "pendente");
        results.push(await processDocument(it.documento_id, it.versao_id));
      }
      return new Response(JSON.stringify({ processed: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!documentId) {
      return new Response(JSON.stringify({ error: "documentId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await processDocument(documentId, versionId || null);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.ok ? 200 : 500,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
