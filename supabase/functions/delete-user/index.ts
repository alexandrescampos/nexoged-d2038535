import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requester }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !requester) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get the profile of the user to be deleted
    const { data: userProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user_id)
      .single();

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check if requester has permission (super_admin or org_admin of the same organization)
    const { data: isSuperAdmin } = await supabaseClient.rpc("has_role", {
      _user_id: requester.id,
      _role: "super_admin",
    });

    if (!isSuperAdmin) {
      const { data: isOrgAdmin } = await supabaseClient.rpc("has_role_in_org", {
        _user_id: requester.id,
        _role: "org_admin",
        _org_id: userProfile.organization_id,
      });

      if (!isOrgAdmin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: You must be an admin of this organization" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Check if user has history (as requested)
    const { data: hasHistory, error: historyError } = await supabaseClient.rpc("check_user_has_history", { 
      p_user_id: user_id 
    });

    if (historyError) {
      console.error("Error checking history:", historyError);
      return new Response(
        JSON.stringify({ error: "Error checking user history" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (hasHistory) {
      return new Response(
        JSON.stringify({ error: "HISTORY_EXISTS", message: "Não é possível excluir o usuário pois ele possui histórico de ações no sistema (entregas, solicitações, etc)." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Proceed with deletion
    // Delete user roles
    await supabaseClient.from("user_roles").delete().eq("user_id", user_id);

    // Delete password history
    await supabaseClient.from("password_history").delete().eq("user_id", user_id);

    // Delete profile
    await supabaseClient.from("profiles").delete().eq("id", user_id);

    // Delete from auth
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(user_id);

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
