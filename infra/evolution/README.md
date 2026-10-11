# Evolution API local

Esta pasta roda a Evolution API com PostgreSQL e Redis no Docker Desktop. O banco, o cache e as sessões ficam em volumes Docker. A API escuta somente em `127.0.0.1:8080`.

## Operação

No terminal, dentro desta pasta:

```sh
docker compose up -d
docker compose ps
docker compose logs -f evolution
```

Abra `http://localhost:8080` para conferir a API e `http://localhost:8080/manager` para administrar a instância `sao-pedro` e conectar o WhatsApp pelo QR code. Para parar os serviços, use `docker compose down`. **Não use `docker compose down -v`**, pois isso apaga os volumes e as sessões.

O arquivo `.env` desta pasta contém a senha do banco e a chave da API. Ele é ignorado pelo Git. Guarde uma cópia privada; se for perdido, não será possível recuperar a chave atual da API. Não compartilhe o arquivo em mensagens ou capturas de tela.

## Integração com o site

O site publicado na Cloudflare precisa de uma URL HTTPS pública para chamar a Evolution. `localhost` só funciona neste computador. Um túnel rápido da Cloudflare (`trycloudflare.com`) permite testar, mas seu endereço muda quando o túnel reinicia e não serve como endereço permanente. Para um endereço estável com Cloudflare Tunnel, use um domínio próprio gerenciado na Cloudflare.

Para iniciar o túnel temporário: `docker compose --profile tunnel up -d tunnel`. Encontre a URL com `docker compose logs tunnel`. A URL fica pública enquanto o túnel estiver em execução; mantenha a chave da API em segredo.

Depois de ter uma URL estável, configure no Worker do site os segredos `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE`. O nome da instância deve corresponder à instância conectada no Evolution Manager.
