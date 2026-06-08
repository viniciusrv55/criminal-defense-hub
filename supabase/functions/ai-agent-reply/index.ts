// Edge Function: ai-agent-reply
// Roda lógica do agente de IA para uma conversa específica.
// Chamada server-side (sem JWT) pelo evolution-webhook após inbound message.
// Usa service role para ler agente/knowledge/mensagens, executa tools server-side,
// e envia a resposta final via Evolution API (replicando lógica do whatsapp-send).

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// deno-lint-ignore no-explicit-any
type Any = any;

interface Agent {
  id: string;
  queue_id: string;
  name: string;
  active: boolean;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  greeting_message: string | null;
  handoff_keywords: string[];
  handoff_after_messages: number | null;
  business_hours: Any | null;
  tools_enabled: string[];
}

const TOOL_DEFS: Record<string, Any> = {
  get_practice_areas: {
    type: 'function',
    function: {
      name: 'get_practice_areas',
      description: 'Retorna as áreas de atuação ativas do escritório, com título e descrição curta.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  create_lead: {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Cria/atualiza um lead no CRM com nome, email e telefone do cliente. SEMPRE colete nome e email no início da conversa.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome completo do cliente.' },
          email: { type: 'string', description: 'Email do cliente (opcional, mas peça).' },
          practice_area: { type: 'string', description: 'Área de atuação relacionada (opcional).' },
          message: { type: 'string', description: 'Resumo do caso/dor do cliente.' },
        },
        required: ['name', 'message'],
        additionalProperties: false,
      },
    },
  },
  request_human_handoff: {
    type: 'function',
    function: {
      name: 'request_human_handoff',
      description: 'Transfere a conversa para um atendente humano e pausa a IA. Use quando o cliente pedir ou o caso for sensível.',
      parameters: {
        type: 'object',
        properties: { reason: { type: 'string', description: 'Motivo do handoff.' } },
        required: ['reason'],
        additionalProperties: false,
      },
    },
  },
  list_appointment_types: {
    type: 'function',
    function: {
      name: 'list_appointment_types',
      description: 'Retorna os tipos de compromisso disponíveis (consulta, audiência etc).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  get_available_slots: {
    type: 'function',
    function: {
      name: 'get_available_slots',
      description: 'Retorna horários livres para agendar consulta em uma data (YYYY-MM-DD). Considera disponibilidade dos advogados, compromissos existentes e bloqueios.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Data alvo no formato YYYY-MM-DD.' },
          duration_minutes: { type: 'number', description: 'Duração desejada em minutos (default 30).' },
        },
        required: ['date'],
        additionalProperties: false,
      },
    },
  },
  create_appointment: {
    type: 'function',
    function: {
      name: 'create_appointment',
      description: 'Cria um agendamento (consulta) vinculado à conversa atual. Use após confirmar nome, data/hora e (opcional) advogado.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do cliente.' },
          starts_at: { type: 'string', description: 'Data/hora ISO 8601 do início (ex 2026-05-20T14:00:00-03:00).' },
          duration_minutes: { type: 'number', description: 'Duração em minutos (default 30).' },
          appointment_type: { type: 'string', description: 'Nome do tipo (ex Consulta inicial).' },
          attorney_name: { type: 'string', description: 'Nome (ou parte) do advogado preferido — opcional.' },
          notes: { type: 'string', description: 'Observações.' },
        },
        required: ['name', 'starts_at'],
        additionalProperties: false,
      },
    },
  },
};

function withinBusinessHours(bh: Any | null): boolean {
  if (!bh || !bh.enabled) return true;
  // bh: { enabled: true, tz: 'America/Sao_Paulo', days: { mon: { start: '08:00', end: '18:00' }, ... } }
  try {
    const tz = bh.tz || 'America/Sao_Paulo';
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' });
    const parts = fmt.formatToParts(now);
    const wk = parts.find(p => p.type === 'weekday')?.value.toLowerCase().slice(0, 3) ?? 'mon';
    const hh = parts.find(p => p.type === 'hour')?.value ?? '00';
    const mm = parts.find(p => p.type === 'minute')?.value ?? '00';
    const cur = `${hh}:${mm}`;
    const day = bh.days?.[wk];
    if (!day || !day.start || !day.end) return false;
    return cur >= day.start && cur <= day.end;
  } catch { return true; }
}

async function callOpenAI(apiKey: string, body: Any): Promise<Any> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

