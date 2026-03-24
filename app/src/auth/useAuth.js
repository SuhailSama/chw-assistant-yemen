import { useState, useEffect } from 'react';
import { getCurrentUser, fetchAuthSession, signOut } from 'aws-amplify/auth';

// useAuth — tells the app who is logged in and what role they have
// Returns: { user, role, loading, logout }
//
// HOW OFFLINE WORKS:
// Amplify caches the JWT tokens in localStorage automatically.
// On page load it checks the cached tokens first — if valid, the user
// is considered logged in without any network request.
// The refresh token lasts 30 days, so CHWs stay logged in for a month.
export function useAuth() {
  const [user, setUser]       = useState(null);   // { username }
  const [role, setRole]       = useState(null);   // 'CHW' | 'Supervisor' | 'Admin' | null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const currentUser = await getCurrentUser();
      const session     = await fetchAuthSession();
      const groups      = session.tokens?.idToken?.payload?.['cognito:groups'] || [];
      // Highest role wins (Admin > Supervisor > CHW)
      const userRole = groups.includes('Admin')      ? 'Admin'
                     : groups.includes('Supervisor') ? 'Supervisor'
                     : groups.includes('CHW')        ? 'CHW'
                     : null;
      setUser({ username: currentUser.username });
      setRole(userRole);
    } catch {
      // No session — user is logged out
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await signOut();
    setUser(null);
    setRole(null);
  }

  return { user, role, loading, logout, recheckSession: checkSession };
}
