"use client";
import { useEffect, useState } from "react";

export default function useDeliverySync(enabled: boolean, reload: () => Promise<void>) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    const events = new EventSource("/api/delivery/events");
    let active = true, loading = false, pending = false;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || !active) return;
      if (loading) { pending = true; return; }
      loading = true;
      try { await reload(); } catch { /* A atualização periódica permite tentar novamente. */ }
      finally { loading = false; if (pending && active) { pending = false; void refresh(); } }
    };
    events.onopen = () => setConnected(true);
    events.onerror = () => setConnected(false);
    events.addEventListener("sync", refresh);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; events.close(); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [enabled, reload]);
  return enabled && connected;
}
