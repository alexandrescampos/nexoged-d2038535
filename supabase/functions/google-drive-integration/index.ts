import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const GOOGLE_DRIVE_API_KEY = Deno.env.get('GOOGLE_DRIVE_API_KEY')
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    if (!LOVABLE_API_KEY || !GOOGLE_DRIVE_API_KEY) {
      throw new Error('Missing API keys')
    }

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
        throw new Error(`Failed to download file: ${response.statusText}`)
      }

      // We forward the content type and the body
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

    throw new Error('Invalid action')
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
