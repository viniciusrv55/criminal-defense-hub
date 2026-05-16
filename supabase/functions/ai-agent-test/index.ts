// Edge Function: ai-agent-test
// Playground: roda o agente sobre uma lista de mensagens de teste sem enviar pro WhatsApp.
// Requer JWT de admin.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { runAgent } from '../ai-agent-reply/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdmin } = await admin.rpc('is_admin', { _user_id: userId });
    if (!isAdmin) return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { agent_id, messages } = body ?? {};
    if (!agent_id || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ ok: false, error: 'agent_id e messages[] obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Use a fake conversation id (won't be used in dry-run path for sends)
    // Pick any conversation to satisfy lookups OR create stub flow: we use overrideAgentId + overrideMessages
    // runAgent expects a real conversation row for context. Pick the latest open conversation, else create temporary one.
    let convId: string | null = null;
    const { data: anyConv } = await admin.from('whatsapp_conversations').select('id').limit(1).maybeSingle();
    if (anyConv) convId = anyConv.id;
    if (!convId) {
      return new Response(JSON.stringify({ ok: false, error: 'Sem conversas para usar como contexto. Crie uma conversa de teste primeiro.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada');

    const result = await runAgent(admin, openaiKey, convId, {
      dryRun: true,
      overrideAgentId: agent_id,
      overrideMessages: messages,
    });

    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
