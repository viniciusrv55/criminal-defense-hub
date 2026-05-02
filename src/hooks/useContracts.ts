import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/supabase-helpers';
import type { Client, Contract } from '@/types/contracts';

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await db.from('contracts').select('*').order('created_at', { ascending: false });
    setContracts((data ?? []) as Contract[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { contracts, loading, refresh: fetchAll };
}

export function useContract(id?: string) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id || id === 'new') { setLoading(false); return; }
    const { data: c } = await db.from('contracts').select('*').eq('id', id).maybeSingle();
    setContract(c as Contract | null);
    if (c?.client_id) {
      const { data: cl } = await db.from('clients').select('*').eq('id', c.client_id).maybeSingle();
      setClient(cl as Client | null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { contract, client, loading, refresh, setClient, setContract };
}

export function useClientSearch(query: string) {
  const [results, setResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await db.from('clients').select('*')
        .or(`full_name.ilike.%${query}%,cpf.ilike.%${query}%,cnpj.ilike.%${query}%`)
        .limit(10);
      setResults((data ?? []) as Client[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return { results, searching };
}
