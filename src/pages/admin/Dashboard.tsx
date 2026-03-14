import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { FileText, Briefcase, Eye } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({ posts: 0, publishedPosts: 0, areas: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [postsRes, publishedRes, areasRes] = await Promise.all([
        supabase.from('blog_posts').select('id', { count: 'exact', head: true }),
        supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('published', true),
        supabase.from('practice_areas').select('id', { count: 'exact', head: true }).eq('active', true),
      ]);
      setStats({
        posts: postsRes.count ?? 0,
        publishedPosts: publishedRes.count ?? 0,
        areas: areasRes.count ?? 0,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'Total de Posts', value: stats.posts, icon: FileText, color: 'text-blue-500' },
    { label: 'Posts Publicados', value: stats.publishedPosts, icon: Eye, color: 'text-green-500' },
    { label: 'Áreas de Atuação', value: stats.areas, icon: Briefcase, color: 'text-accent' },
  ];

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="p-6 rounded-xl bg-card border border-border"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-sm text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
