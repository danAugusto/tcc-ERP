#!/usr/bin/env bash
# APS 2026/2 - Avaliacao da Qualidade do tcc-ERP (Linux)
# Executar na RAIZ do repositorio (pasta tcc-ERP):
#   bash backend/aps_qualidade/rodar_aps.sh
# Requer Docker. Resultados em backend/aps_qualidade/resultados/
set -u
cd "$(dirname "$0")/../.."
OUT=backend/aps_qualidade/resultados
COUT=aps_qualidade/resultados          # mesmo caminho dentro do container (/app)
mkdir -p "$OUT"
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
EX="$DC exec -T backend"

echo "==> 1/8 Subindo banco e backend..."
$DC up -d --build db backend
echo "    aguardando o backend ficar pronto..."
for i in $(seq 1 60); do $EX python -c "import django" >/dev/null 2>&1 && break; sleep 3; done
sleep 10

echo "==> 2/8 Instalando ferramentas de medicao no container..."
$EX pip install -q coverage radon bandit pip-audit

echo "==> 3/8 Suite completa com cobertura (alguns minutos)..."
$EX sh -c "coverage run --branch --source=. --omit='*/migrations/*,*/aps_qualidade/*,*/tests.py,*/test_*.py,*/manage.py,*/seed_users.py' manage.py test --noinput -v 2 > $COUT/saida_testes.txt 2>&1; echo EXIT=\$? >> $COUT/saida_testes.txt"
$EX sh -c "coverage report -m > $COUT/cobertura.txt; coverage json -q -o $COUT/cobertura.json"

echo "==> 4/8 Metricas de codigo (radon)..."
$EX sh -c "radon cc . -s -a -e '*/migrations/*,aps_qualidade/*' > $COUT/radon_cc.txt; radon mi . -s -e '*/migrations/*,aps_qualidade/*' > $COUT/radon_mi.txt; radon raw . -s -e '*/migrations/*,aps_qualidade/*' > $COUT/radon_raw.txt"

echo "==> 5/8 Seguranca estatica (bandit)..."
$EX sh -c "bandit -r . -x ./aps_qualidade,./catalog/migrations,./core/migrations,./finance/migrations,./inventory/migrations,./orders/migrations,./preparation/migrations,./users/migrations -f txt -o $COUT/bandit.txt; true"

echo "==> 6/8 Vulnerabilidades em dependencias (pip-audit)..."
$EX sh -c "pip-audit -r requirements.txt > $COUT/pip_audit.txt 2>&1; true"

echo "==> 7/8 Checklist de implantacao (check --deploy)..."
$DC exec -T -e DEBUG=False -e SECRET_KEY=chave-de-teste-aps-0123456789-abcdefghijklmnopqrstuvwxyz-XYZ -e ALLOWED_HOSTS=localhost backend \
  sh -c "python manage.py check --deploy > $COUT/check_deploy.txt 2>&1; python manage.py makemigrations --check --dry-run > $COUT/migrations_check.txt 2>&1; true"

echo "==> 8/8 Frontend: typecheck e npm audit..."
if command -v npm >/dev/null 2>&1; then
  ( cd frontend && { [ -d node_modules ] || npm ci; } && npm run typecheck > "../$OUT/frontend_typecheck.txt" 2>&1; echo "EXIT=$?" >> "../$OUT/frontend_typecheck.txt"; npm audit --omit=dev > "../$OUT/npm_audit.txt" 2>&1 )
else
  echo "npm nao encontrado no host: rodando typecheck num container node:22 (copia temporaria, nao altera sua pasta)..."
  docker run --rm -v "$PWD/frontend:/src:ro" node:22-alpine sh -c "mkdir -p /w && cd /src && tar --exclude=node_modules --exclude=.next -cf - . | tar -xf - -C /w && cd /w && npm ci --no-audit --no-fund >/dev/null 2>&1; npx tsc --noEmit; echo EXIT=\$?; npm audit --omit=dev > /dev/null 2>&1" > "$OUT/frontend_typecheck.txt" 2>&1
  docker run --rm -v "$PWD/frontend:/src:ro" node:22-alpine sh -c "mkdir -p /w && cp /src/package.json /src/package-lock.json /w/ && cd /w && npm audit --omit=dev" > "$OUT/npm_audit.txt" 2>&1
fi

echo
echo "Concluido. Resultados em $OUT:"
ls -la "$OUT"
