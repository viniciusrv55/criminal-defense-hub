import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Smartphone, Plus, RefreshCw, QrCode, Trash2, LogOut, Loader2, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Instance {
  id: string;
  name: string;
  instance_name: string;
  phone_number: string | null;
  team_member_id: string | null;
  status: string;
  qr_code: string | null;
  last_connected_at: string | null;
}
interface Member { id: string; full_name: string; }

const WEBHOOK_URL =
  'https://fskstajvuoviicfjfcai.supabase.co/functions/v1/evolution-webhook';

export default function WhatsAppInstances() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMember, setNewMember] = useState<string>('none');

  // QR dialog
  const [qrOpen, setQrOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrInstance, setQrInstance] = useState<string | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: ins }, { data: mem }] = await Promise.all([
      supabase.from('whatsapp_instances').select('*').order('created_at', { ascending: false }),
      supabase.from('team_members').select('id, full_name').eq('active', true).order('full_name'),
    ]);
    setInstances((ins ?? []) as Instance[]);
    setMembers((mem ?? []) as Member[]);
    setLoading(false);
  }

  async function callEvolution<T = unknown>(action: string, instanceName?: string, payload?: unknown) {
    const { data, error } = await supabase.functions.invoke('evolution-api', {
      body: { action, instanceName, payload },
    });
    if (error) throw new Error(error.message);
    const res = data as { ok: boolean; status: number; data: T; error?: string };
    if (!res.ok) throw new Error(res.error ?? `HTTP ${res.status}`);
    return res.data;
  }

  async function configureWebhook(instanceName: string) {
    const events = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE', 'CONNECTION_UPDATE'];
    try {
      await callEvolution('setWebhook', instanceName, {
        webhook: { enabled: true, url: WEBHOOK_URL, byEvents: false, base64: false, events },
      });
    } catch {
      await callEvolution('setWebhook', instanceName, {
        enabled: true,
        url: WEBHOOK_URL,
        webhook_by_events: false,
        base64: false,
        events,
      });
    }
  }

  async function createInstance() {
    if (!newName.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const slug = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const instanceName = `lm-${slug}-${Date.now().toString(36)}`;

      // 1) Create on Evolution
      await callEvolution('createInstance', undefined, {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });

      // 2) Set webhook
      try { await configureWebhook(instanceName); } catch { /* segue mesmo se o servidor Evolution recusar o webhook */ }

      // 3) Save in DB
      const { error } = await supabase.from('whatsapp_instances').insert({
        name: newName.trim(),
        instance_name: instanceName,
        team_member_id: newMember === 'none' ? null : newMember,
        status: 'connecting',
      });
      if (error) throw error;

      toast({ title: 'Instância criada', description: 'Agora gere o QR Code para conectar.' });
      setCreateOpen(false);
      setNewName('');
      setNewMember('none');
      await load();
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  async function showQr(inst: Instance) {
    setBusy(inst.id);
    try {
      const data = await callEvolution<{ base64?: string; code?: string; qrcode?: { base64?: string; code?: string } }>('connect', inst.instance_name);
      const base64 = data?.base64 ?? data?.qrcode?.base64 ?? null;
      const code = data?.code ?? data?.qrcode?.code ?? null;
      const qr = base64
        ? (base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64.replace(/^data:[^,]+,/, '')}`)
        : code;
      if (!qr) throw new Error('QR não retornado pela Evolution.');
      setQrCode(qr);
      setQrInstance(inst.instance_name);
      setQrOpen(true);
      await supabase.from('whatsapp_instances').update({ status: 'qr', qr_code: qr }).eq('id', inst.id);
      await load();
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  async function refreshState(inst: Instance) {
    setBusy(inst.id);
    try {
      await configureWebhook(inst.instance_name);
      const data = await callEvolution<{ instance?: { state?: string }; state?: string }>('connectionState', inst.instance_name);
      const state = data?.instance?.state ?? data?.state ?? 'disconnected';
      const status =
        state === 'open' ? 'connected'
          : state === 'connecting' ? 'connecting'
          : 'disconnected';
      await supabase.from('whatsapp_instances').update({
        status,
        last_connected_at: status === 'connected' ? new Date().toISOString() : inst.last_connected_at,
      }).eq('id', inst.id);
      toast({ title: 'Status e sincronização atualizados', description: `Estado: ${state}` });
      await load();
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  async function logout(inst: Instance) {
    setBusy(inst.id);
    try {
      await callEvolution('logout', inst.instance_name);
      await supabase.from('whatsapp_instances').update({ status: 'disconnected', qr_code: null }).eq('id', inst.id);
      toast({ title: 'Desconectado' });
      await load();
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  async function deleteInstance(id: string) {
    const inst = instances.find((i) => i.id === id);
    if (!inst) return;
    setBusy(id);
    try {
      try { await callEvolution('deleteInstance', inst.instance_name); } catch { /* segue mesmo se Evolution já não tiver */ }
      await supabase.from('whatsapp_instances').delete().eq('id', id);
      toast({ title: 'Instância removida' });
      setDeleteId(null);
      await load();
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <Smartphone className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h1 className="font-serif text-3xl tracking-tight">WhatsApp</h1>
              <p className="text-sm text-neutral-600 mt-1">
                Conecte os números de WhatsApp do escritório via Evolution API.
              </p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-black hover:bg-neutral-800">
            <Plus className="w-4 h-4 mr-2" /> Conectar novo número
          </Button>
        </header>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          </div>
        ) : instances.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-neutral-300 rounded-lg">
            <Smartphone className="w-10 h-10 mx-auto text-neutral-400 mb-3" />
            <p className="text-neutral-600">Nenhum número conectado ainda.</p>
            <p className="text-xs text-neutral-500 mt-1">Confira se a Evolution API está configurada em <strong>/admin/plataforma</strong>.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {instances.map((inst) => {
              const memberName = members.find((m) => m.id === inst.team_member_id)?.full_name ?? 'Geral (sem dono)';
              return (
                <div key={inst.id} className="p-4 bg-white border border-neutral-200 rounded-lg flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-neutral-900">{inst.name}</h3>
                      <StatusBadge status={inst.status} />
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 font-mono">{inst.instance_name}</p>
                    <p className="text-xs text-neutral-600 mt-1">
                      Dono: <strong>{memberName}</strong>
                      {inst.phone_number && <> · {inst.phone_number}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" disabled={busy === inst.id} onClick={() => showQr(inst)}>
                      <QrCode className="w-4 h-4 mr-1" /> QR
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === inst.id} onClick={() => refreshState(inst)}>
                      <RefreshCw className="w-4 h-4 mr-1" /> Status
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === inst.id} onClick={() => logout(inst)}>
                      <LogOut className="w-4 h-4 mr-1" /> Sair
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === inst.id} onClick={() => setDeleteId(inst.id)} className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar novo número</DialogTitle>
            <DialogDescription>
              Cria uma instância na Evolution API. Após criar, gere o QR Code para escanear no WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome (interno)</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Atendimento Cível" />
            </div>
            <div className="space-y-2">
              <Label>Dono (opcional)</Label>
              <Select value={newMember} onValueChange={setNewMember}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geral (sem dono)</SelectItem>
                  {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={createInstance} disabled={creating} className="bg-black hover:bg-neutral-800">
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {qrCode?.startsWith('data:') || qrCode?.startsWith('http') ? (
              <img src={qrCode} alt="QR Code" className="w-64 h-64 object-contain border border-neutral-200 rounded" />
            ) : qrCode ? (
              <pre className="text-[6px] leading-[6px] font-mono">{qrCode}</pre>
            ) : (
              <Loader2 className="w-6 h-6 animate-spin" />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                if (qrInstance) {
                  const inst = instances.find((i) => i.instance_name === qrInstance);
                  if (inst) await refreshState(inst);
                }
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Já escaneei, atualizar status
            </Button>
            <Button onClick={() => setQrOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover instância?</AlertDialogTitle>
            <AlertDialogDescription>
              A instância também será removida da Evolution API. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteInstance(deleteId)} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    connected: { label: 'Conectado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
    connecting: { label: 'Conectando', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
    qr: { label: 'Aguardando QR', cls: 'bg-blue-50 text-blue-700 border-blue-200', Icon: QrCode },
    disconnected: { label: 'Desconectado', cls: 'bg-neutral-100 text-neutral-600 border-neutral-200', Icon: XCircle },
  };
  const m = map[status] ?? map.disconnected;
  const { Icon } = m;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border ${m.cls}`}>
      <Icon className="w-3 h-3" /> {m.label}
    </span>
  );
}
