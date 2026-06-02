import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, RefreshCcw, FileText, Send, Download, History } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/supabase-helpers';
import { supabase } from '@/integrations/supabase/client';
import { CurrencyInput, formatBRL } from '@/components/admin/CurrencyInput';
import type { Client, Contract, FeesData, CustomInstallment } from '@/types/contracts';
import { applyVariables, type ReceiptContext } from '@/lib/document-variables';

type Status = 'paid' | 'partial' | 'overdue' | 'upcoming' | 'open';

interface InstallmentRow {
  key: string; // 'entry' | '1' | '2' ...
  label: string;
  amount: number;
  dueDate: string | null;
  paid: number; // soma de pagamentos
  status: Status;
}

interface PaymentRow {
  id: string;
  installment_key: string;
  amount: number;
  paid_at: string;
  payment_method: string | null;
  notes: string | null;
}

interface RenegRow {
  id: string;
  created_at: string;
  previous_fees: FeesData;
  new_fees: FeesData;
  total_paid_before: number;
  remaining_debt: number;
  reason: string | null;
}

interface ReceiptRow {
  id: string;
  created_at: string;
  installment_key: string | null;
  amount: number | null;
  file_url: string | null;
  file_name: string | null;
  sent_at: string | null;
  sent_via: string | null;
  sender_name: string | null;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5"><Label className="text-foreground text-xs">{label}</Label>{children}</div>
);

