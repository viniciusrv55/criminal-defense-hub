import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Search } from 'lucide-react';
import { useContracts } from '@/hooks/useContracts';
import { db } from '@/lib/supabase-helpers';
import type { Client } from '@/types/contracts';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-muted text-muted-foreground' },
  active: { label: 'Ativo', cls: 'bg-blue-500/10 text-blue-500' },
  concluded: { label: 'Concluído', cls: 'bg-green-500/10 text-green-500' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-500/10 text-red-500' },
};

const Contracts = () => {
  const { contracts, loading } = useContracts();
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [q, setQ] = useState('');

  useEffect(() => {
    if (contracts.length === 0) return;
    const ids = [...new Set(contracts.map(c => c.client_id))];
    db.from('clients').select('*').in('id', ids).then(({ data }: { data: Client[] | null }) => {
      const map: Record<string, Client> = {};
      (data ?? []).forEach(c => { map[c.id] = c; });
      setClients(map);
    });
  }, [contracts]);

  const filtered = contracts.filter(c => {
    if (!q) return true;
    const cli = clients[c.client_id];
    const hay = `${c.contract_number ?? ''} ${cli?.full_name ?? ''} ${cli?.cpf ?? ''} ${cli?.cnpj ?? ''}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Gestão de Contratos</h1>
          <p className="text-muted-foreground text-sm mt-1">{contracts.length} contrato(s) cadastrado(s)</p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/admin/contratos/new"><Plus className="w-4 h-4 mr-2" />Novo Contrato</Link>
        </Button>
      </div>

      <div className="mb-6 relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por cliente, CPF/CNPJ ou nº contrato..." className="pl-9 bg-background" />
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
            return (
              <Link key={c.id} to={`/admin/contratos/${c.id}`} className="block">
                <div className="p-4 bg-card rounded-xl border border-border hover:border-accent/50 transition-colors">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-medium text-foreground">{cli?.full_name ?? '— sem cliente —'}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {c.contract_number ? `Contrato ${c.contract_number} · ` : ''}
                        {cli?.cpf || cli?.cnpj || ''}
                        {c.process_data?.cnj_number ? ` · CNJ ${c.process_data.cnj_number}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
};

export default Contracts;
