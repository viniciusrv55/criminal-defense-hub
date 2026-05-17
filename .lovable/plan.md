### Fase 4 — Agenda, Agendamentos e Mídia (áudio/imagem) no Atendimento

Objetivo: dar ao escritório uma agenda integrada ao CRM + permitir que o agente de IA (e atendentes humanos) marquem compromissos diretamente no WhatsApp, além de processar áudios recebidos (transcrição) e imagens (descrição) para que o agente possa entendê-los.

Fora do escopo: broadcast/Brevo (Fase 5), faturamento/cobrança, vídeo-chamada.

---

## 1. Agenda — modelo de dados

### `appointment_types`
Tipos configuráveis (ex.: "Consulta inicial 30min", "Reunião contrato", "Audiência"):
- `name`, `duration_minutes`, `color`, `default_location`, `requires_attorney` (bool), `active`, `sort_order`.

### `appointments`
- `title`, `description`
- `appointment_type_id`, `practice_area_id` (nullable)
- `lead_id` / `client_id` / `contract_id` (nullable — vincula ao CRM)
- `conversation_id` (nullable — quando criado via WhatsApp)
- `attorney_id` (team_member responsável), `attendees` (uuid[] team_members extras)
- `starts_at`, `ends_at`, `all_day` (bool), `location`, `meeting_url`
- `status` ('scheduled'|'confirmed'|'completed'|'cancelled'|'no_show')
- `reminder_sent_at`, `confirmation_sent_at`
- `created_by`, `created_via` ('admin'|'ai_agent'|'client_portal')
- `notes`, `external_calendar_id` (futuro Google Calendar)

### `appointment_availability`
Janelas de disponibilidade por team_member:
- `team_member_id`, `weekday` (0-6), `start_time`, `end_time`, `active`

### `appointment_blocks`
Bloqueios pontuais (feriados, férias):
- `team_member_id` (nullable = global), `starts_at`, `ends_at`, `reason`

**RLS**: admin gerencia tudo. Team members veem/editam appointments onde são `attorney_id` ou estão em `attendees`. Clientes veem os próprios via portal.

## 2. UI da Agenda — `/admin/agenda`

- Vista **Mensal** / **Semanal** / **Diária** (FullCalendar-like via componente próprio, sem nova dependência pesada — usar grid Tailwind).
- Filtros: por advogado, por tipo, por área, por status.
- Click em slot vazio → modal "Novo agendamento" (auto-preenche horário).
- Click em evento → drawer com detalhes + ações (confirmar, cancelar, reagendar, enviar lembrete WhatsApp).
- Coluna lateral: próximos 7 dias resumidos.
- Aba **Configurações da agenda**: tipos, disponibilidade por advogado, bloqueios.

## 3. Integração com Lead / Contrato

- Em `Leads` (kanban + detalhe): botão **"Agendar consulta"** abre modal já vinculando o lead.
- Em `Contracts`: aba **Agendamentos** lista compromissos do contrato.
- Em `Atendimento` (conversa WhatsApp): botão **"Agendar"** no header da conversa.

## 4. Agente IA — novas ferramentas

Adicionar em `ai-agent-reply` (tools_enabled):

- `get_available_slots({ date, duration_minutes, attorney_id? })` → consulta `appointment_availability` + appointments existentes + blocks, devolve até 6 slots livres.
- `create_appointment({ name, phone, starts_at, duration_minutes, appointment_type_id?, notes? })` → cria appointment vinculado à conversa/lead, status `scheduled`, manda confirmação ao cliente.
- `cancel_appointment({ appointment_id, reason })` (só se o lead/conv tiver appointment futuro próprio).

Prompt do agente ganha bloco com regras de horário comercial e tipos disponíveis (injetado dinamicamente, igual ao knowledge).

## 5. Mídia no WhatsApp — áudio e imagem

### Inbound (`evolution-webhook`)
Hoje só salva `text`. Estender:
- `audioMessage` → baixa via URL Evolution, faz upload no bucket novo `whatsapp-media` (privado), salva `media_url`+`media_mime`, `message_type='audio'`.
- `imageMessage` → idem, `message_type='image'`, captura `caption` em `content`.
- `documentMessage` → idem, `message_type='document'`.

### Transcrição/descrição automática
Nova edge function `whatsapp-media-process`:
- Recebe `{ message_id }`.
- Se áudio: chama OpenAI `whisper-1` → grava texto em `metadata.transcript` e (se conversa tem IA ativa) injeta como pseudo-mensagem ao chamar `ai-agent-reply`.
- Se imagem: chama OpenAI `gpt-4o-mini` vision → grava `metadata.image_description`.
- Disparado fire-and-forget pelo webhook após salvar a mensagem.

### UI `Atendimento`
- Renderizar bolha de áudio com `<audio controls>` + texto transcrito abaixo (badge "transcrição automática").
- Imagens com `<img>` lightbox + descrição IA em tooltip.
- Documentos com link de download + ícone por tipo.

### Outbound
- Atendente pode anexar imagem/áudio/documento no composer → `whatsapp-send` aceita `mediaUrl`+`mediaType`, encaminha para Evolution endpoint correto (`/message/sendMedia/{instance}`).

## 6. Storage

Bucket `whatsapp-media` (privado). RLS via signed URLs geradas server-side; UI consome via signed URL com TTL 1h.

## 7. Notificações WhatsApp

Edge function `appointment-notify` (chamada por triggers):
- Confirmação imediata ao criar appointment.
- Lembrete 24h antes (cron diário simples via `pg_cron` — opcional MVP; alternativa: job manual no admin).
- Notificação de cancelamento.

Templates de mensagem editáveis em `platform_settings` (`appointment_*_template`).

## 8. Menu admin

Novo grupo **"Agenda"** com itens:
- Calendário (`/admin/agenda`)
- Tipos & Disponibilidade (`/admin/agenda/config`)

## 9. Permissões

- **Admin**: tudo.
- **Team member (advogado)**: cria/edita appointments próprios, vê os onde está em `attendees`. Edita própria disponibilidade.
- **IA**: cria via tool, com `attorney_id` herdado da fila ou roteado por regra.

## 10. Ordem de entrega

1. Migration: tabelas agenda + bucket `whatsapp-media` + colunas em messages se faltar.
2. Edge function `whatsapp-media-process` (whisper + vision).
3. Atualizar `evolution-webhook` para mídia + disparar processamento.
4. Atualizar `whatsapp-send` para enviar mídia + composer com anexos.
5. UI `/admin/agenda` (calendário + CRUD).
6. Config de tipos/disponibilidade/bloqueios.
7. Tools de agendamento no `ai-agent-reply` + atualizar `AiAgents` UI.
8. Botões "Agendar" em Leads, Contracts, Atendimento.
9. Edge function `appointment-notify` + templates.

## 11. Riscos

- **Custo Whisper**: ~$0.006/min. Log de uso opcional em tabela futura.
- **Conflito de agenda**: validar overlap no `create_appointment` (server-side, com lock por advogado).
- **Fuso horário**: tudo em `timestamptz`, UI exibe em `America/Fortaleza`.
- **Mídia grande**: limitar upload a 16MB (limite Evolution).
- **Quebra Fase 3**: zero — só adiciona tools opcionais.

Aprove para eu rodar a migration e começar pela base (agenda + mídia).
