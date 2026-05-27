import { useEffect, useState } from 'react';
import { db } from '@/lib/supabase-helpers';
import { toast } from '@/hooks/use-toast';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface KanbanColumn {
  id: string;
  key: string;
  label: string;
  color: string | null;
  sort_order: number;
  active: boolean;
}

const COLOR_PRESETS = [
  { label: 'Azul', value: 'border-blue-500' },
  { label: 'Amarelo', value: 'border-yellow-500' },
  { label: 'Dourado', value: 'border-accent' },
  { label: 'Roxo', value: 'border-purple-500' },
  { label: 'Verde', value: 'border-green-500' },
  { label: 'Vermelho', value: 'border-red-500' },
  { label: 'Cinza', value: 'border-gray-400' },
];

interface Props {
  columns: KanbanColumn[];
  onChanged: () => void;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || `col_${Date.now()}`;

export const KanbanColumnsEditor = ({ columns, onChanged }: Props) => {
  const [local, setLocal] = useState<KanbanColumn[]>(columns);
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => { setLocal(columns); }, [columns]);

  const saveCol = async (col: KanbanColumn) => {
    const { error } = await db.from('kanban_columns').update({
      label: col.label, color: col.color, sort_order: col.sort_order, active: col.active, updated_at: new Date().toISOString(),
    }).eq('id', col.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Coluna salva' }); onChanged(); }
  };

  const addCol = async () => {
    if (!newLabel.trim()) return;
    const key = slugify(newLabel);
    const maxSort = Math.max(0, ...local.map(c => c.sort_order));
    const { error } = await db.from('kanban_columns').insert({ key, label: newLabel.trim(), color: 'border-accent', sort_order: maxSort + 1, active: true });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { setNewLabel(''); onChanged(); }
  };

  const remove = async (col: KanbanColumn) => {
    if (!confirm(`Remover a coluna "${col.label}"? Leads nesta etapa ficarão sem coluna.`)) return;
    const { error } = await db.from('kanban_columns').delete().eq('id', col.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else onChanged();
  };

  return (
    <div className="p-4 bg-card border border-border rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Colunas do Kanban</h3>
      </div>
      <div className="space-y-2">
        {local.map((c, idx) => (
          <div key={c.id} className="flex items-center gap-2 flex-wrap">
            <Input
              value={c.label}
              onChange={(e) => setLocal(arr => arr.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
              className="bg-background max-w-[220px]"
            />
            <select
              value={c.color ?? 'border-accent'}
              onChange={(e) => setLocal(arr => arr.map((x, i) => i === idx ? { ...x, color: e.target.value } : x))}
              className="text-sm px-2 py-2 rounded-md border border-border bg-background"
            >
              {COLOR_PRESETS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Input
              type="number"
              value={c.sort_order}
              onChange={(e) => setLocal(arr => arr.map((x, i) => i === idx ? { ...x, sort_order: parseInt(e.target.value || '0') } : x))}
              className="bg-background w-20"
            />
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={c.active} onChange={(e) => setLocal(arr => arr.map((x, i) => i === idx ? { ...x, active: e.target.checked } : x))} />
              Ativa
            </label>
            <Button variant="outline" size="sm" onClick={() => saveCol(local[idx])}><Save className="w-3 h-3" /></Button>
            <Button variant="ghost" size="sm" onClick={() => remove(c)} className="text-destructive"><Trash2 className="w-3 h-3" /></Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-2 border-t border-border">
        <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Nome da nova coluna" className="bg-background" onKeyDown={(e) => { if (e.key === 'Enter') addCol(); }} />
        <Button onClick={addCol} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
      </div>
    </div>
  );
};
