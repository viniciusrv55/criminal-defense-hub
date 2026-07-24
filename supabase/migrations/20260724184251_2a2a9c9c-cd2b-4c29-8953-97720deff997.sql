
-- =========================================================
-- FULL SCHEMA MIGRATION (Lindomberto Moraes)
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin','admin','attorney','team_member','client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- Helper: updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================================
-- Roles & Profiles
-- =========================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text, avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('super_admin','admin'))
$$;

CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- Public-facing content
-- =========================================================
CREATE TABLE public.practice_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, description text,
  icon_name text, icon_svg text, icon_color text DEFAULT '#d1a967',
  sort_order integer DEFAULT 0, active boolean DEFAULT true,
  slug text, subtitle text, cover_image_url text, content text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  featured boolean NOT NULL DEFAULT false,
  whatsapp_message text,
  cta_button_text text DEFAULT 'Solicitar Atendimento via WhatsApp',
  youtube_url text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.practice_areas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_areas TO authenticated;
GRANT ALL ON public.practice_areas TO service_role;
ALTER TABLE public.practice_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read areas" ON public.practice_areas FOR SELECT USING (true);
CREATE POLICY "admins manage areas" ON public.practice_areas FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, slug text NOT NULL UNIQUE,
  excerpt text, content text, featured_image_url text,
  category text, meta_description text,
  published boolean DEFAULT false, author_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published posts" ON public.blog_posts FOR SELECT USING (published = true);
CREATE POLICY "auth read all posts" ON public.blog_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage posts" ON public.blog_posts FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.blog_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  image_url text NOT NULL, caption text, sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.blog_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_images TO authenticated;
GRANT ALL ON public.blog_images TO service_role;
ALTER TABLE public.blog_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read blog images" ON public.blog_images FOR SELECT USING (true);
CREATE POLICY "admins manage blog images" ON public.blog_images FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE, value text,
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "admins manage settings" ON public.site_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.featured_attorneys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL, specialty text, oab_number text, photo_url text,
  sort_order integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.featured_attorneys TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.featured_attorneys TO authenticated;
GRANT ALL ON public.featured_attorneys TO service_role;
ALTER TABLE public.featured_attorneys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read featured" ON public.featured_attorneys FOR SELECT USING (true);
CREATE POLICY "admins manage featured" ON public.featured_attorneys FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- Team & Kanban
-- =========================================================
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL, role_title text, specialty text,
  phone text, email text, avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read team" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "admins manage team" ON public.team_members FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE, label text NOT NULL,
  color text DEFAULT 'border-accent',
  sort_order integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kanban_columns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_columns TO authenticated;
GRANT ALL ON public.kanban_columns TO service_role;
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read columns" ON public.kanban_columns FOR SELECT USING (true);
CREATE POLICY "admins manage columns" ON public.kanban_columns FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.kanban_stage_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  can_act boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_stage_permissions TO authenticated;
GRANT ALL ON public.kanban_stage_permissions TO service_role;
ALTER TABLE public.kanban_stage_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read kanban perms" ON public.kanban_stage_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage kanban perms" ON public.kanban_stage_permissions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.kanban_stage_queue_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL UNIQUE,
  queue_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_stage_queue_map TO authenticated;
GRANT ALL ON public.kanban_stage_queue_map TO service_role;
ALTER TABLE public.kanban_stage_queue_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read map" ON public.kanban_stage_queue_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage map" ON public.kanban_stage_queue_map FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.attorney_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view boolean DEFAULT true, can_create boolean DEFAULT false, can_delete boolean DEFAULT false,
  practice_area_ids uuid[] DEFAULT '{}'::uuid[],
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attorney_permissions TO authenticated;
GRANT ALL ON public.attorney_permissions TO service_role;
ALTER TABLE public.attorney_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read attorney perms" ON public.attorney_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage attorney perms" ON public.attorney_permissions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- Client groups, comarcas, varas
-- =========================================================
CREATE TABLE public.client_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, practice_area_id uuid REFERENCES public.practice_areas(id),
  parent_id uuid REFERENCES public.client_groups(id),
  active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_groups TO authenticated;
GRANT ALL ON public.client_groups TO service_role;
ALTER TABLE public.client_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all groups" ON public.client_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.comarcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, state text, active boolean NOT NULL DEFAULT true, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comarcas TO authenticated;
GRANT ALL ON public.comarcas TO service_role;
ALTER TABLE public.comarcas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all comarcas" ON public.comarcas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.varas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comarca_id uuid NOT NULL REFERENCES public.comarcas(id) ON DELETE CASCADE,
  vara_number text NOT NULL, location text, active boolean NOT NULL DEFAULT true, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.varas TO authenticated;
