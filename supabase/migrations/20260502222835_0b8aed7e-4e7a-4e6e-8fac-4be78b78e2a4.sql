
-- 1. Clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type TEXT NOT NULL DEFAULT 'pf' CHECK (person_type IN ('pf', 'pj')),
  full_name TEXT NOT NULL,
  social_name TEXT,
  nationality TEXT,
  profession TEXT,
  education TEXT,
  marital_status TEXT,
  birth_date DATE,
  cpf TEXT,
  rg TEXT,
  pis TEXT,
  cnpj TEXT,
  trade_name TEXT,
  state_registration TEXT,
  emails JSONB NOT NULL DEFAULT '[]',
  phones JSONB NOT NULL DEFAULT '[]',
  cep TEXT,
  state TEXT,
  city TEXT,
  neighborhood TEXT,
  address TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  father_name TEXT,
  mother_name TEXT,
  notes TEXT,
  group_name TEXT,
  profile_type TEXT,
  lead_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage clients" ON public.clients FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Team members read clients" ON public.clients FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Team members create clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Team members update own clients" ON public.clients FOR UPDATE USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- 2. Contracts
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_number TEXT,
  practice_area_id UUID,
  attorney_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'concluded', 'cancelled')),

  -- Processo
  process_type TEXT DEFAULT 'judicial' CHECK (process_type IN ('judicial', 'administrative')),
  process_data JSONB NOT NULL DEFAULT '{}',

  -- Dados adicionais
  additional_data JSONB NOT NULL DEFAULT '{}',

  -- Parte adversa
  adverse_party JSONB NOT NULL DEFAULT '{}',

  -- Honorários
  fees JSONB NOT NULL DEFAULT '{}',

  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage contracts" ON public.contracts FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Team members read contracts" ON public.contracts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Team members create contracts" ON public.contracts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Team members update own contracts" ON public.contracts FOR UPDATE USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- 3. Contract documents
CREATE TABLE IF NOT EXISTS public.contract_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  template_name TEXT,
  copies INTEGER NOT NULL DEFAULT 1,
  file_url TEXT,
  file_name TEXT,
  generated_html TEXT,
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contract docs" ON public.contract_documents FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated read contract docs" ON public.contract_documents FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert contract docs" ON public.contract_documents FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Contract history
CREATE TABLE IF NOT EXISTS public.contract_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT,
  performed_by UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contract history" ON public.contract_history FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated read contract history" ON public.contract_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert contract history" ON public.contract_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Client portal access
CREATE TABLE IF NOT EXISTS public.client_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE,
  username TEXT,
  nickname TEXT,
  birthday_day INTEGER,
  birthday_month INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage portal access" ON public.client_portal_access FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Clients read own portal access" ON public.client_portal_access FOR SELECT USING (user_id = auth.uid());

-- 6. Add 'client' role
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Helper: client policy on contracts (read own)
CREATE POLICY "Clients read own contracts" ON public.contracts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_access cpa
    WHERE cpa.client_id = contracts.client_id AND cpa.user_id = auth.uid() AND cpa.active = true
  )
);

CREATE POLICY "Clients read own data" ON public.clients FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_access cpa
    WHERE cpa.client_id = clients.id AND cpa.user_id = auth.uid() AND cpa.active = true
  )
);

CREATE POLICY "Clients read own contract docs" ON public.contract_documents FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.client_portal_access cpa ON cpa.client_id = c.client_id
    WHERE c.id = contract_documents.contract_id AND cpa.user_id = auth.uid() AND cpa.active = true
  )
);

CREATE POLICY "Clients read own contract history" ON public.contract_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.client_portal_access cpa ON cpa.client_id = c.client_id
    WHERE c.id = contract_history.contract_id AND cpa.user_id = auth.uid() AND cpa.active = true
  )
);

-- 8. Storage bucket for contracts
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins manage contract files" ON storage.objects FOR ALL
USING (bucket_id = 'contracts' AND public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read contract files" ON storage.objects FOR SELECT
USING (bucket_id = 'contracts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated upload contract files" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contracts' AND auth.uid() IS NOT NULL);

-- 9. Triggers for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS clients_updated_at ON public.clients;
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS contracts_updated_at ON public.contracts;
CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS portal_access_updated_at ON public.client_portal_access;
CREATE TRIGGER portal_access_updated_at BEFORE UPDATE ON public.client_portal_access FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON public.clients(cpf);
CREATE INDEX IF NOT EXISTS idx_clients_cnpj ON public.clients(cnpj);
CREATE INDEX IF NOT EXISTS idx_clients_full_name ON public.clients(full_name);
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON public.contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
