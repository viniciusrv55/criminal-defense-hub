import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Save, Trash2, X, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/supabase-helpers';
import { useAuth } from '@/hooks/useAuth';

interface Queue {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  active: boolean;
  team_member_id: string | null;
}
interface TeamMember { id: string; full_name: string; active: boolean; }
interface QueueMember { id: string; queue_id: string; team_member_id: string; }

const Queues = () => {
  const { isAdmin } = useAuth();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [members, setMembers] = useState<QueueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const fetchAll = async () => {
    const [{ data: qs }, { data: tm }, { data: qm }] = await Promise.all([
      db.from('whatsapp_queues').select('id,name,color,sort_order,active,team_member_id').order('sort_order'),
      db.from('team_members').select('id,full_name,active').eq('active', true).order('full_name'),
      db.from('whatsapp_queue_members').select('id,queue_id,team_member_id'),
    ]);
    setQueues(qs ?? []);
    setTeam(tm ?? []);
    setMembers(qm ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const createQueue = async () => {
    if (!newName.trim()) return;
    const maxSort = Math.max(0, ...queues.map(q => q.sort_order));
    const { error } = await db.from('whatsapp_queues').insert({ name: newName.trim(), sort_order: maxSort + 1, active: true });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setNewName('');
    toast({ title: 'Fila criada' });
    fetchAll();
  };

  const updateQueue = async (id: string, patch: Partial<Queue>) => {
    const { error } = await db.from('whatsapp_queues').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else fetchAll();
  };

  const removeQueue = async (q: Queue) => {
    if (!confirm(`Remover a fila "${q.name}"? As conversas atribuídas a ela perderão o vínculo.`)) return;
    const { error } = await db.from('whatsapp_queues').delete().eq('id', q.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Removida' }); fetchAll(); }
  };

  const toggleMember = async (queueId: string, memberId: string) => {
    const existing = members.find(m => m.queue_id === queueId && m.team_member_id === memberId);
    if (existing) {
      await db.from('whatsapp_queue_members').delete().eq('id', existing.id);
    } else {
      await db.from('whatsapp_queue_members').insert({ queue_id: queueId, team_member_id: memberId });
    }
    fetchAll();
  };

  const memberIn = (queueId: string, memberId: string) =>
    members.some(m => m.queue_id === queueId && m.team_member_id === memberId);

  if (!isAdmin()) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Apenas administradores podem gerenciar filas.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-foreground">Filas de Atendimento</h1>
        <p className="text-muted-foreground text-sm mt-1">Crie filas (ex: Comercial, Suporte, Cível) e direcione membros da equipe para cada uma.</p>
      </div>

      <div className="mb-6 p-4 bg-card border border-border rounded-xl flex gap-3">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome da nova fila"
          onKeyDown={(e) => { if (e.key === 'Enter') createQueue(); }}
          className="bg-background"
        />
        <Button onClick={createQueue} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" /> Criar fila
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : queues.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <p className="text-muted-foreground">Nenhuma fila cadastrada</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queues.map(q => {
            const isPersonal = !!q.team_member_id;
            const attorney = isPersonal ? team.find(t => t.id === q.team_member_id) : null;
            return (
            <div key={q.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px] space-y-2">
                  <Input
                    value={q.name}
                    onChange={(e) => setQueues(qs => qs.map(x => x.id === q.id ? { ...x, name: e.target.value } : x))}
                    onBlur={(e) => { if (e.target.value !== q.name) return; updateQueue(q.id, { name: e.target.value }); }}
                    className="bg-background font-medium"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    {isPersonal ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                        Pessoal · {attorney?.full_name ?? 'Advogado'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                        Fila Geral / compartilhada
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground">{members.filter(m => m.queue_id === q.id).length} membro(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={q.active} onCheckedChange={(v) => updateQueue(q.id, { active: v })} />
                    <Label className="text-xs text-muted-foreground">Ativa</Label>
                  </div>
                  {!isPersonal && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(editing === q.id ? null : q.id)}>
                      <Users className="w-4 h-4 mr-1" /> Membros
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => updateQueue(q.id, { name: q.name })} title="Salvar nome">
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeQueue(q)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {editing === q.id && !isPersonal && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-3">Selecione quem atende esta fila:</p>
                  <div className="flex flex-wrap gap-2">
                    {team.map(t => {
                      const on = memberIn(q.id, t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleMember(q.id, t.id)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${on ? 'bg-accent text-accent-foreground border-accent' : 'bg-background text-muted-foreground border-border hover:border-accent/50'}`}
                        >
                          {t.full_name}
                        </button>
                      );
                    })}
                    {team.length === 0 && <span className="text-xs text-muted-foreground">Cadastre membros em Equipe.</span>}
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
};

export default Queues;