async function executeTool(admin: Any, name: string, args: Any, ctx: { conversationId: string; agent: Agent; contactPhone: string }): Promise<Any> {
  if (name === 'get_practice_areas') {
    const { data } = await admin
      .from('practice_areas')
      .select('title, subtitle, description')
      .eq('active', true)
      .order('sort_order');
    return { areas: (data ?? []).map((a: Any) => ({ title: a.title, summary: a.subtitle ?? a.description ?? '' })) };
  }
  if (name === 'create_lead') {
    // try matching practice_area
    let areaId: string | null = null;
    if (args.practice_area) {
      const { data } = await admin
        .from('practice_areas')
        .select('id, title')
        .eq('active', true);
      const match = (data ?? []).find((a: Any) => a.title?.toLowerCase().includes(String(args.practice_area).toLowerCase()));
      areaId = match?.id ?? null;
    }
    const { data: lead, error } = await admin
      .from('leads')
      .insert({
        name: args.name,
        email: args.email ?? null,
        phone: ctx.contactPhone,
        message: args.message,
        practice_area_id: areaId,
        status: 'new',
        kanban_status: 'new',
      })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    // link conversation
    await admin.from('whatsapp_conversations').update({ lead_id: lead.id }).eq('id', ctx.conversationId);
    return { ok: true, lead_id: lead.id };
  }
  if (name === 'request_human_handoff') {
    const reason = args.reason ?? 'Solicitação do agente';
    await admin
      .from('whatsapp_conversations')
      .update({ ai_paused_at: new Date().toISOString(), ai_handoff_reason: reason })
      .eq('id', ctx.conversationId);

    // Fetch conversation + recent messages to build a summary for human agents
    const { data: convFull } = await admin
      .from('whatsapp_conversations')
      .select('id, contact_name, contact_phone, lead_id, current_queue_id')
      .eq('id', ctx.conversationId)
      .maybeSingle();

    const { data: recentMsgs } = await admin
      .from('whatsapp_messages')
      .select('direction, content, created_at')
      .eq('conversation_id', ctx.conversationId)
      .order('created_at', { ascending: false })
      .limit(15);

    const transcript = (recentMsgs ?? []).reverse()
      .map((m: Any) => `${m.direction === 'inbound' ? 'Cliente' : 'IA'}: ${m.content ?? ''}`)
      .join('\n')
      .slice(0, 2000);

    const summary = `Handoff IA — Motivo: ${reason}\n\nÚltimas mensagens:\n${transcript}`;

    // Create lead if conversation does not yet have one, so it appears in Kanban "Novo"
    let leadId = convFull?.lead_id ?? null;
    if (!leadId && convFull?.contact_phone) {
      const { data: newLead } = await admin
        .from('leads')
        .insert({
          name: convFull.contact_name || `WhatsApp ${convFull.contact_phone}`,
          phone: convFull.contact_phone,
          message: summary,
          status: 'new',
          kanban_status: 'new',
        })
        .select('id')
        .single();
      leadId = newLead?.id ?? null;
      if (leadId) {
        await admin.from('whatsapp_conversations')
          .update({ lead_id: leadId })
          .eq('id', ctx.conversationId);
        await admin.from('lead_history').insert({
          lead_id: leadId,
          action: 'ai_handoff',
          description: `Conversa de WhatsApp transferida pela IA. ${reason}`,
        });
      }
    } else if (leadId) {
      await admin.from('lead_history').insert({
        lead_id: leadId,
        action: 'ai_handoff',
        description: summary.slice(0, 1000),
      });
    }

    // Transfer to General queue + mark conversation as needing attention (unread badge)
    const { data: gen } = await admin
      .from('whatsapp_queues')
      .select('id')
      .is('team_member_id', null)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (gen?.id) {
      await admin.from('whatsapp_conversation_transfers').insert({
        conversation_id: ctx.conversationId,
        from_queue_id: convFull?.current_queue_id ?? null,
        to_queue_id: gen.id,
        note: summary,
      });
      await admin.from('whatsapp_conversations').update({
        current_queue_id: gen.id,
        assigned_team_member_id: null,
        unread_count: 1,
      }).eq('id', ctx.conversationId);
    } else {
      await admin.from('whatsapp_conversations').update({ unread_count: 1 }).eq('id', ctx.conversationId);
    }

    return { ok: true, handed_off: true, lead_id: leadId };
  }
  if (name === 'list_appointment_types') {
    const { data } = await admin.from('appointment_types').select('id, name, duration_minutes').eq('active', true).order('sort_order');
    return { types: data ?? [] };
  }
  if (name === 'get_available_slots') {
    const dateStr = args.date as string;
    const duration = Number(args.duration_minutes) || 30;
    if (!dateStr) return { ok: false, error: 'date obrigatória' };
    const dayStart = new Date(`${dateStr}T00:00:00-03:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59-03:00`);
    const weekday = dayStart.getDay();
    const { data: avail } = await admin.from('appointment_availability').select('team_member_id, start_time, end_time').eq('weekday', weekday).eq('active', true);
    if (!avail?.length) return { slots: [], note: 'Sem disponibilidade nesta data.' };
    const { data: existing } = await admin.from('appointments').select('starts_at, ends_at, attorney_id').gte('starts_at', dayStart.toISOString()).lte('starts_at', dayEnd.toISOString()).neq('status', 'cancelled');
    const { data: blocks } = await admin.from('appointment_blocks').select('starts_at, ends_at, team_member_id').lte('starts_at', dayEnd.toISOString()).gte('ends_at', dayStart.toISOString());
    const slots: string[] = [];
    for (const a of avail) {
      const [sh, sm] = a.start_time.split(':').map(Number);
      const [eh, em] = a.end_time.split(':').map(Number);
      let cur = new Date(dayStart); cur.setHours(sh, sm, 0, 0);
      const end = new Date(dayStart); end.setHours(eh, em, 0, 0);
      while (cur.getTime() + duration * 60000 <= end.getTime()) {
        const slotEnd = new Date(cur.getTime() + duration * 60000);
        const conflict = (existing ?? []).some((e: Any) => e.attorney_id === a.team_member_id && new Date(e.starts_at) < slotEnd && new Date(e.ends_at) > cur)
          || (blocks ?? []).some((b: Any) => (!b.team_member_id || b.team_member_id === a.team_member_id) && new Date(b.starts_at) < slotEnd && new Date(b.ends_at) > cur);
        if (!conflict && cur > new Date()) slots.push(cur.toISOString());
        cur = new Date(cur.getTime() + 30 * 60000);
      }
    }
    return { slots: Array.from(new Set(slots)).sort().slice(0, 8) };
  }
  if (name === 'create_appointment') {
    const starts = new Date(args.starts_at);
    if (isNaN(starts.getTime())) return { ok: false, error: 'starts_at inválido' };
    const duration = Number(args.duration_minutes) || 30;
    const ends = new Date(starts.getTime() + duration * 60000);
    let typeId: string | null = null;
    if (args.appointment_type) {
      const { data: types } = await admin.from('appointment_types').select('id, name').eq('active', true);
      typeId = (types ?? []).find((t: Any) => t.name.toLowerCase().includes(String(args.appointment_type).toLowerCase()))?.id ?? null;
    }
    // 1) Preferência: advogado citado no argumento ou pré-configurado no agente
    let attorneyId: string | null = null;
    const preferredName = typeof args.attorney_name === 'string' ? args.attorney_name.trim() : '';
    const preferredId = (ctx.agent as Any).scheduling_attorney_id as string | null | undefined;
    if (preferredName) {
      const { data: tm } = await admin.from('team_members').select('id, full_name').eq('active', true);
      const m = (tm ?? []).find((t: Any) => t.full_name?.toLowerCase().includes(preferredName.toLowerCase()));
      if (m) attorneyId = m.id;
    } else if (preferredId) {
      attorneyId = preferredId;
    }

    // 2) Caso não tenha advogado preferido, varre disponibilidade da semana
    if (!attorneyId) {
      const weekday = starts.getDay();
      const hhmm = starts.toTimeString().slice(0, 5);
      const { data: avail } = await admin.from('appointment_availability').select('team_member_id').eq('weekday', weekday).eq('active', true).lte('start_time', hhmm).gte('end_time', hhmm);
      for (const a of (avail ?? [])) {
        const { data: clash } = await admin.from('appointments').select('id').eq('attorney_id', a.team_member_id).neq('status', 'cancelled').lt('starts_at', ends.toISOString()).gt('ends_at', starts.toISOString()).maybeSingle();
        if (!clash) { attorneyId = a.team_member_id; break; }
      }
    }
    const { data: appt, error } = await admin.from('appointments').insert({
      title: `Consulta — ${args.name}`,
      appointment_type_id: typeId,
      conversation_id: ctx.conversationId,
      attorney_id: attorneyId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: 'scheduled',
      created_via: 'ai_agent',
      notes: args.notes ?? null,
    }).select('id').single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, appointment_id: appt.id, starts_at: starts.toISOString(), attorney_assigned: !!attorneyId };
  }
  return { ok: false, error: `Tool desconhecida: ${name}` };
}

