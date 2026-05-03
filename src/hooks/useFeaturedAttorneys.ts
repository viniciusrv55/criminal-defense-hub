import { useEffect, useState } from 'react';
import { db } from '@/lib/supabase-helpers';

export interface FeaturedAttorney {
  id: string;
  full_name: string;
  specialty: string | null;
  oab_number: string | null;
  photo_url: string | null;
  sort_order: number;
  active: boolean;
}

export function useFeaturedAttorneys(onlyActive = true) {
  const [attorneys, setAttorneys] = useState<FeaturedAttorney[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    let q = db.from('featured_attorneys').select('*').order('sort_order');
    if (onlyActive) q = q.eq('active', true);
    const { data } = await q;
    setAttorneys((data ?? []) as FeaturedAttorney[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [onlyActive]);

  return { attorneys, loading, refresh: fetchAll };
}