function statusBadge(s: Status) {
  const map: Record<Status, { bg: string; label: string }> = {
    paid: { bg: 'bg-green-500/15 text-green-700', label: 'Paga' },
    partial: { bg: 'bg-blue-500/15 text-blue-700', label: 'Parcial' },
    overdue: { bg: 'bg-destructive/15 text-destructive', label: 'Atrasada' },
    upcoming: { bg: 'bg-amber-500/15 text-amber-700', label: 'A vencer' },
    open: { bg: 'bg-muted text-muted-foreground', label: 'Em aberto' },
  };
  const v = map[s];
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${v.bg}`}>{v.label}</span>;
}

function computeRows(fees: FeesData, payments: PaymentRow[]): InstallmentRow[] {
  const rows: InstallmentRow[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const entryVal = parseFloat(fees.entry ?? '') || 0;
  if (entryVal > 0 || fees.entry_due_date) {
    rows.push({ key: 'entry', label: 'Entrada', amount: entryVal, dueDate: fees.entry_due_date ?? null, paid: 0, status: 'open' });
  }
  (fees.custom_installments ?? []).forEach((p, i) => {
    rows.push({
      key: String(i + 1),
      label: `${i + 1}ª parcela`,
      amount: parseFloat(p.value) || 0,
      dueDate: p.due_date ?? null,
      paid: 0,
      status: 'open',
    });
  });

  // Aplica pagamentos
  for (const r of rows) {
    r.paid = payments.filter(p => p.installment_key === r.key).reduce((s, p) => s + Number(p.amount), 0);
    if (r.paid >= r.amount && r.amount > 0) r.status = 'paid';
    else if (r.paid > 0) r.status = 'partial';
    else if (r.dueDate) {
      const d = new Date(r.dueDate); d.setHours(0, 0, 0, 0);
      r.status = d < today ? 'overdue' : 'upcoming';
    } else r.status = 'open';
  }
  return rows;
}

export const FinanceiroTab = ({
  contractId, contract, client, userId, senderName, paymentMethods,
}: {
  contractId?: string;
  contract: Contract | null;
  client: Client | null;
  userId?: string;
  senderName?: string;
  paymentMethods: { id: string; name: string }[];
}) => {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [renegs, setRenegs] = useState<RenegRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // dialogs
  const [payOpen, setPayOpen] = useState<InstallmentRow | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', paid_at: '', payment_method: '', notes: '' });
  const [paying, setPaying] = useState(false);

  const [renegOpen, setRenegOpen] = useState(false);
  const [renegForm, setRenegForm] = useState({ entry: '', count: '6', reason: '' });
  const [renegSaving, setRenegSaving] = useState(false);

  const [receiptOpen, setReceiptOpen] = useState<{ row: InstallmentRow; payment: PaymentRow } | null>(null);
  const [templates, setTemplates] = useState<{ id: string; title: string; content_html: string }[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [generatingReceipt, setGeneratingReceipt] = useState(false);
  const [sendingReceipt, setSendingReceipt] = useState<string | null>(null); // receipt id

  const reload = async () => {
    if (!contractId) { setLoading(false); return; }
    setLoading(true);
    const [pRes, rRes, recRes] = await Promise.all([
      db.from('installment_payments').select('*').eq('contract_id', contractId).order('paid_at'),
      db.from('installment_renegotiations').select('*').eq('contract_id', contractId).order('created_at', { ascending: false }),
      db.from('payment_receipts').select('*').eq('contract_id', contractId).order('created_at', { ascending: false }),
    ]);
    setPayments((pRes.data ?? []) as PaymentRow[]);
    setRenegs((rRes.data ?? []) as RenegRow[]);
    setReceipts((recRes.data ?? []) as ReceiptRow[]);
    setLoading(false);
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [contractId]);

  // Carrega modelos do tipo "Recibo"
  useEffect(() => {
    void (async () => {
      const { data: types } = await db.from('document_template_types').select('id, name').eq('name', 'Recibo');
      const typeId = types?.[0]?.id;
      if (!typeId) { setTemplates([]); return; }
      const { data } = await db.from('document_templates').select('id, title, content_html').eq('type_id', typeId).eq('active', true);
      setTemplates((data ?? []) as { id: string; title: string; content_html: string }[]);
      if (data?.[0]) setTemplateId((data[0] as { id: string }).id);
    })();
  }, []);

  const fees = contract?.fees ?? {};
  const rows = useMemo(() => computeRows(fees, payments), [fees, payments]);

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const paid = rows.reduce((s, r) => s + r.paid, 0);
    return { total, paid, remaining: Math.max(0, total - paid) };
  }, [rows]);

  /* ============ DAR BAIXA ============ */
  const openPay = (row: InstallmentRow) => {
    const today = new Date().toISOString().slice(0, 10);
    const remaining = Math.max(0, row.amount - row.paid);
    setPayForm({
      amount: remaining.toFixed(2),
      paid_at: today,
      payment_method: fees.payment_method ?? '',
      notes: '',
    });
    setPayOpen(row);
  };

  const handlePay = async () => {
    if (!payOpen || !contractId) return;
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) { toast({ title: 'Informe um valor válido', variant: 'destructive' }); return; }
    setPaying(true);
    const { error } = await db.from('installment_payments').insert({
      contract_id: contractId,
      installment_key: payOpen.key,
      amount,
      paid_at: new Date(payForm.paid_at).toISOString(),
      payment_method: payForm.payment_method || null,
      notes: payForm.notes || null,
      created_by: userId,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setPaying(false); return; }
    await db.from('contract_history').insert({
      contract_id: contractId, action: 'payment',
      description: `Baixa de ${formatBRL(amount)} (${payOpen.label})`,
      performed_by: userId,
    });
    setPaying(false);
    setPayOpen(null);
    toast({ title: 'Baixa registrada' });
    void reload();
  };

  /* ============ RENEGOCIAR ============ */
  const openReneg = () => {
    const overdueOrUpcoming = rows.filter(r => r.status === 'overdue' || r.status === 'upcoming' || r.status === 'partial' || r.status === 'open');
    const remaining = overdueOrUpcoming.reduce((s, r) => s + (r.amount - r.paid), 0);
    setRenegForm({
      entry: (remaining * 0.2).toFixed(2),
      count: '6',
      reason: `Renegociação de ${formatBRL(remaining)} em parcelas em aberto`,
    });
    setRenegOpen(true);
  };

  const handleReneg = async () => {
    if (!contractId || !contract) return;
    const overdueOrUpcoming = rows.filter(r => r.status === 'overdue' || r.status === 'upcoming' || r.status === 'partial' || r.status === 'open');
    if (overdueOrUpcoming.length === 0) {
      toast({ title: 'Nenhuma parcela em aberto para renegociar', variant: 'destructive' });
      return;
    }
    const remainingDebt = overdueOrUpcoming.reduce((s, r) => s + (r.amount - r.paid), 0);
    const newEntry = parseFloat(renegForm.entry) || 0;
    const count = parseInt(renegForm.count, 10);
    if (!count || count <= 0) { toast({ title: 'Número de parcelas inválido', variant: 'destructive' }); return; }
    const newBalance = Math.max(0, +(remainingDebt - newEntry).toFixed(2));
    const base = Math.floor((newBalance * 100) / count) / 100;
    const newInstallments: CustomInstallment[] = Array.from({ length: count }, () => ({ value: base.toFixed(2), due_date: '' }));
    const used = +(base * count).toFixed(2);
    const leftover = +(newBalance - used).toFixed(2);
    if (leftover > 0) {
      const last = newInstallments[newInstallments.length - 1];
      last.value = (parseFloat(last.value) + leftover).toFixed(2);
    }

    const totalPaidBefore = payments.reduce((s, p) => s + Number(p.amount), 0);
    const previousFees = fees;

    // Constrói novos honorários: mantém os pagos + entrada nova + parcelas novas
    const paidRows = rows.filter(r => r.status === 'paid' || r.status === 'partial');
    const newCustoms: CustomInstallment[] = [
      // mantém parcelas já pagas (exceto entry)
      ...paidRows.filter(r => r.key !== 'entry').map(r => ({ value: r.paid.toFixed(2), due_date: '' })),
      ...newInstallments,
    ];
    const newFees: FeesData = {
      ...previousFees,
      entry: newEntry.toFixed(2),
      entry_due_date: new Date().toISOString().slice(0, 10),
      installments: `${count}x`,
      custom_installments: newCustoms,
      notes: `${previousFees.notes ?? ''}\nRenegociado em ${new Date().toLocaleDateString('pt-BR')}: ${renegForm.reason}`.trim(),
    };

    setRenegSaving(true);
    const { error: ue } = await db.from('contracts').update({ fees: newFees }).eq('id', contractId);
    if (ue) { toast({ title: 'Erro', description: ue.message, variant: 'destructive' }); setRenegSaving(false); return; }
    await db.from('installment_renegotiations').insert({
      contract_id: contractId,
      previous_fees: previousFees,
      new_fees: newFees,
      total_paid_before: totalPaidBefore,
      remaining_debt: remainingDebt,
      reason: renegForm.reason || null,
      created_by: userId,
    });
    await db.from('contract_history').insert({
      contract_id: contractId, action: 'renegotiation',
      description: `Renegociação: dívida ${formatBRL(remainingDebt)} → entrada ${formatBRL(newEntry)} + ${count}x ${formatBRL(base)}`,
      performed_by: userId,
    });
    setRenegSaving(false);
    setRenegOpen(false);
    toast({ title: 'Renegociação registrada. Recarregue para ver as novas parcelas.' });
    // Não temos como atualizar o contract pai daqui; força reload da página
    setTimeout(() => window.location.reload(), 600);
  };

  /* ============ RECIBO ============ */
  const openReceipt = (row: InstallmentRow) => {
    const lastPayment = [...payments].reverse().find(p => p.installment_key === row.key);
    if (!lastPayment) { toast({ title: 'Esta parcela ainda não tem pagamento', variant: 'destructive' }); return; }
    if (!templates.length) {
      toast({ title: 'Cadastre um modelo do tipo "Recibo"', description: 'Vá em Gerador de Documentos e crie um modelo com tipo Recibo.', variant: 'destructive' });
      return;
    }
    setReceiptOpen({ row, payment: lastPayment });
  };

  const generateReceipt = async (): Promise<ReceiptRow | null> => {
    if (!receiptOpen || !contractId || !client || !contract) return null;
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) { toast({ title: 'Selecione um modelo', variant: 'destructive' }); return null; }
    setGeneratingReceipt(true);
    try {
      const receiptCtx: ReceiptContext = {
        installment_label: receiptOpen.row.label,
        amount: receiptOpen.payment.amount,
        paid_at: receiptOpen.payment.paid_at,
        payment_method: receiptOpen.payment.payment_method ?? undefined,
        sender_name: senderName,
        receipt_date: new Date().toISOString(),
      };
      const filledHtml = applyVariables(tpl.content_html, { client, contract, receipt: receiptCtx });

      // Renderiza num container off-screen para o html2canvas capturar
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;padding:48px;background:#fff;color:#000;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;';
      wrapper.innerHTML = filledHtml;
      document.body.appendChild(wrapper);

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(wrapper, { scale: 2, backgroundColor: '#ffffff' });
      document.body.removeChild(wrapper);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const pdfBlob = pdf.output('blob');

      const safe = `recibo-${receiptOpen.row.label.replace(/\s+/g, '_').toLowerCase()}-${Date.now()}.pdf`;
      const path = `${contractId}/${safe}`;
      const { error: upErr } = await supabase.storage.from('contracts').upload(path, pdfBlob, { contentType: 'application/pdf' });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(path, 60 * 60 * 24 * 365);

      const { data: rec, error } = await db.from('payment_receipts').insert({
        contract_id: contractId,
        payment_id: receiptOpen.payment.id,
        template_id: tpl.id,
        installment_key: receiptOpen.row.key,
        amount: receiptOpen.payment.amount,
        file_url: signed?.signedUrl,
        file_name: safe,
        sender_user_id: userId,
        sender_name: senderName,
        created_by: userId,
      }).select().single();
      if (error) throw error;

      toast({ title: 'Recibo gerado!' });
      void reload();
      return rec as ReceiptRow;
    } catch (e) {
      toast({ title: 'Erro ao gerar recibo', description: (e as Error).message, variant: 'destructive' });
      return null;
    } finally {
      setGeneratingReceipt(false);
    }
  };

  const openReceiptFile = async (receipt: ReceiptRow) => {
    if (!receipt.file_name) { toast({ title: 'Recibo sem arquivo', variant: 'destructive' }); return; }
    try {
      const path = `${contractId}/${receipt.file_name}`;
      const { data, error } = await supabase.storage
        .from('contracts')
        .createSignedUrl(path, 60 * 5, { download: receipt.file_name });
      if (error || !data?.signedUrl) throw error ?? new Error('URL não gerada');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast({ title: 'Erro ao baixar recibo', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const sendReceiptWhatsApp = async (receipt: ReceiptRow) => {
    if (!client) return;
    const phone = client.phones?.[0]?.value;
    if (!phone) { toast({ title: 'Cliente sem telefone', variant: 'destructive' }); return; }
    if (!receipt.file_url) { toast({ title: 'Recibo sem arquivo', variant: 'destructive' }); return; }
    setSendingReceipt(receipt.id);
    try {
      // 1. abre/encontra conversa
      const { data: open, error: oe } = await supabase.functions.invoke('whatsapp-open-conversation', {
        body: { phone, name: client.full_name, client_id: client.id },
      });
      if (oe || !open?.ok) throw new Error(oe?.message ?? open?.error ?? 'Falha ao abrir conversa');
      const conversationId = open.conversation_id as string;
      // 2. envia o PDF como documento, com legenda em negrito do emissor
      const caption = senderName
        ? `*${senderName}:*\nRecibo de pagamento — ${receipt.file_name}`
        : `Recibo de pagamento — ${receipt.file_name}`;
      const { data: send, error: se } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          conversation_id: conversationId,
          message_type: 'document',
          media_url: receipt.file_url,
          media_mime: 'application/pdf',
          content: caption,
        },
      });
      if (se || !send?.ok) throw new Error(se?.message ?? send?.error ?? 'Falha ao enviar');
      await db.from('payment_receipts').update({
        sent_at: new Date().toISOString(),
        sent_via: 'whatsapp',
      }).eq('id', receipt.id);
      toast({ title: 'Recibo enviado pelo WhatsApp' });
      void reload();
    } catch (e) {
      toast({ title: 'Erro ao enviar', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSendingReceipt(null);
    }
  };

  if (!contractId) return <p className="text-sm text-muted-foreground">Salve o contrato antes de gerenciar honorários.</p>;
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-medium text-foreground">Financeiro do contrato</h3>
          <p className="text-xs text-muted-foreground">
            Total: <strong>{formatBRL(totals.total)}</strong> · Pago: <strong className="text-green-700">{formatBRL(totals.paid)}</strong> · Saldo: <strong className="text-accent">{formatBRL(totals.remaining)}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(s => !s)}>
            <History className="w-4 h-4 mr-2" />{showHistory ? 'Ocultar histórico' : 'Histórico'}
          </Button>
          <Button variant="outline" size="sm" onClick={openReneg}>
            <RefreshCcw className="w-4 h-4 mr-2" />Renegociar
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Configure os honorários na aba "Honorários".</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const lastPayment = [...payments].reverse().find(p => p.installment_key === r.key);
            const receiptForKey = receipts.find(rec => rec.installment_key === r.key);
            return (
              <div key={r.key} className="p-3 rounded-lg border border-border bg-background flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{r.label}</p>
                    {statusBadge(r.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Valor: <strong className="text-foreground">{formatBRL(r.amount)}</strong>
                    {r.paid > 0 && <> · Pago: <strong className="text-green-700">{formatBRL(r.paid)}</strong></>}
                    {r.dueDate && <> · Venc.: {new Date(r.dueDate).toLocaleDateString('pt-BR')}</>}
                  </p>
                  {lastPayment && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Último pagamento em {new Date(lastPayment.paid_at).toLocaleDateString('pt-BR')}
                      {lastPayment.payment_method && ` · ${lastPayment.payment_method}`}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {r.status !== 'paid' && (
                    <Button size="sm" variant="outline" onClick={() => openPay(r)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" />Dar baixa
                    </Button>
                  )}
                  {(r.status === 'paid' || r.status === 'partial') && (
                    <Button size="sm" variant="outline" onClick={() => openReceipt(r)}>
                      <FileText className="w-4 h-4 mr-1" />Emitir recibo
                    </Button>
                  )}
                  {receiptForKey?.file_url && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openReceiptFile(receiptForKey)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={sendingReceipt === receiptForKey.id}
                        onClick={() => sendReceiptWhatsApp(receiptForKey)}
                      >
                        {sendingReceipt === receiptForKey.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Send className="w-4 h-4" />}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showHistory && (
        <div className="pt-4 border-t border-border space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Pagamentos</h4>
            {payments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem pagamentos registrados.</p>
            ) : (
              <div className="space-y-1">
                {payments.map(p => (
                  <div key={p.id} className="text-xs flex justify-between border-b border-border/50 py-1.5">
                    <span>{new Date(p.paid_at).toLocaleDateString('pt-BR')} — {p.installment_key === 'entry' ? 'Entrada' : `${p.installment_key}ª parcela`}</span>
                    <span className="font-medium">{formatBRL(Number(p.amount))}{p.payment_method && ` · ${p.payment_method}`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Renegociações</h4>
            {renegs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem renegociações.</p>
            ) : (
              <div className="space-y-1">
                {renegs.map(r => (
                  <div key={r.id} className="text-xs border-b border-border/50 py-1.5">
                    <p>{new Date(r.created_at).toLocaleString('pt-BR')} — pago antes: {formatBRL(Number(r.total_paid_before))} · saldo refinanciado: {formatBRL(Number(r.remaining_debt))}</p>
                    {r.reason && <p className="text-muted-foreground">{r.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Recibos emitidos</h4>
            {receipts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum recibo gerado.</p>
            ) : (
              <div className="space-y-1">
                {receipts.map(r => (
                  <div key={r.id} className="text-xs flex justify-between border-b border-border/50 py-1.5 gap-2">
                    <span className="truncate">{new Date(r.created_at).toLocaleDateString('pt-BR')} — {r.file_name} {r.sent_at && `· enviado em ${new Date(r.sent_at).toLocaleDateString('pt-BR')}`}</span>
                    {r.file_url && <a href={r.file_url} target="_blank" rel="noreferrer" className="text-accent underline">baixar</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DIALOG: dar baixa */}
      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPayOpen(null)} />
          <div className="relative w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-3">
            <h3 className="font-serif text-lg">Dar baixa — {payOpen.label}</h3>
            <p className="text-xs text-muted-foreground">Valor da parcela: {formatBRL(payOpen.amount)} · já pago: {formatBRL(payOpen.paid)}</p>
            <Field label="Valor pago"><CurrencyInput value={payForm.amount} onChange={v => setPayForm({ ...payForm, amount: v })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data"><Input type="date" value={payForm.paid_at} onChange={e => setPayForm({ ...payForm, paid_at: e.target.value })} /></Field>
              <Field label="Forma">
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}>
                  <option value="">—</option>
                  {paymentMethods.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Observações"><Textarea rows={2} value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPayOpen(null)}>Cancelar</Button>
              <Button onClick={handlePay} disabled={paying} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {paying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG: renegociar */}
      {renegOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRenegOpen(false)} />
          <div className="relative w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-3">
            <h3 className="font-serif text-lg">Renegociar saldo em aberto</h3>
            <p className="text-xs text-muted-foreground">
              Saldo em aberto: <strong>{formatBRL(totals.remaining)}</strong>. As parcelas pagas viram histórico e abatem a dívida.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nova entrada"><CurrencyInput value={renegForm.entry} onChange={v => setRenegForm({ ...renegForm, entry: v })} /></Field>
              <Field label="Nº de parcelas">
                <Input type="number" min={1} max={60} value={renegForm.count} onChange={e => setRenegForm({ ...renegForm, count: e.target.value })} />
              </Field>
            </div>
            <Field label="Motivo / observações"><Textarea rows={3} value={renegForm.reason} onChange={e => setRenegForm({ ...renegForm, reason: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRenegOpen(false)}>Cancelar</Button>
              <Button onClick={handleReneg} disabled={renegSaving} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {renegSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCcw className="w-4 h-4 mr-2" />}Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG: emitir recibo */}
      {receiptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setReceiptOpen(null)} />
          <div className="relative w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-3">
            <h3 className="font-serif text-lg">Emitir recibo — {receiptOpen.row.label}</h3>
            <p className="text-xs text-muted-foreground">
              Valor: <strong>{formatBRL(receiptOpen.payment.amount)}</strong> em {new Date(receiptOpen.payment.paid_at).toLocaleDateString('pt-BR')}.
              Emissor: <strong>{senderName || '—'}</strong>
            </p>
            <Field label="Modelo de recibo">
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={templateId} onChange={e => setTemplateId(e.target.value)}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReceiptOpen(null)}>Cancelar</Button>
              <Button
                onClick={async () => {
                  const rec = await generateReceipt();
                  if (rec) setReceiptOpen(null);
                }}
                disabled={generatingReceipt}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {generatingReceipt ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}Gerar PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
