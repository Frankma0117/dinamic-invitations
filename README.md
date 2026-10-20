# Invitaciones digitales animadas

Plataforma para crear invitaciones animadas (grados, prom, bodas, quince años, cumpleaños, baby showers,
corporativos…). Pensadas para abrirse desde WhatsApp en el celular: sobre con sello de cera que se abre en 3D,
video o imagen, música, cuenta regresiva, confirmación por WhatsApp y **un enlace por invitado** con su nombre
(y, si quieres, su propio video, imagen, saludo, mensaje y cupos).

- **Panel:** `https://invitaciones.cania.app` → tus invitaciones, crear desde plantilla, duplicar, eliminar.
- **Editor:** vista previa en vivo; guarda solo en el servidor; sube imágenes y videos (se optimizan solos).
- **Invitación:** `/<invitación>/` (general) y `/<invitación>/<invitado>/`; cada enlace con su vista previa en WhatsApp.
  Para alguien que no esté en la lista: `/<invitación>/?para=Ana%20Ruiz`.

## Probar en tu PC
```
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 5700
```
Abre http://localhost:5700 — la contraseña inicial queda en `data/admin-password.txt`.
(Sin ffmpeg instalado, los videos MP4/WebM se guardan sin optimizar.)

## Servidor (VPS)
Primera vez: `cd /opt && git clone <repo> invitaciones && cd invitaciones && bash scripts/deploy.sh`
y `sudo bash scripts/sudo-setup.sh invitaciones.cania.app` (sitio nginx + HTTPS).
Actualizar: `cd /opt/invitaciones && bash scripts/deploy.sh`.
Los datos (invitaciones, archivos, contraseña) viven en `/opt/invitaciones/data/` (no van a git).
