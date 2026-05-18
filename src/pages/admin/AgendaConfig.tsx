import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ApptType { id: string; name: string; duration_minutes: number; color: string; default_location: string | null; active: boolean; sort_order: number; }
interface Member { id: string; full_name: string; }
interface Avail { id: string; team_member_id: string; weekday: number; start_time: string; end_time: string; active: boolean; }
interface Block { id: string; team_member_id: string | null; starts_at: string; ends_at: string; reason: string | null; }

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function AgendaConfig() {
  const [types, setTypes] = useState<ApptType[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [avail, setAvail] = useState<Avail[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('');

  async function reload() {
    const [t, m, a, b] = await Promise.all([
      supabase.from('appointment_types').select('*').order('sort_order'),
      supabase.from('team_members').select('id, full_name').eq('active', true).order('full_name'),
      supabase.from('appointment_availability').select('*'),
      supabase.from('appointment_blocks').select('*').order('starts_at'),
    ]);
    setTypes((t.data ?? []) as ApptType[]);
    const ms = (m.data ?? []) as Member[];
    setMembers(ms);
    if (ms[0] && !selectedMember) setSelectedMember(ms[0].id);
    setAvail((a.data ?? []) as Avail[]);
    setBlocks((b.data ?? []) as Block[]);
  }

  useEffect(() => { void reload(); }, []);

  // Types
  async function addType() {
    const { error } = await supabase.from('appointment_types').insert({ name: 'Novo tipo', duration_minutes: 30, color: '#d1a967', sort_order: types.length });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else reload();
  }
  async function updateType(id: string, patch: Partial<ApptType>) {
    await supabase.from('appointment_types').update(patch).eq('id', id);
    reload();
  }
  async function deleteType(id: string) {
    if (!confirm('Excluir tipo?')) return;
    await supabase.from('appointment_types').delete().eq('id', id);
    reload();
  }

  // Availability
  async function addSlot(weekday: number) {
    if (!selectedMember) return;
    await supabase.from('appointment_availability').insert({
      team_member_id: selectedMember, weekday, start_time: '09:00', end_time: '18:00', active: true,
    });
    reload();
  }
  async function updateSlot(id: string, patch: Partial<Avail>) {
    await supabase.from('appointment_availability').update(patch).eq('id', id); reload();
  }
  async function deleteSlot(id: string) {
    await supabase.from('appointment_availability').delete().eq('id', id); reload();
  }

  // Blocks
  async function addBlock() {
    const now = new Date(); now.setMinutes(0,0,0);
    const end = new Date(now.getTime() + 3600000);
    await supabase.from('appointment_blocks').insert({
      team_member_id: selectedMember || null,
      starts_at: now.toISOString(), ends_at: end.toISOString(), reason: 'Bloqueio',
    });
    reload();
  }
  async function deleteBlock(id: string) {
    await supabase.from('appointment_blocks').delete().eq('id', id); reload();
  }

  const memberSlots = avail.filter(a => a.team_member_id === selectedMember);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Configurações da Agenda</h1>
          <p className="text-sm text-muted-foreground">Tipos de compromisso, disponibilidade e bloqueios</p>
        </div>

        <Tabs defaultValue="types">
          <TabsList>
            <TabsTrigger value="types">Tipos</TabsTrigger>
            <TabsTrigger value="availability">Disponibilidade</TabsTrigger>
            <TabsTrigger value="blocks">Bloqueios</TabsTrigger>
          </TabsList>

          <TabsContent value="types" className="space-y-3">
            <div className="flex justify-end"><Button onClick={addType}><Plus className="w-4 h-4 mr-2" />Novo tipo</Button></div>
            <div className="grid gap-2">
              {types.map(t => (
                <div key={t.id} className="grid grid-cols-12 gap-2 items-center border rounded p-3 bg-card">
                  <Input className="col-span-4" value={t.name} onChange={e => updateType(t.id, { name: e.target.value })} />
                  <div className="col-span-2 flex items-center gap-2">
                    <Input type="number" value={t.duration_minutes} onChange={e => updateType(t.id, { duration_minutes: Number(e.target.value) })} />
                    <span className="text-xs">min</span>
                  </div>
                  <Input className="col-span-2" type="color" value={t.color} onChange={e => updateType(t.id, { color: e.target.value })} />
                  <Input className="col-span-3" placeholder="Local padrão" value={t.default_location ?? ''} onChange={e => updateType(t.id, { default_location: e.target.value })} />
                  <div className="col-span-1 flex justify-end gap-1">
                    <Switch checked={t.active} onCheckedChange={v => updateType(t.id, { active: v })} />
                    <Button variant="ghost" size="icon" onClick={() => deleteType(t.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="availability" className="space-y-4">
            <div className="max-w-sm">
              <Label>Membro da equipe</Label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-3">
              {WEEKDAYS.map((day, idx) => {
                const slots = memberSlots.filter(s => s.weekday === idx);
                return (
                  <div key={idx} className="border rounded p-3 bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{day}</span>
                      <Button size="sm" variant="outline" onClick={() => addSlot(idx)}><Plus className="w-3 h-3 mr-1" />Janela</Button>
                    </div>
                    <div className="space-y-2">
                      {slots.length === 0 && <p className="text-xs text-muted-foreground">Indisponível</p>}
                      {slots.map(s => (
                        <div key={s.id} className="flex items-center gap-2">
                          <Input type="time" value={s.start_time.slice(0,5)} onChange={e => updateSlot(s.id, { start_time: `${e.target.value}:00` })} className="w-32" />
                          <span>até</span>
                          <Input type="time" value={s.end_time.slice(0,5)} onChange={e => updateSlot(s.id, { end_time: `${e.target.value}:00` })} className="w-32" />
                          <Switch checked={s.active} onCheckedChange={v => updateSlot(s.id, { active: v })} />
                          <Button variant="ghost" size="icon" onClick={() => deleteSlot(s.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="blocks" className="space-y-3">
            <div className="flex justify-end"><Button onClick={addBlock}><Plus className="w-4 h-4 mr-2" />Novo bloqueio</Button></div>
            <div className="grid gap-2">
              {blocks.map(b => (
                <div key={b.id} className="grid grid-cols-12 gap-2 items-center border rounded p-3 bg-card">
                  <Input className="col-span-3" type="datetime-local" value={b.starts_at.slice(0,16)} onChange={e => { supabase.from('appointment_blocks').update({ starts_at: new Date(e.target.value).toISOString() }).eq('id', b.id).then(reload); }} />
                  <Input className="col-span-3" type="datetime-local" value={b.ends_at.slice(0,16)} onChange={e => { supabase.from('appointment_blocks').update({ ends_at: new Date(e.target.value).toISOString() }).eq('id', b.id).then(reload); }} />
                  <Select value={b.team_member_id ?? 'all'} onValueChange={v => { supabase.from('appointment_blocks').update({ team_member_id: v === 'all' ? null : v }).eq('id', b.id).then(reload); }}>
                    <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toda equipe</SelectItem>
                      {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="col-span-2" value={b.reason ?? ''} placeholder="Motivo" onChange={e => { supabase.from('appointment_blocks').update({ reason: e.target.value }).eq('id', b.id).then(reload); }} />
                  <Button variant="ghost" size="icon" className="col-span-1" onClick={() => deleteBlock(b.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
