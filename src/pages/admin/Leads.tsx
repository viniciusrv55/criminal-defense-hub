import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { useLeads } from '@/hooks/useLeads';
import { usePracticeAreas } from '@/hooks/usePracticeAreas';
import { db } from '@/lib/supabase-helpers';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Phone, Mail, Calendar, X, UserPlus2, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Lead } from '@/types/database';

interface TeamMemberLite { id: string; user_id: string; full_name: string; active: boolean; }
interface StagePerm { stage: string; team_member_id: string; can_act: boolean; }

const KANBAN_COLUMNS = [
  { key: 'new', label: 'Novos', color: 'border-blue-500' },
  { key: 'contacted', label: 'Contatado', color: 'border-yellow-500' },
  { key: 'in_progress', label: 'Em Atendimento', color: 'border-accent' },
  { key: 'proposal', label: 'Proposta', color: 'border-purple-500' },
  { key: 'closed', label: 'Finalizado', color: 'border-green-500' },
];

const Leads = () => {
  const { leads, loading, updateLead } = useLeads();
  const { areas } = usePracticeAreas();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [converting, setConverting] = useState(false);

  const convertToContract = async (lead: Lead) => {
    setConverting(true);
    try {
      // Find existing client by lead_id
      const { data: existing } = await db.from('clients').select('id').eq('lead_id', lead.id).maybeSingle();
      let clientId: string | null = (existing as { id: string } | null)?.id ?? null;

      if (!clientId) {
        const payload = {
          person_type: 'pf',
          full_name: lead.name,
          emails: lead.email ? [{ label: 'principal', value: lead.email }] : [],
          phones: lead.phone ? [{ label: 'celular', value: lead.phone }] : [],
          notes: lead.message || null,
          lead_id: lead.id,
          created_by: user?.id,
        };
        const { data, error } = await db.from('clients').insert(payload).select('id').single();
        if (error) { toast({ title: 'Erro ao criar cliente', description: error.message, variant: 'destructive' }); setConverting(false); return; }
        clientId = (data as { id: string }).id;
      }

      const { data: ct, error: ctErr } = await db.from('contracts').insert({
        client_id: clientId,
        status: 'draft',
        process_type: 'judicial',
        process_data: lead.practice_area_id ? { practice_area: lead.practice_area_id } : {},
        additional_data: lead.message ? { notes: lead.message } : {},
        adverse_party: {},
        fees: {},
        created_by: user?.id,
      }).select('id').single();
      if (ctErr) { toast({ title: 'Erro ao criar contrato', description: ctErr.message, variant: 'destructive' }); setConverting(false); return; }

      await db.from('lead_history').insert({ lead_id: lead.id, action: 'converted', description: 'Lead convertido em contrato', performed_by: user?.id });
      toast({ title: 'Convertido!', description: 'Cliente e contrato criados.' });
      setConverting(false);
      navigate(`/admin/contratos/${(ct as { id: string }).id}`);
    } catch (e) {
      setConverting(false);
      toast({ title: 'Erro inesperado', variant: 'destructive' });
    }
  };

  const [team, setTeam] = useState<TeamMemberLite[]>([]);
  const [perms, setPerms] = useState<StagePerm[]>([]);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);

  useEffect(() => {
    db.from('team_members').select('id,user_id,full_name,active').eq('active', true).then(({ data }: { data: TeamMemberLite[] | null }) => {
      setTeam(data ?? []);
      if (user) {
        const me = (data ?? []).find(t => t.user_id === user.id);
        setMyMemberId(me?.id ?? null);
      }
    });
    db.from('kanban_stage_permissions').select('stage,team_member_id,can_act').then(({ data }: { data: StagePerm[] | null }) => setPerms(data ?? []));
  }, [user]);

  const canActOnStage = (stage: string) => {
    if (isAdmin()) return true;
    if (!myMemberId) return false;
    return perms.some(p => p.team_member_id === myMemberId && p.stage === stage && p.can_act);
  };

  const canActOnLead = (lead: Lead) => {
    if (isAdmin()) return true;
    if (!myMemberId) return false;
    const isResp = (lead.responsible_ids ?? []).includes(myMemberId);
    return isResp && canActOnStage(lead.kanban_status);
  };

  const getAreaName = (areaId: string | null) => {
    if (!areaId) return 'N/A';
    return areas.find(a => a.id === areaId)?.title ?? 'N/A';
  };

  const moveToColumn = async (lead: Lead, newStatus: string) => {
    if (!isAdmin() && !canActOnLead(lead)) {
      toast({ title: 'Sem permissão', description: 'Você não é responsável por este lead ou não pode atuar nesta etapa.', variant: 'destructive' });
      return;
    }
    if (!isAdmin() && !canActOnStage(newStatus)) {
      toast({ title: 'Sem permissão', description: 'Você não pode mover leads para esta etapa.', variant: 'destructive' });
      return;
    }
    const { error } = await updateLead(lead.id, { kanban_status: newStatus });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      await db.from('lead_history').insert({ lead_id: lead.id, action: 'stage_change', description: `Movido para ${KANBAN_COLUMNS.find(c => c.key === newStatus)?.label}`, performed_by: user?.id });
    }
  };

  const toggleResponsible = async (lead: Lead, memberId: string) => {
    const current = lead.responsible_ids ?? [];
    const next = current.includes(memberId) ? current.filter(i => i !== memberId) : [...current, memberId];
    const { error } = await updateLead(lead.id, { responsible_ids: next } as Partial<Lead>);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else setSelectedLead({ ...lead, responsible_ids: next });
  };

  const responsibleNames = (ids: string[] | null | undefined) =>
    (ids ?? []).map(id => team.find(t => t.id === id)?.full_name).filter(Boolean).join(', ') || '—';


  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">{leads.length} leads no total</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setView('kanban')}>Kanban</Button>
          <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setView('list')}>Lista</Button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map(col => {
            const colLeads = leads.filter(l => l.kanban_status === col.key);
            return (
              <div key={col.key} className="min-w-[280px] flex-1">
                <div className={`p-3 rounded-t-xl bg-card border-t-4 ${col.color} border-x border-border`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-foreground text-sm">{col.label}</h3>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{colLeads.length}</span>
                  </div>
                </div>
                <div className="space-y-2 p-2 bg-muted/30 rounded-b-xl border-x border-b border-border min-h-[200px]">
                  {colLeads.map(lead => (
                    <div
                      key={lead.id}
                      className="p-3 bg-card rounded-lg border border-border cursor-pointer hover:border-accent/50 transition-colors"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <p className="font-medium text-foreground text-sm truncate">{lead.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{getAreaName(lead.practice_area_id)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">👤 {responsibleNames(lead.responsible_ids)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {lead.phone && <Phone className="w-3 h-3 text-muted-foreground" />}
                        <span className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {col.key !== 'closed' && (
                        <div className="flex gap-1 mt-2">
                          {KANBAN_COLUMNS.filter(c => c.key !== col.key).slice(0, 2).map(c => (
                            <button
                              key={c.key}
                              onClick={(e) => { e.stopPropagation(); moveToColumn(lead, c.key); }}
                              className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent/20 hover:text-accent transition-colors"
                            >
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <div key={lead.id} className="flex items-center justify-between p-4 bg-card rounded-xl border border-border cursor-pointer hover:border-accent/50 transition-colors" onClick={() => setSelectedLead(lead)}>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-foreground">{lead.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                  {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(lead.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{getAreaName(lead.practice_area_id)}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{KANBAN_COLUMNS.find(c => c.key === lead.kanban_status)?.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedLead(null)} />
          <div className="relative w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-serif text-lg font-semibold text-foreground">{selectedLead.name}</h3>
              <button onClick={() => setSelectedLead(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Telefone:</span><p className="text-foreground">{selectedLead.phone || 'N/A'}</p></div>
                <div><span className="text-muted-foreground">E-mail:</span><p className="text-foreground">{selectedLead.email || 'N/A'}</p></div>
                <div><span className="text-muted-foreground">Área:</span><p className="text-foreground">{getAreaName(selectedLead.practice_area_id)}</p></div>
                <div><span className="text-muted-foreground">Data:</span><p className="text-foreground">{new Date(selectedLead.created_at).toLocaleDateString('pt-BR')}</p></div>
              </div>
              {selectedLead.message && (
                <div><span className="text-sm text-muted-foreground">Mensagem:</span><p className="text-foreground text-sm mt-1 p-3 bg-muted/50 rounded-lg">{selectedLead.message}</p></div>
              )}
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground flex items-center gap-2"><UserPlus2 className="w-4 h-4" />Responsáveis:</span>
                <div className="flex flex-wrap gap-2">
                  {team.map(t => {
                    const on = (selectedLead.responsible_ids ?? []).includes(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleResponsible(selectedLead, t.id)}
                        disabled={!isAdmin()}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${on ? 'bg-accent text-accent-foreground border-accent' : 'bg-background text-muted-foreground border-border hover:border-accent/50'}`}
                      >
                        {t.full_name}
                      </button>
                    );
                  })}
                  {team.length === 0 && <span className="text-xs text-muted-foreground">Cadastre membros em Equipe.</span>}
                </div>
                {!isAdmin() && <p className="text-[11px] text-muted-foreground">Apenas administradores atribuem responsáveis.</p>}
              </div>
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Mover para:</span>
                <div className="flex flex-wrap gap-2">
                  {KANBAN_COLUMNS.map(c => {
                    const allowed = isAdmin() || (canActOnLead(selectedLead) && canActOnStage(c.key));
                    return (
                      <Button
                        key={c.key}
                        variant={selectedLead.kanban_status === c.key ? 'default' : 'outline'}
                        size="sm"
                        disabled={!allowed}
                        onClick={async () => {
                          await moveToColumn(selectedLead, c.key);
                          setSelectedLead({ ...selectedLead, kanban_status: c.key });
                        }}
                      >
                        {c.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              {isAdmin() && (
                <div className="pt-4 border-t border-border">
                  <Button
                    onClick={() => convertToContract(selectedLead)}
                    disabled={converting}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <FileSignature className="w-4 h-4 mr-2" />
                    {converting ? 'Convertendo...' : 'Converter em Contrato'}
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">Cria cliente e abre o contrato pré-preenchido.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default Leads;
