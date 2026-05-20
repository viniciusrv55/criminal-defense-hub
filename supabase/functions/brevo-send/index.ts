// Edge Function: brevo-send
// Envia um e-mail individual via Brevo (com auth) ou processa um recipient de campanha (com service role).

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface BrevoSendBody {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  from?: { email: string; name?: string };
  replyTo?: { email: string; name?: string };
  tags?: string[];
  headers?: Record<string, string>;
}

async function sendBrevo(payload: BrevoSendBody, apiKey: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `Brevo ${res.status}: ${JSON.stringify(data)}` };
  return { ok: true, messageId: data?.messageId ?? null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE);
    const body = await req.json();

    // Load Brevo creds + sender defaults from platform_settings
    const { data: settings } = await admin
      .from('platform_settings')
      .select('key,value')
      .in('key', ['brevo_api_key', 'brevo_sender_email', 'brevo_sender_name', 'brevo_reply_to']);
    const cfg = Object.fromEntries((settings ?? []).map((s) => [s.key, s.value]));
    const BREVO = cfg.brevo_api_key;
    if (!BREVO) return new Response(JSON.stringify({ ok: false, error: 'brevo_api_key não configurada em Plataforma' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const payload: BrevoSendBody = {
      to: body.to,
      subject: body.subject,
      htmlContent: body.htmlContent,
      from: body.from ?? { email: cfg.brevo_sender_email, name: cfg.brevo_sender_name },
      replyTo: body.replyTo ?? (cfg.brevo_reply_to ? { email: cfg.brevo_reply_to } : undefined),
      tags: body.tags,
      headers: body.headers,
    };
    if (!payload.to?.length || !payload.subject || !payload.htmlContent || !payload.from?.email) {
      return new Response(JSON.stringify({ ok: false, error: 'Campos obrigatórios faltando' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const result = await sendBrevo(payload, BREVO);
    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
