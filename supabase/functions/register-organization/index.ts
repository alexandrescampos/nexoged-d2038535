import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CNPJ validation function
function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  let sum = 0;
  let weight = 5;
  
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  
  let remainder = sum % 11;
  const firstCheckDigit = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cleaned[12]) !== firstCheckDigit) return false;
  
  sum = 0;
  weight = 6;
  
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  
  remainder = sum % 11;
  const secondCheckDigit = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cleaned[13]) !== secondCheckDigit) return false;
  
  return true;
}

// Generate slug from organization name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      email, 
      password, 
      fullName, 
      phone,
      organizationName, 
      cnpj,
      termsAcceptedVersion 
    } = await req.json();

    // Validate required fields
    if (!email || !password || !fullName || !organizationName || !cnpj) {
      return new Response(
        JSON.stringify({ error: "Todos os campos são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean CNPJ
    const cleanedCNPJ = cnpj.replace(/\D/g, '');

    // Validate CNPJ format
    if (!validateCNPJ(cleanedCNPJ)) {
      return new Response(
        JSON.stringify({ error: "CNPJ inválido", code: "INVALID_CNPJ" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if CNPJ already exists
    const { data: existingOrg, error: orgCheckError } = await supabaseClient
      .from("organizations")
      .select("id")
      .eq("cnpj", cleanedCNPJ)
      .maybeSingle();

    if (orgCheckError) {
      console.error("Error checking CNPJ:", orgCheckError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar CNPJ" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingOrg) {
      return new Response(
        JSON.stringify({ 
          error: "Já existe uma organização cadastrada com este CNPJ", 
          code: "CNPJ_EXISTS" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already exists in auth.users
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );

    if (emailExists) {
      return new Response(
        JSON.stringify({ 
          error: "Este e-mail já está cadastrado no sistema", 
          code: "EMAIL_EXISTS" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique slug
    let slug = generateSlug(organizationName);
    let slugSuffix = 0;
    let slugExists = true;

    while (slugExists) {
      const checkSlug = slugSuffix === 0 ? slug : `${slug}-${slugSuffix}`;
      const { data: existingSlug } = await supabaseClient
        .from("organizations")
        .select("id")
        .eq("slug", checkSlug)
        .maybeSingle();
      
      if (!existingSlug) {
        slug = checkSlug;
        slugExists = false;
      } else {
        slugSuffix++;
      }
    }

    // Create organization with terms acceptance
    const { data: newOrg, error: orgError } = await supabaseClient
      .from("organizations")
      .insert({
        name: organizationName,
        cnpj: cleanedCNPJ,
        slug: slug,
        status: "trial",
        terms_accepted_at: termsAcceptedVersion ? new Date().toISOString() : null,
        terms_accepted_version: termsAcceptedVersion || null,
      })
      .select()
      .single();

    if (orgError) {
      console.error("Error creating organization:", orgError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar organização" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Organization created: ${newOrg.id}`);

    // Create user
    const { data: newUser, error: userError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (userError) {
      console.error("Error creating user:", userError);
      // Rollback: delete the organization
      await supabaseClient.from("organizations").delete().eq("id", newOrg.id);
      
      return new Response(
        JSON.stringify({ error: userError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User created: ${newUser.user.id}`);

    // Update profile with organization_id and created_by
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .update({ organization_id: newOrg.id, phone: phone || null, created_by: newUser.user.id })
      .eq("id", newUser.user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Rollback: delete user and organization
      await supabaseClient.auth.admin.deleteUser(newUser.user.id);
      await supabaseClient.from("organizations").delete().eq("id", newOrg.id);
      
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar perfil" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create org_admin role
    const { error: roleError } = await supabaseClient
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: "org_admin",
        organization_id: newOrg.id,
      });

    if (roleError) {
      console.error("Error creating role:", roleError);
      // Rollback
      await supabaseClient.auth.admin.deleteUser(newUser.user.id);
      await supabaseClient.from("organizations").delete().eq("id", newOrg.id);
      
      return new Response(
        JSON.stringify({ error: "Erro ao atribuir permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert audit log
    await supabaseClient.from("user_audit_log").insert({
      target_user_id: newUser.user.id,
      performed_by: newUser.user.id,
      organization_id: newOrg.id,
      action: "created",
      source: "register-organization",
      details: { email, full_name: fullName, role: "org_admin", organization_name: organizationName },
    });

    console.log(`Registration complete: User ${email} as org_admin of ${organizationName}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Conta criada com sucesso!",
        user: { 
          id: newUser.user.id, 
          email: newUser.user.email 
        },
        organization: {
          id: newOrg.id,
          name: newOrg.name
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Ocorreu um erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
