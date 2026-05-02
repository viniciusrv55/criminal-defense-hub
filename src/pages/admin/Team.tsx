import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { UserPlus, Save, X, Trash2, Edit, ShieldCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/supabase-helpers';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  role_title: string | null;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
}

interface StagePerm {
  id: string;
  stage: string;
  team_member_id: string;
  can_act: boolean;
}

const KANBAN_STAGES = [
  { key: 'new', label: 'Novos' },
  { key: 'contacted', label: 'Contatado' },
  { key: 'in_progress', label: 'Em Atendimento' },
  { key: 'proposal', label: 'Proposta' },
  { key: 'closed', label: 'Finalizado' },
];

const Team = () => {
  const { isSuperAdmin } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [perms, setPerms] = useState<StagePerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role_title: '', specialty: '', phone: '' });

  const fetchAll = async () => {
    const { data: tm } = await db.from('team_members').select('*').order('full_name');
    const { data: kp } = await db.from('kanban_stage_permissions').select('*');
    setMembers(tm ?? []);
    setPerms(kp ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.password) {
      toast({ title: 'Preencha nome, e-mail e senha', variant: 'destructive' });
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name }, emailRedirectTo: `${window.location.origin}/admin` },
    });
    if (authError || !authData.user) {
      toast({ title: 'Erro ao criar usuário', description: authError?.message, variant: 'destructive' });
      return;
    }

    await db.from('user_roles').insert({ user_id: authData.user.id, role: 'team_member' });
    const { error: tmError } = await db.from('team_members').insert({
      user_id: authData.user.id,
      full_name: form.full_name,
      email: form.email,
      role_title: form.role_title || null,
      specialty: form.specialty || null,
      phone: form.phone || null,
    });
    if (tmError) { toast({ title: 'Erro', description: tmError.message, variant: 'destructive' }); return; }

    toast({ title: 'Membro cadastrado!' });
    setShowAdd(false);
    setForm({ full_name: '', email: '', password: '', role_title: '', specialty: '', phone: '' });
    fetchAll();
  };

  const removeMember = async (m: TeamMember) => {
    if (!confirm(`Remover ${m.full_name} da equipe?`)) return;
    await db.from('team_members').delete().eq('id', m.id);
    await db.from('user_roles').delete().eq('user_id', m.user_id).eq('role', 'team_member');
    toast({ title: 'Removido' });
    fetchAll();
  };

  const toggleActive = async (m: TeamMember) => {
    await db.from('team_members').update({ active: !m.active }).eq('id', m.id);
    fetchAll();
  };

  const togglePerm = async (memberId: string, stage: string, currentlyOn: boolean) => {
    if (currentlyOn) {
      await db.from('kanban_stage_permissions').delete().eq('team_member_id', memberId).eq('stage', stage);
    } else {
      await db.from('kanban_stage_permissions').insert({ team_member_id: memberId, stage, can_act: true });
    }
    fetchAll();
  };

  const hasPerm = (memberId: string, stage: string) =>
    perms.some(p => p.team_member_id === memberId && p.stage === stage && p.can_act);

  if (!isSuperAdmin()) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Apenas Super Admins podem gerenciar a equipe.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Equipe</h1>
          <p className="text-muted-foreground text-sm mt-1">Membros do escritório e suas permissões no Kanban</p>
        </div>
        {!showAdd && (
          <Button onClick={() => setShowAdd(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <UserPlus className="w-4 h-4 mr-2" /> Novo Membro
          </Button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="mb-8 p-6 bg-card rounded-xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-foreground">Cadastrar membro</h2>
            <button type="button" onClick={() => setShowAdd(false)} className="text-muted-foreground"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2"><Label className="text-foreground">Nome *</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="bg-background" /></div>
            <div className="space-y-2"><Label className="text-foreground">E-mail *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-background" /></div>
            <div className="space-y-2"><Label className="text-foreground">Senha inicial *</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="bg-background" /></div>
            <div className="space-y-2"><Label className="text-foreground">Cargo</Label><Input value={form.role_title} onChange={e => setForm({ ...form, role_title: e.target.value })} placeholder="Advogado, Estagiário, Recepção..." className="bg-background" /></div>
            <div className="space-y-2"><Label className="text-foreground">Especialidade</Label><Input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} className="bg-background" /></div>
            <div className="space-y-2"><Label className="text-foreground">Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-background" /></div>
          </div>
          <div className="flex gap-3">
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90"><Save className="w-4 h-4 mr-2" />Cadastrar</Button>
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border"><p className="text-muted-foreground">Nenhum membro cadastrado</p></div>
      ) : (
        <div className="space-y-4">
          {members.map(m => (
            <div key={m.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-foreground">{m.full_name}</h3>
                    {!m.active && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inativo</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[m.role_title, m.specialty, m.email].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 mr-3">
                    <Switch checked={m.active} onCheckedChange={() => toggleActive(m)} />
                    <Label className="text-xs text-muted-foreground">Ativo</Label>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(editingId === m.id ? null : m.id)}>
                    <ShieldCheck className="w-4 h-4 mr-1" /> Permissões
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeMember(m)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>

              {editingId === m.id && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-3">Selecione em quais etapas do Kanban este membro pode atuar (mover/editar leads). Mesmo com a permissão, ele só pode mexer em leads onde está como responsável.</p>
                  <div className="grid sm:grid-cols-5 gap-2">
                    {KANBAN_STAGES.map(s => {
                      const on = hasPerm(m.id, s.key);
                      return (
                        <button
                          key={s.key}
                          onClick={() => togglePerm(m.id, s.key, on)}
                          className={`text-xs px-3 py-2 rounded-lg border transition-colors ${on ? 'bg-accent text-accent-foreground border-accent' : 'bg-background text-muted-foreground border-border hover:border-accent/50'}`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default Team;
