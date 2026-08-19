import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Validate caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Não autenticado" }, 401);

    const { data: { user: caller }, error: callerError } =
      await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller) return json({ error: "Sessão expirada" }, 401);

    const { data: isSuper } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "super_admin",
    });
    if (!isSuper) return json({ error: "Acesso negado" }, 403);

    // 2. Validate input
    const { email, password, fullName, role, organizationId } = await req.json();

    if (!email || !password || !fullName || !role) {
      return json({ error: "Campos obrigatórios ausentes" }, 400);
    }
    if (!["super_admin", "org_admin", "user"].includes(role)) {
      return json({ error: "Role inválida" }, 400);
    }
    if (role !== "super_admin" && !organizationId) {
      return json({ error: "Organização é obrigatória" }, 400);
    }

    // 3. Create auth user
    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: String(email).trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, must_reset_password: true },
      });

    if (createError || !created?.user) {
      const msg = createError?.message ?? "Falha ao criar usuário";
      const already = /already registered|already been registered|duplicate/i.test(msg);
      return json(
        { error: already ? "Já existe um usuário com este e-mail." : msg },
        400
      );
    }

    const userId = created.user.id;

    // 4. Profile (created by trigger) — attach org + metadata
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        organization_id: role === "super_admin" ? null : organizationId,
        full_name: fullName,
        email: String(email).trim().toLowerCase(),
        is_active: true,
        must_reset_password: true,
      })
      .eq("id", userId);

    if (profileError) {
      console.error("profile update error", profileError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return json({ error: `Erro ao criar perfil: ${profileError.message}` }, 400);
    }

    // 5. Role
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role,
      organization_id: role === "super_admin" ? null : organizationId,
    });

    if (roleError) {
      console.error("role insert error", roleError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return json({ error: `Erro ao atribuir role: ${roleError.message}` }, 400);
    }

    return json({ user: { id: userId, email: created.user.email } });
  } catch (error) {
    console.error("create-user error", error);
    return json({ error: (error as Error).message ?? "Erro inesperado" }, 500);
  }
});
