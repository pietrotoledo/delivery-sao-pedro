# Privacidade: implantação e pendências

Implementado em 16/10/2026: páginas `/privacidade`, `/cookies` e `/termos`, links globais e no checkout, aviso informativo sobre armazenamento essencial e autorização opcional de WhatsApp. Apenas `whatsappOptIn: true` grava a opção ativa. A fila existente consulta essa opção antes de enviar WhatsApp. Nenhum rastreador opcional foi introduzido.

O fechamento do aviso não representa consentimento para rastreamento ou tratamento de todos os dados. A interface usa um ícone discreto de fechar com nome acessível e alvo de toque de 44 px. Seu fechamento é guardado em um cookie de preferência versionado, por até 180 dias, com `SameSite=Lax`, `Path=/` e `Secure` em HTTPS. Preferências antigas em `localStorage` continuam sendo respeitadas. Novas ferramentas de análise ou publicidade exigem revisão do inventário e mecanismo adequado antes da ativação.

## Informações aguardadas da organização

O usuário pediu expressamente para deixar pendente a identificação e o contato. As páginas tornam essa ausência visível, sem inventar documentos, e-mails ou endereços.

- Nome/razão social do fornecedor e do responsável pelo tratamento; CPF/CNPJ quando aplicável; endereço e canal de atendimento/privacidade.
- Prazo de retenção, obrigações fiscais aplicáveis e rotina efetiva de descarte, inclusive cópias e registros nos fornecedores.
- Processo para acesso, correção, eliminação, revogação da autorização de WhatsApp e cancelamento de compra. O painel já permite remover dados de contato, mas não há portal público de solicitações ou prazo automático de exclusão.
- Verificação de contratos, operadores/suboperadores, localização dos dados e salvaguardas de transferências internacionais dos fornecedores realmente utilizados.
- Registro comprobatório da autorização de mensagens com versão do texto e data; hoje o pedido mantém a opção booleana e a data de criação, sem histórico separado de consentimentos.

Essas pendências impedem afirmar conformidade integral. A documentação pública deve ser completada quando os dados forem fornecidos.

## Referências consultadas

- LGPD: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Guia de cookies da ANPD: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais
- CDC: https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
- Decreto 7.962/2013: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm
