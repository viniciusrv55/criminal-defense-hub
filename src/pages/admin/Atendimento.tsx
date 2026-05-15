import { useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Send, Search, Inbox, MessageSquare, ArrowRightLeft, User as UserIcon, Phone,
  Loader2, FileText, Image as ImageIcon, Mic, Video as VideoIcon, MapPin, Sticker,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Queue { id: string; name: string; team_member_id: string | null; color: string; }
interface Conversation {
  id: string;
  contact_phone: string;
  contact_name: string | null;
  contact_avatar_url: string | null;
  current_queue_id: string | null;
  assigned_team_member_id: string | null;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  lead_id: string | null;
}
interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string | null;
  media_url: string | null;
  status: string;
  created_at: string;
  sent_by_user_id: string | null;
}
interface Member { id: string; full_name: string; }

function formatTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatPhone(p: string) {
  const n = p.replace(/\D/g, '');
  if (n.length === 13) return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(4, 9)}-${n.slice(9)}`;
  if (n.length === 12) return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(4, 8)}-${n.slice(8)}`;
  return p;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === 'outbound';
  const icon = msg.message_type === 'image' ? <ImageIcon className="w-3 h-3" />
    : msg.message_type === 'audio' ? <Mic className="w-3 h-3" />
    : msg.message_type === 'video' ? <VideoIcon className="w-3 h-3" />
    : msg.message_type === 'document' ? <FileText className="w-3 h-3" />
    : msg.message_type === 'sticker' ? <Sticker className="w-3 h-3" />
    : msg.message_type === 'location' ? <MapPin className="w-3 h-3" />
    : null;

  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} px-2`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
          isOut
            ? 'bg-accent text-[hsl(0_0%_8%)] rounded-br-sm'
            : 'bg-white border border-border text-[hsl(0_0%_8%)] rounded-bl-sm'
        }`}
      >
        {msg.media_url && msg.message_type === 'image' && (
          <img src={msg.media_url} alt="" className="rounded-lg mb-2 max-w-full" />
        )}
        {msg.media_url && msg.message_type !== 'image' && (
          <a href={msg.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline text-xs mb-1">
            {icon}<span>{msg.message_type}</span>
          </a>
        )}
        {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
        <div className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${isOut ? 'text-[hsl(0_0%_15%)]/70' : 'text-muted-foreground'}`}>
          <span>{formatTime(msg.created_at)}</span>
          {isOut && (
            <span>
              {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Atendimento() {
  const { user } = useAuth();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferQueueId, setTransferQueueId] = useState<string>('');
  const [transferNote, setTransferNote] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId) ?? null,
    [conversations, activeConvId],
  );

  // Initial load
  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [qRes, mRes, cRes] = await Promise.all([
        supabase.from('whatsapp_queues').select('*').eq('active', true).order('sort_order'),
        supabase.from('team_members').select('id, full_name').eq('active', true).order('full_name'),
        supabase.from('whatsapp_conversations').select('*').order('last_message_at', { ascending: false, nullsFirst: false }).limit(200),
      ]);
      setQueues((qRes.data ?? []) as Queue[]);
      setMembers((mRes.data ?? []) as Member[]);
      setConversations((cRes.data ?? []) as Conversation[]);
      if (qRes.data?.[0]) setActiveQueueId((qRes.data[0] as Queue).id);
      setLoading(false);
    })();
  }, []);

  // Realtime: conversations
  useEffect(() => {
    const ch = supabase
      .channel('wa-conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, (payload) => {
        setConversations((prev) => {
          const row = (payload.new ?? payload.old) as Conversation;
          if (!row) return prev;
          if (payload.eventType === 'DELETE') return prev.filter((c) => c.id !== row.id);
          const idx = prev.findIndex((c) => c.id === row.id);
          if (idx === -1) return [row, ...prev];
          const next = [...prev];
          next[idx] = { ...next[idx], ...(payload.new as Conversation) };
          return next.sort((a, b) =>
            (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''),
          );
        });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  // Load messages when conv changes + realtime per conv
  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', activeConvId)
        .order('created_at', { ascending: true })
        .limit(500);
      if (!cancelled) setMessages((data ?? []) as Message[]);
      // Reset unread
      await supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', activeConvId);
    })();
    const ch = supabase
      .channel(`wa-msg-${activeConvId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${activeConvId}` },
        (payload) => {
          setMessages((prev) => {
            const m = payload.new as Message;
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        },
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${activeConvId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        },
      )
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(ch); };
  }, [activeConvId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeConvId]);

  const filteredConvs = useMemo(() => {
    let list = conversations;
    if (activeQueueId) list = list.filter((c) => c.current_queue_id === activeQueueId);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) => (c.contact_name ?? '').toLowerCase().includes(s) || c.contact_phone.includes(s),
      );
    }
    return list;
  }, [conversations, activeQueueId, search]);

  const queueCounts = useMemo(() => {
    const map: Record<string, number> = {};
    conversations.forEach((c) => {
      if (!c.current_queue_id) return;
      map[c.current_queue_id] = (map[c.current_queue_id] ?? 0) + (c.unread_count > 0 ? 1 : 0);
    });
    return map;
  }, [conversations]);

  async function handleSend() {
    if (!activeConvId || !draft.trim() || sending) return;
    setSending(true);
    const text = draft;
    setDraft('');
    const { data, error } = await supabase.functions.invoke('whatsapp-send', {
      body: { conversation_id: activeConvId, message_type: 'text', content: text },
    });
    setSending(false);
    if (error || (data && !data.ok)) {
      toast({ title: 'Erro ao enviar', description: error?.message ?? data?.error ?? 'Falha', variant: 'destructive' });
      setDraft(text);
    }
  }

  async function handleTransfer() {
    if (!activeConvId || !transferQueueId) return;
    const { data, error } = await supabase.functions.invoke('whatsapp-transfer', {
      body: { conversation_id: activeConvId, to_queue_id: transferQueueId, note: transferNote || null },
    });
    if (error || (data && !data.ok)) {
      toast({ title: 'Erro ao transferir', description: error?.message ?? data?.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Conversa transferida' });
    setTransferOpen(false);
    setTransferNote('');
    setTransferQueueId('');
  }

  return (
    <AdminLayout>
      <div className="-m-6 lg:-m-10 h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div>
            <h1 className="font-serif text-2xl">Atendimento</h1>
            <p className="text-sm text-muted-foreground">Chat em tempo real do WhatsApp</p>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Queues */}
          <aside className="w-64 border-r border-border bg-[hsl(0_0%_4%)] text-[hsl(0_0%_92%)] flex flex-col">
            <div className="px-4 py-3 border-b border-[hsl(0_0%_12%)] text-xs uppercase tracking-wider text-[hsl(0_0%_50%)]">Filas</div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {queues.map((q) => {
                const active = q.id === activeQueueId;
                const unread = queueCounts[q.id] ?? 0;
                return (
                  <button
                    key={q.id}
                    onClick={() => { setActiveQueueId(q.id); setActiveConvId(null); }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-accent/15 text-accent'
                        : 'hover:bg-[hsl(0_0%_8%)] text-[hsl(0_0%_75%)]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Inbox className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{q.name}</span>
                    </span>
                    {unread > 0 && (
                      <Badge className="bg-accent text-[hsl(0_0%_8%)] h-5 px-1.5 text-[10px]">{unread}</Badge>
                    )}
                  </button>
                );
              })}
              {queues.length === 0 && !loading && (
                <p className="text-xs text-[hsl(0_0%_50%)] px-3 py-4">Nenhuma fila ativa.</p>
              )}
            </div>
          </aside>

          {/* Conversations list */}
          <section className="w-80 border-r border-border bg-card flex flex-col">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando…
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhuma conversa nesta fila.
                </div>
              ) : (
                filteredConvs.map((c) => {
                  const active = c.id === activeConvId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveConvId(c.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 border-b border-border text-left transition-colors ${
                        active ? 'bg-accent/10' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-[hsl(37_45%_45%)] flex items-center justify-center text-[hsl(0_0%_5%)] text-sm font-semibold flex-shrink-0">
                        {(c.contact_name ?? c.contact_phone).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">
                            {c.contact_name ?? formatPhone(c.contact_phone)}
                          </p>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {formatTime(c.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">
                            {c.last_message_preview ?? '—'}
                          </p>
                          {c.unread_count > 0 && (
                            <Badge className="bg-accent text-[hsl(0_0%_8%)] h-4 min-w-4 px-1 text-[10px]">
                              {c.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Chat */}
          <section className="flex-1 flex flex-col bg-[hsl(40_15%_95%)]">
            {!activeConv ? (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Selecione uma conversa para começar</p>
                </div>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-[hsl(37_45%_45%)] flex items-center justify-center text-[hsl(0_0%_5%)] text-sm font-semibold">
                      {(activeConv.contact_name ?? activeConv.contact_phone).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{activeConv.contact_name ?? 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />{formatPhone(activeConv.contact_phone)}
                        {activeConv.lead_id && (
                          <Badge variant="outline" className="ml-2 h-4 text-[10px]">Lead</Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
                    <ArrowRightLeft className="w-4 h-4 mr-2" /> Transferir
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto py-4 space-y-2">
                  {messages.map((m) => (<MessageBubble key={m.id} msg={m} />))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-border bg-card p-3 flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
                    }}
                    placeholder="Digite uma mensagem… (Enter para enviar)"
                    rows={1}
                    className="resize-none min-h-[40px] max-h-32"
                  />
                  <Button onClick={handleSend} disabled={sending || !draft.trim()} className="h-10">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>

        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transferir conversa</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Para a fila</label>
                <Select value={transferQueueId} onValueChange={setTransferQueueId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma fila" /></SelectTrigger>
                  <SelectContent>
                    {queues.filter(q => q.id !== activeConv?.current_queue_id).map((q) => (
                      <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nota (opcional)</label>
                <Textarea
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Contexto para o próximo atendente…"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
              <Button onClick={handleTransfer} disabled={!transferQueueId}>Transferir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
