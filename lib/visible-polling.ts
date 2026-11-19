export const orderPollingFinished = (status?: string) =>
  status === "completed" || status === "expired" || status === "refunded";

// Uma chamada por vez; abas ocultas não mantêm um timer de consulta ativo.
export function startVisiblePolling(task: () => Promise<unknown>, intervalMs: number | null) {
  let stopped = false;
  let loading = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const isVisible = () => document.visibilityState !== "hidden";
  const clear = () => { clearTimeout(timer); timer = undefined; };
  const run = async () => {
    if (stopped || loading || !isVisible()) return;
    loading = true;
    try { await task(); } catch { /* A próxima consulta ou a atualização manual permite tentar de novo. */ }
    finally {
      loading = false;
      if (!stopped && isVisible() && intervalMs !== null) timer = setTimeout(run, intervalMs);
    }
  };
  const visibility = () => {
    clear();
    if (isVisible() && !loading) timer = setTimeout(run, 0);
  };
  document.addEventListener("visibilitychange", visibility);
  visibility();
  return () => { stopped = true; clear(); document.removeEventListener("visibilitychange", visibility); };
}
