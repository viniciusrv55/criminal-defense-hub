import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

type Template = {
  id: string; name: string; channel: 'whatsapp' | 'email' | 'both';
  category: string | null; subject: string | null; body: string;
  media_url: string | null; active: boolean;
};

const empty: Partial<Template> = { name: '', channel: 'whatsapp', body: '', active: true };

export default function CampaignTemplates() {
  const [items, setItems] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Partial<Template> | null>(null);

  const load = async () => {
    const { data } = await supabase.from('message_templates').select('*').order('created_at', { ascending: false });
    setItems((data ?? []) as Template[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name || !editing.body) return toast.error('Nome e corpo obrigatórios');
    const payload = { ...editing };
    delete (payload as { id?: string }).id;
    const op = editing.id
      ? supabase.from('message_templates').update(payload).eq('id', editing.id)
      : supabase.from('message_templates').insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success('Modelo salvo'); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este modelo?')) return;
    const { error } = await supabase.from('message_templates').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif">Modelos de Mensagem</h1>
          <p className="text-sm text-muted-foreground">Textos reutilizáveis para campanhas. Use variáveis como <code>{'{{nome}}'}</code>.</p>
        </div>
        <Button onClick={() => setEditing(empty)}><Plus className="w-4 h-4 mr-2" />Novo modelo</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(t => (
          <div key={t.id} className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">{t.channel}{t.category ? ` · ${t.category}` : ''}</div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            {t.subject && <div className="text-xs"><b>Assunto:</b> {t.subject}</div>}
            <div className="text-sm whitespace-pre-wrap line-clamp-5 text-muted-foreground">{t.body}</div>
          </div>
        ))}
        {items.length === 0 && <div className="text-muted-foreground text-sm">Nenhum modelo cadastrado.</div>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar' : 'Novo'} modelo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing?.name ?? ''} onChange={e => setEditing({ ...editing!, name: e.target.value })} />
              </div>
              <div>
                <Label>Canal</Label>
                <Select value={editing?.channel ?? 'whatsapp'} onValueChange={(v) => setEditing({ ...editing!, channel: v as Template['channel'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="both">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Categoria (opcional)</Label>
              <Input value={editing?.category ?? ''} onChange={e => setEditing({ ...editing!, category: e.target.value })} placeholder="ex: aniversário, follow-up" />
            </div>
            {(editing?.channel === 'email' || editing?.channel === 'both') && (
              <div>
                <Label>Assunto</Label>
                <Input value={editing?.subject ?? ''} onChange={e => setEditing({ ...editing!, subject: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Corpo da mensagem</Label>
              <Textarea rows={8} value={editing?.body ?? ''} onChange={e => setEditing({ ...editing!, body: e.target.value })} placeholder="Olá {{nome}}, ..." />
              <p className="text-xs text-muted-foreground mt-1">Variáveis: <code>{'{{nome}}'}</code>, mais o que você definir no público.</p>
            </div>
            {(editing?.channel === 'whatsapp' || editing?.channel === 'both') && (
              <div>
                <Label>URL de mídia (opcional)</Label>
                <Input value={editing?.media_url ?? ''} onChange={e => setEditing({ ...editing!, media_url: e.target.value })} placeholder="https://..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
