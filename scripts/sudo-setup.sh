#!/usr/bin/env bash
# Publica el dominio (único paso con sudo). Crea SOLO su propio sitio nginx y el certificado HTTPS.
#   sudo bash /opt/invitaciones/scripts/sudo-setup.sh invitaciones.cania.app
# Requisito: el DNS del dominio apunta a la IP del VPS (*.cania.app ya lo hace).
set -euo pipefail
host="${1:-invitaciones.cania.app}"
port="${2:-5700}"
conf="/etc/nginx/sites-available/invitaciones-$host"

if [ ! -e "$conf" ]; then
  cat > "$conf" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $host;
    client_max_body_size 5m;
    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
  echo "Sitio creado: $conf"
fi
ln -sf "$conf" "/etc/nginx/sites-enabled/invitaciones-$host"
nginx -t
systemctl reload nginx
certbot --nginx -d "$host" --redirect --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring
systemctl reload nginx
echo "Listo: https://$host"
