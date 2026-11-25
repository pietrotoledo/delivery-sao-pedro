"use client";

import { Download, Printer } from "lucide-react";

export type ReportOrder = {
  id: string; created_at: string; name: string; method: string; neighborhood: string | null;
  items_json: string; burger_count: number; subtotal: number; delivery_fee: number | null;
  total: number | null; status: string; paid_at: string | null; payment_mode: string | null;
};

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hourOf = (iso: string) => Number(new Date(iso).toLocaleString("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }));
const stageLabels: Record<string, string> = {
  awaiting_quote: "Aguardando taxa", ready_for_payment: "Aguardando pagamento", awaiting_payment: "Aguardando pagamento",
  paid: "Pago", preparing: "Em preparo", ready: "Pronto", out_for_delivery: "Saiu para entrega",
  completed: "Concluído", refunded: "Devolvido", expired: "Expirado",
};

export function dayLabel(day: string, style: "long" | "short" = "long") {
  const date = new Date(`${day}T12:00:00-03:00`);
  const text = date.toLocaleDateString("pt-BR", style === "long" ? { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" } : { weekday: "short", day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function AdminReport({ day, orders, capacity, itemsLabel }: { day: string; orders: ReportOrder[]; capacity: number; itemsLabel: (order: ReportOrder) => string }) {
  const paid = orders.filter(order => order.paid_at && order.status !== "refunded");
  const revenue = paid.reduce((sum, order) => sum + (order.total ?? 0), 0);
  const fees = paid.reduce((sum, order) => sum + (order.delivery_fee ?? 0), 0);
  const burgers = paid.reduce((sum, order) => sum + order.burger_count, 0);
  const pending = orders.filter(order => !order.paid_at && ["awaiting_quote", "ready_for_payment", "awaiting_payment"].includes(order.status));
  const expired = orders.filter(order => order.status === "expired");
  const refunded = orders.filter(order => order.status === "refunded");
  const delivery = paid.filter(order => order.method === "delivery");
  const pickup = paid.filter(order => order.method === "pickup");
  const average = paid.length ? Math.round(revenue / paid.length) : 0;
  const conversion = orders.length ? Math.round(paid.length / orders.length * 100) : 0;

  // Produtos vendidos: itens dos pedidos pagos + bebidas escolhidas dentro dos combos.
  const products = new Map<string, { quantity: number; revenue: number }>();
  const drinks = new Map<string, number>();
  for (const order of paid) {
    for (const item of JSON.parse(order.items_json) as { id: string; name?: string; quantity: number; price?: number; unitDrinks?: string[] }[]) {
      const key = item.name || item.id;
      const current = products.get(key) ?? { quantity: 0, revenue: 0 };
      products.set(key, { quantity: current.quantity + item.quantity, revenue: current.revenue + (item.price ?? 0) * item.quantity });
      for (const drink of item.unitDrinks ?? []) drinks.set(drink, (drinks.get(drink) ?? 0) + 1);
    }
  }
  const productRows = [...products].sort((a, b) => b[1].quantity - a[1].quantity);
  const maxProduct = Math.max(1, ...productRows.map(([, row]) => row.quantity));

  const hours = new Map<number, number>();
  for (const order of paid) { const hour = hourOf(order.paid_at!); hours.set(hour, (hours.get(hour) ?? 0) + 1); }
  const hourKeys = [...hours.keys()];
  const hourRange = hourKeys.length ? Array.from({ length: Math.max(...hourKeys) - Math.min(...hourKeys) + 1 }, (_, index) => Math.min(...hourKeys) + index) : [];
  const maxHour = Math.max(1, ...hours.values());

  const neighborhoods = new Map<string, { orders: number; revenue: number }>();
  for (const order of delivery) {
    const key = order.neighborhood?.trim() || "Sem bairro";
    const current = neighborhoods.get(key) ?? { orders: 0, revenue: 0 };
    neighborhoods.set(key, { orders: current.orders + 1, revenue: current.revenue + (order.total ?? 0) });
  }
  const neighborhoodRows = [...neighborhoods].sort((a, b) => b[1].orders - a[1].orders).slice(0, 8);

  const stages = new Map<string, number>();
  for (const order of orders) { const label = stageLabels[order.status] ?? order.status; stages.set(label, (stages.get(label) ?? 0) + 1); }

  function downloadCsv() {
    const header = ["Pedido", "Criado em", "Cliente", "Tipo", "Bairro", "Itens", "Hambúrgueres", "Subtotal", "Taxa", "Total", "Situação", "Pago em", "Pagamento"];
    const rows = orders.map(order => [order.id.slice(0, 8).toUpperCase(), new Date(order.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), order.name, order.method === "pickup" ? "Retirada" : "Delivery", order.neighborhood ?? "", itemsLabel(order), order.burger_count, (order.subtotal / 100).toFixed(2).replace(".", ","), ((order.delivery_fee ?? 0) / 100).toFixed(2).replace(".", ","), ((order.total ?? 0) / 100).toFixed(2).replace(".", ","), stageLabels[order.status] ?? order.status, order.paid_at ? new Date(order.paid_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "", order.payment_mode ?? ""]);
    const blob = new Blob(["﻿" + [header, ...rows].map(row => row.map(csvCell).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pedidos-${day}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <section className="report" aria-label={`Relatório de ${dayLabel(day)}`}>
    <header className="report-head">
      <div><p className="section-kicker">Relatório do dia</p><h2>{dayLabel(day)}</h2><p>{orders.length} {orders.length === 1 ? "pedido registrado" : "pedidos registrados"} · gerado em {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</p></div>
      <div className="report-actions"><button type="button" className="mini-button secondary" onClick={downloadCsv}><Download size={15} /> Planilha (CSV)</button><button type="button" className="mini-button" onClick={() => window.print()}><Printer size={15} /> Imprimir ou salvar PDF</button></div>
    </header>

    <div className="report-hero">
      <div className="report-total"><span>Arrecadado no dia</span><strong>{money(revenue)}</strong><small>Toda a renda vai para a compra de alimentos para instituições carentes.</small></div>
      <div className="report-burgers"><span>Hambúrgueres vendidos</span><strong>{burgers}<small> / {capacity}</small></strong><div className="progress-track"><div style={{ width: `${Math.min(100, burgers / Math.max(1, capacity) * 100)}%` }} /></div><small>{Math.max(0, capacity - burgers)} vagas restantes no limite do dia</small></div>
    </div>

    <dl className="report-kpis">
      <div><dt>Pedidos pagos</dt><dd>{paid.length}</dd><small>{conversion}% dos pedidos criados</small></div>
      <div><dt>Ticket médio</dt><dd>{money(average)}</dd><small>por pedido pago</small></div>
      <div><dt>Delivery</dt><dd>{delivery.length}</dd><small>{money(delivery.reduce((sum, order) => sum + (order.total ?? 0), 0))} · taxas {money(fees)}</small></div>
      <div><dt>Retirada</dt><dd>{pickup.length}</dd><small>{money(pickup.reduce((sum, order) => sum + (order.total ?? 0), 0))}</small></div>
      <div><dt>Aguardando pagamento</dt><dd>{pending.length}</dd><small>{money(pending.reduce((sum, order) => sum + (order.total ?? order.subtotal), 0))} em aberto</small></div>
      <div><dt>Expirados · devolvidos</dt><dd>{expired.length} · {refunded.length}</dd><small>{refunded.length ? `${money(refunded.reduce((sum, order) => sum + (order.total ?? 0), 0))} devolvidos` : "nenhuma devolução"}</small></div>
    </dl>

    <div className="report-grid">
      <article className="report-card">
        <h3>Produtos vendidos</h3>
        {productRows.length === 0 ? <p className="report-empty">Nenhum pedido pago neste dia.</p> : <table className="report-bars">
          <thead><tr><th scope="col">Produto</th><th scope="col">Qtd.</th><th scope="col">Valor</th></tr></thead>
          <tbody>{productRows.map(([name, row]) => <tr key={name} title={`${name}: ${row.quantity} un. · ${money(row.revenue)}`}>
            <th scope="row"><span>{name}</span><i style={{ width: `${row.quantity / maxProduct * 100}%` }} aria-hidden="true" /></th><td>{row.quantity}</td><td>{money(row.revenue)}</td>
          </tr>)}</tbody>
        </table>}
        {drinks.size > 0 && <p className="report-note">Bebidas dos combos: {[...drinks].sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} ${count}`).join(" · ")}</p>}
      </article>

      <article className="report-card">
        <h3>Pagamentos por hora</h3>
        {hourRange.length === 0 ? <p className="report-empty">Os pagamentos aparecem aqui conforme forem confirmados.</p> : <>
          <div className="report-hours" role="img" aria-label={`Pedidos pagos por hora: ${hourRange.map(hour => `${hour}h ${hours.get(hour) ?? 0}`).join(", ")}`}>
            {hourRange.map(hour => { const count = hours.get(hour) ?? 0; return <div key={hour} className="report-hour" title={`${hour}h às ${hour + 1}h: ${count} ${count === 1 ? "pedido" : "pedidos"}`}>
              <b>{count === maxHour && count > 0 ? count : ""}</b><i style={{ height: `${count / maxHour * 100}%` }} /><span>{hour}h</span>
            </div>; })}
          </div>
          <p className="report-note">Pico às {[...hours].sort((a, b) => b[1] - a[1])[0][0]}h, com {maxHour} {maxHour === 1 ? "pedido pago" : "pedidos pagos"}.</p>
        </>}
      </article>

      <article className="report-card">
        <h3>Delivery por bairro</h3>
        {neighborhoodRows.length === 0 ? <p className="report-empty">Nenhum delivery pago neste dia.</p> : <table className="report-table">
          <thead><tr><th scope="col">Bairro</th><th scope="col">Pedidos</th><th scope="col">Valor</th></tr></thead>
          <tbody>{neighborhoodRows.map(([name, row]) => <tr key={name}><th scope="row">{name}</th><td>{row.orders}</td><td>{money(row.revenue)}</td></tr>)}</tbody>
        </table>}
      </article>

      <article className="report-card">
        <h3>Situação dos pedidos</h3>
        {stages.size === 0 ? <p className="report-empty">Nenhum pedido neste dia.</p> : <ul className="report-stages">
          {[...stages].sort((a, b) => b[1] - a[1]).map(([label, count]) => <li key={label}><span>{label}</span><b>{count}</b></li>)}
        </ul>}
      </article>
    </div>
  </section>;
}
