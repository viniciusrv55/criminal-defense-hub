// Edge Function: evolution-webhook
// Recebe eventos da Evolution API. Endpoint público (sem JWT), apenas registra log.
// A lógica de conversa/mensagem entra na Fase 2.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    const payload = await req.json().catch(() => ({}));
    const eventType: string =
      (payload as { event?: string })?.event ??
      (payload as { type?: string })?.type ??
      'unknown';
    const instanceName: string | null =
      (payload as { instance?: string })?.instance ??
      (payload as { instanceName?: string })?.instanceName ??
      null;

    await admin.from('whatsapp_webhook_logs').insert({
      instance_name: instanceName,
      event_type: eventType,
      payload,
      processed: false,
    });

    // Atualiza status da instância em eventos de conexão conhecidos
    if (instanceName && (eventType === 'connection.update' || eventType === 'CONNECTION_UPDATE')) {
      const state = (payload as { data?: { state?: string }; state?: string })?.data?.state ??
        (payload as { state?: string })?.state ?? null;
      if (state) {
        const status =
          state === 'open' ? 'connected'
            : state === 'connecting' ? 'connecting'
            : 'disconnected';
        await admin
          .from('whatsapp_instances')
          .update({
            status,
            last_connected_at: status === 'connected' ? new Date().toISOString() : null,
          })
          .eq('instance_name', instanceName);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200, // Sempre 200 pra Evolution não reenviar em loop
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
