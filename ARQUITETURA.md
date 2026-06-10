# Arquitetura do Sistema — Lindomberto Moraes Advocacia

Documento de referência completo para migração do projeto (atualmente em Lovable + React/Vite + Supabase) para uma stack escalável: **Node.js (backend)** + **React (frontend, Vercel)** + **PostgreSQL (Portainer)**.

Última atualização: 10/06/2026

---

## 1. Visão Geral

O sistema é composto por **dois grandes módulos**:

1. **Site institucional público** — captação de leads para o escritório (SEO, blog, áreas de atuação, advogados em destaque, CTA WhatsApp).
2. **Painel administrativo (CRM jurídico)** — gestão completa do escritório: leads, clientes, contratos, processos (CNJ/DataJud), atendimento omnichannel via WhatsApp, agente de IA, agenda, financeiro, campanhas, equipe, permissões, portal do cliente.

### 1.1 Stack atual (origem da migração)

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript 5 + TailwindCSS v3 + shadcn/ui |
| Roteamento | react-router-dom v6 |
| State/data | @tanstack/react-query + Supabase JS SDK |
| Editor rico | TipTap |
| SEO | react-helmet-async |
| Backend | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions Deno) |
| WhatsApp | Evolution API (self-host) via webhook |
| IA | OpenAI (gpt-4o-mini) via `OPENAI_API_KEY` |
| Processos | DataJud CNJ API (`CNJ_DATAJUD_API_KEY`) |
| E-mail transacional | Brevo (Sendinblue) |

### 1.2 Stack alvo (migração)

| Camada | Tecnologia alvo |
|---|---|
| Frontend | React + Vite (ou Next.js) hospedado em **Vercel** |
| Backend | **Node.js** (recomendado: Fastify ou NestJS) com TypeScript |
| ORM | Prisma ou Drizzle |
| Banco | **PostgreSQL 15+** no **Portainer** (container) |
| Auth | JWT + refresh tokens (substitui Supabase Auth) — recomendado `@fastify/jwt` ou `passport` |
| Storage | MinIO ou S3 (substitui Supabase Storage) |
| Realtime | Socket.IO ou Pusher (substitui Supabase Realtime) |
| Filas/jobs | BullMQ + Redis (substitui Edge Functions agendadas) |
| Deploy backend | Portainer (Docker Compose) |
| Deploy frontend | Vercel |

---

## 2. Arquitetura de Alto Nível

```text
                     ┌──────────────────────┐
                     │   Site Público       │
                     │   (Vercel/React)     │
                     │   SEO + Blog + CTA   │
                     └──────────┬───────────┘
                                │ REST/GraphQL
                                ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌──────────────────┐
│  Painel Admin SPA   │──▶│   API Node.js       │──▶│  PostgreSQL      │
│  (Vercel/React)     │   │   (Portainer)       │   │  (Portainer)     │
└─────────────────────┘   │                     │   └──────────────────┘
                          │  • Auth JWT         │
                          │  • Workers (BullMQ) │   ┌──────────────────┐
                          │  • Webhook handlers │──▶│  Redis (filas)   │
                          │  • Socket.IO        │   └──────────────────┘
                          └────────┬────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
 ┌───────────────┐         ┌───────────────┐          ┌──────────────┐
 │ Evolution API │         │  OpenAI API   │          │  DataJud CNJ │
 │ (WhatsApp)    │         │  (Agente IA)  │          │  (Processos) │
 └───────────────┘         └───────────────┘          └──────────────┘
        │                                                     ▲
        ▼                                                     │
 ┌───────────────┐                                            │
 │  Brevo (E-mail│                                            │
 │  transacional)│              ┌────────────────┐            │
 └───────────────┘              │  Worker CRON   │────────────┘
                                │  (cnj-sync     │
                                │   diário)      │
                                └────────────────┘

        ┌──────────────────────┐
        │  MinIO / S3          │  (assets, contratos, mídia WhatsApp)
        └──────────────────────┘
```

---

## 3. Frontend — Estrutura de Telas

### 3.1 Site público (rotas anônimas)

