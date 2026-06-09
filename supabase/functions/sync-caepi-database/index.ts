// Sincroniza a base oficial CAEPI do Ministério do Trabalho em CADEIA.
// Fases:
//  - start   : baixa o gz do MTE e armazena em storage (bucket caepi-sync).
//  - upload  : recebe arquivo binário .gz do Super Admin e armazena em storage.
//  - process : baixa o gz do storage via stream, pula `offset` linhas, processa
//              LINES_PER_RUN linhas (upserts em lotes), atualiza log e
//              auto-invoca a próxima execução até concluir o arquivo.
//  - cancel  : marca a execução em andamento como `cancelled`. O loop em
//              `process` detecta esse estado entre lotes e encerra.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Gunzip } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-upload-filename",
};

const CAEPI_PAGE = "https://caepi.mte.gov.br/internet/ConsultaCAInternet.aspx";
const BUCKET = "caepi-sync";
const GZ_PATH = "current.csv.gz";

const LINES_PER_RUN = 20000;
const UPSERT_BATCH = 1000;

function getField(html: string, name: string): string {
  const re = new RegExp(`name="${name.replace(/\$/g, "\\$")}"[^>]*value="([^"]*)"`);
  const m = html.match(re);
  return m ? m[1] : "";
}

function parseDateBR(s: string): string | null {
  if (!s) return null;
  const t = s.trim().replace(/^"|"$/g, "");
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQ = false; }
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ";") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function fetchCaepiStream(): Promise<ReadableStream<Uint8Array>> {
  const r1 = await fetch(CAEPI_PAGE, { headers: { "User-Agent": "Mozilla/5.0" } });
  const setCookie = r1.headers.get("set-cookie") || "";
  const cookies = setCookie.split(/,(?=[^;]+=)/).map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
  const html = await r1.text();

  const viewState = getField(html, "__VIEWSTATE");
  const viewStateGen = getField(html, "__VIEWSTATEGENERATOR");
  const eventValidation = getField(html, "__EVENTVALIDATION");
  if (!viewState || !eventValidation) throw new Error("ViewState/EventValidation não encontrados");

  const selectDefault = "*******Selecione*******";
  const form = new URLSearchParams();
  form.set("__EVENTTARGET", "ctl00$PlaceHolderConteudo$LinkButton1");
  form.set("__EVENTARGUMENT", "");
  form.set("__VIEWSTATE", viewState);
  form.set("__VIEWSTATEGENERATOR", viewStateGen);
  form.set("__EVENTVALIDATION", eventValidation);
  form.set("ctl00$ScriptManager1", "");
  form.set("ctl00$PlaceHolderConteudo$txtNumeroCA", "");
  form.set("ctl00$PlaceHolderConteudo$cboEquipamento", selectDefault);
  form.set("ctl00$PlaceHolderConteudo$cboFabricante", selectDefault);
  form.set("ctl00$PlaceHolderConteudo$cboTipoProtecao", selectDefault);

  const r2 = await fetch(CAEPI_PAGE, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": CAEPI_PAGE,
      "Cookie": cookies,
    },
    body: form.toString(),
    redirect: "manual",
  });

  const ct = r2.headers.get("content-type") || "";
  if (!r2.ok || !r2.body || (!ct.includes("gzip") && !ct.includes("octet-stream"))) {
    throw new Error(`Resposta inesperada do MTE: status ${r2.status} content-type ${ct}`);
  }
  return r2.body;
}

