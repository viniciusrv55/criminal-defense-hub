
-- Helper function: check if user is member of a queue (owner or generic admin)
-- We'll create the helper after tables exist.

-- 1) Queues
CREATE TABLE public.whatsapp_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  color text DEFAULT '#d1a967',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage queues" ON public.whatsapp_queues
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Authenticated read queues" ON public.whatsapp_queues
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_whatsapp_queues_updated BEFORE UPDATE ON public.whatsapp_queues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Queue members (extra people that share a queue)
CREATE TABLE public.whatsapp_queue_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.whatsapp_queues(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id, team_member_id)
);
ALTER TABLE public.whatsapp_queue_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage queue members" ON public.whatsapp_queue_members
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Authenticated read queue members" ON public.whatsapp_queue_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3) Conversations
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  contact_name text,
  contact_avatar_url text,
  lead_id uuid,
  client_id uuid,
  current_queue_id uuid REFERENCES public.whatsapp_queues(id) ON DELETE SET NULL,
  assigned_team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, contact_phone)
);
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_wa_conv_queue ON public.whatsapp_conversations(current_queue_id);
CREATE INDEX idx_wa_conv_assigned ON public.whatsapp_conversations(assigned_team_member_id);
CREATE INDEX idx_wa_conv_last_msg ON public.whatsapp_conversations(last_message_at DESC);

CREATE TRIGGER trg_whatsapp_conversations_updated BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: can user access a conversation
CREATE OR REPLACE FUNCTION public.can_access_conversation(_user_id uuid, _conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_conversations c
      LEFT JOIN public.team_members tm ON tm.user_id = _user_id
      LEFT JOIN public.whatsapp_queues q ON q.id = c.current_queue_id
      LEFT JOIN public.whatsapp_queue_members qm ON qm.queue_id = q.id AND qm.team_member_id = tm.id
      WHERE c.id = _conversation_id
        AND (
          c.assigned_team_member_id = tm.id
          OR q.team_member_id = tm.id
          OR qm.id IS NOT NULL
          OR q.team_member_id IS NULL  -- general queue: anyone authenticated team member
        )
    );
$$;

CREATE POLICY "Admins manage conversations" ON public.whatsapp_conversations
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Members read conversations" ON public.whatsapp_conversations
  FOR SELECT USING (can_access_conversation(auth.uid(), id));
CREATE POLICY "Members update conversations" ON public.whatsapp_conversations
  FOR UPDATE USING (can_access_conversation(auth.uid(), id));

-- 4) Messages
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  evolution_message_id text UNIQUE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_phone text,
  to_phone text,
  message_type text NOT NULL DEFAULT 'text',
  content text,
  media_url text,
  media_mime text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_by_user_id uuid,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wa_msg_conv ON public.whatsapp_messages(conversation_id, created_at);

CREATE POLICY "Admins manage messages" ON public.whatsapp_messages
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Members read messages" ON public.whatsapp_messages
  FOR SELECT USING (can_access_conversation(auth.uid(), conversation_id));
CREATE POLICY "Members insert messages" ON public.whatsapp_messages
  FOR INSERT WITH CHECK (can_access_conversation(auth.uid(), conversation_id));

-- 5) Transfers
CREATE TABLE public.whatsapp_conversation_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  from_queue_id uuid,
  to_queue_id uuid,
  from_user_id uuid,
  to_user_id uuid,
  note text,
  transferred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_conversation_transfers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wa_transfers_conv ON public.whatsapp_conversation_transfers(conversation_id, transferred_at);

CREATE POLICY "Admins manage transfers" ON public.whatsapp_conversation_transfers
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Members read transfers" ON public.whatsapp_conversation_transfers
  FOR SELECT USING (can_access_conversation(auth.uid(), conversation_id));
CREATE POLICY "Members insert transfers" ON public.whatsapp_conversation_transfers
  FOR INSERT WITH CHECK (can_access_conversation(auth.uid(), conversation_id));

-- 6) Notes
CREATE TABLE public.whatsapp_conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_conversation_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wa_notes_conv ON public.whatsapp_conversation_notes(conversation_id, created_at);

CREATE POLICY "Admins manage notes" ON public.whatsapp_conversation_notes
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Members read notes" ON public.whatsapp_conversation_notes
  FOR SELECT USING (can_access_conversation(auth.uid(), conversation_id));
CREATE POLICY "Members insert notes" ON public.whatsapp_conversation_notes
  FOR INSERT WITH CHECK (can_access_conversation(auth.uid(), conversation_id) AND author_user_id = auth.uid());

-- Realtime
ALTER TABLE public.whatsapp_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_conversation_transfers REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_conversation_notes REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversation_transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversation_notes;

-- Seed: general queue + one per active team member
INSERT INTO public.whatsapp_queues (name, team_member_id, sort_order)
VALUES ('Geral', NULL, 0);

INSERT INTO public.whatsapp_queues (name, team_member_id, sort_order)
SELECT 'Fila ' || full_name, id, 10
FROM public.team_members
WHERE active = true;