| Rota | Página | Função |
|---|---|---|
| `/` | `Index.tsx` | Home: Hero, Sobre, Áreas, Advogados em destaque, Blog preview, CTA WhatsApp |
| `/areas-de-atuacao` | `PracticeAreas.tsx` | Lista de todas as áreas |
| `/areas/:slug` | `PracticeAreaDetail.tsx` | Página dedicada da área (capa, conteúdo rico, galeria, CTA WhatsApp customizado) |
| `/blog` | `Blog.tsx` | Listagem de posts (filtro categoria, sidebar) |
| `/blog/:slug` | `BlogPost.tsx` | Post com SEO completo (Helmet, JSON-LD) |
| `/contato` | `Contact.tsx` | Info + botão WhatsApp + mapa (sem formulário — CTA direto WhatsApp) |
| `/portal` | `ClientPortal.tsx` | Portal cliente: login com username/nickname + dia/mês aniversário, ver contratos/recibos |

**Componentes-chave do site:**
- `components/Header.tsx`, `Footer.tsx`, `WhatsAppButton.tsx` (flutuante)
- `components/home/*` — HeroSection, AboutSection, PracticeAreasSection, AttorneysMarquee, BlogPreviewSection, CTASection, DifferentialsSection
- `components/blog/*` — BlogCard, BlogSidebar, Breadcrumbs
- `components/AttorneyCard.tsx`, `LeadFormPopup.tsx`

**Identidade visual obrigatória:**
- Cores: preto `#000000`, branco `#FFFFFF`, dourado `#d1a967`
- Fontes: **Playfair Display** (títulos), **Inter** (corpo)
- Layout DEVE alternar seções claras/escuras
- Tokens semânticos definidos em `src/index.css` + `tailwind.config.ts`

### 3.2 Painel admin (rotas protegidas — `ProtectedRoute` / `SuperAdminRoute`)

| Rota | Página | Função |
|---|---|---|
| `/admin/login` | `Login.tsx` | Autenticação Supabase Auth |
| `/admin` | `Dashboard.tsx` | KPIs gerais + widgets financeiros (`FinancialWidgets.tsx`) |
| `/admin/leads` | `Leads.tsx` | Kanban de leads (drag-drop entre etapas dinâmicas) |
| `/admin/clientes` | `Clients.tsx` | CRUD clientes PF/PJ + grupos + portal access |
| `/admin/contratos` | `Contracts.tsx` | Listagem + arquivar/desarquivar + tags processo finalizado |
| `/admin/contratos/:id` | `ContractForm.tsx` | Editor multi-aba: Dados Processo (CNJ auto-fill + andamentos + partes), Parte Adversa, Financeiro (`FinanceiroTab.tsx`), Documentos, Histórico |
| `/admin/documentos` | `DocumentTemplates.tsx` | Templates de contratos/recibos (TipTap) |
| `/admin/documentos/:id` | `DocumentTemplateForm.tsx` | Editor de template + variáveis dinâmicas |
| `/admin/atendimento` | `Atendimento.tsx` | Inbox WhatsApp omnichannel + Kanban + filas + transferência + notas |
| `/admin/agentes-ia` | `AiAgents.tsx` | Config agentes IA por fila (prompt, temperatura, handoff, tools, agenda) |
| `/admin/whatsapp` | `WhatsAppInstances.tsx` | Instâncias Evolution API (QR Code, status) |
| `/admin/filas` | `Queues.tsx` | Filas de atendimento + membros |
| `/admin/agenda` | `Agenda.tsx` | Calendário compromissos (semana/mês) |
| `/admin/agenda/config` | `AgendaConfig.tsx` | Tipos compromisso, disponibilidade, bloqueios |
| `/admin/campanhas` | `Campaigns.tsx` | Disparo em massa WhatsApp/Email |
| `/admin/campanhas/templates` | `CampaignTemplates.tsx` | Templates campanha |
| `/admin/campanhas/publicos` | `CampaignAudiences.tsx` | Audiências filtradas |
| `/admin/equipe` | `Team.tsx` | Membros + permissões Kanban + mapeamento Kanban→Fila WhatsApp |
| `/admin/attorneys` | `Attorneys.tsx` | Permissões granulares de advogados |
| `/admin/advogados-destaque` | `FeaturedAttorneys.tsx` | Vitrine site |
| `/admin/areas` | `PracticeAreas.tsx` (admin) | CMS áreas atuação |
| `/admin/blog` | `BlogPosts.tsx` | CMS blog |
| `/admin/blog/:id` | `BlogPostForm.tsx` | Editor post TipTap |
| `/admin/settings` | `Settings.tsx` | Site settings (hero, about, footer, whatsapp) |
| `/admin/plataforma` | `PlatformSettings.tsx` | Super admin: chaves API, configurações sistema |

