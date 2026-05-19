// Edge Function: evolution-webhook
// Recebe eventos da Evolution API. Endpoint público (sem JWT).
// Processa: connection.update, messages.upsert, messages.update, contacts.update.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// deno-lint-ignore no-explicit-any
type Any = any;

function normalizeEvent(t: string): string {
  return (t || '').toLowerCase().replace(/_/g, '.');
}

function jidToPhone(jid: string | undefined | null): string | null {
  if (!jid) return null;
  // 5511999999999@s.whatsapp.net -> 5511999999999
  return jid.split('@')[0] ?? null;
}

function extractText(msg: Any): string {
  if (!msg) return '';
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    ''
  );
}

function detectType(msg: Any): { type: string; mediaUrl?: string; mime?: string } {
  if (!msg) return { type: 'text' };
  if (msg.imageMessage) return { type: 'image', mediaUrl: msg.imageMessage.url, mime: msg.imageMessage.mimetype };
  if (msg.videoMessage) return { type: 'video', mediaUrl: msg.videoMessage.url, mime: msg.videoMessage.mimetype };
  if (msg.audioMessage) return { type: 'audio', mediaUrl: msg.audioMessage.url, mime: msg.audioMessage.mimetype };
  if (msg.documentMessage) return { type: 'document', mediaUrl: msg.documentMessage.url, mime: msg.documentMessage.mimetype };
  if (msg.stickerMessage) return { type: 'sticker', mediaUrl: msg.stickerMessage.url, mime: msg.stickerMessage.mimetype };
  if (msg.locationMessage) return { type: 'location' };
  return { type: 'text' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE);

  let logId: string | null = null;

  try {
    const payload: Any = await req.json().catch(() => ({}));
    const rawEvent: string = payload?.event ?? payload?.type ?? 'unknown';
    const eventType = normalizeEvent(rawEvent);
    const instanceName: string | null = payload?.instance ?? payload?.instanceName ?? null;

    const { data: logRow } = await admin
      .from('whatsapp_webhook_logs')
      .insert({ instance_name: instanceName, event_type: eventType, payload, processed: false })
      .select('id')
      .single();
    logId = logRow?.id ?? null;

    // Find instance row
    let instanceId: string | null = null;
    if (instanceName) {
      const { data: inst } = await admin
        .from('whatsapp_instances')
        .select('id')
        .eq('instance_name', instanceName)
        .maybeSingle();
      instanceId = inst?.id ?? null;
    }

    // === connection.update ===
    if (eventType === 'connection.update' && instanceName) {
      const state = payload?.data?.state ?? payload?.state ?? null;
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

    // === messages.upsert (incoming or sent message echoes) ===
    if ((eventType === 'messages.upsert' || eventType === 'send.message') && instanceId) {
      const msgs: Any[] = Array.isArray(payload?.data) ? payload.data : payload?.data ? [payload.data] : [];
      for (const m of msgs) {
        const key = m?.key ?? {};
        const remoteJid: string = key.remoteJid ?? '';
        const fromMe: boolean = !!key.fromMe;
        const messageId: string = key.id ?? null;
        const phone = jidToPhone(remoteJid);
        if (!phone || !messageId) continue;

        // Resolve queue: instance owner or general
        const { data: instFull } = await admin
          .from('whatsapp_instances')
          .select('team_member_id')
          .eq('id', instanceId)
          .maybeSingle();

        let queueId: string | null = null;
        if (instFull?.team_member_id) {
          const { data: q } = await admin
            .from('whatsapp_queues')
            .select('id')
            .eq('team_member_id', instFull.team_member_id)
            .eq('active', true)
            .limit(1)
            .maybeSingle();
          queueId = q?.id ?? null;
        }
        if (!queueId) {
          const { data: gen } = await admin
            .from('whatsapp_queues')
            .select('id')
            .is('team_member_id', null)
            .eq('active', true)
            .order('sort_order')
            .limit(1)
            .maybeSingle();
          queueId = gen?.id ?? null;
        }

        const contactName: string | null = m?.pushName ?? null;
        const text = extractText(m?.message);
        const { type, mediaUrl, mime } = detectType(m?.message);
        const preview = text || `[${type}]`;

        // Try linking to existing lead/client by phone
        let leadId: string | null = null;
        let clientId: string | null = null;
        const phoneVariants = [phone, `+${phone}`];
        const { data: leadMatch } = await admin
          .from('leads')
          .select('id')
          .in('phone', phoneVariants)
          .limit(1)
          .maybeSingle();
        leadId = leadMatch?.id ?? null;

        // Upsert conversation
        const { data: existing } = await admin
          .from('whatsapp_conversations')
          .select('id, current_queue_id, lead_id, client_id, unread_count')
          .eq('instance_id', instanceId)
          .eq('contact_phone', phone)
          .maybeSingle();

        let conversationId: string;
        if (existing) {
          conversationId = existing.id;
          await admin
            .from('whatsapp_conversations')
            .update({
              contact_name: contactName ?? undefined,
              last_message_at: new Date().toISOString(),
              last_message_preview: preview.slice(0, 200),
              unread_count: fromMe ? existing.unread_count : (existing.unread_count ?? 0) + 1,
              current_queue_id: existing.current_queue_id ?? queueId,
              lead_id: existing.lead_id ?? leadId,
            })
            .eq('id', conversationId);
        } else {
          const { data: created, error: createErr } = await admin
            .from('whatsapp_conversations')
            .insert({
              instance_id: instanceId,
              contact_phone: phone,
              contact_name: contactName,
              current_queue_id: queueId,
              lead_id: leadId,
              client_id: clientId,
              status: 'open',
              last_message_at: new Date().toISOString(),
              last_message_preview: preview.slice(0, 200),
              unread_count: fromMe ? 0 : 1,
            })
            .select('id')
            .single();
          if (createErr) throw createErr;
          conversationId = created.id;
        }

        // Insert message (dedupe by evolution_message_id)
        const { data: inserted } = await admin.from('whatsapp_messages').upsert(
          {
            conversation_id: conversationId,
            evolution_message_id: messageId,
            direction: fromMe ? 'outbound' : 'inbound',
            from_phone: fromMe ? null : phone,
            to_phone: fromMe ? phone : null,
            message_type: type,
            content: text || null,
            media_url: mediaUrl ?? null,
            media_mime: mime ?? null,
            metadata: m ?? {},
            status: 'sent',
          },
          { onConflict: 'evolution_message_id', ignoreDuplicates: true },
        ).select('id').maybeSingle();

        // Auto-unsubscribe on opt-out keywords (inbound text only)
        if (!fromMe && type === 'text' && text) {
          const lower = text.trim().toLowerCase();
          if (/^(sair|parar|descadastrar|cancelar|remover|stop|unsubscribe)\b/.test(lower)) {
            await admin.from('unsubscribes').insert({ phone, channel: 'whatsapp', reason: `keyword: ${lower.slice(0,30)}` });
          }
        }

        // Trigger media processing for inbound audio/image/document
        if (!fromMe && inserted?.id && ['audio', 'image', 'document'].includes(type)) {
          fetch(`${SUPABASE_URL}/functions/v1/whatsapp-media-process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE}` },
            body: JSON.stringify({ message_id: inserted.id }),
          }).catch((err) => console.error('media-process trigger failed', err));
        }

        // Trigger AI agent reply (fire-and-forget) for new inbound TEXT messages
        // (audio triggers AI after transcription inside media-process)
        if (!fromMe && inserted?.id && type === 'text') {
          const { data: convFull } = await admin
            .from('whatsapp_conversations')
            .select('ai_enabled, ai_paused_at, current_queue_id')
            .eq('id', conversationId)
            .maybeSingle();
          if (convFull?.ai_enabled && !convFull.ai_paused_at && convFull.current_queue_id) {
            const { data: agent } = await admin
              .from('ai_agents')
              .select('id')
              .eq('queue_id', convFull.current_queue_id)
              .eq('active', true)
              .maybeSingle();
            if (agent?.id) {
              // Fire-and-forget
              fetch(`${SUPABASE_URL}/functions/v1/ai-agent-reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE}` },
                body: JSON.stringify({ conversation_id: conversationId }),
              }).catch((err) => console.error('ai-agent-reply trigger failed', err));
            }
          }
        }
      }
    }

    // === messages.update (status changes) ===
    if (eventType === 'messages.update') {
      const updates: Any[] = Array.isArray(payload?.data) ? payload.data : payload?.data ? [payload.data] : [];
      for (const u of updates) {
        const id = u?.key?.id ?? u?.id;
        const statusRaw = u?.update?.status ?? u?.status;
        if (!id || !statusRaw) continue;
        const map: Record<string, string> = {
          '1': 'sent', '2': 'sent', '3': 'delivered', '4': 'read', '5': 'read',
          PENDING: 'sent', SERVER_ACK: 'sent', DELIVERY_ACK: 'delivered', READ: 'read', PLAYED: 'read',
        };
        const status = map[String(statusRaw)] ?? 'sent';
        await admin.from('whatsapp_messages').update({ status }).eq('evolution_message_id', id);
      }
    }

    // === contacts.update ===
    if (eventType === 'contacts.update' || eventType === 'contacts.upsert') {
      const contacts: Any[] = Array.isArray(payload?.data) ? payload.data : payload?.data ? [payload.data] : [];
      for (const c of contacts) {
        const phone = jidToPhone(c?.id ?? c?.remoteJid);
        if (!phone || !instanceId) continue;
        const update: Any = {};
        if (c?.pushName ?? c?.name) update.contact_name = c.pushName ?? c.name;
        if (c?.profilePicUrl) update.contact_avatar_url = c.profilePicUrl;
        if (Object.keys(update).length > 0) {
          await admin
            .from('whatsapp_conversations')
            .update(update)
            .eq('instance_id', instanceId)
            .eq('contact_phone', phone);
        }
      }
    }

    if (logId) await admin.from('whatsapp_webhook_logs').update({ processed: true }).eq('id', logId);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    if (logId) await admin.from('whatsapp_webhook_logs').update({ error: msg }).eq('id', logId);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
