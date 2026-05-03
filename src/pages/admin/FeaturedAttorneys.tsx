import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/supabase-helpers';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { useFeaturedAttorneys, type FeaturedAttorney } from '@/hooks/useFeaturedAttorneys';

const empty = (): Partial<FeaturedAttorney> => ({
  full_name: '', specialty: '', oab_number: '', photo_url: '', sort_order: 0, active: true,
});

const FeaturedAttorneysAdmin = () => {
  const { attorneys, refresh } = useFeaturedAttorneys(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FeaturedAttorney | null>(null);
  const [form, setForm] = useState<Partial<FeaturedAttorney>>(empty());

  const openNew = () => { setEditing(null); setForm({ ...empty(), sort_order: attorneys.length }); setOpen(true); };
  const openEdit = (a: FeaturedAttorney) => { setEditing(a); setForm({ ...a }); setOpen(true); };
  const upd = <K extends keyof FeaturedAttorney>(k: K, v: FeaturedAttorney[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.full_name?.trim()) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    const payload = { ...form, updated_at: new Date().toISOString() };
    let error;
    if (editing) ({ error } = await db.from('featured_attorneys').update(payload).eq('id', editing.id));
    else ({ error } = await db.from('featured_attorneys').insert(payload));
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: editing ? 'Atualizado' : 'Cadastrado' }); setOpen(false); refresh(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este advogado?')) return;
    const { error } = await db.from('featured_attorneys').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Excluído' }); refresh(); }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Advogados em Destaque</h1>
          <p className="text-muted-foreground text-sm mt-1">Aparecem na página de Contato e na home (carrossel automático).</p>
        </div>
        <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="w-4 h-4 mr-2" />Novo Advogado</Button>
      </div>

      {attorneys.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border"><p className="text-muted-foreground">Nenhum advogado cadastrado</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {attorneys.map(a => (
            <div key={a.id} className="bg-card rounded-xl border border-border p-5 flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0 border border-accent/30">
                {a.photo_url ? <img src={a.photo_url} alt={a.full_name} className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{a.full_name}</p>
                {a.specialty && <p className="text-xs text-accent truncate">{a.specialty}</p>}
                {a.oab_number && <p className="text-xs text-muted-foreground">OAB {a.oab_number}</p>}
                {!a.active && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Inativo</span>}
              </div>
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar Advogado' : 'Novo Advogado'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <ImageUploadField label="Foto do advogado" value={form.photo_url || ''} onUploaded={url => upd('photo_url', url)} hint="Recomendado: foto quadrada (será exibida em formato circular)" folder="attorneys" bucket="site-assets" />
            <div><Label>Nome completo *</Label><Input value={form.full_name || ''} onChange={e => upd('full_name', e.target.value)} /></div>
            <div><Label>Especialidade</Label><Input value={form.specialty || ''} onChange={e => upd('specialty', e.target.value)} placeholder="Ex: Direito Penal" /></div>
            <div><Label>Número da OAB</Label><Input value={form.oab_number || ''} onChange={e => upd('oab_number', e.target.value)} placeholder="Ex: SP 123.456" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Ordem</Label><Input type="number" value={form.sort_order ?? 0} onChange={e => upd('sort_order', parseInt(e.target.value) || 0)} /></div>
              <div className="flex items-center gap-2 pt-7"><Switch checked={!!form.active} onCheckedChange={v => upd('active', v)} /><Label>Visível</Label></div>
            </div>
            <Button onClick={handleSave} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">{editing ? 'Salvar' : 'Cadastrar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default FeaturedAttorneysAdmin;