function selfInvoke(payload: Record<string, unknown>) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-caepi-database`;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify(payload),
  }).catch((e) => console.error("self-invoke failed", e));
}

// Verifica se o caller é Super Admin. Retorna {email} ou null.
async function requireSuperAdmin(supabase: any, req: Request): Promise<{ email: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader === "Bearer ") return null;
  const token = authHeader.replace("Bearer ", "");
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return { email: "service_role" };
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: roleRow } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
  if (!roleRow) return null;
  return { email: user.email ?? "super_admin" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const contentType = req.headers.get("content-type") || "";
  const url = new URL(req.url);
  const phaseFromQuery = url.searchParams.get("phase");

  // Para upload binário, payload vem no body; lemos phase da query string
  let payload: any = {};
  let phase: string;
  if (contentType.includes("application/json")) {
    try { payload = await req.json(); } catch { /* vazio */ }
    phase = payload.phase ?? phaseFromQuery ?? "start";
  } else if (phaseFromQuery) {
    phase = phaseFromQuery;
  } else {
    try { payload = await req.json(); } catch { /* vazio */ }
    phase = payload.phase ?? "start";
  }

  // ===================== CANCEL =====================
  if (phase === "cancel") {
    const admin = await requireSuperAdmin(supabase, req);
    if (!admin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error, count } = await supabase
      .from("caepi_sync_log")
      .update({
        status: "cancelled",
        finished_at: new Date().toISOString(),
        error_message: `cancelado por ${admin.email}`,
      }, { count: "exact" })
      .eq("status", "running");
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Limpa o arquivo do bucket — o próximo loop também tentaria mas adiantamos
    try { await supabase.storage.from(BUCKET).remove([GZ_PATH]); } catch { /* ignore */ }
    return new Response(JSON.stringify({ cancelled: count ?? 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ===================== UPLOAD =====================
  if (phase === "upload") {
    const admin = await requireSuperAdmin(supabase, req);
    if (!admin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria log
    const triggeredBy = `upload:${admin.email}`;
    const { data: logRow, error: logErr } = await supabase
      .from("caepi_sync_log")
      .insert({ status: "running", triggered_by: triggeredBy })
      .select("id").single();
    if (logErr || !logRow) {
      return new Response(JSON.stringify({ error: logErr?.message ?? "log insert failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const logId = logRow.id;
    const t0 = Date.now();

    try {
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (!bytes.length) throw new Error("Arquivo vazio");
      // Detecta gzip via magic number 1f 8b
      if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
        throw new Error("Arquivo precisa ser .csv.gz (gzip). Compacte o .txt extraído do zip do MTE.");
      }
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(GZ_PATH, bytes, { upsert: true, contentType: "application/gzip" });
      if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

      await supabase.from("caepi_sync_log").update({
        error_message: `arquivo carregado (${bytes.length} bytes); processando offset=0`,
      }).eq("id", logId);

      selfInvoke({ phase: "process", logId, offset: 0, processed: 0, t0 });

      return new Response(
        JSON.stringify({ accepted: true, log_id: logId, size: bytes.length }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err: any) {
      await supabase.from("caepi_sync_log").update({
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        status: "failed",
        error_message: String(err?.message ?? err).slice(0, 2000),
      }).eq("id", logId);
      return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ===================== START =====================
  if (phase === "start") {
    const authHeader = req.headers.get("Authorization");
    let triggeredBy = "cron";
    if (authHeader && authHeader !== "Bearer ") {
      const token = authHeader.replace("Bearer ", "");
      if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: roleRow } = await supabase
            .from("user_roles").select("role")
            .eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
          if (!roleRow) {
            return new Response(JSON.stringify({ error: "Forbidden" }), {
              status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          triggeredBy = `manual:${user.email}`;
        }
      }
    }

    // Se for execução automática (cron) e a flag estiver desligada, abortar
    if (triggeredBy === "cron") {
      const { data: setting } = await supabase
        .from("system_settings").select("value")
        .eq("key", "caepi_auto_sync_enabled").maybeSingle();
      const enabled = !setting || setting.value !== "false";
      if (!enabled) {
        console.log("[start] auto-sync desativado — ignorando execução do cron");
        return new Response(JSON.stringify({ skipped: true, reason: "auto_sync_disabled" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: logRow, error: logErr } = await supabase
      .from("caepi_sync_log")
      .insert({ status: "running", triggered_by: triggeredBy })
      .select("id").single();
    if (logErr || !logRow) {
      return new Response(JSON.stringify({ error: logErr?.message ?? "log insert failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const logId = logRow.id;
    const t0 = Date.now();

    const startTask = async () => {
      try {
        console.log("[start] baixando gz do MTE...");
        const body = await fetchCaepiStream();
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(GZ_PATH, body, { upsert: true, contentType: "application/gzip" });
        if (upErr) throw new Error(`Upload gz falhou: ${upErr.message}`);
        console.log("[start] gz armazenado em storage; iniciando cadeia de processamento");

        await supabase.from("caepi_sync_log").update({
          error_message: `download ok (${Date.now() - t0}ms); processando offset=0`,
        }).eq("id", logId);

        selfInvoke({ phase: "process", logId, offset: 0, processed: 0, t0 });
      } catch (err: any) {
        console.error("[start] erro:", err);
        await supabase.from("caepi_sync_log").update({
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - t0,
          status: "failed",
          error_message: String(err?.message ?? err).slice(0, 2000),
        }).eq("id", logId);
      }
    };

    // @ts-ignore EdgeRuntime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(startTask());
    } else {
      startTask();
    }

    return new Response(
      JSON.stringify({ accepted: true, log_id: logId, message: "Sincronização iniciada (modo cadeia)" }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ===================== PROCESS =====================
  if (phase === "process") {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const logId: string = payload.logId;
    const startOffset: number = payload.offset ?? 0;
    const totalProcessedSoFar: number = payload.processed ?? 0;
    const t0: number = payload.t0 ?? Date.now();

    // Cancelamento cooperativo: confere o status do log antes de processar
    const { data: logCheck } = await supabase
      .from("caepi_sync_log").select("status").eq("id", logId).maybeSingle();
    if (logCheck?.status === "cancelled") {
      console.log("[process] execução cancelada — abortando.");
      try { await supabase.storage.from(BUCKET).remove([GZ_PATH]); } catch { /* ignore */ }
      return new Response(JSON.stringify({ cancelled: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const processTask = async () => {
      try {
        console.log(`[process] offset=${startOffset} processed=${totalProcessedSoFar}`);
        const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(GZ_PATH);
        if (dlErr || !blob) throw new Error(`Download gz storage falhou: ${dlErr?.message}`);
        const body = blob.stream();

        const decoder = new TextDecoder("utf-8");
        let lineBuf = "";
        let headerSeen = false;
        let ix: Record<string, number> = {};
        let dataLinesSeen = 0;
        let processedThisRun = 0;
        let batch: any[] = [];
        const seen = new Set<string>();
        const nowIso = new Date().toISOString();
        let pendingFlush: Promise<void> = Promise.resolve();
        let reachedLimit = false;

        const flush = async () => {
          if (!batch.length) return;
          const toSend = batch;
          batch = [];
          const { error } = await supabase
            .from("caepi_certificates")
            .upsert(toSend, { onConflict: "ca_number" });
          if (error) throw new Error(`Upsert falhou: ${error.message}`);
        };

        const handleHeader = (line: string) => {
          const headers = parseCsvLine(line).map((h) => h.replace(/^\uFEFF+/, "").trim().toUpperCase());
          ix = {
            ca: headers.indexOf("NR REGISTRO CA"),
            validade: headers.indexOf("DATA DE VALIDADE"),
            situacao: headers.indexOf("SITUACAO"),
            processo: headers.indexOf("NR DO PROCESSO"),
            cnpj: headers.indexOf("CNPJ"),
            razao: headers.indexOf("RAZAO SOCIAL"),
            natureza: headers.indexOf("NATUREZA"),
            equipNome: headers.indexOf("EQUIPAMENTO"),
            equipDesc: headers.indexOf("DESCRICAO EQUIPAMENTO"),
          };
          if (ix.ca < 0) throw new Error(`Coluna NR REGISTRO CA não encontrada. Headers: ${headers.join(", ")}`);
          headerSeen = true;
        };

        const handleDataLine = (line: string) => {
          dataLinesSeen++;
          if (dataLinesSeen <= startOffset) return;
          if (processedThisRun >= LINES_PER_RUN) { reachedLimit = true; return; }

          const cells = parseCsvLine(line);
          const ca = (cells[ix.ca] ?? "").trim();
          processedThisRun++;
          if (!ca || seen.has(ca)) return;
          seen.add(ca);
          const get = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() || null : null);
          batch.push({
            ca_number: ca,
            expiration_date: parseDateBR(cells[ix.validade] ?? ""),
            status: get(ix.situacao),
            equipment_name: get(ix.equipNome),
            equipment_description: get(ix.equipDesc),
            protection_nature: get(ix.natureza),
            manufacturer_name: get(ix.razao),
            manufacturer_cnpj: get(ix.cnpj),
            process_number: get(ix.processo),
            last_synced_at: nowIso,
          });
          if (batch.length >= UPSERT_BATCH) {
            pendingFlush = pendingFlush.then(() => flush());
          }
        };

        let endOfFile = false;
        const gunzip = new Gunzip((chunk: Uint8Array, final: boolean) => {
          if (reachedLimit) return;
          const text = decoder.decode(chunk, { stream: !final }).replace(/^\uFEFF+/, "");
          lineBuf += text;
          let nl: number;
          while ((nl = lineBuf.indexOf("\n")) !== -1) {
            const raw = lineBuf.slice(0, nl).replace(/\r$/, "");
            lineBuf = lineBuf.slice(nl + 1);
            if (!raw) continue;
            if (!headerSeen) handleHeader(raw);
            else handleDataLine(raw);
            if (reachedLimit) return;
          }
          if (final) endOfFile = true;
        });

        const reader = body.getReader();
        while (!reachedLimit) {
          const { done, value } = await reader.read();
          if (done) {
            gunzip.push(new Uint8Array(0), true);
            if (lineBuf.trim() && headerSeen) handleDataLine(lineBuf.trim());
            endOfFile = true;
            break;
          }
          if (value) gunzip.push(value, false);
          await pendingFlush;
        }
        try { reader.cancel(); } catch { /* ignore */ }

        await pendingFlush;
        await flush();

        // Confere novamente cancelamento antes de continuar a cadeia
        const { data: logCheck2 } = await supabase
          .from("caepi_sync_log").select("status").eq("id", logId).maybeSingle();
        if (logCheck2?.status === "cancelled") {
          console.log("[process] cancelado durante chunk; encerrando cadeia.");
          try { await supabase.storage.from(BUCKET).remove([GZ_PATH]); } catch { /* ignore */ }
          return;
        }

        const newProcessed = totalProcessedSoFar + processedThisRun;
        const newOffset = startOffset + processedThisRun;

        if (reachedLimit && !endOfFile) {
          console.log(`[process] chunk ok: ${processedThisRun} linhas. Total acumulado: ${newProcessed}. Próximo offset: ${newOffset}`);
          await supabase.from("caepi_sync_log").update({
            error_message: `processando offset=${newOffset} (${newProcessed} registros)`,
            total_records: newProcessed,
          }).eq("id", logId);
          selfInvoke({ phase: "process", logId, offset: newOffset, processed: newProcessed, t0 });
        } else {
          console.log(`[process] FINALIZADO: ${newProcessed} registros totais.`);
          await supabase.storage.from(BUCKET).remove([GZ_PATH]);
          await supabase.from("caepi_sync_log").update({
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - t0,
            status: "success",
            total_records: newProcessed,
            error_message: null,
          }).eq("id", logId);
        }
      } catch (err: any) {
        console.error("[process] erro:", err);
        await supabase.from("caepi_sync_log").update({
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - t0,
          status: "failed",
          error_message: `offset=${startOffset}: ${String(err?.message ?? err)}`.slice(0, 2000),
        }).eq("id", logId);
      }
    };

    // @ts-ignore EdgeRuntime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processTask());
    } else {
      processTask();
    }

    return new Response(JSON.stringify({ accepted: true, offset: startOffset }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "phase inválida" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
