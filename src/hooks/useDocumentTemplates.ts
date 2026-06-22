import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/supabase-helpers';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface DocTemplateType { id: string; name: string; active: boolean; sort_order: number }

export interface DocTemplate {
  id: string;
  type_id: string;
  title: string;
  content_html: string;
  doc_date: string | null;
  owner_id: string;
  assigned_team_member_ids: string[];
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  logo_url?: string | null;
  header_image_url?: string | null;
  footer_image_url?: string | null;
  background_image_url?: string | null;
  letterhead_enabled?: boolean;
}

export function useDocTemplateTypes() {
  const [types, setTypes] = useState<DocTemplateType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await db.from('document_template_types').select('*').eq('active', true).order('sort_order').order('name');
    setTypes((data ?? []) as DocTemplateType[]);
    setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const create = async (name: string) => {
    const { data, error } = await db.from('document_template_types').insert({ name }).select().single();
    if (error || !data) {
      if (error) toast({ title: 'Não foi possível criar', description: error.message, variant: 'destructive' });
      return null;
    }
    setTypes(prev => [...prev, data as DocTemplateType]);
    return (data as DocTemplateType).id;
  };
  const remove = async (id: string) => {
    const { error } = await db.from('document_template_types').delete().eq('id', id);
    if (error) {
      toast({ title: 'Não foi possível remover', description: error.message.includes('row-level') ? 'Apenas administradores podem remover tipos.' : error.message, variant: 'destructive' });
      return false;
    }
    setTypes(prev => prev.filter(t => t.id !== id));
    toast({ title: 'Tipo removido' });
    return true;
  };
  return { types, loading, create, remove, refresh: fetch };
}

/** Lista todos os modelos visíveis para o usuário (RLS já filtra). */
export function useDocTemplates() {
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await db.from('document_templates').select('*').eq('active', true).order('updated_at', { ascending: false });
    setTemplates((data ?? []) as DocTemplate[]);
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  return { templates, loading, refresh };
}

export function useDocTemplate(id?: string) {
  const [template, setTemplate] = useState<DocTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id || id === 'new') { setLoading(false); return; }
    const { data } = await db.from('document_templates').select('*').eq('id', id).maybeSingle();
    setTemplate(data as DocTemplate | null);
    setLoading(false);
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);
  return { template, loading, refresh, setTemplate };
}

/** Carrega o team_member do usuário logado. */
export function useCurrentTeamMember() {
  const { user } = useAuth();
  const [member, setMember] = useState<{ id: string; full_name: string } | null>(null);
  useEffect(() => {
    if (!user) return;
    db.from('team_members').select('id, full_name').eq('user_id', user.id).maybeSingle()
      .then(({ data }: { data: { id: string; full_name: string } | null }) => setMember(data));
  }, [user]);
  return member;
}
