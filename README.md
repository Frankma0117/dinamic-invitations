# Invitaciones digitales animadas

Invitaciones para cualquier evento (grados, bodas, quinceañeros, cumpleaños, baby showers, bautizos, aniversarios,
eventos corporativos). Pensadas para abrirse desde WhatsApp en el celular: sobre con sello de cera que se abre en 3D,
música, cuenta regresiva, confirmación por WhatsApp y un **enlace propio por invitado** (con su nombre en el sobre y,
si quieres, su imagen, saludo, mensaje y cupos; su imagen es también la que se ve al compartir el enlace).

- **Invitación:** `/` (general) y `/<invitado>/` (por ejemplo `/laura-gomez/`). Para alguien que no esté en la lista: `/?para=Ana%20Ruiz`.
- **Editor:** `/editor/` (vista previa en vivo). Todo queda en un solo archivo: `config.json`.

## Probar en tu PC
Necesitas Node 18 o más nuevo.
```
node scripts/serve.mjs
```
Abre http://localhost:5700/ (invitación) y http://localhost:5700/editor/ (editor).

## Crear una invitación nueva
1. Abre el editor, cambia diseño, textos, fechas, secciones e invitados (el borrador se guarda solo en tu navegador).
2. Clic en **💾 Guardar config.json**.
3. Reemplaza el `config.json` del proyecto por el descargado y publica (abajo).

Las imágenes subidas en el editor quedan dentro del `config.json`; al publicar se convierten en archivos
(`assets/media/`) y se crea la página de cada invitado con su vista previa para WhatsApp.

## Publicar en el servidor (VPS)
Primera vez (en el servidor):
```
cd /opt && git clone <repositorio> invitaciones && cd invitaciones
bash scripts/deploy.sh                                   # contenedor en 127.0.0.1:5700
sudo bash scripts/sudo-setup.sh invitaciones.cania.app   # sitio nginx + HTTPS (solo una vez)
```
Actualizar después de cambiar `config.json`: subir el cambio a git y en el servidor `bash scripts/deploy.sh`.

`deploy.sh` arma el sitio dentro de Docker (`scripts/build.mjs`) y lo sirve con nginx. La dirección pública va en
`.env` (`SITE_URL=https://invitaciones.cania.app`): con ella se arman los enlaces de vista previa.
