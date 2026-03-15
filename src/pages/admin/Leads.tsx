import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useLeads } from '@/hooks/useLeads';
import { usePracticeAreas } from '@/hooks/usePracticeAreas';
import { db } from '@/lib/supabase-helpers';
import { toast } from '@/hooks/use-toast';
import { Users, Eye, ArrowRight, Phone, Mail, Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Lead } from '@/types/database';

const KANBAN_COLUMNS = [
  { key: 'new', label: 'Novos', color: 'border-blue-500' },
  { key: 'contacted', label: 'Contatado', color: 'border-yellow-500' },
  { key: 'in_progress', label: 'Em Atendimento', color: 'border-accent' },
  { key: 'proposal', label: 'Proposta', color: 'border-purple-500' },
  { key: 'closed', label: 'Finalizado', color: 'border-green-500' },
];

const Leads = () => {
  const { leads, loading, updateLead, fetchLeads } = useLeads();
  const { areas } = usePracticeAreas();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const getAreaName = (areaId: string | null) => {
    if (!areaId) return 'N/A';
    return areas.find(a => a.id === areaId)?.title ?? 'N/A';
  };

  const moveToColumn = async (lead: Lead, newStatus: string) => {
    const { error } = await updateLead(lead.id, { kanban_status: newStatus });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

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
                <span className="text-sm text-muted-foreground">Mover para:</span>
                <div className="flex flex-wrap gap-2">
                  {KANBAN_COLUMNS.map(c => (
                    <Button
                      key={c.key}
                      variant={selectedLead.kanban_status === c.key ? 'default' : 'outline'}
                      size="sm"
                      onClick={async () => {
                        await moveToColumn(selectedLead, c.key);
                        setSelectedLead({ ...selectedLead, kanban_status: c.key });
                      }}
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default Leads;
