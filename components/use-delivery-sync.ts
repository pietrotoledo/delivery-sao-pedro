"use client";
import { useEffect, useState } from "react";

export default function useDeliverySync(enabled: boolean, reload: () => Promise<void>) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    let events: EventSource | null = null;
    let active = true, loading = false, pending = false;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || !active) return;
      if (loading) { pending = true; return; }
      loading = true;
      try { await reload(); } catch { /* A atualização periódica permite tentar novamente. */ }
      finally { loading = false; if (pending && active) { pending = false; void refresh(); } }
    };
    const visible = () => {
      if (document.visibilityState === "hidden") {
        events?.close(); events = null; setConnected(false);
        return;
      }
      if (events) return;
      events = new EventSource("/api/delivery/events");
      events.onopen = () => { if (active) setConnected(true); };
      events.onerror = () => { if (active) setConnected(false); };
      // O servidor envia sync ao conectar, que também atualiza ao voltar à aba.
      events.addEventListener("sync", refresh);
    };
    visible();
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; events?.close(); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [enabled, reload]);
  return enabled && connected;
}
