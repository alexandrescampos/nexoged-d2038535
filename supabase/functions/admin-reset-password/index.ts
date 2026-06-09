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

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Check if caller is a super_admin via JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Sessão expirada. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Decode JWT to get caller ID
    let callerId: string
    try {
      const parts = token.split('.')
      if (parts.length !== 3) throw new Error('Invalid JWT')
      const payload = JSON.parse(atob(parts[1]))
      callerId = payload.sub
      if (!callerId) throw new Error('No user ID')
    } catch {
      return new Response(
        JSON.stringify({ error: 'Sessão expirada. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify caller is super_admin
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'super_admin')

    if (!callerRoles || callerRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Apenas Super Admins podem usar esta função' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }


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

    console.log('Admin resetting password for user:', userId, 'mustResetOnLogin:', mustResetOnLogin)

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
