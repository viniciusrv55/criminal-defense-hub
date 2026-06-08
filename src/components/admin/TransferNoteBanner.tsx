import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Check, X } from 'lucide-react';

interface Transfer {
  id: string;
  conversation_id: string;
  note: string | null;
  transferred_at: string;
  from_user_id: string | null;
  from_queue_id: string | null;
  to_queue_id: string | null;
}
interface UserLite { id: string; full_name: string; }
interface QueueLite { id: string; name: string; }

export function TransferNoteBanner({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [members, setMembers] = useState<Record<string, string>>({});
  const [queues, setQueues] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!conversationId || !user) return;
    void (async () => {
      const [{ data: ts }, { data: acks }, { data: tm }, { data: qs }] = await Promise.all([
        supabase.from('whatsapp_conversation_transfers')
          .select('id, conversation_id, note, transferred_at, from_user_id, from_queue_id, to_queue_id')
          .eq('conversation_id', conversationId)
          .order('transferred_at', { ascending: false })
          .limit(5),
        // @ts-expect-error new table not yet in generated types
        supabase.from('whatsapp_transfer_acks').select('transfer_id').eq('user_id', user.id),
        supabase.from('team_members').select('id, full_name, user_id'),
        supabase.from('whatsapp_queues').select('id, name'),
      ]);
      const ackedIds = new Set((acks ?? []).map((a) => a.transfer_id as string));
      setDismissed(ackedIds);
      setTransfers((ts ?? []) as Transfer[]);
      const memMap: Record<string, string> = {};
      (tm ?? []).forEach((m: { user_id: string | null; full_name: string }) => {
        if (m.user_id) memMap[m.user_id] = m.full_name;
      });
      setMembers(memMap);
      const qMap: Record<string, string> = {};
      (qs ?? []).forEach((q: QueueLite) => { qMap[q.id] = q.name; });
      setQueues(qMap);
    })();
  }, [conversationId, user]);

  const visible = transfers.filter((t) => !dismissed.has(t.id) && (t.note?.trim() || t.from_queue_id));
  if (!user || visible.length === 0) return null;
  const t = visible[0];

  const ack = async () => {
    // @ts-expect-error new table not yet in generated types
    await supabase.from('whatsapp_transfer_acks').insert({ transfer_id: t.id, user_id: user.id });
    setDismissed((prev) => new Set([...prev, t.id]));
  };

  const fromQ = t.from_queue_id ? queues[t.from_queue_id] : null;
  const toQ = t.to_queue_id ? queues[t.to_queue_id] : null;
  const fromUser = t.from_user_id ? members[t.from_user_id] : null;

  return (
    <div className="mx-4 mt-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 flex items-start gap-3">
      <ArrowRightLeft className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">
          Transferido{fromUser ? ` por ${fromUser}` : ''}
          {fromQ ? ` · de ${fromQ}` : ''}{toQ ? ` → ${toQ}` : ''}
        </p>
        {t.note && (
          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{t.note}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">{new Date(t.transferred_at).toLocaleString('pt-BR')}</p>
      </div>
      <Button size="sm" variant="outline" onClick={ack} className="gap-1">
        <Check className="w-3.5 h-3.5" /> Lido
      </Button>
    </div>
  );
}
