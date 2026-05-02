import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/supabase-helpers';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { LogOut, FileText, Download, Scale, Clock } from 'lucide-react';
import type { Contract, ContractDocument, Client } from '@/types/contracts';

interface HistoryItem { id: string; action: string; description: string | null; created_at: string; }

const ClientPortal = () => {
  const { user, loading: authLoading, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [signing, setSigning] = useState(false);

  const [client, setClient] = useState<Client | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [docs, setDocs] = useState<ContractDocument[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    (async () => {
      const { data: pa } = await db.from('client_portal_access').select('client_id').eq('user_id', user.id).maybeSingle();
      if (!pa?.client_id) { setLoadingData(false); return; }
      const [{ data: c }, { data: cs }] = await Promise.all([
        db.from('clients').select('*').eq('id', pa.client_id).maybeSingle(),
        db.from('contracts').select('*').eq('client_id', pa.client_id).order('created_at', { ascending: false }),
      ]);
      setClient(c as Client | null);
      setContracts((cs ?? []) as Contract[]);
      const ids = (cs ?? []).map((x: Contract) => x.id);
      if (ids.length) {
        const [{ data: ds }, { data: hs }] = await Promise.all([
          db.from('contract_documents').select('*').in('contract_id', ids).order('created_at', { ascending: false }),
          db.from('contract_history').select('*').in('contract_id', ids).order('created_at', { ascending: false }).limit(50),
        ]);
        setDocs((ds ?? []) as ContractDocument[]);
        setHistory((hs ?? []) as HistoryItem[]);
      }
      setLoadingData(false);
    })();
  }, [user]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigning(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) toast({ title: 'Login falhou', description: error.message, variant: 'destructive' });
    setSigning(false);
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Helmet><title>Portal do Cliente | Lindomberto Moraes</title></Helmet>
        <form onSubmit={handleSignIn} className="w-full max-w-md bg-card border border-border rounded-2xl p-8 space-y-5">
          <div className="text-center">
            <div className="inline-flex p-3 rounded-xl bg-gold/15 mb-4"><Scale className="w-7 h-7 text-gold" /></div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Portal do Cliente</h1>
            <p className="text-sm text-muted-foreground mt-1">Acompanhe seu processo</p>
          </div>
          <div className="space-y-2"><Label className="text-foreground">E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="space-y-2"><Label className="text-foreground">Senha</Label><Input type="password" value={pwd} onChange={e => setPwd(e.target.value)} required /></div>
          <Button type="submit" disabled={signing} className="w-full bg-gold text-black hover:bg-gold/90">{signing ? 'Entrando...' : 'Entrar'}</Button>
        </form>
      </div>
    );
  }

  if (!hasRole('client') && !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <p className="text-muted-foreground mb-4">Sua conta não está vinculada a um cliente.</p>
          <Button onClick={async () => { await signOut(); navigate('/portal'); }}><LogOut className="w-4 h-4 mr-2" />Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Meu Acompanhamento | Lindomberto Moraes</title></Helmet>
      <header className="border-b border-border bg-card">
        <div className="container-custom flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gold/15"><Scale className="w-5 h-5 text-gold" /></div>
            <div>
              <p className="text-sm font-serif font-semibold text-foreground">Portal do Cliente</p>
              <p className="text-xs text-muted-foreground">{client?.full_name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate('/portal'); }}><LogOut className="w-4 h-4 mr-1" />Sair</Button>
        </div>
      </header>

      <main className="container-custom py-8 space-y-8">
        {loadingData ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>
        ) : (
          <>
            <section>
              <h2 className="font-serif text-xl font-semibold text-foreground mb-4">Meus contratos</h2>
              {contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum contrato vinculado.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {contracts.map(c => (
                    <div key={c.id} className="bg-card border border-border rounded-xl p-5">
                      <p className="text-xs uppercase tracking-wider text-gold">Contrato</p>
                      <p className="font-medium text-foreground mt-1">{c.contract_number ?? '— sem número —'}</p>
                      <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-muted-foreground">
                        <div><span className="text-foreground">Status:</span> {c.status}</div>
                        <div><span className="text-foreground">Tipo:</span> {c.process_type}</div>
                        {c.process_data?.cnj_number && <div className="col-span-2"><span className="text-foreground">CNJ:</span> {c.process_data.cnj_number}</div>}
                        {c.process_data?.phase && <div className="col-span-2"><span className="text-foreground">Fase:</span> {c.process_data.phase}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-foreground mb-4">Documentos</h2>
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum documento disponível ainda.</p>
              ) : (
                <div className="space-y-2">
                  {docs.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-gold" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{d.template_name ?? d.document_type}</p>
                          <p className="text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      {d.file_url && <Button asChild variant="outline" size="sm"><a href={d.file_url} target="_blank" rel="noopener"><Download className="w-3 h-3 mr-1" />Abrir</a></Button>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-foreground mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-gold" />Andamentos</h2>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem andamentos registrados.</p>
              ) : (
                <ol className="space-y-3 border-l border-border ml-3 pl-5">
                  {history.map(h => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-gold" />
                      <p className="text-sm text-foreground">{h.description ?? h.action}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleString('pt-BR')}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default ClientPortal;
