import { useEffect, useState } from 'react';
import { db } from '@/lib/supabase-helpers';
import type { PracticeArea } from '@/types/database';

export function usePracticeAreas() {
  const [areas, setAreas] = useState<PracticeArea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAreas = async () => {
      const { data } = await db.from('practice_areas').select('*').eq('active', true).order('sort_order');
      setAreas(data ?? []);
      setLoading(false);
    };
    fetchAreas();
  }, []);

  return { areas, loading };
}
