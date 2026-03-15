import { useEffect, useState } from 'react';
import { db } from '@/lib/supabase-helpers';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Save, X, GripVertical } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { PracticeArea } from '@/types/database';

const ICON_OPTIONS = [
  'Gavel', 'Shield', 'Clock', 'AlertTriangle', 'FileText', 'Scale',
  'BookOpen', 'Briefcase', 'Lock', 'Users', 'Eye', 'Heart',
];

const PracticeAreasAdmin = () => {
  const [areas, setAreas] = useState<PracticeArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', icon_name: 'Gavel', icon_svg: '', icon_color: '#d1a967', sort_order: 0, active: true });

  const fetchAreas = async () => {
    const { data, error } = await db.from('practice_areas').select('*').order('sort_order');
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
    else { setAreas(data ?? []); }
    setLoading(false);
  };

  useEffect(() => { fetchAreas(); }, []);

  const resetForm = () => {
    setForm({ title: '', description: '', icon_name: 'Gavel', icon_svg: '', icon_color: '#d1a967', sort_order: 0, active: true });
    setEditingId(null); setShowForm(false);
  };

  const startEdit = (area: PracticeArea) => {
    setForm({ title: area.title, description: area.description ?? '', icon_name: area.icon_name ?? 'Gavel', icon_svg: area.icon_svg ?? '', icon_color: area.icon_color, sort_order: area.sort_order, active: area.active });
    setEditingId(area.id); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast({ title: 'Preencha o título', variant: 'destructive' }); return; }
    const data = { ...form, updated_at: new Date().toISOString() };
    let error;
    if (editingId) { ({ error } = await db.from('practice_areas').update(data).eq('id', editingId)); }
    else { ({ error } = await db.from('practice_areas').insert({ ...data, sort_order: areas.length })); }
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); }
    else { toast({ title: editingId ? 'Área atualizada!' : 'Área criada!' }); resetForm(); fetchAreas(); }
  };

  const deleteArea = async (id: string) => {
    if (!confirm('Excluir esta área de atuação?')) return;
    const { error } = await db.from('practice_areas').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
    else { fetchAreas(); toast({ title: 'Área excluída' }); }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Áreas de Atuação</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie as áreas exibidas no site</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="w-4 h-4 mr-2" />Nova Área
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 bg-card rounded-xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-foreground">{editingId ? 'Editar Área' : 'Nova Área'}</h2>
            <button type="button" onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Título *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Direito Penal" className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Ícone (Lucide)</Label>
              <select value={form.icon_name} onChange={e => setForm(p => ({ ...p, icon_name: e.target.value }))} className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm">
                {ICON_OPTIONS.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Descrição</Label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descrição..." rows={3} className="bg-background" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Cor do Ícone</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.icon_color} onChange={e => setForm(p => ({ ...p, icon_color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0" />
                <Input value={form.icon_color} onChange={e => setForm(p => ({ ...p, icon_color: e.target.value }))} className="bg-background" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">SVG Custom (opcional)</Label>
              <Textarea value={form.icon_svg} onChange={e => setForm(p => ({ ...p, icon_svg: e.target.value }))} placeholder="Cole o SVG..." rows={2} className="bg-background font-mono text-xs" />
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90"><Save className="w-4 h-4 mr-2" />{editingId ? 'Atualizar' : 'Criar'}</Button>
            <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : areas.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border"><p className="text-muted-foreground">Nenhuma área cadastrada</p></div>
      ) : (
        <div className="space-y-3">
          {areas.map(area => (
            <div key={area.id} className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
              <div className="flex items-center gap-4">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${area.icon_color}20` }}>
                  {area.icon_svg ? (
                    <div className="w-5 h-5" style={{ color: area.icon_color }} dangerouslySetInnerHTML={{ __html: area.icon_svg }} />
                  ) : (
                    <span style={{ color: area.icon_color }} className="text-xs font-bold">{area.icon_name?.charAt(0) ?? '?'}</span>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{area.title}</h3>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">{area.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${area.active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>{area.active ? 'Ativa' : 'Inativa'}</span>
                <Button variant="ghost" size="sm" onClick={() => startEdit(area)}><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => deleteArea(area.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default PracticeAreasAdmin;
