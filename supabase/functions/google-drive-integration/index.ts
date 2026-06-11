import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get user identity
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Não autorizado')

    // Get user profile for organization_id
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) throw new Error('Perfil do usuário não encontrado')
    const organizationId = profile.organization_id

    // Get organization's Google Drive credentials from database
    const { data: integration, error: integrationError } = await supabaseClient
      .from('organization_integrations')
      .select('credentials')
      .eq('organization_id', organizationId)
      .eq('provider', 'google_drive')
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      throw new Error('Google Drive não configurado para esta empresa. Por favor, conecte sua conta nas configurações.')
    }

    const { apiKey: GOOGLE_DRIVE_API_KEY } = integration.credentials

    if (!LOVABLE_API_KEY || !GOOGLE_DRIVE_API_KEY) {
      throw new Error('Chaves de API ausentes ou inválidas')
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    if (action === 'list') {
      const folderId = url.searchParams.get('folderId') || 'root'
      const query = `'${folderId}' in parents and trashed = false`
      const driveUrl = `${GATEWAY_URL}/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,iconLink)&pageSize=100`

      const response = await fetch(driveUrl, {
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': GOOGLE_DRIVE_API_KEY
        }
      })

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'download') {
      const fileId = url.searchParams.get('fileId')
      if (!fileId) throw new Error('Missing fileId')

      const driveUrl = `${GATEWAY_URL}/drive/v3/files/${fileId}?alt=media`

      const response = await fetch(driveUrl, {
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': GOOGLE_DRIVE_API_KEY
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Download error:', errorText)
        throw new Error(`Falha ao baixar arquivo do Google Drive: ${response.statusText}`)
      }

      const contentType = response.headers.get('Content-Type') || 'application/octet-stream'
      
      return new Response(response.body, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': contentType,
          'Content-Disposition': response.headers.get('Content-Disposition') || 'attachment'
        }
      })
    }

    if (action === 'search') {
      const queryStr = url.searchParams.get('query')
      if (!queryStr) throw new Error('Missing search query')
      
      const query = `name contains '${queryStr}' and trashed = false`
      const driveUrl = `${GATEWAY_URL}/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,iconLink)&pageSize=50`

      const response = await fetch(driveUrl, {
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': GOOGLE_DRIVE_API_KEY
        }
      })

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    throw new Error('Ação inválida')
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
