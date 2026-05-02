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
    const { data, error } = await db.from('user_roles').select('role').eq('user_id', userId).abortSignal(AbortSignal.timeout(8000));
    if (!error) setRoles(data?.map((r: { role: AppRole }) => r.role) ?? []);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await db.from('profiles').select('full_name').eq('user_id', userId).maybeSingle().abortSignal(AbortSignal.timeout(8000));
    if (!error) setProfileName(data?.full_name ?? null);
  }, []);

  const loadUserContext = useCallback(async (currentSession: Session | null) => {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);

    if (!currentSession?.user) {
      setRoles([]);
      setProfileName(null);
      setLoading(false);
      return;
    }

    await Promise.allSettled([
      fetchRoles(currentSession.user.id),
      fetchProfile(currentSession.user.id),
    ]);
    setLoading(false);
  }, [fetchRoles, fetchProfile]);

  useEffect(() => {
    const loadingFallback = window.setTimeout(() => setLoading(false), 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session?.user) {
          setRoles([]);
          setProfileName(null);
        }
        setTimeout(() => { void loadUserContext(session); }, 0);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      void loadUserContext(session);
    }).catch(() => {
      setSession(null);
      setUser(null);
      setRoles([]);
      setProfileName(null);
      setLoading(false);
    });

    return () => {
      window.clearTimeout(loadingFallback);
      subscription.unsubscribe();
    };
  }, [loadUserContext]);

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
