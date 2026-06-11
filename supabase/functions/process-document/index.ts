import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_IMAGE_DIMENSION = 2000;
const IMAGE_QUALITY = 80;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { documentId, versionNumber } = await req.json()

    if (!documentId || !versionNumber) {
      throw new Error('Missing documentId or versionNumber')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get version details
    const { data: version, error: vError } = await supabase
      .from('ged_document_versions')
      .select('*')
      .eq('document_id', documentId)
      .eq('version_number', versionNumber)
      .single()

    if (vError || !version) throw new Error('Version not found')

    // 2. Download file from storage
    const { data: fileBlob, error: dError } = await supabase.storage
      .from('ged_files')
      .download(version.file_path)

    if (dError || !fileBlob) throw new Error('File download failed')

    const mimeType = version.mime_type
    const originalSize = fileBlob.size
    console.log(`Processing ${version.file_name} (${mimeType}) - Size: ${originalSize} bytes`)

    let processedBuffer: Uint8Array = new Uint8Array(await fileBlob.arrayBuffer())
    let hasChanged = false

    // 3. Process Images (Redimensionar e ajustar qualidade)
    if (mimeType.startsWith('image/')) {
      try {
        const img = await Image.decode(processedBuffer);
        
        // Resize if too large
        if (img.width > MAX_IMAGE_DIMENSION || img.height > MAX_IMAGE_DIMENSION) {
          img.resize(MAX_IMAGE_DIMENSION, Image.RESIZE_AUTO);
          hasChanged = true;
          console.log(`Resized image to max dimension ${MAX_IMAGE_DIMENSION}`);
        }

        // Always re-encode for compression (JPEG/PNG)
        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
          processedBuffer = await img.encodeJPEG(IMAGE_QUALITY);
          hasChanged = true;
        } else if (mimeType === 'image/png') {
          // PNG compression is lossless but we can optimize it
          processedBuffer = await img.encode(IMAGE_QUALITY);
          hasChanged = true;
        }
      } catch (imgError) {
        console.warn('Image processing failed, skipping compression:', imgError.message);
      }
    }

    // 4. Update file if processed
    if (hasChanged && processedBuffer.length < originalSize) {
      const { error: uError } = await supabase.storage
        .from('ged_files')
        .upload(version.file_path, processedBuffer, {
          contentType: mimeType,
          upsert: true
        });

      if (uError) throw new Error('Failed to update processed file');

      // Update size in database
      await supabase
        .from('ged_document_versions')
        .update({ file_size: processedBuffer.length })
        .eq('id', version.id);
        
      console.log(`Compressed from ${originalSize} to ${processedBuffer.length} bytes`);
    }

    return new Response(
      JSON.stringify({ 
        message: 'Document processed successfully',
        documentId,
        originalSize,
        processedSize: processedBuffer.length,
        compressed: hasChanged && processedBuffer.length < originalSize
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