### 3.3 Hooks customizados (`src/hooks/`)
- `useAuth` — sessão + papéis (super_admin, admin, attorney, team_member)
- `useBlogPosts`, `usePracticeAreas`, `useSiteSettings`, `useFeaturedAttorneys`
- `useLeads`, `useContracts`, `useContractCatalog`, `useDocumentTemplates`
- `use-mobile`, `use-toast`

### 3.4 Helpers
- `lib/supabase-helpers.ts` — wrapper `db.from()` (necessário substituir por client HTTP do novo backend)
- `lib/whatsapp.ts` — utilitários phone/URL
- `lib/document-variables.ts` — substituição `{{variável}}` em templates
- `lib/html-to-docx.ts` — exportação Word
- `lib/slug.ts`, `lib/utils.ts` (cn)

---

## 4. Modelo de Dados (PostgreSQL)

Todas as tabelas no schema `public`. UUIDs como PK (`gen_random_uuid()`). `created_at`/`updated_at` com `timestamptz default now()`.

### 4.1 Autenticação & Pessoas

#### `profiles` — perfil do usuário autenticado
- `id`, `user_id` (FK auth.users, único), `full_name`, `avatar_url`, timestamps
- Cada login no Auth gera 1 profile (trigger `handle_new_user`)

#### `user_roles` — papéis (NUNCA armazenar role em profiles)
- `id`, `user_id` (FK auth.users), `role` (enum `app_role`: `super_admin`, `admin`, `attorney`, `team_member`)
- Unique `(user_id, role)`
- Função `has_role(user_id, role)` + `is_admin(user_id)` (SECURITY DEFINER)

#### `team_members` — membros do escritório (não só advogados)
- `id`, `user_id` (FK auth.users), `full_name`, `role_title` (Advogado/Estagiário/Recepção...), `specialty`, `phone`, `email`, `avatar_url`, `active`
- Função `is_team_member(user_id)`

#### `attorney_permissions` — permissões granulares por advogado
- `user_id`, `can_view`, `can_create`, `can_delete`, `practice_area_ids[]`

### 4.2 Site público (CMS)

#### `site_settings` — chave/valor genérico
Chaves: `hero_*`, `about_*`, `cta_*`, `footer_*`, `whatsapp_*`

#### `practice_areas` — áreas de atuação (página pública + admin)
- `title`, `slug` (único), `subtitle`, `description`, `content` (HTML rico TipTap), `icon_name`, `icon_svg`, `icon_color`, `cover_image_url`, `gallery` (jsonb array), `featured`, `whatsapp_message`, `cta_button_text`, `youtube_url`, `sort_order`, `active`

#### `blog_posts`
- `title`, `slug` (único), `excerpt`, `content`, `featured_image_url`, `category`, `meta_description`, `published`, `author_id`

#### `blog_images` — galeria por post
- `post_id`, `image_url`, `caption`, `sort_order`

#### `featured_attorneys` — vitrine site
- `full_name`, `specialty`, `oab_number`, `photo_url`, `sort_order`, `active`

### 4.3 CRM — Leads e Clientes

#### `leads` — funil de captação
- `name`, `email`, `phone`, `practice_area_id`, `message`, `status`, `assigned_attorney_id`, `kanban_status` (FK lógica → `kanban_columns.key`), `responsible_ids[]` (uuid[] de team_members)
- Função `is_lead_responsible(user_id, lead_id)`

#### `lead_history` — auditoria
- `lead_id`, `action`, `description`, `performed_by`

#### `clients` — PF/PJ completo
- `person_type` (`pf`/`pj`), `full_name`, `social_name`, dados pessoais (nacionalidade, profissão, escolaridade, estado civil, nascimento, RG, CPF, PIS, CNPJ, IE, nome fantasia)
- `emails` (jsonb), `phones` (jsonb) — array de `{label, value}`
- Endereço (cep, state, city, neighborhood, address)
- Contato emergência (`contact_name`, `contact_phone`)
- Filiação (`father_name`, `mother_name`)
- `notes`, `group_id` (FK), `group_name`, `profile_type`, `lead_id` (origem)

#### `client_groups` — grupos de clientes (hierárquico)
- `name`, `practice_area_id`, `parent_id` (auto-relacional), `sort_order`, `active`

#### `client_portal_access` — credenciais portal
- `client_id`, `user_id` (FK auth), `username`, `nickname`, `birthday_day`, `birthday_month`, `active`
- Login = username + dia/mês nascimento (fluxo simplificado)

### 4.4 Contratos e Processos

