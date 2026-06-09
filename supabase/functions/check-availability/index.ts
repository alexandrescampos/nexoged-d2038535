import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, value } = await req.json();

    if (!type || !value) {
      return new Response(
        JSON.stringify({ error: "Tipo e valor são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    if (type === "email") {
      // Check if email exists in auth.users
      const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
      
      if (error) {
        console.error("Error checking email:", error);
        return new Response(
          JSON.stringify({ error: "Erro ao verificar email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const emailExists = users.users.some(
        (user) => user.email?.toLowerCase() === value.toLowerCase()
      );

      return new Response(
        JSON.stringify({ available: !emailExists }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "cnpj") {
      // Clean CNPJ - remove non-numeric characters
      const cleanedCnpj = value.replace(/\D/g, "");

      // Check if CNPJ exists in organizations
      const { data: org, error } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("cnpj", cleanedCnpj)
        .maybeSingle();

      if (error) {
        console.error("Error checking CNPJ:", error);
        return new Response(
          JSON.stringify({ error: "Erro ao verificar CNPJ" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ available: !org }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Tipo inválido. Use 'email' ou 'cnpj'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in check-availability:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
