# Plano de melhorias — Atendimento, CNJ e IA

Estão misturadas várias frentes. Proponho atacar em 3 blocos, podemos fazer todos agora ou priorizar.

## Bloco 1 — Atendimento / WhatsApp / Kanban

**Problema:** Quando IA faz handoff ou quando se transfere a conversa entre filas, a nota/contexto somem e o cliente não cai como lead "novo" no Kanban. Quem recebe não sabe o que aconteceu.

**O que será feito:**
1. **Handoff da IA cria Lead automaticamente** — quando `ai-agent-reply` detecta handoff, criar registro em `leads` com `kanban_status='new'`, vincular `whatsapp_conversation_id`, preencher `name/phone` do contato e gravar o resumo da IA no `lead.message` + `lead_history`.
2. **Notificação para a fila** — ao criar o lead e/ou transferir conversa, marcar a conversa como `unread`/`needs_attention` e disparar evento realtime para a tela Atendimento (badge/contagem na fila).
3. **Nota de transferência visível** — exibir as últimas notas de `whatsapp_conversation_transfers` no topo do chat (banner "Transferida por X: <nota>") até que o novo responsável a "marque como lida".
4. **Aba "Notas internas" do contato** — listar transferências + notas de handoff cronologicamente dentro do drawer da conversa.

## Bloco 2 — CNJ / DataJud (igualar ao Integra)

**Problema:** Hoje retornamos só dados básicos. O Integra mostra publicações com texto completo, partes, advogados, andamentos com data.

**O que será feito:**
1. **Edge function `cnj-lookup` retornar TUDO**: partes (autor/réu), advogados (nome + OAB), todos os assuntos, classe, órgão, valor, segredo de justiça, **lista completa de movimentos/andamentos** com data e descrição.
2. **Nova tabela `process_movements`** (vinculada a `contracts.id`) para histórico persistente.
3. **Nova edge function `cnj-sync` (cron diário)** — para cada contrato com `cnj_number`, consulta DataJud, compara movimentos e insere novos. Cria entrada em `lead_history`/notificação quando há andamento novo.
4. **UI no contrato**: aba "Andamentos" com timeline (data, órgão, descrição) + botão "Atualizar agora". Aba "Partes e Advogados" com a lista vinda do DataJud.
5. **Preenchimento automático ampliado** no `ContractForm`: além do que já preenche, popular partes (campo "parte adversa"), advogado adversário e abrir os movimentos na aba dedicada.

## Bloco 3 — Agente IA agenda horários

**Problema:** IA não consegue marcar reunião com advogado.

**O que será feito:**
1. **Tool `schedule_appointment` no `ai-agent-reply`** — argumentos: `attorney_id?`, `practice_area_id?`, `date`, `time`, `duration_min`, `client_name`, `client_phone`, `notes`.
2. **Tool `list_available_slots`** — recebe `attorney_id?` + `date_range`, lê `agenda_config` + `appointments` existentes, devolve slots livres respeitando horário de trabalho e duração padrão.
3. **Validação anti-conflito** — usa o trigger `check_appointment_overlap` já existente; se der erro, IA recebe e tenta outro horário.
4. **Configuração por agente** (em `ai_agents`): toggle "pode agendar" + escolher se agenda só com 1 advogado específico ou qualquer um da área.
5. **Confirmação ao cliente** via WhatsApp com data/hora + nome do advogado.

---

## Ordem sugerida
1º Bloco 1 (urgente — atendimento está furado)
2º Bloco 2 (CNJ — pediu paridade com Integra)
3º Bloco 3 (agendamento IA — feature nova)

**Posso tocar os 3 em sequência nesta mesma conversa, ou prefere que eu faça só o Bloco 1 agora e os outros depois?**