GRANT ALL ON public.varas TO service_role;
ALTER TABLE public.varas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all varas" ON public.varas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- Clients
-- =========================================================
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type text NOT NULL DEFAULT 'pf' CHECK (person_type IN ('pf','pj')),
  full_name text NOT NULL, social_name text, nationality text,
  profession text, education text, marital_status text, birth_date date,
  cpf text, rg text, pis text, cnpj text, trade_name text, state_registration text,
  emails jsonb NOT NULL DEFAULT '[]'::jsonb, phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  cep text, state text, city text, neighborhood text, address text,
  contact_name text, contact_phone text, father_name text, mother_name text,
  notes text, group_name text, profile_type text, lead_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  group_id uuid REFERENCES public.client_groups(id),
  assigned_attorney_id uuid REFERENCES public.team_members(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all clients" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- Leads
-- =========================================================
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, email text, phone text,
  practice_area_id uuid REFERENCES public.practice_areas(id),
  message text, status text NOT NULL DEFAULT 'new',
  assigned_attorney_id uuid REFERENCES auth.users(id),
  kanban_status text DEFAULT 'new',
  responsible_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  client_id uuid REFERENCES public.clients(id),
  whatsapp_conversation_id uuid,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT ON public.leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "auth all leads" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.lead_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  action text NOT NULL, description text,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_history TO authenticated;
GRANT ALL ON public.lead_history TO service_role;
ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all lead history" ON public.lead_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- Contracts
-- =========================================================
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  contract_number text, practice_area_id uuid, attorney_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','concluded','cancelled')),
  process_type text DEFAULT 'judicial' CHECK (process_type IN ('judicial','administrative')),
  process_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  additional_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  adverse_party jsonb NOT NULL DEFAULT '{}'::jsonb,
  fees jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text, created_by uuid,
  group_id uuid REFERENCES public.client_groups(id),
  comarca_id uuid REFERENCES public.comarcas(id),
  vara_id uuid REFERENCES public.varas(id),
  party_type text,
  last_cnj_sync_at timestamptz,
  process_parties jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at timestamptz, archived_by uuid,
  process_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all contracts" ON public.contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  document_type text NOT NULL, template_name text,
  copies integer NOT NULL DEFAULT 1, file_url text, file_name text,
  generated_html text, generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_documents TO authenticated;
GRANT ALL ON public.contract_documents TO service_role;
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all contract docs" ON public.contract_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.contract_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  action text NOT NULL, description text, performed_by uuid, metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_history TO authenticated;
GRANT ALL ON public.contract_history TO service_role;
ALTER TABLE public.contract_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all contract hist" ON public.contract_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- Financial
-- =========================================================
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all pmt methods" ON public.payment_methods FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.installment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  installment_key text NOT NULL, amount numeric NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  payment_method text, notes text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_payments TO authenticated;
GRANT ALL ON public.installment_payments TO service_role;
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all payments" ON public.installment_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.installment_renegotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  previous_fees jsonb NOT NULL, new_fees jsonb NOT NULL,
  total_paid_before numeric NOT NULL DEFAULT 0, remaining_debt numeric NOT NULL DEFAULT 0,
  reason text, created_by uuid, payment_key_map jsonb, reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_renegotiations TO authenticated;
GRANT ALL ON public.installment_renegotiations TO service_role;
ALTER TABLE public.installment_renegotiations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all reneg" ON public.installment_renegotiations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- Document templates
-- =========================================================
CREATE TABLE public.document_template_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_template_types TO authenticated;
GRANT ALL ON public.document_template_types TO service_role;
ALTER TABLE public.document_template_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all tpl types" ON public.document_template_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL REFERENCES public.document_template_types(id),
  title text NOT NULL, content_html text NOT NULL DEFAULT '',
  doc_date date, owner_id uuid NOT NULL,
  assigned_team_member_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  active boolean NOT NULL DEFAULT true, created_by uuid,
  is_general boolean NOT NULL DEFAULT false,
  logo_url text, header_image_url text, footer_image_url text, background_image_url text,
  letterhead_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all doc templates" ON public.document_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.installment_payments(id),
  template_id uuid REFERENCES public.document_templates(id),
  installment_key text, amount numeric,
  file_url text, file_name text,
  sent_at timestamptz, sent_via text,
  sender_user_id uuid, sender_name text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_receipts TO authenticated;
GRANT ALL ON public.payment_receipts TO service_role;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all receipts" ON public.payment_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- Client portal
-- =========================================================
CREATE TABLE public.client_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  username text, nickname text,
  birthday_day integer, birthday_month integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_access TO authenticated;
GRANT ALL ON public.client_portal_access TO service_role;
ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all portal" ON public.client_portal_access FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- Platform settings
-- =========================================================
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE, value text, description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read platform" ON public.platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage platform" ON public.platform_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- WhatsApp
-- =========================================================
CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, instance_name text NOT NULL UNIQUE,
  phone_number text, team_member_id uuid REFERENCES public.team_members(id),
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text, last_connected_at timestamptz, webhook_secret text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all wa inst" ON public.whatsapp_instances FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.whatsapp_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text, event_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false, error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_webhook_logs TO authenticated;
GRANT ALL ON public.whatsapp_webhook_logs TO service_role;
ALTER TABLE public.whatsapp_webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all wa logs" ON public.whatsapp_webhook_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.whatsapp_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, team_member_id uuid REFERENCES public.team_members(id),
  color text DEFAULT '#d1a967', sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_queues TO authenticated;
GRANT ALL ON public.whatsapp_queues TO service_role;
ALTER TABLE public.whatsapp_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all queues" ON public.whatsapp_queues FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.whatsapp_queue_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.whatsapp_queues(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_queue_members TO authenticated;
GRANT ALL ON public.whatsapp_queue_members TO service_role;
ALTER TABLE public.whatsapp_queue_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all queue mem" ON public.whatsapp_queue_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id),
  contact_phone text NOT NULL, contact_name text, contact_avatar_url text,
  lead_id uuid, client_id uuid,
  current_queue_id uuid REFERENCES public.whatsapp_queues(id),
  assigned_team_member_id uuid REFERENCES public.team_members(id),
  status text NOT NULL DEFAULT 'open',
  last_message_at timestamptz, last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0,
  ai_enabled boolean NOT NULL DEFAULT true, ai_paused_at timestamptz, ai_handoff_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all conv" ON public.whatsapp_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.leads ADD CONSTRAINT leads_conv_fkey FOREIGN KEY (whatsapp_conversation_id) REFERENCES public.whatsapp_conversations(id);

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  evolution_message_id text UNIQUE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_phone text, to_phone text,
  message_type text NOT NULL DEFAULT 'text',
  content text, media_url text, media_mime text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_by_user_id uuid, status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all msg" ON public.whatsapp_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.whatsapp_conversation_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  from_queue_id uuid, to_queue_id uuid, from_user_id uuid, to_user_id uuid, note text,
  transferred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversation_transfers TO authenticated;
GRANT ALL ON public.whatsapp_conversation_transfers TO service_role;
ALTER TABLE public.whatsapp_conversation_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all transfers" ON public.whatsapp_conversation_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.whatsapp_conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL, content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversation_notes TO authenticated;
GRANT ALL ON public.whatsapp_conversation_notes TO service_role;
ALTER TABLE public.whatsapp_conversation_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all conv notes" ON public.whatsapp_conversation_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.whatsapp_transfer_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.whatsapp_conversation_transfers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  acked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_transfer_acks TO authenticated;
GRANT ALL ON public.whatsapp_transfer_acks TO service_role;
ALTER TABLE public.whatsapp_transfer_acks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all acks" ON public.whatsapp_transfer_acks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- AI Agents
-- =========================================================
CREATE TABLE public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL UNIQUE REFERENCES public.whatsapp_queues(id) ON DELETE CASCADE,
  name text NOT NULL, active boolean NOT NULL DEFAULT false,
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  temperature numeric NOT NULL DEFAULT 0.4,
  max_tokens integer NOT NULL DEFAULT 800,
  system_prompt text NOT NULL DEFAULT '',
  greeting_message text,
  tools_enabled text[] NOT NULL DEFAULT ARRAY['get_practice_areas','create_lead','request_human_handoff','list_appointment_types','get_available_slots','create_appointment']::text[],
  scheduling_attorney_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agents TO authenticated;
GRANT ALL ON public.ai_agents TO service_role;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all agents" ON public.ai_agents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ai_agent_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  title text NOT NULL, content text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_knowledge TO authenticated;
GRANT ALL ON public.ai_agent_knowledge TO service_role;
ALTER TABLE public.ai_agent_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all knw" ON public.ai_agent_knowledge FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ai_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  inbound_message_id uuid, outbound_message_id uuid,
  model text, prompt_tokens integer, completion_tokens integer, latency_ms integer,
  tool_calls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'ok', error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_runs TO authenticated;
GRANT ALL ON public.ai_agent_runs TO service_role;
ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all runs" ON public.ai_agent_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- Appointments
-- =========================================================
CREATE TABLE public.appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, duration_minutes integer NOT NULL DEFAULT 30,
  color text NOT NULL DEFAULT '#d1a967', default_location text,
  requires_attorney boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_types TO authenticated;
GRANT ALL ON public.appointment_types TO service_role;
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all appt types" ON public.appointment_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, description text,
  appointment_type_id uuid, practice_area_id uuid,
  lead_id uuid, client_id uuid, contract_id uuid, conversation_id uuid,
  attorney_id uuid, attendees uuid[] NOT NULL DEFAULT '{}'::uuid[],
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  location text, meeting_url text,
  status text NOT NULL DEFAULT 'scheduled',
  reminder_sent_at timestamptz, confirmation_sent_at timestamptz,
  created_by uuid, created_via text NOT NULL DEFAULT 'admin',
  notes text, external_calendar_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all appt" ON public.appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.appointment_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL, end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_availability TO authenticated;
GRANT ALL ON public.appointment_availability TO service_role;
ALTER TABLE public.appointment_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all avail" ON public.appointment_availability FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.appointment_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_blocks TO authenticated;
GRANT ALL ON public.appointment_blocks TO service_role;
ALTER TABLE public.appointment_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all blocks" ON public.appointment_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- Campaigns
-- =========================================================
CREATE TABLE public.audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text,
  source text NOT NULL DEFAULT 'manual',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  member_count integer NOT NULL DEFAULT 0,
  legal_basis text, active boolean NOT NULL DEFAULT true, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audiences TO authenticated;
GRANT ALL ON public.audiences TO service_role;
ALTER TABLE public.audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all audiences" ON public.audiences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.audience_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id uuid NOT NULL REFERENCES public.audiences(id) ON DELETE CASCADE,
  lead_id uuid, client_id uuid,
  name text, phone text, email text,
  vars jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audience_members TO authenticated;
GRANT ALL ON public.audience_members TO service_role;
ALTER TABLE public.audience_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all aud mem" ON public.audience_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, channel text NOT NULL DEFAULT 'whatsapp',
  category text, subject text, body text NOT NULL DEFAULT '',
  media_url text, media_mime text,
  active boolean NOT NULL DEFAULT true, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all msg tpl" ON public.message_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, channel text NOT NULL DEFAULT 'whatsapp',
  audience_id uuid REFERENCES public.audiences(id),
  template_id uuid REFERENCES public.message_templates(id),
  whatsapp_instance_id uuid REFERENCES public.whatsapp_instances(id),
  from_email text, from_name text, reply_to text,
  subject_override text, body_override text, media_url text,
  scheduled_at timestamptz, status text NOT NULL DEFAULT 'draft',
  throttle_per_minute integer NOT NULL DEFAULT 10,
  jitter_seconds integer NOT NULL DEFAULT 5,
  started_at timestamptz, finished_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all campaigns" ON public.campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  audience_member_id uuid REFERENCES public.audience_members(id),
  name text, phone text, email text,
  vars jsonb NOT NULL DEFAULT '{}'::jsonb,
  personalized_subject text, personalized_body text,
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text, error text,
  sent_at timestamptz, delivered_at timestamptz, read_at timestamptz,
  opens integer NOT NULL DEFAULT 0, clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_recipients TO authenticated;
GRANT ALL ON public.campaign_recipients TO service_role;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all recipients" ON public.campaign_recipients FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text, email text, channel text NOT NULL DEFAULT 'whatsapp',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unsubscribes TO authenticated;
GRANT ALL ON public.unsubscribes TO service_role;
ALTER TABLE public.unsubscribes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all unsub" ON public.unsubscribes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- Process movements (DataJud)
-- =========================================================
CREATE TABLE public.process_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  movement_date timestamptz, code text, name text NOT NULL,
  complement text, court_unit text,
  source text DEFAULT 'datajud',
  raw jsonb DEFAULT '{}'::jsonb,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_movements TO authenticated;
GRANT ALL ON public.process_movements TO service_role;
ALTER TABLE public.process_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all proc mov" ON public.process_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- Error logs & Notifications & Client history
-- =========================================================
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, user_email text, user_name text,
  route text, screen text, action text, table_name text,
  error_code text, error_message text, error_details text,
  payload jsonb, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.error_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon insert logs" ON public.error_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "auth insert logs" ON public.error_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admins read logs" ON public.error_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins manage logs" ON public.error_logs FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES public.team_members(id),
  kind text NOT NULL DEFAULT 'info',
  title text NOT NULL, body text, link text,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user read own notif" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user update own notif" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "auth insert notif" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admins manage notif" ON public.notifications FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.client_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT 'atendimento_encerrado',
  summary text,
  attorney_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  practice_area_id uuid REFERENCES public.practice_areas(id),
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_history TO authenticated;
GRANT ALL ON public.client_history TO service_role;
ALTER TABLE public.client_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all client hist" ON public.client_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- updated_at triggers
-- =========================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'set_updated_at_'||t, t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 'set_updated_at_'||t, t);
  END LOOP;
END $$;
