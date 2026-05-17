// Edge Function: whatsapp-media-process
// Baixa mídia da Evolution, sobe para Storage privado e transcreve (áudio) ou descreve (imagem) via OpenAI.
// Chamada server-side (sem JWT) pelo evolution-webhook.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// deno-lint-ignore no-explicit-any
type Any = any;

async function downloadMedia(baseUrl: string, apiKey: string, instanceName: string, evoMsgId: string): Promise<{ data: Uint8Array; mime: string } | null> {
  // Tenta o endpoint base64 da Evolution
  try {
    const r = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ message: { key: { id: evoMsgId } } }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const b64 = j?.base64 ?? j?.data ?? null;
    const mime = j?.mimetype ?? j?.mime ?? 'application/octet-stream';
    if (!b64) return null;
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return { data: bin, mime };
  } catch {
    return null;
  }
}

function extFromMime(mime: string): string {
  if (mime.includes('ogg') || mime.includes('opus')) return 'ogg';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('m4a') || mime.includes('mp4')) return 'm4a';
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('pdf')) return 'pdf';
  return 'bin';
}

async function transcribeAudio(apiKey: string, data: Uint8Array, mime: string): Promise<string> {
  const ext = extFromMime(mime);
  const file = new File([data], `audio.${ext}`, { type: mime || 'audio/ogg' });
  const form = new FormData();
  form.append('file', file);
  form.append('model', 'whisper-1');
  form.append('language', 'pt');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Whisper ${r.status}: ${t.slice(0, 300)}`);
  const j = JSON.parse(t);
  return j.text ?? '';
}

async function describeImage(apiKey: string, data: Uint8Array, mime: string, caption?: string | null): Promise<string> {
  const b64 = btoa(String.fromCharCode(...data));
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Descreva brevemente esta imagem enviada por um cliente em um chat jurídico. Seja objetivo e útil para um advogado entender o conteúdo. Se houver texto, transcreva o essencial.${caption ? ` Legenda do cliente: "${caption}".` : ''}` },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
        ],
      }],
    }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Vision ${r.status}: ${t.slice(0, 300)}`);
  const j = JSON.parse(t);
  return j.choices?.[0]?.message?.content ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const OPENAI = Deno.env.get('OPENAI_API_KEY');
  const admin = createClient(SUPABASE_URL, SERVICE);

  try {
    const { message_id } = await req.json();
    if (!message_id) throw new Error('message_id obrigatório');

    const { data: msg } = await admin
      .from('whatsapp_messages')
      .select('id, conversation_id, message_type, content, media_mime, evolution_message_id, metadata')
      .eq('id', message_id)
      .single();
    if (!msg) throw new Error('Mensagem não encontrada');
    if (!['audio', 'image', 'document'].includes(msg.message_type)) {
      return new Response(JSON.stringify({ ok: true, skipped: 'tipo não suportado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: conv } = await admin
      .from('whatsapp_conversations')
      .select('instance_id, ai_enabled, ai_paused_at, current_queue_id')
      .eq('id', msg.conversation_id)
      .single();
    const { data: inst } = await admin.from('whatsapp_instances').select('instance_name').eq('id', conv.instance_id).single();
    const { data: settings } = await admin
      .from('platform_settings').select('key,value')
      .in('key', ['evolution_api_url', 'evolution_api_key']);
    const map = Object.fromEntries((settings ?? []).map((s: Any) => [s.key, s.value]));
    const baseUrl = (map.evolution_api_url ?? '').replace(/\/+$/, '');
    const apiKey = map.evolution_api_key;

    if (!baseUrl || !apiKey || !inst?.instance_name || !msg.evolution_message_id) {
      throw new Error('Config Evolution ausente');
    }

    const dl = await downloadMedia(baseUrl, apiKey, inst.instance_name, msg.evolution_message_id);
    if (!dl) throw new Error('Download falhou');

    // Upload para storage privado
    const ext = extFromMime(dl.mime || msg.media_mime || '');
    const path = `${msg.conversation_id}/${msg.id}.${ext}`;
    const { error: upErr } = await admin.storage.from('whatsapp-media').upload(path, dl.data, {
      contentType: dl.mime, upsert: true,
    });
    if (upErr) console.error('upload err', upErr);
    const { data: signed } = await admin.storage.from('whatsapp-media').createSignedUrl(path, 60 * 60 * 24 * 7);

    const updates: Any = { media_url: signed?.signedUrl ?? null, media_mime: dl.mime };
    const metaPatch: Any = { ...(msg.metadata ?? {}), storage_path: path };

    if (OPENAI && msg.message_type === 'audio') {
      try {
        const transcript = await transcribeAudio(OPENAI, dl.data, dl.mime);
        metaPatch.transcript = transcript;
        updates.content = transcript || msg.content;
      } catch (e) {
        metaPatch.transcript_error = e instanceof Error ? e.message : 'erro';
      }
    } else if (OPENAI && msg.message_type === 'image') {
      try {
        const desc = await describeImage(OPENAI, dl.data, dl.mime, msg.content);
        metaPatch.image_description = desc;
      } catch (e) {
        metaPatch.image_description_error = e instanceof Error ? e.message : 'erro';
      }
    }

    updates.metadata = metaPatch;
    await admin.from('whatsapp_messages').update(updates).eq('id', msg.id);

    // Se IA ativa e foi áudio, dispara reply usando o transcript
    if (msg.message_type === 'audio' && metaPatch.transcript && conv?.ai_enabled && !conv.ai_paused_at && conv.current_queue_id) {
      const { data: agent } = await admin.from('ai_agents').select('id').eq('queue_id', conv.current_queue_id).eq('active', true).maybeSingle();
      if (agent?.id) {
        fetch(`${SUPABASE_URL}/functions/v1/ai-agent-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE}` },
          body: JSON.stringify({ conversation_id: msg.conversation_id }),
        }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Erro';
    console.error('media-process', m);
    return new Response(JSON.stringify({ ok: false, error: m }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