#### `contracts` — núcleo CRM
- `client_id`, `contract_number`, `practice_area_id`, `attorney_id` (FK team_members)
- `status` (`draft`/`active`/`concluded`/`cancelled`)
- `process_type` (`judicial`/`administrative`)
- `process_data` (jsonb): cnj_number, party_type, phase, responsible, locator, partner, prognosis, contract_date, distribution_date, judgment_date, sentence_date, execution_date, cause_value, request, notes, secrecy, capture_updates, court, court_unit, class_name, subjects[]
- `adverse_party` (jsonb): person_type, name, cpf/cnpj, rg, email, phone, address
- `fees` (jsonb): total_value, entry, entry_due_date, installments (1=à vista até 60), payment_method, custom_installments[], contractual_fees, succumbence_fees
- `process_parties` (jsonb) — auto-preenchido via DataJud
- `group_id`, `comarca_id`, `vara_id`, `party_type`
- `archived_at`, `archived_by`, `process_completed`, `last_cnj_sync_at`
- Função `is_contract_attorney(user_id, contract_id)`

#### `comarcas` / `varas`
- Comarca: `name`, `state`
- Vara: `comarca_id`, `vara_number`, `location`

#### `process_movements` — andamentos CNJ
- `contract_id`, `movement_date`, `code`, `name`, `complement`, `court_unit`, `source` (datajud), `raw` (jsonb), `fingerprint` (idempotência)

#### `contract_history` — auditoria
- `contract_id`, `action`, `description`, `performed_by`, `metadata`

#### `contract_documents` — docs gerados
- `contract_id`, `document_type`, `template_name`, `copies`, `file_url`, `file_name`, `generated_html`, `generated_by`

### 4.5 Financeiro

#### `payment_methods` — métodos cadastráveis
#### `installment_payments` — pagamentos de parcelas
- `contract_id`, `installment_key` (ex: `entry`, `1`, `2`...), `amount`, `paid_at`, `payment_method`, `notes`

#### `installment_renegotiations` — renegociações com snapshot
- `contract_id`, `previous_fees`, `new_fees`, `total_paid_before`, `remaining_debt`, `reason`, `payment_key_map`, `reverted_at`

#### `payment_receipts` — recibos enviados
- `contract_id`, `payment_id`, `template_id`, `installment_key`, `amount`, `file_url`, `sent_at`, `sent_via` (whatsapp/email), `sender_user_id`, `sender_name`

### 4.6 Documentos / Templates

#### `document_template_types` — tipos (Contrato, Recibo, Procuração...)
#### `document_templates`
- `type_id`, `title`, `content_html`, `doc_date`, `owner_id` (FK team_members), `assigned_team_member_ids[]`, `is_general`, `active`
- Função `can_use_document_template(user_id, template_id)`
- Templates de tipo "Recibo" NÃO aparecem na aba Documentos do contrato (apenas em fluxo de recibo)

### 4.7 WhatsApp / Atendimento

#### `whatsapp_instances` — instâncias Evolution API
- `name`, `instance_name` (único na Evolution), `phone_number`, `team_member_id`, `status` (`disconnected`/`connecting`/`connected`), `qr_code`, `webhook_secret`

#### `whatsapp_queues` — filas
- `name`, `team_member_id` (dono opcional), `color`, `sort_order`, `active`

#### `whatsapp_queue_members` — N:N fila ↔ membro
- `queue_id`, `team_member_id`

#### `whatsapp_conversations`
- `instance_id`, `contact_phone`, `contact_name`, `contact_avatar_url`
- `lead_id`, `client_id`, `current_queue_id`, `assigned_team_member_id`
- `status` (`open`/`closed`/`pending`), `last_message_at`, `last_message_preview`, `unread_count`
- `ai_enabled`, `ai_paused_at`, `ai_handoff_reason`
- Função `can_access_conversation(user_id, conv_id)`

#### `whatsapp_messages`
- `conversation_id`, `evolution_message_id`, `direction` (`in`/`out`), `from_phone`, `to_phone`, `message_type` (text/image/audio/video/document), `content`, `media_url`, `media_mime`, `metadata`, `sent_by_user_id`, `status` (pending/sent/delivered/read/failed)

#### `whatsapp_conversation_notes` — notas internas
- `conversation_id`, `author_user_id`, `content`

#### `whatsapp_conversation_transfers` — histórico transferências
- `conversation_id`, `from_queue_id`, `to_queue_id`, `from_user_id`, `to_user_id`, `note`, `transferred_at`

#### `whatsapp_transfer_acks` — confirmação leitura banner
- `transfer_id`, `user_id`, `acked_at`

