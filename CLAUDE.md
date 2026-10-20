# CLAUDE.md — Invitaciones

Invitaciones digitales animadas (proyecto independiente). Responde siempre en español, con tono cercano. El dueño es
Manuel: no es técnico en servidores, necesita pasos clic a clic y quiere hacer lo mínimo a mano.

## Decisiones
- Se publica SOLO en el VPS propio (nada de Netlify/Vercel/GitHub Pages; decisión de Manuel 2026-10-20).
- 2026-10-20 (tarde): Manuel quiere una **plataforma** (no una invitación fija): `/` → panel con contraseña, lista de
  invitaciones, crear desde plantilla (`web/plantillas/*.json`, lista en `store.TEMPLATES`), editor que guarda solo.
- Backend FastAPI (`backend/app`): invitaciones en `data/events/<id>.json`, archivos en `data/media/<id>/`, un solo
  administrador (`data/admin.json`, PBKDF2; contraseña inicial en `data/admin-password.txt`), cookie firmada.
- El nginx del host acepta 5 MB por petición: los archivos suben en partes de 4 MB (`api.js` → `/upload`).
  Videos → MP4 H.264 ≤1280 px + póster JPG con ffmpeg en segundo plano (el editor consulta `/media-status`);
  el póster llena la imagen de vista previa si está vacía.
- Público: `/<slug>/` y `/<slug>/<invitado>/`; el servidor escribe el Open Graph (`pages.py`) y el navegador lee
  `/api/i/<slug>`. `RESERVED` en `settings.py` = rutas que no pueden ser slug.
- **Un enlace por invitado** (`guests[]`: slug, name, phone, greeting, message, image, video, seats).

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
- [x] 2026-10-20: plataforma con panel, plantillas (8), editor con guardado automático y subida por partes.
- [x] 2026-10-20 (noche), pedidos de Manuel: **video sin pérdida** (`media._plan`: si el navegador reproduce el códec
      solo se copian las pistas —remux con faststart—; HEVC/ProRes → H.264 CRF 15 misma resolución; MP3 tal cual),
      **video en loop** y sin "Ver otra vez", **imagen como invitación** (`media.image.intro`; `introMedia()`),
      **horizontal en celular**: aviso animado para girar → pantalla completa → al "Continuar" aviso para volver a
      ponerlo derecho. **Todo personalizable**: `THEME_KEYS` (colores de invitación, sobre, sello, nombre; `fontName`
      = letra del nombre), sello con imagen propia (`seal.type = image`), selector visual de letras (70 fuentes).
- [ ] Respaldo diario de `data/` (como aula-interactiva → Spaces `cania-storage/invitaciones/backups/`).
- [ ] Idea: que el editor guarde directo en el servidor (con contraseña) para no pasar el config.json a mano.

## Infraestructura
- VPS `manuel@169.58.79.154`, carpeta `/opt/invitaciones`, Docker Compose (nginx:alpine) en `127.0.0.1:5700`.
- Dominio `invitaciones.cania.app` (DNS comodín de cania.app) → nginx del host, sitio `invitaciones-<dominio>` + certbot.
- En el VPS viven otros proyectos (aula-interactiva 5690, content-assistant, cania-web, maniksero, canix):
  no tocar sus carpetas, contenedores ni sitios nginx.

## Cómo trabajar
- Código e identificadores en inglés; texto visible en español latino. DOM con `h()` (nunca innerHTML con datos del usuario).
- Probar: `cd backend && python -m uvicorn app.main:app --port 5700` → http://localhost:5700 (datos en `data/`).
