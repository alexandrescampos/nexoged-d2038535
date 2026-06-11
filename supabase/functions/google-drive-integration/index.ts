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

    if (action === "list") {
      const folderId = url.searchParams.get("folderId") || "root";
      const q = `'${folderId}' in parents and trashed = false`;
      const r = await fetch(
        `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,iconLink)&pageSize=100`,
        { headers }
      );
      const j = await r.json();
      return new Response(JSON.stringify(j), {
        status: r.ok ? 200 : r.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
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
      const r = await fetch(
        `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,iconLink)&pageSize=50`,
        { headers }
      );
      const j = await r.json();
      return new Response(JSON.stringify(j), {
        status: r.ok ? 200 : r.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "download") {
      const fileId = url.searchParams.get("fileId");
      if (!fileId) {
        return new Response(JSON.stringify({ error: "Missing fileId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const r = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers });
      if (!r.ok) {
        const t = await r.text();
        console.error("Download error:", t);
        return new Response(JSON.stringify({ error: "Falha no download", details: t }), {
          status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const ct = r.headers.get("Content-Type") || "application/octet-stream";
      return new Response(r.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": ct,
          "Content-Disposition": r.headers.get("Content-Disposition") || "attachment",
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
