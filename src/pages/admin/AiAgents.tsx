import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Plus, Save, Trash2, Send, Loader2, FlaskConical, BookOpen, Wrench, MessageCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/supabase-helpers';

interface Queue { id: string; name: string; team_member_id: string | null; }
interface Agent {
  id: string;
  queue_id: string;
  name: string;
  active: boolean;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  greeting_message: string | null;
  handoff_keywords: string[];
  handoff_after_messages: number | null;
  business_hours: { enabled?: boolean; tz?: string; days?: Record<string, { start: string; end: string }> } | null;
  tools_enabled: string[];
  scheduling_attorney_id?: string | null;
}
interface TeamMember { id: string; full_name: string; }
interface Knowledge { id: string; agent_id: string; title: string; content: string; sort_order: number; active: boolean; }
interface Run { id: string; agent_id: string; status: string; model: string; prompt_tokens: number | null; completion_tokens: number | null; latency_ms: number | null; tool_calls: unknown; error: string | null; created_at: string; }

const AVAILABLE_TOOLS = [
  { id: 'get_practice_areas', label: 'Listar áreas de atuação', desc: 'Permite ao agente consultar as áreas ativas do site.' },
  { id: 'create_lead', label: 'Criar lead', desc: 'Permite registrar um novo lead no CRM.' },
  { id: 'request_human_handoff', label: 'Transferir para humano', desc: 'Pausa a IA, cria lead na coluna Novo e transfere para a fila Geral, com resumo da conversa.' },
  { id: 'list_appointment_types', label: 'Listar tipos de consulta', desc: 'Retorna os tipos de compromisso cadastrados.' },
  { id: 'get_available_slots', label: 'Consultar horários livres', desc: 'Permite à IA pesquisar horários disponíveis para agendar consultas.' },
  { id: 'create_appointment', label: 'Agendar consulta', desc: 'Permite à IA marcar consulta. Pode ser com advogado específico via configuração.' },
];

const MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];
const WEEK = [
  { id: 'mon', label: 'Seg' }, { id: 'tue', label: 'Ter' }, { id: 'wed', label: 'Qua' },
  { id: 'thu', label: 'Qui' }, { id: 'fri', label: 'Sex' }, { id: 'sat', label: 'Sáb' }, { id: 'sun', label: 'Dom' },
];

