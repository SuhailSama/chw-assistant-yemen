import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const ROLES = ['CHW', 'Supervisor', 'Admin'];
const IDENTITY_KEY = 'chw_identity';

function identityFrom(session) {
  const meta = session.user.app_metadata || {};
  return {
    id: session.user.id,
    username: meta.username || (session.user.email || '').split('@')[0],
    role: ROLES.includes(meta.role) ? meta.role : null,
    mustChangePassword: !!meta.must_change_password,
  };
}

const readCachedIdentity = () => {
  try { return JSON.parse(localStorage.getItem(IDENTITY_KEY) || 'null'); } catch { return null; }
};

// useAuth — tells the app who is logged in and what role they have
// Returns: { user, role, mustChangePassword, loading, logout, recheckSession }
//
// HOW OFFLINE WORKS:
// Supabase keeps the session in localStorage and refreshes it silently.
// The access token lasts an hour, so a CHW who has been offline longer
// cannot refresh it. In that case we fall back to the identity cached at
// the last successful check, so the app stays usable in the field; the
// server still rejects anything sent without a valid token.
export function useAuth() {
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading]   = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        const next = identityFrom(data.session);
        localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
        setIdentity(next);
      } else if (!navigator.onLine && readCachedIdentity()) {
        setIdentity(readCachedIdentity());
      } else {
        setIdentity(null);
      }
    } catch {
      setIdentity(navigator.onLine ? null : readCachedIdentity());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(IDENTITY_KEY);
        setIdentity(null);
      } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        checkSession();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [checkSession]);

  async function logout() {
    localStorage.removeItem(IDENTITY_KEY);
    setIdentity(null);
    // Local scope: works offline and leaves the user's other devices signed in.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  }

  return {
    user: identity ? { id: identity.id, username: identity.username } : null,
    role: identity?.role || null,
    mustChangePassword: !!identity?.mustChangePassword,
    loading,
    logout,
    recheckSession: checkSession,
  };
}
