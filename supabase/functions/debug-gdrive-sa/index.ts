import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const raw = Deno.env.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON') || '';
    const folder = Deno.env.get('GOOGLE_DRIVE_IRPF_FOLDER_ID') || '';
    const result: any = {
      raw_length: raw.length,
      raw_starts_with: raw.slice(0, 30),
      folder_id: folder,
    };
    try {
      const sa = JSON.parse(raw);
      result.parsed_ok = true;
      result.client_email = sa.client_email;
      result.project_id = sa.project_id;
      result.private_key_id = sa.private_key_id;
      result.private_key_starts = (sa.private_key || '').slice(0, 30);
      result.private_key_length = (sa.private_key || '').length;
      result.has_newlines_in_private_key = (sa.private_key || '').includes('\n');
    } catch (e) {
      result.parsed_ok = false;
      result.parse_error = String(e);
    }
    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
