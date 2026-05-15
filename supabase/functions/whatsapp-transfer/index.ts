// Edge Function: whatsapp-transfer
// Transfere conversa entre filas/atendentes e registra histórico.

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
  conversation_id: string;
  to_queue_id?: string | null;
  to_team_member_id?: string | null;
  note?: string;
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
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return jsonError('Unauthorized', 401);
    const userId = claims.claims.sub as string;

    const body = (await req.json()) as Body;
    if (!body?.conversation_id) return jsonError('conversation_id obrigatório', 400);
    if (!body.to_queue_id && !body.to_team_member_id) {
      return jsonError('Informe to_queue_id ou to_team_member_id', 400);
    }

    const { data: conv, error: convErr } = await userClient
      .from('whatsapp_conversations')
      .select('id, current_queue_id, assigned_team_member_id')
      .eq('id', body.conversation_id)
      .single();
    if (convErr || !conv) return jsonError('Conversa não encontrada ou sem acesso', 403);

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Resolve queue from team_member if needed
    let toQueueId = body.to_queue_id ?? null;
    if (!toQueueId && body.to_team_member_id) {
      const { data: q } = await admin
        .from('whatsapp_queues')
        .select('id')
        .eq('team_member_id', body.to_team_member_id)
        .eq('active', true)
        .limit(1)
        .maybeSingle();
      toQueueId = q?.id ?? null;
    }

    const update: Record<string, unknown> = {};
    if (toQueueId) update.current_queue_id = toQueueId;
    update.assigned_team_member_id = body.to_team_member_id ?? null;

    const { error: updErr } = await admin
      .from('whatsapp_conversations')
      .update(update)
      .eq('id', conv.id);
    if (updErr) return jsonError(updErr.message, 500);

    await admin.from('whatsapp_conversation_transfers').insert({
      conversation_id: conv.id,
      from_queue_id: conv.current_queue_id,
      to_queue_id: toQueueId,
      from_user_id: userId,
      to_user_id: null,
      note: body.note ?? null,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Erro', 500);
  }
});
