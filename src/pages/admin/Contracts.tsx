import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Search, Archive, ArchiveRestore, Trash2, CheckCircle2 } from 'lucide-react';
import { useContracts } from '@/hooks/useContracts';
import { db } from '@/lib/supabase-helpers';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { Client } from '@/types/contracts';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-muted text-muted-foreground' },
  active: { label: 'Ativo', cls: 'bg-blue-500/10 text-blue-500' },
  concluded: { label: 'Concluído', cls: 'bg-green-500/10 text-green-500' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-500/10 text-red-500' },
};

const Contracts = () => {
  const { contracts, loading, refresh } = useContracts();
  const { user, isAdmin } = useAuth();
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [q, setQ] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');

  useEffect(() => {
    if (contracts.length === 0) return;
    const ids = [...new Set(contracts.map(c => c.client_id))];
    db.from('clients').select('*').in('id', ids).then(({ data }: { data: Client[] | null }) => {
      const map: Record<string, Client> = {};
      (data ?? []).forEach(c => { map[c.id] = c; });
      setClients(map);
    });
  }, [contracts]);

  const archive = async (id: string, completed: boolean) => {
    if (!confirm(completed ? 'Arquivar marcando como PROCESSO FINALIZADO?' : 'Arquivar este contrato?')) return;
    const { error } = await db.from('contracts').update({
      archived_at: new Date().toISOString(),
      archived_by: user?.id ?? null,
      process_completed: completed,
    }).eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await db.from('contract_history').insert({ contract_id: id, action: 'archived', description: completed ? 'Arquivado — processo finalizado' : 'Arquivado', performed_by: user?.id });
    toast({ title: 'Contrato arquivado' });
    refresh();
  };

  const unarchive = async (id: string) => {
    const { error } = await db.from('contracts').update({ archived_at: null, archived_by: null }).eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Contrato reativado' });
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir DEFINITIVAMENTE este contrato? Esta ação não pode ser desfeita.')) return;
    const { error } = await db.from('contracts').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Contrato excluído' });
    refresh();
  };

  const filtered = contracts.filter(c => {
    const isArchived = !!c.archived_at;
    if (view === 'active' && isArchived) return false;
    if (view === 'archived' && !isArchived) return false;
    if (!q) return true;
    const cli = clients[c.client_id];
    const hay = `${c.contract_number ?? ''} ${cli?.full_name ?? ''} ${cli?.cpf ?? ''} ${cli?.cnpj ?? ''}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const activeCount = contracts.filter(c => !c.archived_at).length;
  const archivedCount = contracts.length - activeCount;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Gestão de Contratos</h1>
          <p className="text-muted-foreground text-sm mt-1">{activeCount} ativo(s) · {archivedCount} arquivado(s)</p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/admin/contratos/new"><Plus className="w-4 h-4 mr-2" />Novo Contrato</Link>
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por cliente, CPF/CNPJ ou nº contrato..." className="pl-9 bg-background" />
        </div>
        <div className="inline-flex rounded-md border border-border bg-card overflow-hidden text-sm">
          <button onClick={() => setView('active')} className={`px-3 py-2 ${view === 'active' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>Ativos</button>
          <button onClick={() => setView('archived')} className={`px-3 py-2 ${view === 'archived' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>Arquivados</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum contrato encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const cli = clients[c.client_id];
            const st = STATUS_LABEL[c.status] ?? STATUS_LABEL.draft;
            const archived = !!c.archived_at;
            return (
              <div key={c.id} className="p-4 bg-card rounded-xl border border-border hover:border-accent/50 transition-colors">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <Link to={`/admin/contratos/${c.id}`} className="min-w-0 flex-1 block">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground">{cli?.full_name ?? '— sem cliente —'}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      {archived && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground inline-flex items-center gap-1">
                          <Archive className="w-3 h-3" /> Arquivado
                        </span>
                      )}
                      {c.process_completed && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Processo finalizado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.contract_number ? `Contrato ${c.contract_number} · ` : ''}
                      {cli?.cpf || cli?.cnpj || ''}
                      {c.process_data?.cnj_number ? ` · CNJ ${c.process_data.cnj_number}` : ''}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                    {!archived ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => archive(c.id, false)} title="Arquivar">
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => archive(c.id, true)} title="Arquivar como processo finalizado" className="text-green-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => unarchive(c.id)} title="Reativar">
                        <ArchiveRestore className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isAdmin() && (
                      <Button size="sm" variant="outline" onClick={() => remove(c.id)} title="Excluir definitivamente" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
};

export default Contracts;
