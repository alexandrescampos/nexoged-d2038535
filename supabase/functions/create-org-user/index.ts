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

    const { email, password, fullName, role, cnpjIds } = await req.json();

    // 1. Create user in Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, must_reset_password: true },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authUser.user.id;

    // The profile is likely created by a trigger on auth.users.
    // However, we might need to update it or ensure it exists for the organization.
    // Let's get the organization_id from the admin who is calling this.
    // The admin's JWT is in the Authorization header.
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user: adminUser }, error: adminError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (adminError || !adminUser) {
      throw new Error("Unauthorized");
    }

    // Get admin's profile to get organization_id
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", adminUser.id)
      .single();

    if (profileError || !adminProfile?.organization_id) {
      throw new Error("Admin organization not found");
    }

    const orgId = adminProfile.organization_id;

    // 2. Update profile with organization_id and full_name (if not set by trigger)
    const { error: updateProfileError } = await supabaseAdmin
      .from("profiles")
      .update({
        organization_id: orgId,
        full_name: fullName,
        must_reset_password: true,
        is_active: true
      })
      .eq("id", userId);

    if (updateProfileError) {
      console.error("Error updating profile:", updateProfileError);
    }

    // 3. Add Role
    if (role) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          organization_id: orgId,
          role: role
        });
      
      if (roleError) {
        console.error("Error adding role:", roleError);
      }
    }

    // 4. Add CNPJ scope if provided
    if (cnpjIds && cnpjIds.length > 0) {
      const cnpjInserts = cnpjIds.map((cnpjId: string) => ({
        user_id: userId,
        organization_cnpj_id: cnpjId,
        organization_id: orgId
      }));
      
      const { error: cnpjError } = await supabaseAdmin
        .from("manager_cnpjs")
        .insert(cnpjInserts);
        
      if (cnpjError) {
        console.error("Error adding CNPJ scope:", cnpjError);
      }
    }

    return new Response(JSON.stringify({ user: authUser.user }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
