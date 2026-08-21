// Recebe um certificado A1 (.pfx/.p12) + senha, valida, extrai metadados
// e grava cifrado no banco. O arquivo e a senha nunca trafegam de volta.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { inspectPfx } from "../_shared/pfx.ts";

const MAX_PFX_BYTES = 2 * 1024 * 1024;

const BodySchema = z.object({
  scope: z.enum(["USUARIO", "ORGANIZACAO"]),
  base64Pfx: z.string().min(1),
  password: z.string().min(1),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { scope, base64Pfx, password } = parsed.data;

    const approxBytes = Math.floor((base64Pfx.length * 3) / 4);
    if (approxBytes > MAX_PFX_BYTES) {
      return json({ error: "arquivo_muito_grande" }, 400);
    }

    const { data: profile } = await userClient
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    const organizationId = profile?.organization_id;
    if (!organizationId) return json({ error: "sem_organizacao" }, 400);

    let info;
    try {
      info = inspectPfx(base64Pfx, password);
    } catch (e) {
      const code = String((e as Error).message || "invalido");
      return json({ error: code }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: certId, error: rpcErr } = await admin.rpc("cert_upsert", {
      p_user_id: userId,
      p_owner_type: scope,
      p_organization_id: organizationId,
      p_titular_nome: info.titularNome,
      p_titular_documento: info.titularDocumento,
      p_emissor: info.emissor,
      p_serial_number: info.serialNumber,
      p_valido_de: info.validoDe.toISOString(),
      p_valido_ate: info.validoAte.toISOString(),
      p_fingerprint: info.fingerprint,
      p_pfx_b64: base64Pfx,
      p_senha: password,
    });

    if (rpcErr) {
      const forbidden = rpcErr.message?.includes("forbidden");
      return json({ error: forbidden ? "forbidden" : "falha_ao_salvar" }, forbidden ? 403 : 500);
    }

    return json({
      id: certId,
      titular_nome: info.titularNome,
      titular_documento: info.titularDocumento,
      emissor: info.emissor,
      valido_de: info.validoDe.toISOString(),
      valido_ate: info.validoAte.toISOString(),
      status: info.validoAte < new Date() ? "vencido" : "valido",
    });
  } catch (_e) {
    return json({ error: "erro_inesperado" }, 500);
  }
});
