# Proteções de acesso

- A sessão administrativa usa HMAC, um identificador aleatório por login e validade absoluta de 12 horas, conferida no servidor. A atualização invalida os cookies administrativos antigos; a equipe precisa entrar novamente. Alterar `ADMIN_PASSWORD` também invalida as sessões existentes.
- Cookies continuam com HttpOnly e SameSite=Strict, além de Secure quando servidos por HTTPS.
- Alterações pelas APIs do site exigem `Origin` igual ao endereço da aplicação e recusam `Sec-Fetch-Site: cross-site`. Integrações próprias devem enviar o Origin correto. O webhook InfinitePay tem validação de pagamento separada e não depende desse teste.
- Cada perfil (admin ou entregador) permite 10 tentativas de login por endereço em uma janela fixa de 10 minutos. O contador é atômico no D1, compartilhado entre instâncias, e usa um resumo SHA-256 do endereço informado pelo cabeçalho confiável `CF-Connecting-IP` da Cloudflare. Fora da Cloudflare, pedidos sem esse cabeçalho compartilham o contador local. Não exponha esse servidor diretamente com cabeçalhos de proxy não confiáveis.
- A migração `0005_login_attempts.sql` cria a tabela de limites. O código também cria a tabela quando necessário para compatibilidade com ambientes anteriores. Contadores expiram logicamente pela janela; as linhas permanecem para reutilização por endereço.
- O Worker adiciona proteção contra incorporação em frames, interpretação incorreta de MIME e vazamento de URL por Referer. Páginas de pedidos, equipe e administração não devem ser indexadas ou armazenadas em cache. O cache de fotos públicas é preservado.
- A política CSP atual restringe frames, objetos e URL base. Ela não restringe scripts inline do framework; não representa uma proteção completa contra XSS.

## Verificação

Execute `node --test tests/security.test.mjs`, a suíte completa, `npx tsc --noEmit --incremental false`, `npm audit --omit=dev` e o build antes de publicar. O relatório de dependências reflete os avisos conhecidos na data da consulta, não uma garantia de ausência de vulnerabilidades.

O limite de login protege a autenticação, mas faz uma gravação de contagem no D1 por tentativa e chamadas que chegam ao Worker continuam contando como invocações. Proteções antes do Worker, como regras de borda, dependem da configuração da conta Cloudflare.

Referência utilizada: [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Referências da própria Cloudflare: [exemplo de cabeçalhos no repositório cloudflare-docs](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/examples/security-headers.mdx) e [limites dentro do Worker](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/). O limiter nativo é aproximado por localidade; esta aplicação usa D1 para manter uma contagem atômica compartilhada entre localidades.
