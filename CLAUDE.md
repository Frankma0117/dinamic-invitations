# CLAUDE.md — Invitaciones

Invitaciones digitales animadas (proyecto independiente). Responde siempre en español, con tono cercano. El dueño es
Manuel: no es técnico en servidores, necesita pasos clic a clic y quiere hacer lo mínimo a mano.

## Decisiones
- Se publica SOLO en el VPS propio (nada de Netlify/Vercel/GitHub Pages; decisión de Manuel 2026-10-20).
- Sitio estático sin compilación (módulos ES + GSAP y canvas-confetti por CDN). Todo en `config.json`.
- **Un enlace por invitado** (`guests[]`: slug, name, phone, greeting, message, image, seats). WhatsApp no ejecuta
  JS: `scripts/build.mjs` escribe `<slug>/index.html` con su Open Graph (`js/og.js`, marcadores `og:start/og:end`).
  `?para=Nombre` sigue funcionando para quien no esté en la lista.
- Imágenes subidas en el editor = data: URI en el config; el build las pasa a `assets/media/<hash>`.

## Estado
- [x] 2026-10-20: invitación (sobre / díptico / telón / sin animación), 12 secciones, 6 temas, partículas, música,
      editor con vista previa en vivo, invitados con enlace propio. Probado en local (Edge, móvil y escritorio).
- [x] 2026-10-20: desplegado en el VPS (repo `git@github.com:Frankma0117/dinamic-invitations.git`, `/opt/invitaciones`,
      contenedor `invitaciones-web-1` en 127.0.0.1:5700, `.env` con SITE_URL). El editor queda público en `/editor/`
      (no guarda nada en el servidor). **Pendiente de Manuel**: `sudo bash /opt/invitaciones/scripts/sudo-setup.sh
      invitaciones.cania.app` (sitio nginx + HTTPS; pide su contraseña).
- [x] 2026-10-20: **tema Botánico** (crema + verde bosque + salvia, sello dorado con corazón, eucalipto con flores de
      nube generado en `decor.js` → esquinas de la tarjeta) a partir de la invitación "Prom" que mandó Manuel.
      **Video como invitación**: el sobre abre y el video sale en una tarjeta de papel del tema (`playIntroVideo`:
      Ver en grande / Continuar / Ver otra vez); el `<video>` se crea y se "desbloquea" en el toque para que suene.
      **Video por invitado** (`guests[].video`, el video trae su nombre); su `image` = vista previa de WhatsApp y póster.
      Ejemplos para el editor en `ejemplos/` (grado.json, prom.json).
- [ ] Videos: Manuel los manda; servirlos desde el VPS (`assets/videos/`) o, si pesan mucho, desde Spaces
      `cania-storage` SOLO bajo el prefijo `invitaciones/` (bucket compartido: nunca tocar otros prefijos).
      ffmpeg disponible en el VPS dentro de la imagen de aula-interactiva (usar `docker run --rm`, no el contenedor vivo).
- [ ] Idea: que el editor guarde directo en el servidor (con contraseña) para no pasar el config.json a mano.

## Infraestructura
- VPS `manuel@169.58.79.154`, carpeta `/opt/invitaciones`, Docker Compose (nginx:alpine) en `127.0.0.1:5700`.
- Dominio `invitaciones.cania.app` (DNS comodín de cania.app) → nginx del host, sitio `invitaciones-<dominio>` + certbot.
- En el VPS viven otros proyectos (aula-interactiva 5690, content-assistant, cania-web, maniksero, canix):
  no tocar sus carpetas, contenedores ni sitios nginx.

## Cómo trabajar
- Código e identificadores en inglés; texto visible en español latino. DOM con `h()` (nunca innerHTML con datos del usuario).
- Probar: `node scripts/serve.mjs` → http://localhost:5700 (sirve también `/<slug>/`). `node scripts/build.mjs --out dist`.
