import { MessageCircle } from "lucide-react";
import { phoneLabel } from "@/lib/store-contact";

type Props = { phone: string; orderId: string; customerName: string; total: number };

export default function PaymentReceipt({ phone, orderId, customerName, total }: Props) {
  const code = orderId.slice(0, 8).toUpperCase();
  const amount = (total / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const message = `Olá! Sou ${customerName}. Fiz o pagamento do pedido #${code}, no valor de ${amount}. Vou anexar o comprovante do pagamento aqui para vocês conferirem.`;

  return <section className="payment-receipt" aria-labelledby="payment-receipt-title">
    <h3 id="payment-receipt-title">Já fez o pagamento?</h3>
    <p>Envie o comprovante pelo WhatsApp para a gente conferir seu pagamento.</p>
    <a className="button-whatsapp" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
      <MessageCircle size={22} aria-hidden="true" />
      <span>Enviar comprovante pelo WhatsApp</span>
    </a>
    <p className="payment-receipt-help">Ao abrir a conversa, anexe a foto ou o PDF do comprovante e envie. Você também pode enviar após a confirmação do pedido.</p>
    <p className="payment-receipt-number">WhatsApp: <strong>{phoneLabel(phone)}</strong></p>
  </section>;
}
