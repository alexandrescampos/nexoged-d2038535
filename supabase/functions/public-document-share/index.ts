import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get('token') ?? '';
    let password: string | null = url.searchParams.get('password');
    let action = url.searchParams.get('action') || 'info';

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      token = body.token || token;
      password = body.password ?? password;
      action = body.action || action;
    }

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data, error } = await supabase.rpc('validate_document_share', {
      p_token: token,
      p_password: password,
    });
    if (error) throw error;
    if (!data?.ok) {
      return new Response(JSON.stringify(data), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'download' || action === 'view') {
      const { data: signed, error: sErr } = await supabase.storage
        .from('ged_files')
        .createSignedUrl(data.file_path, 300, action === 'download' ? { download: data.file_name } : undefined);
      if (sErr) throw sErr;
      return new Response(JSON.stringify({ ok: true, url: signed.signedUrl, file_name: data.file_name, title: data.title, mime_type: data.mime_type }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true, title: data.title, file_name: data.file_name, mime_type: data.mime_type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
