
-- =====================================================
-- FASE 5 — CAMPANHAS
-- =====================================================

CREATE TABLE public.audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  source text NOT NULL DEFAULT 'manual', -- 'leads'|'clients'|'contacts'|'manual'
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  member_count integer NOT NULL DEFAULT 0,
  legal_basis text, -- 'opt_in'|'legitimate_interest'|'contract'
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audience_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id uuid NOT NULL REFERENCES public.audiences(id) ON DELETE CASCADE,
  lead_id uuid,
  client_id uuid,
  name text,
  phone text,
  email text,
  vars jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audience_members_audience ON public.audience_members(audience_id);
CREATE INDEX idx_audience_members_phone ON public.audience_members(phone);
CREATE INDEX idx_audience_members_email ON public.audience_members(email);

CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp', -- 'whatsapp'|'email'|'both'
  category text,
  subject text,
  body text NOT NULL DEFAULT '',
  media_url text,
  media_mime text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp', -- 'whatsapp'|'email'
  audience_id uuid REFERENCES public.audiences(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  whatsapp_instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  from_email text,
  from_name text,
  reply_to text,
  subject_override text,
  body_override text,
  media_url text,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft', -- draft|scheduled|running|paused|completed|failed
  throttle_per_minute integer NOT NULL DEFAULT 10,
  jitter_seconds integer NOT NULL DEFAULT 5,
  started_at timestamptz,
  finished_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_scheduled ON public.campaigns(scheduled_at);

CREATE TABLE public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  audience_member_id uuid REFERENCES public.audience_members(id) ON DELETE SET NULL,
  name text,
  phone text,
  email text,
  vars jsonb NOT NULL DEFAULT '{}'::jsonb,
  personalized_subject text,
  personalized_body text,
  status text NOT NULL DEFAULT 'pending', -- pending|sending|sent|delivered|read|failed|unsubscribed|bounced
  provider_message_id text,
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  opens integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_recipients_campaign_status ON public.campaign_recipients(campaign_id, status);
CREATE INDEX idx_campaign_recipients_provider_msg ON public.campaign_recipients(provider_message_id);

CREATE TABLE public.unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text,
  email text,
  channel text NOT NULL DEFAULT 'whatsapp', -- 'whatsapp'|'email'|'all'
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_unsubscribes_phone ON public.unsubscribes(phone);
CREATE INDEX idx_unsubscribes_email ON public.unsubscribes(email);

-- Triggers updated_at
CREATE TRIGGER trg_audiences_updated BEFORE UPDATE ON public.audiences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage audiences" ON public.audiences FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Auth read audiences" ON public.audiences FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage audience_members" ON public.audience_members FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Auth read audience_members" ON public.audience_members FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage templates" ON public.message_templates FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Auth read templates" ON public.message_templates FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage campaigns" ON public.campaigns FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Auth read campaigns" ON public.campaigns FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage recipients" ON public.campaign_recipients FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Auth read recipients" ON public.campaign_recipients FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage unsubscribes" ON public.unsubscribes FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Auth read unsubscribes" ON public.unsubscribes FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- Helper: is_unsubscribed
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_unsubscribed(_phone text, _email text, _channel text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unsubscribes
    WHERE (channel = _channel OR channel = 'all')
      AND ((_phone IS NOT NULL AND phone = _phone) OR (_email IS NOT NULL AND email = _email))
  );
$$;

-- =====================================================
-- FASE 4 — Validação de overlap de agendamentos
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.attorney_id IS NULL OR NEW.status IN ('cancelled','no_show') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.attorney_id = NEW.attorney_id
      AND a.id <> NEW.id
      AND a.status NOT IN ('cancelled','no_show')
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Conflito de horário: o advogado já tem compromisso neste intervalo' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_appointment_overlap
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.check_appointment_overlap();
