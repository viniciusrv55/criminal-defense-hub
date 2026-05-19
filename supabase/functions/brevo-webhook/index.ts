// Edge Function: brevo-webhook
// Recebe eventos da Brevo (delivered/opened/click/bounce/spam) e atualiza campaign_recipients.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE);

  try {
    const events = await req.json().catch(() => []);
    const list = Array.isArray(events) ? events : [events];

    for (const ev of list) {
      const event = String(ev?.event ?? '').toLowerCase();
      const messageId = ev?.['message-id'] ?? ev?.messageId ?? null;
      const email = ev?.email ?? null;
      if (!messageId && !email) continue;

      const updates: Record<string, unknown> = {};
      const now = new Date().toISOString();

      switch (event) {
        case 'delivered':
          updates.status = 'delivered';
          updates.delivered_at = now;
          break;
        case 'opened':
        case 'unique_opened':
          updates.status = 'read';
          updates.read_at = now;
          break;
        case 'click':
          // increment clicks via RPC fallback: read then write
          break;
        case 'soft_bounce':
        case 'hard_bounce':
          updates.status = 'bounced';
          updates.error = ev?.reason ?? event;
          if (event === 'hard_bounce' && email) {
            await admin.from('unsubscribes').insert({ email, channel: 'email', reason: 'hard_bounce' });
          }
          break;
        case 'spam':
        case 'unsubscribed':
          updates.status = 'unsubscribed';
          if (email) await admin.from('unsubscribes').insert({ email, channel: 'email', reason: event });
          break;
      }

      if (Object.keys(updates).length > 0 && messageId) {
        await admin.from('campaign_recipients').update(updates).eq('provider_message_id', messageId);
      }
      if (event === 'click' && messageId) {
        const { data: row } = await admin.from('campaign_recipients').select('id, clicks').eq('provider_message_id', messageId).maybeSingle();
        if (row) await admin.from('campaign_recipients').update({ clicks: (row.clicks ?? 0) + 1 }).eq('id', row.id);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
