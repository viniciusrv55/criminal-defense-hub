-- ============ client_groups (hierárquico, ligado a practice_areas) ============
CREATE TABLE public.client_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  practice_area_id uuid REFERENCES public.practice_areas(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.client_groups(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_groups_parent ON public.client_groups(parent_id);
CREATE INDEX idx_client_groups_area ON public.client_groups(practice_area_id);

ALTER TABLE public.client_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read client_groups" ON public.client_groups FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert client_groups" ON public.client_groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage client_groups" ON public.client_groups FOR ALL USING (is_admin(auth.uid()));
CREATE TRIGGER trg_client_groups_updated BEFORE UPDATE ON public.client_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ comarcas ============
CREATE TABLE public.comarcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  state text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comarcas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read comarcas" ON public.comarcas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert comarcas" ON public.comarcas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage comarcas" ON public.comarcas FOR ALL USING (is_admin(auth.uid()));
CREATE TRIGGER trg_comarcas_updated BEFORE UPDATE ON public.comarcas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ varas ============
CREATE TABLE public.varas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comarca_id uuid NOT NULL REFERENCES public.comarcas(id) ON DELETE CASCADE,
  vara_number text NOT NULL,
  location text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_varas_comarca ON public.varas(comarca_id);
ALTER TABLE public.varas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read varas" ON public.varas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert varas" ON public.varas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage varas" ON public.varas FOR ALL USING (is_admin(auth.uid()));
CREATE TRIGGER trg_varas_updated BEFORE UPDATE ON public.varas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ payment_methods ============
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read payment_methods" ON public.payment_methods FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert payment_methods" ON public.payment_methods FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage payment_methods" ON public.payment_methods FOR ALL USING (is_admin(auth.uid()));
CREATE TRIGGER trg_pm_updated BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.payment_methods (name, sort_order) VALUES
('PIX', 1), ('Boleto', 2), ('Cartão de Crédito', 3), ('Cartão de Débito', 4),
('Dinheiro', 5), ('Transferência Bancária', 6) ON CONFLICT DO NOTHING;

-- ============ clients: novo group_id ============
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.client_groups(id) ON DELETE SET NULL;

-- ============ contracts: novos campos ============
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.client_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comarca_id uuid REFERENCES public.comarcas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vara_id uuid REFERENCES public.varas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS party_type text;

-- ============ Política extra: contracts readable apenas por advogado responsável + admin (Dados de Segurança) ============
-- Mantemos a policy "Team members read contracts" mas o frontend irá mascarar a aba.
-- Para reforçar no banco, criamos função auxiliar:
CREATE OR REPLACE FUNCTION public.is_contract_attorney(_user_id uuid, _contract_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.team_members tm ON tm.id = c.attorney_id
    WHERE c.id = _contract_id AND tm.user_id = _user_id
  );
$$;