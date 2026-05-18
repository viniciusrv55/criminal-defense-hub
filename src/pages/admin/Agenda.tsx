import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalIcon, Clock, MapPin, Trash2, Send, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Appointment {
  id: string; title: string; description: string | null;
  appointment_type_id: string | null; attorney_id: string | null;
  starts_at: string; ends_at: string; status: string; location: string | null;
  conversation_id: string | null; lead_id: string | null; notes: string | null;
  created_via: string;
}
interface ApptType { id: string; name: string; duration_minutes: number; color: string; }
interface Member { id: string; full_name: string; }

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendado', color: 'bg-accent/15 text-accent border-accent/40' },
  confirmed: { label: 'Confirmado', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  completed: { label: 'Concluído', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800 border-red-300' },
  no_show: { label: 'Não compareceu', color: 'bg-amber-100 text-amber-800 border-amber-300' },
};

function startOfWeek(d: Date) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function fmtMonthYear(d: Date) { return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); }

export default function Agenda() {
  const { user } = useAuth();
  const [view, setView] = useState<'week' | 'month' | 'day'>('week');
  const [cursor, setCursor] = useState(new Date());
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [types, setTypes] = useState<ApptType[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [filterAttorney, setFilterAttorney] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState<Appointment | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', appointment_type_id: '', attorney_id: '',
    starts_at: '', duration_minutes: 30, location: '', notes: '', status: 'scheduled',
  });

  useEffect(() => {
    void (async () => {
      const [a, t, m] = await Promise.all([
        supabase.from('appointments').select('*').order('starts_at'),
        supabase.from('appointment_types').select('*').eq('active', true).order('sort_order'),
        supabase.from('team_members').select('id, full_name').eq('active', true).order('full_name'),
      ]);
      setAppts((a.data ?? []) as Appointment[]);
      setTypes((t.data ?? []) as ApptType[]);
      setMembers((m.data ?? []) as Member[]);
    })();
    const ch = supabase.channel('agenda-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, async () => {
        const { data } = await supabase.from('appointments').select('*').order('starts_at');
        setAppts((data ?? []) as Appointment[]);
      }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    return appts.filter(a => filterAttorney === 'all' || a.attorney_id === filterAttorney);
  }, [appts, filterAttorney]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const apptsByDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    filtered.forEach(a => {
      const k = new Date(a.starts_at).toDateString();
      (map[k] = map[k] || []).push(a);
    });
    return map;
  }, [filtered]);

  function openCreate(slot?: Date) {
    const base = slot ?? new Date();
    base.setMinutes(0); base.setSeconds(0);
    const isoLocal = new Date(base.getTime() - base.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({
      title: 'Consulta', description: '', appointment_type_id: types[0]?.id ?? '',
      attorney_id: '', starts_at: isoLocal, duration_minutes: types[0]?.duration_minutes ?? 30,
      location: '', notes: '', status: 'scheduled',
    });
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!form.title || !form.starts_at) {
      toast({ title: 'Preencha título e horário', variant: 'destructive' });
      return;
    }
    const starts = new Date(form.starts_at);
    const ends = new Date(starts.getTime() + (form.duration_minutes || 30) * 60000);
    const { error } = await supabase.from('appointments').insert({
      title: form.title,
      description: form.description || null,
      appointment_type_id: form.appointment_type_id || null,
      attorney_id: form.attorney_id || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      location: form.location || null,
      notes: form.notes || null,
      status: form.status,
      created_by: user?.id,
      created_via: 'admin',
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Agendamento criado' });
    setCreateOpen(false);
  }

  async function changeStatus(id: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', id);
    setDetailOpen(prev => prev ? { ...prev, status } : prev);
  }

  async function removeAppt(id: string) {
    if (!confirm('Excluir este compromisso?')) return;
    await supabase.from('appointments').delete().eq('id', id);
    setDetailOpen(null);
  }

  async function notify(appt: Appointment, kind: 'confirmation' | 'reminder' | 'cancel') {
    const { data, error } = await supabase.functions.invoke('appointment-notify', {
      body: { appointment_id: appt.id, kind },
    });
    if (error || (data && !data.ok)) {
      toast({ title: 'Erro ao enviar', description: error?.message ?? data?.error, variant: 'destructive' });
    } else {
      toast({ title: 'Notificação enviada' });
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl tracking-tight">Agenda</h1>
            <p className="text-sm text-muted-foreground">Compromissos, consultas e audiências</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterAttorney} onValueChange={setFilterAttorney}>
              <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os advogados</SelectItem>
                {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => openCreate()}><Plus className="w-4 h-4 mr-2" />Novo</Button>
          </div>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as 'week' | 'month' | 'day')}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="day">Dia</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCursor(addDays(cursor, view === 'month' ? -30 : view === 'week' ? -7 : -1))}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
              <Button variant="outline" size="icon" onClick={() => setCursor(addDays(cursor, view === 'month' ? 30 : view === 'week' ? 7 : 1))}><ChevronRight className="w-4 h-4" /></Button>
              <span className="ml-3 font-medium capitalize">{fmtMonthYear(cursor)}</span>
            </div>
          </div>

          {/* WEEK VIEW */}
          <TabsContent value="week">
            <div className="grid grid-cols-7 gap-2 mt-4">
              {weekDays.map((d, i) => {
                const list = apptsByDay[d.toDateString()] ?? [];
                const isToday = sameDay(d, new Date());
                return (
                  <div key={i} className={`border rounded-lg p-3 min-h-[300px] bg-card ${isToday ? 'border-accent' : 'border-border'}`}>
                    <button onClick={() => openCreate(d)} className="w-full text-left mb-2 group">
                      <div className="text-[10px] uppercase text-muted-foreground">{WEEKDAYS[d.getDay()]}</div>
                      <div className={`text-lg font-semibold ${isToday ? 'text-accent' : ''}`}>{d.getDate()}</div>
                    </button>
                    <div className="space-y-1.5">
                      {list.map(a => {
                        const type = types.find(t => t.id === a.appointment_type_id);
                        return (
                          <button key={a.id} onClick={() => setDetailOpen(a)} className="w-full text-left rounded p-2 text-xs hover:bg-muted transition-colors border-l-2" style={{ borderLeftColor: type?.color ?? '#d1a967', backgroundColor: `${type?.color ?? '#d1a967'}15` }}>
                            <div className="font-medium truncate">{fmtTime(a.starts_at)} {a.title}</div>
                            {a.location && <div className="text-muted-foreground truncate flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location}</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* MONTH VIEW */}
          <TabsContent value="month">
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden mt-4">
              {WEEKDAYS.map(d => <div key={d} className="bg-muted text-xs font-medium p-2 text-center">{d}</div>)}
              {monthDays.map((d, i) => {
                const list = apptsByDay[d.toDateString()] ?? [];
                const isToday = sameDay(d, new Date());
                const inMonth = d.getMonth() === cursor.getMonth();
                return (
                  <div key={i} className={`bg-card min-h-[100px] p-1.5 ${!inMonth ? 'opacity-40' : ''}`}>
                    <button onClick={() => openCreate(d)} className={`text-sm ${isToday ? 'text-accent font-bold' : ''}`}>{d.getDate()}</button>
                    <div className="space-y-0.5 mt-1">
                      {list.slice(0, 3).map(a => {
                        const type = types.find(t => t.id === a.appointment_type_id);
                        return (
                          <button key={a.id} onClick={() => setDetailOpen(a)} className="block w-full text-left text-[10px] truncate rounded px-1 py-0.5 hover:opacity-80" style={{ backgroundColor: `${type?.color ?? '#d1a967'}25`, color: type?.color ?? '#d1a967' }}>
                            {fmtTime(a.starts_at)} {a.title}
                          </button>
                        );
                      })}
                      {list.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{list.length - 3}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* DAY VIEW */}
          <TabsContent value="day">
            <div className="mt-4 border rounded-lg bg-card">
              {Array.from({ length: 14 }, (_, h) => h + 7).map(hour => {
                const slot = new Date(cursor); slot.setHours(hour, 0, 0, 0);
                const list = (apptsByDay[cursor.toDateString()] ?? []).filter(a => new Date(a.starts_at).getHours() === hour);
                return (
                  <div key={hour} className="flex border-b border-border last:border-0 min-h-[60px]">
                    <button onClick={() => openCreate(slot)} className="w-20 p-2 text-xs text-muted-foreground border-r border-border hover:bg-muted">{hour}:00</button>
                    <div className="flex-1 p-2 space-y-1">
                      {list.map(a => {
                        const type = types.find(t => t.id === a.appointment_type_id);
                        return (
                          <button key={a.id} onClick={() => setDetailOpen(a)} className="w-full text-left p-2 rounded border-l-4 hover:bg-muted" style={{ borderLeftColor: type?.color ?? '#d1a967', backgroundColor: `${type?.color ?? '#d1a967'}10` }}>
                            <div className="font-medium text-sm">{fmtTime(a.starts_at)} – {fmtTime(a.ends_at)} · {a.title}</div>
                            {a.location && <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location}</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo agendamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.appointment_type_id} onValueChange={v => {
                  const t = types.find(x => x.id === v);
                  setForm({ ...form, appointment_type_id: v, duration_minutes: t?.duration_minutes ?? form.duration_minutes });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Advogado</Label>
                <Select value={form.attorney_id} onValueChange={v => setForm({ ...form, attorney_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sem advogado" /></SelectTrigger>
                  <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
              <div><Label>Duração (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Local</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Escritório / Online / Endereço" /></div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail modal */}
      <Dialog open={!!detailOpen} onOpenChange={(o) => !o && setDetailOpen(null)}>
        <DialogContent className="max-w-lg">
          {detailOpen && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalIcon className="w-5 h-5 text-accent" />{detailOpen.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {new Date(detailOpen.starts_at).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })} – {fmtTime(detailOpen.ends_at)}
                </div>
                {detailOpen.location && <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{detailOpen.location}</div>}
                <div>
                  <Label className="text-xs uppercase">Status</Label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <button key={k} onClick={() => changeStatus(detailOpen.id, k)} className={`px-2 py-1 rounded text-xs border ${detailOpen.status === k ? v.color : 'border-border text-muted-foreground'}`}>{v.label}</button>
                    ))}
                  </div>
                </div>
                {detailOpen.notes && (
                  <div><Label className="text-xs uppercase">Notas</Label><p className="mt-1 text-muted-foreground">{detailOpen.notes}</p></div>
                )}
                {detailOpen.created_via === 'ai_agent' && (
                  <Badge variant="outline" className="text-accent border-accent">Criado pela IA</Badge>
                )}
              </div>
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => notify(detailOpen, 'confirmation')}><Send className="w-4 h-4 mr-1" />Confirmar</Button>
                <Button variant="outline" size="sm" onClick={() => notify(detailOpen, 'reminder')}>Lembrete</Button>
                <Button variant="outline" size="sm" onClick={() => notify(detailOpen, 'cancel')}><X className="w-4 h-4 mr-1" />Cancelamento</Button>
                <Button variant="destructive" size="sm" onClick={() => removeAppt(detailOpen.id)}><Trash2 className="w-4 h-4 mr-1" />Excluir</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
