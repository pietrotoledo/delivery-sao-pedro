# Pendências

## Incluir no cardápio

- [x] Batata frita pequena — R$ 8,00.
- [x] Batata frita grande — R$ 12,00.
- [x] Água mineral — R$ 3,50.

## Conferir preços dos itens atuais

Valores sugeridos para os itens cujo preço não foi informado:

- [x] Hambúrguer Clássico — R$ 22,00.
- [x] Hambúrguer Bacon — R$ 27,00.
- [x] Coca-Cola lata 350 ml — R$ 6,00.
- [x] Coca-Cola Zero lata 350 ml — R$ 6,00.

## Personalização dos hambúrgueres

- [x] Permitir que o cliente personalize o hambúrguer apenas removendo ingredientes existentes, por exemplo: **sem cebola** ou **sem salada**.
- [x] Não permitir adicionar ingredientes ou porções extras (como outro hambúrguer, queijo, bacon etc.).
- [x] Exibir as remoções escolhidas no carrinho e nos detalhes do pedido para a equipe de preparo.

Os ingredientes são lidos da descrição do produto (separados por vírgula e "e"); ao cadastrar um hambúrguer, escreva a descrição como lista de ingredientes. A remoção vale para todas as unidades do mesmo hambúrguer no pedido; diferenças entre unidades vão na observação.

## Antes de publicar as vendas

- [ ] Confirmar os preços sugeridos antes da venda real (o cardápio do site já foi atualizado).
- [ ] Conferir disponibilidade e tamanho das porções e bebidas.
- [ ] Substituir as fotos ilustrativas por fotos dos produtos reais quando estiverem disponíveis.

## Confirmações de pedidos

- [ ] Escolher e configurar um provedor de mensagens para WhatsApp e outro para e-mail, com credenciais separadas por ambiente.
- [ ] Definir as mensagens de confirmação após o pagamento: número do pedido, itens, total, retirada ou entrega e link de acompanhamento.
- [ ] Enviar as confirmações apenas quando o pagamento for verificado, inclusive para pedidos com taxa de entrega. O pedido criado ou o link Pix aberto ainda não representam pagamento confirmado.
- [ ] Registrar o resultado de cada envio e impedir duplicações quando o webhook ou a verificação do pagamento forem repetidos.
- [ ] Testar envio, falha, nova tentativa e os dados de contato em ambiente de teste antes de ativar em produção.

O checkout já coleta e salva o e-mail e o WhatsApp. O envio automático ainda depende da integração dos provedores acima.
