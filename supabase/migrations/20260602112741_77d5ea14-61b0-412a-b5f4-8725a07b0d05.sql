
-- Pagamentos de parcelas (entry + custom_installments)
CREATE TABLE public.installment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  installment_key text NOT NULL, -- 'entry' ou '1','2',... (índice em custom_installments)
  amount numeric(14,2) NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  payment_method text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_installment_payments_contract ON public.installment_payments(contract_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_payments TO authenticated;
GRANT ALL ON public.installment_payments TO service_role;
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read installment_payments" ON public.installment_payments
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert installment_payments" ON public.installment_payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage installment_payments" ON public.installment_payments
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Renegociações de honorários (histórico)
CREATE TABLE public.installment_renegotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  previous_fees jsonb NOT NULL,
  new_fees jsonb NOT NULL,
  total_paid_before numeric(14,2) NOT NULL DEFAULT 0,
  remaining_debt numeric(14,2) NOT NULL DEFAULT 0,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_installment_renegotiations_contract ON public.installment_renegotiations(contract_id);

GRANT SELECT, INSERT ON public.installment_renegotiations TO authenticated;
GRANT ALL ON public.installment_renegotiations TO service_role;
ALTER TABLE public.installment_renegotiations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read renegotiations" ON public.installment_renegotiations
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert renegotiations" ON public.installment_renegotiations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage renegotiations" ON public.installment_renegotiations
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Recibos emitidos
CREATE TABLE public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.installment_payments(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.document_templates(id) ON DELETE SET NULL,
  installment_key text,
  amount numeric(14,2),
  file_url text,
  file_name text,
  sent_at timestamptz,
  sent_via text, -- 'whatsapp' | 'manual'
  sender_user_id uuid,
  sender_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_receipts_contract ON public.payment_receipts(contract_id);

GRANT SELECT, INSERT, UPDATE ON public.payment_receipts TO authenticated;
GRANT ALL ON public.payment_receipts TO service_role;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read receipts" ON public.payment_receipts
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert receipts" ON public.payment_receipts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update own receipts" ON public.payment_receipts
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage receipts" ON public.payment_receipts
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Garantir tipo "Recibo" no catálogo de modelos de documentos
INSERT INTO public.document_template_types (name, sort_order, active)
SELECT 'Recibo', 100, true
WHERE NOT EXISTS (SELECT 1 FROM public.document_template_types WHERE name = 'Recibo');