#### `whatsapp_webhook_logs` — auditoria webhook
- `instance_name`, `event_type`, `payload`, `processed`, `error`

### 4.8 Kanban

#### `kanban_columns` — colunas dinâmicas (personalizáveis)
- `key` (único), `label`, `color`, `sort_order`, `active`

#### `kanban_stage_permissions` — quem pode atuar em qual etapa
- `stage` (key da coluna), `team_member_id`, `can_act`
- Regra híbrida: membro só move lead se for **responsável** (`leads.responsible_ids`) **E** tiver permissão na etapa. Admin sempre pode.
- Função `can_act_on_stage(user_id, stage)`

#### `kanban_stage_queue_map` — sincronia Kanban→Fila WhatsApp
- `stage`, `queue_id`
- Mover lead de etapa → conversa transferida automaticamente para fila

### 4.9 Agenda

#### `appointment_types` — tipos de compromisso
- `name`, `duration_minutes`, `color`, `default_location`, `requires_attorney`, `active`

#### `appointment_availability` — janelas de trabalho
- `team_member_id`, `weekday` (0-6), `start_time`, `end_time`, `active`

#### `appointment_blocks` — bloqueios (férias, indisponibilidade)
- `team_member_id`, `starts_at`, `ends_at`, `reason`

#### `appointments`
- `title`, `description`, `appointment_type_id`, `practice_area_id`, `lead_id`, `client_id`, `contract_id`, `conversation_id`, `attorney_id`, `attendees[]`
- `starts_at`, `ends_at`, `all_day`, `location`, `meeting_url`, `status` (`scheduled`/`confirmed`/`completed`/`cancelled`/`no_show`)
- `reminder_sent_at`, `confirmation_sent_at`, `created_by`, `created_via` (manual/ai/portal), `notes`, `external_calendar_id`
- **Trigger `check_appointment_overlap`** — impede conflito de horário do mesmo advogado (usa `tstzrange && operator`)
- Função `can_access_appointment(user_id, appt_id)`

### 4.10 Agentes IA

#### `ai_agents` — config por fila
- `queue_id`, `name`, `active`, `model` (default `gpt-4o-mini`), `temperature` (0.1-1, default 0.4), `max_tokens` (default 800), `system_prompt`, `greeting_message`
- `handoff_keywords[]` (palavras que disparam handoff)
- `handoff_after_messages` (limite)
- `business_hours` (jsonb)
- `tools_enabled[]` — `get_practice_areas`, `create_lead`, `request_human_handoff`, `list_appointment_types`, `get_available_slots`, `create_appointment`
- `scheduling_attorney_id` (advogado padrão para agendar)

#### `ai_agent_knowledge` — base RAG manual
- `agent_id`, `title`, `content`, `sort_order`, `active`

#### `ai_agent_runs` — logs execução
- `agent_id`, `conversation_id`, `inbound_message_id`, `outbound_message_id`, `model`, `prompt_tokens`, `completion_tokens`, `latency_ms`, `tool_calls` (jsonb), `status`, `error`

### 4.11 Campanhas

#### `audiences` — público-alvo
- `name`, `source` (leads/clients/manual), `filters` (jsonb), `member_count`, `legal_basis`, `active`

#### `audience_members`
- `audience_id`, `lead_id` | `client_id`, `name`, `phone`, `email`, `vars` (jsonb)

#### `message_templates` — templates campanha (canal: whatsapp/email)
- `name`, `channel`, `category`, `subject`, `body`, `media_url`, `media_mime`

#### `campaigns`
- `name`, `channel`, `audience_id`, `template_id`, `whatsapp_instance_id`, `from_email`, `from_name`, `reply_to`, `subject_override`, `body_override`, `media_url`
- `scheduled_at`, `status` (draft/scheduled/running/paused/completed/failed)
- `throttle_per_minute`, `jitter_seconds`, `started_at`, `finished_at`, `stats` (jsonb)

#### `campaign_recipients`
- `campaign_id`, `audience_member_id`, `name`, `phone`, `email`, `vars`, `personalized_subject`, `personalized_body`, `status`, `provider_message_id`, `sent_at`, `delivered_at`, `read_at`, `opens`, `clicks`, `error`

#### `unsubscribes` — opt-out LGPD
- `phone`, `email`, `channel` (whatsapp/email/all), `reason`
- Função `is_unsubscribed(phone, email, channel)`

### 4.12 Outros

#### `platform_settings` — super admin (chaves API públicas, flags)
- `key`, `value`, `description`, `updated_by`

