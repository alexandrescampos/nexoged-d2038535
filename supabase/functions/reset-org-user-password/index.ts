import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { userId, newPassword, mustResetOnLogin } = await req.json();

    if (!userId || !newPassword) {
      return new Response(JSON.stringify({ error: "UserId and newPassword are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Resetting password for user: ${userId}`);

    // Update user password using admin API
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
      user_metadata: { must_reset_password: mustResetOnLogin }
    });

    if (error) {
      console.error("Auth update error:", error);
      const errorCode = (error as any).code || "";
      const errorMessage = error.message?.toLowerCase() || "";
      
      let friendly = error.message;
      let statusCode = 400;

      if (errorCode === "weak_password" || errorMessage.includes("weak")) {
        friendly = "Esta senha foi encontrada em vazamentos públicos de dados e não pode ser usada. Escolha uma senha diferente e mais original.";
      } else if (errorCode === "session_not_found" || errorMessage.includes("expired") || errorMessage.includes("invalid token")) {
        friendly = "Sua sessão ou token expirou. Por favor, faça login novamente.";
        statusCode = 401;
      } else if (errorMessage.includes("user not found")) {
        friendly = "Usuário não encontrado no sistema.";
        statusCode = 404;
      } else if (errorMessage.includes("unexpected error")) {
        friendly = "Ocorreu um erro inesperado. Tente novamente em alguns minutos.";
        statusCode = 500;
      }

      return new Response(JSON.stringify({ error: friendly, code: errorCode }), {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also update the profile if needed
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ must_reset_password: mustResetOnLogin })
      .eq("id", userId);

    if (profileError) {
      console.error("Error updating profile must_reset_password:", profileError);
    }

    return new Response(JSON.stringify({ message: "Senha redefinida com sucesso", user: data.user }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
