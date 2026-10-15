import { Truck } from "lucide-react";
import { deliveryAreas } from "@/lib/delivery-areas";

export default function DeliveryAreas() {
  return <section className="delivery-coverage" aria-label="Bairros e taxas de delivery">
    <div className="delivery-coverage-heading"><Truck size={24} aria-hidden="true" /><div><h2>Temos delivery!</h2><p>Entregamos nestes bairros de João Pessoa em 30/10, a partir das 19h.</p></div></div>
    <div className="delivery-coverage-groups">
      {[0, 500].map(fee => <div key={fee}><h3>{fee === 0 ? "Frete grátis" : "Taxa fixa de R$ 5,00"}</h3><ul>{deliveryAreas.filter(area => area.fee === fee).map(area => <li key={area.name}>{area.name}</li>)}</ul></div>)}
    </div>
    <p className="delivery-coverage-note">Atendemos somente os bairros acima. Escolha seu bairro no checkout para conferir a taxa e o total.</p>
  </section>;
}
