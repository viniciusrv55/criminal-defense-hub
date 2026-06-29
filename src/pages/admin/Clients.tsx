import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/supabase-helpers';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Download, Plus, Pencil, Trash2, Search, Upload, Users } from 'lucide-react';
import type { Client } from '@/types/contracts';

const empty: Partial<Client> = {
  person_type: 'pf',
  full_name: '',
  assigned_attorney_id: null,
  cpf: '',
  cnpj: '',
  emails: [],
  phones: [],
};

const MARITAL_OPTIONS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável', 'Separado(a)'];

export default function Clients() {
  const { user } = useAuth();
  const [list, setList] = useState<Client[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Client>>(empty);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const isPJ = editing.person_type === 'pj';

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: mems }] = await Promise.all([
      db.from('clients').select('*').order('created_at', { ascending: false }).limit(500),
      db.from('team_members').select('id, full_name').eq('active', true).order('full_name'),
    ]);
    setList((data ?? []) as Client[]);
    setMembers((mems ?? []) as { id: string; full_name: string }[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!query) return list;
    const q = query.toLowerCase();
    return list.filter(c => {
      const phones = JSON.stringify(c.phones ?? []).toLowerCase();
      const emails = JSON.stringify(c.emails ?? []).toLowerCase();
      return c.full_name?.toLowerCase().includes(q)
        || (c.cpf ?? '').toLowerCase().includes(q)
        || (c.cnpj ?? '').toLowerCase().includes(q)
        || phones.includes(q) || emails.includes(q);
    });
  }, [list, query]);

  const openNew = () => { setEditing(empty); setPhone(''); setEmail(''); setOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setPhone(c.phones?.[0]?.value ?? '');
    setEmail(c.emails?.[0]?.value ?? '');
    setOpen(true);
  };

  const lookupCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await r.json();
      if (d.erro) return;
      setEditing(prev => ({
        ...prev,
        cep: clean,
        state: prev.state || d.uf || '',
        city: prev.city || d.localidade || '',
        neighborhood: prev.neighborhood || d.bairro || '',
        address: prev.address || d.logradouro || '',
      }));
    } catch { /* ignore */ }
  };

  const save = async () => {
    if (!editing.full_name?.trim()) {
      toast({ title: isPJ ? 'Razão social obrigatória' : 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);

    // Build payload conditional on person_type — strip PF-only fields when PJ
    const base: Partial<Client> = {
      ...editing,
      phones: phone ? [{ label: 'Principal', value: phone }] : (editing.phones ?? []),
      emails: email ? [{ label: 'Principal', value: email }] : (editing.emails ?? []),
    };
    if (isPJ) {
      base.cpf = null;
      base.rg = null;
      base.pis = null;
      base.marital_status = null;
      base.nationality = null;
      base.profession = null;
      base.education = null;
      base.birth_date = null;
      base.father_name = null;
      base.mother_name = null;
    } else {
      base.cnpj = null;
      base.trade_name = null;
      base.state_registration = null;
    }
    // Normalize empty date to null
    if (!base.birth_date) base.birth_date = null;

    const id = editing.id;
    const { error } = id
      ? await db.from('clients').update(base).eq('id', id)
      : await db.from('clients').insert({ ...base, created_by: user?.id });

    setSaving(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: id ? 'Cliente atualizado' : 'Cliente criado' });
    setOpen(false);
    load();
  };

  const remove = async (c: Client) => {
    if (!confirm(`Excluir ${c.full_name}?`)) return;
    const { error } = await db.from('clients').delete().eq('id', c.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Cliente excluído' });
    load();
  };

  const attorneyName = (id?: string | null) => members.find(m => m.id === id)?.full_name ?? '—';

  const downloadImportModel = () => {
    const sampleAttorney = members[0]?.full_name ?? 'Nome do advogado responsável';
    const html = ` <html><head><meta charset="utf-8" /></head><body><table><thead><tr><th>Nome</th><th>Telefone</th><th>Advogado responsável</th></tr></thead><tbody><tr><td>Maria Silva</td><td>(11) 99999-9999</td><td>${sampleAttorney}</td></tr></tbody></table></body></html>`.replace('\u0000', '');
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-importacao-clientes.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseRows = (text: string) => {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const tableRows = Array.from(doc.querySelectorAll('tr')).slice(1).map(row => Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() ?? ''));
    if (tableRows.length) return tableRows;
    return text.split(/\r?\n/).slice(1).map(line => line.split(/\t|;/).map(cell => cell.trim()));
  };

  const importModel = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const rows = parseRows(text).filter(cols => cols[0] && cols[1]);
    if (!rows.length) {
      toast({ title: 'Planilha vazia', description: 'Use o modelo .xls com Nome, Telefone e Advogado responsável.', variant: 'destructive' });
      return;
    }
    const payload = rows.map(([name, importedPhone, attorney]) => {
      const match = members.find(m => m.full_name.toLowerCase().trim() === (attorney ?? '').toLowerCase().trim());
      return {
        person_type: 'pf',
        full_name: name,
        phones: [{ label: 'Principal', value: importedPhone }],
        emails: [],
        assigned_attorney_id: match?.id ?? null,
        created_by: user?.id,
      };
    });
    const { error } = await db.from('clients').insert(payload);
    if (error) { toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Clientes importados', description: `${payload.length} cliente(s) adicionados.` });
    load();
  };

  const set = (patch: Partial<Client>) => setEditing(prev => ({ ...prev, ...patch }));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif flex items-center gap-2"><Users className="w-6 h-6" /> Clientes</h1>
            <p className="text-sm text-muted-foreground">Cadastre o cliente aqui antes de criar contratos. Os dados são puxados automaticamente.</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={downloadImportModel}><Download className="w-4 h-4 mr-2" /> Modelo .xls</Button>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" /> Importar .xls
                <input type="file" accept=".xls,.html,.csv,.txt" className="hidden" onChange={e => { importModel(e.target.files?.[0] ?? null); e.currentTarget.value = ''; }} />
              </label>
            </Button>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo cliente</Button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, CPF, CNPJ, telefone, email…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Documento</th>
                <th className="p-3">Telefone</th>
                <th className="p-3">Advogado</th>
                <th className="p-3">Email</th>
                <th className="p-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum cliente.</td></tr>}
              {filtered.map(c => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{c.full_name}</td>
                  <td className="p-3"><Badge variant="outline">{c.person_type === 'pj' ? 'PJ' : 'PF'}</Badge></td>
                  <td className="p-3 font-mono text-xs">{c.person_type === 'pj' ? c.cnpj : c.cpf}</td>
                  <td className="p-3">{c.phones?.[0]?.value ?? '—'}</td>
                  <td className="p-3">{attorneyName(c.assigned_attorney_id)}</td>
                  <td className="p-3">{c.emails?.[0]?.value ?? '—'}</td>
                  <td className="p-3 flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing.id ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div>
                <Label>Tipo</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={editing.person_type ?? 'pf'}
                  onChange={e => set({ person_type: e.target.value as 'pf' | 'pj' })}
                >
                  <option value="pf">Pessoa Física</option>
                  <option value="pj">Pessoa Jurídica</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>{isPJ ? 'Razão social *' : 'Nome completo *'}</Label>
                  <Input value={editing.full_name ?? ''} onChange={e => set({ full_name: e.target.value })} />
                </div>

                {isPJ ? (
                  <>
                    <div>
                      <Label>Nome fantasia</Label>
                      <Input value={editing.trade_name ?? ''} onChange={e => set({ trade_name: e.target.value })} />
                    </div>
                    <div>
                      <Label>CNPJ</Label>
                      <Input value={editing.cnpj ?? ''} onChange={e => set({ cnpj: e.target.value })} />
                    </div>
                    <div>
                      <Label>Inscrição estadual</Label>
                      <Input value={editing.state_registration ?? ''} onChange={e => set({ state_registration: e.target.value })} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>CPF</Label>
                      <Input value={editing.cpf ?? ''} onChange={e => set({ cpf: e.target.value })} />
                    </div>
                    <div>
                      <Label>RG</Label>
                      <Input value={editing.rg ?? ''} onChange={e => set({ rg: e.target.value })} />
                    </div>
                    <div>
                      <Label>Data de nascimento</Label>
                      <Input type="date" value={editing.birth_date ?? ''} onChange={e => set({ birth_date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Estado civil</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                        value={editing.marital_status ?? ''}
                        onChange={e => set({ marital_status: e.target.value || null })}
                      >
                        <option value="">Selecione...</option>
                        {MARITAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Nacionalidade</Label>
                      <Input value={editing.nationality ?? ''} onChange={e => set({ nationality: e.target.value })} placeholder="Brasileira" />
                    </div>
                    <div>
                      <Label>Profissão</Label>
                      <Input value={editing.profession ?? ''} onChange={e => set({ profession: e.target.value })} />
                    </div>
                    <div>
                      <Label>PIS</Label>
                      <Input value={editing.pis ?? ''} onChange={e => set({ pis: e.target.value })} />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label>Telefone</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@email.com" />
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold mb-3">Endereço</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>CEP</Label>
                    <Input
                      value={editing.cep ?? ''}
                      onChange={e => set({ cep: e.target.value })}
                      onBlur={e => lookupCep(e.target.value)}
                      placeholder="00000-000"
                    />
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Input value={editing.state ?? ''} onChange={e => set({ state: e.target.value })} maxLength={2} placeholder="UF" />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input value={editing.city ?? ''} onChange={e => set({ city: e.target.value })} />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input value={editing.neighborhood ?? ''} onChange={e => set({ neighborhood: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Endereço (logradouro, nº, complemento)</Label>
                    <Input value={editing.address ?? ''} onChange={e => set({ address: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label>Advogado responsável</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={editing.assigned_attorney_id ?? ''}
                  onChange={e => set({ assigned_attorney_id: e.target.value || null })}
                >
                  <option value="">Sem advogado fixo</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Quando o cliente entrar em contato pelo WhatsApp, o agente de IA reconhece e transfere para este advogado.
                </p>
              </div>

              <div className="pt-4 border-t">
                <Label>Observações</Label>
                <Textarea rows={3} value={editing.notes ?? ''} onChange={e => set({ notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
