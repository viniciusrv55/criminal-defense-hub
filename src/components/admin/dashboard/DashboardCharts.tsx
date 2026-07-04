import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/supabase-helpers';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { DollarSign, Users, TrendingUp } from 'lucide-react';

type Metric = 'revenue' | 'appointments';
type Period = 'day' | 'week' | 'month' | 'custom';

interface Member { id: string; full_name: string; user_id: string | null; }
interface Payment { id: string; contract_id: string; amount: number; paid_at: string; }
interface Contract { id: string; attorney_id: string | null; }
interface Appointment { id: string; attorney_id: string | null; starts_at: string; status: string; }

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function startOf(d: Date, kind: 'day' | 'week' | 'month') {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  if (kind === 'week') x.setDate(x.getDate() - x.getDay());
  if (kind === 'month') x.setDate(1);
  return x;
}

function addUnits(d: Date, kind: 'day' | 'week' | 'month', n: number) {
  const x = new Date(d);
  if (kind === 'day') x.setDate(x.getDate() + n);
  if (kind === 'week') x.setDate(x.getDate() + n * 7);
  if (kind === 'month') x.setMonth(x.getMonth() + n);
  return x;
}

function labelBucket(d: Date, kind: 'day' | 'week' | 'month') {
  if (kind === 'day') return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (kind === 'week') {
    const end = addUnits(d, 'day', 6);
    return `${d.getDate()}/${d.getMonth() + 1}–${end.getDate()}/${end.getMonth() + 1}`;
  }
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function bucketKey(d: Date, kind: 'day' | 'week' | 'month') {
  return startOf(d, kind).toISOString();
}

const DashboardCharts = () => {
  const { user, isAdmin } = useAuth();
  const [metric, setMetric] = useState<Metric>('revenue');
  const [period, setPeriod] = useState<Period>('month');
  const [attorney, setAttorney] = useState<string>('self');
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customGranularity, setCustomGranularity] = useState<'day' | 'week' | 'month'>('day');

  const [members, setMembers] = useState<Member[]>([]);
  const [meTeamId, setMeTeamId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const admin = isAdmin();

  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: ps }, { data: cs }, { data: ap }] = await Promise.all([
        db.from('team_members').select('id,full_name,user_id').eq('active', true).order('full_name'),
        db.from('installment_payments').select('id,contract_id,amount,paid_at'),
        db.from('contracts').select('id,attorney_id'),
        db.from('appointments').select('id,attorney_id,starts_at,status'),
      ]);
      const mem = (m ?? []) as Member[];
      setMembers(mem);
      const mine = mem.find(x => x.user_id === user?.id)?.id ?? null;
      setMeTeamId(mine);
      setPayments((ps ?? []) as Payment[]);
      setContracts((cs ?? []) as Contract[]);
      setAppts((ap ?? []) as Appointment[]);
      // default: non-admin locked to self; admin sees all
      setAttorney(admin ? 'all' : 'self');
      setLoading(false);
    })();
  }, [user?.id, admin]);

  const contractAttorneyMap = useMemo(() => new Map(contracts.map(c => [c.id, c.attorney_id])), [contracts]);

  const activeAttorneyId = useMemo(() => {
    if (!admin) return meTeamId; // forçado
    if (attorney === 'all') return null;
    if (attorney === 'self') return meTeamId;
    return attorney;
  }, [admin, attorney, meTeamId]);

  const { data, kind, rangeLabel } = useMemo(() => {
    const now = new Date();
    let from: Date; let to: Date; let k: 'day' | 'week' | 'month';
    if (period === 'day') {
      // Apenas o dia de hoje
      k = 'day'; from = startOf(now, 'day'); to = now;
    } else if (period === 'week') {
      // Últimos 7 dias corridos, agrupados por dia
      k = 'day'; to = now; from = startOf(addUnits(now, 'day', -6), 'day');
    } else if (period === 'month') {
      // Mês atual (do dia 1 até hoje), agrupado por dia
      k = 'day'; to = now; from = startOf(now, 'month');
    } else {
      k = customGranularity;
      from = new Date(customFrom + 'T00:00:00');
      to = new Date(customTo + 'T23:59:59');
    }
    const startBucket = startOf(from, k);
    const buckets: { key: string; date: Date; label: string; value: number }[] = [];
    let cursor = new Date(startBucket);
    while (cursor <= to) {
      buckets.push({ key: bucketKey(cursor, k), date: new Date(cursor), label: labelBucket(cursor, k), value: 0 });
      cursor = addUnits(cursor, k, 1);
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));

    if (metric === 'revenue') {
      for (const p of payments) {
        const d = new Date(p.paid_at);
        if (d < from || d > to) continue;
        if (activeAttorneyId && contractAttorneyMap.get(p.contract_id) !== activeAttorneyId) continue;
        const i = idx.get(bucketKey(d, k));
        if (i !== undefined) buckets[i].value += Number(p.amount);
      }
    } else {
      for (const a of appts) {
        if (a.status === 'cancelled') continue;
        const d = new Date(a.starts_at);
        if (d < from || d > to) continue;
        if (activeAttorneyId && a.attorney_id !== activeAttorneyId) continue;
        const i = idx.get(bucketKey(d, k));
        if (i !== undefined) buckets[i].value += 1;
      }
    }
    const rl = `${from.toLocaleDateString('pt-BR')} → ${to.toLocaleDateString('pt-BR')}`;
    return { data: buckets, kind: k, rangeLabel: rl };
  }, [metric, period, customFrom, customTo, customGranularity, payments, appts, activeAttorneyId, contractAttorneyMap]);

  const total = useMemo(() => data.reduce((s, b) => s + b.value, 0), [data]);
  const chartConfig = {
    value: { label: metric === 'revenue' ? 'Faturamento' : 'Atendimentos', color: 'hsl(var(--accent))' },
  };

  return (
    <div className="rounded-xl bg-card border border-border p-5 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={metric === 'revenue' ? 'default' : 'outline'}
            onClick={() => setMetric('revenue')}
            className="gap-2"
          >
            <DollarSign className="w-4 h-4" /> Faturamento
          </Button>
          <Button
            size="sm"
            variant={metric === 'appointments' ? 'default' : 'outline'}
            onClick={() => setMetric('appointments')}
            className="gap-2"
          >
            <Users className="w-4 h-4" /> Atendimentos
          </Button>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total no período</p>
          <p className="text-2xl font-bold text-foreground flex items-center gap-2 justify-end">
            <TrendingUp className="w-5 h-5 text-accent" />
            {metric === 'revenue' ? fmtBRL(total) : `${total} atend.`}
          </p>
          <p className="text-[10px] text-muted-foreground">{rangeLabel}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end mb-5">
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Agrupar por</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Hoje</SelectItem>
              <SelectItem value="week">Últimos 7 dias</SelectItem>
              <SelectItem value="month">Mês atual</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {period === 'custom' && (
          <>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">De</Label>
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-9 w-40" />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Até</Label>
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-9 w-40" />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Granularidade</Label>
              <Select value={customGranularity} onValueChange={(v) => setCustomGranularity(v as 'day' | 'week' | 'month')}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Diária</SelectItem>
                  <SelectItem value="week">Semanal</SelectItem>
                  <SelectItem value="month">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">
            {admin ? 'Advogado/Equipe' : 'Escopo'}
          </Label>
          <Select
            value={attorney}
            onValueChange={setAttorney}
            disabled={!admin}
          >
            <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {admin && <SelectItem value="all">Toda a equipe</SelectItem>}
              <SelectItem value="self">Somente eu</SelectItem>
              {admin && members.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="h-[280px] w-full">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => metric === 'revenue' ? (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)) : String(v)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(val) => metric === 'revenue' ? fmtBRL(Number(val)) : `${val} atend.`}
                    />
                  }
                />
                <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </div>
    </div>
  );
};

export default DashboardCharts;
