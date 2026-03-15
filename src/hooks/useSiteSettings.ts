import { useEffect, useState } from 'react';
import { db } from '@/lib/supabase-helpers';
import type { SiteSetting } from '@/types/database';

export function useSiteSettings() {
  const [settings, setSettings] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await db.from('site_settings').select('*');
      const map: Record<string, string | null> = {};
      (data as SiteSetting[] ?? []).forEach((s) => { map[s.key] = s.value; });
      setSettings(map);
      setLoading(false);
    };
    fetch();
  }, []);

  return { settings, loading };
}
