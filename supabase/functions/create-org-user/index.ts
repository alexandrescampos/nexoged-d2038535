import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Sessão expirada. Faça login novamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the JWT and get the caller's user ID
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !caller) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Sessão expirada. Faça login novamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is org_admin
    const { data: callerRoles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isOrgAdmin = callerRoles?.some((r) => r.role === "org_admin");
    
    if (!isOrgAdmin) {
      return new Response(
        JSON.stringify({ error: "Only organization administrators can create users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get caller's organization ID
    const { data: callerProfile } = await supabaseClient
      .from("profiles")
      .select("organization_id")
      .eq("id", caller.id)
      .single();

    if (!callerProfile?.organization_id) {
      return new Response(
        JSON.stringify({ error: "Caller does not belong to an organization" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const organizationId = callerProfile.organization_id;

    // Parse request body
    const {
      email,
      password,
      fullName,
      role,
      cnpjIds = [],
      sectorIds = [],
    } = await req.json();

    // Validate required fields
    if (!email || !password || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, password, fullName, role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(cnpjIds) || !Array.isArray(sectorIds)) {
      return new Response(
        JSON.stringify({ error: "CNPJs e setores devem ser enviados como listas." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate strong password
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strong.test(password)) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter no mínimo 8 caracteres, com letras maiúsculas, minúsculas, números e caracteres especiais." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role - org_admin cannot create super_admin
    if (role === "super_admin") {
      return new Response(
        JSON.stringify({ error: "Cannot create super_admin users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role is one of allowed types
    const allowedRoles = ["org_admin", "manager"];
    if (!allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role. Must be one of: org_admin, manager" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if organization can add more users
    const { data: canAddUser } = await supabaseClient.rpc("can_org_add_user", {
      _org_id: organizationId,
    });

    if (!canAddUser) {
      return new Response(
        JSON.stringify({ 
          error: "Limite de usuários atingido. Atualize seu plano para adicionar mais usuários.",
          code: "USER_LIMIT_REACHED"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert the profile with organization_id (in case trigger hasn't fired yet)
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .upsert({ 
      id: newUser.user.id,
        email: email,
        full_name: fullName,
        organization_id: organizationId,
        must_reset_password: true,
        created_by: caller.id,
      }, { onConflict: "id" });

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Try to clean up the created user
      await supabaseClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: "Failed to update user profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert the role
    const { error: roleError } = await supabaseClient
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: role,
        organization_id: organizationId,
      });

    if (roleError) {
      console.error("Error inserting role:", roleError);
      // Try to clean up
      await supabaseClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: "Failed to assign user role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (cnpjIds.length > 0) {
      const uniqueCnpjIds = [...new Set(cnpjIds)].filter((value): value is string => typeof value === "string" && value.length > 0);

      const { data: validCnpjs, error: cnpjValidationError } = await supabaseClient
        .from("organization_cnpjs")
        .select("id")
        .eq("organization_id", organizationId)
        .in("id", uniqueCnpjIds);

      if (cnpjValidationError || (validCnpjs?.length ?? 0) !== uniqueCnpjIds.length) {
        await supabaseClient.from("user_roles").delete().eq("user_id", newUser.user.id);
        await supabaseClient.auth.admin.deleteUser(newUser.user.id);
        return new Response(
          JSON.stringify({ error: "Empresa inválida para esta organização." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: managerCnpjsError } = await supabaseClient
        .from("manager_cnpjs")
        .insert(
          uniqueCnpjIds.map((organizationCnpjId) => ({
            user_id: newUser.user.id,
            organization_cnpj_id: organizationCnpjId,
            organization_id: organizationId,
          }))
        );

      if (managerCnpjsError) {
        console.error("Error inserting manager CNPJs:", managerCnpjsError);
        await supabaseClient.from("manager_cnpjs").delete().eq("user_id", newUser.user.id);
        await supabaseClient.from("user_roles").delete().eq("user_id", newUser.user.id);
        await supabaseClient.auth.admin.deleteUser(newUser.user.id);
        return new Response(
          JSON.stringify({ error: "Falha ao salvar a empresa do usuário." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (role === "manager" && sectorIds.length > 0) {
      const uniqueSectorIds = [...new Set(sectorIds)].filter((value): value is string => typeof value === "string" && value.length > 0);

      const { data: validSectors, error: sectorValidationError } = await supabaseClient
        .from("sectors")
        .select("id")
        .eq("organization_id", organizationId)
        .in("id", uniqueSectorIds);

      if (sectorValidationError || (validSectors?.length ?? 0) !== uniqueSectorIds.length) {
        await supabaseClient.from("manager_cnpjs").delete().eq("user_id", newUser.user.id);
        await supabaseClient.from("user_roles").delete().eq("user_id", newUser.user.id);
        await supabaseClient.auth.admin.deleteUser(newUser.user.id);
        return new Response(
          JSON.stringify({ error: "Setor inválido para esta organização." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: managerSectorsError } = await supabaseClient
        .from("manager_sectors")
        .insert(
          uniqueSectorIds.map((sectorId) => ({
            user_id: newUser.user.id,
            sector_id: sectorId,
            organization_id: organizationId,
          }))
        );

      if (managerSectorsError) {
        console.error("Error inserting manager sectors:", managerSectorsError);
        await supabaseClient.from("manager_sectors").delete().eq("user_id", newUser.user.id);
        await supabaseClient.from("manager_cnpjs").delete().eq("user_id", newUser.user.id);
        await supabaseClient.from("user_roles").delete().eq("user_id", newUser.user.id);
        await supabaseClient.auth.admin.deleteUser(newUser.user.id);
        return new Response(
          JSON.stringify({ error: "Falha ao salvar o setor do usuário." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Record initial password in history (this RPC also flips must_reset_password to false)
    await supabaseClient.rpc("record_password_change", {
      p_user_id: newUser.user.id,
      p_new_password: password,
    });

    // Re-enforce must_reset_password = true so the user is forced to change the temporary password on first login
    await supabaseClient
      .from("profiles")
      .update({ must_reset_password: true })
      .eq("id", newUser.user.id);

    // Insert audit log
    await supabaseClient.from("user_audit_log").insert({
      target_user_id: newUser.user.id,
      performed_by: caller.id,
      organization_id: organizationId,
      action: "created",
      source: "create-org-user",
      details: { email, full_name: fullName, role },
    });

    console.log(`User ${email} created successfully by org_admin ${caller.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUser.user.id,
        user: { 
          id: newUser.user.id, 
          email: newUser.user.email 
        } 
      }),
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
