# BLUECKYARDIGANS

Plano futuro de avisos de Pix e atualizações: [notificações dos pedidos](docs/notificacoes-pedidos.md).

Pré-venda da Noite do Hambúrguer de 29 de outubro de 2026, das 18h às 22h.

## O que está pronto

- Loja responsiva com dois hambúrgueres, batata frita em dois tamanhos, água, refrigerantes, retirada e entrega.
- Taxa de entrega definida no painel antes de liberar o Pix ao cliente.
- Painel de pedidos com aviso na capacidade, pausa manual, aumento de vagas, preparo e entrega.
- Painel de produtos com quantidade opcional por item e envio de fotos já cortadas (JPG, PNG, WebP ou AVIF, até 900 KB). A quantidade é reservada ao criar o pedido; deixe o campo vazio para não limitar ou use zero para marcar esgotado. Pedidos abandonados ou reembolsados não devolvem a reserva automaticamente; ajuste a quantidade no painel quando necessário.
- Continuação das vendas após 100 hambúrgueres, com aviso de disponibilidade ao comprador.
- Integração preparada para Checkout InfinitePay com link por pedido, webhook e verificação de pagamento Pix.
- No painel, o filtro "Aguardando pagamento" reúne pedidos pendentes. A equipe pode confirmar manualmente um valor já recebido, informando uma referência; essa ação não cobra o cliente.
- Modo de demonstração quando `INFINITEPAY_HANDLE` não está configurada. Nenhum dinheiro é cobrado nesse modo.

## Configuração para vendas reais

1. Confirme os preços sugeridos dos hambúrgueres e refrigerantes e o tamanho das porções e bebidas antes da venda real.
2. Ative o Checkout Integrado da InfinitePay na conta que receberá os valores.
3. Configure a conta para aceitar somente Pix. A seleção das formas de pagamento é feita na InfinitePay.
4. Defina `INFINITEPAY_HANDLE` e `ADMIN_PASSWORD` nas variáveis de ambiente do Site, nunca no código.
5. Publique o Site para compradores e teste uma compra real de baixo valor, webhook, painel e devolução.
6. A hospedagem privada serve para demonstração. O webhook externo e os compradores precisam de acesso público na versão de vendas; antes de abrir o acesso, mantenha `ADMIN_PASSWORD` configurada.

O painel **registra** uma devolução depois que a equipe a executa na InfinitePay. Ele não movimenta dinheiro para devolver Pix automaticamente.
Antes de usar "Confirmar pagamento manual", confira o recebimento na conta InfinitePay ou no extrato Pix. O registro manual fica identificado no pedido e não substitui a cobrança nem cancela um link de pagamento existente.

## Desenvolvimento

```sh
npm ci
npm run db:generate
npm run dev
```

A migração inicial está em `drizzle/`. O ambiente local de Sites usa D1 local; o banco de produção é separado.

## Vercel

O arquivo `vercel.json` prepara a identificação do projeto como Next.js e seleciona o build nativo da Vercel. O sistema atual ainda usa `cloudflare:workers` e D1 para pedidos e pagamentos; por isso, esse arquivo sozinho **não torna o checkout e o painel operacionais na Vercel**. Antes de publicar por lá, será necessário migrar o armazenamento e as variáveis de ambiente do servidor para recursos compatíveis com Vercel.

## Cloudflare Workers com GitHub

Crie um **Worker** (não Pages) ligado a este repositório e um banco D1 chamado `sao-pedro-delivery`. Configure no projeto:

- Build command: `npm run build:cloudflare`
- Deploy command: `npm run deploy:cloudflare`
- O ID do banco D1 `sao-pedro-delivery` já está configurado no build. `CLOUDFLARE_D1_DATABASE_ID` pode substituí-lo se o banco mudar.
- Variável de build opcional `CLOUDFLARE_WORKER_NAME`: nome exato do Worker na Cloudflare; padrão `delivery-sao-pedro`.

O comando de deploy aplica as migrações D1 pendentes antes de publicar o Worker. A Cloudflare deve fornecer acesso para o Wrangler executar o deploy.
Mesmo que o painel ainda use o comando padrão `npm run build`, o ambiente Workers Builds gera a configuração do Worker com o D1 real. Para criar as tabelas automaticamente, use `npm run deploy:cloudflare` como comando de deploy.

Para uma versão pública com vendas reais, configure também os segredos de runtime `ADMIN_PASSWORD` e `INFINITEPAY_HANDLE` e habilite apenas Pix na InfinitePay. Não compartilhe a senha nem credenciais por GitHub. Enquanto `INFINITEPAY_HANDLE` não estiver configurada, o site fica em modo de demonstração.

## Regras de operação

- O contador soma hambúrgueres pagos, não bebidas nem pedidos aguardando pagamento.
- A ordem de prioridade é a confirmação do pagamento.
- O painel alerta ao atingir a capacidade e mantém a compra aberta até a equipe pausar.
- Uma devolução registrada sai do contador e libera vaga.
- Um link de pedido contém um identificador aleatório; compartilhe apenas com o comprador.
