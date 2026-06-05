// Edge Function: evolution-api
// Proxy autenticado para a Evolution API. Lê credenciais de platform_settings.
// Apenas admins (super_admin/admin) podem chamar.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ProxyRequest {
  action: string;
  instanceName?: string;
  payload?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError('Unauthorized', 401);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    if (!SERVICE) return jsonError('Service role key não configurada', 500);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return jsonError('Unauthorized', 401);

    const userId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE);

    // Verifica se é admin
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role));
    if (!roleSet.has('admin') && !roleSet.has('super_admin')) {
      return jsonError('Forbidden: admin only', 403);
    }

    // Carrega credenciais Evolution
    const { data: settings, error: setErr } = await admin
      .from('platform_settings')
      .select('key,value')
      .in('key', ['evolution_api_url', 'evolution_api_key']);
    if (setErr) return jsonError(`Erro ao ler configurações: ${setErr.message}`, 500);

    const map = Object.fromEntries(
      (settings ?? []).map((s: { key: string; value: string | null }) => [s.key, s.value]),
    );
    const baseUrl = (map.evolution_api_url ?? '').replace(/\/+$/, '');
    const apiKey = map.evolution_api_key;

    if (!baseUrl || !apiKey) {
      return jsonError(
        'Evolution API não configurada. Acesse /admin/plataforma e preencha URL e API Key.',
        400,
      );
    }

    const body = (await req.json()) as ProxyRequest;
    const { action, instanceName, payload } = body;

    let path = '';
    let method: 'GET' | 'POST' | 'DELETE' = 'GET';
    let upstreamBody: unknown = undefined;

    switch (action) {
      case 'fetchInstances':
        path = '/instance/fetchInstances';
        method = 'GET';
        break;
      case 'createInstance':
        path = '/instance/create';
        method = 'POST';
        upstreamBody = payload;
        break;
      case 'connect':
        if (!instanceName) return jsonError('instanceName obrigatório', 400);
        path = `/instance/connect/${instanceName}`;
        method = 'GET';
        break;
      case 'connectionState':
        if (!instanceName) return jsonError('instanceName obrigatório', 400);
        path = `/instance/connectionState/${instanceName}`;
        method = 'GET';
        break;
      case 'logout':
        if (!instanceName) return jsonError('instanceName obrigatório', 400);
        path = `/instance/logout/${instanceName}`;
        method = 'DELETE';
        break;
      case 'deleteInstance':
        if (!instanceName) return jsonError('instanceName obrigatório', 400);
        path = `/instance/delete/${instanceName}`;
        method = 'DELETE';
        break;
      case 'setWebhook':
        if (!instanceName) return jsonError('instanceName obrigatório', 400);
        path = `/webhook/set/${instanceName}`;
        method = 'POST';
        upstreamBody = payload;
        break;
      case 'testConnection':
        path = '/';
        method = 'GET';
        break;
      default:
        return jsonError(`Ação desconhecida: ${action}`, 400);
    }

    const url = `${baseUrl}${path}`;
    const upstream = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: upstreamBody ? JSON.stringify(upstreamBody) : undefined,
    });

    const text = await upstream.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    return new Response(
      JSON.stringify({ ok: upstream.ok, status: upstream.status, data: parsed }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('evolution-api error:', msg, stack);
    return jsonError(msg, 500);
  }
});

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
