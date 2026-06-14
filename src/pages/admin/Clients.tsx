import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/supabase-helpers';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search, Users } from 'lucide-react';
import type { Client } from '@/types/contracts';

const empty: Partial<Client> = {
  person_type: 'pf',
  full_name: '',
  cpf: '',
  cnpj: '',
  emails: [],
  phones: [],
};

export default function Clients() {
  const [list, setList] = useState<Client[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Client>>(empty);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

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

  const save = async () => {
    if (!editing.full_name) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    const payload: Partial<Client> = {
      ...editing,
      phones: phone ? [{ label: 'Principal', value: phone }] : (editing.phones ?? []),
      emails: email ? [{ label: 'Principal', value: email }] : (editing.emails ?? []),
    };
    const id = editing.id;
    const { error } = id
      ? await db.from('clients').update(payload).eq('id', id)
      : await db.from('clients').insert(payload);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif flex items-center gap-2"><Users className="w-6 h-6" /> Clientes</h1>
            <p className="text-sm text-muted-foreground">Cadastro completo de clientes — usado em contratos, atendimento e campanhas.</p>
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo cliente</Button>
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
                <th className="p-3">Email</th>
                <th className="p-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum cliente.</td></tr>}
              {filtered.map(c => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{c.full_name}</td>
                  <td className="p-3"><Badge variant="outline">{c.person_type === 'pj' ? 'PJ' : 'PF'}</Badge></td>
                  <td className="p-3 font-mono text-xs">{c.person_type === 'pj' ? c.cnpj : c.cpf}</td>
                  <td className="p-3">{c.phones?.[0]?.value ?? '—'}</td>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing.id ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Tipo</Label>
                <Select value={editing.person_type ?? 'pf'} onValueChange={v => setEditing({ ...editing, person_type: v as 'pf' | 'pj' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pf">Pessoa Física</SelectItem>
                    <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>{editing.person_type === 'pj' ? 'Razão social' : 'Nome completo'} *</Label>
                <Input value={editing.full_name ?? ''} onChange={e => setEditing({ ...editing, full_name: e.target.value })} />
              </div>
              {editing.person_type === 'pj' ? (
                <div>
                  <Label>CNPJ</Label>
                  <Input value={editing.cnpj ?? ''} onChange={e => setEditing({ ...editing, cnpj: e.target.value })} />
                </div>
              ) : (
                <div>
                  <Label>CPF</Label>
                  <Input value={editing.cpf ?? ''} onChange={e => setEditing({ ...editing, cpf: e.target.value })} />
                </div>
              )}
              <div>
                <Label>RG</Label>
                <Input value={editing.rg ?? ''} onChange={e => setEditing({ ...editing, rg: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@email.com" />
              </div>
              <div className="col-span-2">
                <Label>Endereço</Label>
                <Input value={editing.address ?? ''} onChange={e => setEditing({ ...editing, address: e.target.value })} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={editing.city ?? ''} onChange={e => setEditing({ ...editing, city: e.target.value })} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={editing.state ?? ''} onChange={e => setEditing({ ...editing, state: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={editing.notes ?? ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
