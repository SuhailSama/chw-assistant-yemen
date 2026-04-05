import { useState } from "react";

const STORAGE_KEY = "chw_offline_queue";

const loadQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveQueue = (queue) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

export function useOfflineQueue() {
  const [pending, setPending] = useState(() => loadQueue());

  const enqueue = (patientData) => {
    const item = { patientData, timestamp: Date.now(), status: "pending" };
    const updated = [...loadQueue(), item];
    saveQueue(updated);
    setPending(updated);
  };

  const dequeue = () => {
    const current = loadQueue();
    if (current.length === 0) return null;
    const [first, ...rest] = current;
    saveQueue(rest);
    setPending(rest);
    return first;
  };

  const processQueue = async (analyzeFn) => {
    const current = loadQueue();
    if (current.length === 0) return;
    for (const item of current) {
      try {
        await analyzeFn(item.patientData);
      } catch (err) {
        console.warn("Failed to process queued item:", err);
      }
    }
    saveQueue([]);
    setPending([]);
  };

  return { enqueue, dequeue, pending, processQueue };
}
