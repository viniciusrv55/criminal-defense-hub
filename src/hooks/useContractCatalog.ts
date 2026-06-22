import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/supabase-helpers';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface ClientGroup { id: string; name: string; practice_area_id: string | null; parent_id: string | null; active: boolean }
interface Comarca { id: string; name: string; state: string | null; active: boolean }
interface Vara { id: string; comarca_id: string; vara_number: string; location: string | null; active: boolean }
interface PaymentMethod { id: string; name: string; active: boolean; sort_order: number }

async function tryDelete(table: string, id: string): Promise<boolean> {
  const { error } = await db.from(table).delete().eq('id', id);
  if (error) {
    toast({
      title: 'Não foi possível remover',
      description: error.message.includes('row-level')
        ? 'Você só pode remover itens que você cadastrou (ou peça a um admin).'
        : error.message,
      variant: 'destructive',
    });
    return false;
  }
  toast({ title: 'Removido' });
  return true;
}

export function useClientGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await db.from('client_groups').select('*').eq('active', true).order('sort_order').order('name');
    setGroups((data ?? []) as ClientGroup[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (name: string, opts: { practice_area_id?: string | null; parent_id?: string | null } = {}) => {
    const { data, error } = await db.from('client_groups').insert({
      name, practice_area_id: opts.practice_area_id ?? null, parent_id: opts.parent_id ?? null, created_by: user?.id,
    }).select().single();
    if (error || !data) return null;
    setGroups(prev => [...prev, data as ClientGroup]);
    return (data as ClientGroup).id;
  };

  const remove = async (id: string) => {
    const ok = await tryDelete('client_groups', id);
    if (ok) setGroups(prev => prev.filter(g => g.id !== id));
    return ok;
  };

  return { groups, loading, refresh: fetch, create, remove };
}

export function useComarcas() {
  const { user } = useAuth();
  const [comarcas, setComarcas] = useState<Comarca[]>([]);

  const fetch = useCallback(async () => {
    const { data } = await db.from('comarcas').select('*').eq('active', true).order('name');
    setComarcas((data ?? []) as Comarca[]);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const create = async (name: string, state?: string | null) => {
    const { data, error } = await db.from('comarcas').insert({ name, state: state ?? null, created_by: user?.id }).select().single();
    if (error || !data) return null;
    setComarcas(prev => [...prev, data as Comarca].sort((a,b) => a.name.localeCompare(b.name)));
    return (data as Comarca).id;
  };

  const remove = async (id: string) => {
    const ok = await tryDelete('comarcas', id);
    if (ok) setComarcas(prev => prev.filter(c => c.id !== id));
    return ok;
  };

  return { comarcas, refresh: fetch, create, remove };
}

export function useVaras(comarcaId?: string | null) {
  const { user } = useAuth();
  const [varas, setVaras] = useState<Vara[]>([]);

  const fetch = useCallback(async () => {
    if (!comarcaId) { setVaras([]); return; }
    const { data } = await db.from('varas').select('*').eq('comarca_id', comarcaId).eq('active', true).order('vara_number');
    setVaras((data ?? []) as Vara[]);
  }, [comarcaId]);
  useEffect(() => { fetch(); }, [fetch]);

  const create = async (vara_number: string, location?: string | null) => {
    if (!comarcaId) return null;
    const { data, error } = await db.from('varas').insert({ comarca_id: comarcaId, vara_number, location: location ?? null, created_by: user?.id }).select().single();
    if (error || !data) return null;
    setVaras(prev => [...prev, data as Vara]);
    return (data as Vara).id;
  };

  const remove = async (id: string) => {
    const ok = await tryDelete('varas', id);
    if (ok) setVaras(prev => prev.filter(v => v.id !== id));
    return ok;
  };

  return { varas, refresh: fetch, create, remove };
}

export function usePaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  const fetch = useCallback(async () => {
    const { data } = await db.from('payment_methods').select('*').eq('active', true).order('sort_order').order('name');
    setMethods((data ?? []) as PaymentMethod[]);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const create = async (name: string) => {
    const { data, error } = await db.from('payment_methods').insert({ name }).select().single();
    if (error || !data) return null;
    setMethods(prev => [...prev, data as PaymentMethod]);
    return (data as PaymentMethod).id;
  };

  const remove = async (id: string) => {
    const ok = await tryDelete('payment_methods', id);
    if (ok) setMethods(prev => prev.filter(m => m.id !== id));
    return ok;
  };

  return { methods, refresh: fetch, create, remove };
}
