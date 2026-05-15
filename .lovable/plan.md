# Fase 2 — Atendimento WhatsApp em tempo real

Objetivo: transformar a base da Fase 1 (Evolution conectada + webhook recebendo eventos) em uma plataforma de atendimento usável: conversas, filas por advogado, chat em tempo real, transferência com histórico e vínculo com leads/clientes existentes.

Fora do escopo desta fase: agentes de IA (OpenAI), agenda/agendamentos com IA, broadcast/Brevo. Ficam para Fase 3+.

---

## 1. Modelo de dados (novas tabelas)

### `whatsapp_queues`
Filas de atendimento. Por padrão criamos uma fila por `team_member` (advogado), mais uma fila "Geral" para mensagens não atribuídas.
- `name` (text), `team_member_id` (uuid, nullable — null = fila geral), `color` (text), `sort_order` (int), `active` (bool)

### `whatsapp_conversations`
Uma conversa = um número de cliente em uma instância.
- `instance_id` (FK whatsapp_instances), `contact_phone` (text), `contact_name` (text), `contact_avatar_url` (text)
- `lead_id` (FK leads, nullable) e `client_id` (FK clients, nullable) — vínculo com CRM
- `current_queue_id` (FK whatsapp_queues), `assigned_team_member_id` (FK team_members, nullable)
- `status` ('open' | 'pending' | 'closed'), `last_message_at`, `last_message_preview`, `unread_count`
- UNIQUE (instance_id, contact_phone)

### `whatsapp_messages`
- `conversation_id` (FK), `evolution_message_id` (text único — dedupe), `direction` ('inbound' | 'outbound')
- `from_phone`, `to_phone`, `message_type` ('text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location')
- `content` (text), `media_url` (text), `media_mime` (text), `metadata` (jsonb)
- `sent_by_user_id` (uuid, nullable — quem da equipe enviou), `status` ('sent' | 'delivered' | 'read' | 'failed')
- `created_at`

### `whatsapp_conversation_transfers`
Histórico de transferências entre filas/atendentes (auditoria + exibido no chat).
- `conversation_id`, `from_queue_id`, `to_queue_id`, `from_user_id`, `to_user_id`, `note`, `transferred_at`

### `whatsapp_conversation_notes`
Notas internas (não enviadas pro WhatsApp, só visíveis para a equipe).
- `conversation_id`, `author_user_id`, `content`, `created_at`

**RLS**: admin gerencia tudo. Membros da equipe leem/escrevem em conversas onde são `assigned_team_member_id` OU pertencem à `current_queue_id` (membro da fila). Realtime habilitado em `whatsapp_messages`, `whatsapp_conversations` e `whatsapp_conversation_transfers`.

---

## 2. Edge functions

### `evolution-webhook` (atualizar)
Hoje só loga e atualiza status. Adicionar processamento real:
- `messages.upsert` → cria/atualiza `whatsapp_conversations` (auto-cria se novo número), insere `whatsapp_messages` (dedupe via `evolution_message_id`), atualiza `last_message_at`/`unread_count`, roteia para fila do dono da instância (ou Geral).
- `messages.update` → atualiza `status` (delivered/read).
- `contacts.update` → atualiza nome/avatar do contato.
- `connection.update` → mantém comportamento atual.

### `whatsapp-send` (nova)
- Recebe `{ conversation_id, message_type, content, media_url? }`.
- Valida JWT, valida que usuário pode atender essa conversa (RLS-equivalente).
- Chama Evolution `/message/sendText` ou `/message/sendMedia` via credenciais salvas.
- Insere `whatsapp_messages` com `direction='outbound'` e `sent_by_user_id`.

### `whatsapp-transfer` (nova)
- Recebe `{ conversation_id, to_queue_id?, to_user_id?, note? }`.
- Atualiza conversa, registra em `whatsapp_conversation_transfers`. Histórico fica visível para o novo atendente.

---

## 3. UI — `/admin/atendimento`

Layout 3 colunas estilo WhatsApp Web:

```
┌─────────────┬──────────────────────────┬────────────────┐
│ Filas       │ Conversas (fila ativa)   │ Chat ativo     │
│ - Geral (3) │ • Cliente A · 14:32      │ Header + ações │
│ - Adv X (5) │ • Cliente B · 14:10      │ Mensagens      │
│ - Adv Y (2) │ • Cliente C · 13:55      │ Composer       │
│ + nova fila │                          │ Notas/Transfer │
└─────────────┴──────────────────────────┴────────────────┘
```

Componentes:
- `QueueSidebar` — lista filas + contador unread, botão "+ fila" (admin), filtro "minhas/todas".
- `ConversationList` — conversas da fila selecionada, busca por nome/telefone, ordenação por `last_message_at`.
- `ChatWindow` — header com nome/telefone + badges (lead vinculado, advogado responsável), timeline de mensagens (text/image/audio/doc), separadores de transferência ("Transferido de Fila X para Fila Y por Fulano"), composer com texto + anexo + emoji.
- `ConversationDrawer` (lateral direita colapsável) — vínculo com lead/cliente (autocomplete), notas internas, histórico de transferências, botão **Transferir** (modal com fila/usuário + nota).

Realtime via `supabase.channel()`:
- INSERT em `whatsapp_messages` da conversa aberta → append + auto-scroll.
- UPDATE em `whatsapp_conversations` → reordena lista.
- INSERT em `whatsapp_conversation_transfers` → recarrega contadores das filas.

Menu admin: novo item **"Atendimento"** (acima de WhatsApp/Plataforma) visível para admins e team_members.

---

## 4. Vínculo com CRM

- Ao receber primeira mensagem de um número, tenta match em `leads.phone` ou `clients.phones`. Se achar, vincula `lead_id`/`client_id` automaticamente.
- No drawer do chat: botão "Criar lead" (pré-preenche nome + telefone) e "Vincular a lead/cliente existente" (autocomplete).

---

## 5. Permissões

- **Admin/super_admin**: vê todas as filas, todas as conversas, transfere para qualquer um.
- **Team member (advogado)**: vê fila Geral + sua própria fila + filas onde foi adicionado como membro. Só envia mensagem em conversas atribuídas a ele ou na fila dele.
- Tabela auxiliar `whatsapp_queue_members` (queue_id, team_member_id) para filas compartilhadas (futuro multi-membro). Por padrão cada fila tem 1 dono via `team_member_id`.

---

## 6. Entregáveis e ordem

1. Migration: 5 novas tabelas + RLS + realtime publication + seed (fila "Geral" + uma fila por team_member ativo).
2. Atualizar `evolution-webhook` para processar `messages.upsert`/`update` e `contacts.update`.
3. Criar `whatsapp-send` e `whatsapp-transfer`.
4. Página `/admin/atendimento` com as 3 colunas + realtime.
5. Configurar webhook na Evolution (já feito na Fase 1) para apontar para o endpoint — só validar.
6. Teste end-to-end: enviar msg de fora → aparece na fila Geral → transferir para Adv X → responder → status delivered/read.

---

## 7. Riscos

- **Volume de mensagens**: dedupe por `evolution_message_id` evita duplicatas em retries do webhook.
- **Realtime cost**: filtrar canais por `conversation_id` aberto e por filas visíveis ao usuário.
- **Mídia**: Fase 2 só exibe URLs vindas da Evolution (sem reupload pro Storage). Reupload fica para Fase 3 se necessário.
- **Quebra de Fase 1**: zero — só adiciona tabelas/funcionalidades novas.

Aprove para eu rodar a migration e seguir com webhook + UI.
