"""Invitations on disk: data/events/<id>.json (config + slug + title) and data/media/<id>/ (their files).

A few dozen invitations, one administrator: plain JSON files are enough and easy to back up.
"""
import json
import re
import secrets
import shutil
import threading
import time
import unicodedata

from .settings import EVENTS_DIR, MEDIA_DIR, RESERVED, WEB_DIR

_lock = threading.Lock()
TEMPLATES_DIR = WEB_DIR / "plantillas"

TEMPLATES = [
    ("grado", "Fiesta de grado", "Azul noche y dorado, con birretes y destellos."),
    ("prom", "Prom botánico con video", "Crema y verde eucalipto; el video sale del sobre."),
    ("boda", "Boda elegante", "Papel crema, letra serif y corazón dibujado a mano."),
    ("quince", "Quince años", "Noche de gala: negro y dorado con brillos."),
    ("cumpleanos", "Cumpleaños infantil", "Colores pastel, globos y confeti."),
    ("babyshower", "Baby shower", "Rosa empolvado con flores en acuarela."),
    ("corporativo", "Evento corporativo", "Moderno minimalista, blanco y negro."),
    ("blanco", "En blanco", "Empieza desde cero con el tema crema."),
]


def slugify(text: str, fallback: str = "invitacion") -> str:
    s = unicodedata.normalize("NFD", str(text or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:48]
    return s or fallback


def _path(event_id: str):
    if not re.fullmatch(r"[a-z0-9]{6,20}", event_id or ""):
        return None
    return EVENTS_DIR / f"{event_id}.json"


def _write(ev: dict) -> None:
    p = EVENTS_DIR / f"{ev['id']}.json"
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(ev, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(p)


def get(event_id: str):
    p = _path(event_id)
    if not p or not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def all_events() -> list:
    out = []
    for p in EVENTS_DIR.glob("*.json"):
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except (OSError, ValueError):
            continue
    return sorted(out, key=lambda e: e.get("updated_at", 0), reverse=True)


def by_slug(slug: str):
    slug = (slug or "").lower()
    return next((e for e in all_events() if e.get("slug") == slug), None)


def _free_slug(wanted: str, own_id: str = "") -> str:
    base = slugify(wanted)
    if base in RESERVED:
        base += "-inv"
    taken = {e["slug"] for e in all_events() if e["id"] != own_id}
    s, n = base, 2
    while s in taken:
        s = f"{base}-{n}"
        n += 1
    return s


def template_config(name: str) -> dict:
    p = TEMPLATES_DIR / f"{name}.json"
    if not re.fullmatch(r"[a-z]+", name or "") or not p.exists():
        p = TEMPLATES_DIR / "blanco.json"
    return json.loads(p.read_text(encoding="utf-8"))


def create(title: str, template: str) -> dict:
    with _lock:
        now = time.time()
        ev = {
            "id": secrets.token_hex(5), "title": (title or "Nueva invitación").strip()[:120],
            "slug": _free_slug(title or template), "template": template,
            "created_at": now, "updated_at": now, "config": template_config(template),
        }
        _write(ev)
        return ev


def save(event_id: str, *, config=None, title=None, slug=None) -> dict:
    with _lock:
        ev = get(event_id)
        if not ev:
            raise KeyError(event_id)
        if config is not None:
            ev["config"] = config
        if title is not None:
            ev["title"] = str(title).strip()[:120] or ev["title"]
        if slug is not None and slugify(slug) != ev["slug"]:
            ev["slug"] = _free_slug(slug, own_id=event_id)
        ev["updated_at"] = time.time()
        _write(ev)
        return ev


def duplicate(event_id: str) -> dict:
    src = get(event_id)
    if not src:
        raise KeyError(event_id)
    with _lock:
        now = time.time()
        ev = {**src, "id": secrets.token_hex(5), "title": f"{src['title']} (copia)",
              "slug": _free_slug(src["slug"] + "-copia"), "created_at": now, "updated_at": now}
        # The copy points to its own files: copy the folder and rewrite /media/<old>/ → /media/<new>/.
        old, new = MEDIA_DIR / src["id"], MEDIA_DIR / ev["id"]
        if old.exists():
            shutil.copytree(old, new)
        ev["config"] = json.loads(json.dumps(src["config"]).replace(f"/media/{src['id']}/", f"/media/{ev['id']}/"))
        _write(ev)
        return ev


def delete(event_id: str) -> None:
    with _lock:
        p = _path(event_id)
        if p and p.exists():
            p.unlink()
        folder = MEDIA_DIR / event_id
        if _path(event_id) and folder.exists() and folder.parent == MEDIA_DIR:   # never outside data/media
            shutil.rmtree(folder)


def summary(ev: dict) -> dict:
    c = ev.get("config") or {}
    sec = c.get("sections") or {}
    media = sec.get("media") or {}
    cover = (c.get("meta") or {}).get("image") or ((media.get("image") or {}).get("src") if media.get("kind") == "image" else "") \
        or (media.get("video") or {}).get("poster") or ""
    return {
        "id": ev["id"], "slug": ev["slug"], "title": ev["title"], "template": ev.get("template", ""),
        "updated_at": ev.get("updated_at"), "created_at": ev.get("created_at"),
        "date": (c.get("event") or {}).get("date", ""), "time": (c.get("event") or {}).get("time", ""),
        "theme": (c.get("theme") or {}).get("preset", "crema"), "guests": len(c.get("guests") or []),
        "cover": cover if not str(cover).startswith("data:") else "",
        "has_video": media.get("kind") == "video" and bool((media.get("video") or {}).get("src") or (media.get("video") or {}).get("url")),
    }
