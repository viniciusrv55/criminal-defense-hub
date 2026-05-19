import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Pencil } from 'lucide-react';

type Audience = {
  id: string; name: string; description: string | null; source: string;
  filters: Record<string, unknown>; member_count: number; legal_basis: string | null; active: boolean;
};

const empty: Partial<Audience> = { name: '', source: 'leads', filters: {}, legal_basis: 'legitimate_interest', active: true };

export default function CampaignAudiences() {
  const [items, setItems] = useState<Audience[]>([]);
  const [editing, setEditing] = useState<Partial<Audience> | null>(null);
  const [preview, setPreview] = useState<number | null>(null);

  const load = async () => {
    const { data } = await supabase.from('audiences').select('*').order('created_at', { ascending: false });
    setItems((data ?? []) as unknown as Audience[]);
  };
  useEffect(() => { load(); }, []);

  // Build & save: query source by filters, then populate audience_members
  const buildMembers = async (audienceId: string, source: string, filters: Record<string, unknown>) => {
    let members: { name: string | null; phone: string | null; email: string | null; lead_id?: string; client_id?: string }[] = [];
    if (source === 'leads') {
      let q = supabase.from('leads').select('id, name, phone, email, practice_area_id, kanban_status, status');
      if (filters.practice_area_id) q = q.eq('practice_area_id', String(filters.practice_area_id));
      if (filters.kanban_status) q = q.eq('kanban_status', String(filters.kanban_status));
      const { data } = await q.limit(5000);
      members = (data ?? []).map(l => ({ name: l.name, phone: l.phone, email: l.email, lead_id: l.id }));
    } else if (source === 'clients') {
      const { data } = await supabase.from('clients').select('id, full_name, phones, emails, contact_phone').limit(5000);
      members = (data ?? []).map(c => {
        const phones = (c.phones ?? []) as { number?: string }[];
        const emails = (c.emails ?? []) as { email?: string }[];
        const phone = phones[0]?.number ?? c.contact_phone ?? null;
        const email = emails[0]?.email ?? null;
        return { name: c.full_name, phone, email, client_id: c.id };
      });
    }
    // dedupe by phone+email
    const seen = new Set<string>();
    const dedup = members.filter(m => {
      const k = `${m.phone ?? ''}|${m.email ?? ''}`;
      if (!m.phone && !m.email) return false;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    // clear + insert
    await supabase.from('audience_members').delete().eq('audience_id', audienceId);
    if (dedup.length > 0) {
      const chunks = [];
      for (let i = 0; i < dedup.length; i += 500) chunks.push(dedup.slice(i, i + 500));
      for (const c of chunks) {
        await supabase.from('audience_members').insert(c.map(m => ({ ...m, audience_id: audienceId })));
      }
    }
    await supabase.from('audiences').update({ member_count: dedup.length }).eq('id', audienceId);
    return dedup.length;
  };

  const save = async () => {
    if (!editing?.name) return toast.error('Nome obrigatório');
    const payload = { ...editing, filters: (editing.filters ?? {}) as never };
    delete (payload as { id?: string }).id;
    delete (payload as { member_count?: number }).member_count;
    const op = editing.id
      ? supabase.from('audiences').update(payload).eq('id', editing.id).select('id').single()
      : supabase.from('audiences').insert(payload as { name: string; source: string }).select('id').single();
    const { data, error } = await op;
    if (error) return toast.error(error.message);
    const count = await buildMembers(data!.id, editing.source ?? 'leads', editing.filters ?? {});
    toast.success(`Público salvo com ${count} contatos`);
    setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir público?')) return;
    await supabase.from('audiences').delete().eq('id', id);
    load();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif">Públicos</h1>
          <p className="text-sm text-muted-foreground">Segmentos de leads ou clientes para campanhas.</p>
        </div>
        <Button onClick={() => setEditing(empty)}><Plus className="w-4 h-4 mr-2" />Novo público</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(a => (
          <div key={a.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground uppercase">{a.source}</div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing(a)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" /> {a.member_count} contato(s)
            </div>
            {a.description && <p className="text-xs text-muted-foreground mt-2">{a.description}</p>}
          </div>
        ))}
        {items.length === 0 && <div className="text-muted-foreground text-sm">Nenhum público criado.</div>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar' : 'Novo'} público</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editing?.name ?? ''} onChange={e => setEditing({ ...editing!, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={editing?.description ?? ''} onChange={e => setEditing({ ...editing!, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fonte</Label>
                <Select value={editing?.source ?? 'leads'} onValueChange={v => setEditing({ ...editing!, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leads">Leads</SelectItem>
                    <SelectItem value="clients">Clientes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Base legal (LGPD)</Label>
                <Select value={editing?.legal_basis ?? 'legitimate_interest'} onValueChange={v => setEditing({ ...editing!, legal_basis: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opt_in">Consentimento (opt-in)</SelectItem>
                    <SelectItem value="legitimate_interest">Legítimo interesse</SelectItem>
                    <SelectItem value="contract">Execução de contrato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editing?.source === 'leads' && (
              <div className="rounded-md border border-border p-3 space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filtros de leads</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="ID área de atuação (opcional)"
                    value={(editing.filters?.['practice_area_id'] as string) ?? ''}
                    onChange={e => setEditing({ ...editing, filters: { ...editing.filters, practice_area_id: e.target.value } })} />
                  <Input placeholder="Status kanban (opcional)"
                    value={(editing.filters?.['kanban_status'] as string) ?? ''}
                    onChange={e => setEditing({ ...editing, filters: { ...editing.filters, kanban_status: e.target.value } })} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar e popular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
