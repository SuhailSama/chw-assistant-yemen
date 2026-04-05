import { useState, useEffect, useCallback } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

const LAMBDA_URL = import.meta.env.VITE_LAMBDA_URL?.replace("/prod/v1/messages", "/prod");

const getToken = async () => {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || null;
  } catch { return null; }
};

const authFetch = async (path, options = {}) => {
  const token = await getToken();
  const res = await fetch(`${LAMBDA_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export function useDataSync() {
  const [visits, setVisits] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chw_visits") || "[]"); } catch { return []; }
  });
  const [referrals, setReferrals] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chw_referrals") || "[]"); } catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Fetch from API on mount
  useEffect(() => {
    if (!LAMBDA_URL) return;
    setLoading(true);
    Promise.all([
      authFetch("/api/visits").then(d => { setVisits(d.visits || []); localStorage.setItem("chw_visits", JSON.stringify(d.visits || [])); }),
      authFetch("/api/referrals").then(d => { setReferrals(d.referrals || []); localStorage.setItem("chw_referrals", JSON.stringify(d.referrals || [])); }),
    ])
      .catch(() => { /* fall back to localStorage data already in state */ })
      .finally(() => setLoading(false));
  }, []);

  // Persist to localStorage whenever state changes
  useEffect(() => { localStorage.setItem("chw_visits", JSON.stringify(visits)); }, [visits]);
  useEffect(() => { localStorage.setItem("chw_referrals", JSON.stringify(referrals)); }, [referrals]);

  const addVisit = useCallback(async (data) => {
    const optimistic = { ...data, id: `local-${Date.now()}` };
    setVisits(prev => [optimistic, ...prev]);
    setSyncing(true);
    try {
      const result = await authFetch("/api/visits", { method: "POST", body: JSON.stringify(data) });
      setVisits(prev => prev.map(v => v.id === optimistic.id ? { ...optimistic, visitId: result.visitId } : v));
    } catch {
      // Keep optimistic record; add to sync queue for retry
      const queue = JSON.parse(localStorage.getItem("chw_sync_queue") || "[]");
      queue.push({ type: "visit", data, timestamp: Date.now() });
      localStorage.setItem("chw_sync_queue", JSON.stringify(queue));
    } finally { setSyncing(false); }
  }, []);

  const addReferral = useCallback(async (data) => {
    const optimistic = { ...data, id: `local-${Date.now()}` };
    setReferrals(prev => [optimistic, ...prev]);
    setSyncing(true);
    try {
      const result = await authFetch("/api/referrals", { method: "POST", body: JSON.stringify(data) });
      setReferrals(prev => prev.map(r => r.id === optimistic.id ? { ...optimistic, referralId: result.referralId } : r));
    } catch {
      const queue = JSON.parse(localStorage.getItem("chw_sync_queue") || "[]");
      queue.push({ type: "referral", data, timestamp: Date.now() });
      localStorage.setItem("chw_sync_queue", JSON.stringify(queue));
    } finally { setSyncing(false); }
  }, []);

  // Process sync queue when back online
  useEffect(() => {
    const processQueue = async () => {
      const queue = JSON.parse(localStorage.getItem("chw_sync_queue") || "[]");
      if (!queue.length) return;
      const remaining = [];
      for (const item of queue) {
        try {
          if (item.type === "visit") await authFetch("/api/visits", { method: "POST", body: JSON.stringify(item.data) });
          else await authFetch("/api/referrals", { method: "POST", body: JSON.stringify(item.data) });
        } catch { remaining.push(item); }
      }
      localStorage.setItem("chw_sync_queue", JSON.stringify(remaining));
    };
    window.addEventListener("online", processQueue);
    return () => window.removeEventListener("online", processQueue);
  }, []);

  return { visits, setVisits, referrals, setReferrals, addVisit, addReferral, loading, syncing };
}
