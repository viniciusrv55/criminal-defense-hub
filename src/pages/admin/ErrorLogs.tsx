import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/supabase-helpers';
import { toast } from '@/hooks/use-toast';
import { Trash2, RefreshCw } from 'lucide-react';

interface ErrorLog {
  id: string;
  user_email: string | null;
  user_name: string | null;
  route: string | null;
  screen: string | null;
  action: string | null;
  table_name: string | null;
  error_code: string | null;
  error_message: string | null;
  error_details: string | null;
  user_agent: string | null;
  created_at: string;
}

const ErrorLogs = () => {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setLogs((data ?? []) as ErrorLog[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm('Remover este log?')) return;
    const { error } = await db.from('error_logs').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  const clearAll = async () => {
    if (!confirm('Apagar TODOS os logs?')) return;
    const { error } = await db.from('error_logs').delete().not('id', 'is', null);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setLogs([]);
  };

  const filtered = logs.filter(l => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return [l.user_email, l.user_name, l.route, l.screen, l.action, l.table_name, l.error_message, l.error_code]
      .filter(Boolean).some(v => v!.toLowerCase().includes(s));
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold">Logs de Erros</h1>
          <p className="text-sm text-muted-foreground">Erros capturados automaticamente em todo o sistema (últimos 500).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4 mr-1" />Atualizar</Button>
          <Button variant="destructive" size="sm" onClick={clearAll}><Trash2 className="w-4 h-4 mr-1" />Limpar todos</Button>
        </div>
      </div>

      <div className="mb-4">
        <Input placeholder="Filtrar por usuário, tela, tabela, mensagem..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Quando</th>
                <th className="text-left px-3 py-2">Usuário</th>
                <th className="text-left px-3 py-2">Tela / Ação</th>
                <th className="text-left px-3 py-2">Tabela</th>
                <th className="text-left px-3 py-2">Mensagem</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum erro registrado 🎉</td></tr>}
              {filtered.map(l => (
                <>
                  <tr key={l.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.user_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{l.user_email || 'anônimo'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.screen || '—'}</div>
                      <div className="text-xs text-muted-foreground">{l.action} · {l.route}</div>
                    </td>
                    <td className="px-3 py-2 text-xs"><code>{l.table_name || '—'}</code></td>
                    <td className="px-3 py-2 text-xs max-w-md truncate" title={l.error_message ?? ''}>{l.error_message}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={(e) => { e.stopPropagation(); remove(l.id); }} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  {expanded === l.id && (
                    <tr key={l.id + '-x'} className="bg-muted/20 border-t border-border">
                      <td colSpan={6} className="px-4 py-3 text-xs">
                        <div className="grid md:grid-cols-2 gap-3">
                          <div><strong>Código:</strong> <code>{l.error_code || '—'}</code></div>
                          <div><strong>Rota:</strong> <code>{l.route || '—'}</code></div>
                        </div>
                        {l.error_details && (
                          <div className="mt-2"><strong>Detalhes:</strong>
                            <pre className="mt-1 whitespace-pre-wrap bg-background border border-border rounded p-2 text-[11px]">{l.error_details}</pre>
                          </div>
                        )}
                        {l.user_agent && <div className="mt-2 text-[11px] text-muted-foreground">UA: {l.user_agent}</div>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ErrorLogs;
