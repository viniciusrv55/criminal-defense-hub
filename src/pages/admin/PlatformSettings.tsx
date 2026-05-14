import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, ShieldAlert, PlugZap, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PSetting {
  key: string;
  value: string | null;
  description: string | null;
}

const FIELDS: { key: string; label: string; placeholder: string; type?: 'password' | 'text' }[] = [
  {
    key: 'evolution_api_url',
    label: 'URL da Evolution API',
    placeholder: 'https://evo.suaempresa.com.br',
  },
  {
    key: 'evolution_api_key',
    label: 'API Key global da Evolution',
    placeholder: '••••••••••••••••',
    type: 'password',
  },
  {
    key: 'openai_api_key',
    label: 'OpenAI API Key (Fase 3 — Agentes IA)',
    placeholder: 'sk-...',
    type: 'password',
  },
  {
    key: 'brevo_api_key',
    label: 'Brevo API Key (Fase 5 — E-mails)',
    placeholder: 'xkeysib-...',
    type: 'password',
  },
];

export default function PlatformSettings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('platform_settings')
      .select('key,value,description');
    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    } else {
      const map: Record<string, string> = {};
      (data ?? []).forEach((s: PSetting) => {
        map[s.key] = s.value ?? '';
      });
      setValues(map);
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    try {
      for (const f of FIELDS) {
        const { error } = await supabase
          .from('platform_settings')
          .update({ value: values[f.key] ?? null, updated_at: new Date().toISOString() })
          .eq('key', f.key);
        if (error) throw error;
      }
      toast({ title: 'Configurações salvas', description: 'Plataforma atualizada com sucesso.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function testEvolution() {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-api', {
        body: { action: 'testConnection' },
      });
      if (error) throw error;
      const ok = (data as { ok?: boolean; status?: number; error?: string })?.ok;
      const status = (data as { status?: number })?.status;
      if (ok) {
        toast({
          title: 'Conexão OK',
          description: `Evolution respondeu (HTTP ${status}).`,
        });
      } else {
        const errMsg = (data as { error?: string })?.error ?? `HTTP ${status}`;
        toast({ title: 'Falha na conexão', description: errMsg, variant: 'destructive' });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl space-y-8">
        <header className="flex items-start gap-3">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h1 className="font-serif text-3xl tracking-tight">Plataforma</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Credenciais globais usadas pelo módulo de Atendimento. Apenas o <strong>Super Admin</strong> tem acesso.
              Estas chaves nunca são expostas no frontend — apenas as edge functions usam.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key} className="text-sm font-medium">
                  {f.label}
                </Label>
                <Input
                  id={f.key}
                  type={f.type === 'password' ? 'password' : 'text'}
                  value={values[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
            ))}

            <div className="flex flex-wrap gap-3 pt-4 border-t border-neutral-200">
              <Button onClick={save} disabled={saving} className="bg-black hover:bg-neutral-800">
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar configurações
              </Button>
              <Button
                onClick={testEvolution}
                disabled={testing}
                variant="outline"
                className="border-amber-300 text-amber-800 hover:bg-amber-50"
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <PlugZap className="w-4 h-4 mr-2" />
                )}
                Testar conexão Evolution
              </Button>
            </div>

            <div className="mt-8 p-4 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-700">
              <p className="font-semibold mb-2">URL do Webhook Evolution</p>
              <p className="text-xs text-neutral-600 mb-2">
                Configure este endereço como webhook das suas instâncias na Evolution para que o sistema receba mensagens:
              </p>
              <code className="block bg-white px-3 py-2 rounded border border-neutral-300 text-xs break-all">
                https://fskstajvuoviicfjfcai.supabase.co/functions/v1/evolution-webhook
              </code>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
