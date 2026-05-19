# Fase 5 — Campanhas e Broadcast (WhatsApp + E-mail via Brevo)

Objetivo: permitir disparo de campanhas em massa para leads/clientes/contatos do CRM, via **WhatsApp (Evolution)** e **E-mail (Brevo)**, com segmentação, templates reutilizáveis, agendamento, fila controlada (anti-ban) e métricas. Encerra o ciclo de aquisição → atendimento → relacionamento.

Antes de iniciar, faço também os **ajustes finais da Fase 4** (ver seção 9).

---

## 1. Modelo de dados

### `audiences`
Segmentos salvos.
- `name`, `description`, `source` ('leads'|'clients'|'contacts'|'manual'), `filters` (jsonb — área, status kanban, tags, período), `member_count` (cache), `active`.

### `audience_members`
- `audience_id`, `lead_id` / `client_id` / `contact_id` (nullable), `phone`, `email`, `name`, `vars` (jsonb — variáveis por destinatário).

### `message_templates`
Templates reutilizáveis (WhatsApp + e-mail).
- `name`, `channel` ('whatsapp'|'email'|'both'), `subject` (email), `body` (texto/markdown com `{{variaveis}}`), `media_url` (opcional WhatsApp), `category`, `active`.

### `campaigns`
- `name`, `channel` ('whatsapp'|'email'), `audience_id`, `template_id`, `whatsapp_instance_id` (se WA), `from_email` / `from_name` (se email), `subject_override`, `body_override`, `scheduled_at`, `status` ('draft'|'scheduled'|'running'|'paused'|'completed'|'failed'), `throttle_per_minute` (default 10 WA / 60 email), `started_at`, `finished_at`, `stats` (jsonb: sent/delivered/read/failed/clicked).

### `campaign_recipients`
Uma linha por destinatário.
- `campaign_id`, `audience_member_id`, `phone`/`email`, `personalized_body`, `personalized_subject`, `status` ('pending'|'sending'|'sent'|'delivered'|'read'|'failed'|'unsubscribed'), `sent_at`, `delivered_at`, `read_at`, `error`, `provider_message_id`, `clicks` (int), `opens` (int).

### `unsubscribes`
- `phone`/`email`, `channel`, `reason`, `created_at`. Bloqueia envios futuros.

**RLS**: admin gerencia tudo. Team members veem campanhas que criaram.

## 2. Integração Brevo (e-mail transacional + marketing)

- Nova secret: `BREVO_API_KEY`.
- Tabela `platform_settings` ganha campos: `brevo_sender_email`, `brevo_sender_name`, `brevo_reply_to`.
- Edge function `brevo-send` (envio individual) e webhook `brevo-webhook` (eventos delivered/opened/clicked/bounced → atualiza `campaign_recipients`).
- DNS: instruções para SPF/DKIM no admin (texto-guia).

## 3. WhatsApp broadcast

- Edge function `whatsapp-broadcast-worker`: cron a cada 1 min, pega `campaign_recipients` pendentes da campanha mais antiga `running`, respeita `throttle_per_minute` por instância, envia via `whatsapp-send`, faz jitter aleatório (3–10s) para não parecer bot.
- Suporta `mediaUrl` (imagem/áudio/documento).
- Marca `unsubscribe` ao receber palavras-chave ("sair", "parar", "descadastrar") no `evolution-webhook`.

## 4. Editor de campanha (`/admin/campanhas`)

- Lista de campanhas (status, canal, destinatários, taxa de entrega).
- Wizard "Nova campanha": 1) canal → 2) público (escolhe audience ou cria filtro inline) → 3) template ou texto livre → 4) preview com variáveis renderizadas → 5) agendar/enviar agora.
- Página de detalhe: barra de progresso, tabela de destinatários com status, botão pausar/retomar/duplicar, gráfico de funil.

## 5. Editor de templates (`/admin/campanhas/templates`)

- CRUD de `message_templates`.
- Editor com inserção de variáveis (`{{nome}}`, `{{area}}`, `{{processo}}` etc.) via dropdown.
- Para e-mail: editor rich-text simples (reutiliza `RichTextEditor`).
- Preview ao vivo com destinatário-amostra.

## 6. Segmentação (`/admin/campanhas/publicos`)

- Builder visual: origem (leads/clients/contacts) + filtros (área de atuação, status, tags, criado entre datas, com/sem contrato).
- Preview de contagem em tempo real.
- Salvar como audience ou usar one-off.

## 7. Métricas

- Dashboard de campanha com: enviados, entregues, lidos, falhas, descadastros, CTR (e-mail).
- Card no `/admin` (Dashboard) com últimas 3 campanhas.

## 8. Menu admin

Novo grupo **"Campanhas"** com:
- Visão geral (`/admin/campanhas`)
- Templates (`/admin/campanhas/templates`)
- Públicos (`/admin/campanhas/publicos`)

## 9. Ajustes finais da Fase 4 (antes da Fase 5)

Pontos identificados na auditoria do que já foi entregue:
- **Composer com anexos no Atendimento**: hoje `whatsapp-send` já aceita mídia, mas a UI ainda não tem botão de anexo (imagem/áudio/documento). Adicionar.
- **Botão "Agendar"** no header da conversa Atendimento e no detalhe do Lead (ainda ausente).
- **Aba "Agendamentos"** dentro do detalhe do Contrato.
- **Cron de lembrete 24h** (`appointment-notify` com modo `mode=reminders`) — agendar via `pg_cron` ou orientar configuração no painel Supabase.
- **Templates de notificação editáveis** em `platform_settings` (`appointment_confirmation_template`, `appointment_reminder_template`, `appointment_cancelled_template`).
- **Tool `cancel_appointment`** no `ai-agent-reply` (planejado mas não criado).
- **Validação de overlap** server-side ao criar appointment (evitar double-booking).

## 10. Ordem de entrega

1. Ajustes finais Fase 4 (seção 9).
2. Migration: `audiences`, `audience_members`, `message_templates`, `campaigns`, `campaign_recipients`, `unsubscribes` + campos Brevo em `platform_settings`.
3. Secret `BREVO_API_KEY` + edge functions `brevo-send` / `brevo-webhook`.
4. Edge function `whatsapp-broadcast-worker` + cron.
5. UI Templates → Públicos → Campanhas (nesta ordem para destravar dependências).
6. Métricas + cards no dashboard.
7. Palavra-chave de unsubscribe no `evolution-webhook`.

## 11. Riscos

- **Ban WhatsApp**: throttle obrigatório, jitter, opt-out automático. Documentar boas práticas no admin.
- **Reputação e-mail**: exigir SPF/DKIM antes do primeiro disparo; bloquear envio se não configurado.
- **Custo Brevo**: monitorar via campo `stats` por campanha.
- **Variáveis faltantes**: validador pré-envio que mostra destinatários sem `{{variavel}}` preenchida.
- **LGPD**: registrar base legal por audience (opt-in/legítimo interesse) — campo `legal_basis` em `audiences`.

---

Confirma para eu (a) aplicar os ajustes finais da Fase 4 e (b) rodar a migration da Fase 5 e seguir na ordem acima?
