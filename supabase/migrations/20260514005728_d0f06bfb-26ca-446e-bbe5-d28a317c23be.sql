-- =========================================
-- Fase 1: Funda\u00e7\u00e3o WhatsApp / Atendimento
-- =========================================

-- 1) platform_settings (super_admin only)
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage platform_settings"
  ON public.platform_settings
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_platform_settings_updated
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: chaves esperadas (vazias)
INSERT INTO public.platform_settings (key, description) VALUES
  ('evolution_api_url',  'URL base da Evolution API (ex: https://evo.zapmaxx.com.br)'),
  ('evolution_api_key',  'API Key global da Evolution API'),
  ('openai_api_key',     'Chave da OpenAI (usada pelos agentes de IA)'),
  ('brevo_api_key',      'Chave Brevo (envio de e-mails transacionais)')
ON CONFLICT (key) DO NOTHING;

-- 2) whatsapp_instances
CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  instance_name text NOT NULL UNIQUE, -- nome da instance na Evolution
  phone_number text,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'disconnected', -- connected | disconnected | connecting | qr
  qr_code text,
  last_connected_at timestamptz,
  webhook_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage whatsapp_instances"
  ON public.whatsapp_instances
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read whatsapp_instances"
  ON public.whatsapp_instances
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_whatsapp_instances_updated
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_whatsapp_instances_team_member ON public.whatsapp_instances(team_member_id);
CREATE INDEX idx_whatsapp_instances_status ON public.whatsapp_instances(status);

-- 3) whatsapp_webhook_logs (debug / auditoria)
CREATE TABLE public.whatsapp_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text,
  event_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read webhook logs"
  ON public.whatsapp_webhook_logs
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage webhook logs"
  ON public.whatsapp_webhook_logs
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_webhook_logs_instance ON public.whatsapp_webhook_logs(instance_name);
CREATE INDEX idx_webhook_logs_created ON public.whatsapp_webhook_logs(created_at DESC);
