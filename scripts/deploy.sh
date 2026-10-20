#!/usr/bin/env bash
# Despliega o actualiza Invitaciones en el VPS. Idempotente.
#   cd /opt/invitaciones && bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
touch .env && chmod 600 .env
grep -q '^BASE_URL=' .env || echo "BASE_URL=https://invitaciones.cania.app" >> .env
grep -q '^APP_PORT=' .env || echo "APP_PORT=5700" >> .env
grep -q '^APP_UID=' .env || printf 'APP_UID=%s\nAPP_GID=%s\n' "$(id -u)" "$(id -g)" >> .env
port="$(grep -E '^APP_PORT=' .env | cut -d= -f2-)"

echo "== código"
if [ -d .git ]; then git pull --ff-only || echo "(sin cambios remotos o sin red; sigo con lo local)"; fi

echo "== contenedor"
mkdir -p data
docker compose up -d --build --remove-orphans
for i in $(seq 1 40); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/healthz")" = 200 ] && break; sleep 2
done
if curl -sf "http://127.0.0.1:$port/healthz" >/dev/null; then echo "Invitaciones OK en el puerto $port"
else echo "No responde"; docker compose logs --tail 40 web; exit 1; fi
docker image prune -f >/dev/null 2>&1 || true
[ -f data/admin-password.txt ] && echo "Contraseña inicial del panel: cat $(pwd)/data/admin-password.txt"
echo "Listo."
