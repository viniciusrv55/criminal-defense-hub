import { useEffect, useState } from 'react';
import { db } from '@/lib/supabase-helpers';
import type { PracticeArea } from '@/types/database';

const normalize = (row: Record<string, unknown>): PracticeArea => ({
  ...(row as unknown as PracticeArea),
  gallery: Array.isArray(row.gallery) ? (row.gallery as string[]) : [],
});

export function usePracticeAreas(onlyActive = true) {
  const [areas, setAreas] = useState<PracticeArea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = db.from('practice_areas').select('*').order('sort_order');
    if (onlyActive) q = q.eq('active', true);
    q.then(({ data }: { data: Record<string, unknown>[] | null }) => {
      setAreas((data ?? []).map(normalize));
      setLoading(false);
    });
  }, [onlyActive]);

  return { areas, loading };
}

export function usePracticeAreaBySlug(slug?: string) {
  const [area, setArea] = useState<PracticeArea | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    db.from('practice_areas').select('*').eq('slug', slug).maybeSingle().then(({ data }: { data: Record<string, unknown> | null }) => {
      setArea(data ? normalize(data) : null);
      setLoading(false);
    });
  }, [slug]);

  return { area, loading };
}
