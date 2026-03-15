import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/supabase-helpers';
import type { User, Session } from '@supabase/supabase-js';
import type { AppRole } from '@/types/database';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState<string | null>(null);

  const fetchRoles = useCallback(async (userId: string) => {
    const { data } = await db.from('user_roles').select('role').eq('user_id', userId);
    setRoles(data?.map((r: { role: AppRole }) => r.role) ?? []);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await db.from('profiles').select('full_name').eq('user_id', userId).single();
    setProfileName(data?.full_name ?? null);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await Promise.all([fetchRoles(session.user.id), fetchProfile(session.user.id)]);
        } else {
          setRoles([]);
          setProfileName(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.all([fetchRoles(session.user.id), fetchProfile(session.user.id)]).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRoles, fetchProfile]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = () => hasRole('super_admin') || hasRole('admin');
  const isSuperAdmin = () => hasRole('super_admin');

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  return { user, session, roles, loading, profileName, hasRole, isAdmin, isSuperAdmin, signIn, signOut };
}
