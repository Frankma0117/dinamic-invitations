# Invitaciones: sitio estático. Etapa 1 arma las páginas (una por invitado, con su vista previa para WhatsApp);
# etapa 2 las sirve con nginx. Sin base de datos ni procesos propios.
FROM node:20-alpine AS build
WORKDIR /src
COPY package.json index.html config.json ./
COPY css ./css
COPY js ./js
COPY assets ./assets
COPY editor ./editor
COPY scripts ./scripts
ARG SITE_URL=
RUN node scripts/build.mjs --out site --url "$SITE_URL"

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/site /usr/share/nginx/html
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
