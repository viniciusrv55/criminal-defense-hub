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
import { FinanceiroTab } from './contract/FinanceiroTab';
import type { Client, Contract, ProcessData, AdverseParty, FeesData, ContractDocument, CustomInstallment } from '@/types/contracts';

const TAB_ORDER = ['cliente', 'processo', 'seguranca', 'adversa', 'honorarios', 'financeiro', 'agendamentos', 'documentos', 'acesso'] as const;
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
  const { user, isAdmin, profileName } = useAuth() as ReturnType<typeof useAuth> & { profileName?: string };
  const { contract, client, loading, setClient, setContract } = useContract(id);
  const { areas } = usePracticeAreas();
  const groupsHook = useClientGroups();
  const paymentMethodsHook = usePaymentMethods();

  const [tab, setTab] = useState<TabKey>('cliente');
  const [saving, setSaving] = useState(false);

  const [clientDraft, setClientDraft] = useState<Partial<Client>>(emptyClient());
  const [contractDraft, setContractDraft] = useState<Partial<Contract>>({
    status: 'draft', process_type: 'judicial', process_data: {}, additional_data: {}, adverse_party: {}, fees: {},
  });

  const [search, setSearch] = useState('');
  const { results, searching } = useClientSearch(search);
  const [docs, setDocs] = useState<ContractDocument[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string; specialty: string | null }[]>([]);
  useEffect(() => {
    db.from('team_members').select('id,full_name,specialty').eq('active', true).order('full_name')
      .then(({ data }: { data: { id: string; full_name: string; specialty: string | null }[] | null }) => setTeamMembers(data ?? []));
  }, []);

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
    // Não cria mais cliente aqui — apenas atualiza campos auxiliares (group/profile/mother/father/notes)
    // dos clientes já cadastrados. Os dados pessoais devem ser editados em /admin/clientes.
    if (!clientDraft.id) {
      toast({ title: 'Selecione um cliente cadastrado', description: 'Cadastre o cliente em "Clientes" antes de criar o contrato.', variant: 'destructive' });
      return null;
    }
    const auxiliary: Partial<Client> = {
      group_id: clientDraft.group_id,
      profile_type: clientDraft.profile_type,
      mother_name: clientDraft.mother_name,
      father_name: clientDraft.father_name,
      notes: clientDraft.notes,
    };
    const { error } = await db.from('clients').update(auxiliary).eq('id', clientDraft.id);
    if (error) { toast({ title: 'Erro ao salvar cliente', description: error.message, variant: 'destructive' }); return null; }
    return clientDraft.id;
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
    if (!clientDraft.id) {
      toast({ title: 'Selecione um cliente', description: 'Pesquise pelo CPF/CNPJ ou nome. Se ainda não existir, cadastre em "Clientes".', variant: 'destructive' });
      return;
    }
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
          <TabsTrigger value="financeiro" disabled={isNew}>Financeiro</TabsTrigger>
          <TabsTrigger value="agendamentos" disabled={isNew}>Agendamentos</TabsTrigger>
          <TabsTrigger value="documentos" disabled={isNew}>Gerar Documento</TabsTrigger>
          <TabsTrigger value="acesso" disabled={isNew}>Acesso ao Cliente</TabsTrigger>
        </TabsList>

        {/* CLIENTE */}
        <TabsContent value="cliente" className="space-y-6">
          {!clientDraft.id && (
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div>
                <Label className="text-foreground text-sm">Buscar cliente cadastrado (CPF, CNPJ ou nome) *</Label>
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
              </div>
              <div className="pt-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-2"><UserPlus className="w-3.5 h-3.5" /> Cliente ainda não cadastrado?</span>
                <Button type="button" variant="outline" size="sm" onClick={() => navigate('/admin/clientes')}>
                  Cadastrar cliente
                </Button>
              </div>
            </div>
          )}

          {clientDraft.id && (
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold text-foreground">Dados do cliente</h3>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => navigate('/admin/clientes')}>
                    Editar no cadastro de cliente
                  </Button>
                  {isNew && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setClient(null); setClientDraft(emptyClient()); setContractDraft(prev => ({ ...prev, client_id: undefined })); }}>
                      Trocar cliente
                    </Button>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-md p-3">
                <Lock className="w-3.5 h-3.5 inline mr-1" />
                Os dados pessoais abaixo são herdados do cadastro do cliente. Para alterá-los, use o menu <strong>Clientes</strong>.
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Tipo">
                  <Input readOnly value={clientDraft.person_type === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'} className="bg-muted/40" />
                </Field>
                <Field label={clientDraft.person_type === 'pj' ? 'Razão social' : 'Nome completo'}>
                  <Input readOnly value={clientDraft.full_name ?? ''} className="bg-muted/40" />
                </Field>

                {clientDraft.person_type === 'pj' ? (
                  <>
                    <Field label="Nome fantasia"><Input readOnly value={clientDraft.trade_name ?? ''} className="bg-muted/40" /></Field>
                    <Field label="CNPJ"><Input readOnly value={clientDraft.cnpj ?? ''} className="bg-muted/40" /></Field>
                    <Field label="Inscrição estadual"><Input readOnly value={clientDraft.state_registration ?? ''} className="bg-muted/40" /></Field>
                  </>
                ) : (
                  <>
                    <Field label="CPF"><Input readOnly value={clientDraft.cpf ?? ''} className="bg-muted/40" /></Field>
                    <Field label="RG"><Input readOnly value={clientDraft.rg ?? ''} className="bg-muted/40" /></Field>
                    <Field label="Nascimento"><Input readOnly value={clientDraft.birth_date ?? ''} className="bg-muted/40" /></Field>
                    <Field label="Estado civil"><Input readOnly value={clientDraft.marital_status ?? ''} className="bg-muted/40" /></Field>
                    <Field label="Nacionalidade"><Input readOnly value={clientDraft.nationality ?? ''} className="bg-muted/40" /></Field>
                    <Field label="Profissão"><Input readOnly value={clientDraft.profession ?? ''} className="bg-muted/40" /></Field>
                  </>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                <Field label="E-mail principal"><Input readOnly value={clientDraft.emails?.[0]?.value ?? ''} className="bg-muted/40" /></Field>
                <Field label="Celular"><Input readOnly value={clientDraft.phones?.[0]?.value ?? ''} className="bg-muted/40" /></Field>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-border">
                <Field label="CEP"><Input readOnly value={clientDraft.cep ?? ''} className="bg-muted/40" /></Field>
                <Field label="Estado"><Input readOnly value={clientDraft.state ?? ''} className="bg-muted/40" /></Field>
                <Field label="Cidade"><Input readOnly value={clientDraft.city ?? ''} className="bg-muted/40" /></Field>
                <Field label="Bairro"><Input readOnly value={clientDraft.neighborhood ?? ''} className="bg-muted/40" /></Field>
                <div className="sm:col-span-2"><Field label="Endereço"><Input readOnly value={clientDraft.address ?? ''} className="bg-muted/40" /></Field></div>
              </div>

              {/* Campos exclusivos do contrato — editáveis */}
              <div className="pt-4 border-t border-border space-y-4">
                <h4 className="text-sm font-semibold text-foreground">Dados específicos deste contrato</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Grupo">
                    <CreatableCombobox
                      value={clientDraft.group_id ?? null}
                      options={groupsHook.groups.filter(g => !g.parent_id).map(g => ({ value: g.id, label: g.name }))}
                      placeholder="Selecione ou cadastre..."
                      emptyText="Nenhum grupo cadastrado"
                      onChange={v => setClientDraft({ ...clientDraft, group_id: v })}
                      onCreate={async (name) => groupsHook.create(name)}
                      onDelete={async (id) => groupsHook.remove(id)}
                      allowClear
                    />
                  </Field>
                  <Field label="Perfil">
                    <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={clientDraft.profile_type ?? ''} onChange={e => setClientDraft({ ...clientDraft, profile_type: e.target.value })}>
                      <option value="">Selecione...</option>
                      {PROFILE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  {clientDraft.person_type === 'pf' && (
                    <>
                      <Field label="Nome do pai"><Input value={clientDraft.father_name ?? ''} onChange={e => setClientDraft({ ...clientDraft, father_name: e.target.value })} /></Field>
                      <Field label="Nome da mãe"><Input value={clientDraft.mother_name ?? ''} onChange={e => setClientDraft({ ...clientDraft, mother_name: e.target.value })} /></Field>
                    </>
                  )}
                  <div className="sm:col-span-2"><Field label="Anamnese / Observações"><Textarea rows={4} value={clientDraft.notes ?? ''} onChange={e => setClientDraft({ ...clientDraft, notes: e.target.value })} placeholder="Histórico, contexto, informações relevantes do caso..." /></Field></div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                  <Field label="Advogado responsável pelo caso">
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={contractDraft.attorney_id ?? ''}
                      onChange={e => setContractDraft({ ...contractDraft, attorney_id: e.target.value || null })}
                    >
                      <option value="">Selecione...</option>
                      {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                  </Field>
                  <Field label="Área de atuação">
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={contractDraft.practice_area_id ?? ''}
                      onChange={e => setContractDraft({ ...contractDraft, practice_area_id: e.target.value || null })}

                >
                  <option value="">Selecione...</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </Field>
                </div>
              </div>
            </div>
          )}
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

        {/* FINANCEIRO */}
        <TabsContent value="financeiro" className="bg-card rounded-xl border border-border p-6 space-y-4">
          <FinanceiroTab
            contractId={contract?.id}
            contract={contract}
            client={client}
            userId={user?.id}
            senderName={profileName ?? user?.email ?? ''}
            paymentMethods={paymentMethodsHook.methods}
          />
        </TabsContent>


        {/* AGENDAMENTOS */}
        <TabsContent value="agendamentos" className="bg-card rounded-xl border border-border p-6 space-y-4">
          <AgendamentosTab contractId={contract?.id} clientId={client?.id} clientName={client?.full_name ?? ''} userId={user?.id} />
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
    const levelLabel = resp.level ? (String(resp.level).toUpperCase() === 'G1' ? 'Primeira Instância' : String(resp.level).toUpperCase() === 'G2' ? 'Segunda Instância' : String(resp.level)) : undefined;

    // Auto-fill adverse party from first non-author party (if not already filled)
    const polo = (resp.parties ?? []) as Array<{ role?: string; name: string; document?: string | null; lawyers?: Array<{ name: string; oab?: string | null }> }>;
    const adverse = polo.find((p) => (p.role ?? '').toUpperCase().includes('PASSIV')) ?? polo[1];
    const adversePatch = !contractDraft.adverse_party?.name && adverse
      ? { ...contractDraft.adverse_party, name: adverse.name, notes: adverse.lawyers?.length ? `Advogado(s): ${adverse.lawyers.map((l) => `${l.name}${l.oab ? ` (OAB ${l.oab})` : ''}`).join('; ')}` : contractDraft.adverse_party?.notes }
      : contractDraft.adverse_party;

    setContractDraft({
      ...contractDraft,
      adverse_party: adversePatch,
      process_data: {
        ...data,
        court: resp.court,
        court_unit: resp.court_unit,
        class_name: resp.class_name,
        subjects: resp.subjects,
        distribution_date: distDate,
        cause_value: resp.cause_value ? String(resp.cause_value) : data.cause_value,
        phase: data.phase || levelLabel || data.phase,
        request: data.request || resp.class_name || data.request,
        secrecy: data.secrecy || !!resp.secrecy_level,
        movements: resp.movements ?? [],
        parties: resp.parties ?? [],
      } as ProcessData & { movements?: unknown[]; parties?: unknown[] },
    });

    // Persist movements & parties on the contract row when already saved
    if (contractDraft.id) {
      await db.from('contracts').update({
        process_parties: { parties: resp.parties ?? [], synced_at: new Date().toISOString() },
        last_cnj_sync_at: new Date().toISOString(),
      }).eq('id', contractDraft.id);

      const rows = (resp.movements ?? []).map((m: { date?: string | null; code?: string | null; name: string; complement?: string | null; court_unit?: string | null }) => ({
        contract_id: contractDraft.id,
        movement_date: m.date ?? null,
        code: m.code ?? null,
        name: m.name,
        complement: m.complement ?? null,
        court_unit: m.court_unit ?? null,
        source: 'datajud',
        fingerprint: `${m.date ?? ''}|${m.code ?? ''}|${(m.name ?? '').slice(0, 120)}`,
        raw: m,
      }));
      if (rows.length) {
        await db.from('process_movements').upsert(rows, { onConflict: 'contract_id,fingerprint', ignoreDuplicates: true });
      }
    }

    toast({
      title: 'CNJ importado',
      description: `${resp.movements_count ?? 0} andamento(s) e ${(resp.parties ?? []).length} parte(s) trazidos do DataJud.`,
    });
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
          onDelete={async (id) => groupsHook.remove(id)}
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
          onDelete={async (id) => comarcasHook.remove(id)}
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
          onDelete={async (id) => varasHook.remove(id)}
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

      {Array.isArray((data as { parties?: Array<{ role?: string; name: string; document?: string | null; lawyers?: Array<{ name: string; oab?: string | null }> }> }).parties) && (data as { parties?: unknown[] }).parties!.length > 0 && (
        <div className="sm:col-span-2 bg-card rounded-lg p-3 border border-border">
          <p className="text-sm font-medium mb-2">Partes e advogados</p>
          <div className="space-y-1.5 text-xs">
            {((data as { parties: Array<{ role?: string; name: string; document?: string | null; lawyers?: Array<{ name: string; oab?: string | null }> }> }).parties).map((p, i) => (
              <div key={i} className="border-l-2 border-accent pl-2">
                <p><span className="font-medium">{p.role ?? 'Parte'}:</span> {p.name}{p.document ? ` — ${p.document}` : ''}</p>
                {p.lawyers?.length ? (
                  <p className="text-muted-foreground">Advogados: {p.lawyers.map((l) => `${l.name}${l.oab ? ` (OAB ${l.oab})` : ''}`).join('; ')}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray((data as { movements?: Array<{ date?: string | null; name: string; complement?: string | null; court_unit?: string | null }> }).movements) && (data as { movements?: unknown[] }).movements!.length > 0 && (
        <div className="sm:col-span-2 bg-card rounded-lg p-3 border border-border">
          <p className="text-sm font-medium mb-2">Andamentos ({(data as { movements: unknown[] }).movements.length})</p>
          <div className="space-y-2 text-xs max-h-72 overflow-y-auto pr-2">
            {((data as { movements: Array<{ date?: string | null; name: string; complement?: string | null; court_unit?: string | null }> }).movements).map((m, i) => (
              <div key={i} className="flex gap-3 border-b border-border pb-1.5">
                <span className="text-muted-foreground w-20 flex-shrink-0">{m.date ? new Date(m.date).toLocaleDateString('pt-BR') : '—'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{m.name}</p>
                  {m.complement && <p className="text-muted-foreground">{m.complement}</p>}
                  {m.court_unit && <p className="text-muted-foreground text-[10px]">{m.court_unit}</p>}
                </div>
              </div>
            ))}
          </div>
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

/**
 * Auto-gera parcelas a partir de: total - entrada, dividido pelo nº de parcelas.
 * Se houver resto (centavos sobrando), cria uma parcela extra com o resto.
 * Ex.: 3000 - 0 entrada, 7x → 6 parcelas de 428,57 + 1 com o saldo (= 428,58 final)
 *      3000 - 600 entrada, 7x → cria 7 parcelas de 342,85 + 1 extra com restante se >0
 * Se o resto da última parcela for >= valor padrão, cria uma N+1 com o restante.
 */
function autoGenerateInstallments(totalContract: number, entry: number, count: number): CustomInstallment[] {
  const remaining = Math.max(0, +(totalContract - entry).toFixed(2));
  if (count <= 0 || remaining <= 0) return [];
  // valor base arredondado para baixo em centavos
  const base = Math.floor((remaining * 100) / count) / 100;
  const parcels: CustomInstallment[] = Array.from({ length: count }, () => ({ value: base.toFixed(2), due_date: '' }));
  // soma e ajusta o resto na última parcela (sempre cabe; se sobrar > base cria nova)
  let used = +(base * count).toFixed(2);
  const leftover = +(remaining - used).toFixed(2);
  if (leftover > 0) {
    if (leftover >= base) {
      parcels.push({ value: leftover.toFixed(2), due_date: '' });
    } else {
      const last = parcels[parcels.length - 1];
      last.value = (parseFloat(last.value) + leftover).toFixed(2);
    }
  }
  return parcels;
}

const FeesFields = ({ data, onChange }: { data: FeesData; onChange: (d: FeesData) => void }) => {
  const set = (patch: Partial<FeesData>) => onChange({ ...data, ...patch });
  const pmHook = usePaymentMethods();

  const customs = data.custom_installments ?? [];
  const updateInstallment = (i: number, patch: Partial<CustomInstallment>) => {
    const next = [...customs]; next[i] = { ...next[i], ...patch }; set({ custom_installments: next });
  };
  const removeInstallment = (i: number) => set({ custom_installments: customs.filter((_, idx) => idx !== i) });

  const totals = useMemo(() => {
    const entry = parseFloat(data.entry ?? '') || 0;
    const total = parseFloat(data.total_value ?? '') || 0;
    const customSum = customs.reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
    return { entry, total, customSum, grand: entry + customSum };
  }, [data.entry, data.total_value, customs]);

  // Recalcula automaticamente parcelas quando muda total/entrada/parcelas
  const handleInstallmentsChange = (val: string) => {
    set({ installments: val });
    if (val === 'À vista' || val === '1x' || val === '') {
      set({ installments: val, custom_installments: [] });
      return;
    }
    const n = parseInt(val.replace('x', ''), 10);
    if (!isFinite(n) || n <= 0) return;
    const generated = autoGenerateInstallments(totals.total, totals.entry, n);
    set({ installments: val, custom_installments: generated });
  };

  const recalc = () => {
    const val = data.installments ?? '';
    if (!val || val === 'À vista' || val === '1x') return;
    const n = parseInt(val.replace('x', ''), 10);
    if (!isFinite(n) || n <= 0) return;
    set({ custom_installments: autoGenerateInstallments(totals.total, totals.entry, n) });
  };

  return (
    <div>
      <h3 className="font-medium text-foreground text-sm mb-3">Honorários</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Valor total dos honorários">
          <CurrencyInput value={data.total_value ?? ''} onChange={v => set({ total_value: v })} />
        </Field>
        <Field label="Entrada">
          <CurrencyInput value={data.entry ?? ''} onChange={v => set({ entry: v })} />
        </Field>
        <Field label="Vencimento da entrada"><Input type="date" value={data.entry_due_date ?? ''} onChange={e => set({ entry_due_date: e.target.value })} /></Field>

        <Field label="Parcelas (do saldo)">
          <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={data.installments ?? ''} onChange={e => handleInstallmentsChange(e.target.value)}>
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
            onDelete={async (id) => pmHook.remove(id)}
            allowClear
          />
        </Field>
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-medium text-foreground text-sm">Plano de parcelas</h3>
            <p className="text-[11px] text-muted-foreground">Calculado automaticamente. Se o valor não for divisível, a última parcela leva o saldo (ou cria-se uma extra).</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={recalc}>Recalcular</Button>
        </div>
        {customs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Defina valor total, entrada e nº de parcelas para gerar o plano.</p>
        ) : (
          <div className="space-y-2">
            {customs.map((p, i) => (
              <div key={i} className="grid grid-cols-[40px_1fr_180px_40px] gap-2 items-end">
                <div className="text-xs text-muted-foreground pb-2 text-center">{i + 1}ª</div>
                <Field label="Valor"><CurrencyInput value={p.value} onChange={v => updateInstallment(i, { value: v })} /></Field>
                <Field label="Vencimento"><Input type="date" value={p.due_date ?? ''} onChange={e => updateInstallment(i, { due_date: e.target.value })} /></Field>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeInstallment(i)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <div className="text-xs text-muted-foreground pt-2 border-t border-border">
              Total: <strong className="text-foreground">{formatBRL(totals.total)}</strong> · Entrada: <strong className="text-foreground">{formatBRL(totals.entry)}</strong> · Parcelas: <strong className="text-foreground">{formatBRL(totals.customSum)}</strong> · <span className="text-accent">Soma final: {formatBRL(totals.grand)}</span>
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

/* =================== DOCUMENTOS (templates + .docx) =================== */

const DocumentsTab = ({ contractId, client, contract, docs, onChange, userId }: { contractId?: string; client: Client | null; contract: Contract | null; docs: ContractDocument[]; onChange: (d: ContractDocument[]) => void; userId?: string }) => {
  const [templates, setTemplates] = useState<{ id: string; title: string; content_html: string; type_id: string }[]>([]);
  const [types, setTypes] = useState<Record<string, string>>({});
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    db.from('document_template_types').select('id, name')
      .then(({ data }: { data: { id: string; name: string }[] | null }) => {
        const map: Record<string, string> = {};
        const receiptIds = new Set<string>();
        (data ?? []).forEach(t => {
          map[t.id] = t.name;
          if (t.name.toLowerCase().includes('recibo')) receiptIds.add(t.id);
        });
        setTypes(map);
        db.from('document_templates').select('id, title, content_html, type_id').eq('active', true)
          .then(({ data: tpls }: { data: { id: string; title: string; content_html: string; type_id: string }[] | null }) => {
            setTemplates((tpls ?? []).filter(t => !receiptIds.has(t.type_id)));
          });
      });
  }, []);

  const generate = async () => {
    if (!contractId || !client || !contract) { toast({ title: 'Salve o contrato antes', variant: 'destructive' }); return; }
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) { toast({ title: 'Selecione um modelo', variant: 'destructive' }); return; }

    setGenerating(true);
    const { applyVariables } = await import('@/lib/document-variables');
    const { htmlToDocxBlob } = await import('@/lib/html-to-docx');
    const filledHtml = applyVariables(tpl.content_html, { client, contract });
    const blob = await htmlToDocxBlob(filledHtml, tpl.title);

    const safeTitle = tpl.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const fileName = `${safeTitle}-${client.full_name.replace(/\s+/g, '_')}-${Date.now()}.docx`;
    const path = `${contractId}/${fileName}`;
    const { error: upErr } = await supabase.storage.from('contracts').upload(path, blob, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    if (upErr) { toast({ title: 'Erro upload', description: upErr.message, variant: 'destructive' }); setGenerating(false); return; }
    const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(path, 60 * 60 * 24 * 365);
    const { data, error } = await db.from('contract_documents').insert({
      contract_id: contractId, document_type: types[tpl.type_id] ?? 'documento', template_name: tpl.title,
      file_url: signed?.signedUrl, file_name: fileName, generated_html: filledHtml, generated_by: userId,
    }).select().single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setGenerating(false); return; }

    onChange([data as ContractDocument, ...docs]);
    await db.from('contract_history').insert({ contract_id: contractId, action: 'document_generated', description: `Documento gerado: ${tpl.title}`, performed_by: userId });

    // download imediato no navegador
    const { default: saveAs } = await import('file-saver');
    saveAs(blob, fileName);

    toast({ title: 'Documento .docx gerado!' });
    setGenerating(false);
  };

  return (
    <>
      {templates.length === 0 ? (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4 text-sm text-foreground">
          ⚠️ Nenhum modelo de contrato/documento cadastrado.
          <p className="text-xs text-muted-foreground mt-1">
            Antes de gerar um contrato você precisa cadastrar um modelo em{' '}
            <a href="/admin/documentos/new" className="text-accent underline">Gerador de Documentos → Novo modelo</a>.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground">
            ℹ️ Selecione um modelo cadastrado em <strong>Gerador de Documentos</strong>. As variáveis serão preenchidas com os dados do cliente e do contrato e o arquivo será exportado em <strong>.docx</strong>.
          </div>
          <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end">
            <Field label="Modelo">
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={templateId ?? ''} onChange={e => setTemplateId(e.target.value || null)}>
                <option value="">Selecione um modelo...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{(types[t.type_id] ? types[t.type_id] + ' — ' : '') + t.title}</option>)}
              </select>
            </Field>
            <Button onClick={generate} disabled={generating || !templateId} className="bg-accent text-accent-foreground hover:bg-accent/90"><FileText className="w-4 h-4 mr-2" />{generating ? 'Gerando...' : 'Gerar .docx'}</Button>
          </div>
        </>
      )}

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
                {d.file_url && <Button asChild variant="outline" size="sm"><a href={d.file_url} target="_blank" rel="noopener"><Download className="w-3 h-3 mr-1" />Baixar</a></Button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
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

/* =================== AGENDAMENTOS =================== */

interface ApptRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  location: string | null;
  notes: string | null;
  attorney_id: string | null;
  appointment_type_id: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendado', confirmed: 'Confirmado', completed: 'Realizado',
  cancelled: 'Cancelado', no_show: 'Não compareceu',
};

const AgendamentosTab = ({ contractId, clientId, clientName, userId }: { contractId?: string; clientId?: string; clientName: string; userId?: string }) => {
  const [appts, setAppts] = useState<ApptRow[]>([]);
  const [types, setTypes] = useState<{ id: string; name: string; duration_minutes: number }[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', appointment_type_id: '', attorney_id: '', starts_at: '', duration_minutes: 30, location: '', notes: '' });

  const reload = async () => {
    if (!contractId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await db.from('appointments').select('id,title,starts_at,ends_at,status,location,notes,attorney_id,appointment_type_id').eq('contract_id', contractId).order('starts_at', { ascending: false });
    setAppts((data ?? []) as ApptRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    db.from('appointment_types').select('id,name,duration_minutes').eq('active', true).order('sort_order')
      .then(({ data }: { data: { id: string; name: string; duration_minutes: number }[] | null }) => setTypes(data ?? []));
    db.from('team_members').select('id,full_name').eq('active', true).order('full_name')
      .then(({ data }: { data: { id: string; full_name: string }[] | null }) => setMembers(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  const openCreate = () => {
    const base = new Date();
    base.setMinutes(0, 0, 0); base.setHours(base.getHours() + 1);
    const iso = new Date(base.getTime() - base.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({
      title: `Reunião — ${clientName}`,
      appointment_type_id: types[0]?.id ?? '',
      attorney_id: '',
      starts_at: iso,
      duration_minutes: types[0]?.duration_minutes ?? 30,
      location: '', notes: '',
    });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!contractId || !form.starts_at || !form.title) return;
    setCreating(true);
    const starts = new Date(form.starts_at);
    const ends = new Date(starts.getTime() + form.duration_minutes * 60000);
    const { data: appt, error } = await db.from('appointments').insert({
      title: form.title,
      appointment_type_id: form.appointment_type_id || null,
      attorney_id: form.attorney_id || null,
      contract_id: contractId,
      client_id: clientId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      location: form.location || null,
      notes: form.notes || null,
      status: 'scheduled',
      created_by: userId,
      created_via: 'admin',
    }).select('id').single();
    setCreating(false);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Agendamento criado' });
    setCreateOpen(false);
    void supabase.functions.invoke('appointment-notify', { body: { appointment_id: (appt as { id: string }).id, kind: 'confirmation' } });
    void reload();
  };

  const changeStatus = async (id: string, status: string) => {
    await db.from('appointments').update({ status }).eq('id', id);
    void reload();
  };

  if (!contractId) return <p className="text-sm text-muted-foreground">Salve o contrato antes de agendar.</p>;
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground">Agendamentos do contrato</h3>
          <p className="text-xs text-muted-foreground">Reuniões, audiências e prazos vinculados a este caso.</p>
        </div>
        <Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="w-4 h-4 mr-2" />Novo</Button>
      </div>
      {appts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhum agendamento ainda.</p>
      ) : (
        <div className="space-y-2">
          {appts.map(a => {
            const d = new Date(a.starts_at);
            const e = new Date(a.ends_at);
            const member = members.find(m => m.id === a.attorney_id);
            const type = types.find(t => t.id === a.appointment_type_id);
            return (
              <div key={a.id} className="p-3 rounded-lg border border-border bg-background flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{a.title}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.status === 'cancelled' ? 'bg-destructive/15 text-destructive' : a.status === 'completed' ? 'bg-green-500/15 text-green-700' : 'bg-accent/15 text-accent'}`}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    {type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{type.name}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} → {e.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {member && ` · ${member.full_name}`}
                    {a.location && ` · ${a.location}`}
                  </p>
                  {a.notes && <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  {a.status !== 'completed' && <Button size="sm" variant="outline" onClick={() => changeStatus(a.id, 'completed')}>Realizado</Button>}
                  {a.status !== 'cancelled' && <Button size="sm" variant="outline" onClick={() => changeStatus(a.id, 'cancelled')}>Cancelar</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCreateOpen(false)} />
          <div className="relative w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-3">
            <h3 className="font-serif text-lg">Novo agendamento</h3>
            <Field label="Título"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.appointment_type_id} onChange={e => {
                  const t = types.find(x => x.id === e.target.value);
                  setForm({ ...form, appointment_type_id: e.target.value, duration_minutes: t?.duration_minutes ?? form.duration_minutes });
                }}>
                  <option value="">—</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="Advogado">
                <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.attorney_id} onChange={e => setForm({ ...form, attorney_id: e.target.value })}>
                  <option value="">—</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início"><Input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></Field>
              <Field label="Duração (min)"><Input type="number" min={5} step={5} value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Local"><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Notas"><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={creating} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}Criar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default ContractForm;
