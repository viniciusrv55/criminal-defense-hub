// Edge Function: whatsapp-send
// Envia mensagem pelo WhatsApp via Evolution API e registra em whatsapp_messages.
// Requer JWT. Verifica acesso à conversa via RLS (chamando como usuário).

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

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function sanitizeFileName(name: string, defaultExt: string) {
  const withoutQuery = name.split('?')[0].split('#')[0];
  const base = decodeURIComponent(withoutQuery.split('/').pop() || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || `arquivo.${defaultExt}`;
  const withoutTrailingDots = base.replace(/\.+$/g, '');
  return new RegExp(`\\.${defaultExt}$`, 'i').test(withoutTrailingDots)
    ? withoutTrailingDots
    : `${withoutTrailingDots.replace(/\.[a-z0-9]{1,12}$/i, '')}.${defaultExt}`;
}

interface SendBody {
  conversation_id: string;
  message_type?: 'text' | 'image' | 'document' | 'audio' | 'video';
  content?: string;
  media_url?: string;
  media_mime?: string;
  file_name?: string;
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

    const body = (await req.json()) as SendBody;
    if (!body?.conversation_id) return jsonError('conversation_id obrigatório', 400);
    const messageType = body.message_type ?? 'text';
    if (messageType === 'text' && !body.content?.trim()) {
      return jsonError('content obrigatório para text', 400);
    }
    if (messageType !== 'text' && !body.media_url) {
      return jsonError('media_url obrigatório para mídia', 400);
    }

    // Read conversation as the user (RLS validates access)
    const { data: conv, error: convErr } = await userClient
      .from('whatsapp_conversations')
      .select('id, instance_id, contact_phone')
      .eq('id', body.conversation_id)
      .single();
    if (convErr || !conv) return jsonError('Conversa não encontrada ou sem acesso', 403);

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Get instance + credentials
    const { data: inst } = await admin
      .from('whatsapp_instances')
      .select('instance_name, status')
      .eq('id', conv.instance_id)
      .single();
    if (!inst) return jsonError('Instância não encontrada', 404);

    const { data: settings } = await admin
      .from('platform_settings')
      .select('key,value')
      .in('key', ['evolution_api_url', 'evolution_api_key']);
    const map = Object.fromEntries((settings ?? []).map((s) => [s.key, s.value]));
    const baseUrl = (map.evolution_api_url ?? '').replace(/\/+$/, '');
    const apiKey = map.evolution_api_key;
    if (!baseUrl || !apiKey) return jsonError('Evolution API não configurada', 400);

    const number = conv.contact_phone;
    let path = '';
    let upstreamBody: Record<string, unknown> = {};

    if (messageType === 'text') {
      path = `/message/sendText/${inst.instance_name}`;
      upstreamBody = { number, text: body.content };
    } else if (messageType === 'audio') {
      // Endpoint dedicado para áudio/PTT — Evolution converte para opus automaticamente
      path = `/message/sendWhatsAppAudio/${inst.instance_name}`;
      upstreamBody = { number, audio: body.media_url, encoding: true };
    } else {
      path = `/message/sendMedia/${inst.instance_name}`;
      // Deriva fileName explícito ou do path da URL (ignorando query string), garantindo extensão correta.
      const urlPath = (() => { try { return new URL(body.media_url ?? '').pathname; } catch { return body.media_url ?? ''; } })();
      const defaultExt = messageType === 'image' ? 'jpg' : messageType === 'video' ? 'mp4' : 'pdf';
      const defaultMime = messageType === 'image' ? 'image/jpeg' : messageType === 'video' ? 'video/mp4' : 'application/pdf';
      const fileName = sanitizeFileName(body.file_name || urlPath, defaultExt);
      const mimeType = body.media_mime || defaultMime;
      let media: string = body.media_url ?? '';

      // Para documentos, envia base64 em vez da URL assinada do Supabase. URLs com token
      // fazem o WhatsApp Desktop interpretar o hash da query como extensão do arquivo.
      if (messageType === 'document') {
        const mediaRes = await fetch(media);
        if (!mediaRes.ok) return jsonError('Não foi possível baixar o documento para envio', 400);
        media = arrayBufferToBase64(await mediaRes.arrayBuffer());
      }

      upstreamBody = {
        number,
        mediatype: messageType,
        media,
        caption: body.content ?? '',
        fileName,
        filename: fileName,
        mimetype: mimeType,
      };
    }

    const upstream = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify(upstreamBody),
    });
    const text = await upstream.text();
    let parsed: unknown;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ ok: false, status: upstream.status, error: parsed }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // deno-lint-ignore no-explicit-any
    const evoId: string | null = (parsed as any)?.key?.id ?? (parsed as any)?.id ?? null;

    // Save outbound message (admin client to bypass needing insert RLS for this)
    const { error: insErr } = await admin.from('whatsapp_messages').insert({
      conversation_id: conv.id,
      evolution_message_id: evoId,
      direction: 'outbound',
      to_phone: number,
      message_type: messageType,
      content: body.content ?? null,
      media_url: body.media_url ?? null,
      sent_by_user_id: userId,
      status: 'sent',
      metadata: parsed ?? {},
    });
    if (insErr) return jsonError(`Erro ao salvar mensagem: ${insErr.message}`, 500);

    await admin
      .from('whatsapp_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: (body.content ?? `[${messageType}]`).slice(0, 200),
        unread_count: 0,
        ai_paused_at: new Date().toISOString(),
        ai_handoff_reason: 'Atendente humano assumiu',
      })
      .eq('id', conv.id);

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return jsonError(msg, 500);
  }
});
