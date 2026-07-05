import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/supabase-helpers';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Member { id: string; full_name: string; user_id: string | null; }
interface Appointment {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  attorney_id: string | null;
  status: string;
  location: string | null;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function startOfWeek(d: Date) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

const WeeklyAgendaWidget = () => {
  const { user, isAdmin } = useAuth();
  const admin = isAdmin();
  const [cursor, setCursor] = useState(new Date());
  const [members, setMembers] = useState<Member[]>([]);
  const [meTeamId, setMeTeamId] = useState<string | null>(null);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<string>('self');

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [{ data: m }, { data: a }] = await Promise.all([
        db.from('team_members').select('id,full_name,user_id').eq('active', true).order('full_name'),
        db.from('appointments').select('id,title,starts_at,ends_at,attorney_id,status,location').order('starts_at'),
      ]);
      const mem = (m ?? []) as Member[];
      setMembers(mem);
      const mine = mem.find(x => x.user_id === user?.id)?.id ?? null;
      setMeTeamId(mine);
      setAppts((a ?? []) as Appointment[]);
      setFilter(admin ? 'all' : 'self');
    })();
  }, [user?.id, admin]);

  const activeId = useMemo(() => {
    if (!admin) return meTeamId;
    if (filter === 'all') return null;
    if (filter === 'self') return meTeamId;
    return filter;
  }, [filter, admin, meTeamId]);

  const weekDays = useMemo(() => {
    const s = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [cursor]);

  const byDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appts
      .filter(a => a.status !== 'cancelled')
      .filter(a => !activeId || a.attorney_id === activeId)
      .forEach(a => {
        const k = new Date(a.starts_at).toDateString();
        (map[k] = map[k] || []).push(a);
      });
    return map;
  }, [appts, activeId]);

  const rangeLabel = `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden mt-6">
      <div className="p-5 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10"><Calendar className="w-5 h-5 text-accent" /></div>
          <div>
            <h3 className="font-serif font-semibold text-foreground">Agenda da semana</h3>
            <p className="text-xs text-muted-foreground">{rangeLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter} disabled={!admin}>
            <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {admin && <SelectItem value="all">Toda a equipe</SelectItem>}
              <SelectItem value="self">Somente eu</SelectItem>
              {admin && members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setCursor(addDays(cursor, -7))}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(addDays(cursor, 7))}><ChevronRight className="w-4 h-4" /></Button>
          <Link to="/admin/agenda" className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Abrir <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 p-3">
        {weekDays.map((d, i) => {
          const list = byDay[d.toDateString()] ?? [];
          const isToday = sameDay(d, new Date());
          const isFree = list.length === 0;
          return (
            <div key={i} className={`border rounded-lg p-2 min-h-[160px] ${isToday ? 'border-accent bg-accent/5' : 'border-border'}`}>
              <div className="mb-2">
                <div className="text-[10px] uppercase text-muted-foreground">{WEEKDAYS[d.getDay()]}</div>
                <div className={`text-base font-semibold ${isToday ? 'text-accent' : ''}`}>{d.getDate()}</div>
                {admin && (
                  <div className={`text-[9px] mt-0.5 font-medium ${isFree ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {isFree ? 'LIVRE' : `${list.length} compromisso${list.length > 1 ? 's' : ''}`}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                {list.slice(0, 5).map(a => {
                  const member = members.find(m => m.id === a.attorney_id);
                  return (
                    <Link key={a.id} to="/admin/agenda" className="block rounded px-1.5 py-1 text-[10px] bg-muted/50 hover:bg-muted transition-colors">
                      <div className="font-medium truncate">{fmtTime(a.starts_at)} · {a.title}</div>
                      {admin && member && <div className="text-muted-foreground truncate">{member.full_name}</div>}
                    </Link>
                  );
                })}
                {list.length > 5 && <div className="text-[10px] text-muted-foreground px-1">+{list.length - 5}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyAgendaWidget;
