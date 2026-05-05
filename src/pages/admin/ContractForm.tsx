import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Save, ArrowLeft, ArrowRight, Search, FileText, Download, UserPlus, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/supabase-helpers';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useContract, useClientSearch } from '@/hooks/useContracts';
import { usePracticeAreas } from '@/hooks/usePracticeAreas';
import { useClientGroups, useComarcas, useVaras, usePaymentMethods } from '@/hooks/useContractCatalog';
import { CreatableCombobox } from '@/components/admin/CreatableCombobox';
import { CurrencyInput, formatBRL } from '@/components/admin/CurrencyInput';
import type { Client, Contract, ProcessData, AdverseParty, FeesData, ContractDocument, CustomInstallment } from '@/types/contracts';

const TAB_ORDER = ['cliente', 'processo', 'seguranca', 'adversa', 'honorarios', 'documentos', 'acesso'] as const;
type TabKey = typeof TAB_ORDER[number];

const PROFILE_OPTIONS = ['Cliente', 'Parceiro Comercial', 'Prospect', 'Indicador'];
const PARTY_TYPE_OPTIONS = ['Autor', 'Réu', 'Requerente', 'Requerido', 'Terceiro Interessado', 'Embargante', 'Embargado', 'Exequente', 'Executado'];
const INSTALLMENTS_OPTIONS = ['À vista', ...Array.from({ length: 60 }, (_, i) => `${i + 1}x`)];

const emptyClient = (): Partial<Client> => ({
  person_type: 'pf', full_name: '', emails: [], phones: [], profile_type: 'Cliente',
});

