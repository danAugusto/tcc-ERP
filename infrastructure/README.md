# Infraestrutura — homologação e deploy

| Arquivo | Função |
|---|---|
| `../docker-compose.yml` | Ambiente de **desenvolvimento** (hot reload, usuários de demonstração) |
| `../docker-compose.prod.yml` | Stack de **homologação/produção**: Caddy → Next.js + Django (gunicorn) → PostgreSQL |
| `../.env.prod.example` | Modelo das variáveis da stack de produção |
| `../backend/.env.example` | Variáveis do backend (referência) |
| `Caddyfile` | Proxy reverso: `/api`, `/admin`, `/static` → Django; `/media` → volume de uploads; resto → Next.js |
| `backup.sh` | Backup do banco + uploads, com retenção |

Fluxo de CI: `.github/workflows/backend-checks.yml` (backend: `check` + testes; frontend: typecheck + build).

## Homologação em uma VM local (sem custo)

1. Crie uma VM Ubuntu Server (VirtualBox/VMware/KVM) com rede em **modo bridge**, para ela ter IP na sua LAN (ex.: `192.168.0.50`).
2. Instale o Docker: `curl -fsSL https://get.docker.com | sh` e `sudo usermod -aG docker $USER` (reabra a sessão).
3. Copie o projeto para a VM (`git clone` ou `rsync`) e, na raiz:
   ```bash
   cp .env.prod.example .env
   python3 -c "import secrets; print(secrets.token_urlsafe(50))"   # use como SECRET_KEY
   nano .env   # SECRET_KEY, POSTGRES_PASSWORD, ADMIN_PASSWORD e ALLOWED_HOSTS=localhost,127.0.0.1,192.168.0.50
   ```
4. Suba a stack:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   docker compose -f docker-compose.prod.yml ps        # todos "running"/"healthy"
   ```
5. Acesse `http://192.168.0.50` de outro dispositivo da rede e entre com `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
   Health check: `http://192.168.0.50/api/health/` → `{"status": "ok"}`.

### HTTPS na LAN (necessário para testar o PWA/service worker)
No `.env`: `SITE_ADDRESS=https://192.168.0.50`, `TLS_DIRECTIVE=tls internal`, `USE_HTTPS=True`,
`CSRF_TRUSTED_ORIGINS=https://192.168.0.50`. O Caddy emite um certificado de uma CA interna; para
o navegador/celular confiar, exporte `/data/caddy/pki/authorities/local/root.crt` do volume `caddy_data`
e instale-o como certificado confiável.

### Produção com domínio
`SITE_ADDRESS=erp.exemplo.com`, `TLS_DIRECTIVE` vazio (Let's Encrypt automático), portas 80/443 abertas,
`USE_HTTPS=True`, `CSRF_TRUSTED_ORIGINS=https://erp.exemplo.com`, `ALLOWED_HOSTS=erp.exemplo.com`.

## Operação

```bash
docker compose -f docker-compose.prod.yml logs -f backend     # logs
docker compose -f docker-compose.prod.yml up -d --build        # atualizar versão (migrations rodam no start)
./infrastructure/backup.sh                                      # backup (agende no cron: 0 3 * * *)
```

Restauração do banco: ver a mensagem impressa ao final do `backup.sh`. **Teste uma restauração antes de ir ao cliente.**

## Segurança — resumo
- `DEBUG=False` por padrão; `SECRET_KEY` obrigatória; hosts/CORS/CSRF explícitos.
- Usuários de demonstração **só** com `SEED_DEMO_USERS=true` (compose de desenvolvimento). Em produção, o primeiro administrador vem de `ADMIN_USERNAME`/`ADMIN_PASSWORD` e a senha nunca é sobrescrita.
- Postgres não é exposto fora da rede interna do Docker.
- Limite de tentativas: login `10/min`, cadastro `10/hora` por IP (`THROTTLE_AUTH`, `THROTTLE_REGISTER`).
- Uploads de imagem: JPG/PNG/WebP validados com Pillow, até 5 MB.
