## Fase 1 — Fundação: Superadmin, Evolution API e conexão WhatsApp

Objetivo: criar a base para o módulo de atendimento sem encostar em nada do que já existe (CRM, leads, contratos, blog, site público continuam intocados).

### O que será entregue nesta fase

1. **Painel Superadmin** (`/admin/plataforma`) — visível **só** para `super_admin`
   - Campo: URL da Evolution API (ex: `https://evo.zapmaxx.com.br`)
   - Campo: API Key global da Evolution
   - Campo: Chave OpenAI (será usada na Fase 3)
   - Campo: Chave Brevo (será usada na Fase 5)
   - Botão "Testar conexão Evolution"
   - Admin comum NÃO vê esta tela.

2. **Conectar números de WhatsApp** (`/admin/whatsapp`) — admin e super_admin
   - Listar instâncias conectadas
   - Botão "Conectar novo número" → mostra QR code da Evolution
   - Status: conectado / desconectado / aguardando QR
   - Botão desconectar / reconectar
   - Cada instância pode ser ligada a um team_member (advogado dono) ou ficar como "geral".

3. **Edge Functions**
   - `evolution-api` — proxy autenticado que repassa chamadas pra Evolution usando as credenciais salvas no Superadmin (cria instância, gera QR, manda mensagem, etc.)
   - `evolution-webhook` — recebe eventos da Evolution (mensagens recebidas, status de conexão). Por enquanto só salva log; a lógica de conversa entra na Fase 2.

4. **Tabelas novas** (não mexem em nenhuma existente):
   - `platform_settings` — chave/valor criptografado, RLS apenas super_admin
   - `whatsapp_instances` — id, nome, instance_name (Evolution), team_member_id (opcional), status, qr_code, phone_number
   - `whatsapp_webhook_logs` — log bruto dos eventos recebidos (debug + auditoria)

5. **Menu admin**
   - Novo grupo "Atendimento" no sidebar com item "WhatsApp"
   - Item "Plataforma" só aparece para super_admin

### O que NÃO entra na Fase 1

- Chat em tempo real (Fase 2)
- Filas, conversas, transferência (Fase 2)
- Agentes de IA (Fase 3)
- Agenda / agendamentos (Fase 4)
- Brevo / e-mails / broadcast (Fase 5)

### Riscos e mitigação

- **Risco de quebrar o site atual:** zero — só criamos tabelas e rotas novas. Nenhum schema existente é alterado.
- **Risco de credenciais expostas:** chaves ficam em `platform_settings` com RLS restritiva (só super_admin lê pelo SQL; o frontend nunca recebe a chave bruta — quem usa é a edge function via service role).
- **Risco de Evolution offline:** o painel mostra erro claro; nada do CRM depende disso.

### Detalhes técnicos

- Tabela `platform_settings` segue o padrão `site_settings` (key/value), mas com RLS exclusiva para super_admin.
- Edge function `evolution-api` lê as credenciais via service role e nunca devolve a chave pro frontend.
- Webhook URL da Evolution apontará para `https://fskstajvuoviicfjfcai.supabase.co/functions/v1/evolution-webhook`.
- Tipos TypeScript regenerados automaticamente após a migration.

### Aprovação

Se aprovar, eu:
1. Crio a migration (você confirma).
2. Crio as edge functions e as páginas admin.
3. Te entrego pronto pra testar: cadastrar URL+key da Evolution, conectar um número via QR, e confirmar que o webhook chega.

Só depois que isso estiver funcionando, abrimos a Fase 2 (chat em tempo real, conversas, filas).
