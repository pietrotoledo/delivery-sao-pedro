"use client";

import { useEffect } from "react";
import ErrorScreen from "@/components/error-screen";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <ErrorScreen code="Ops!" title="Algo deu errado" message="Tivemos um problema ao abrir esta página. Seus pedidos e pagamentos não foram afetados. Tente de novo em alguns segundos."
    action={<button className="button button-outline" type="button" onClick={reset}>Tentar de novo</button>} />;
}
