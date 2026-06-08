
-- 1) Tabela de andamentos
CREATE TABLE IF NOT EXISTS public.process_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  movement_date TIMESTAMPTZ,
  code TEXT,
  name TEXT NOT NULL,
  complement TEXT,
  court_unit TEXT,
  source TEXT DEFAULT 'datajud',
  raw JSONB DEFAULT '{}'::jsonb,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contract_id, fingerprint)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_movements TO authenticated;
GRANT ALL ON public.process_movements TO service_role;

ALTER TABLE public.process_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and team can view movements"
  ON public.process_movements FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_team_member(auth.uid()));

CREATE POLICY "Admins manage movements"
  ON public.process_movements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_process_movements_contract ON public.process_movements(contract_id, movement_date DESC);

-- 2) Contracts: colunas auxiliares
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS last_cnj_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS process_parties JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) Acks de notas de transferência (controla banner)
CREATE TABLE IF NOT EXISTS public.whatsapp_transfer_acks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.whatsapp_conversation_transfers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  acked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transfer_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_transfer_acks TO authenticated;
GRANT ALL ON public.whatsapp_transfer_acks TO service_role;

ALTER TABLE public.whatsapp_transfer_acks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User manages own transfer acks"
  ON public.whatsapp_transfer_acks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) ai_agents: adicionar opção de advogado preferencial para agendamento
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS scheduling_attorney_id UUID;
