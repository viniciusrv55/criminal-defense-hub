import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Send, Search, Inbox, MessageSquare, ArrowRightLeft, User as UserIcon, Phone,
  Loader2, FileText, Image as ImageIcon, Mic, Video as VideoIcon, MapPin, Sticker, Bot, BotOff,
  Calendar, Paperclip, Smile, Square, Plus,
} from 'lucide-react';
import Picker from '@emoji-mart/react';
import emojiData from '@emoji-mart/data';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TransferNoteBanner } from '@/components/admin/TransferNoteBanner';


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
  ai_enabled: boolean;
  ai_paused_at: string | null;
}
interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_mime: string | null;
  status: string;
  created_at: string;
  sent_by_user_id: string | null;
  metadata: Record<string, unknown> | null;
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

function parseSenderPrefix(text: string | null): { sender: string | null; body: string } {
  if (!text) return { sender: null, body: '' };
  // Match leading "*Nome:*\n" (markdown bold used in WhatsApp)
  const m = /^\*([^*\n]+):\*\n?/.exec(text);
  if (!m) return { sender: null, body: text };
  return { sender: m[1].trim(), body: text.slice(m[0].length) };
}

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === 'outbound';
  const meta = (msg.metadata ?? {}) as Record<string, unknown>;
  const transcript = typeof meta.transcript === 'string' ? meta.transcript : null;
  const imageDesc = typeof meta.image_description === 'string' ? meta.image_description : null;
  const { sender, body } = parseSenderPrefix(msg.content);
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
        {sender && isOut && (
          <p className="text-[11px] font-bold mb-0.5 text-[hsl(0_0%_15%)]">{sender}</p>
        )}
        {msg.media_url && msg.message_type === 'image' && (
          <a href={msg.media_url} target="_blank" rel="noreferrer">
            <img src={msg.media_url} alt="" className="rounded-lg mb-2 max-w-full max-h-80 object-cover" />
          </a>
        )}
        {msg.media_url && msg.message_type === 'audio' && (
          <audio controls src={msg.media_url} className="w-full mb-1" />
        )}
        {msg.media_url && !['image', 'audio'].includes(msg.message_type) && (
          <a href={msg.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline text-xs mb-1">
            {icon}<span>{msg.message_type}</span>
          </a>
        )}
        {body && <p className="text-sm whitespace-pre-wrap break-words">{body}</p>}
        {transcript && msg.message_type === 'audio' && !body && (
          <p className="text-sm whitespace-pre-wrap break-words italic">{transcript}</p>
        )}
        {imageDesc && (
          <p className="text-[11px] mt-1 opacity-70 italic border-t border-current/10 pt-1">🤖 {imageDesc}</p>
        )}
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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [apptTypes, setApptTypes] = useState<{ id: string; name: string; duration_minutes: number }[]>([]);
  const [scheduleForm, setScheduleForm] = useState({
    title: 'Consulta', appointment_type_id: '', attorney_id: '', starts_at: '', duration_minutes: 30, notes: '',
  });
  const [scheduling, setScheduling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [newConvForm, setNewConvForm] = useState({ phone: '', name: '' });
  const [openingConv, setOpeningConv] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const [senderName, setSenderName] = useState<string>('');
  const [convSearch, setConvSearch] = useState('');
  const [convSearchResults, setConvSearchResults] = useState<Array<{
    kind: 'lead' | 'client';
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    extra?: string | null;
  }>>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);


  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId) ?? null,
    [conversations, activeConvId],
  );



  // Initial load
  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [qRes, mRes, cRes, tRes] = await Promise.all([
        supabase.from('whatsapp_queues').select('*').eq('active', true).order('sort_order'),
        supabase.from('team_members').select('id, full_name').eq('active', true).order('full_name'),
        supabase.from('whatsapp_conversations').select('*').order('last_message_at', { ascending: false, nullsFirst: false }).limit(200),
        supabase.from('appointment_types').select('id, name, duration_minutes').eq('active', true).order('sort_order'),
      ]);
      setQueues((qRes.data ?? []) as Queue[]);
      setMembers((mRes.data ?? []) as Member[]);
      setConversations((cRes.data ?? []) as Conversation[]);
      setApptTypes((tRes.data ?? []) as { id: string; name: string; duration_minutes: number }[]);
      if (qRes.data?.[0]) setActiveQueueId((qRes.data[0] as Queue).id);
      setLoading(false);
    })();
  }, []);

  // Load current user's team_member name (for outgoing-message signature)
  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.full_name) setSenderName(data.full_name);
    })();
  }, [user?.id]);

  // Debounced contact search (leads + clients) for the "Nova conversa" dialog
  useEffect(() => {
    if (!newConvOpen) return;
    const term = convSearch.trim();
    if (term.length < 2) { setConvSearchResults([]); return; }
    const handle = setTimeout(async () => {
      setSearchingContacts(true);
      const digitsOnly = term.replace(/\D/g, '');
      const like = `%${term}%`;
      const [{ data: leadsRows }, { data: clientsRows }] = await Promise.all([
        supabase.from('leads')
          .select('id, name, phone, email')
          .or(`name.ilike.${like},email.ilike.${like}${digitsOnly ? `,phone.ilike.%${digitsOnly}%` : ''}`)
          .limit(8),
        supabase.from('clients')
          .select('id, full_name, cpf, cnpj, phones, emails')
          .or(
            `full_name.ilike.${like},cpf.ilike.${like},cnpj.ilike.${like},phones::text.ilike.${like},emails::text.ilike.${like}`,
          )
          .limit(8),
      ]);
      const results: typeof convSearchResults = [];
      (leadsRows ?? []).forEach((l) => {
        results.push({
          kind: 'lead',
          id: l.id as string,
          name: (l.name as string) ?? 'Lead sem nome',
          phone: (l.phone as string | null) ?? null,
          email: (l.email as string | null) ?? null,
        });
      });
      (clientsRows ?? []).forEach((c) => {
        const phonesArr = Array.isArray(c.phones) ? (c.phones as unknown[]) : [];
        const emailsArr = Array.isArray(c.emails) ? (c.emails as unknown[]) : [];
        const firstPhone = phonesArr
          .map((p) => (typeof p === 'string' ? p : (p as { number?: string })?.number))
          .find(Boolean) as string | undefined;
        const firstEmail = emailsArr
          .map((e) => (typeof e === 'string' ? e : (e as { address?: string })?.address))
          .find(Boolean) as string | undefined;
        results.push({
          kind: 'client',
          id: c.id as string,
          name: (c.full_name as string) ?? 'Cliente',
          phone: firstPhone ?? null,
          email: firstEmail ?? null,
          extra: (c.cpf as string | null) ?? (c.cnpj as string | null) ?? null,
        });
      });
      setConvSearchResults(results);
      setSearchingContacts(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [convSearch, newConvOpen]);


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
    // Prefix agent name in WhatsApp bold (*Name*) so the contact sees who is replying.
    const signed = senderName ? `*${senderName}:*\n${text}` : text;
    const { data, error } = await supabase.functions.invoke('whatsapp-send', {
      body: { conversation_id: activeConvId, message_type: 'text', content: signed },
    });
    setSending(false);
    if (error || (data && !data.ok)) {
      // eslint-disable-next-line no-console
      console.error('whatsapp-send error', { error, data });
      const desc =
        error?.message ??
        (typeof data?.error === 'string' ? data.error : null) ??
        (data?.error ? JSON.stringify(data.error) : null) ??
        'Falha ao enviar — verifique se há instância WhatsApp conectada.';
      toast({ title: 'Erro ao enviar', description: desc, variant: 'destructive' });
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

  async function toggleAi() {
    if (!activeConv) return;
    const paused = !!activeConv.ai_paused_at;
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update(paused
        ? { ai_paused_at: null, ai_handoff_reason: null }
        : { ai_paused_at: new Date().toISOString(), ai_handoff_reason: 'Pausado manualmente' })
      .eq('id', activeConv.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: paused ? 'IA retomada' : 'IA pausada' });
    }
  }

  function openSchedule() {
    if (!activeConv) return;
    const base = new Date();
    base.setMinutes(0, 0, 0);
    base.setHours(base.getHours() + 1);
    const isoLocal = new Date(base.getTime() - base.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setScheduleForm({
      title: `Consulta — ${activeConv.contact_name ?? formatPhone(activeConv.contact_phone)}`,
      appointment_type_id: apptTypes[0]?.id ?? '',
      attorney_id: '',
      starts_at: isoLocal,
      duration_minutes: apptTypes[0]?.duration_minutes ?? 30,
      notes: '',
    });
    setScheduleOpen(true);
  }

  async function handleSchedule() {
    if (!activeConv || !scheduleForm.starts_at || !scheduleForm.title) return;
    setScheduling(true);
    const starts = new Date(scheduleForm.starts_at);
    const ends = new Date(starts.getTime() + (scheduleForm.duration_minutes || 30) * 60000);
    const { data: appt, error } = await supabase.from('appointments').insert({
      title: scheduleForm.title,
      appointment_type_id: scheduleForm.appointment_type_id || null,
      attorney_id: scheduleForm.attorney_id || null,
      conversation_id: activeConv.id,
      lead_id: activeConv.lead_id,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      notes: scheduleForm.notes || null,
      status: 'scheduled',
      created_by: user?.id,
      created_via: 'admin',
    }).select('id').single();
    setScheduling(false);
    if (error) {
      toast({ title: 'Erro ao agendar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Agendamento criado' });
    setScheduleOpen(false);
    // dispara notificação de confirmação
    void supabase.functions.invoke('appointment-notify', { body: { appointment_id: appt.id, kind: 'confirmation' } });
  }

  async function uploadAndSend(blob: Blob, fileName: string, mime: string) {
    if (!activeConvId) return;
    setUploading(true);
    try {
      const ext = fileName.split('.').pop() || 'bin';
      const path = `whatsapp-uploads/${activeConvId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('site-assets').upload(path, blob, {
        contentType: mime, upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('site-assets').getPublicUrl(path);
      const messageType: 'image' | 'audio' | 'video' | 'document' =
        mime.startsWith('image/') ? 'image'
        : mime.startsWith('audio/') ? 'audio'
        : mime.startsWith('video/') ? 'video'
        : 'document';
      const rawCaption = draft.trim();
      const signedCaption = rawCaption
        ? (senderName ? `*${senderName}:*\n${rawCaption}` : rawCaption)
        : undefined;
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          conversation_id: activeConvId,
          message_type: messageType,
          media_url: pub.publicUrl,
          media_mime: mime,
          content: signedCaption,
        },
      });
      if (error || (data && !data.ok)) {
        // eslint-disable-next-line no-console
        console.error('whatsapp-send media error', { error, data });
        const desc = error?.message
          ?? (typeof data?.error === 'string' ? data.error : null)
          ?? (data?.error ? JSON.stringify(data.error) : 'Falha no envio — verifique se há instância WhatsApp conectada.');
        throw new Error(desc);
      }
      setDraft('');
    } catch (e) {
      toast({ title: 'Erro ao enviar anexo', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }


  async function handleUpload(file: File) {
    await uploadAndSend(file, file.name, file.type || 'application/octet-stream');
  }

  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' });
        await uploadAndSend(blob, `audio-${Date.now()}.webm`, 'audio/webm');
      };
      mr.start();
      setRecording(true);
    } catch (e) {
      toast({ title: 'Microfone indisponível', description: (e as Error).message, variant: 'destructive' });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function insertEmoji(emoji: { native: string }) {
    setDraft((d) => d + emoji.native);
  }

  async function handleOpenNewConv(opts?: {
    phone?: string;
    name?: string | null;
    lead_id?: string | null;
    client_id?: string | null;
  }) {
    const phone = (opts?.phone ?? newConvForm.phone).trim();
    if (!phone) {
      toast({ title: 'Telefone obrigatório', variant: 'destructive' });
      return;
    }
    setOpeningConv(true);
    const { data, error } = await supabase.functions.invoke('whatsapp-open-conversation', {
      body: {
        phone,
        name: opts?.name ?? (newConvForm.name || null),
        lead_id: opts?.lead_id ?? null,
        client_id: opts?.client_id ?? null,
      },
    });
    setOpeningConv(false);
    if (error || !data?.ok) {
      // eslint-disable-next-line no-console
      console.error('whatsapp-open-conversation error', { error, data });
      const desc = error?.message
        ?? (typeof data?.error === 'string' ? data.error : null)
        ?? (data?.error ? JSON.stringify(data.error) : 'Falha ao abrir conversa — verifique se há instância WhatsApp conectada.');
      toast({ title: 'Erro', description: desc, variant: 'destructive' });
      return;
    }
    setNewConvOpen(false);
    setNewConvForm({ phone: '', name: '' });
    setConvSearch('');
    setConvSearchResults([]);
    setActiveConvId(data.conversation_id as string);
    toast({ title: data.created ? 'Conversa criada' : 'Conversa já existia, aberta' });
  }


  // Open conversation from URL param (?conversation=...)
  useEffect(() => {
    const cid = searchParams.get('conversation');
    if (cid) {
      setActiveConvId(cid);
      searchParams.delete('conversation');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);



  return (
    <AdminLayout>
      <div className="-m-6 lg:-m-10 h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div>
            <h1 className="font-serif text-2xl">Atendimento</h1>
            <p className="text-sm text-muted-foreground">Chat em tempo real do WhatsApp</p>
          </div>
          <Button onClick={() => setNewConvOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova conversa
          </Button>
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
                        {activeConv.ai_paused_at ? (
                          <Badge variant="outline" className="ml-1 h-4 text-[10px] gap-1"><BotOff className="w-3 h-3" /> IA pausada</Badge>
                        ) : activeConv.ai_enabled ? (
                          <Badge variant="outline" className="ml-1 h-4 text-[10px] gap-1 border-accent text-accent"><Bot className="w-3 h-3" /> IA ativa</Badge>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={toggleAi}>
                      {activeConv.ai_paused_at ? <><Bot className="w-4 h-4 mr-2" />Retomar IA</> : <><BotOff className="w-4 h-4 mr-2" />Pausar IA</>}
                    </Button>
                    <Button variant="outline" size="sm" onClick={openSchedule}>
                      <Calendar className="w-4 h-4 mr-2" /> Agendar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
                      <ArrowRightLeft className="w-4 h-4 mr-2" /> Transferir
                    </Button>
                  </div>
                </div>

                <TransferNoteBanner conversationId={activeConv.id} />
                <div className="flex-1 overflow-y-auto py-4 space-y-2">
                  {messages.map((m) => (<MessageBubble key={m.id} msg={m} />))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-border bg-card p-3 flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 flex-shrink-0"
                    disabled={uploading || recording}
                    onClick={() => fileInputRef.current?.click()}
                    title="Anexar arquivo"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="h-10 w-10 flex-shrink-0" title="Emoji" disabled={recording}>
                        <Smile className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 border-none bg-transparent shadow-none w-auto" side="top" align="start">
                      <Picker data={emojiData} onEmojiSelect={insertEmoji} theme="light" locale="pt" previewPosition="none" />
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant={recording ? 'destructive' : 'outline'}
                    size="icon"
                    className="h-10 w-10 flex-shrink-0"
                    onClick={recording ? stopRecording : startRecording}
                    title={recording ? 'Parar gravação' : 'Gravar áudio'}
                    disabled={uploading}
                  >
                    {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
                    }}
                    placeholder={recording ? '🔴 Gravando…' : 'Digite uma mensagem… (Enter para enviar)'}
                    rows={1}
                    disabled={recording}
                    className="resize-none min-h-[40px] max-h-32"
                  />
                  <Button onClick={handleSend} disabled={sending || !draft.trim() || recording} className="h-10">
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

        <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar compromisso</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Título</label>
                <Input value={scheduleForm.title} onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Tipo</label>
                  <Select
                    value={scheduleForm.appointment_type_id}
                    onValueChange={(v) => {
                      const t = apptTypes.find(x => x.id === v);
                      setScheduleForm({ ...scheduleForm, appointment_type_id: v, duration_minutes: t?.duration_minutes ?? scheduleForm.duration_minutes });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {apptTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Advogado</label>
                  <Select value={scheduleForm.attorney_id} onValueChange={(v) => setScheduleForm({ ...scheduleForm, attorney_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Início</label>
                  <Input type="datetime-local" value={scheduleForm.starts_at} onChange={(e) => setScheduleForm({ ...scheduleForm, starts_at: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Duração (min)</label>
                  <Input type="number" min={5} step={5} value={scheduleForm.duration_minutes} onChange={(e) => setScheduleForm({ ...scheduleForm, duration_minutes: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Notas</label>
                <Textarea rows={3} value={scheduleForm.notes} onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancelar</Button>
              <Button onClick={handleSchedule} disabled={scheduling || !scheduleForm.starts_at}>
                {scheduling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calendar className="w-4 h-4 mr-2" />}
                Agendar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={newConvOpen} onOpenChange={(o) => {
          setNewConvOpen(o);
          if (!o) { setConvSearch(''); setConvSearchResults([]); }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova conversa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Buscar Lead ou Cliente</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={convSearch}
                    onChange={(e) => setConvSearch(e.target.value)}
                    placeholder="Nome, telefone, e-mail, CPF ou CNPJ…"
                    className="pl-9"
                  />
                </div>
                {(convSearch.trim().length >= 2) && (
                  <div className="mt-2 max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border bg-card">
                    {searchingContacts ? (
                      <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Buscando…
                      </div>
                    ) : convSearchResults.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground">Nada encontrado. Você pode digitar um telefone abaixo para iniciar mesmo assim.</div>
                    ) : (
                      convSearchResults.map((r) => (
                        <button
                          key={`${r.kind}-${r.id}`}
                          type="button"
                          disabled={openingConv || !r.phone}
                          onClick={() => void handleOpenNewConv({
                            phone: r.phone ?? '',
                            name: r.name,
                            lead_id: r.kind === 'lead' ? r.id : null,
                            client_id: r.kind === 'client' ? r.id : null,
                          })}
                          className="w-full text-left p-3 hover:bg-muted/50 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{r.name}</span>
                            <Badge variant="outline" className="text-[10px] h-4">
                              {r.kind === 'lead' ? 'Lead' : 'Cliente'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {r.phone ? formatPhone(r.phone) : 'sem telefone'}
                            {r.email ? ` · ${r.email}` : ''}
                            {r.extra ? ` · ${r.extra}` : ''}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                <p className="text-xs text-muted-foreground">…ou inicie informando o telefone manualmente:</p>
                <div>
                  <label className="text-sm font-medium mb-1 block">Telefone (com DDD)</label>
                  <Input
                    value={newConvForm.phone}
                    onChange={(e) => setNewConvForm({ ...newConvForm, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Sem código do país, prefixo 55 será adicionado automaticamente.</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Nome (opcional)</label>
                  <Input value={newConvForm.name} onChange={(e) => setNewConvForm({ ...newConvForm, name: e.target.value })} placeholder="Nome do contato" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewConvOpen(false)}>Cancelar</Button>
              <Button onClick={() => void handleOpenNewConv()} disabled={openingConv || !newConvForm.phone.trim()}>
                {openingConv ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Abrir conversa
              </Button>
            </DialogFooter>
          </DialogContent>

        </Dialog>
      </div>

    </AdminLayout>
  );
}

