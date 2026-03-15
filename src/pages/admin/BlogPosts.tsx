import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/supabase-helpers';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { BlogPostDB } from '@/types/database';

const BlogPosts = () => {
  const [posts, setPosts] = useState<BlogPostDB[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    const { data, error } = await db.from('blog_posts').select('*').order('created_at', { ascending: false });
    if (error) { toast({ title: 'Erro ao carregar posts', description: error.message, variant: 'destructive' }); }
    else { setPosts(data ?? []); }
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const togglePublished = async (post: BlogPostDB) => {
    const { error } = await db.from('blog_posts').update({ published: !post.published }).eq('id', post.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
    else { fetchPosts(); toast({ title: post.published ? 'Post despublicado' : 'Post publicado' }); }
  };

  const deletePost = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este post?')) return;
    const { error } = await db.from('blog_posts').delete().eq('id', id);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); }
    else { fetchPosts(); toast({ title: 'Post excluído com sucesso' }); }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Blog Posts</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie os artigos do blog</p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/admin/blog/new"><Plus className="w-4 h-4 mr-2" />Novo Post</Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <p className="text-muted-foreground mt-4">Nenhum post encontrado</p>
          <Button asChild className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/admin/blog/new">Criar primeiro post</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <div key={post.id} className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                {post.featured_image_url && <img src={post.featured_image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />}
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground truncate">{post.title}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleDateString('pt-BR')}</span>
                    {post.category && <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded-full">{post.category}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${post.published ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                      {post.published ? 'Publicado' : 'Rascunho'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <Button variant="ghost" size="sm" onClick={() => togglePublished(post)} title={post.published ? 'Despublicar' : 'Publicar'}>
                  {post.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="sm" asChild><Link to={`/admin/blog/${post.id}`}><Edit className="w-4 h-4" /></Link></Button>
                <Button variant="ghost" size="sm" onClick={() => deletePost(post.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default BlogPosts;