---

## 5. Funções de Segurança (PostgreSQL)

Todas `SECURITY DEFINER` com `SET search_path = public`:

| Função | Uso |
|---|---|
| `has_role(uid, role)` | Verifica papel específico |
| `is_admin(uid)` | super_admin OU admin |
| `is_team_member(uid)` | Membro ativo da equipe |
| `is_contract_attorney(uid, contract_id)` | Advogado dono do contrato |
| `is_lead_responsible(uid, lead_id)` | Está em `responsible_ids` |
| `can_act_on_stage(uid, stage)` | Pode mover lead nesta etapa |
| `can_access_conversation(uid, conv_id)` | Acesso via fila/atribuição |
| `can_access_appointment(uid, appt_id)` | Advogado/criador/participante |
| `can_use_document_template(uid, template_id)` | Owner ou assigned |
| `is_unsubscribed(phone, email, channel)` | Opt-out check |
| `check_appointment_overlap()` (trigger) | Anti-conflito horário |
| `handle_new_user()` (trigger auth.users) | Cria profile no signup |
| `set_updated_at()` (trigger) | Atualiza `updated_at` |

**Na migração para Node.js**: estas funções podem virar middlewares/policies da camada de aplicação OU permanecer como funções SQL invocadas pelo ORM. Recomendo manter no Postgres para garantir consistência.

---

## 6. Backend — Edge Functions Atuais (a migrar para Node.js)

Cada função em `supabase/functions/` deve virar uma **rota** ou **worker** no novo backend Node.

### 6.1 `evolution-webhook` (verify_jwt=false)
**Entrada**: webhook da Evolution API (mensagem recebida, status, QR).
**Lógica**:
1. Loga em `whatsapp_webhook_logs`
2. Identifica instância via `instance_name`
3. Roteamento por `event_type`:
   - `messages.upsert` → cria `whatsapp_messages`, atualiza `whatsapp_conversations`, dispara agente IA se `ai_enabled`
   - `connection.update` → atualiza `whatsapp_instances.status`
   - `qrcode.updated` → grava `qr_code`
4. Cria contato em `whatsapp_conversations` se novo, vincula a `lead`/`client` se telefone bater

### 6.2 `evolution-api` (verify_jwt=false)
Wrapper para chamadas saindo (criar instância, conectar, gerar QR).

### 6.3 `whatsapp-send` (verify_jwt=false)
Envia mensagem via Evolution. Salva em `whatsapp_messages` com `status=pending` e atualiza ao receber ack.

### 6.4 `whatsapp-media-process` (verify_jwt=false)
Baixa mídia (áudio, imagem, documento) da Evolution, faz upload para bucket `whatsapp-media`, atualiza `media_url`.

### 6.5 `whatsapp-open-conversation` (verify_jwt=false)
Abre conversa nova manualmente (broadcast outbound).

### 6.6 `whatsapp-transfer` (verify_jwt=false)
Transfere conversa entre filas/usuários. Cria `whatsapp_conversation_transfers` + força `unread_count=1`.

### 6.7 `ai-agent-reply` (verify_jwt=false)
**Coração da IA**.
1. Carrega `ai_agents` da fila atual
2. Monta histórico de mensagens (últimas N)
3. Injeta `ai_agent_knowledge` no system prompt (RAG simples)
4. Chama OpenAI com `tools_enabled` (function calling)
5. Executa tools: `get_practice_areas`, `create_lead`, `request_human_handoff`, `list_appointment_types`, `get_available_slots`, `create_appointment`
6. Em handoff: cria `lead` (status=`new`), transfere para fila geral, marca `unread_count=1`
7. Loga em `ai_agent_runs`
8. Envia resposta via `whatsapp-send`

### 6.8 `cnj-lookup` (verify_jwt=false)
Consulta DataJud CNJ (`https://api-publica.datajud.cnj.jus.br/`).
Retorna: classe, assunto, partes (autor/réu) com advogados+OAB, órgão julgador, valor causa, segredo justiça, **lista completa de movimentos**.
Persiste em `process_movements` (idempotência via `fingerprint`).

### 6.9 `appointment-notify`
Worker de lembretes: marca `reminder_sent_at`, envia via WhatsApp/email 24h antes.

### 6.10 `brevo-send` / `brevo-webhook`
Envio e-mail transacional + tracking opens/clicks. Atualiza `campaign_recipients`.

### 6.11 `campaign-worker`
Worker que processa `campaigns` em status `running`: pega próximos `campaign_recipients` respeitando `throttle_per_minute` + `jitter_seconds`, envia, atualiza status.

