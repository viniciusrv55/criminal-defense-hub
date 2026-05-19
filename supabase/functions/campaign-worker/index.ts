// Edge Function: campaign-worker
// Processa campanhas em status 'running'. Pode ser chamado por cron (a cada 1 min) ou manualmente.
// Para cada campanha rodando, envia até throttle_per_minute destinatários pendentes.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// deno-lint-ignore no-explicit-any
type Any = any;

function render(template: string, vars: Record<string, Any>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? '' : String(v);
  });
}

async function sendWhatsApp(baseUrl: string, apiKey: string, instanceName: string, number: string, text: string, mediaUrl?: string | null) {
  const path = mediaUrl
    ? `/message/sendMedia/${instanceName}`
    : `/message/sendText/${instanceName}`;
  const body = mediaUrl
    ? { number, mediatype: 'image', media: mediaUrl, caption: text }
    : { number, text };
  const r = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${JSON.stringify(data)}`);
  return data?.key?.id ?? data?.id ?? null;
}

async function sendBrevoEmail(apiKey: string, from: { email: string; name?: string }, to: { email: string; name?: string }, subject: string, html: string, replyTo?: { email: string }) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey, accept: 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, htmlContent: html, replyTo }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${JSON.stringify(data)}`);
  return data?.messageId ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE);

  try {
    // Auto-promote scheduled campaigns whose time has come
    await admin
      .from('campaigns')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    // Pick running campaigns
    const { data: campaigns } = await admin
      .from('campaigns')
      .select('*')
      .eq('status', 'running')
      .order('created_at')
      .limit(5);

    const results: Any[] = [];
    for (const c of campaigns ?? []) {
      const throttle = Math.max(1, c.throttle_per_minute ?? 10);
      const { data: pending } = await admin
        .from('campaign_recipients')
        .select('*')
        .eq('campaign_id', c.id)
        .eq('status', 'pending')
        .limit(throttle);

      // Resolve provider creds
      let evoBase = '', evoKey = '', instanceName = '';
      let brevoKey = '';
      let brevoFrom: { email: string; name?: string } | null = null;
      let brevoReplyTo: { email: string } | undefined;

      if (c.channel === 'whatsapp') {
        const { data: settings } = await admin
          .from('platform_settings').select('key,value')
          .in('key', ['evolution_api_url', 'evolution_api_key']);
        const m = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]));
        evoBase = (m.evolution_api_url ?? '').replace(/\/+$/, '');
        evoKey = m.evolution_api_key ?? '';
        const { data: inst } = await admin
          .from('whatsapp_instances').select('instance_name')
          .eq('id', c.whatsapp_instance_id).maybeSingle();
        instanceName = inst?.instance_name ?? '';
        if (!evoBase || !evoKey || !instanceName) {
          await admin.from('campaigns').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('id', c.id);
          continue;
        }
      } else if (c.channel === 'email') {
        brevoKey = Deno.env.get('BREVO_API_KEY') ?? '';
        const { data: settings } = await admin
          .from('platform_settings').select('key,value')
          .in('key', ['brevo_sender_email', 'brevo_sender_name', 'brevo_reply_to']);
        const m = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]));
        brevoFrom = { email: c.from_email ?? m.brevo_sender_email, name: c.from_name ?? m.brevo_sender_name };
        if (m.brevo_reply_to || c.reply_to) brevoReplyTo = { email: c.reply_to ?? m.brevo_reply_to };
        if (!brevoKey || !brevoFrom.email) {
          await admin.from('campaigns').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('id', c.id);
          continue;
        }
      }

      let sent = 0, failed = 0;
      for (const r of pending ?? []) {
        // Unsubscribe check
        const { data: unsub } = await admin
          .from('unsubscribes').select('id')
          .or(`phone.eq.${r.phone ?? '___'},email.eq.${r.email ?? '___'}`)
          .limit(1).maybeSingle();
        if (unsub) {
          await admin.from('campaign_recipients').update({ status: 'unsubscribed', error: 'opt-out' }).eq('id', r.id);
          continue;
        }

        try {
          await admin.from('campaign_recipients').update({ status: 'sending' }).eq('id', r.id);
          const vars = { ...(r.vars ?? {}), nome: r.name ?? '' };
          const bodyText = render(r.personalized_body ?? c.body_override ?? '', vars);
          const subject = render(r.personalized_subject ?? c.subject_override ?? '', vars);
          let providerId: string | null = null;

          if (c.channel === 'whatsapp') {
            if (!r.phone) throw new Error('telefone vazio');
            providerId = await sendWhatsApp(evoBase, evoKey, instanceName, r.phone, bodyText, c.media_url);
          } else {
            if (!r.email) throw new Error('email vazio');
            providerId = await sendBrevoEmail(brevoKey, brevoFrom!, { email: r.email, name: r.name ?? undefined }, subject, bodyText, brevoReplyTo);
          }

          await admin.from('campaign_recipients').update({
            status: 'sent', sent_at: new Date().toISOString(), provider_message_id: providerId,
          }).eq('id', r.id);
          sent++;

          // jitter
          const jitter = Math.max(0, c.jitter_seconds ?? 5);
          const ms = Math.floor((Math.random() * jitter + 1) * 1000);
          await new Promise(res => setTimeout(res, Math.min(ms, 8000)));
        } catch (err) {
          failed++;
          await admin.from('campaign_recipients').update({
            status: 'failed', error: err instanceof Error ? err.message : String(err),
          }).eq('id', r.id);
        }
      }

      // Update stats
      const { count: pendingCount } = await admin
        .from('campaign_recipients').select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id).eq('status', 'pending');

      const stats = { ...(c.stats ?? {}), sent: (c.stats?.sent ?? 0) + sent, failed: (c.stats?.failed ?? 0) + failed };
      const updates: Any = { stats };
      if ((pendingCount ?? 0) === 0) {
        updates.status = 'completed';
        updates.finished_at = new Date().toISOString();
      }
      await admin.from('campaigns').update(updates).eq('id', c.id);

      results.push({ campaign_id: c.id, sent, failed, remaining: pendingCount ?? 0 });
    }

    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
