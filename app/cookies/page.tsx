import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = { title: "Cookies e armazenamento | BLUECKYARDIGANS" };

export default function CookiesPage() {
  return <LegalPage title="Cookies e armazenamento" intro="O que esta aplicação guarda no navegador e para qual finalidade.">
    <section><h2>Somente recursos essenciais</h2><p>Esta versão não integra ferramentas de análise de navegação, pixels de publicidade ou personalização de anúncios. Usamos cookies para autenticar a equipe e armazenamento local para manter o carrinho e o andamento do pedido. O aviso de privacidade é informativo: clicar em “Entendi” apenas fecha o aviso.</p><p>Recursos estritamente necessários não dependem de um aceite genérico de cookies. Se ferramentas opcionais forem adicionadas, será necessário informar as finalidades e oferecer as escolhas apropriadas antes de ativá-las.</p></section>
    <section><h2>Inventário da aplicação</h2><div className="legal-table-wrap"><table><caption>Armazenamento gerenciado pelo site</caption><thead><tr><th scope="col">Recurso</th><th scope="col">Finalidade</th><th scope="col">Duração</th></tr></thead><tbody>
      <tr><th scope="row"><code>blueck_admin</code></th><td>Cookie de autenticação da administração; criado ao entrar na área restrita.</td><td>Até 7 dias no navegador.</td></tr>
      <tr><th scope="row"><code>blueck_delivery</code></th><td>Cookie de autenticação dos entregadores; criado após o login.</td><td>Até 12 horas.</td></tr>
      <tr><th scope="row">Carrinho e escolhas</th><td><code>sessionStorage</code>: itens, bebidas, personalizações e ponto de retorno ao cardápio.</td><td>Durante a sessão da aba, até limpeza ou encerramento da sessão pelo navegador.</td></tr>
      <tr><th scope="row"><code>blueckyardigans-order-attempt</code></th><td><code>sessionStorage</code>: dados do formulário e chave da tentativa, para evitar pedidos duplicados ao tentar novamente.</td><td>Removido após a criação do pedido; também termina com a sessão da aba.</td></tr>
      <tr><th scope="row"><code>blueckyardigans-privacy-notice-v1</code></th><td><code>localStorage</code>: registra apenas que o aviso foi fechado, sem dados do pedido.</td><td>Até limpar os dados do site ou mudar a versão do aviso.</td></tr>
    </tbody></table></div></section>
    <section><h2>Serviços externos</h2><p>A infraestrutura de hospedagem pode usar recursos técnicos de segurança. Ao abrir InfinitePay, Google Maps ou outros serviços externos, você passa a acessar ambientes com políticas próprias. A consulta do CEP é feita ao ViaCEP. Este inventário descreve o armazenamento gerenciado pelo código da aplicação.</p></section>
    <section><h2>Como gerenciar</h2><p>Você pode apagar cookies e dados deste site nas configurações do navegador. Isso pode encerrar o acesso da equipe, limpar o carrinho e fazer o aviso aparecer novamente. Bloquear armazenamento essencial pode impedir algumas funções.</p><p>Veja também a <Link href="/privacidade">Política de Privacidade</Link> e o <a href="https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais" target="_blank" rel="noreferrer">guia da ANPD sobre cookies e proteção de dados pessoais</a>.</p></section>
  </LegalPage>;
}
