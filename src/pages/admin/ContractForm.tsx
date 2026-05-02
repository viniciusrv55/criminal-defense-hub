import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Save, ArrowLeft, ArrowRight, Search, FileText, Download, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/supabase-helpers';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useContract, useClientSearch } from '@/hooks/useContracts';
import { usePracticeAreas } from '@/hooks/usePracticeAreas';
import type { Client, Contract, ProcessData, AdverseParty, FeesData, ContractDocument } from '@/types/contracts';

const TAB_ORDER = ['cliente', 'processo', 'adicionais', 'adversa', 'honorarios', 'documentos', 'acesso'] as const;
type TabKey = typeof TAB_ORDER[number];

const emptyClient = (): Partial<Client> => ({
  person_type: 'pf', full_name: '', emails: [], phones: [],
});

const ContractForm = () => {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { contract, client, loading, refresh, setClient, setContract } = useContract(id);
  const { areas } = usePracticeAreas();

  const [tab, setTab] = useState<TabKey>('cliente');
  const [saving, setSaving] = useState(false);

  const [clientDraft, setClientDraft] = useState<Partial<Client>>(emptyClient());
  const [contractDraft, setContractDraft] = useState<Partial<Contract>>({
    status: 'draft', process_type: 'judicial', process_data: {}, additional_data: {}, adverse_party: {}, fees: {},
  });

  // Search existing client
  const [search, setSearch] = useState('');
  const { results, searching } = useClientSearch(search);

  // Documents tab
  const [docs, setDocs] = useState<ContractDocument[]>([]);

  useEffect(() => {
    if (client) setClientDraft(client);
    if (contract) setContractDraft(contract);
  }, [client, contract]);

  useEffect(() => {
    if (!isNew && contract?.id) {
      db.from('contract_documents').select('*').eq('contract_id', contract.id).order('created_at', { ascending: false })
        .then(({ data }: { data: ContractDocument[] | null }) => setDocs(data ?? []));
    }
  }, [isNew, contract?.id]);

  const pickClient = (c: Client) => {
    setClient(c);
    setClientDraft(c);
    setSearch('');
    setContractDraft(prev => ({ ...prev, client_id: c.id }));
  };

  const saveClient = async (): Promise<string | null> => {
    if (!clientDraft.full_name?.trim()) {
      toast({ title: 'Nome do cliente é obrigatório', variant: 'destructive' }); return null;
    }
    const payload = { ...clientDraft, created_by: clientDraft.created_by ?? user?.id };
    if (clientDraft.id) {
      const { error } = await db.from('clients').update(payload).eq('id', clientDraft.id);
      if (error) { toast({ title: 'Erro ao salvar cliente', description: error.message, variant: 'destructive' }); return null; }
      return clientDraft.id;
    }
    const { data, error } = await db.from('clients').insert(payload).select().single();
    if (error) { toast({ title: 'Erro ao criar cliente', description: error.message, variant: 'destructive' }); return null; }
    setClient(data as Client);
    setClientDraft(data as Client);
    return (data as Client).id;
  };

  const saveContract = async (clientId: string): Promise<string | null> => {
    const payload = {
      ...contractDraft,
      client_id: clientId,
      created_by: contractDraft.created_by ?? user?.id,
    };
    if (contractDraft.id) {
      const { error } = await db.from('contracts').update(payload).eq('id', contractDraft.id);
      if (error) { toast({ title: 'Erro ao salvar contrato', description: error.message, variant: 'destructive' }); return null; }
      await db.from('contract_history').insert({ contract_id: contractDraft.id, action: 'updated', description: 'Contrato atualizado', performed_by: user?.id });
      return contractDraft.id;
    }
    const { data, error } = await db.from('contracts').insert(payload).select().single();
    if (error) { toast({ title: 'Erro ao criar contrato', description: error.message, variant: 'destructive' }); return null; }
    setContract(data as Contract);
    setContractDraft(data as Contract);
    await db.from('contract_history').insert({ contract_id: (data as Contract).id, action: 'created', description: 'Contrato criado', performed_by: user?.id });
    return (data as Contract).id;
  };

  const handleSave = async (exit = false) => {
    setSaving(true);
    const cId = await saveClient();
    if (!cId) { setSaving(false); return; }
    const ctId = await saveContract(cId);
    setSaving(false);
    if (!ctId) return;
    toast({ title: 'Salvo!' });
    if (exit) navigate('/admin/contratos');
    else if (isNew) navigate(`/admin/contratos/${ctId}`, { replace: true });
  };

  const goNext = async () => {
    const idx = TAB_ORDER.indexOf(tab);
    if (idx === TAB_ORDER.length - 1) return;
    await handleSave(false);
    setTab(TAB_ORDER[idx + 1]);
  };

  const goPrev = () => {
    const idx = TAB_ORDER.indexOf(tab);
    if (idx > 0) setTab(TAB_ORDER[idx - 1]);
  };

  if (loading && !isNew) {
    return <AdminLayout><div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/contratos')} className="mb-2"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
          <h1 className="font-serif text-2xl font-bold text-foreground">{isNew ? 'Novo Contrato' : `Contrato — ${clientDraft.full_name || 'sem cliente'}`}</h1>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as TabKey)} className="space-y-6">
        <TabsList className="bg-card border border-border h-auto flex-wrap justify-start">
          <TabsTrigger value="cliente">Cliente</TabsTrigger>
          <TabsTrigger value="processo">Processo</TabsTrigger>
          <TabsTrigger value="adicionais">Dados Adicionais</TabsTrigger>
          <TabsTrigger value="adversa">Parte Adversa</TabsTrigger>
          <TabsTrigger value="honorarios">Honorários</TabsTrigger>
          <TabsTrigger value="documentos" disabled={isNew}>Gerar Documento</TabsTrigger>
          <TabsTrigger value="acesso" disabled={isNew}>Acesso ao Cliente</TabsTrigger>
        </TabsList>

        {/* CLIENTE */}
        <TabsContent value="cliente" className="space-y-6">
          {isNew && !clientDraft.id && (
            <div className="bg-card rounded-xl border border-border p-4">
              <Label className="text-foreground text-sm">Buscar cliente existente (nome ou CPF/CNPJ)</Label>
              <div className="relative mt-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Digite ao menos 2 letras..." className="pl-9 bg-background" />
              </div>
              {searching && <p className="text-xs text-muted-foreground mt-2">Buscando...</p>}
              {results.length > 0 && (
                <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
                  {results.map(c => (
                    <button key={c.id} type="button" onClick={() => pickClient(c)} className="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors text-sm">
                      <span className="font-medium text-foreground">{c.full_name}</span>
                      <span className="text-muted-foreground ml-2">{c.cpf || c.cnpj || ''}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
                <UserPlus className="w-3.5 h-3.5" /> Ou preencha os dados abaixo para criar um novo cliente
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={clientDraft.person_type === 'pf'} onChange={() => setClientDraft({ ...clientDraft, person_type: 'pf' })} /> Pessoa física
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={clientDraft.person_type === 'pj'} onChange={() => setClientDraft({ ...clientDraft, person_type: 'pj' })} /> Pessoa jurídica
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Grupo"><Input value={clientDraft.group_name ?? ''} onChange={e => setClientDraft({ ...clientDraft, group_name: e.target.value })} /></Field>
              <Field label="Perfil"><Input value={clientDraft.profile_type ?? ''} onChange={e => setClientDraft({ ...clientDraft, profile_type: e.target.value })} /></Field>
              <Field label={clientDraft.person_type === 'pj' ? 'Razão social *' : 'Nome completo *'}>
                <Input value={clientDraft.full_name ?? ''} onChange={e => setClientDraft({ ...clientDraft, full_name: e.target.value })} />
              </Field>
              <Field label="Nacionalidade"><Input value={clientDraft.nationality ?? ''} onChange={e => setClientDraft({ ...clientDraft, nationality: e.target.value })} /></Field>

              {clientDraft.person_type === 'pf' ? (
                <>
                  <Field label="Profissão"><Input value={clientDraft.profession ?? ''} onChange={e => setClientDraft({ ...clientDraft, profession: e.target.value })} /></Field>
                  <Field label="Escolaridade"><Input value={clientDraft.education ?? ''} onChange={e => setClientDraft({ ...clientDraft, education: e.target.value })} /></Field>
                  <Field label="Estado civil"><Input value={clientDraft.marital_status ?? ''} onChange={e => setClientDraft({ ...clientDraft, marital_status: e.target.value })} /></Field>
                  <Field label="Nascimento"><Input type="date" value={clientDraft.birth_date ?? ''} onChange={e => setClientDraft({ ...clientDraft, birth_date: e.target.value })} /></Field>
                  <Field label="CPF"><Input value={clientDraft.cpf ?? ''} onChange={e => setClientDraft({ ...clientDraft, cpf: e.target.value })} /></Field>
                  <Field label="RG"><Input value={clientDraft.rg ?? ''} onChange={e => setClientDraft({ ...clientDraft, rg: e.target.value })} /></Field>
                  <Field label="PIS"><Input value={clientDraft.pis ?? ''} onChange={e => setClientDraft({ ...clientDraft, pis: e.target.value })} /></Field>
                </>
              ) : (
                <>
                  <Field label="Nome fantasia"><Input value={clientDraft.trade_name ?? ''} onChange={e => setClientDraft({ ...clientDraft, trade_name: e.target.value })} /></Field>
                  <Field label="CNPJ"><Input value={clientDraft.cnpj ?? ''} onChange={e => setClientDraft({ ...clientDraft, cnpj: e.target.value })} /></Field>
                  <Field label="Inscrição estadual"><Input value={clientDraft.state_registration ?? ''} onChange={e => setClientDraft({ ...clientDraft, state_registration: e.target.value })} /></Field>
                </>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-border">
              <Field label="E-mail principal">
                <Input type="email" value={clientDraft.emails?.[0]?.value ?? ''} onChange={e => setClientDraft({ ...clientDraft, emails: [{ label: 'principal', value: e.target.value }] })} />
              </Field>
              <Field label="Celular">
                <Input value={clientDraft.phones?.[0]?.value ?? ''} onChange={e => setClientDraft({ ...clientDraft, phones: [{ label: 'celular', value: e.target.value }, ...((clientDraft.phones ?? []).slice(1))] })} />
              </Field>
              <Field label="Telefone residencial">
                <Input value={clientDraft.phones?.[1]?.value ?? ''} onChange={e => {
                  const ph = [...(clientDraft.phones ?? [])]; ph[1] = { label: 'residencial', value: e.target.value }; setClientDraft({ ...clientDraft, phones: ph });
                }} />
              </Field>
              <Field label="Telefone comercial">
                <Input value={clientDraft.phones?.[2]?.value ?? ''} onChange={e => {
                  const ph = [...(clientDraft.phones ?? [])]; ph[2] = { label: 'comercial', value: e.target.value }; setClientDraft({ ...clientDraft, phones: ph });
                }} />
              </Field>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-border">
              <Field label="CEP"><Input value={clientDraft.cep ?? ''} onChange={e => setClientDraft({ ...clientDraft, cep: e.target.value })} /></Field>
              <Field label="Estado"><Input value={clientDraft.state ?? ''} onChange={e => setClientDraft({ ...clientDraft, state: e.target.value })} /></Field>
              <Field label="Cidade"><Input value={clientDraft.city ?? ''} onChange={e => setClientDraft({ ...clientDraft, city: e.target.value })} /></Field>
              <Field label="Bairro"><Input value={clientDraft.neighborhood ?? ''} onChange={e => setClientDraft({ ...clientDraft, neighborhood: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label="Endereço"><Input value={clientDraft.address ?? ''} onChange={e => setClientDraft({ ...clientDraft, address: e.target.value })} /></Field></div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-border">
              <Field label="Nome do pai"><Input value={clientDraft.father_name ?? ''} onChange={e => setClientDraft({ ...clientDraft, father_name: e.target.value })} /></Field>
              <Field label="Nome da mãe"><Input value={clientDraft.mother_name ?? ''} onChange={e => setClientDraft({ ...clientDraft, mother_name: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label="Observação"><Textarea rows={3} value={clientDraft.notes ?? ''} onChange={e => setClientDraft({ ...clientDraft, notes: e.target.value })} /></Field></div>
            </div>
          </div>
        </TabsContent>

        {/* PROCESSO */}
        <TabsContent value="processo" className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={contractDraft.process_type === 'judicial'} onChange={() => setContractDraft({ ...contractDraft, process_type: 'judicial' })} /> Processo judicial</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={contractDraft.process_type === 'administrative'} onChange={() => setContractDraft({ ...contractDraft, process_type: 'administrative' })} /> Processo administrativo</label>
          </div>
          <ProcessFields data={contractDraft.process_data ?? {}} onChange={pd => setContractDraft({ ...contractDraft, process_data: pd })} areas={areas} />
        </TabsContent>

        {/* ADICIONAIS */}
        <TabsContent value="adicionais" className="bg-card rounded-xl border border-border p-6">
          <Field label="Anotações específicas da área de atuação">
            <Textarea rows={10} value={(contractDraft.additional_data as { notes?: string })?.notes ?? ''} onChange={e => setContractDraft({ ...contractDraft, additional_data: { ...contractDraft.additional_data, notes: e.target.value } })} placeholder="Informações específicas da área de atuação selecionada..." />
          </Field>
        </TabsContent>

        {/* PARTE ADVERSA */}
        <TabsContent value="adversa" className="bg-card rounded-xl border border-border p-6 space-y-4">
          <AdverseFields data={contractDraft.adverse_party ?? {}} onChange={ap => setContractDraft({ ...contractDraft, adverse_party: ap })} />
        </TabsContent>

        {/* HONORÁRIOS */}
        <TabsContent value="honorarios" className="bg-card rounded-xl border border-border p-6 space-y-6">
          <FeesFields data={contractDraft.fees ?? {}} onChange={f => setContractDraft({ ...contractDraft, fees: f })} />
        </TabsContent>

        {/* DOCUMENTOS */}
        <TabsContent value="documentos" className="bg-card rounded-xl border border-border p-6 space-y-4">
          <DocumentsTab contractId={contract?.id} client={client} contract={contract} docs={docs} onChange={setDocs} userId={user?.id} />
        </TabsContent>

        {/* ACESSO AO CLIENTE */}
        <TabsContent value="acesso" className="bg-card rounded-xl border border-border p-6 space-y-4">
          <PortalAccessTab clientId={client?.id} clientName={client?.full_name ?? ''} clientEmail={client?.emails?.[0]?.value} />
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <Button variant="outline" onClick={goPrev} disabled={tab === TAB_ORDER[0]}><ArrowLeft className="w-4 h-4 mr-1" />Anterior</Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}><Save className="w-4 h-4 mr-2" />Salvar e Sair</Button>
          {tab !== TAB_ORDER[TAB_ORDER.length - 1] && (
            <Button onClick={goNext} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">Próximo<ArrowRight className="w-4 h-4 ml-1" /></Button>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5"><Label className="text-foreground text-xs">{label}</Label>{children}</div>
);

const ProcessFields = ({ data, onChange, areas }: { data: ProcessData; onChange: (d: ProcessData) => void; areas: { id: string; title: string }[] }) => {
  const set = (k: keyof ProcessData, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Grupo"><Input value={data.group ?? ''} onChange={e => set('group', e.target.value)} /></Field>
      <Field label="Pasta"><Input value={data.folder ?? ''} onChange={e => set('folder', e.target.value)} /></Field>
      <Field label="Número CNJ"><Input value={data.cnj_number ?? ''} onChange={e => set('cnj_number', e.target.value)} /></Field>
      <Field label="Etiqueta"><Input value={data.process_number ?? ''} onChange={e => set('process_number', e.target.value)} placeholder="Aguardando numeração" /></Field>
      <Field label="Status processual"><Input value={data.process_status ?? ''} onChange={e => set('process_status', e.target.value)} /></Field>
      <Field label="Local de trâmite"><Input value={data.trial_location ?? ''} onChange={e => set('trial_location', e.target.value)} /></Field>
      <Field label="Área de Atuação">
        <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={data.practice_area ?? ''} onChange={e => set('practice_area', e.target.value)}>
          <option value="">Selecione...</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </Field>
      <Field label="Comarca"><Input value={data.comarca ?? ''} onChange={e => set('comarca', e.target.value)} /></Field>
      <Field label="Objeto da ação"><Input value={data.action_object ?? ''} onChange={e => set('action_object', e.target.value)} /></Field>
      <Field label="Fase"><Input value={data.phase ?? ''} onChange={e => set('phase', e.target.value)} /></Field>
      <Field label="Assunto"><Input value={data.subject ?? ''} onChange={e => set('subject', e.target.value)} /></Field>
      <Field label="Responsável"><Input value={data.responsible ?? ''} onChange={e => set('responsible', e.target.value)} /></Field>
      <Field label="Detalhes"><Input value={data.details ?? ''} onChange={e => set('details', e.target.value)} /></Field>
      <Field label="Parceiro"><Input value={data.partner ?? ''} onChange={e => set('partner', e.target.value)} /></Field>
      <Field label="Prognóstico"><Input value={data.prognosis ?? ''} onChange={e => set('prognosis', e.target.value)} /></Field>
      <Field label="Origem"><Input value={data.origin ?? ''} onChange={e => set('origin', e.target.value)} /></Field>
      <Field label="Contratação"><Input type="date" value={data.contract_date ?? ''} onChange={e => set('contract_date', e.target.value)} /></Field>
      <Field label="Trânsito julgado"><Input type="date" value={data.judgment_date ?? ''} onChange={e => set('judgment_date', e.target.value)} /></Field>
      <Field label="Valor da causa"><Input value={data.cause_value ?? ''} onChange={e => set('cause_value', e.target.value)} placeholder="0,00" /></Field>
      <Field label="Encerramento"><Input type="date" value={data.closure_date ?? ''} onChange={e => set('closure_date', e.target.value)} /></Field>
      <Field label="Sentença"><Input type="date" value={data.sentence_date ?? ''} onChange={e => set('sentence_date', e.target.value)} /></Field>
      <Field label="Outro valor"><Input value={data.other_value ?? ''} onChange={e => set('other_value', e.target.value)} placeholder="0,00" /></Field>
      <Field label="Distribuição"><Input type="date" value={data.distribution_date ?? ''} onChange={e => set('distribution_date', e.target.value)} /></Field>
      <Field label="Execução"><Input type="date" value={data.execution_date ?? ''} onChange={e => set('execution_date', e.target.value)} /></Field>
      <Field label="Contingência"><Input value={data.contingency ?? ''} onChange={e => set('contingency', e.target.value)} placeholder="0,00" /></Field>
      <div className="sm:col-span-2"><Field label="Pedido"><Textarea rows={2} value={data.request ?? ''} onChange={e => set('request', e.target.value)} /></Field></div>
      <div className="sm:col-span-2"><Field label="Observação"><Textarea rows={3} value={data.notes ?? ''} onChange={e => set('notes', e.target.value)} /></Field></div>
      <div className="flex items-center gap-3"><Switch checked={!!data.secrecy} onCheckedChange={v => set('secrecy', v)} /><Label className="text-sm">Segredo de justiça</Label></div>
      <div className="flex items-center gap-3"><Switch checked={!!data.capture_updates} onCheckedChange={v => set('capture_updates', v)} /><Label className="text-sm">Capturar andamentos</Label></div>
    </div>
  );
};

const AdverseFields = ({ data, onChange }: { data: AdverseParty; onChange: (d: AdverseParty) => void }) => {
  const set = (k: keyof AdverseParty, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={data.person_type !== 'pj'} onChange={() => set('person_type', 'pf')} /> Pessoa física</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={data.person_type === 'pj'} onChange={() => set('person_type', 'pj')} /> Pessoa jurídica</label>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome / Razão social"><Input value={data.name ?? ''} onChange={e => set('name', e.target.value)} /></Field>
        <Field label={data.person_type === 'pj' ? 'CNPJ' : 'CPF'}>
          <Input value={(data.person_type === 'pj' ? data.cnpj : data.cpf) ?? ''} onChange={e => set(data.person_type === 'pj' ? 'cnpj' : 'cpf', e.target.value)} />
        </Field>
        <Field label="RG"><Input value={data.rg ?? ''} onChange={e => set('rg', e.target.value)} /></Field>
        <Field label="E-mail"><Input value={data.email ?? ''} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Telefone"><Input value={data.phone ?? ''} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label="Endereço"><Input value={data.address ?? ''} onChange={e => set('address', e.target.value)} /></Field>
        <Field label="Cidade"><Input value={data.city ?? ''} onChange={e => set('city', e.target.value)} /></Field>
        <Field label="Estado"><Input value={data.state ?? ''} onChange={e => set('state', e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Observação"><Textarea rows={3} value={data.notes ?? ''} onChange={e => set('notes', e.target.value)} /></Field></div>
      </div>
    </>
  );
};

const FeesFields = ({ data, onChange }: { data: FeesData; onChange: (d: FeesData) => void }) => {
  const set = (k: keyof FeesData, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <>
      <div>
        <h3 className="font-medium text-foreground text-sm mb-3">Honorários iniciais</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Entrada"><Input value={data.initial_entry ?? ''} onChange={e => set('initial_entry', e.target.value)} placeholder="0,00" /></Field>
          <Field label="Parcelas"><Input value={data.initial_installments ?? ''} onChange={e => set('initial_installments', e.target.value)} placeholder="À vista" /></Field>
          <Field label="Vencimento"><Input type="date" value={data.initial_due_date ?? ''} onChange={e => set('initial_due_date', e.target.value)} /></Field>
          <Field label="Forma de pagamento"><Input value={data.initial_payment_method ?? ''} onChange={e => set('initial_payment_method', e.target.value)} /></Field>
          <Field label="Saldo"><Input value={data.balance ?? ''} onChange={e => set('balance', e.target.value)} /></Field>
          <Field label="Parcelas (saldo)"><Input value={data.balance_installments ?? ''} onChange={e => set('balance_installments', e.target.value)} /></Field>
          <Field label="1º vencimento (saldo)"><Input type="date" value={data.balance_first_due ?? ''} onChange={e => set('balance_first_due', e.target.value)} /></Field>
          <Field label="Forma de pagamento (saldo)"><Input value={data.balance_payment_method ?? ''} onChange={e => set('balance_payment_method', e.target.value)} /></Field>
        </div>
      </div>
      <div className="pt-4 border-t border-border">
        <h3 className="font-medium text-foreground text-sm mb-3">Honorários mensais</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Valor"><Input value={data.monthly_value ?? ''} onChange={e => set('monthly_value', e.target.value)} placeholder="0,00" /></Field>
          <Field label="Parcelas"><Input value={data.monthly_installments ?? ''} onChange={e => set('monthly_installments', e.target.value)} /></Field>
          <Field label="1º vencimento"><Input type="date" value={data.monthly_first_due ?? ''} onChange={e => set('monthly_first_due', e.target.value)} /></Field>
          <Field label="Forma de pagamento"><Input value={data.monthly_payment_method ?? ''} onChange={e => set('monthly_payment_method', e.target.value)} /></Field>
          <Field label="Honorários contratuais"><Input value={data.contractual_fees ?? ''} onChange={e => set('contractual_fees', e.target.value)} /></Field>
          <Field label="Honorários sucumbenciais"><Input value={data.succumbence_fees ?? ''} onChange={e => set('succumbence_fees', e.target.value)} /></Field>
        </div>
        <div className="mt-4"><Field label="Observações"><Textarea rows={3} value={data.notes ?? ''} onChange={e => set('notes', e.target.value)} /></Field></div>
      </div>
    </>
  );
};

const DOC_TEMPLATES = [
  { value: 'procuracao', label: 'Procuração' },
  { value: 'declaracao', label: 'Declaração' },
  { value: 'contrato_honorarios', label: 'Contrato de Honorários Advocatícios' },
  { value: 'peticao', label: 'Petição' },
  { value: 'outro', label: 'Outro Documento' },
];

const DocumentsTab = ({ contractId, client, contract, docs, onChange, userId }: { contractId?: string; client: Client | null; contract: Contract | null; docs: ContractDocument[]; onChange: (d: ContractDocument[]) => void; userId?: string }) => {
  const [type, setType] = useState('procuracao');
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!contractId || !client || !contract) { toast({ title: 'Salve o contrato antes', variant: 'destructive' }); return; }
    setGenerating(true);
    const html = buildDocumentHtml(type, client, contract);
    const blob = new Blob([html], { type: 'text/html' });
    const fileName = `${type}-${client.full_name.replace(/\s+/g, '_')}-${Date.now()}.html`;
    const path = `${contractId}/${fileName}`;
    const { error: upErr } = await supabase.storage.from('contracts').upload(path, blob);
    if (upErr) { toast({ title: 'Erro upload', description: upErr.message, variant: 'destructive' }); setGenerating(false); return; }
    const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(path, 60 * 60 * 24 * 365);
    const { data, error } = await db.from('contract_documents').insert({
      contract_id: contractId, document_type: type, template_name: DOC_TEMPLATES.find(t => t.value === type)?.label,
      file_url: signed?.signedUrl, file_name: fileName, generated_html: html, generated_by: userId,
    }).select().single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setGenerating(false); return; }
    onChange([data as ContractDocument, ...docs]);
    await db.from('contract_history').insert({ contract_id: contractId, action: 'document_generated', description: `Documento gerado: ${type}`, performed_by: userId });
    toast({ title: 'Documento gerado!' });
    setGenerating(false);
  };

  return (
    <>
      <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground">
        ℹ️ O documento será gerado em HTML usando os dados das abas anteriores. O design final pode ser personalizado depois.
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Tipo">
          <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={type} onChange={e => setType(e.target.value)}>
            {DOC_TEMPLATES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <div className="flex items-end"><Button onClick={generate} disabled={generating} className="bg-accent text-accent-foreground hover:bg-accent/90"><FileText className="w-4 h-4 mr-2" />{generating ? 'Gerando...' : 'Gerar documento'}</Button></div>
      </div>

      <div className="pt-4 border-t border-border">
        <h3 className="font-medium text-foreground text-sm mb-3">Documentos gerados</h3>
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum documento gerado ainda.</p>
        ) : (
          <div className="space-y-2">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">{d.template_name ?? d.document_type}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleString('pt-BR')}</p>
                </div>
                {d.file_url && <Button asChild variant="outline" size="sm"><a href={d.file_url} target="_blank" rel="noopener"><Download className="w-3 h-3 mr-1" />Abrir</a></Button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

const buildDocumentHtml = (type: string, client: Client, contract: Contract): string => {
  const today = new Date().toLocaleDateString('pt-BR');
  const head = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>${type}</title>
    <style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 24px;color:#111;line-height:1.7}h1{text-align:center;font-size:18px;text-transform:uppercase;letter-spacing:2px}p{text-align:justify;margin:12px 0}.sig{margin-top:80px;text-align:center}.sig hr{width:280px;margin:0 auto 6px;border:none;border-top:1px solid #000}</style>
    </head><body>`;
  const foot = `<div class="sig"><hr><p style="margin:0">${client.full_name}<br>${client.cpf ? 'CPF: '+client.cpf : (client.cnpj ? 'CNPJ: '+client.cnpj : '')}</p></div></body></html>`;
  const enderecoFmt = [client.address, client.neighborhood, client.city, client.state].filter(Boolean).join(', ');

  if (type === 'procuracao') {
    return head + `
      <h1>Procuração ad judicia et extra</h1>
      <p><strong>OUTORGANTE:</strong> ${client.full_name}, ${client.nationality ?? ''}, ${client.marital_status ?? ''}, ${client.profession ?? ''}, portador(a) ${client.rg ? 'do RG nº '+client.rg : ''} ${client.cpf ? 'e do CPF nº '+client.cpf : (client.cnpj ? 'inscrito no CNPJ '+client.cnpj : '')}, residente e domiciliado(a) em ${enderecoFmt}.</p>
      <p><strong>OUTORGADO:</strong> Lindomberto Moraes, advogado(a) inscrito(a) na OAB.</p>
      <p>Pelo presente instrumento particular de procuração, o(a) outorgante nomeia e constitui seu bastante procurador o outorgado acima qualificado, conferindo-lhe os poderes da cláusula <em>ad judicia et extra</em> para o foro em geral, podendo propor contra quem de direito as ações competentes e defendê-lo nas contrárias, em qualquer juízo, instância ou tribunal.</p>
      <p style="text-align:right">${today}</p>
    ` + foot;
  }
  if (type === 'declaracao') {
    return head + `<h1>Declaração</h1><p>Eu, ${client.full_name}, ${client.cpf ? 'CPF '+client.cpf : ''}, declaro para os devidos fins que constituí o(a) advogado(a) Lindomberto Moraes para defesa dos meus interesses no processo em referência.</p><p style="text-align:right">${today}</p>` + foot;
  }
  if (type === 'contrato_honorarios') {
    const f = contract.fees ?? {};
    return head + `
      <h1>Contrato de Prestação de Serviços Advocatícios</h1>
      <p><strong>CONTRATANTE:</strong> ${client.full_name}, ${client.cpf ? 'CPF '+client.cpf : (client.cnpj ? 'CNPJ '+client.cnpj : '')}, residente em ${enderecoFmt}.</p>
      <p><strong>CONTRATADO:</strong> Lindomberto Moraes Advocacia.</p>
      <p><strong>Cláusula 1ª — Objeto:</strong> Prestação de serviços advocatícios referentes a ${contract.process_data?.action_object ?? 'matéria objeto deste instrumento'}.</p>
      <p><strong>Cláusula 2ª — Honorários:</strong> Entrada de R$ ${f.initial_entry ?? '____'} ${f.initial_installments ? '('+f.initial_installments+')' : ''}, com saldo de R$ ${f.balance ?? '____'} parcelado em ${f.balance_installments ?? '____'}. Honorários mensais: R$ ${f.monthly_value ?? '____'}. Forma de pagamento: ${f.initial_payment_method ?? '____'}.</p>
      <p><strong>Cláusula 3ª — Honorários sucumbenciais:</strong> ${f.succumbence_fees ?? 'Pertencem ao contratado'}.</p>
      <p><strong>Cláusula 4ª — Foro:</strong> Fica eleito o foro de ${client.city ?? '____'}/${client.state ?? '__'} para dirimir quaisquer questões.</p>
      <p style="text-align:right">${today}</p>
    ` + foot;
  }
  return head + `<h1>${type}</h1><p>Documento referente ao cliente ${client.full_name}.</p>` + foot;
};

const PortalAccessTab = ({ clientId, clientName, clientEmail }: { clientId?: string; clientName: string; clientEmail?: string }) => {
  const [access, setAccess] = useState<{ id?: string; username?: string; nickname?: string; birthday_day?: number; birthday_month?: number; active?: boolean } | null>(null);
  const [loadingA, setLoadingA] = useState(true);
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!clientId) { setLoadingA(false); return; }
    db.from('client_portal_access').select('*').eq('client_id', clientId).maybeSingle().then(({ data }: { data: typeof access | null }) => {
      setAccess(data);
      setLoadingA(false);
    });
  }, [clientId]);

  const create = async () => {
    if (!clientId) { toast({ title: 'Salve o cliente antes', variant: 'destructive' }); return; }
    if (!access?.username || !pwd || pwd !== pwd2 || pwd.length < 6) { toast({ title: 'Verifique e-mail e senhas (mín. 6)', variant: 'destructive' }); return; }
    setCreating(true);
    const { data: auth, error: aErr } = await supabase.auth.signUp({ email: access.username, password: pwd, options: { data: { full_name: clientName }, emailRedirectTo: `${window.location.origin}/portal` } });
    if (aErr || !auth.user) { toast({ title: 'Erro', description: aErr?.message, variant: 'destructive' }); setCreating(false); return; }
    await db.from('user_roles').insert({ user_id: auth.user.id, role: 'client' });
    const { error: pErr } = await db.from('client_portal_access').insert({
      client_id: clientId, user_id: auth.user.id, username: access.username, nickname: access.nickname,
      birthday_day: access.birthday_day, birthday_month: access.birthday_month, active: true,
    });
    if (pErr) { toast({ title: 'Erro', description: pErr.message, variant: 'destructive' }); setCreating(false); return; }
    toast({ title: 'Acesso criado! Cliente pode entrar em /portal' });
    setCreating(false);
    setPwd(''); setPwd2('');
    const { data } = await db.from('client_portal_access').select('*').eq('client_id', clientId).maybeSingle();
    setAccess(data);
  };

  if (loadingA) return <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" /></div>;
  if (!clientId) return <p className="text-sm text-muted-foreground">Salve o cliente primeiro.</p>;

  if (access?.id) {
    return (
      <div className="space-y-3">
        <div className="bg-green-500/10 border border-green-500/30 text-green-600 rounded-lg p-3 text-sm">✅ Acesso ativo. URL do portal: <code>/portal</code></div>
        <p className="text-sm"><strong>Usuário:</strong> {access.username}</p>
        {access.nickname && <p className="text-sm"><strong>Apelido:</strong> {access.nickname}</p>}
        <p className="text-xs text-muted-foreground">Para resetar a senha, peça ao cliente para usar "Esqueci minha senha" na tela de login.</p>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Nome">{clientName || '—'}</Field>
      <Field label="Usuário (e-mail) *"><Input type="email" defaultValue={clientEmail ?? ''} onChange={e => setAccess({ ...access, username: e.target.value })} placeholder="email@cliente.com" /></Field>
      <Field label="Apelido"><Input onChange={e => setAccess({ ...access, nickname: e.target.value })} placeholder="Identificação interna" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Dia (aniversário)"><Input type="number" min={1} max={31} onChange={e => setAccess({ ...access, birthday_day: Number(e.target.value) })} /></Field>
        <Field label="Mês"><Input type="number" min={1} max={12} onChange={e => setAccess({ ...access, birthday_month: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Senha *"><Input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Mínimo 6 caracteres" /></Field>
      <Field label="Confirmar senha *"><Input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} /></Field>
      <div className="sm:col-span-2"><Button onClick={create} disabled={creating} className="bg-accent text-accent-foreground hover:bg-accent/90"><Save className="w-4 h-4 mr-2" />{creating ? 'Criando...' : 'Criar acesso ao portal'}</Button></div>
    </div>
  );
};

export default ContractForm;
