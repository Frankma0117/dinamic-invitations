"""HTML of an invitation with its link preview. WhatsApp does not run JavaScript, so the title, description and
image of each link (general or per guest) are written into the page here, between <!-- og:start --> and <!-- og:end -->.
"""
import html
import re

from . import ogimage
from .settings import BASE_URL, WEB_DIR

_PREVIEWABLE = re.compile(r"\.(jpe?g|png|webp)(\?|$)", re.I)


def _abs(url: str) -> str:
    if not url or re.match(r"^(https?:)?//", url):
        return url or ""
    return BASE_URL + "/" + url.lstrip("./").lstrip("/")


def _template() -> str:
    return (WEB_DIR / "invite.html").read_text(encoding="utf-8")


def invitation_page(ev: dict | None, guest: dict | None = None) -> str:
    page = _template()
    start, end = page.index("<!-- og:start"), page.index("<!-- og:end -->")
    if ev is None:                                   # editor preview: no data, the editor sends the config
        tags = ['<title>Vista previa</title>', '<meta name="robots" content="noindex">']
    else:
        c = ev.get("config") or {}
        meta = c.get("meta") or {}
        header = (c.get("sections") or {}).get("header") or {}
        event = " · ".join(x for x in (header.get("title"), header.get("names")) if x) or meta.get("title") or ev.get("title") or "Invitación"
        # It must read as an invitation in the chat: "💌 Carolina Arévalo, tienes una invitación".
        if guest and guest.get("name"):
            title = f"💌 {guest['name']}, tienes una invitación"
        else:
            title = "💌 Tienes una invitación"
        desc = f"{event} · {meta.get('description') or 'Toca para abrirla'}"
        if (meta.get("previewStyle") or "envelope") == "envelope":
            img = f"{BASE_URL}/og/{ev['slug']}/{(guest or {}).get('slug') or '_'}.jpg?v={ogimage.version(c, guest)}"
        else:
            own = guest.get("image") if guest and _PREVIEWABLE.search(guest.get("image") or "") else meta.get("image")
            img = _abs(own) if own and _PREVIEWABLE.search(own) else ""
        url = f"{BASE_URL}/{ev['slug']}/" + (f"{guest['slug']}/" if guest else "")
        e = lambda s: html.escape(str(s), quote=True)
        tags = [
            f"<title>{e(title)}</title>",
            f'<meta name="description" content="{e(desc)}">',
            f'<meta name="event" content="{e(ev["slug"])}">',
            guest and f'<meta name="guest-slug" content="{e(guest["slug"])}">',
            '<meta property="og:type" content="website">',
            '<meta property="og:locale" content="es_LA">',
            f'<meta property="og:title" content="{e(title)}">',
            f'<meta property="og:description" content="{e(desc)}">',
            f'<meta property="og:url" content="{e(url)}">',
            img and f'<meta property="og:image" content="{e(img)}">',
            img and '<meta property="og:image:type" content="image/jpeg">',
            img and '<meta property="og:image:width" content="1200">',
            img and '<meta property="og:image:height" content="630">',
            img and f'<meta property="og:image:alt" content="{e("Invitación: " + event)}">',
            img and '<meta name="twitter:card" content="summary_large_image">',
            '<meta name="robots" content="noindex">',
        ]
    block = "<!-- og:start (generado por el servidor) -->\n" + "\n".join("  " + t for t in tags if t) + "\n  "
    return page[:start] + block + page[end:]


def not_found_page() -> str:
    return """<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invitación no encontrada</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4efe6;color:#3b3328;font:17px/1.6 Georgia,serif;text-align:center;padding:24px}
h1{font-weight:400;font-size:1.8rem;margin:.3em 0}p{color:#7a6c5a}</style></head>
<body><main><div style="font-size:3rem">💌</div><h1>No encontramos esta invitación</h1>
<p>Revisa que el enlace esté completo o pídele a quien te invitó que te lo envíe de nuevo.</p></main></body></html>"""
