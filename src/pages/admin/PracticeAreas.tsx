import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/supabase-helpers';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, ImageIcon, ExternalLink, Star } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { MultiImageUploadField } from '@/components/admin/MultiImageUploadField';
import { slugify } from '@/lib/slug';
import type { PracticeArea } from '@/types/database';

const ICON_OPTIONS = ['Gavel', 'Shield', 'Clock', 'AlertTriangle', 'FileText', 'Scale', 'BookOpen', 'Briefcase', 'Lock', 'Users', 'Eye', 'Heart'];

const empty = (): Partial<PracticeArea> => ({
  slug: '', title: '', subtitle: '', description: '', content: '',
  cover_image_url: '', gallery: [],
  icon_name: 'Gavel', icon_color: '#d1a967', icon_svg: '',
  whatsapp_message: '', cta_button_text: 'Solicitar Atendimento via WhatsApp',
  youtube_url: '',
  sort_order: 0, active: true, featured: false,
});

const PracticeAreasAdmin = () => {
  const [areas, setAreas] = useState<PracticeArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PracticeArea | null>(null);
  const [form, setForm] = useState<Partial<PracticeArea>>(empty());

  const fetchAreas = async () => {
    const { data, error } = await db.from('practice_areas').select('*').order('sort_order');
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else setAreas((data ?? []).map((r: Record<string, unknown>) => ({ ...(r as unknown as PracticeArea), gallery: Array.isArray(r.gallery) ? (r.gallery as string[]) : [] })));
    setLoading(false);
  };

  useEffect(() => { fetchAreas(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...empty(), sort_order: areas.length }); setOpen(true); };
  const openEdit = (a: PracticeArea) => { setEditing(a); setForm({ ...a }); setOpen(true); };
  const upd = <K extends keyof PracticeArea>(k: K, v: PracticeArea[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title?.trim()) { toast({ title: 'Título obrigatório', variant: 'destructive' }); return; }
    const slug = (form.slug?.trim() || slugify(form.title));
    const payload = { ...form, slug, updated_at: new Date().toISOString() };
    let error;
    if (editing) ({ error } = await db.from('practice_areas').update(payload).eq('id', editing.id));
    else ({ error } = await db.from('practice_areas').insert(payload));
    if (error) {
      toast({ title: error.message?.includes('duplicate') ? 'Já existe uma área com esse slug' : 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editing ? 'Área atualizada' : 'Área criada' });
      setOpen(false); fetchAreas();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta área? Esta ação não pode ser desfeita.')) return;
    const { error } = await db.from('practice_areas').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Área excluída' }); fetchAreas(); }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Área de Atuação</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastre cada área com imagem de destaque, conteúdo e galeria. Marque "Destaque" para aparecer no topo da home.</p>
        </div>
        <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="w-4 h-4 mr-2" />Nova Área</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : areas.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border"><p className="text-muted-foreground">Nenhuma área cadastrada</p></div>
      ) : (
        <div className="space-y-3">
          {areas.map(a => (
            <div key={a.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4 flex-wrap">
              {a.cover_image_url ? (
                <img src={a.cover_image_url} alt={a.title} className="w-24 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-24 h-16 rounded-lg bg-muted flex items-center justify-center"><ImageIcon className="w-6 h-6 text-muted-foreground" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">{a.title}</span>
                  {a.featured && <Star className="w-4 h-4 text-accent fill-accent" />}
                </div>
                <div className="text-xs text-muted-foreground truncate">/areas/{a.slug}</div>
                {a.subtitle && <div className="text-sm text-muted-foreground line-clamp-1">{a.subtitle}</div>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${a.active ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'}`}>{a.active ? 'Ativa' : 'Inativa'}</span>
              {a.slug && (
                <Link to={`/areas/${a.slug}`} target="_blank">
                  <Button variant="ghost" size="sm"><ExternalLink className="w-4 h-4" /></Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Área' : 'Nova Área'}</DialogTitle></DialogHeader>
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="basic">Geral</TabsTrigger>
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="gallery">Galeria & Vídeo</TabsTrigger>
              <TabsTrigger value="icon">Ícone</TabsTrigger>
              <TabsTrigger value="cta">WhatsApp / CTA</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-3">
              <div><Label>Título *</Label><Input value={form.title || ''} onChange={e => upd('title', e.target.value)} placeholder="Ex: Direito Penal" /></div>
              <div><Label>Subtítulo (chamada curta)</Label><Input value={form.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} /></div>
              <div><Label>Descrição (resumo no card)</Label><Textarea value={form.description || ''} onChange={e => upd('description', e.target.value)} rows={3} /></div>
              <ImageUploadField label="Imagem de destaque (capa)" value={form.cover_image_url || ''} onUploaded={url => upd('cover_image_url', url)} hint="Recomendado: 1600×1000px (JPG/WebP)" folder="cover" />
              <div>
                <Label>Slug (URL)</Label>
                <Input value={form.slug || ''} onChange={e => upd('slug', e.target.value)} placeholder="gerado automaticamente" />
                <p className="text-xs text-muted-foreground mt-1">URL final: /areas/{form.slug || slugify(form.title || '')}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Ordem</Label><Input type="number" value={form.sort_order ?? 0} onChange={e => upd('sort_order', parseInt(e.target.value) || 0)} /></div>
                <div className="flex items-center gap-2 pt-7"><input type="checkbox" id="a-active" checked={!!form.active} onChange={e => upd('active', e.target.checked)} /><Label htmlFor="a-active">Visível</Label></div>
                <div className="flex items-center gap-2 pt-7"><input type="checkbox" id="a-featured" checked={!!form.featured} onChange={e => upd('featured', e.target.checked)} /><Label htmlFor="a-featured">Destaque na home</Label></div>
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-3">
              <div><Label>Conteúdo completo (página da área)</Label><Textarea value={form.content || ''} onChange={e => upd('content', e.target.value)} rows={12} placeholder="Texto completo que aparecerá na página dedicada desta área..." /></div>
            </TabsContent>

            <TabsContent value="gallery" className="space-y-3">
              <MultiImageUploadField label="Galeria de imagens" value={form.gallery || []} onChange={urls => upd('gallery', urls)} hint="Recomendado: 1280×720px. Abrem em lightbox ao clicar." folder="gallery" />
              <div><Label>URL do YouTube (opcional)</Label><Input value={form.youtube_url || ''} onChange={e => upd('youtube_url', e.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></div>
            </TabsContent>

            <TabsContent value="icon" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ícone (Lucide)</Label>
                  <select value={form.icon_name || 'Gavel'} onChange={e => upd('icon_name', e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    {ICON_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Cor do ícone</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.icon_color || '#d1a967'} onChange={e => upd('icon_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                    <Input value={form.icon_color || ''} onChange={e => upd('icon_color', e.target.value)} />
                  </div>
                </div>
              </div>
              <div><Label>SVG customizado (opcional)</Label><Textarea value={form.icon_svg || ''} onChange={e => upd('icon_svg', e.target.value)} rows={3} className="font-mono text-xs" placeholder="<svg ...>...</svg>" /></div>
            </TabsContent>

            <TabsContent value="cta" className="space-y-3">
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">O número do WhatsApp é configurado em <strong>Configurações → Contato</strong>. Aqui você define a mensagem pré-carregada e o texto do botão apenas para esta área.</p>
              <div><Label>Mensagem pré-definida (WhatsApp)</Label><Textarea value={form.whatsapp_message || ''} onChange={e => upd('whatsapp_message', e.target.value)} rows={3} placeholder={`Olá, gostaria de saber mais sobre ${form.title || '...'}`} /></div>
              <div><Label>Texto do botão CTA</Label><Input value={form.cta_button_text || ''} onChange={e => upd('cta_button_text', e.target.value)} /></div>
            </TabsContent>
          </Tabs>

          <Button onClick={handleSave} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 mt-4">{editing ? 'Salvar alterações' : 'Criar área'}</Button>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default PracticeAreasAdmin;