const ContractForm = () => {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { contract, client, loading, setClient, setContract } = useContract(id);
  const { areas } = usePracticeAreas();
  const groupsHook = useClientGroups();

  const [tab, setTab] = useState<TabKey>('cliente');
  const [saving, setSaving] = useState(false);

  const [clientDraft, setClientDraft] = useState<Partial<Client>>(emptyClient());
  const [contractDraft, setContractDraft] = useState<Partial<Contract>>({
    status: 'draft', process_type: 'judicial', process_data: {}, additional_data: {}, adverse_party: {}, fees: {},
  });

  const [search, setSearch] = useState('');
  const { results, searching } = useClientSearch(search);
  const [docs, setDocs] = useState<ContractDocument[]>([]);

  // Verifica se usuário é o advogado responsável (para liberar aba Segurança)
  const [isResponsibleAttorney, setIsResponsibleAttorney] = useState(false);
  useEffect(() => {
    if (!contractDraft.attorney_id || !user) { setIsResponsibleAttorney(false); return; }
    db.from('team_members').select('user_id').eq('id', contractDraft.attorney_id).maybeSingle()
      .then(({ data }: { data: { user_id: string } | null }) => setIsResponsibleAttorney(data?.user_id === user.id));
  }, [contractDraft.attorney_id, user]);
  const canSeeSecurity = isAdmin() || isResponsibleAttorney;

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
    // Quando seleciona cliente existente, herda o group_id no contrato
    setContractDraft(prev => ({ ...prev, client_id: c.id, group_id: prev.group_id ?? c.group_id ?? null }));
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
    const payload = { ...contractDraft, client_id: clientId, created_by: contractDraft.created_by ?? user?.id };
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

  const visibleTabs = TAB_ORDER.filter(t => t !== 'seguranca' || canSeeSecurity);

  const goNext = async () => {
    const idx = visibleTabs.indexOf(tab);
    if (idx === visibleTabs.length - 1) return;
    await handleSave(false);
    setTab(visibleTabs[idx + 1]);
  };
  const goPrev = () => {
    const idx = visibleTabs.indexOf(tab);
    if (idx > 0) setTab(visibleTabs[idx - 1]);
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
          {canSeeSecurity && <TabsTrigger value="seguranca"><Lock className="w-3 h-3 mr-1" />Dados de Segurança</TabsTrigger>}
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
              <Field label="Grupo">
                <CreatableCombobox
                  value={clientDraft.group_id ?? null}
                  options={groupsHook.groups.filter(g => !g.parent_id).map(g => ({ value: g.id, label: g.name }))}
                  placeholder="Selecione ou cadastre..."
                  emptyText="Nenhum grupo cadastrado"
                  onChange={v => setClientDraft({ ...clientDraft, group_id: v })}
                  onCreate={async (name) => groupsHook.create(name)}
                  allowClear
                />
              </Field>
              <Field label="Perfil">
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={clientDraft.profile_type ?? ''} onChange={e => setClientDraft({ ...clientDraft, profile_type: e.target.value })}>
                  <option value="">Selecione...</option>
                  {PROFILE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label={clientDraft.person_type === 'pj' ? 'Razão social *' : 'Nome completo *'}>
                <Input value={clientDraft.full_name ?? ''} onChange={e => setClientDraft({ ...clientDraft, full_name: e.target.value })} />
              </Field>
              <Field label="Nacionalidade"><Input value={clientDraft.nationality ?? ''} onChange={e => setClientDraft({ ...clientDraft, nationality: e.target.value })} /></Field>

              {clientDraft.person_type === 'pf' ? (
                <>
                  <Field label="Profissão"><Input value={clientDraft.profession ?? ''} onChange={e => setClientDraft({ ...clientDraft, profession: e.target.value })} /></Field>
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
                <Input value={clientDraft.phones?.[0]?.value ?? ''} onChange={e => setClientDraft({ ...clientDraft, phones: [{ label: 'celular', value: e.target.value }] })} />
              </Field>
              <Field label="Contato secundário (nome)"><Input value={clientDraft.contact_name ?? ''} onChange={e => setClientDraft({ ...clientDraft, contact_name: e.target.value })} /></Field>
              <Field label="Telefone do contato"><Input value={clientDraft.contact_phone ?? ''} onChange={e => setClientDraft({ ...clientDraft, contact_phone: e.target.value })} /></Field>
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
              <div className="sm:col-span-2"><Field label="Anamnese / Observações"><Textarea rows={4} value={clientDraft.notes ?? ''} onChange={e => setClientDraft({ ...clientDraft, notes: e.target.value })} placeholder="Histórico, contexto, informações relevantes do caso..." /></Field></div>
            </div>
          </div>
        </TabsContent>

        {/* PROCESSO */}
        <TabsContent value="processo" className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={contractDraft.process_type === 'judicial'} onChange={() => setContractDraft({ ...contractDraft, process_type: 'judicial' })} /> Processo judicial</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={contractDraft.process_type === 'administrative'} onChange={() => setContractDraft({ ...contractDraft, process_type: 'administrative' })} /> Processo administrativo</label>
          </div>
          <ProcessFields
            contractDraft={contractDraft}
            setContractDraft={setContractDraft}
            clientGroupId={clientDraft.group_id ?? null}
            groupsHook={groupsHook}
          />
        </TabsContent>

        {/* DADOS DE SEGURANÇA */}
        {canSeeSecurity && (
          <TabsContent value="seguranca" className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg p-3">
              <Lock className="w-3.5 h-3.5 text-accent" /> Esta aba só é visível para o advogado responsável e administradores.
            </div>
            <Field label="Senha do processo / segredo de justiça"><Input value={contractDraft.process_data?.locator ?? ''} onChange={e => setContractDraft({ ...contractDraft, process_data: { ...contractDraft.process_data, locator: e.target.value } })} /></Field>
            <Field label="Anotações sigilosas"><Textarea rows={6} value={(contractDraft.additional_data as { security_notes?: string })?.security_notes ?? ''} onChange={e => setContractDraft({ ...contractDraft, additional_data: { ...contractDraft.additional_data, security_notes: e.target.value } })} /></Field>
          </TabsContent>
        )}

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
        <Button variant="outline" onClick={goPrev} disabled={tab === visibleTabs[0]}><ArrowLeft className="w-4 h-4 mr-1" />Anterior</Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}><Save className="w-4 h-4 mr-2" />Salvar e Sair</Button>
          {tab !== visibleTabs[visibleTabs.length - 1] && (
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

/* =================== PROCESSO =================== */

const ProcessFields = ({
  contractDraft, setContractDraft, clientGroupId, groupsHook,
}: {
  contractDraft: Partial<Contract>;
  setContractDraft: (c: Partial<Contract>) => void;
  clientGroupId: string | null;
  groupsHook: ReturnType<typeof useClientGroups>;
}) => {
  const data = contractDraft.process_data ?? {};
  const setPD = (patch: Partial<ProcessData>) => setContractDraft({ ...contractDraft, process_data: { ...data, ...patch } });

  const comarcasHook = useComarcas();
  const varasHook = useVaras(contractDraft.comarca_id);
  const [cnjLoading, setCnjLoading] = useState(false);

  // Subgrupos do cliente: filhos do grupo do cliente. Se não houver, mostra todos do grupo raiz selecionado.
  const subgroupOptions = useMemo(() => {
    if (!clientGroupId) return [];
    return groupsHook.groups.filter(g => g.parent_id === clientGroupId).map(g => ({ value: g.id, label: g.name }));
  }, [groupsHook.groups, clientGroupId]);

  const lookupCnj = async () => {
    const cnj = data.cnj_number?.trim();
    if (!cnj) { toast({ title: 'Informe o CNJ', variant: 'destructive' }); return; }
    setCnjLoading(true);
    const { data: resp, error } = await supabase.functions.invoke('cnj-lookup', { body: { cnj } });
    setCnjLoading(false);
    if (error) { toast({ title: 'Erro ao consultar CNJ', description: error.message, variant: 'destructive' }); return; }
    if (resp?.error) { toast({ title: 'CNJ', description: resp.error, variant: 'destructive' }); return; }
    const distDate = resp.distribution_date ? String(resp.distribution_date).slice(0, 10) : undefined;
    setPD({
      court: resp.court, court_unit: resp.court_unit, class_name: resp.class_name,
      subjects: resp.subjects, distribution_date: distDate, cause_value: resp.cause_value ? String(resp.cause_value) : data.cause_value,
    });
    toast({ title: 'Dados importados do CNJ' });
  };

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Grupo (subgrupo do cliente)">
        <CreatableCombobox
          value={contractDraft.group_id ?? null}
          options={subgroupOptions}
          placeholder={clientGroupId ? 'Selecione ou cadastre subgrupo...' : 'Defina o grupo do cliente primeiro'}
          emptyText="Nenhum subgrupo. Cadastre digitando o nome."
          onChange={v => setContractDraft({ ...contractDraft, group_id: v })}
          onCreate={async (name) => clientGroupId ? groupsHook.create(name, { parent_id: clientGroupId }) : null}
          disabled={!clientGroupId}
          allowClear
        />
      </Field>
      <Field label="Tipo de parte">
        <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={contractDraft.party_type ?? ''} onChange={e => setContractDraft({ ...contractDraft, party_type: e.target.value })}>
          <option value="">Selecione...</option>
          {PARTY_TYPE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      <Field label="Número CNJ">
        <div className="flex gap-2">
          <Input value={data.cnj_number ?? ''} onChange={e => setPD({ cnj_number: e.target.value })} placeholder="0000000-00.0000.0.00.0000" />
          <Button type="button" variant="outline" onClick={lookupCnj} disabled={cnjLoading}>
            {cnjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
      </Field>
      <Field label="Número interno"><Input value={data.process_number ?? ''} onChange={e => setPD({ process_number: e.target.value })} /></Field>

      <Field label="Comarca">
        <CreatableCombobox
          value={contractDraft.comarca_id ?? null}
          options={comarcasHook.comarcas.map(c => ({ value: c.id, label: c.state ? `${c.name} / ${c.state}` : c.name }))}
          placeholder="Selecione ou cadastre comarca..."
          emptyText="Nenhuma comarca cadastrada"
          onChange={v => setContractDraft({ ...contractDraft, comarca_id: v, vara_id: null })}
          onCreate={async (name) => comarcasHook.create(name)}
          allowClear
        />
      </Field>
      <Field label="Vara">
        <CreatableCombobox
          value={contractDraft.vara_id ?? null}
          options={varasHook.varas.map(v => ({ value: v.id, label: v.location ? `${v.vara_number} — ${v.location}` : v.vara_number }))}
          placeholder={contractDraft.comarca_id ? 'Selecione ou cadastre vara...' : 'Selecione a comarca primeiro'}
          emptyText="Nenhuma vara para esta comarca"
          onChange={v => setContractDraft({ ...contractDraft, vara_id: v })}
          onCreate={async (label) => varasHook.create(label)}
          disabled={!contractDraft.comarca_id}
          allowClear
        />
      </Field>

      <Field label="Fase"><Input value={data.phase ?? ''} onChange={e => setPD({ phase: e.target.value })} /></Field>
      <Field label="Responsável"><Input value={data.responsible ?? ''} onChange={e => setPD({ responsible: e.target.value })} /></Field>

      <Field label="Parceiro"><Input value={data.partner ?? ''} onChange={e => setPD({ partner: e.target.value })} /></Field>
      <Field label="Prognóstico"><Input value={data.prognosis ?? ''} onChange={e => setPD({ prognosis: e.target.value })} /></Field>

      <Field label="Contratação"><Input type="date" value={data.contract_date ?? ''} onChange={e => setPD({ contract_date: e.target.value })} /></Field>
      <Field label="Distribuição"><Input type="date" value={data.distribution_date ?? ''} onChange={e => setPD({ distribution_date: e.target.value })} /></Field>

      <Field label="Sentença"><Input type="date" value={data.sentence_date ?? ''} onChange={e => setPD({ sentence_date: e.target.value })} /></Field>
      <Field label="Trânsito julgado"><Input type="date" value={data.judgment_date ?? ''} onChange={e => setPD({ judgment_date: e.target.value })} /></Field>

      <Field label="Execução"><Input type="date" value={data.execution_date ?? ''} onChange={e => setPD({ execution_date: e.target.value })} /></Field>
      <Field label="Encerramento"><Input type="date" value={data.closure_date ?? ''} onChange={e => setPD({ closure_date: e.target.value })} /></Field>

      <Field label="Valor da causa"><CurrencyInput value={data.cause_value ?? ''} onChange={v => setPD({ cause_value: v })} /></Field>
      <Field label="Outro valor"><CurrencyInput value={data.other_value ?? ''} onChange={v => setPD({ other_value: v })} /></Field>

      <div className="sm:col-span-2"><Field label="Pedido"><Textarea rows={2} value={data.request ?? ''} onChange={e => setPD({ request: e.target.value })} /></Field></div>
      <div className="sm:col-span-2"><Field label="Observação"><Textarea rows={3} value={data.notes ?? ''} onChange={e => setPD({ notes: e.target.value })} /></Field></div>

      <div className="flex items-center gap-3"><Switch checked={!!data.secrecy} onCheckedChange={v => setPD({ secrecy: v })} /><Label className="text-sm">Segredo de justiça</Label></div>
      <div className="flex items-center gap-3"><Switch checked={!!data.capture_updates} onCheckedChange={v => setPD({ capture_updates: v })} /><Label className="text-sm">Capturar andamentos</Label></div>

      {(data.court || data.class_name) && (
        <div className="sm:col-span-2 bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground border border-border">
          <p className="font-medium text-foreground mb-1">Dados importados do DataJud:</p>
          {data.court && <p>Tribunal: {data.court}</p>}
          {data.court_unit && <p>Órgão: {data.court_unit}</p>}
          {data.class_name && <p>Classe: {data.class_name}</p>}
          {data.subjects?.length ? <p>Assuntos: {data.subjects.join(', ')}</p> : null}
        </div>
      )}
    </div>
  );
};

/* =================== PARTE ADVERSA =================== */

const AdverseFields = ({ data, onChange }: { data: AdverseParty; onChange: (d: AdverseParty) => void }) => {
  const set = (k: keyof AdverseParty, v: unknown) => onChange({ ...data, [k]: v });
  const isPJ = data.person_type === 'pj';
  return (
    <>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!isPJ} onChange={() => set('person_type', 'pf')} /> Pessoa física</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={isPJ} onChange={() => set('person_type', 'pj')} /> Pessoa jurídica</label>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={isPJ ? 'Razão social' : 'Nome'}><Input value={data.name ?? ''} onChange={e => set('name', e.target.value)} /></Field>
        <Field label={isPJ ? 'CNPJ' : 'CPF'}>
          <Input value={(isPJ ? data.cnpj : data.cpf) ?? ''} onChange={e => set(isPJ ? 'cnpj' : 'cpf', e.target.value)} />
        </Field>
        {!isPJ && <Field label="RG"><Input value={data.rg ?? ''} onChange={e => set('rg', e.target.value)} /></Field>}
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

/* =================== HONORÁRIOS =================== */

const FeesFields = ({ data, onChange }: { data: FeesData; onChange: (d: FeesData) => void }) => {
  const set = (patch: Partial<FeesData>) => onChange({ ...data, ...patch });
  const pmHook = usePaymentMethods();

  // Custom installments
  const customs = data.custom_installments ?? [];
  const addInstallment = () => set({ custom_installments: [...customs, { value: '', due_date: '' }] });
  const updateInstallment = (i: number, patch: Partial<CustomInstallment>) => {
    const next = [...customs]; next[i] = { ...next[i], ...patch }; set({ custom_installments: next });
  };
  const removeInstallment = (i: number) => set({ custom_installments: customs.filter((_, idx) => idx !== i) });

  // Auto-calcula saldo remanescente: entrada + soma das parcelas customizadas
  const totals = useMemo(() => {
    const entry = parseFloat(data.entry ?? '') || 0;
    const customSum = customs.reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
    return { entry, customSum, total: entry + customSum };
  }, [data.entry, customs]);

  return (
    <div>
      <h3 className="font-medium text-foreground text-sm mb-3">Honorários</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Entrada"><CurrencyInput value={data.entry ?? ''} onChange={v => set({ entry: v })} /></Field>
        <Field label="Vencimento da entrada"><Input type="date" value={data.entry_due_date ?? ''} onChange={e => set({ entry_due_date: e.target.value })} /></Field>

        <Field label="Parcelas">
          <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={data.installments ?? ''} onChange={e => set({ installments: e.target.value })}>
            <option value="">Selecione...</option>
            {INSTALLMENTS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Forma de pagamento">
          <CreatableCombobox
            value={data.payment_method ? (pmHook.methods.find(m => m.name === data.payment_method)?.id ?? null) : null}
            options={pmHook.methods.map(m => ({ value: m.id, label: m.name }))}
            placeholder="Selecione ou cadastre..."
            emptyText="Nenhuma forma cadastrada"
            onChange={(id) => {
              const name = pmHook.methods.find(m => m.id === id)?.name ?? null;
              set({ payment_method: name ?? '' });
            }}
            onCreate={async (name) => {
              const id = await pmHook.create(name);
              if (id) set({ payment_method: name });
              return id;
            }}
            allowClear
          />
        </Field>
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-foreground text-sm">Parcelas personalizadas</h3>
          <Button type="button" size="sm" variant="outline" onClick={addInstallment}><Plus className="w-3 h-3 mr-1" />Adicionar parcela</Button>
        </div>
        {customs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Adicione parcelas com valores específicos. Ex.: 7x de R$500,00 + saldo R$450,00 (8ª parcela).</p>
        ) : (
          <div className="space-y-2">
            {customs.map((p, i) => (
              <div key={i} className="grid grid-cols-[40px_1fr_180px_40px] gap-2 items-end">
                <div className="text-xs text-muted-foreground pb-2 text-center">{i + 1}ª</div>
                <Field label={`Valor`}><CurrencyInput value={p.value} onChange={v => updateInstallment(i, { value: v })} /></Field>
                <Field label="Vencimento"><Input type="date" value={p.due_date ?? ''} onChange={e => updateInstallment(i, { due_date: e.target.value })} /></Field>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeInstallment(i)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <div className="text-xs text-muted-foreground pt-2 border-t border-border">
              Entrada: <strong className="text-foreground">{formatBRL(totals.entry)}</strong> · Soma das parcelas: <strong className="text-foreground">{formatBRL(totals.customSum)}</strong> · <span className="text-accent">Total: {formatBRL(totals.total)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <Field label="Observações"><Textarea rows={3} value={data.notes ?? ''} onChange={e => set({ notes: e.target.value })} /></Field>
      </div>
    </div>
  );
};

/* =================== DOCUMENTOS =================== */

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
        ℹ️ O documento será gerado em HTML usando os dados das abas anteriores.
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
      <p>Pelo presente instrumento particular de procuração, o(a) outorgante nomeia e constitui seu bastante procurador o outorgado acima qualificado, conferindo-lhe os poderes da cláusula <em>ad judicia et extra</em> para o foro em geral.</p>
      <p style="text-align:right">${today}</p>
    ` + foot;
  }
  if (type === 'declaracao') {
    return head + `<h1>Declaração</h1><p>Eu, ${client.full_name}, ${client.cpf ? 'CPF '+client.cpf : ''}, declaro para os devidos fins que constituí o(a) advogado(a) Lindomberto Moraes para defesa dos meus interesses no processo em referência.</p><p style="text-align:right">${today}</p>` + foot;
  }
  if (type === 'contrato_honorarios') {
    const f = contract.fees ?? {};
    const entry = parseFloat(f.entry ?? '') || 0;
    const customs = f.custom_installments ?? [];
    const customsHtml = customs.length
      ? `<ul>${customs.map((p, i) => `<li>${i + 1}ª parcela: ${formatBRL(parseFloat(p.value) || 0)}${p.due_date ? ' — venc. ' + new Date(p.due_date).toLocaleDateString('pt-BR') : ''}</li>`).join('')}</ul>`
      : '';
    return head + `
      <h1>Contrato de Prestação de Serviços Advocatícios</h1>
      <p><strong>CONTRATANTE:</strong> ${client.full_name}, ${client.cpf ? 'CPF '+client.cpf : (client.cnpj ? 'CNPJ '+client.cnpj : '')}, residente em ${enderecoFmt}.</p>
      <p><strong>CONTRATADO:</strong> Lindomberto Moraes Advocacia.</p>
      <p><strong>Cláusula 1ª — Objeto:</strong> Prestação de serviços advocatícios.</p>
      <p><strong>Cláusula 2ª — Honorários:</strong> Entrada de ${formatBRL(entry)} (${f.installments ?? 'à vista'}). Forma de pagamento: ${f.payment_method ?? '____'}.</p>
      ${customsHtml}
      <p><strong>Cláusula 3ª — Honorários sucumbenciais:</strong> ${f.succumbence_fees ?? 'Pertencem ao contratado'}.</p>
      <p><strong>Cláusula 4ª — Foro:</strong> Fica eleito o foro de ${client.city ?? '____'}/${client.state ?? '__'} para dirimir quaisquer questões.</p>
      <p style="text-align:right">${today}</p>
    ` + foot;
  }
  return head + `<h1>${type}</h1><p>Documento referente ao cliente ${client.full_name}.</p>` + foot;
};

/* =================== PORTAL ACCESS =================== */

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
    const { data: signUp, error: suErr } = await supabase.auth.signUp({ email: access.username, password: pwd, options: { data: { full_name: clientName }, emailRedirectTo: window.location.origin } });
    if (suErr || !signUp.user) { toast({ title: 'Erro', description: suErr?.message, variant: 'destructive' }); setCreating(false); return; }
    const { error } = await db.from('client_portal_access').insert({ client_id: clientId, user_id: signUp.user.id, username: access.username, nickname: access.nickname, birthday_day: access.birthday_day, birthday_month: access.birthday_month, active: true });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setCreating(false); return; }
    await db.from('user_roles').insert({ user_id: signUp.user.id, role: 'client' });
    toast({ title: 'Acesso criado!' });
    setCreating(false);
  };

  if (loadingA) return <p className="text-xs text-muted-foreground">Carregando...</p>;

  if (access?.id) {
    return (
      <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm">
        <p className="text-foreground font-medium">Acesso já configurado</p>
        <p className="text-xs text-muted-foreground mt-1">Login: {access.username}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="E-mail (login)"><Input type="email" value={access?.username ?? clientEmail ?? ''} onChange={e => setAccess({ ...access, username: e.target.value })} /></Field>
        <Field label="Apelido"><Input value={access?.nickname ?? ''} onChange={e => setAccess({ ...access, nickname: e.target.value })} /></Field>
        <Field label="Senha"><Input type="password" value={pwd} onChange={e => setPwd(e.target.value)} /></Field>
        <Field label="Confirmar senha"><Input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} /></Field>
      </div>
      <Button onClick={create} disabled={creating} className="bg-accent text-accent-foreground hover:bg-accent/90">{creating ? 'Criando...' : 'Criar acesso'}</Button>
    </div>
  );
};

export default ContractForm;
