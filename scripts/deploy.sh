#!/usr/bin/env bash
# Despliega o actualiza las invitaciones en el VPS. Idempotente.
#   cd /opt/invitaciones && bash scripts/deploy.sh
# Opcional en .env:  SITE_URL=https://invitaciones.cania.app   APP_PORT=5700
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || printf 'SITE_URL=https://invitaciones.cania.app\nAPP_PORT=5700\n' > .env
port="$(grep -E '^APP_PORT=' .env | cut -d= -f2- || true)"; port="${port:-5700}"

echo "== código"
if [ -d .git ]; then git pull --ff-only || echo "(sin cambios remotos o sin red; sigo con lo local)"; fi

echo "== contenedor"
docker compose up -d --build --remove-orphans
for i in $(seq 1 30); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/healthz")" = 200 ] && break; sleep 1
done
if curl -sf "http://127.0.0.1:$port/healthz" >/dev/null; then echo "Invitaciones OK en el puerto $port"
else echo "No responde"; docker compose logs --tail 40 web; exit 1; fi
docker image prune -f >/dev/null 2>&1 || true
echo "Listo."
