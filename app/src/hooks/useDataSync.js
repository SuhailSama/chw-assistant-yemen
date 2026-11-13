import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../auth/supabaseClient";

// Local-first records. Every record lives in localStorage (per user) and is
// pushed to Supabase when a connection is available. Each record gets a
// client-generated id, so retrying a push can never create a duplicate.

const storageKey = (table, uid) => `chw_${table}:${uid}`;

const load = (table, uid) => {
  try { return JSON.parse(localStorage.getItem(storageKey(table, uid)) || "[]"); } catch { return []; }
};

const newId = () =>
  crypto.randomUUID?.() ||
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16));

const stamp = (record) => (record.id ? record : { ...record, id: newId(), synced: false });

function useSyncedTable(table, uid) {
  const [state, setState] = useState({ uid: null, list: [] });
  const stateRef = useRef(state);
  stateRef.current = state;
  const busy = useRef(false);

  // Load this user's local records when the signed-in user changes
  useEffect(() => {
    setState({ uid, list: uid ? load(table, uid) : [] });
  }, [table, uid]);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    if (state.uid) localStorage.setItem(storageKey(table, state.uid), JSON.stringify(state.list));
  }, [table, state]);

  const setList = useCallback((updater) => {
    setState(prev => {
      if (!prev.uid) return prev;
      const next = typeof updater === "function" ? updater(prev.list) : updater;
      return { uid: prev.uid, list: next.map(stamp) };
    });
  }, []);

  const sync = useCallback(async () => {
    const { uid: owner, list } = stateRef.current;
    if (!owner || !navigator.onLine || busy.current) return;
    busy.current = true;
    try {
      // Push records the server has not seen yet
      const pending = list.filter(r => !r.synced);
      if (pending.length) {
        const rows = pending.map(({ id, synced: _synced, ...data }) => ({ id, data }));
        const { error } = await supabase.from(table).upsert(rows, { onConflict: "id", ignoreDuplicates: true });
        if (error) return; // keep them pending; retried on reconnect or next launch
        const done = new Set(pending.map(r => r.id));
        setState(prev => prev.uid !== owner ? prev : {
          uid: owner,
          list: prev.list.map(r => done.has(r.id) ? { ...r, synced: true } : r),
        });
      }
      // Pull this user's records (e.g. entered on another device)
      const { data, error } = await supabase
        .from(table).select("id, data").eq("chw_id", owner)
        .order("created_at", { ascending: false }).limit(500);
      if (error || !data) return;
      const remote = data.map(row => ({ ...row.data, id: row.id, synced: true }));
      const remoteIds = new Set(remote.map(r => r.id));
      setState(prev => prev.uid !== owner ? prev : {
        uid: owner,
        list: [...prev.list.filter(r => !remoteIds.has(r.id)), ...remote],
      });
    } finally { busy.current = false; }
  }, [table]);

  const list = state.uid === uid ? state.list : [];
  const pendingCount = list.filter(r => !r.synced).length;

  // Sync on login, when new records are added, and when back online
  useEffect(() => { if (state.uid) sync(); }, [state.uid, pendingCount, sync]);
  useEffect(() => {
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [sync]);

  return [list, setList];
}

export function useDataSync(user) {
  const uid = user?.id || null;
  const [visits, setVisits] = useSyncedTable("visits", uid);
  const [referrals, setReferrals] = useSyncedTable("referrals", uid);

  const addVisit = useCallback((data) => setVisits(prev => [data, ...prev]), [setVisits]);
  const addReferral = useCallback((data) => setReferrals(prev => [data, ...prev]), [setReferrals]);

  return { visits, setVisits, referrals, setReferrals, addVisit, addReferral };
}
