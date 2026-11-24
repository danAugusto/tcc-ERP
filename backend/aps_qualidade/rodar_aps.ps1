# APS 2026/2 - Avaliacao da Qualidade do tcc-ERP
# Executar na RAIZ do repositorio (pasta tcc-ERP), no PowerShell:
#   powershell -ExecutionPolicy Bypass -File backend\aps_qualidade\rodar_aps.ps1
# Requer Docker Desktop aberto. Os resultados ficam em backend\aps_qualidade\resultados\

$ErrorActionPreference = "Continue"
$out = "backend/aps_qualidade/resultados"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$cout = "aps_qualidade/resultados"   # mesmo caminho visto de dentro do container (/app)

Write-Host "==> 1/8 Subindo banco e backend (docker compose)..."
docker compose up -d --build db backend
Start-Sleep -Seconds 20

Write-Host "==> 2/8 Instalando ferramentas de medicao no container..."
docker compose exec -T backend pip install -q coverage radon bandit pip-audit

Write-Host "==> 3/8 Suite completa de testes com cobertura (pode levar alguns minutos)..."
docker compose exec -T backend sh -c "coverage run --branch --source=. --omit='*/migrations/*,*/aps_qualidade/*,*/tests.py,*/test_*.py,*/manage.py,*/seed_users.py' manage.py test --noinput -v 2 > $cout/saida_testes.txt 2>&1; echo EXIT=`$? >> $cout/saida_testes.txt"
docker compose exec -T backend sh -c "coverage report -m > $cout/cobertura.txt; coverage json -q -o $cout/cobertura.json"

Write-Host "==> 4/8 Metricas de codigo (radon)..."
docker compose exec -T backend sh -c "radon cc . -s -a -e '*/migrations/*,aps_qualidade/*' > $cout/radon_cc.txt; radon mi . -s -e '*/migrations/*,aps_qualidade/*' > $cout/radon_mi.txt; radon raw . -s -e '*/migrations/*,aps_qualidade/*' > $cout/radon_raw.txt"

Write-Host "==> 5/8 Analise de seguranca estatica (bandit)..."
docker compose exec -T backend sh -c "bandit -r . -x ./aps_qualidade,./catalog/migrations,./core/migrations,./finance/migrations,./inventory/migrations,./orders/migrations,./preparation/migrations,./users/migrations -f txt -o $cout/bandit.txt; true"

Write-Host "==> 6/8 Vulnerabilidades conhecidas nas dependencias (pip-audit)..."
docker compose exec -T backend sh -c "pip-audit -r requirements.txt > $cout/pip_audit.txt 2>&1; true"

Write-Host "==> 7/8 Checklist de implantacao do Django (check --deploy)..."
docker compose exec -T -e DEBUG=False -e SECRET_KEY=chave-de-teste-aps-0123456789-abcdefghijklmnopqrstuvwxyz-XYZ -e ALLOWED_HOSTS=localhost backend sh -c "python manage.py check --deploy > $cout/check_deploy.txt 2>&1; python manage.py makemigrations --check --dry-run > $cout/migrations_check.txt 2>&1; true"

Write-Host "==> 8/8 Frontend: typecheck e auditoria de dependencias..."
Push-Location frontend
npm run typecheck *> "../$out/frontend_typecheck.txt"
"EXIT=$LASTEXITCODE" | Out-File -Append -Encoding utf8 "../$out/frontend_typecheck.txt"
npm audit --omit=dev *> "../$out/npm_audit.txt"
Pop-Location

Write-Host ""
Write-Host "Concluido. Resultados em $out"
Get-ChildItem $out | Select-Object Name, Length
