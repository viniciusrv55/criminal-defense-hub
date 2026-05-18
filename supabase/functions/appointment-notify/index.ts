// Edge Function: appointment-notify
// Envia notificação WhatsApp ao cliente quando um agendamento é criado/atualizado.
// Pode ser chamada manualmente pelo painel ou por automação futura.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// deno-lint-ignore no-explicit-any
type Any = any;

function fmtBR(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'full', timeStyle: 'short' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE);

  try {
    const { appointment_id, kind } = await req.json();
    if (!appointment_id) throw new Error('appointment_id obrigatório');

    const { data: appt } = await admin.from('appointments').select('*').eq('id', appointment_id).single();
    if (!appt) throw new Error('Compromisso não encontrado');

    // resolve phone via conversation or lead
    let phone: string | null = null;
    let instanceId: string | null = null;
    let conversationId: string | null = appt.conversation_id;
    if (conversationId) {
      const { data: conv } = await admin.from('whatsapp_conversations').select('contact_phone, instance_id').eq('id', conversationId).single();
      phone = conv?.contact_phone ?? null;
      instanceId = conv?.instance_id ?? null;
    } else if (appt.lead_id) {
      const { data: lead } = await admin.from('leads').select('phone').eq('id', appt.lead_id).single();
      phone = lead?.phone ?? null;
    }
    if (!phone) throw new Error('Telefone não disponível');
    if (!instanceId) {
      const { data: inst } = await admin.from('whatsapp_instances').select('id').eq('status', 'connected').limit(1).maybeSingle();
      instanceId = inst?.id ?? null;
    }
    if (!instanceId) throw new Error('Sem instância conectada');

    const { data: inst } = await admin.from('whatsapp_instances').select('instance_name').eq('id', instanceId).single();
    const { data: settings } = await admin.from('platform_settings').select('key,value').in('key', ['evolution_api_url', 'evolution_api_key']);
    const map = Object.fromEntries((settings ?? []).map((s: Any) => [s.key, s.value]));
    const baseUrl = (map.evolution_api_url ?? '').replace(/\/+$/, '');
    const apiKey = map.evolution_api_key;
    if (!baseUrl || !apiKey) throw new Error('Evolution não configurada');

    const when = fmtBR(appt.starts_at);
    let text = '';
    if (kind === 'cancel') {
      text = `❌ Seu compromisso "${appt.title}" em ${when} foi cancelado. Caso precise reagendar, é só responder esta conversa.`;
    } else if (kind === 'reminder') {
      text = `🔔 Lembrete: você tem "${appt.title}" agendado para ${when}${appt.location ? ` em ${appt.location}` : ''}. Até breve!`;
    } else {
      text = `✅ Confirmação de agendamento\n\n📅 ${appt.title}\n🕐 ${when}${appt.location ? `\n📍 ${appt.location}` : ''}${appt.meeting_url ? `\n🔗 ${appt.meeting_url}` : ''}\n\nQualquer alteração, é só responder aqui.`;
    }

    const r = await fetch(`${baseUrl}/message/sendText/${inst.instance_name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number: phone, text }),
    });
    if (!r.ok) throw new Error(`Evolution ${r.status}`);

    const patch: Any = {};
    if (kind === 'reminder') patch.reminder_sent_at = new Date().toISOString();
    else if (kind !== 'cancel') patch.confirmation_sent_at = new Date().toISOString();
    if (Object.keys(patch).length) await admin.from('appointments').update(patch).eq('id', appointment_id);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Erro';
    return new Response(JSON.stringify({ ok: false, error: m }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