export default function AiAgents() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // playground
  const [playInput, setPlayInput] = useState('');
  const [playMessages, setPlayMessages] = useState<{ role: string; content: string }[]>([]);
  const [playLoading, setPlayLoading] = useState(false);
  const [playLastMeta, setPlayLastMeta] = useState<{ tokens?: { prompt_tokens: number; completion_tokens: number }; tool_calls?: unknown[] } | null>(null);

  const activeAgent = useMemo(() => agents.find((a) => a.id === activeAgentId) ?? null, [agents, activeAgentId]);
  const activeKnowledge = useMemo(() => knowledge.filter((k) => k.agent_id === activeAgentId).sort((a, b) => a.sort_order - b.sort_order), [knowledge, activeAgentId]);
  const activeRuns = useMemo(() => runs.filter((r) => r.agent_id === activeAgentId), [runs, activeAgentId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [qRes, aRes, kRes, rRes, mRes] = await Promise.all([
        supabase.from('whatsapp_queues').select('id, name, team_member_id').eq('active', true).order('sort_order'),
        db.from('ai_agents').select('*').order('created_at', { ascending: false }),
        db.from('ai_agent_knowledge').select('*').order('sort_order'),
        db.from('ai_agent_runs').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('team_members').select('id, full_name').eq('active', true).order('full_name'),
      ]);
      setQueues((qRes.data ?? []) as Queue[]);
      setAgents((aRes.data ?? []) as Agent[]);
      setKnowledge((kRes.data ?? []) as Knowledge[]);
      setRuns((rRes.data ?? []) as Run[]);
      setMembers((mRes.data ?? []) as TeamMember[]);
      if (aRes.data?.[0]) setActiveAgentId((aRes.data[0] as Agent).id);
      setLoading(false);
    })();
  }, []);

  function patchAgent(patch: Partial<Agent>) {
    if (!activeAgent) return;
    setAgents((prev) => prev.map((a) => (a.id === activeAgent.id ? { ...a, ...patch } : a)));
  }

  async function createAgent() {
    const queuesWithoutAgent = queues.filter((q) => !agents.some((a) => a.queue_id === q.id));
    if (queuesWithoutAgent.length === 0) {
      toast({ title: 'Todas as filas já têm agente', variant: 'destructive' });
      return;
    }
    const q = queuesWithoutAgent[0];
    const { data, error } = await db.from('ai_agents').insert({
      queue_id: q.id,
      name: `Agente — ${q.name}`,
      active: false,
      system_prompt: 'Você é um atendente do escritório de advocacia Lindomberto Moraes. Seja cordial, claro e direto. Não dê pareceres jurídicos definitivos; sempre indique falar com um advogado para o caso concreto.',
      greeting_message: 'Olá! 👋 Sou o assistente virtual do escritório Lindomberto Moraes. Como posso te ajudar hoje?',
    }).select('*').single();
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setAgents((prev) => [data as Agent, ...prev]);
    setActiveAgentId((data as Agent).id);
  }

  async function saveAgent() {
    if (!activeAgent) return;
    setSaving(true);
    const { error } = await db.from('ai_agents').update({
      name: activeAgent.name,
      active: activeAgent.active,
      model: activeAgent.model,
      temperature: activeAgent.temperature,
      max_tokens: activeAgent.max_tokens,
      system_prompt: activeAgent.system_prompt,
      greeting_message: activeAgent.greeting_message,
      handoff_keywords: activeAgent.handoff_keywords,
      handoff_after_messages: activeAgent.handoff_after_messages,
      business_hours: activeAgent.business_hours,
      tools_enabled: activeAgent.tools_enabled,
      queue_id: activeAgent.queue_id,
    }).eq('id', activeAgent.id);
    setSaving(false);
    if (error) return toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    toast({ title: 'Agente salvo' });
  }

  async function deleteAgent() {
    if (!activeAgent) return;
    if (!confirm(`Excluir agente "${activeAgent.name}"?`)) return;
    const { error } = await db.from('ai_agents').delete().eq('id', activeAgent.id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setAgents((prev) => prev.filter((a) => a.id !== activeAgent.id));
    setActiveAgentId(null);
  }

  async function addKnowledge() {
    if (!activeAgent) return;
    const next = (activeKnowledge[activeKnowledge.length - 1]?.sort_order ?? 0) + 10;
    const { data, error } = await db.from('ai_agent_knowledge').insert({
      agent_id: activeAgent.id, title: 'Novo tópico', content: '', sort_order: next, active: true,
    }).select('*').single();
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setKnowledge((prev) => [...prev, data as Knowledge]);
  }
  async function updateKnowledge(id: string, patch: Partial<Knowledge>) {
    setKnowledge((prev) => prev.map((k) => (k.id === id ? { ...k, ...patch } : k)));
    await db.from('ai_agent_knowledge').update(patch).eq('id', id);
  }
  async function deleteKnowledge(id: string) {
    if (!confirm('Excluir este item?')) return;
    await db.from('ai_agent_knowledge').delete().eq('id', id);
    setKnowledge((prev) => prev.filter((k) => k.id !== id));
  }

  async function runPlayground() {
    if (!activeAgent || !playInput.trim()) return;
    const userMsg = { role: 'user', content: playInput.trim() };
    const next = [...playMessages, userMsg];
    setPlayMessages(next);
    setPlayInput('');
    setPlayLoading(true);
    const { data, error } = await supabase.functions.invoke('ai-agent-test', {
      body: { agent_id: activeAgent.id, messages: next },
    });
    setPlayLoading(false);
    if (error || (data && !data.ok)) {
      toast({ title: 'Erro no playground', description: error?.message ?? data?.error, variant: 'destructive' });
      return;
    }
    setPlayMessages((m) => [...m, { role: 'assistant', content: data.reply ?? '(sem resposta)' }]);
    setPlayLastMeta({ tokens: data.usage, tool_calls: data.tool_calls });
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl flex items-center gap-2"><Bot className="w-7 h-7 text-accent" /> Agentes de IA</h1>
          <p className="text-sm text-muted-foreground">Configure agentes por fila de atendimento WhatsApp.</p>
        </div>
        <Button onClick={createAgent}><Plus className="w-4 h-4 mr-2" />Novo agente</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…</div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* List */}
          <aside className="col-span-12 md:col-span-3 space-y-2">
            {agents.length === 0 && (
              <Card className="p-4 text-sm text-muted-foreground">Nenhum agente criado.</Card>
            )}
            {agents.map((a) => {
              const q = queues.find((x) => x.id === a.queue_id);
              const active = a.id === activeAgentId;
              return (
                <button
                  key={a.id}
                  onClick={() => setActiveAgentId(a.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${active ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{a.name}</span>
                    {a.active ? <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px] h-5">ativo</Badge> : <Badge variant="outline" className="text-[10px] h-5">inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">Fila: {q?.name ?? '—'}</p>
                </button>
              );
            })}
          </aside>

          {/* Editor */}
          <section className="col-span-12 md:col-span-9">
            {!activeAgent ? (
              <Card className="p-12 text-center text-muted-foreground">Selecione ou crie um agente.</Card>
            ) : (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-xl">{activeAgent.name}</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={deleteAgent}><Trash2 className="w-4 h-4 mr-2" />Excluir</Button>
                    <Button size="sm" onClick={saveAgent} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar
                    </Button>
                  </div>
                </div>

                <Tabs defaultValue="general">
                  <TabsList className="flex flex-wrap">
                    <TabsTrigger value="general">Geral</TabsTrigger>
                    <TabsTrigger value="prompt"><MessageCircle className="w-3.5 h-3.5 mr-1" />Prompt</TabsTrigger>
                    <TabsTrigger value="knowledge"><BookOpen className="w-3.5 h-3.5 mr-1" />Conhecimento</TabsTrigger>
                    <TabsTrigger value="handoff"><Clock className="w-3.5 h-3.5 mr-1" />Handoff</TabsTrigger>
                    <TabsTrigger value="tools"><Wrench className="w-3.5 h-3.5 mr-1" />Ferramentas</TabsTrigger>
                    <TabsTrigger value="play"><FlaskConical className="w-3.5 h-3.5 mr-1" />Playground</TabsTrigger>
                    <TabsTrigger value="history">Histórico</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nome</Label>
                        <Input value={activeAgent.name} onChange={(e) => patchAgent({ name: e.target.value })} />
                      </div>
                      <div>
                        <Label>Fila</Label>
                        <Select value={activeAgent.queue_id} onValueChange={(v) => patchAgent({ queue_id: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {queues.map((q) => (<SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Modelo</Label>
                        <Select value={activeAgent.model} onValueChange={(v) => patchAgent({ model: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MODELS.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Temperatura: {activeAgent.temperature}</Label>
                        <Input
                          type="number"
                          step={0.1}
                          min={0.1}
                          max={1}
                          value={activeAgent.temperature}
                          onChange={(e) => {
                            const v = Math.max(0.1, Math.min(1, Number(e.target.value) || 0.1));
                            patchAgent({ temperature: v });
                          }}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Entre 0,1 (mais previsível) e 1,0 (mais criativo).</p>
                      </div>
                      <div className="flex items-center gap-3 pt-6">
                        <Switch checked={activeAgent.active} onCheckedChange={(v) => patchAgent({ active: v })} />
                        <Label>Agente ativo (responde automaticamente)</Label>
                      </div>
                    </div>
                    <div>
                      <Label>Mensagem de saudação (opcional)</Label>
                      <Textarea rows={2} value={activeAgent.greeting_message ?? ''} onChange={(e) => patchAgent({ greeting_message: e.target.value })} />
                    </div>
                  </TabsContent>

                  <TabsContent value="prompt" className="space-y-3 mt-4">
                    <Label>System prompt (instruções da persona e escopo)</Label>
                    <Textarea
                      rows={18}
                      value={activeAgent.system_prompt}
                      onChange={(e) => patchAgent({ system_prompt: e.target.value })}
                      className="font-mono text-sm"
                    />
                  </TabsContent>

                  <TabsContent value="knowledge" className="space-y-3 mt-4">
                    <div className="flex justify-end">
                      <Button size="sm" onClick={addKnowledge}><Plus className="w-4 h-4 mr-2" />Adicionar tópico</Button>
                    </div>
                    {activeKnowledge.length === 0 && (
                      <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum item de conhecimento. Adicione FAQs, valores, processos, etc.</Card>
                    )}
                    {activeKnowledge.map((k) => (
                      <Card key={k.id} className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input value={k.title} onChange={(e) => updateKnowledge(k.id, { title: e.target.value })} className="flex-1" />
                          <Switch checked={k.active} onCheckedChange={(v) => updateKnowledge(k.id, { active: v })} />
                          <Button variant="ghost" size="sm" onClick={() => deleteKnowledge(k.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        <Textarea rows={5} value={k.content} onChange={(e) => updateKnowledge(k.id, { content: e.target.value })} />
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="handoff" className="space-y-4 mt-4">
                    <div>
                      <Label>Palavras-chave para handoff (uma por linha)</Label>
                      <Textarea
                        rows={4}
                        value={(activeAgent.handoff_keywords ?? []).join('\n')}
                        onChange={(e) => patchAgent({ handoff_keywords: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A IA transfere para atendimento humano quando: (1) o horário comercial acabar, (2) alguma palavra-chave aparecer, ou (3) a própria IA decidir chamar a tool <code>request_human_handoff</code> (ex.: cliente pede advogado). Se o cliente ainda não estiver cadastrado, o encaminhamento vai <b>direto para a fila geral</b>. Se estiver cadastrado, o advogado responsável recebe uma notificação (sino + WhatsApp).
                    </p>

                    <div className="border-t pt-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Switch
                          checked={!!activeAgent.business_hours?.enabled}
                          onCheckedChange={(v) => patchAgent({ business_hours: { ...(activeAgent.business_hours ?? {}), enabled: v, tz: activeAgent.business_hours?.tz ?? 'America/Sao_Paulo', days: activeAgent.business_hours?.days ?? {} } })}
                        />
                        <Label>Limitar a horário comercial</Label>
                      </div>
                      {activeAgent.business_hours?.enabled && (
                        <div className="space-y-2">
                          {WEEK.map((d) => {
                            const day = activeAgent.business_hours?.days?.[d.id];
                            return (
                              <div key={d.id} className="grid grid-cols-12 gap-2 items-center">
                                <span className="col-span-2 text-sm">{d.label}</span>
                                <Input
                                  className="col-span-4" type="time"
                                  value={day?.start ?? ''}
                                  onChange={(e) => patchAgent({ business_hours: { ...activeAgent.business_hours!, days: { ...(activeAgent.business_hours!.days ?? {}), [d.id]: { ...(day ?? { start: '', end: '' }), start: e.target.value } } } })}
                                />
                                <Input
                                  className="col-span-4" type="time"
                                  value={day?.end ?? ''}
                                  onChange={(e) => patchAgent({ business_hours: { ...activeAgent.business_hours!, days: { ...(activeAgent.business_hours!.days ?? {}), [d.id]: { ...(day ?? { start: '', end: '' }), end: e.target.value } } } })}
                                />
                                <Button variant="ghost" size="sm" className="col-span-2" onClick={() => {
                                  const days = { ...(activeAgent.business_hours!.days ?? {}) };
                                  delete days[d.id];
                                  patchAgent({ business_hours: { ...activeAgent.business_hours!, days } });
                                }}>Limpar</Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="tools" className="space-y-3 mt-4">
                    {AVAILABLE_TOOLS.map((t) => {
                      const checked = activeAgent.tools_enabled?.includes(t.id);
                      return (
                        <label key={t.id} className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/30">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const set = new Set(activeAgent.tools_enabled ?? []);
                              if (v) set.add(t.id); else set.delete(t.id);
                              patchAgent({ tools_enabled: [...set] });
                            }}
                          />
                          <div>
                            <p className="font-medium text-sm">{t.label}</p>
                            <p className="text-xs text-muted-foreground">{t.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                    {activeAgent.tools_enabled?.includes('create_appointment') && (
                      <div className="p-3 border border-accent/40 bg-accent/5 rounded-lg space-y-2">
                        <Label className="text-sm">Advogado padrão para agendamentos (opcional)</Label>
                        <Select
                          value={activeAgent.scheduling_attorney_id ?? '__any__'}
                          onValueChange={(v) => patchAgent({ scheduling_attorney_id: v === '__any__' ? null : v })}
                        >
                          <SelectTrigger><SelectValue placeholder="Qualquer advogado disponível" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__any__">Qualquer advogado disponível</SelectItem>
                            {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Se preenchido, a IA marcará todas as consultas com este advogado, salvo se o cliente pedir outro pelo nome.</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="play" className="space-y-3 mt-4">
                    <p className="text-xs text-muted-foreground">Teste o agente sem enviar mensagens reais. Ferramentas não são executadas — apenas registradas.</p>
                    <Card className="p-3 h-80 overflow-y-auto bg-muted/30 space-y-2">
                      {playMessages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Envie uma mensagem para começar.</p>}
                      {playMessages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-accent text-[hsl(0_0%_8%)]' : 'bg-card border border-border'}`}>
                            {m.content}
                          </div>
                        </div>
                      ))}
                      {playLoading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />pensando…</div>}
                    </Card>
                    <div className="flex gap-2">
                      <Input
                        value={playInput}
                        onChange={(e) => setPlayInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runPlayground(); } }}
                        placeholder="Digite uma mensagem de cliente…"
                      />
                      <Button onClick={runPlayground} disabled={playLoading || !playInput.trim()}><Send className="w-4 h-4" /></Button>
                      <Button variant="outline" onClick={() => { setPlayMessages([]); setPlayLastMeta(null); }}>Limpar</Button>
                    </div>
                    {playLastMeta && (
                      <div className="text-xs text-muted-foreground flex gap-4">
                        {playLastMeta.tokens && (<span>tokens: {playLastMeta.tokens.prompt_tokens}↑ + {playLastMeta.tokens.completion_tokens}↓</span>)}
                        {!!playLastMeta.tool_calls?.length && (<span>tool calls: {playLastMeta.tool_calls.length}</span>)}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="history" className="mt-4">
                    {activeRuns.length === 0 ? (
                      <Card className="p-6 text-center text-sm text-muted-foreground">Sem execuções ainda.</Card>
                    ) : (
                      <div className="space-y-2">
                        {activeRuns.map((r) => (
                          <Card key={r.id} className="p-3 text-xs flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Badge variant={r.status === 'ok' ? 'default' : r.status === 'handoff' ? 'outline' : 'destructive'} className="text-[10px]">{r.status}</Badge>
                              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString('pt-BR')}</span>
                              <span>{r.model}</span>
                            </div>
                            <div className="text-muted-foreground">
                              {r.prompt_tokens ?? 0}↑ {r.completion_tokens ?? 0}↓ · {r.latency_ms ?? 0}ms
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </Card>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
