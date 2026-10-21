"use client";

import "./globals.css";
import "./experience.css";
import ErrorScreen from "@/components/error-screen";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="pt-BR"><body>
    <ErrorScreen code="Ops!" title="O site teve um problema" message="Não conseguimos carregar o site agora. Seus pedidos e pagamentos não foram afetados. Tente de novo em alguns segundos."
      action={<button className="button button-outline" type="button" onClick={reset}>Tentar de novo</button>} />
  </body></html>;
}
