import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { data: roles } = await admin.from("user_roles").select("role, organization_id").eq("user_id", user.id);
    const isSuper = roles?.some((r: any) => r.role === "super_admin");
    const isOrgAdmin = roles?.some((r: any) => r.role === "org_admin" && r.organization_id === orgId);
    if (!isSuper && !isOrgAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem desconectar" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: conn } = await admin.from("organization_google_drive_connections")
      .select("refresh_token").eq("organization_id", orgId).single();

    if (conn?.refresh_token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.refresh_token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      } catch (e) {
        console.warn("Revoke failed (ignored):", e);
      }
    }

    await admin.from("organization_google_drive_connections").delete().eq("organization_id", orgId);

    await admin.from("user_audit_log").insert({
      target_user_id: user.id,
      performed_by: user.id,
      action: "google_drive_disconnected",
      source: "user",
      method: "disconnect_button",
      details: { organization_id: orgId },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e: any) {
    console.error("disconnect error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
