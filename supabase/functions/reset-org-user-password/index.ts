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

    // Extract the token
    const token = authHeader.replace('Bearer ', '')
    
    if (!token || token === 'undefined' || token === 'null') {
      console.error('Invalid token format')
      return new Response(
        JSON.stringify({ error: 'Sessão expirada. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Decode the JWT to get the user ID
    let callerId: string
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }
      const payload = JSON.parse(atob(parts[1]))
      callerId = payload.sub
      
      if (!callerId) {
        throw new Error('No user ID in token')
      }
      
      console.log('Caller ID from token:', callerId)
    } catch (jwtError) {
      console.error('JWT parse error:', jwtError)
      return new Response(
        JSON.stringify({ error: 'Sessão expirada. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the caller is an org_admin
    const { data: callerRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', callerId)
      .eq('role', 'org_admin')

    if (rolesError) {
      console.error('Roles error:', rolesError)
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!callerRoles || callerRoles.length === 0) {
      console.error('User is not an org_admin:', callerId)
      return new Response(
        JSON.stringify({ error: 'Apenas Administradores da Organização podem redefinir senhas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get caller's organization from profile (more reliable than role record)
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', callerId)
      .single()

    if (callerProfileError || !callerProfile?.organization_id) {
      console.error('Caller profile error:', callerProfileError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar organização do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerOrgId = callerProfile.organization_id
    console.log('Caller org_admin verified, organization_id:', callerOrgId)

    // Parse the request body
    const { userId, newPassword, mustResetOnLogin = true } = await req.json()

    // Validate required fields
    if (!userId || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'ID do usuário e nova senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate strong password
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/
    if (!strong.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter no mínimo 8 caracteres, com letras maiúsculas, minúsculas, números e caracteres especiais.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Block reuse of last 3 passwords
    const { data: isInHistory } = await supabaseAdmin.rpc('is_password_in_history', {
      p_user_id: userId,
      p_new_password: newPassword,
    })
    if (isInHistory === true) {
      return new Response(
        JSON.stringify({ error: 'Esta senha já foi utilizada recentemente. Escolha uma diferente das últimas 3 senhas.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the target user's profile to check organization
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar dados do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify target user belongs to the same organization
    if (targetProfile.organization_id !== callerOrgId) {
      console.error('Target user not in same organization. Target org:', targetProfile.organization_id, 'Caller org:', callerOrgId)
      return new Response(
        JSON.stringify({ error: 'Você não pode redefinir a senha de usuários de outra organização' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if target user is an org_admin or super_admin (cannot reset their passwords)
    const { data: targetRoles, error: targetRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    if (targetRolesError) {
      console.error('Target roles error:', targetRolesError)
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const targetRoleNames = targetRoles?.map(r => r.role) || []
    if (targetRoleNames.includes('super_admin')) {
      return new Response(
        JSON.stringify({ error: 'Não é possível redefinir a senha de um Super Admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Resetting password for user:', userId, 'mustResetOnLogin:', mustResetOnLogin)

    // Update the user's password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Update password error:', updateError)
      return new Response(
        JSON.stringify({ error: 'Erro ao redefinir senha: ' + updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Record password in history and update password_updated_at
    await supabaseAdmin.rpc('record_password_change', {
      p_user_id: userId,
      p_new_password: newPassword,
    })

    // Update the profile to mark that password reset is required on next login
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ must_reset_password: mustResetOnLogin })
      .eq('id', userId)

    if (profileUpdateError) {
      console.error('Profile update error:', profileUpdateError)
      // Password was changed, but flag wasn't set - still return success with warning
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: 'Senha redefinida, mas não foi possível marcar para reset obrigatório' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Password reset successfully for user:', userId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: mustResetOnLogin 
          ? 'Senha redefinida. O usuário precisará criar uma nova senha no próximo login.'
          : 'Senha redefinida com sucesso.'
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
