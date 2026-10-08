# Ultrareview — branch main

Revisão das mudanças no checkout (sugestões de produtos e personalização por remoção de ingredientes). 10 arquivos, +60 / −35.

## 1. Remoções de ingredientes se perdem ao sair do checkout — normal · ✅ corrigido

**Arquivo:** `components/checkout.tsx` (linhas 28–122)

As remoções escolhidas ficam só no estado local (`removed`). A URL e o `sessionStorage` guardam apenas as quantidades (`quantities`).

**Cenário:** o cliente marca "sem alface" e "sem tomate", clica em "Adicionar mais itens do cardápio", escolhe uma batata e volta ao checkout. As quantidades voltam, mas as remoções são zeradas sem aviso. Se ele não marcar tudo de novo, o pedido sai sem a personalização.

**Correção sugerida:** salvar `removed` junto com o carrinho no `sessionStorage` e restaurar ao montar o checkout.

## 2. Edição da descrição no admin invalida remoções já escolhidas — nit · ✅ corrigido

**Arquivo:** `app/api/orders/route.ts` (linhas 32–34)

O checkout carrega o cardápio uma única vez. O servidor valida as remoções contra a descrição **atual** do produto. Se o admin mudar a redação da descrição enquanto um cliente está no checkout, o pedido é recusado com "Só é possível remover ingredientes do próprio hambúrguer.".

**Impacto:** baixo e recuperável, porque recarregar a página resolve. Pode ser tratado com uma mensagem pedindo para atualizar a página, como já acontece quando o preço muda.

## 3. Batata grande aparece duas vezes nas sugestões — nit · ✅ corrigido

**Arquivo:** `components/checkout.tsx` (linhas 94–95)

Com a batata pequena no carrinho, aparecem ao mesmo tempo o card "Adicionar" da batata grande e o card "Prefere batata grande? Trocar". São dois caminhos parecidos, e o cliente pode ficar em dúvida se vai receber uma ou duas batatas.

**Correção sugerida:** quando a troca estiver disponível, esconder a batata grande da lista de sugestões.

## 4. Sugestões sem limite de quantidade — nit · mantido de propósito

**Arquivo:** `components/checkout.tsx` (linhas 97–99)

O limite de 2 sugestões por categoria foi removido. Com mais produtos cadastrados no admin, o bloco "Complete seu pedido" cresce sem limite.

**Observação:** isso foi pedido de propósito ("quero que todos apareçam"). Só faz sentido mudar se o cardápio crescer muito.
