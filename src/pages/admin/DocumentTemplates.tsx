import { Link } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Plus, FileText, User, Pencil } from 'lucide-react';
import { useDocTemplates, useDocTemplateTypes, useCurrentTeamMember } from '@/hooks/useDocumentTemplates';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { db } from '@/lib/supabase-helpers';

const DocumentTemplates = () => {
  const { templates, loading } = useDocTemplates();
  const { types } = useDocTemplateTypes();
  const { isAdmin } = useAuth();
  const me = useCurrentTeamMember();
  const [owners, setOwners] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = [...new Set(templates.map(t => t.owner_id))];
    if (!ids.length) return;
    db.from('team_members').select('id, full_name').in('id', ids).then(({ data }: { data: { id: string; full_name: string }[] | null }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach(t => { map[t.id] = t.full_name; });
      setOwners(map);
    });
  }, [templates]);

  const typeName = (id: string) => types.find(t => t.id === id)?.name ?? '—';

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Gerador de Documentos</h1>
          <p className="text-sm text-muted-foreground">Modelos de contratos, declarações e procurações com variáveis dinâmicas.</p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/admin/documentos/new"><Plus className="w-4 h-4 mr-2" />Novo modelo</Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : templates.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum modelo criado ainda.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => {
            const isOwn = me?.id === t.owner_id;
            return (
              <Link key={t.id} to={`/admin/documentos/${t.id}`}
                className="group bg-card border border-border rounded-xl p-5 hover:border-accent/60 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-accent font-medium">{typeName(t.type_id)}</span>
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="font-medium text-foreground line-clamp-2 mb-3">{t.title}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  {isOwn ? <span className="text-accent">Seu modelo</span> : (isAdmin() ? owners[t.owner_id] ?? '...' : 'Compartilhado')}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
};

export default DocumentTemplates;