### 6.12 `ai-agent-test`
Endpoint para testar prompt + tools sem afetar produção.

---

## 7. Storage (Buckets)

| Bucket | Público | Uso |
|---|---|---|
| `blog-images` | sim | Imagens posts |
| `site-assets` | sim | Hero, logos, etc |
| `practice-areas` | sim | Capas/galerias das áreas |
| `contracts` | NÃO | Docs contratuais gerados |
| `whatsapp-media` | NÃO | Mídia recebida/enviada |

**Migração**: usar MinIO no Portainer (S3-compatible) com mesmas regras de acesso.

---

## 8. Secrets / Variáveis de Ambiente

```env
# Banco
DATABASE_URL=postgres://user:pass@postgres:5432/lindomberto

# Auth
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d

# Storage (MinIO/S3)
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET_PREFIX=lindomberto-

# Redis (BullMQ)
REDIS_URL=redis://redis:6379

# Integrações externas
OPENAI_API_KEY=...
CNJ_DATAJUD_API_KEY=...
EVOLUTION_API_URL=https://evolution.exemplo.com
EVOLUTION_API_KEY=...
BREVO_API_KEY=...

# Frontend (Vercel)
VITE_API_URL=https://api.lindombertomoraes.com.br
VITE_WS_URL=wss://api.lindombertomoraes.com.br
```

---

## 9. Fluxos Críticos

### 9.1 Captação de Lead via WhatsApp
```text
Site CTA → wa.me → cliente envia msg
  → Evolution recebe → webhook → evolution-webhook
  → cria/atualiza whatsapp_conversations
  → se ai_enabled: ai-agent-reply responde
  → se handoff: cria lead (status=new) + transfere fila + notifica atendentes
```

### 9.2 Atendimento Humano (Kanban híbrido)
```text
Atendente abre /admin/atendimento
  → vê conversas das filas que pertence
  → responde via whatsapp-send
  → pode transferir (whatsapp-transfer) com nota
  → próximo responsável vê TransferNoteBanner até dar ack
  → mover lead no Kanban: valida can_act_on_stage + is_lead_responsible
  → se stage mapeado a fila (kanban_stage_queue_map): transfere conversa
```

### 9.3 Criação de Contrato + CNJ
```text
/admin/contratos/novo
  → seleciona cliente
  → aba Processo: digita CNJ → cnj-lookup popula partes, classe, órgão, andamentos
  → process_movements persistidos com fingerprint (sem duplicar)
  → worker diário (cron) re-consulta contratos com last_cnj_sync_at antigo
  → novos andamentos geram notificação
```

### 9.4 Agente IA agenda compromisso
```text
Cliente: "quero marcar com Dr. João amanhã"
  → ai-agent-reply chama list_available_slots(attorney_name=João, date_range)
  → consulta appointment_availability + appointments existentes
  → devolve slots livres
  → cliente escolhe → tool create_appointment
  → trigger check_appointment_overlap valida
  → appointment criado com created_via='ai'
  → confirmação enviada via WhatsApp
```

### 9.5 Financeiro de Contrato
```text
Contrato.fees define entry + installments + custom_installments
  → FinanceiroTab gera grade de parcelas (chaves: 'entry', '1', '2', ...)
  → pagamento: insert installment_payments(installment_key, amount)
  → recibo: gera HTML do template, salva contract_documents + payment_receipts
  → envia via WhatsApp/email, registra sent_at/sent_via
  → renegociação: snapshot em installment_renegotiations (reversível)
```

### 9.6 Campanha em Massa
```text
Cria audience (filtro leads/clients) → audience_members preenchidos
  → cria campaign (template + audience + canal)
  → ao iniciar: status=running → campaign-worker processa
  → para cada recipient: verifica is_unsubscribed → personaliza vars → envia
  → respeita throttle_per_minute + jitter_seconds
  → brevo-webhook atualiza opens/clicks/delivered
```

---

## 10. Plano de Migração — Passo a Passo

### Fase 1 — Infra base (Portainer)
1. Stack docker-compose: `postgres:15`, `redis:7`, `minio`, `api-node`, `worker-node`
2. Volumes persistentes para postgres + minio
3. Reverse proxy (Traefik/Caddy) com SSL Let's Encrypt
4. Backup automatizado postgres (pg_dump diário → S3 externo)

