import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'Sessão expirada. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with the caller's token to verify they're a super_admin
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify the caller's JWT and get their user ID
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: callerUser }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !callerUser) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Sessão expirada. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the caller is a super_admin
    const { data: callerRoles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'super_admin')

    if (rolesError) {
      console.error('Roles error:', rolesError)
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!callerRoles || callerRoles.length === 0) {
      console.error('User is not a super_admin')
      return new Response(
        JSON.stringify({ error: 'Apenas Super Admins podem criar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse the request body
    const { email, password, fullName, role, organizationId } = await req.json()

    // Validate required fields
    if (!email || !password || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios não preenchidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate strong password
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/
    if (!strong.test(password)) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter no mínimo 8 caracteres, com letras maiúsculas, minúsculas, números e caracteres especiais.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (role !== 'super_admin' && !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organização é obrigatória para esta role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check organization user limit (only for non-super_admin roles)
    if (role !== 'super_admin' && organizationId) {
      console.log('Checking user limit for organization:', organizationId)
      
      // Get organization details
      const { data: orgData, error: orgError } = await supabaseClient
        .from('organizations')
        .select('name, max_users')
        .eq('id', organizationId)
        .maybeSingle()

      if (orgError) {
        console.error('Error fetching organization:', orgError)
        return new Response(
          JSON.stringify({ error: 'Erro ao verificar organização' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!orgData) {
        return new Response(
          JSON.stringify({ error: 'Organização não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Count current active users in organization
      const { count: currentUserCount, error: countError } = await supabaseClient
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true)

      if (countError) {
        console.error('Error counting users:', countError)
        return new Response(
          JSON.stringify({ error: 'Erro ao contar usuários da organização' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const maxUsers = orgData.max_users ?? 999999
      const isUnlimited = maxUsers >= 999999

      console.log(`Organization ${orgData.name}: ${currentUserCount ?? 0}/${maxUsers} users (unlimited: ${isUnlimited})`)

      if (!isUnlimited && (currentUserCount ?? 0) >= maxUsers) {
        return new Response(
          JSON.stringify({ 
            error: `Limite de usuários atingido. A organização "${orgData.name}" já possui ${currentUserCount} de ${maxUsers} usuários permitidos.` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log('Creating user:', { email, fullName, role, organizationId })

    // Create the user using admin API (doesn't affect current session)
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName.trim(),
      },
    })

    if (createError) {
      console.error('Create user error:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'Falha ao criar usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = newUser.user.id
    console.log('User created with ID:', userId)

    // Record initial password in history (this RPC also flips must_reset_password to false)
    await supabaseClient.rpc('record_password_change', {
      p_user_id: userId,
      p_new_password: password,
    })

    // Upsert profile directly as fallback (in case trigger doesn't fire)
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .upsert({
        id: userId,
        email: email.trim(),
        full_name: fullName.trim(),
        organization_id: role === 'super_admin' ? null : organizationId,
        must_reset_password: true,
        created_by: callerUser.id,
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile upsert error:', profileError)
      // Continue anyway, user was created
    }

    // Insert user role
    const { error: roleError } = await supabaseClient.from('user_roles').insert({
      user_id: userId,
      role: role,
      organization_id: role === 'super_admin' ? null : organizationId,
    })

    if (roleError) {
      console.error('Role insert error:', roleError)
      return new Response(
        JSON.stringify({ 
          error: 'Usuário criado, mas erro ao atribuir role: ' + roleError.message,
          userId: userId 
        }),
        { status: 207, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert audit log
    await supabaseClient.from('user_audit_log').insert({
      target_user_id: userId,
      performed_by: callerUser.id,
      organization_id: role === 'super_admin' ? null : organizationId,
      action: 'created',
      source: 'create-user',
      method: 'admin_panel',
      ip_address: req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0],
      details: { email: email.trim(), full_name: fullName.trim(), role },
    })

    console.log('User created successfully:', userId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: userId,
        message: 'Usuário criado com sucesso' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Erro interno do servidor'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
