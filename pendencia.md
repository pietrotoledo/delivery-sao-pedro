# Pendências para confirmações de pedidos

- [ ] Escolher e configurar um provedor de mensagens para WhatsApp e outro para e-mail, com credenciais separadas por ambiente.
- [ ] Definir as mensagens de confirmação após o pagamento: número do pedido, itens, total, retirada ou entrega e link de acompanhamento.
- [ ] Enviar as confirmações apenas quando o pagamento for verificado, inclusive para pedidos com taxa de entrega. O pedido criado ou o link Pix aberto ainda não representam pagamento confirmado.
- [ ] Registrar o resultado de cada envio e impedir duplicações quando o webhook ou a verificação do pagamento forem repetidos.
- [ ] Testar envio, falha, nova tentativa e os dados de contato em ambiente de teste antes de ativar em produção.

O checkout já coleta e salva o e-mail e o WhatsApp. O envio automático ainda depende da integração dos provedores acima.
