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
  tools_enabled: string[];
}

// Tools do PROTOCOLO DE IDENTIFICAÇÃO. Sempre ativas, independentes de tools_enabled.
const TOOL_DEFS: Record<string, Any> = {
  lookup_client_by_phone: {
    type: 'function',
    function: {
      name: 'lookup_client_by_phone',
      description: 'Consulta se o telefone do contato atual bate com algum cliente cadastrado. Chame SEMPRE na primeira interação, antes de qualquer coisa. Retorna { found, client_name?, doc_hint? } onde doc_hint é o CPF/CNPJ do cadastro com apenas os 3 primeiros dígitos visíveis e o restante mascarado.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  confirm_client_document: {
    type: 'function',
    function: {
      name: 'confirm_client_document',
      description: 'Valida o CPF/CNPJ informado pelo cliente contra o cadastro vinculado ao telefone. Se bater, transfere a conversa para a fila do advogado responsável e pausa a IA. Retorna { ok, transferred?, attorney_name? }.',
      parameters: {
        type: 'object',
        properties: { document: { type: 'string', description: 'CPF ou CNPJ digitado pelo cliente (com ou sem pontuação).' } },
        required: ['document'],
        additionalProperties: false,
      },
    },
  },
  transfer_to_general: {
    type: 'function',
    function: {
      name: 'transfer_to_general',
      description: 'Envia a conversa para a FILA GERAL e pausa a IA. Use quando o cliente não é reconhecido, não confere com o cadastro, ou pede para falar com atendente humano.',
      parameters: {
        type: 'object',
        properties: { reason: { type: 'string', description: 'Motivo curto (ex: numero_nao_cadastrado, cliente_nao_confere, cpf_nao_confere, pedido_humano).' } },
        required: ['reason'],
        additionalProperties: false,
      },
    },
  },
};

function maskDoc(doc: string): string {
  const d = (doc ?? '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.***.***-**`;
  if (d.length === 14) return `${d.slice(0, 3)}.***.***/****-**`;
  if (d.length >= 3) return `${d.slice(0, 3)}${'*'.repeat(Math.max(0, d.length - 3))}`;
  return '***';
}

async function findClientByPhone(admin: Any, phone: string): Promise<Any | null> {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const tail = digits.slice(-10);
  if (tail.length < 8) return null;
  const { data: clients } = await admin
    .from('clients')
    .select('id, full_name, cpf, cnpj, assigned_attorney_id, phones')
    .limit(1000);
  return (clients ?? []).find((c: Any) => {
    const phones = Array.isArray(c.phones) ? c.phones : [];
    return phones.some((p: Any) => {
      const v = String(p?.value ?? p ?? '').replace(/\D/g, '');
      return v && (v.endsWith(tail) || tail.endsWith(v.slice(-10)));
    });
  }) ?? null;
}

// (horário comercial removido — IA responde sempre que ativa; se ficar em dúvida, transfere para a fila geral via `request_human_handoff`.)

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

async function transferToGeneral(admin: Any, conversationId: string, reason: string): Promise<void> {
  const { data: convFull } = await admin
    .from('whatsapp_conversations')
    .select('id, current_queue_id')
    .eq('id', conversationId)
    .maybeSingle();
  const { data: gen } = await admin
    .from('whatsapp_queues')
    .select('id')
    .is('team_member_id', null)
    .eq('active', true)
    .order('sort_order')
    .limit(1)
    .maybeSingle();
  await admin.from('whatsapp_conversations').update({
    ai_enabled: false,
    ai_paused_at: new Date().toISOString(),
    ai_handoff_reason: reason,
    current_queue_id: gen?.id ?? convFull?.current_queue_id,
    assigned_team_member_id: null,
    status: 'open',
    unread_count: 1,
  }).eq('id', conversationId);
  if (gen?.id) {
    await admin.from('whatsapp_conversation_transfers').insert({
      conversation_id: conversationId,
      from_queue_id: convFull?.current_queue_id ?? null,
      to_queue_id: gen.id,
      note: `IA transferiu para fila geral — motivo: ${reason}`,
    }).then(() => {}, () => {});
  }
  await admin.from('whatsapp_conversation_notes').insert({
    conversation_id: conversationId,
    note: `IA transferiu para fila geral — motivo: ${reason}`,
  }).then(() => {}, () => {});
}

async function executeTool(admin: Any, name: string, args: Any, ctx: { conversationId: string; agent: Agent; contactPhone: string }): Promise<Any> {
  if (name === 'lookup_client_by_phone') {
    const client = await findClientByPhone(admin, ctx.contactPhone);
    if (!client) return { found: false };
    const doc = client.cpf || client.cnpj || '';
    return {
      found: true,
      client_name: client.full_name,
      doc_hint: doc ? maskDoc(doc) : '(sem CPF/CNPJ no cadastro)',
      has_document: !!doc,
    };
  }
  if (name === 'confirm_client_document') {
    const informed = String(args.document ?? '').replace(/\D/g, '');
    if (!informed) return { ok: false, error: 'documento_vazio' };
    const client = await findClientByPhone(admin, ctx.contactPhone);
    if (!client) return { ok: false, error: 'cliente_nao_encontrado' };
    const stored = String(client.cpf || client.cnpj || '').replace(/\D/g, '');
    if (!stored) return { ok: false, error: 'cliente_sem_documento_cadastrado' };
    if (stored !== informed) return { ok: false, error: 'documento_nao_confere' };

    // Documento confere — transfere para fila do advogado responsável (se houver)
    const { data: convFull } = await admin
      .from('whatsapp_conversations').select('id, current_queue_id').eq('id', ctx.conversationId).maybeSingle();
    let targetQueueId: string | null = null;
    let attorneyName: string | null = null;
    if (client.assigned_attorney_id) {
      const { data: personalQ } = await admin
        .from('whatsapp_queues').select('id').eq('team_member_id', client.assigned_attorney_id).eq('active', true).limit(1).maybeSingle();
      targetQueueId = personalQ?.id ?? null;
      const { data: tm } = await admin.from('team_members').select('full_name').eq('id', client.assigned_attorney_id).maybeSingle();
      attorneyName = tm?.full_name ?? null;
    }
    if (!targetQueueId) {
      const { data: gen } = await admin
        .from('whatsapp_queues').select('id').is('team_member_id', null).eq('active', true).order('sort_order').limit(1).maybeSingle();
      targetQueueId = gen?.id ?? convFull?.current_queue_id ?? null;
    }
    await admin.from('whatsapp_conversations').update({
      current_queue_id: targetQueueId,
      assigned_team_member_id: client.assigned_attorney_id ?? null,
      ai_enabled: false,
      ai_paused_at: new Date().toISOString(),
      ai_handoff_reason: 'documento_confirmado',
      status: 'open',
      unread_count: 1,
    }).eq('id', ctx.conversationId);
    if (targetQueueId && targetQueueId !== convFull?.current_queue_id) {
      await admin.from('whatsapp_conversation_transfers').insert({
        conversation_id: ctx.conversationId,
        from_queue_id: convFull?.current_queue_id ?? null,
        to_queue_id: targetQueueId,
        note: `IA confirmou identidade — cliente ${client.full_name}${attorneyName ? ` · advogado ${attorneyName}` : ''}.`,
      }).then(() => {}, () => {});
    }
    if (client.assigned_attorney_id) {
      await notifyAttorney(admin, {
        attorneyId: client.assigned_attorney_id,
        clientName: client.full_name,
        conversationId: ctx.conversationId,
      });
    }
    return { ok: true, transferred: true, attorney_name: attorneyName, client_name: client.full_name };
  }
  if (name === 'transfer_to_general') {
    await transferToGeneral(admin, ctx.conversationId, String(args.reason ?? 'nao_especificado'));
    return { ok: true, transferred: true };
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

// Notifica advogado responsável: cria registro em `notifications` (sino no admin)
// e envia mensagem no WhatsApp pessoal dele via Evolution API.
async function notifyAttorney(admin: Any, params: { attorneyId: string; clientName: string; conversationId: string }): Promise<void> {
  try {
    const { data: tm } = await admin
      .from('team_members')
      .select('id, user_id, full_name, phone')
      .eq('id', params.attorneyId)
      .maybeSingle();
    if (!tm) return;

    const title = 'Cliente aguardando atendimento';
    const body = `${params.clientName} enviou mensagem no WhatsApp e está aguardando você no sistema.`;
    const link = `/admin/atendimento?conversation=${params.conversationId}`;

    if (tm.user_id) {
      await admin.from('notifications').insert({
        user_id: tm.user_id,
        team_member_id: tm.id,
        kind: 'client_waiting',
        title, body, link,
        conversation_id: params.conversationId,
      }).then(() => {}, () => {});
    }

    // Aviso via WhatsApp para o telefone do advogado (uso INTERNO — número da equipe).
    const phone = String(tm.phone ?? '').replace(/\D/g, '');
    if (!phone || phone.length < 10) return;

    const { data: inst } = await admin
      .from('whatsapp_instances')
      .select('instance_name')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    const { data: settings } = await admin
      .from('platform_settings').select('key,value').in('key', ['evolution_api_url', 'evolution_api_key']);
    const map = Object.fromEntries((settings ?? []).map((s: Any) => [s.key, s.value]));
    const baseUrl = (map.evolution_api_url ?? '').replace(/\/+$/, '');
    const apiKey = map.evolution_api_key;
    if (!baseUrl || !apiKey || !inst?.instance_name) return;

    const text = `🔔 ${title}\n\n${body}\n\nAcesse: ${link}`;
    await fetch(`${baseUrl}/message/sendText/${inst.instance_name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number: phone, text }),
    }).catch(() => {});
  } catch (e) {
    console.error('[notifyAttorney]', e);
  }
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

  // === Contato é um membro da equipe? Encaminha para fila geral e NÃO aciona IA ===
  if (!opts.dryRun && conv.contact_phone) {
    try {
      const digits = String(conv.contact_phone).replace(/\D/g, '');
      const tail = digits.slice(-10);
      if (tail.length >= 8) {
        const { data: teamMatches } = await admin
          .from('team_members')
          .select('id, full_name, phone')
          .eq('active', true)
          .not('phone', 'is', null);
        const teamMatch = (teamMatches ?? []).find((t: Any) => {
          const v = String(t.phone ?? '').replace(/\D/g, '');
          return v && v.length >= 8 && (v.endsWith(tail) || tail.endsWith(v.slice(-10)));
        });
        if (teamMatch) {
          const { data: gen } = await admin
            .from('whatsapp_queues').select('id').is('team_member_id', null).eq('active', true).limit(1).maybeSingle();
          await admin.from('whatsapp_conversations').update({
            current_queue_id: gen?.id ?? conv.current_queue_id,
            assigned_team_member_id: null,
            ai_enabled: false,
            ai_paused_at: new Date().toISOString(),
            status: 'open',
            unread_count: 1,
          }).eq('id', conversationId);
          await admin.from('whatsapp_conversation_notes').insert({
            conversation_id: conversationId,
            note: `Número pertence a membro da equipe (${teamMatch.full_name}) — IA desativada e enviado para fila geral.`,
          }).then(() => {}, () => {});
          return { ok: true, handoff: true, reason: 'team_member_phone' };
        }
      }
    } catch (e) {
      console.error('[team-lookup]', e);
    }
  }

  // (Auto-roteamento por telefone removido — o protocolo de identificação
  //  agora é conduzido pelo próprio agente de IA via tools lookup_client_by_phone
  //  e confirm_client_document, para confirmar CPF/CNPJ antes de transferir.)





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

  // (handoff por palavras-chave / horário / contagem de mensagens removido —
  //  na dúvida a IA chama `request_human_handoff` e o roteamento vai para a fila geral.)



  // Knowledge
  const { data: knowledge } = await admin
    .from('ai_agent_knowledge')
    .select('title, content')
    .eq('agent_id', agent.id)
    .eq('active', true)
    .order('sort_order');
  const knowledgeBlock = (knowledge ?? []).map((k: Any) => `## ${k.title}\n${k.content}`).join('\n\n');

  // === Pré-identificação determinística: executa lookup_client_by_phone ANTES da OpenAI ===
  // Reutiliza a mesma função `findClientByPhone` já usada pela tool. O resultado é injetado
  // no system prompt para que a IA já receba a identidade resolvida e não precise perguntar
  // nem decidir chamar a tool. `confirm_client_document` e `transfer_to_general` continuam
  // disponíveis e são acionadas pela IA normalmente.
  let identityBlock = '';
  try {
    const preClient = await findClientByPhone(admin, conv.contact_phone);
    let attorneyName: string | null = null;
    if (preClient?.assigned_attorney_id) {
      const { data: tm } = await admin.from('team_members').select('full_name').eq('id', preClient.assigned_attorney_id).maybeSingle();
      attorneyName = tm?.full_name ?? null;
    }
    const docRaw = preClient?.cpf || preClient?.cnpj || '';
    const docType = preClient?.cpf ? 'CPF' : preClient?.cnpj ? 'CNPJ' : null;
    const identityPayload = {
      client_found: !!preClient,
      client_name: preClient?.full_name ?? null,
      document_hint: docRaw ? maskDoc(docRaw) : null,
      document_type: docType,
      document_confirmed: false,
      attorney: {
        exists: !!attorneyName,
        name: attorneyName,
      },
      contact_name: conv.contact_name ?? null,
      contact_phone: conv.contact_phone ?? null,
    };
    identityBlock = `\n########################################\n`
      + `## CONTEXTO DO SISTEMA (NÃO ALTERAR)\n`
      + `########################################\n\n`
      + `As informações abaixo foram obtidas diretamente pelo backend.\n`
      + `Elas são a única fonte de verdade para identificação do cliente.\n`
      + `Nunca tente deduzir informações diferentes.\n`
      + `Nunca consulte novamente o telefone.\n`
      + `Nunca utilize lookup_client_by_phone novamente.\n`
      + `Nunca utilize o nome do contato do WhatsApp para identificar o cliente.\n`
      + `Nunca invente clientes ou advogados.\n\n`
      + `${JSON.stringify(identityPayload, null, 2)}\n\n`
      + `########################################\n`;
  } catch (e) {
    console.error('[pre-identify]', e);
  }

  const systemPrompt = [
    agent.system_prompt,
    knowledgeBlock ? `\n# Base de conhecimento\n${knowledgeBlock}` : '',
    `\n# Contexto da conversa atual\nNome do contato no WhatsApp: ${conv.contact_name ?? 'desconhecido'}\nTelefone do contato (JÁ CONHECIDO — NUNCA pergunte ao cliente): ${conv.contact_phone}\n\nREGRA ABSOLUTA: o telefone acima é o número pelo qual o cliente está falando com você AGORA no WhatsApp. Você JAMAIS deve pedir o número de telefone.`,
    identityBlock,
  ].filter(Boolean).join('\n');


  // Tools do protocolo de identificação são sempre ativas (independente de tools_enabled)
  const tools = Object.values(TOOL_DEFS);

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
      // Captura mensagem inline emitida junto com a tool_call (ex: aviso de handoff)
      const inlineText = (msg.content ?? '').trim();
      if (inlineText && !finalText) finalText = inlineText;
      let didHandoff = false;
      for (const tc of msg.tool_calls) {
        const fname = tc.function?.name;
        let fargs: Any = {};
        try { fargs = JSON.parse(tc.function?.arguments || '{}'); } catch { /* */ }
        toolCalls.push({ name: fname, args: fargs });
        const result = opts.dryRun
          ? { dry_run: true, would_call: fname, args: fargs }
          : await executeTool(admin, fname, fargs, { conversationId, agent, contactPhone: conv.contact_phone });
        llmMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        if (fname === 'transfer_to_general' || (fname === 'confirm_client_document' && (result as Any)?.transferred)) didHandoff = true;
      }
      // Após handoff, encerra o loop — IA já pausada
      if (didHandoff) {
        if (!finalText) finalText = 'Sem problemas! Já encaminhei você para a nossa equipe de atendimento. Em instantes alguém vai te responder por aqui. 🙂';
        break;
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
