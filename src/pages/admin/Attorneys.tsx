import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Save, X, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/supabase-helpers';
import { supabase } from '@/integrations/supabase/client';
import { usePracticeAreas } from '@/hooks/usePracticeAreas';
import { useAuth } from '@/hooks/useAuth';
import type { Profile, AttorneyPermission } from '@/types/database';

interface AttorneyData {
  profile: Profile;
  permissions: AttorneyPermission | null;
}

const Attorneys = () => {
  const [attorneys, setAttorneys] = useState<AttorneyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const { areas } = usePracticeAreas();
  const { isSuperAdmin } = useAuth();

  const [permForm, setPermForm] = useState({
    can_view: true, can_create: false, can_delete: false, practice_area_ids: [] as string[],
  });

  const fetchAttorneys = async () => {
    // Get all users with attorney role
    const { data: roles } = await db.from('user_roles').select('user_id').eq('role', 'attorney');
    if (!roles || roles.length === 0) { setAttorneys([]); setLoading(false); return; }

    const userIds = roles.map((r: { user_id: string }) => r.user_id);
    const { data: profiles } = await db.from('profiles').select('*').in('user_id', userIds);
    const { data: perms } = await db.from('attorney_permissions').select('*').in('user_id', userIds);

    const result: AttorneyData[] = (profiles ?? []).map((p: Profile) => ({
      profile: p,
      permissions: (perms ?? []).find((perm: AttorneyPermission) => perm.user_id === p.user_id) ?? null,
    }));

    setAttorneys(result);
    setLoading(false);
  };

  useEffect(() => { fetchAttorneys(); }, []);

  const handleCreateAttorney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newName) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    // Create user via edge function would be ideal, but for now use admin API approach
    // Since we can't create users from client, we'll use signUp
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
      options: { data: { full_name: newName } },
    });

    if (authError || !authData.user) {
      toast({ title: 'Erro ao criar usuário', description: authError?.message, variant: 'destructive' });
      return;
    }

    // Assign attorney role
    await db.from('user_roles').insert({ user_id: authData.user.id, role: 'attorney' });

    // Create permissions
    await db.from('attorney_permissions').insert({
      user_id: authData.user.id,
      ...permForm,
    });

    toast({ title: 'Advogado cadastrado!' });
    setShowAddForm(false);
    setNewEmail(''); setNewPassword(''); setNewName('');
    setPermForm({ can_view: true, can_create: false, can_delete: false, practice_area_ids: [] });
    fetchAttorneys();
  };

  const updatePermissions = async (userId: string) => {
    const { error } = await db.from('attorney_permissions').upsert({
      user_id: userId,
      ...permForm,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Permissões atualizadas!' });
      setEditingId(null);
      fetchAttorneys();
    }
  };

  const removeAttorney = async (userId: string) => {
    if (!confirm('Remover este advogado do sistema?')) return;
    await db.from('user_roles').delete().eq('user_id', userId).eq('role', 'attorney');
    await db.from('attorney_permissions').delete().eq('user_id', userId);
    toast({ title: 'Advogado removido' });
    fetchAttorneys();
  };

  const startEdit = (atty: AttorneyData) => {
    setEditingId(atty.profile.user_id);
    setPermForm({
      can_view: atty.permissions?.can_view ?? true,
      can_create: atty.permissions?.can_create ?? false,
      can_delete: atty.permissions?.can_delete ?? false,
      practice_area_ids: atty.permissions?.practice_area_ids ?? [],
    });
  };

  if (!isSuperAdmin()) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Apenas Super Admins podem gerenciar advogados.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Advogados</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie a equipe e permissões</p>
        </div>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <UserPlus className="w-4 h-4 mr-2" /> Novo Advogado
          </Button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateAttorney} className="mb-8 p-6 bg-card rounded-xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-foreground">Cadastrar Advogado</h2>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-muted-foreground"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Nome *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome completo" className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">E-mail *</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@exemplo.com" className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Senha *</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Senha inicial" className="bg-background" />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Permissões</h3>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={permForm.can_view} onCheckedChange={v => setPermForm(p => ({ ...p, can_view: v }))} />
                <Label className="text-foreground text-sm">Visualizar</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={permForm.can_create} onCheckedChange={v => setPermForm(p => ({ ...p, can_create: v }))} />
                <Label className="text-foreground text-sm">Cadastrar</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={permForm.can_delete} onCheckedChange={v => setPermForm(p => ({ ...p, can_delete: v }))} />
                <Label className="text-foreground text-sm">Deletar</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground text-sm">Áreas de Atuação</Label>
            <div className="flex flex-wrap gap-2">
              {areas.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setPermForm(p => ({
                    ...p,
                    practice_area_ids: p.practice_area_ids.includes(a.id)
                      ? p.practice_area_ids.filter(id => id !== a.id)
                      : [...p.practice_area_ids, a.id],
                  }))}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${permForm.practice_area_ids.includes(a.id) ? 'bg-accent text-accent-foreground border-accent' : 'bg-background text-muted-foreground border-border hover:border-accent/50'}`}
                >
                  {a.title}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Save className="w-4 h-4 mr-2" /> Cadastrar
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : attorneys.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <p className="text-muted-foreground">Nenhum advogado cadastrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {attorneys.map(atty => (
            <div key={atty.profile.user_id} className="p-4 bg-card rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">{atty.profile.full_name || 'Sem nome'}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {atty.permissions && (
                      <>
                        {atty.permissions.can_view && <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Visualizar</span>}
                        {atty.permissions.can_create && <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">Cadastrar</span>}
                        {atty.permissions.can_delete && <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">Deletar</span>}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(atty)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => removeAttorney(atty.profile.user_id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>

              {editingId === atty.profile.user_id && (
                <div className="mt-4 pt-4 border-t border-border space-y-4">
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Switch checked={permForm.can_view} onCheckedChange={v => setPermForm(p => ({ ...p, can_view: v }))} />
                      <Label className="text-foreground text-sm">Visualizar</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={permForm.can_create} onCheckedChange={v => setPermForm(p => ({ ...p, can_create: v }))} />
                      <Label className="text-foreground text-sm">Cadastrar</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={permForm.can_delete} onCheckedChange={v => setPermForm(p => ({ ...p, can_delete: v }))} />
                      <Label className="text-foreground text-sm">Deletar</Label>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {areas.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setPermForm(p => ({
                          ...p,
                          practice_area_ids: p.practice_area_ids.includes(a.id)
                            ? p.practice_area_ids.filter(id => id !== a.id)
                            : [...p.practice_area_ids, a.id],
                        }))}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${permForm.practice_area_ids.includes(a.id) ? 'bg-accent text-accent-foreground border-accent' : 'bg-background text-muted-foreground border-border hover:border-accent/50'}`}
                      >
                        {a.title}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updatePermissions(atty.profile.user_id)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                      <Save className="w-4 h-4 mr-2" /> Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
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

export default Attorneys;
