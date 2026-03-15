import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/supabase-helpers';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { BlogImage } from '@/types/database';

const BlogPostForm = () => {
  const { id } = useParams();
  const isEditing = !!id && id !== 'new';
  const navigate = useNavigate();
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [galleryImages, setGalleryImages] = useState<BlogImage[]>([]);
  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', content: '', featured_image_url: '', category: '', meta_description: '', published: false,
  });

  useEffect(() => {
    if (isEditing) { fetchPost(); fetchGallery(); }
  }, [id]);

  const fetchPost = async () => {
    const { data, error } = await db.from('blog_posts').select('*').eq('id', id).single();
    if (error || !data) { toast({ title: 'Post não encontrado', variant: 'destructive' }); navigate('/admin/blog'); return; }
    setForm({
      title: data.title, slug: data.slug, excerpt: data.excerpt ?? '', content: data.content ?? '',
      featured_image_url: data.featured_image_url ?? '', category: data.category ?? '',
      meta_description: data.meta_description ?? '', published: data.published,
    });
  };

  const fetchGallery = async () => {
    const { data } = await db.from('blog_images').select('*').eq('post_id', id).order('sort_order');
    setGalleryImages(data ?? []);
  };

  const generateSlug = (title: string) =>
    title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleTitleChange = (title: string) => {
    setForm(prev => ({ ...prev, title, slug: isEditing ? prev.slug : generateSlug(title) }));
  };

  const handleFeaturedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const filePath = `blog/featured/${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('blog-images').upload(filePath, file);
    if (error) { toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('blog-images').getPublicUrl(filePath);
    setForm(prev => ({ ...prev, featured_image_url: urlData.publicUrl }));
    setUploading(false);
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !isEditing) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const filePath = `blog/gallery/${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('blog-images').upload(filePath, file);
      if (error) continue;
      const { data: urlData } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      await db.from('blog_images').insert({ post_id: id, image_url: urlData.publicUrl, sort_order: galleryImages.length });
    }
    await fetchGallery();
    setUploading(false);
  };

  const removeGalleryImage = async (imageId: string) => {
    await db.from('blog_images').delete().eq('id', imageId);
    setGalleryImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.slug) { toast({ title: 'Preencha título e slug', variant: 'destructive' }); return; }
    setSaving(true);
    const postData = { ...form, author_id: user?.id, updated_at: new Date().toISOString() };
    let error;
    if (isEditing) {
      ({ error } = await db.from('blog_posts').update(postData).eq('id', id));
    } else {
      ({ error } = await db.from('blog_posts').insert(postData));
    }
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); }
    else { toast({ title: isEditing ? 'Post atualizado!' : 'Post criado!' }); navigate('/admin/blog'); }
    setSaving(false);
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/blog')}><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
          <h1 className="font-serif text-2xl font-bold text-foreground">{isEditing ? 'Editar Post' : 'Novo Post'}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-foreground">Título *</Label>
            <Input value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder="Título do artigo" className="bg-card" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Slug (URL)</Label>
            <Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="titulo-do-artigo" className="bg-card" />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Imagem de Destaque</Label>
            {form.featured_image_url ? (
              <div className="relative w-full max-w-md">
                <img src={form.featured_image_url} alt="Featured" className="w-full h-48 object-cover rounded-lg" />
                <button type="button" onClick={() => setForm(p => ({ ...p, featured_image_url: '' }))} className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full max-w-md h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent/50 transition-colors bg-card">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">{uploading ? 'Enviando...' : 'Clique para enviar imagem'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFeaturedImageUpload} disabled={uploading} />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Categoria</Label>
            <Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Ex: Habeas Corpus" className="bg-card" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Resumo / Descrição</Label>
            <Textarea value={form.excerpt} onChange={e => setForm(p => ({ ...p, excerpt: e.target.value }))} placeholder="Breve descrição..." rows={3} className="bg-card" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Conteúdo (Markdown)</Label>
            <Textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Conteúdo do artigo..." rows={15} className="bg-card font-mono text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Meta Description (SEO)</Label>
            <Textarea value={form.meta_description} onChange={e => setForm(p => ({ ...p, meta_description: e.target.value }))} placeholder="Descrição para SEO..." rows={2} className="bg-card" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.published} onCheckedChange={checked => setForm(p => ({ ...p, published: checked }))} />
            <Label className="text-foreground">Publicar artigo</Label>
          </div>

          {isEditing && (
            <div className="space-y-4 p-6 bg-card rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground flex items-center gap-2"><ImageIcon className="w-4 h-4" />Galeria de Imagens</h3>
                  <p className="text-xs text-muted-foreground mt-1">Adicione imagens extras ao artigo</p>
                </div>
                <label className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-2" />Adicionar</span></Button>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} disabled={uploading} />
                </label>
              </div>
              {galleryImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {galleryImages.map(img => (
                    <div key={img.id} className="relative group">
                      <img src={img.image_url} alt={img.caption ?? ''} className="w-full h-24 object-cover rounded-lg" />
                      <button type="button" onClick={() => removeGalleryImage(img.id)} className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : isEditing ? 'Atualizar Post' : 'Criar Post'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/admin/blog')}>Cancelar</Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default BlogPostForm;
