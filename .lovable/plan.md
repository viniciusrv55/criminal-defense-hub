# Plano de Implementação

Dividido em 3 frentes. Posso executar tudo de uma vez ou por blocos — me diga se quer alguma ordem específica.

---

## Frente 1 — Atendimento (Fila Geral, Kanban, Tempo Real)

### Diagnóstico atual
- Sim: a **Fila Geral** (queue sem `team_member_id`) é a fila padrão que recebe leads novos via webhook da Evolution.
- O Kanban de leads NÃO move conversas entre filas hoje. Mover lead no Kanban deveria refletir na fila do WhatsApp — não está conectado.
- Não existe botão "Iniciar conversa" a partir do Lead nem campo livre de telefone no Atendimento.
- Falta tempo real (Realtime do Supabase nas mensagens/conversas).
- Sem suporte a emojis (picker), e mídia funciona parcialmente (já tem upload, mas falta áudio/gravação).

### O que vou implementar

**1.1 Realtime no Atendimento**
- Subscribe em `whatsapp_messages` e `whatsapp_conversations` via `supabase.channel()` — admin e atendentes veem novas mensagens chegando sem refresh.
- Auto-scroll para nova mensagem; indicador "digitando…" desabilitado por ora (Evolution API limita).

**1.2 Iniciar conversa a partir do Lead**
- Botão **"Abrir conversa no WhatsApp"** no modal do Lead (`Leads.tsx`).
- Cria/recupera `whatsapp_conversations` pelo telefone do lead, vincula `lead_id`, abre direto em `/admin/atendimento?conversation={id}`.

**1.3 Iniciar conversa por telefone livre**
- Botão **"Nova conversa"** no topo do Atendimento → modal pedindo telefone + nome opcional + instância → cria conversa vazia e abre.

**1.4 Picker de emoji + envio de áudio gravado**
- Emoji picker (lib `emoji-mart`) no input de mensagem.
- Botão de microfone → grava `audio/webm`, faz upload em `whatsapp-media` e envia via `whatsapp-send` como áudio.

**1.5 Kanban ↔ Fila vinculados (transferência entre filas com histórico de 30 dias)**
- Nova tabela `kanban_stage_queue_map` mapeando `kanban_status` (etapa) → `queue_id` (fila WhatsApp).
- Quando lead muda de etapa no Kanban: trigger/edge function transfere a conversa do lead para a nova fila, registra em `whatsapp_conversation_transfers`.
- O **histórico de 30 dias** já é nativo (mensagens ficam no banco). A nova fila/atendente passa a ver toda a conversa.
- Admin vê todas as filas; atendente vê apenas filas que é membro + filas que recebeu via transferência recente (já coberto pelo `can_access_conversation`).
- Aviso visual na fila do atendente quando há lead na **etapa anterior à dele** ("X leads aguardando na etapa anterior"). Card discreto no topo do Atendimento.

---

## Frente 2 — Honorários (Recibos)

### O que vou implementar
- Na aba **Honorários** do contrato, ao **dar baixa em uma parcela** (status pago):
  - Modal de confirmação já existente ganha botão **"Gerar e enviar recibo"**.
  - Seleção do **modelo de recibo** (filtrado pelos templates disponíveis para o advogado responsável OU marcados como uso geral).
  - Gera PDF/HTML a partir do template (usa o motor já existente do Gerador de Documentos), salva em `contract_documents` com `document_type = 'receipt'`.
  - Botão **"Enviar"** com 2 checkboxes: ✅ Cliente (WhatsApp/Email) ✅ Advogado responsável (WhatsApp/Email).
  - Histórico em `contract_history` ("Recibo enviado para…").

### Estrutura de dados
- Adicionar campo `paid_at`, `paid_method`, `receipt_document_id` na estrutura `fees.installments[]` (já é JSONB em `contracts.fees`).

---

## Frente 3 — Gerador de Documentos (Modelo Recibo)

### O que vou implementar
- No `document_template_types` garantir que existe o tipo **"Recibo"** (insert idempotente).
- No formulário do contrato (aba Honorários), antes do **Plano de Parcelas**, novo campo:
  - **"Modelo de Recibo"** (select filtrado: templates do tipo "Recibo" + (`owner_id = advogado do contrato` OU `assigned_team_member_ids` contém o advogado OU marcado como geral)).
  - Salvo em `contracts.fees.receipt_template_id`.
- Adicionar flag `is_general` em `document_templates` (boolean, default false) para marcar templates de uso geral por todos os advogados.
- Variáveis novas disponíveis no template de recibo: `{{parcela.numero}}`, `{{parcela.valor}}`, `{{parcela.data_pagamento}}`, `{{parcela.forma_pagamento}}`, `{{contrato.numero}}`, além das já existentes de cliente/advogado.

---

## Migrações de banco (resumo)

1. `kanban_stage_queue_map` (stage text, queue_id uuid) + seed inicial.
2. `document_templates.is_general boolean default false`.
3. Insert idempotente em `document_template_types` para "Recibo".
4. Storage policy para gravações de áudio em `whatsapp-media` (já existe bucket).

## Edge functions

- Atualizar `whatsapp-transfer` para aceitar transferência por mudança de etapa do Kanban.
- Nova `receipt-send` — gera HTML do recibo, salva em `contract_documents`, envia via `whatsapp-send` e/ou `brevo-send`.

## Arquivos front-end principais a editar

- `src/pages/admin/Atendimento.tsx` — realtime, emoji, áudio, nova conversa, alerta etapa anterior.
- `src/pages/admin/Leads.tsx` — botão "Abrir conversa".
- `src/pages/admin/Leads.tsx` (Kanban) — onChange status dispara transferência de fila.
- `src/pages/admin/ContractForm.tsx` (aba Honorários) — select de modelo de recibo, modal de baixa com envio.
- `src/pages/admin/DocumentTemplates.tsx` + form — flag "uso geral".

---

## Pergunta antes de começar

Quer que eu execute **tudo numa rodada só** (vai ser uma resposta longa com várias migrações) ou prefere **frente por frente** (começo pela 1 — Atendimento — que é a mais crítica)?