async function sendWhatsApp(admin: Any, conversationId: string, text: string, agentId: string): Promise<string | null> {
  const { data: conv } = await admin
    .from('whatsapp_conversations')
    .select('id, instance_id, contact_phone')
    .eq('id', conversationId)
    .single();
  if (!conv) return null;
  const { data: inst } = await admin.from('whatsapp_instances').select('instance_name').eq('id', conv.instance_id).single();
  const { data: settings } = await admin
    .from('platform_settings')
    .select('key,value')
    .in('key', ['evolution_api_url', 'evolution_api_key']);
  const map = Object.fromEntries((settings ?? []).map((s: Any) => [s.key, s.value]));
  const baseUrl = (map.evolution_api_url ?? '').replace(/\/+$/, '');
  const apiKey = map.evolution_api_key;
  if (!baseUrl || !apiKey || !inst?.instance_name) throw new Error('Evolution não configurada');

  const upstream = await fetch(`${baseUrl}/message/sendText/${inst.instance_name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ number: conv.contact_phone, text }),
  });
  const respText = await upstream.text();
  let parsed: Any;
  try { parsed = JSON.parse(respText); } catch { parsed = respText; }
  if (!upstream.ok) throw new Error(`Evolution ${upstream.status}: ${respText.slice(0, 300)}`);
  const evoId: string | null = parsed?.key?.id ?? parsed?.id ?? null;

  const { data: inserted } = await admin
    .from('whatsapp_messages')
    .insert({
      conversation_id: conv.id,
      evolution_message_id: evoId,
      direction: 'outbound',
      to_phone: conv.contact_phone,
      message_type: 'text',
      content: text,
      status: 'sent',
      metadata: { ai_agent_id: agentId, openai_response: parsed },
    })
    .select('id')
    .single();

  await admin
    .from('whatsapp_conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 200),
      unread_count: 0,
    })
    .eq('id', conv.id);

  return inserted?.id ?? null;
}

export async function runAgent(admin: Any, openaiKey: string, conversationId: string, opts: { dryRun?: boolean; overrideMessages?: { role: string; content: string }[]; overrideAgentId?: string } = {}): Promise<Any> {
  const started = Date.now();

  // Load conversation + queue + agent
  const { data: conv } = await admin
    .from('whatsapp_conversations')
    .select('id, contact_phone, contact_name, current_queue_id, ai_enabled, ai_paused_at, lead_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (!conv) return { ok: false, error: 'Conversa não encontrada' };

  let agent: Agent | null = null;
  if (opts.overrideAgentId) {
    const { data } = await admin.from('ai_agents').select('*').eq('id', opts.overrideAgentId).maybeSingle();
    agent = data;
  } else if (conv.current_queue_id) {
    const { data } = await admin.from('ai_agents').select('*').eq('queue_id', conv.current_queue_id).eq('active', true).maybeSingle();
    agent = data;
  }
  if (!agent) return { ok: false, error: 'Nenhum agente ativo para a fila' };

  if (!opts.dryRun) {
    if (!conv.ai_enabled || conv.ai_paused_at) return { ok: false, error: 'IA desativada/pausada na conversa' };
    if (!withinBusinessHours(agent.business_hours)) {
      await admin.from('ai_agent_runs').insert({
        agent_id: agent.id, conversation_id: conversationId, status: 'handoff', error: 'Fora do horário', model: agent.model,
      });
      return { ok: false, error: 'Fora do horário comercial' };
    }
  }

  // Build messages
  let messages: { role: string; content: string }[] = [];
  if (opts.overrideMessages) {
    messages = opts.overrideMessages;
  } else {
    const { data: msgs } = await admin
      .from('whatsapp_messages')
      .select('direction, content, message_type, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20);
    messages = (msgs ?? []).reverse().map((m: Any) => ({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.content || `[${m.message_type}]`,
    }));
  }

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

  // Handoff by keywords
  if (!opts.dryRun && agent.handoff_keywords?.length) {
    const lower = lastUserMsg.toLowerCase();
    if (agent.handoff_keywords.some(k => k && lower.includes(k.toLowerCase()))) {
      await executeTool(admin, 'request_human_handoff', { reason: 'Palavra-chave detectada' }, {
        conversationId, agent, contactPhone: conv.contact_phone,
      });
      await admin.from('ai_agent_runs').insert({
        agent_id: agent.id, conversation_id: conversationId, status: 'handoff', error: 'keyword', model: agent.model,
      });
      return { ok: true, handoff: true };
    }
  }

  // Handoff by count
  if (!opts.dryRun && agent.handoff_after_messages) {
    const { count } = await admin
      .from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('direction', 'outbound')
      .not('metadata->ai_agent_id', 'is', null);
    if ((count ?? 0) >= agent.handoff_after_messages) {
      await executeTool(admin, 'request_human_handoff', { reason: 'Limite de mensagens IA atingido' }, {
        conversationId, agent, contactPhone: conv.contact_phone,
      });
      return { ok: true, handoff: true };
    }
  }

  // Knowledge
  const { data: knowledge } = await admin
    .from('ai_agent_knowledge')
    .select('title, content')
    .eq('agent_id', agent.id)
    .eq('active', true)
    .order('sort_order');
  const knowledgeBlock = (knowledge ?? []).map((k: Any) => `## ${k.title}\n${k.content}`).join('\n\n');

  const systemPrompt = [
    agent.system_prompt,
    knowledgeBlock ? `\n# Base de conhecimento\n${knowledgeBlock}` : '',
    `\n# Contexto\nNome do contato: ${conv.contact_name ?? 'desconhecido'}\nTelefone: ${conv.contact_phone}`,
  ].filter(Boolean).join('\n');

  const tools = (agent.tools_enabled ?? []).map(n => TOOL_DEFS[n]).filter(Boolean);

  // Tool loop (max 3 iterations)
  const llmMessages: Any[] = [{ role: 'system', content: systemPrompt }, ...messages];
  let totalPromptTokens = 0, totalCompletionTokens = 0;
  const toolCalls: Any[] = [];
  let finalText = '';

  for (let iter = 0; iter < 3; iter++) {
    const resp = await callOpenAI(openaiKey, {
      model: agent.model,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens,
      messages: llmMessages,
      tools: tools.length ? tools : undefined,
    });
    totalPromptTokens += resp.usage?.prompt_tokens ?? 0;
    totalCompletionTokens += resp.usage?.completion_tokens ?? 0;
    const choice = resp.choices?.[0];
    const msg = choice?.message;
    if (!msg) break;

    if (msg.tool_calls?.length) {
      llmMessages.push(msg);
      for (const tc of msg.tool_calls) {
        const fname = tc.function?.name;
        let fargs: Any = {};
        try { fargs = JSON.parse(tc.function?.arguments || '{}'); } catch { /* */ }
        toolCalls.push({ name: fname, args: fargs });
        const result = opts.dryRun
          ? { dry_run: true, would_call: fname, args: fargs }
          : await executeTool(admin, fname, fargs, { conversationId, agent, contactPhone: conv.contact_phone });
        llmMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      continue;
    }

    finalText = (msg.content ?? '').trim();
    break;
  }

  if (!finalText) finalText = '(sem resposta)';

  let outboundId: string | null = null;
  if (!opts.dryRun) {
    try {
      outboundId = await sendWhatsApp(admin, conversationId, finalText, agent.id);
    } catch (e) {
      const err = e instanceof Error ? e.message : 'send error';
      await admin.from('ai_agent_runs').insert({
        agent_id: agent.id, conversation_id: conversationId, model: agent.model,
        prompt_tokens: totalPromptTokens, completion_tokens: totalCompletionTokens,
        latency_ms: Date.now() - started, tool_calls: toolCalls, status: 'error', error: err,
      });
      return { ok: false, error: err };
    }
  }

  await admin.from('ai_agent_runs').insert({
    agent_id: agent.id,
    conversation_id: opts.dryRun ? null : conversationId,
    outbound_message_id: outboundId,
    model: agent.model,
    prompt_tokens: totalPromptTokens,
    completion_tokens: totalCompletionTokens,
    latency_ms: Date.now() - started,
    tool_calls: toolCalls,
    status: 'ok',
  });

  return {
    ok: true,
    reply: finalText,
    tool_calls: toolCalls,
    usage: { prompt_tokens: totalPromptTokens, completion_tokens: totalCompletionTokens },
    latency_ms: Date.now() - started,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const conversationId = body?.conversation_id;
    if (!conversationId) {
      return new Response(JSON.stringify({ ok: false, error: 'conversation_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada');
    const result = await runAgent(admin, openaiKey, conversationId);
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
