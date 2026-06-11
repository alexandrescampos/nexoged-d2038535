import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const DRIVE_API = "https://www.googleapis.com/drive/v3";

async function getValidAccessToken(admin: any, orgId: string): Promise<string> {
  const { data: conn, error } = await admin
    .from("organization_google_drive_connections")
    .select("*").eq("organization_id", orgId).single();
  if (error || !conn) throw new Error("NOT_CONNECTED");
  if (conn.status !== "active") throw new Error("NOT_CONNECTED");

  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (expiresAt > Date.now() + 60_000) return conn.access_token;

  // refresh
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!r.ok) {
    await admin.from("organization_google_drive_connections").update({
      status: "error", last_error: JSON.stringify(j),
    }).eq("organization_id", orgId);
    throw new Error("REFRESH_FAILED");
  }
  const newExpires = new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString();
  await admin.from("organization_google_drive_connections").update({
    access_token: j.access_token,
    token_expires_at: newExpires,
    last_error: null,
    status: "active",
  }).eq("organization_id", orgId);
  return j.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await admin.from("profiles").select("organization_id").eq("id", user.id).single();
    const orgId = profile?.organization_id;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "Sem organização" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(admin, orgId);
    } catch (e: any) {
      const code = e.message === "NOT_CONNECTED" ? 409 : 401;
      return new Response(JSON.stringify({ error: e.message }), {
        status: code, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const headers = { Authorization: `Bearer ${accessToken}` };

    // Touch last_used_at (best-effort, not awaited critically)
    admin.from("organization_google_drive_connections")
      .update({ last_used_at: new Date().toISOString() })
      .eq("organization_id", orgId).then(() => {});

    if (action === "about") {
      const r = await fetch(`${DRIVE_API}/about?fields=user,storageQuota`, { headers });
      const j = await r.json();
      return new Response(JSON.stringify({ ok: r.ok, ...j }), {
        status: r.ok ? 200 : r.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Paginated fetch helper for Drive list endpoint
    async function fetchAllPages(qStr: string, extraParams: Record<string, string>, maxPages: number) {
      const all: any[] = [];
      let pageToken: string | undefined;
      for (let i = 0; i < maxPages; i++) {
        const params = new URLSearchParams({
          q: qStr,
          fields: "nextPageToken,files(id,name,mimeType,size,iconLink)",
          pageSize: "1000",
          orderBy: "folder,name",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
          ...extraParams,
        });
        if (pageToken) params.set("pageToken", pageToken);
        const r = await fetch(`${DRIVE_API}/files?${params.toString()}`, { headers });
        if (!r.ok) {
          const t = await r.text();
          return { ok: false as const, status: r.status, body: t };
        }
        const j = await r.json();
        if (Array.isArray(j.files)) all.push(...j.files);
        pageToken = j.nextPageToken;
        if (!pageToken) break;
      }
      return { ok: true as const, files: all };
    }

    if (action === "list") {
      const folderId = url.searchParams.get("folderId") || "root";
      const q = `'${folderId}' in parents and trashed = false`;
      const result = await fetchAllPages(q, {}, 10);
      if (!result.ok) {
        return new Response(JSON.stringify({ error: "Falha ao listar", details: result.body }), {
          status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ files: result.files }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "search") {
      const queryStr = url.searchParams.get("query");
      if (!queryStr) {
        return new Response(JSON.stringify({ error: "Missing search query" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const safe = queryStr.replace(/'/g, "\\'");
      const q = `name contains '${safe}' and trashed = false`;
      const result = await fetchAllPages(q, { corpora: "allDrives" }, 3);
      if (!result.ok) {
        return new Response(JSON.stringify({ error: "Falha na busca", details: result.body }), {
          status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ files: result.files }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }



    if (action === "download") {
      const fileId = url.searchParams.get("fileId");
      if (!fileId) {
        return new Response(JSON.stringify({ error: "Missing fileId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // First, fetch metadata to detect Google Workspace files (Docs/Sheets/Slides/Drawings)
      const metaRes = await fetch(`${DRIVE_API}/files/${fileId}?fields=id,name,mimeType&supportsAllDrives=true`, { headers });
      if (!metaRes.ok) {
        const t = await metaRes.text();
        console.error("Metadata error:", t);
        return new Response(JSON.stringify({ error: "Falha ao obter metadados", details: t }), {
          status: metaRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const meta = await metaRes.json();
      const mt: string = meta.mimeType || "";

      // Map Google Workspace MIME types to an export format
      const exportMap: Record<string, { mime: string; ext: string }> = {
        "application/vnd.google-apps.document":     { mime: "application/pdf", ext: "pdf" },
        "application/vnd.google-apps.spreadsheet":  { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" },
        "application/vnd.google-apps.presentation": { mime: "application/pdf", ext: "pdf" },
        "application/vnd.google-apps.drawing":      { mime: "image/png", ext: "png" },
      };

      const isGoogleDoc = mt.startsWith("application/vnd.google-apps.");
      const exportInfo = exportMap[mt];

      if (isGoogleDoc && !exportInfo) {
        return new Response(JSON.stringify({
          error: "Tipo de arquivo Google não suportado para download",
          details: `MIME ${mt} não pode ser exportado.`,
        }), { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const fetchUrl = exportInfo
        ? `${DRIVE_API}/files/${fileId}/export?mimeType=${encodeURIComponent(exportInfo.mime)}`
        : `${DRIVE_API}/files/${fileId}?alt=media`;

      const r = await fetch(fetchUrl, { headers });
      if (!r.ok) {
        const t = await r.text();
        console.error("Download error:", t);
        return new Response(JSON.stringify({ error: "Falha no download", details: t }), {
          status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const ct = exportInfo?.mime || r.headers.get("Content-Type") || "application/octet-stream";
      const filename = exportInfo
        ? `${(meta.name || "arquivo").replace(/\.[^.]+$/, "")}.${exportInfo.ext}`
        : (meta.name || "download");

      return new Response(r.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": ct,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-File-Name": encodeURIComponent(filename),
        },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e: any) {
    console.error("integration error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
