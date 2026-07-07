import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
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
import { logError } from '@/lib/error-logger';
import { Download, Plus, Pencil, Trash2, Search, Upload, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Client } from '@/types/contracts';

// ---------- Importador XLS ----------
// Cabeçalhos aceitos (case/acentos-insensitive). O primeiro é o "canônico" do modelo.
const IMPORT_COLUMNS: Record<string, string[]> = {
  full_name:          ['Nome', 'Nome completo', 'Razao social', 'Razão social', 'Cliente'],
  person_type:        ['Tipo', 'Tipo de pessoa', 'PF/PJ'],
  cpf:                ['CPF'],
  cnpj:               ['CNPJ'],
  rg:                 ['RG'],
  birth_date:         ['Data de nascimento', 'Nascimento', 'Data nasc'],
  marital_status:     ['Estado civil'],
  nationality:        ['Nacionalidade'],
  profession:         ['Profissão', 'Profissao'],
  email:              ['Email', 'E-mail'],
  phone:              ['Telefone', 'Celular', 'Whatsapp', 'WhatsApp'],
  cep:                ['CEP'],
  state:              ['Estado', 'UF'],
  city:               ['Cidade'],
  neighborhood:       ['Bairro'],
  address:            ['Endereço', 'Endereco', 'Logradouro'],
  attorney_name:      ['Advogado responsável', 'Advogado responsavel', 'Advogado'],
  notes:              ['Observações', 'Observacoes', 'Notas'],
};

const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (s: unknown) => stripAccents(String(s ?? '').trim().toLowerCase());
const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');

