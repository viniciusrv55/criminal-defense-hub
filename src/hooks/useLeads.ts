import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/supabase-helpers';
import type { Lead, LeadHistory } from '@/types/database';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    const { data } = await db.from('leads').select('*').order('created_at', { ascending: false });
    setLeads(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const { error } = await db.from('leads').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) await fetchLeads();
    return { error };
  };

  return { leads, loading, fetchLeads, updateLead };
}

export function useLeadHistory(leadId: string | undefined) {
  const [history, setHistory] = useState<LeadHistory[]>([]);

  useEffect(() => {
    if (!leadId) return;
    db.from('lead_history').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
      .then(({ data }: { data: any }) => setHistory(data ?? []));
  }, [leadId]);

  return history;
}

export async function submitLead(data: { name: string; email: string; phone: string; practice_area_id: string | null; message: string }) {
  const { error } = await db.from('leads').insert({
    ...data,
    status: 'new',
    kanban_status: 'new',
  });
  if (!error) {
    await db.from('lead_history').insert({
      lead_id: undefined, // Will be set by trigger or manually
      action: 'lead_created',
      description: `Lead criado via formulário de contato`,
    });
  }
  return { error };
}
