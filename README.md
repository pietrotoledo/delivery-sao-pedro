# BLUECKYARDIGANS

Pré-venda da Noite do Hambúrguer de 29 de outubro de 2026, das 18h às 22h.

## O que está pronto

- Loja responsiva com dois hambúrgueres, duas bebidas, retirada e entrega.
- Taxa de entrega definida no painel antes de liberar o Pix ao cliente.
- Painel de pedidos com aviso na capacidade, pausa manual, aumento de vagas, preparo e entrega.
- Continuação das vendas após 100 hambúrgueres, com aviso de disponibilidade ao comprador.
- Integração preparada para Checkout InfinitePay com link por pedido, webhook e verificação de pagamento Pix.
- Modo de demonstração quando `INFINITEPAY_HANDLE` não está configurada. Nenhum dinheiro é cobrado nesse modo.

## Configuração para vendas reais

1. Confirme tamanho e preço das bebidas. Os R$ 6 das latas são fictícios.
2. Ative o Checkout Integrado da InfinitePay na conta que receberá os valores.
3. Configure a conta para aceitar somente Pix. A seleção das formas de pagamento é feita na InfinitePay.
4. Defina `INFINITEPAY_HANDLE` e `ADMIN_PASSWORD` nas variáveis de ambiente do Site, nunca no código.
5. Publique o Site para compradores e teste uma compra real de baixo valor, webhook, painel e devolução.
6. A hospedagem privada serve para demonstração. O webhook externo e os compradores precisam de acesso público na versão de vendas; antes de abrir o acesso, mantenha `ADMIN_PASSWORD` configurada.

O painel **registra** uma devolução depois que a equipe a executa na InfinitePay. Ele não movimenta dinheiro para devolver Pix automaticamente.

## Desenvolvimento

```sh
npm ci
npm run db:generate
npm run dev
```

A migração inicial está em `drizzle/`. O ambiente local de Sites usa D1 local; o banco de produção é separado.

## Vercel

O arquivo `vercel.json` prepara a identificação do projeto como Next.js e seleciona o build nativo da Vercel. O sistema atual ainda usa `cloudflare:workers` e D1 para pedidos e pagamentos; por isso, esse arquivo sozinho **não torna o checkout e o painel operacionais na Vercel**. Antes de publicar por lá, será necessário migrar o armazenamento e as variáveis de ambiente do servidor para recursos compatíveis com Vercel.

## Regras de operação

- O contador soma hambúrgueres pagos, não bebidas nem pedidos aguardando pagamento.
- A ordem de prioridade é a confirmação do pagamento.
- O painel alerta ao atingir a capacidade e mantém a compra aberta até a equipe pausar.
- Uma devolução registrada sai do contador e libera vaga.
- Um link de pedido contém um identificador aleatório; compartilhe apenas com o comprador.