### Fase 2 — Backend Node.js
1. Setup Fastify + TypeScript + Prisma
2. Gerar schema Prisma a partir do dump deste banco
3. Implementar Auth JWT (substitui Supabase Auth) — endpoints `/auth/login`, `/auth/refresh`, `/auth/me`
4. Migrar middlewares de RBAC usando as funções SQL como base
5. Portar cada Edge Function para rota/worker:
   - Webhooks → rotas POST públicas com verificação de assinatura
   - Workers → BullMQ jobs (campaign-worker, appointment-notify, cnj-sync-daily)
6. Socket.IO para realtime (substitui Supabase Realtime usado em `Atendimento.tsx`)

### Fase 3 — Frontend
1. Trocar `@supabase/supabase-js` por client HTTP (`axios` + React Query)
2. Refatorar `lib/supabase-helpers.ts` (`db.from()`) para API REST do novo backend
3. Substituir `supabase.auth` por hooks JWT customizados
4. Substituir `supabase.channel()` (realtime) por Socket.IO client
5. Substituir Storage URLs por presigned URLs do MinIO
6. Deploy na Vercel com env `VITE_API_URL`

### Fase 4 — Cutover
1. Migração dos dados: `pg_dump` do Supabase → `pg_restore` no Postgres do Portainer
2. Copiar buckets via `rclone` Supabase Storage → MinIO
3. Atualizar webhook URL na Evolution API para o novo backend
4. DNS apontando para Vercel (frontend) + novo subdomínio para API
5. Período de validação paralela
6. Desativar Supabase

---

## 11. Pontos de Atenção

- **RLS → Middleware**: as RLS policies do Supabase NÃO migram automaticamente. Replicar lógica em middleware Node + queries no Prisma com `WHERE` por usuário. Manter funções SECURITY DEFINER como segunda camada de defesa.
- **GRANT statements**: ao popular o Postgres novo, não precisam dos GRANTs do PostgREST (era requisito Supabase). Conexão Node usa role único com permissões totais ao schema.
- **Triggers**: `check_appointment_overlap`, `handle_new_user` e `set_updated_at` devem ser recriados.
- **Realtime**: rever todos os usos de `supabase.channel().on('postgres_changes', ...)` — atualmente em `Atendimento.tsx` (mensagens novas) e `Leads.tsx` (Kanban). Substituir por Socket.IO emitindo após inserts/updates.
- **Auth users → Profiles**: ao migrar usuários, gerar nova senha temporária e enviar reset por e-mail. `user_id` deve ser remapeado em TODAS as FKs.
- **Edge Functions com `verify_jwt = false`** (webhooks): no novo backend, validar assinatura HMAC com `webhook_secret` próprio em vez de confiar em JWT ausente.
- **OpenAI tools**: o schema das tools (`get_practice_areas`, `create_appointment`, etc.) deve ser portado fielmente — está em `supabase/functions/ai-agent-reply/index.ts`.
- **TipTap → DOCX**: lógica em `src/lib/html-to-docx.ts` pode permanecer no frontend, mas para envio direto por WhatsApp/email, mover para backend.
- **CNJ DataJud**: API pública mas com limite — cachear agressivamente e respeitar `last_cnj_sync_at`.

---

## 12. Comandos Úteis para Migração

```bash
# Dump do Supabase (todas as tabelas + dados)
pg_dump "$SUPABASE_DB_URL" \
  --schema=public \
  --no-owner --no-acl \
  --format=custom \
  -f lindomberto.dump

# Restore no Postgres do Portainer
pg_restore -d "$NEW_DATABASE_URL" --no-owner --no-acl lindomberto.dump

# Gerar Prisma schema a partir do banco
npx prisma db pull

# Copiar buckets Supabase → MinIO
rclone copy supabase:contracts minio:lindomberto-contracts --progress
```

---

## 13. Resumo Executivo

- **42 tabelas** no Postgres, organizadas em 12 domínios (auth, site, CMS, leads, clientes, contratos, financeiro, documentos, WhatsApp, Kanban, agenda, IA, campanhas)
- **12 funções de segurança** SECURITY DEFINER
- **12 Edge Functions** (webhooks, workers, integrações externas)
- **5 storage buckets** (2 privados)
- **~30 telas** no painel admin + 7 rotas públicas
- **3 integrações externas**: Evolution (WhatsApp), OpenAI (IA), DataJud CNJ + Brevo (email)
- **Realtime** crítico em 2 telas (Atendimento, Kanban Leads)

Este documento é suficiente para reconstruir o sistema do zero em Node.js + React + Postgres mantendo paridade funcional total.
