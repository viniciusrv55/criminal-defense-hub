import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/lib/supabase-helpers';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import type { Contract, Client, FeesData } from '@/types/contracts';
import { useAuth } from '@/hooks/useAuth';

interface Payment {
  id: string;
  contract_id: string;
  installment_key: string;
  amount: number;
  paid_at: string;
  payment_method: string | null;
}

interface Row {
  key: string;
  label: string;
  amount: number;
  dueDate: string | null;
  paid: number;
  remaining: number;
  status: 'paid' | 'partial' | 'overdue' | 'upcoming' | 'open';
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

function computeRows(fees: FeesData, payments: Payment[]): Row[] {
  const rows: Row[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const entryVal = parseFloat(fees.entry ?? '') || 0;
  if (entryVal > 0 || fees.entry_due_date) {
    rows.push({ key: 'entry', label: 'Entrada', amount: entryVal, dueDate: fees.entry_due_date ?? null, paid: 0, remaining: 0, status: 'open' });
  }
  (fees.custom_installments ?? []).forEach((p, i) => {
    rows.push({
      key: String(i + 1),
      label: `${i + 1}ª parcela`,
      amount: parseFloat(p.value) || 0,
      dueDate: p.due_date ?? null,
      paid: 0,
      remaining: 0,
      status: 'open',
    });
  });
  for (const r of rows) {
    r.paid = payments.filter(p => p.installment_key === r.key).reduce((s, p) => s + Number(p.amount), 0);
    r.remaining = Math.max(r.amount - r.paid, 0);
    if (r.paid >= r.amount && r.amount > 0) r.status = 'paid';
    else if (r.paid > 0) r.status = 'partial';
    else if (r.dueDate) {
      const d = new Date(r.dueDate); d.setHours(0, 0, 0, 0);
      r.status = d < today ? 'overdue' : 'upcoming';
    } else r.status = 'open';
  }
  return rows;
}

interface OverdueClient {
  clientId: string;
  clientName: string;
  contractId: string;
  contractNumber: string | null;
  totalOverdue: number;
  totalPending: number;
  unscheduledBalance: number;
  hasOverdue: boolean;
  overdueRows: Row[];
  pendingRows: Row[];
}

interface WeekPayment {
  id: string;
  clientName: string;
  contractId: string;
  contractNumber: string | null;
  amount: number;
  paidAt: string;
  installmentLabel: string;
  remainingRows: Row[];
  nextDue: Row | null;
}

const FinancialWidgets = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [overdue, setOverdue] = useState<OverdueClient[]>([]);
  const [weekPays, setWeekPays] = useState<WeekPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openOverdue, setOpenOverdue] = useState<string | null>(null);
  const [openPay, setOpenPay] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const admin = isAdmin();
      const { data: mem } = await db.from('team_members').select('id').eq('user_id', user?.id).eq('active', true).maybeSingle();
      const meTeamId = mem?.id ?? null;
      const [{ data: cs }, { data: cls }, { data: ps }] = await Promise.all([
        db.from('contracts').select('*').neq('status', 'cancelled'),
        db.from('clients').select('id,full_name'),
        db.from('installment_payments').select('*'),
      ]);
      const allContracts = (cs ?? []) as Contract[];
      const contracts = admin ? allContracts : allContracts.filter(c => c.attorney_id === meTeamId);
      const clients = (cls ?? []) as Pick<Client, 'id' | 'full_name'>[];
      const payments = (ps ?? []) as Payment[];
      const clientMap = new Map(clients.map(c => [c.id, c.full_name]));

      // Pendências por contrato (atraso + saldo a pagar)
      const od: OverdueClient[] = [];
      for (const c of contracts) {
        const cps = payments.filter(p => p.contract_id === c.id);
        const rows = computeRows(c.fees ?? {}, cps);
        const overdueRows = rows.filter(r => r.status === 'overdue' || (r.status === 'partial' && r.dueDate && new Date(r.dueDate) < new Date()));
        const pendingRows = rows.filter(r => r.status !== 'paid');

        const totalPaid = cps.reduce((s, p) => s + Number(p.amount), 0);
        const totalValue = parseFloat(String(c.fees?.total_value ?? '').replace(',', '.')) || 0;
        const scheduledTotal = rows.reduce((s, r) => s + r.amount, 0);
        const referenceTotal = Math.max(totalValue, scheduledTotal);
        const totalPending = Math.max(0, +(referenceTotal - totalPaid).toFixed(2));
        const unscheduledBalance = Math.max(0, +(referenceTotal - scheduledTotal).toFixed(2));

        if (overdueRows.length > 0 || totalPending > 0) {
          od.push({
            clientId: c.client_id,
            clientName: clientMap.get(c.client_id) ?? '—',
            contractId: c.id,
            contractNumber: c.contract_number,
            totalOverdue: overdueRows.reduce((s, r) => s + r.remaining, 0),
            totalPending,
            unscheduledBalance,
            hasOverdue: overdueRows.length > 0,
            overdueRows,
            pendingRows,
          });
        }
      }
      od.sort((a, b) => Number(b.hasOverdue) - Number(a.hasOverdue) || b.totalOverdue - a.totalOverdue || b.totalPending - a.totalPending);
      setOverdue(od);

