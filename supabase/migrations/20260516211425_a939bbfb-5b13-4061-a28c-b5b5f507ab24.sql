
-- Agents (1 per queue)
CREATE TABLE public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL UNIQUE REFERENCES public.whatsapp_queues(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  temperature numeric NOT NULL DEFAULT 0.4,
  max_tokens int NOT NULL DEFAULT 800,
  system_prompt text NOT NULL DEFAULT '',
  greeting_message text,
  handoff_keywords text[] NOT NULL DEFAULT ARRAY['atendente','humano','advogado','pessoa']::text[],
  handoff_after_messages int,
  business_hours jsonb,
  tools_enabled text[] NOT NULL DEFAULT ARRAY['get_practice_areas','create_lead','request_human_handoff']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ai_agents" ON public.ai_agents FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Authenticated read ai_agents" ON public.ai_agents FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_ai_agents_updated BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Knowledge base
CREATE TABLE public.ai_agent_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_knowledge_agent ON public.ai_agent_knowledge(agent_id, sort_order);
ALTER TABLE public.ai_agent_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage knowledge" ON public.ai_agent_knowledge FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Authenticated read knowledge" ON public.ai_agent_knowledge FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_ai_knowledge_updated BEFORE UPDATE ON public.ai_agent_knowledge FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Runs (audit)
CREATE TABLE public.ai_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  inbound_message_id uuid,
  outbound_message_id uuid,
  model text,
  prompt_tokens int,
  completion_tokens int,
  latency_ms int,
  tool_calls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'ok',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_runs_conv ON public.ai_agent_runs(conversation_id, created_at DESC);
CREATE INDEX idx_ai_runs_agent ON public.ai_agent_runs(agent_id, created_at DESC);
ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage runs" ON public.ai_agent_runs FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Members read runs" ON public.ai_agent_runs FOR SELECT USING (
  is_admin(auth.uid()) OR (conversation_id IS NOT NULL AND can_access_conversation(auth.uid(), conversation_id))
);

-- Conversation flags
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN ai_paused_at timestamptz,
  ADD COLUMN ai_handoff_reason text;

-- Realtime
ALTER TABLE public.ai_agents REPLICA IDENTITY FULL;
ALTER TABLE public.ai_agent_knowledge REPLICA IDENTITY FULL;
ALTER TABLE public.ai_agent_runs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agent_knowledge;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agent_runs;
