
ALTER TABLE public.ai_agents
  DROP COLUMN IF EXISTS handoff_keywords,
  DROP COLUMN IF EXISTS handoff_after_messages,
  DROP COLUMN IF EXISTS business_hours;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_client_id ON public.leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_wa_conv_id ON public.leads(whatsapp_conversation_id);
