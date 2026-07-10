
# Ajuste no fluxo de Atendimento + IA

## 1. Filas: uma por advogado + Fila Geral
- **Comportamento novo:** cada advogado tem sua fila pessoal (auto-criada ou já ligada via `whatsapp_queues.team_member_id`). Atendentes ficam SÓ na Fila Geral.
- Novo botão em `/admin/equipe` (para membros com `role='attorney'`): "Criar fila pessoal" — cria `whatsapp_queues` com `team_member_id = advogado`, `name = 'Fila – <Nome>'`.
- Em `/admin/filas`: mostrar badge "Pessoal (Advogado X)" nas filas que têm `team_member_id`; impedir adicionar membros externos nelas.
- Roteamento no `evolution-webhook` (entrada de mensagem de cliente já cadastrado):
  - Se o telefone bate com um `client` que tem advogado responsável → conversa entra na **fila pessoal** desse advogado.
  - Caso contrário → **Fila Geral** (fila sem `team_member_id`, `sort_order` mais baixo).

## 2. Remover criação automática de Leads
- No `ai-agent-reply` e no `evolution-webhook`: **remover** qualquer `INSERT` em `leads` disparado por mensagem/handoff da IA.
- Handoff da IA agora apenas: pausa IA, transfere conversa para a Fila Geral, gera notificação (sino + WhatsApp) do responsável se cliente cadastrado tiver advogado — sem criar lead.
- `.lovable/plan.md` (Bloco 1) já contemplava criação automática — atualizar para refletir a nova regra "criação de lead é manual".

## 3. "Enviar para Kanban" a partir da conversa
- No drawer de `/admin/atendimento` (topo da conversa), novo botão **"Iniciar atendimento no Kanban"**:
  - Se a conversa já tem `client_id` → cria `leads` com `client_id` vinculado, `kanban_status='new'`, `responsible_ids = [advogado_responsavel_do_cliente]` (ou o próprio usuário se for advogado sem cliente vinculado).
  - Se não tem `client_id` → abre modal pedindo para selecionar/cadastrar o cliente primeiro (link para `/admin/clientes/novo` com telefone pré-preenchido).
  - Vincula `lead.whatsapp_conversation_id` e grava nota no `lead_history` com resumo/últimas mensagens.

## 4. Iniciar atendimento Kanban a partir de um Cliente
- Em `/admin/kanban` (Leads): botão **"Novo atendimento a partir de cliente"** abre combobox de `clients`.
- Filtro exibido: apenas clientes onde `responsible_attorney_id = eu` **ou** `responsible_attorney_id IS NULL`.
- Ao selecionar: cria `leads` (`client_id`, dados preenchidos do cliente, `kanban_status='new'`, `responsible_ids=[eu]`) e, se houver conversa WhatsApp aberta desse cliente, vincula.

## 5. Handoff da IA — remover configuração
- Em `/admin/agentes-ia`: remover campos "keywords de handoff", "horário limite" — deixar apenas toggle "IA responde" + `system_prompt` + ferramentas.
- Nova regra fixa: sempre que o modelo chamar `request_human_handoff` **ou** retornar resposta com incerteza (fallback do wrapper) → transfere para **Fila Geral**, pausa IA por 24h, envia notificação padrão.
- Remover coluna `handoff_keywords`, `handoff_time_limit` (se existirem) via migration. Se ainda usadas em algum lugar do código, limpar referências.

## Detalhes técnicos
- **DB migration:**
  - `ALTER TABLE ai_agents DROP COLUMN handoff_keywords, DROP COLUMN handoff_time_limit_start, DROP COLUMN handoff_time_limit_end` (só se existirem).
  - Nenhuma nova tabela.
- **Edge functions afetadas:** `ai-agent-reply`, `evolution-webhook`, `whatsapp-transfer`.
- **Frontend afetado:** `src/pages/admin/AiAgents.tsx`, `src/pages/admin/Team.tsx`, `src/pages/admin/Queues.tsx`, `src/pages/admin/Atendimento.tsx`, `src/pages/admin/Leads.tsx` (Kanban).
- **Roteamento de fila:** função helper `resolveIncomingQueue(clientId, phone)` no webhook, retorna `queue_id` conforme regra do item 1.

## Ordem de execução
1. Migration + limpeza `ai_agents`.
2. Backend (webhook + ai-agent-reply): remover auto-lead, ajustar roteamento por advogado.
3. Frontend `AiAgents`: remover UI de handoff.
4. Frontend `Team` + `Queues`: botão fila pessoal / badges.
5. Frontend `Atendimento`: botão "Iniciar Kanban".
6. Frontend `Leads` (Kanban): "Novo atendimento a partir de cliente".

Confirma que faço tudo em sequência agora, ou prefere que eu quebre em etapas menores (ex: 1+2+3 primeiro, depois 4+5+6)?
