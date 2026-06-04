// Edge Function: whatsapp-open-conversation
// Cria ou recupera uma conversa do WhatsApp a partir de um telefone.
// Útil para iniciar atendimento manualmente (a partir do Lead ou de número livre).

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface Body {
  phone: string;
  name?: string | null;
  instance_id?: string | null;
  lead_id?: string | null;
  client_id?: string | null;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // Brasil default: se vier sem código do país, adiciona 55
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonError('Unauthorized', 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return jsonError('Unauthorized', 401);

    const body = (await req.json()) as Body;
    if (!body?.phone) return jsonError('phone obrigatório', 400);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const phone = normalizePhone(body.phone);

    // Resolve instance
    let instanceId = body.instance_id ?? null;
    if (!instanceId) {
      const { data: inst } = await admin
        .from('whatsapp_instances')
        .select('id')
        .eq('status', 'connected')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      instanceId = inst?.id ?? null;
      if (!instanceId) {
        const { data: any1 } = await admin
          .from('whatsapp_instances')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        instanceId = any1?.id ?? null;
      }
    }
    if (!instanceId) return jsonError('Nenhuma instância WhatsApp configurada', 400);

    // Try existing
    const { data: existing } = await admin
      .from('whatsapp_conversations')
      .select('id')
      .eq('instance_id', instanceId)
      .eq('contact_phone', phone)
      .maybeSingle();

    if (existing) {
      // Update lead_id/name if provided
      const patch: Record<string, unknown> = {};
      if (body.name) patch.contact_name = body.name;
      if (body.lead_id) patch.lead_id = body.lead_id;
      if (body.client_id) patch.client_id = body.client_id;
      if (Object.keys(patch).length > 0) {
        await admin.from('whatsapp_conversations').update(patch).eq('id', existing.id);
      }
      return new Response(JSON.stringify({ ok: true, conversation_id: existing.id, created: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pick default general queue (no team_member_id)
    const { data: q } = await admin
      .from('whatsapp_queues')
      .select('id')
      .is('team_member_id', null)
      .eq('active', true)
      .order('sort_order')
      .limit(1)
      .maybeSingle();

    const { data: created, error } = await admin
      .from('whatsapp_conversations')
      .insert({
        instance_id: instanceId,
        contact_phone: phone,
        contact_name: body.name ?? null,
        current_queue_id: q?.id ?? null,
        lead_id: body.lead_id ?? null,
        client_id: body.client_id ?? null,
        status: 'open',
        last_message_at: new Date().toISOString(),
        last_message_preview: '[Conversa iniciada manualmente]',
        unread_count: 0,
      })
      .select('id')
      .single();
    if (error) return jsonError(error.message, 500);

    return new Response(JSON.stringify({ ok: true, conversation_id: created.id, created: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('whatsapp-open-conversation error:', msg, stack);
    return jsonError(msg, 500);
  }
});
