import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile } = await admin.from("profiles").select("organization_id").eq("id", user.id).single();
    const orgId = profile?.organization_id;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "Usuário sem organização" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify admin/super_admin
    const { data: roles } = await admin.from("user_roles").select("role, organization_id").eq("user_id", user.id);
    const isSuper = roles?.some((r: any) => r.role === "super_admin");
    const isOrgAdmin = roles?.some((r: any) => r.role === "org_admin" && r.organization_id === orgId);
    if (!isSuper && !isOrgAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem conectar o Google Drive" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json().catch(() => ({}));
    const appOrigin = (body?.origin as string) || "";

    const state = crypto.randomUUID() + "-" + crypto.randomUUID();
    await admin.from("google_oauth_states").insert({
      state,
      user_id: user.id,
      organization_id: orgId,
      redirect_path: appOrigin + "/dashboard/integrations/google-drive",
    });

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e: any) {
    console.error("oauth-start error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
