# Plano de notificações dos pedidos

Atualizado em 8 de outubro de 2026. O envio por WhatsApp via Evolution API foi preparado no código e só funciona após a configuração de uma instância. O envio por e-mail permanece como proposta.

## Fluxo atual

- O site cria um link de checkout Pix da InfinitePay para cada pedido. Na entrega, ele fica disponível depois de a equipe definir a taxa.
- A InfinitePay chama o webhook após o pagamento. O servidor consulta `payment_check` e só marca o pedido como pago quando confirma Pix e valor correto.
- A página `/pedido/{id}` permite ao comprador acompanhar as mudanças de estado.

## Avisos automáticos via Evolution API

O comprador pode aceitar avisos pelo WhatsApp no checkout quando a integração estiver configurada. A loja registra uma mensagem por evento e pedido para reduzir envios repetidos. Ela tenta enviar em segundo plano e registra se a Evolution aceitou a mensagem ou retornou erro. Falhas são repetidas quando o painel admin está aberto. O estado do pedido não depende do WhatsApp.

Eventos: Pix disponível; pagamento confirmado; em preparo; pronto; saiu para entrega; concluído. O link Pix é enviado apenas depois de gerado pela InfinitePay. O pagamento é comunicado somente depois da verificação pelo `payment_check`.

Configure estes segredos de runtime no Worker da Cloudflare, sem gravar valores no Git:

| Nome | Valor |
| --- | --- |
| `EVOLUTION_API_URL` | URL pública HTTPS da Evolution API, sem barra final |
| `EVOLUTION_API_KEY` | Chave de API da Evolution |
| `EVOLUTION_INSTANCE` | Nome da instância conectada ao WhatsApp |

A Evolution API precisa estar instalada em um servidor próprio e a instância precisa estar conectada. A integração usa `POST /message/sendText/{instanceName}` com `apikey` no cabeçalho. O site continua funcionando se a Evolution ficar indisponível; o painel mostra a falha e tenta novamente enquanto estiver aberto. O HTTP aceito pela Evolution não comprova entrega no aparelho do cliente.

## Melhorias futuras

1. Adicionar um gatilho agendado para tentar novamente mesmo com o painel admin fechado.
2. Receber confirmação de entrega por webhook da Evolution, distinguindo mensagem aceita pela API de mensagem entregue no WhatsApp.
3. Adicionar e-mail automático como segundo canal.

## Canais e custo

| Canal | Proposta | Limite ou condição |
| --- | --- | --- |
| Página do pedido | Fonte principal do estado do pedido, atualizada automaticamente | Já existe no site |
| E-mail automático | Resend para link Pix e mudanças importantes de estado | Plano gratuito anunciado: 100 e-mails/dia e 3.000/mês; requer domínio de envio verificado |
| WhatsApp com ação humana | Botão no painel que abre uma mensagem pronta no WhatsApp Business | Não é envio automático; a equipe precisa conferir e tocar em enviar |
| WhatsApp automático oficial | WhatsApp Business Platform/Cloud API com modelos de mensagem de utilidade | Exige permissão do cliente, modelos aprovados e pode cobrar por mensagem entregue |

O plano gratuito do Resend não garante domínio gratuito: é preciso ter um domínio próprio para verificar o remetente. Configurar `RESEND_API_KEY` e o endereço de origem como segredos no Cloudflare, sem colocá-los no Git ou no navegador.

Para a API oficial do WhatsApp, obter consentimento explícito no checkout para avisos do pedido, guardar esse consentimento, cadastrar número comercial, criar modelos de utilidade aprovados e configurar as credenciais no Cloudflare. Segundo a FAQ atual da Meta, desde 1º de outubro de 2026 há cobrança por mensagem de serviço depois das primeiras 1.000 por número/mês; essa franquia de serviço não transforma os avisos de pedido iniciados pela loja, classificados como utilidade, em mensagens gratuitas.

## Ferramentas de código aberto para WhatsApp

- **Baileys:** biblioteca TypeScript que se conecta ao protocolo do WhatsApp Web por WebSocket.
- **WPPConnect Server:** servidor Node.js/Docker com API para automatizar WhatsApp Web.

Esses projetos têm código aberto, mas não são a API oficial da Meta. A licença gratuita do software não garante envio gratuito, estável ou autorizado. Precisam de uma sessão do WhatsApp Web e de um processo/servidor que permaneça ativo; não são uma substituição direta da API oficial dentro deste Cloudflare Worker. Os termos do WhatsApp Business App restringem aplicações que interagem com o aplicativo sem autorização prévia, e a Meta pode limitar o acesso por uso não autorizado. Para avisos essenciais de pagamento e entrega, acompanhe as falhas no painel e mantenha a página de acompanhamento disponível ao comprador.

**Escolha atual:** Evolution API. Ela aceita tanto uma instância Baileys quanto uma instância ligada à Cloud API oficial. A loja usa a mesma interface de envio para as duas; o custo e as regras do WhatsApp dependem do tipo da instância.

## Referências

- [Checkout e webhook InfinitePay](https://www.infinitepay.io/checkout-documentacao)
- [Plano gratuito do Resend](https://resend.com/pricing)
- [Política de mensagens do WhatsApp Business](https://whatsappbusiness.com/policy/)
- [Preços e franquia de serviço da Meta](https://whatsappbusiness.com/resources/faq/)
- [Baileys](https://github.com/WhiskeySockets/Baileys)
- [WPPConnect Server](https://github.com/wppconnect-team/wppconnect-server)
- [Termos do WhatsApp Business App](https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App)
- [Evolution API](https://github.com/evolution-foundation/evolution-api)
