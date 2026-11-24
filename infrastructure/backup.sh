#!/bin/bash
# Backup do PostgreSQL e dos uploads (imagens) da stack de producao.
# Uso (na raiz do projeto): ./infrastructure/backup.sh
# Para o compose de desenvolvimento: COMPOSE_FILE=docker-compose.yml DB_USER=postgres DB_NAME=tcc_erp ./infrastructure/backup.sh
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_USER="${DB_USER:-${POSTGRES_USER:-erp}}"
DB_NAME="${DB_NAME:-${POSTGRES_DB:-tcc_erp}}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "${BACKUP_DIR}"
DC="docker compose -f ${COMPOSE_FILE}"

echo "==> Backup do banco ${DB_NAME}..."
${DC} exec -T db pg_dump -U "${DB_USER}" -d "${DB_NAME}" -c | gzip > "${BACKUP_DIR}/db_${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "==> Backup dos uploads (media)..."
if ${DC} exec -T backend test -d /app/media 2>/dev/null; then
    ${DC} exec -T backend tar -C /app/media -czf - . > "${BACKUP_DIR}/media_${TIMESTAMP}.tar.gz"
fi

find "${BACKUP_DIR}" -type f \( -name "db_*.sql.gz" -o -name "media_*.tar.gz" \) -mtime +"${RETENTION_DAYS}" -delete
echo "==> Backup concluído em ${BACKUP_DIR} (retenção: ${RETENTION_DAYS} dias)"
echo "    Restaurar banco: gunzip -c ARQUIVO.sql.gz | ${DC} exec -T db psql -U ${DB_USER} -d ${DB_NAME}"
echo "    Restaurar imagens: cat media_AAAAMMDD_HHMMSS.tar.gz | ${DC} exec -T backend tar -C /app/media -xzf -"
