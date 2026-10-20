import { BadgePercent, Truck } from "lucide-react";
import { deliveryAreas } from "@/lib/delivery-areas";

export default function DeliveryAreas() {
  return <section className="delivery-coverage" aria-label="Bairros e taxas de delivery">
    <div className="delivery-coverage-heading"><Truck size={24} aria-hidden="true" /><div><h2>Temos delivery!</h2><p>Entregamos nestes bairros de João Pessoa e Cabedelo em 30/10, a partir das 19h.</p></div></div>
    <p className="delivery-free-banner"><BadgePercent size={22} aria-hidden="true" /><span><strong>Pedidos acima de R$ 60,00: frete grátis para todos os bairros.</strong> Vale para qualquer bairro da lista, inclusive os que têm taxa ou taxa a combinar.</span></p>
    <div className="delivery-coverage-groups">
      {([0, 500, "combinar"] as const).map(fee => <div key={fee}><h3>{fee === 0 ? "Frete grátis" : fee === "combinar" ? "Taxa a combinar no WhatsApp" : "Taxa fixa de R$ 5,00"}</h3>{fee !== 0 && <p className="delivery-group-free">Grátis em pedidos acima de R$ 60</p>}<ul>{deliveryAreas.filter(area => area.fee === fee).map(area => <li key={area.name}>{area.name}{area.city ? ` (${area.city})` : ""}</li>)}</ul></div>)}
    </div>
    <p className="delivery-coverage-note">Atendemos somente os bairros acima. Escolha seu bairro no checkout para conferir a taxa e o total.</p>
  </section>;
}