interface ImportRow {
  line: number;
  data: Partial<Client> & { attorney_name?: string; email?: string; phone?: string };
  errors: string[];
  warnings: string[];
  duplicate?: 'cpf' | 'cnpj' | 'phone' | null;
}



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

  // Importador
  const [importPreview, setImportPreview] = useState<ImportRow[] | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importing, setImporting] = useState(false);

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

  // ============ Modelo XLSX ============
  const downloadImportModel = () => {
    const sampleAttorney = members[0]?.full_name ?? '';
    const headers = Object.entries(IMPORT_COLUMNS).map(([, aliases]) => aliases[0]);
    const example: (string | number)[][] = [
      headers,
      [
        'Maria Silva', 'PF', '123.456.789-00', '', '12.345.678-9',
        '1985-03-14', 'Casada', 'Brasileira', 'Advogada',
        'maria@email.com', '(11) 99999-9999',
        '01310-100', 'SP', 'São Paulo', 'Bela Vista', 'Av. Paulista, 1000',
        sampleAttorney, 'Cliente indicada por João',
      ],
      [
        'ACME Comércio LTDA', 'PJ', '', '12.345.678/0001-90', '',
        '', '', '', '',
        'contato@acme.com.br', '(11) 3000-0000',
        '04538-133', 'SP', 'São Paulo', 'Itaim Bibi', 'R. Exemplo, 200',
        sampleAttorney, '',
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(example);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, 'modelo-importacao-clientes.xlsx');
  };

  // ============ Parse do arquivo enviado ============
  const parseWorkbook = async (file: File): Promise<Record<string, unknown>[]> => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  };

  const resolveHeaderMap = (sample: Record<string, unknown>): Record<string, string> => {
    // header original (como veio no xlsx) -> canonical key
    const map: Record<string, string> = {};
    const keys = Object.keys(sample);
    for (const [canonical, aliases] of Object.entries(IMPORT_COLUMNS)) {
      const nAliases = aliases.map(norm);
      const hit = keys.find(k => nAliases.includes(norm(k)));
      if (hit) map[hit] = canonical;
    }
    return map;
  };

  const parseDate = (v: unknown): string | null => {
    if (!v) return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (iso.test(s)) return s;
    const m = br.exec(s);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  };

  const buildImportRows = (raw: Record<string, unknown>[]): ImportRow[] => {
    if (!raw.length) return [];
    const headerMap = resolveHeaderMap(raw[0]);
    const canonicalFound = new Set(Object.values(headerMap));
    if (!canonicalFound.has('full_name')) {
      toast({ title: 'Coluna obrigatória ausente', description: 'A planilha precisa ter a coluna "Nome".', variant: 'destructive' });
      return [];
    }

    // índice atual pra dedupe
    const byCpf = new Map(list.filter(c => c.cpf).map(c => [digits(c.cpf), c]));
    const byCnpj = new Map(list.filter(c => c.cnpj).map(c => [digits(c.cnpj), c]));
    const byPhone = new Map<string, Client>();
    list.forEach(c => c.phones?.forEach(p => { const d = digits(p.value); if (d) byPhone.set(d, c); }));

    return raw.map((row, idx): ImportRow => {
      const get = (canon: string): string => {
        const originalHeader = Object.entries(headerMap).find(([, c]) => c === canon)?.[0];
        return originalHeader ? String(row[originalHeader] ?? '').trim() : '';
      };
      const errors: string[] = [];
      const warnings: string[] = [];

      const full_name = get('full_name');
      if (!full_name) errors.push('Nome vazio');

      const typeRaw = norm(get('person_type'));
      const cpf = digits(get('cpf'));
      const cnpj = digits(get('cnpj'));
      let person_type: 'pf' | 'pj' = 'pf';
      if (typeRaw.startsWith('pj') || typeRaw.includes('juridic')) person_type = 'pj';
      else if (typeRaw.startsWith('pf') || typeRaw.includes('fisic')) person_type = 'pf';
      else if (cnpj && !cpf) person_type = 'pj';

      if (person_type === 'pf' && cpf && cpf.length !== 11) warnings.push('CPF com tamanho inválido');
      if (person_type === 'pj' && cnpj && cnpj.length !== 14) warnings.push('CNPJ com tamanho inválido');

      const email = get('email');
      if (email && !/^\S+@\S+\.\S+$/.test(email)) warnings.push('E-mail inválido');

      const phone = get('phone');
      const phoneDigits = digits(phone);
      if (phone && phoneDigits.length < 10) warnings.push('Telefone com menos de 10 dígitos');

      const attorney_name = get('attorney_name');
      let assigned_attorney_id: string | null = null;
      if (attorney_name) {
        const match = members.find(m => norm(m.full_name) === norm(attorney_name));
        if (match) assigned_attorney_id = match.id;
        else warnings.push(`Advogado "${attorney_name}" não encontrado`);
      }

      const birth_date = parseDate(get('birth_date'));
      if (get('birth_date') && !birth_date) warnings.push('Data de nascimento inválida');

      let duplicate: 'cpf' | 'cnpj' | 'phone' | null = null;
      if (person_type === 'pf' && cpf && byCpf.has(cpf)) duplicate = 'cpf';
      else if (person_type === 'pj' && cnpj && byCnpj.has(cnpj)) duplicate = 'cnpj';
      else if (phoneDigits && byPhone.has(phoneDigits)) duplicate = 'phone';

      const data: ImportRow['data'] = {
        person_type,
        full_name,
        cpf: person_type === 'pf' ? (cpf || null) : null,
        cnpj: person_type === 'pj' ? (cnpj || null) : null,
        rg: get('rg') || null,
        birth_date: person_type === 'pf' ? birth_date : null,
        marital_status: get('marital_status') || null,
        nationality: get('nationality') || null,
        profession: get('profession') || null,
        cep: digits(get('cep')) || null,
        state: (get('state') || '').toUpperCase().slice(0, 2) || null,
        city: get('city') || null,
        neighborhood: get('neighborhood') || null,
        address: get('address') || null,
        notes: get('notes') || null,
        assigned_attorney_id,
        email: email || undefined,
        phone: phone || undefined,
        attorney_name: attorney_name || undefined,
      };

      return { line: idx + 2, data, errors, warnings, duplicate };
    });
  };

  const startImport = async (file: File | null) => {
    if (!file) return;
    setImportFileName(file.name);
    try {
      const raw = await parseWorkbook(file);
      const rows = buildImportRows(raw);
      if (!rows.length) return;
      setImportPreview(rows);
    } catch (err) {
      logError({ action: 'import.parse', screen: 'Clients', error: err, payload: { file: file.name } });
      toast({ title: 'Não foi possível ler a planilha', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    const valid = importPreview.filter(r => r.errors.length === 0 && !r.duplicate);
    if (!valid.length) {
      toast({ title: 'Nada a importar', description: 'Todas as linhas estão com erro ou são duplicadas.', variant: 'destructive' });
      return;
    }
    setImporting(true);
    const payload = valid.map(r => {
      const { email: e, phone: p, attorney_name: _a, ...rest } = r.data;
      return {
        ...rest,
        emails: e ? [{ label: 'Principal', value: e }] : [],
        phones: p ? [{ label: 'Principal', value: p }] : [],
        created_by: user?.id,
      };
    });
    const { error } = await db.from('clients').insert(payload);
    setImporting(false);
    if (error) {
      logError({ action: 'import.insert', screen: 'Clients', table: 'clients', error, payload: { count: payload.length } });
      toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Importação concluída', description: `${payload.length} cliente(s) adicionados.` });
    setImportPreview(null);
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
            <Button variant="outline" onClick={downloadImportModel}><Download className="w-4 h-4 mr-2" /> Modelo .xlsx</Button>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" /> Importar planilha
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { startImport(e.target.files?.[0] ?? null); e.currentTarget.value = ''; }} />
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
                      <Input value={maskCNPJ(editing.cnpj ?? '')} onChange={e => set({ cnpj: maskCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" inputMode="numeric" />
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

        {/* Preview de importação */}
        <Dialog open={!!importPreview} onOpenChange={(o) => !o && setImportPreview(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Prévia da importação {importFileName && `— ${importFileName}`}</DialogTitle>
            </DialogHeader>
            {importPreview && (() => {
              const total = importPreview.length;
              const withErrors = importPreview.filter(r => r.errors.length).length;
              const dupes = importPreview.filter(r => r.duplicate).length;
              const ok = importPreview.filter(r => !r.errors.length && !r.duplicate).length;
              return (
                <>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Total lidas</div><div className="text-xl font-semibold">{total}</div></div>
                    <div className="rounded-md border p-3 border-green-500/30"><div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Prontas</div><div className="text-xl font-semibold text-green-600">{ok}</div></div>
                    <div className="rounded-md border p-3 border-yellow-500/30"><div className="text-xs text-muted-foreground">Duplicadas</div><div className="text-xl font-semibold text-yellow-600">{dupes}</div></div>
                    <div className="rounded-md border p-3 border-destructive/30"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-destructive" /> Com erro</div><div className="text-xl font-semibold text-destructive">{withErrors}</div></div>
                  </div>
                  <div className="overflow-auto flex-1 border rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Linha</th>
                          <th className="p-2 text-left">Status</th>
                          <th className="p-2 text-left">Nome</th>
                          <th className="p-2 text-left">Tipo</th>
                          <th className="p-2 text-left">Documento</th>
                          <th className="p-2 text-left">Telefone</th>
                          <th className="p-2 text-left">Email</th>
                          <th className="p-2 text-left">Advogado</th>
                          <th className="p-2 text-left">Observações da linha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map(r => {
                          const status = r.errors.length ? 'erro' : r.duplicate ? 'duplicado' : 'ok';
                          return (
                            <tr key={r.line} className="border-t">
                              <td className="p-2">{r.line}</td>
                              <td className="p-2">
                                {status === 'ok' && <Badge variant="outline" className="text-green-600 border-green-500/40">OK</Badge>}
                                {status === 'duplicado' && <Badge variant="outline" className="text-yellow-600 border-yellow-500/40">Duplicado ({r.duplicate})</Badge>}
                                {status === 'erro' && <Badge variant="destructive">Erro</Badge>}
                              </td>
                              <td className="p-2">{r.data.full_name || <span className="text-muted-foreground">—</span>}</td>
                              <td className="p-2">{r.data.person_type?.toUpperCase()}</td>
                              <td className="p-2 font-mono">{r.data.cpf || r.data.cnpj || '—'}</td>
                              <td className="p-2">{r.data.phone || '—'}</td>
                              <td className="p-2">{r.data.email || '—'}</td>
                              <td className="p-2">{r.data.attorney_name || '—'}</td>
                              <td className="p-2 text-[11px]">
                                {r.errors.map(e => <div key={e} className="text-destructive">• {e}</div>)}
                                {r.warnings.map(w => <div key={w} className="text-yellow-600">• {w}</div>)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setImportPreview(null)} disabled={importing}>Cancelar</Button>
                    <Button onClick={confirmImport} disabled={importing || ok === 0}>
                      {importing ? 'Importando...' : `Importar ${ok} cliente(s)`}
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
