import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

function htmlRedirect(target: string, _message: string) {
  // Absolute URL required for 302 Location when target is a relative path.
  const location = target.startsWith("http")
    ? target
    : `https://nexoged.lovable.app${target.startsWith("/") ? "" : "/"}${target}`;
  return new Response(null, {
    status: 302,
    headers: { Location: location },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (!state) return htmlRedirect("/", "Estado ausente.");

    const { data: stateRow } = await admin.from("google_oauth_states").select("*").eq("state", state).single();
    if (!stateRow) return htmlRedirect("/", "Estado inválido ou expirado.");

    // delete state (one-time use)
    await admin.from("google_oauth_states").delete().eq("state", state);

    const back = (stateRow.redirect_path as string) || "/dashboard/integrations/google-drive";

    if (errorParam) {
      return htmlRedirect(`${back}?gdrive=error&reason=${encodeURIComponent(errorParam)}`, "Autorização cancelada.");
    }
    if (!code) return htmlRedirect(`${back}?gdrive=error&reason=missing_code`, "Código ausente.");

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Token exchange error:", tokens);
      return htmlRedirect(`${back}?gdrive=error&reason=token_exchange`, "Falha ao trocar o código.");
    }

    const { access_token, refresh_token, expires_in, scope } = tokens;
    if (!refresh_token) {
      return htmlRedirect(`${back}?gdrive=error&reason=no_refresh_token`,
        "Refresh token ausente. Revogue o acesso em myaccount.google.com e tente novamente.");
    }

    // Fetch user info from Drive
    const aboutRes = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const about = await aboutRes.json();
    const gUser = about?.user ?? {};

    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    await admin.from("organization_google_drive_connections").upsert({
      organization_id: stateRow.organization_id,
      connected_by: stateRow.user_id,
      google_email: gUser.emailAddress ?? "unknown",
      google_display_name: gUser.displayName ?? null,
      google_photo_url: gUser.photoLink ?? null,
      access_token,
      refresh_token,
      token_expires_at: expiresAt,
      scope: scope ?? "https://www.googleapis.com/auth/drive.readonly",
      status: "active",
      last_error: null,
    }, { onConflict: "organization_id" });

    // Audit log
    await admin.from("user_audit_log").insert({
      target_user_id: stateRow.user_id,
      performed_by: stateRow.user_id,
      action: "google_drive_connected",
      source: "oauth",
      method: "oauth_callback",
      details: { email: gUser.emailAddress, organization_id: stateRow.organization_id },
    });

    return htmlRedirect(`${back}?gdrive=connected`, "Conta conectada! Redirecionando...");
  } catch (e: any) {
    console.error("callback error:", e);
    return htmlRedirect(`/dashboard/integrations/google-drive?gdrive=error&reason=server`, "Erro interno.");
  }
});
