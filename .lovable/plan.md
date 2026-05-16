# Fase 3 — Agentes de IA por fila WhatsApp

Objetivo: adicionar agentes de IA (OpenAI) que respondem automaticamente em conversas WhatsApp, por fila, com prompt configurável, base de conhecimento (RAG simples), ferramentas (tools) controladas e handoff suave para humano.

Fora do escopo: agenda/agendamentos (Fase 4), broadcast/Brevo (Fase 5), voice/áudio transcrito (Fase 4+).

---

## 1. Configuração da OpenAI

- Secret `OPENAI_API_KEY` (adicionar via tool de secrets).
- Tabela `platform_settings` já existe — usar para guardar defaults globais: `openai_default_model` (`gpt-4o-mini`), `openai_default_temperature`.

## 2. Novas tabelas

### `ai_agents`
Um agente por fila (1:1 opcional). Se a fila tem agente ativo, ele responde automaticamente.
- `queue_id` (FK whatsapp_queues, unique), `name`, `active` (bool)
- `model` (text, default `gpt-4o-mini`), `temperature` (numeric), `max_tokens` (int)
- `system_prompt` (text) — instruções da persona/escopo
- `greeting_message` (text, nullable) — mensagem enviada na 1ª interação
- `handoff_keywords` (text[]) — gatilhos para transferir ao humano (ex: `["atendente","humano","advogado"]`)
- `handoff_after_messages` (int, nullable) — força handoff após N mensagens do bot
- `business_hours` (jsonb, nullable) — horários em que o agente responde; fora disso só humano
- `tools_enabled` (text[]) — IDs de ferramentas habilitadas (`create_lead`, `get_practice_areas`, `schedule_callback`)

### `ai_agent_knowledge`
Base de conhecimento por agente (sem vector store ainda — chunk + busca por relevância simples / append no system prompt).
- `agent_id`, `title`, `content` (text), `sort_order`, `active`

### `ai_agent_runs`
Auditoria por mensagem processada.
- `agent_id`, `conversation_id`, `inbound_message_id`, `outbound_message_id` (nullable)
- `model`, `prompt_tokens`, `completion_tokens`, `latency_ms`, `tool_calls` (jsonb), `status` ('ok'|'error'|'handoff'), `error` (text)

### Atualizar `whatsapp_conversations`
- `ai_enabled` (bool, default true quando agente da fila ativo)
- `ai_paused_at` (timestamptz, nullable) — atendente pode pausar IA manualmente
- `ai_handoff_reason` (text, nullable)

**RLS**: admin gerencia agentes/knowledge. Membros leem runs das conversas que acessam.

## 3. Edge functions

### `evolution-webhook` (atualizar)
Após inserir `whatsapp_messages` inbound:
- Se conversa está atribuída a fila com agente ativo, `ai_enabled=true`, sem `ai_paused_at`, e dentro do business_hours → dispara `ai-agent-reply` (fire-and-forget via `supabase.functions.invoke`).

### `ai-agent-reply` (nova)
Recebe `{ conversation_id }`. Fluxo:
1. Carrega agente da fila + últimas N mensagens da conversa (~20).
2. Carrega knowledge ativo do agente, injeta no system prompt.
3. Checa handoff: keywords na última msg, contador, fora de horário → marca `ai_paused_at`, cria transfer para fila "Geral" ou fila humana configurada, registra run com status=`handoff`. Não responde.
4. Chama OpenAI Chat Completions com tools habilitadas (function calling).
5. Se modelo chamar tool → executa server-side (ex: `create_lead` insere em `leads`, `get_practice_areas` lê tabela), devolve resultado, segue loop até resposta final (max 3 iterações).
6. Envia resposta via `whatsapp-send` existente. Registra `ai_agent_runs` com tokens/latência.

### `ai-agent-test` (nova)
Playground: recebe `{ agent_id, messages[] }`, roda mesma lógica sem enviar pra WhatsApp. Retorna resposta + tool_calls + tokens. Usado pela UI de admin pra testar prompt.

## 4. UI

### `/admin/agentes-ia` (novo)
Lista de agentes (1 por fila). Tabs por agente:
- **Geral**: nome, modelo, temperatura, ativo, mensagem de saudação.
- **Prompt**: editor de `system_prompt` (textarea grande + exemplos).
- **Conhecimento**: CRUD de `ai_agent_knowledge` (lista + editor markdown).
- **Handoff**: keywords (tags), limite de mensagens, horário comercial (dias/horas).
- **Ferramentas**: checkboxes das tools disponíveis.
- **Playground**: chat lateral que chama `ai-agent-test` — vê resposta + tokens + tool calls.
- **Histórico**: tabela de `ai_agent_runs` recentes (filtro por status).

### `Atendimento` (existente, ajustes)
- Badge "🤖 IA ativa" / "⏸ IA pausada" no header da conversa.
- Botão **Pausar IA** / **Retomar IA** (atualiza `ai_paused_at`).
- Mensagens enviadas pelo bot ganham label visual "via IA" (já temos `sent_by_user_id=null` + metadata `{ai_agent_id}`).

### Menu admin
Novo item **"Agentes IA"** abaixo de "Atendimento".

## 5. Ferramentas (tools) do agente

MVP — implementadas server-side em `ai-agent-reply`:
- `get_practice_areas()` → retorna áreas ativas (nome + descrição curta).
- `create_lead({name, phone, practice_area, message})` → insere em `leads` + vincula à conversa.
- `request_human_handoff({reason})` → pausa IA e transfere para fila Geral.

Cada tool tem JSON schema declarado no código. Só são expostas se listadas em `agents.tools_enabled`.

## 6. Permissões

- **Admin/super_admin**: gerencia agentes, knowledge, runs.
- **Team member**: vê badge IA, pausa/retoma IA das suas conversas. Não edita prompt.

## 7. Ordem de entrega

1. Secret `OPENAI_API_KEY` + migration (3 tabelas novas + 3 colunas em conversations + RLS).
2. Edge function `ai-agent-reply` com tools server-side.
3. Atualizar `evolution-webhook` para disparar `ai-agent-reply`.
4. Edge function `ai-agent-test`.
5. UI `/admin/agentes-ia` com tabs.
6. Badge + botão pausar IA no `Atendimento`.
7. Seed: criar 1 agente "Triagem" na fila Geral com prompt básico.

## 8. Riscos

- **Loop infinito de tool calls**: cap em 3 iterações + timeout 30s.
- **Custo OpenAI**: log de tokens em `ai_agent_runs`, dashboard simples (futuro).
- **Resposta fora de hora**: business_hours bloqueia antes de chamar OpenAI.
- **IA respondendo enquanto humano digita**: `ai_paused_at` checado a cada inbound; ao 1º envio manual do humano, set automático de `ai_paused_at=now()`.
- **Quebra de Fase 2**: zero — só adiciona; `ai_enabled` default false até existir agente ativo na fila.

Aprove pra eu adicionar o secret OPENAI_API_KEY e rodar a migration.