      // Week payments
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const wp: WeekPayment[] = [];
      for (const p of payments) {
        const d = new Date(p.paid_at);
        if (d < weekAgo || d > now) continue;
        const contract = contracts.find(c => c.id === p.contract_id);
        if (!contract) continue;
        const cps = payments.filter(x => x.contract_id === contract.id);
        const rows = computeRows(contract.fees ?? {}, cps);
        const remainingRows = rows.filter(r => r.status !== 'paid');
        const nextDue = remainingRows.filter(r => r.dueDate).sort((a, b) => (a.dueDate! > b.dueDate! ? 1 : -1))[0] ?? null;
        wp.push({
          id: p.id,
          clientName: clientMap.get(contract.client_id) ?? '—',
          contractId: contract.id,
          contractNumber: contract.contract_number,
          amount: Number(p.amount),
          paidAt: p.paid_at,
          installmentLabel: p.installment_key === 'entry' ? 'Entrada' : `${p.installment_key}ª parcela`,
          remainingRows,
          nextDue,
        });
      }
      wp.sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
      setWeekPays(wp);
      setLoading(false);
    })();
  }, []);

  const totalOverdue = useMemo(() => overdue.reduce((s, c) => s + c.totalOverdue, 0), [overdue]);
  const totalWeek = useMemo(() => weekPays.reduce((s, p) => s + p.amount, 0), [weekPays]);

  return (
    <div className="grid lg:grid-cols-2 gap-6 mt-6">
      {/* Overdue */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
            <div>
              <h3 className="font-serif font-semibold text-foreground">Clientes com pendências</h3>
              <p className="text-xs text-muted-foreground">{overdue.length} contrato(s) · atraso {fmt(totalOverdue)}</p>
            </div>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : overdue.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma pendência 🎉</div>
          ) : overdue.map(c => {
            const open = openOverdue === c.contractId;
            return (
              <div key={c.contractId}>
                <button
                  onClick={() => setOpenOverdue(open ? null : c.contractId)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{c.clientName}</p>
                      {c.hasOverdue && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">ATRASO</span>}
                      {!c.hasOverdue && c.totalPending > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 font-medium">SALDO</span>}
                      {c.unscheduledBalance > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-700 font-medium">RENEGOCIAR</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.contractNumber ? `Contrato ${c.contractNumber} · ` : ''}
                      {c.hasOverdue ? `${c.overdueRows.length} em atraso · ` : ''}
                      saldo {fmt(c.totalPending)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      {c.hasOverdue && <p className="text-sm font-semibold text-destructive">{fmt(c.totalOverdue)}</p>}
                      <p className={`text-[11px] ${c.hasOverdue ? 'text-muted-foreground' : 'text-amber-700 font-semibold'}`}>{fmt(c.totalPending)}</p>
                    </div>
                    {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {open && (
                  <div className="px-5 pb-4 bg-muted/20 space-y-1">
                    {c.unscheduledBalance > 0 && (
                      <p className="text-[11px] text-orange-700 pt-2 bg-orange-500/10 px-2 py-1 rounded">
                        ⚠ Saldo não parcelado de <strong>{fmt(c.unscheduledBalance)}</strong> — necessita renegociar ou agendar parcelas.
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pendências</p>
                      <Link
                        to={`/admin/contratos/${c.contractId}?tab=financeiro`}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        Abrir financeiro <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                    {c.pendingRows.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-1">Sem parcelas agendadas em aberto.</p>
                    ) : c.pendingRows.map(r => (
                      <button
                        type="button"
                        key={r.key}
                        onClick={() => navigate(`/admin/contratos/${c.contractId}?tab=financeiro`)}
                        className="w-full flex items-center justify-between text-xs py-1 hover:bg-muted/40 rounded px-1 text-left transition-colors"
                        title="Abrir financeiro para dar baixa"
                      >
                        <span className="text-foreground">{r.label} <span className="text-muted-foreground">· venc. {fmtDate(r.dueDate)}</span></span>
                        <span className={r.status === 'overdue' ? 'text-destructive font-medium' : 'text-muted-foreground'}>{fmt(r.remaining)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Week payments */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
            <div>
              <h3 className="font-serif font-semibold text-foreground">Pago na semana</h3>
              <p className="text-xs text-muted-foreground">{weekPays.length} pagamento(s) · {fmt(totalWeek)}</p>
            </div>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : weekPays.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sem pagamentos esta semana.</div>
          ) : weekPays.map(p => {
            const open = openPay === p.id;
            return (
              <div key={p.id}>
                <button
                  onClick={() => setOpenPay(open ? null : p.id)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.clientName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.installmentLabel} · {new Date(p.paidAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-green-600">{fmt(p.amount)}</span>
                    {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {open && (
                  <div className="px-5 pb-4 bg-muted/20 space-y-1">
                    {p.nextDue && (
                      <p className="text-[11px] text-foreground pt-2">
                        Próxima parcela: <span className="font-medium">{p.nextDue.label}</span> em {fmtDate(p.nextDue.dueDate)} · {fmt(p.nextDue.remaining)}
                      </p>
                    )}
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground pt-2">Ainda a pagar</p>
                    {p.remainingRows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Contrato quitado ✅</p>
                    ) : p.remainingRows.map(r => (
                      <div key={r.key} className="flex items-center justify-between text-xs py-1">
                        <span className="text-foreground">{r.label} <span className="text-muted-foreground">· venc. {fmtDate(r.dueDate)}</span></span>
                        <span className="text-muted-foreground">{fmt(r.remaining)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FinancialWidgets;
