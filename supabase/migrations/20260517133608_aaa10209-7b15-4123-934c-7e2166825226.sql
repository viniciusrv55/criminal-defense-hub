
-- ============ AGENDA ============

CREATE TABLE public.appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  color text NOT NULL DEFAULT '#d1a967',
  default_location text,
  requires_attorney boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage appointment_types" ON public.appointment_types FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Authenticated read appointment_types" ON public.appointment_types FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE TRIGGER set_updated_at_appointment_types BEFORE UPDATE ON public.appointment_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  appointment_type_id uuid,
  practice_area_id uuid,
  lead_id uuid,
  client_id uuid,
  contract_id uuid,
  conversation_id uuid,
  attorney_id uuid,
  attendees uuid[] NOT NULL DEFAULT '{}',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  location text,
  meeting_url text,
  status text NOT NULL DEFAULT 'scheduled',
  reminder_sent_at timestamptz,
  confirmation_sent_at timestamptz,
  created_by uuid,
  created_via text NOT NULL DEFAULT 'admin',
  notes text,
  external_calendar_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointments_starts_at ON public.appointments(starts_at);
CREATE INDEX idx_appointments_attorney ON public.appointments(attorney_id, starts_at);
CREATE INDEX idx_appointments_lead ON public.appointments(lead_id);
CREATE INDEX idx_appointments_conversation ON public.appointments(conversation_id);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_appointment(_user_id uuid, _appt_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.appointments a
    LEFT JOIN public.team_members tm ON tm.user_id = _user_id
    WHERE a.id = _appt_id
      AND (a.attorney_id = tm.id OR tm.id = ANY(a.attendees) OR a.created_by = _user_id)
  );
$$;

CREATE POLICY "Admins manage appointments" ON public.appointments FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Members read appointments" ON public.appointments FOR SELECT USING (can_access_appointment(auth.uid(), id));
CREATE POLICY "Members insert appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Members update own appointments" ON public.appointments FOR UPDATE USING (can_access_appointment(auth.uid(), id));
CREATE POLICY "Clients read own appointments" ON public.appointments FOR SELECT USING (
  EXISTS (SELECT 1 FROM client_portal_access cpa WHERE cpa.client_id = appointments.client_id AND cpa.user_id = auth.uid() AND cpa.active)
);
CREATE TRIGGER set_updated_at_appointments BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.appointment_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.appointment_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage availability" ON public.appointment_availability FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Authenticated read availability" ON public.appointment_availability FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Members manage own availability" ON public.appointment_availability FOR ALL USING (
  EXISTS (SELECT 1 FROM team_members tm WHERE tm.id = appointment_availability.team_member_id AND tm.user_id = auth.uid())
);
CREATE TRIGGER set_updated_at_avail BEFORE UPDATE ON public.appointment_availability FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.appointment_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.appointment_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage blocks" ON public.appointment_blocks FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Authenticated read blocks" ON public.appointment_blocks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE TRIGGER set_updated_at_blocks BEFORE UPDATE ON public.appointment_blocks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;

-- ============ STORAGE WHATSAPP MEDIA ============
INSERT INTO storage.buckets (id, name, public) VALUES ('whatsapp-media', 'whatsapp-media', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins manage whatsapp-media" ON storage.objects FOR ALL
  USING (bucket_id = 'whatsapp-media' AND is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'whatsapp-media' AND is_admin(auth.uid()));

CREATE POLICY "Authenticated read whatsapp-media" ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated upload whatsapp-media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'whatsapp-media' AND auth.uid() IS NOT NULL);

-- Seed appointment types
INSERT INTO public.appointment_types (name, duration_minutes, color, sort_order) VALUES
  ('Consulta inicial', 30, '#d1a967', 1),
  ('Reunião contrato', 60, '#0d7a5f', 2),
  ('Audiência', 90, '#9b4423', 3);
