export class RequestTimeoutError extends Error {
  constructor() {
    super("A conexão demorou para responder. Atualize o pedido para conferir a situação antes de tentar novamente.");
    this.name = "RequestTimeoutError";
  }
}

export async function requestJson<T>(url: string, init: RequestInit = {}, timeoutMs = 15_000) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    let result: T;
    try { result = await response.json() as T; }
    catch (failure) {
      if (controller.signal.aborted) throw failure;
      throw new Error("O servidor retornou uma resposta inválida. Tente atualizar em alguns segundos.");
    }
    return { response, result };
  } catch (failure) {
    if (timedOut) throw new RequestTimeoutError();
    if (failure instanceof TypeError) throw new Error("Não foi possível conectar. Confira sua internet e tente atualizar.");
    throw failure;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abort);
  }
}

// Polling and live events share one request. Mutations can request a fresh read
// after any older request has settled, without discarding every slow response.
export function singleFlight() {
  let pending: Promise<void> | null = null;
  let pendingTask: (() => Promise<void>) | null = null;
  function load(task: () => Promise<void>, fresh = false): Promise<void> {
    if (pending) return fresh || task !== pendingTask ? pending.catch(() => {}).then(() => load(task)) : pending;
    pendingTask = task;
    pending = Promise.resolve().then(task).finally(() => { pending = null; pendingTask = null; });
    return pending;
  }
  return load;
}
