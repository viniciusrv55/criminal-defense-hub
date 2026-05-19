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
import { Plus, Play, Pause, Trash2, Send, BarChart2 } from 'lucide-react';

type Campaign = {
  id: string; name: string; channel: 'whatsapp' | 'email';
  audience_id: string | null; template_id: string | null; whatsapp_instance_id: string | null;
  from_email: string | null; from_name: string | null; subject_override: string | null; body_override: string | null;
  media_url: string | null; scheduled_at: string | null; status: string;
  throttle_per_minute: number; stats: { sent?: number; failed?: number; delivered?: number; read?: number } | null;
  created_at: string;
};

const empty: Partial<Campaign> = { name: '', channel: 'whatsapp', throttle_per_minute: 10 };

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho', scheduled: 'Agendada', running: 'Enviando',
  paused: 'Pausada', completed: 'Concluída', failed: 'Falhou',
};

export default function Campaigns() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [audiences, setAudiences] = useState<{ id: string; name: string; member_count: number }[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string; channel: string; subject: string | null; body: string }[]>([]);
  const [instances, setInstances] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null);
  const [recipients, setRecipients] = useState<Record<string, { sent: number; failed: number; pending: number; total: number }>>({});

  const load = async () => {
    const [{ data: c }, { data: a }, { data: t }, { data: i }] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('audiences').select('id,name,member_count').eq('active', true),
      supabase.from('message_templates').select('id,name,channel,subject,body').eq('active', true),
      supabase.from('whatsapp_instances').select('id,name'),
    ]);
    setItems((c ?? []) as unknown as Campaign[]);
    setAudiences(a ?? []); setTemplates(t ?? []); setInstances(i ?? []);

    // batch recipient counts
    const stats: Record<string, { sent: number; failed: number; pending: number; total: number }> = {};
    for (const cmp of (c ?? [])) {
      const { data: rows } = await supabase.from('campaign_recipients').select('status').eq('campaign_id', cmp.id);
      const total = rows?.length ?? 0;
      const sent = rows?.filter(r => ['sent','delivered','read'].includes(r.status)).length ?? 0;
      const failed = rows?.filter(r => r.status === 'failed').length ?? 0;
      const pending = rows?.filter(r => ['pending','sending'].includes(r.status)).length ?? 0;
      stats[cmp.id] = { sent, failed, pending, total };
    }
    setRecipients(stats);
  };
  useEffect(() => { load(); }, []);

  // Populate recipients from audience members
  const seedRecipients = async (campaignId: string, audienceId: string) => {
    const { data: members } = await supabase.from('audience_members').select('*').eq('audience_id', audienceId);
    if (!members?.length) return 0;
    const rows = members.map(m => ({
      campaign_id: campaignId,
      audience_member_id: m.id,
      name: m.name, phone: m.phone, email: m.email, vars: m.vars ?? {},
    }));
    // chunk
    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from('campaign_recipients').insert(rows.slice(i, i + 500));
    }
    return rows.length;
  };

  const save = async (start = false) => {
    if (!editing?.name || !editing.channel) return toast.error('Nome e canal obrigatórios');
    if (!editing.audience_id) return toast.error('Selecione um público');
    if (!editing.body_override && !editing.template_id) return toast.error('Selecione um modelo ou escreva o corpo');
    if (editing.channel === 'whatsapp' && !editing.whatsapp_instance_id) return toast.error('Selecione uma instância WhatsApp');

    const payload = { ...editing };
    delete (payload as { id?: string }).id;
    delete (payload as { stats?: unknown }).stats;
    delete (payload as { created_at?: string }).created_at;
    if (start) {
      payload.status = editing.scheduled_at ? 'scheduled' : 'running';
    }
    const op = editing.id
      ? supabase.from('campaigns').update(payload).eq('id', editing.id).select('id').single()
      : supabase.from('campaigns').insert(payload as { name: string; channel: string }).select('id').single();
    const { data, error } = await op;
    if (error) return toast.error(error.message);

    if (!editing.id && editing.audience_id) {
      const total = await seedRecipients(data!.id, editing.audience_id);
      toast.success(`Campanha criada com ${total} destinatários`);
    } else {
      toast.success('Campanha salva');
    }

    if (start && !editing.scheduled_at) {
      await supabase.functions.invoke('campaign-worker', { body: {} });
      toast.success('Envio iniciado');
    }
    setEditing(null); load();
  };

  const setStatus = async (id: string, status: string) => {
    await supabase.from('campaigns').update({ status }).eq('id', id);
    if (status === 'running') await supabase.functions.invoke('campaign-worker', { body: {} });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir campanha e destinatários?')) return;
    await supabase.from('campaigns').delete().eq('id', id);
    load();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif">Campanhas</h1>
          <p className="text-sm text-muted-foreground">Disparo em massa por WhatsApp ou e-mail.</p>
        </div>
        <Button onClick={() => setEditing(empty)}><Plus className="w-4 h-4 mr-2" />Nova campanha</Button>
      </div>

      <div className="space-y-3">
        {items.map(c => {
          const r = recipients[c.id] ?? { sent: 0, failed: 0, pending: 0, total: 0 };
          const pct = r.total ? Math.round(((r.sent + r.failed) / r.total) * 100) : 0;
          return (
            <div key={c.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {c.name}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent uppercase tracking-wider">{STATUS_LABEL[c.status] ?? c.status}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">{c.channel}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.total} destinatários · {r.sent} enviados · {r.failed} falhas · {r.pending} pendentes
                  </div>
                </div>
                <div className="flex gap-1">
                  {c.status === 'draft' && <Button size="sm" onClick={() => setStatus(c.id, 'running')}><Send className="w-4 h-4 mr-1" />Iniciar</Button>}
                  {c.status === 'running' && <Button size="sm" variant="outline" onClick={() => setStatus(c.id, 'paused')}><Pause className="w-4 h-4 mr-1" />Pausar</Button>}
                  {c.status === 'paused' && <Button size="sm" onClick={() => setStatus(c.id, 'running')}><Play className="w-4 h-4 mr-1" />Retomar</Button>}
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="text-muted-foreground text-sm">Nenhuma campanha ainda.</div>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar' : 'Nova'} campanha</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing?.name ?? ''} onChange={e => setEditing({ ...editing!, name: e.target.value })} />
              </div>
              <div>
                <Label>Canal</Label>
                <Select value={editing?.channel ?? 'whatsapp'} onValueChange={v => setEditing({ ...editing!, channel: v as 'whatsapp' | 'email' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Público</Label>
              <Select value={editing?.audience_id ?? ''} onValueChange={v => setEditing({ ...editing!, audience_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar público" /></SelectTrigger>
                <SelectContent>
                  {audiences.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.member_count})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modelo (opcional)</Label>
              <Select
                value={editing?.template_id ?? ''}
                onValueChange={v => {
                  const t = templates.find(x => x.id === v);
                  setEditing({
                    ...editing!,
                    template_id: v,
                    subject_override: t?.subject ?? editing?.subject_override ?? null,
                    body_override: t?.body ?? editing?.body_override ?? null,
                  });
                }}>
                <SelectTrigger><SelectValue placeholder="Sem modelo (texto livre)" /></SelectTrigger>
                <SelectContent>
                  {templates.filter(t => t.channel === editing?.channel || t.channel === 'both').map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editing?.channel === 'whatsapp' && (
              <div>
                <Label>Instância WhatsApp</Label>
                <Select value={editing.whatsapp_instance_id ?? ''} onValueChange={v => setEditing({ ...editing, whatsapp_instance_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar instância" /></SelectTrigger>
                  <SelectContent>{instances.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {editing?.channel === 'email' && (
              <div>
                <Label>Assunto</Label>
                <Input value={editing.subject_override ?? ''} onChange={e => setEditing({ ...editing, subject_override: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Corpo da mensagem</Label>
              <Textarea rows={6} value={editing?.body_override ?? ''} onChange={e => setEditing({ ...editing!, body_override: e.target.value })} placeholder="Olá {{nome}}, ..." />
            </div>
            {editing?.channel === 'whatsapp' && (
              <div>
                <Label>URL de mídia (opcional, imagem)</Label>
                <Input value={editing.media_url ?? ''} onChange={e => setEditing({ ...editing, media_url: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Throttle (mensagens/min)</Label>
                <Input type="number" min={1} max={120} value={editing?.throttle_per_minute ?? 10}
                  onChange={e => setEditing({ ...editing!, throttle_per_minute: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Agendar (opcional)</Label>
                <Input type="datetime-local"
                  value={editing?.scheduled_at ? new Date(editing.scheduled_at).toISOString().slice(0,16) : ''}
                  onChange={e => setEditing({ ...editing!, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button variant="outline" onClick={() => save(false)}>Salvar rascunho</Button>
            <Button onClick={() => save(true)}><Send className="w-4 h-4 mr-1" />Salvar e enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
