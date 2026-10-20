import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = { title: "Termos de compra | BLUECKYARDIGANS" };

export default function TermsPage() {
  return <LegalPage title="Termos de compra" intro="Informações sobre pedidos, pagamento, entrega e atendimento da Noite do Hambúrguer.">
    <section><h2>Organização e atendimento</h2><p>O site é destinado aos pedidos do evento BLUECKYARDIGANS em 30 de outubro de 2026. A identificação completa do fornecedor e os canais de atendimento ainda estão pendentes de informação pela organização, como registrado na <Link href="/privacidade">Política de Privacidade</Link>.</p></section>
    <section><h2>Confira antes de pagar</h2><p>Revise produtos, quantidades, bebidas, personalizações, contatos e modalidade de recebimento. Os valores são apresentados em reais. Para entrega, a taxa e o total aparecem no checkout conforme a área atendida. Disponibilidade e condições são as exibidas no momento da compra.</p><p>Informe um nome com pelo menos três caracteres, telefone e e-mail válidos. O campo de observações não substitui a confirmação de restrições alimentares com a organização. Consulte os ingredientes informados no cardápio.</p></section>
    <section><h2>Pagamento e confirmação</h2><p>O link de pagamento é gerado pela InfinitePay. O pedido passa a constar como pago após confirmação do provedor; apenas abrir o link não confirma o pagamento. Guarde o comprovante e o link de acompanhamento.</p></section>
    <section><h2>Entrega e retirada</h2><p>Confira a data, o horário, a cobertura de entrega e o endereço de retirada exibidos no site e no pedido. A conferência do recebimento utiliza os quatro últimos dígitos do telefone informado. Mantenha o endereço e as referências corretos.</p></section>
    <section><h2>Cancelamento e direitos do consumidor</h2><p>São preservados os direitos previstos no Código de Defesa do Consumidor, inclusive correção de falhas, informação adequada e arrependimento nas hipóteses legais aplicáveis. Nenhuma disposição desta página elimina esses direitos.</p><p>Solicitações de alteração, cancelamento ou restituição devem ser tratadas com a organização, informando o código do pedido. O canal público de atendimento ainda está pendente de publicação. O registro de devolução no painel não equivale, por si só, ao estorno financeiro pelo provedor.</p></section>
    <section><h2>Privacidade</h2><p>Os dados necessários à compra são tratados conforme a <Link href="/privacidade">Política de Privacidade</Link>. A autorização de mensagens por WhatsApp é obrigatória para finalizar o pedido e vale somente para este pedido e evento.</p></section>
    <section><h2>Legislação de referência</h2><ul><li><a href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" target="_blank" rel="noreferrer">Lei nº 8.078/1990 — Código de Defesa do Consumidor</a>.</li><li><a href="https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm" target="_blank" rel="noreferrer">Decreto nº 7.962/2013 — comércio eletrônico</a>.</li><li><a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" target="_blank" rel="noreferrer">Lei nº 13.709/2018 — LGPD</a>.</li></ul></section>
  </LegalPage>;
}
