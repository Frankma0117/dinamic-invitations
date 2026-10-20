"""Invitaciones: panel to create invitations + the invitations themselves.

  /                         → panel (login)
  /panel, /panel/editar/<id> → panel and editor (admin)
  /<slug>/  /<slug>/<guest>/ → the invitation (general / for one guest), with its WhatsApp preview
  /api/...                   → JSON (public: /api/i/<slug>; the rest needs the session)
"""
import json
import re

from fastapi import Body, Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import auth, media, pages, store
from .settings import CHUNK_MAX, MEDIA_DIR, RESERVED, WEB_DIR

app = FastAPI(title="Invitaciones", docs_url=None, redoc_url=None, openapi_url=None)
auth.ensure_admin()
admin = [Depends(auth.require)]


@app.middleware("http")
async def headers(request: Request, call_next):
    res = await call_next(request)
    res.headers.setdefault("X-Content-Type-Options", "nosniff")
    res.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    path = request.url.path
    if path.startswith(("/css/", "/js/", "/plantillas/")) or path.endswith(".html"):
        res.headers["Cache-Control"] = "no-cache"
    return res


for folder in ("css", "js", "assets", "plantillas"):
    app.mount(f"/{folder}", StaticFiles(directory=WEB_DIR / folder), name=folder)


@app.get("/healthz")
def healthz():
    return {"ok": True, "events": len(store.all_events())}


@app.get("/robots.txt", response_class=Response)
def robots():
    return Response("User-agent: *\nDisallow: /\n", media_type="text/plain")


@app.get("/favicon.ico")
def favicon():
    return FileResponse(WEB_DIR / "assets" / "favicon.svg", media_type="image/svg+xml")


# ---------- Panel ----------

@app.get("/")
def root():
    return RedirectResponse("/panel", 302)


@app.get("/panel", response_class=HTMLResponse)
def panel_page():
    return HTMLResponse((WEB_DIR / "panel.html").read_text(encoding="utf-8"), headers={"Cache-Control": "no-cache"})


@app.get("/panel/editar/{event_id}", response_class=HTMLResponse)
def editor_page(event_id: str, request: Request):
    if not auth.valid_cookie(request.cookies.get(auth.COOKIE)):
        return RedirectResponse("/panel", 302)
    return HTMLResponse((WEB_DIR / "editor.html").read_text(encoding="utf-8"), headers={"Cache-Control": "no-cache"})


@app.get("/_preview/", response_class=HTMLResponse)
def preview_page():
    return HTMLResponse(pages.invitation_page(None), headers={"Cache-Control": "no-cache"})


# ---------- Session ----------

@app.post("/api/login")
def login(request: Request, response: Response, body: dict = Body(...)):
    ip = auth.client_ip(request)
    wait = auth.locked(ip)
    if wait:
        raise HTTPException(429, f"Demasiados intentos. Espera {wait // 60 + 1} minuto(s).")
    if not auth.check_password(str(body.get("password", ""))):
        auth.failed(ip)
        raise HTTPException(401, "Contraseña incorrecta")
    response.set_cookie(auth.COOKIE, auth.make_cookie(), **auth.cookie_kwargs())
    return {"ok": True}


@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie(auth.COOKIE, path="/")
    return {"ok": True}


@app.get("/api/me", dependencies=admin)
def me():
    return {"ok": True}


@app.post("/api/password", dependencies=admin)
def change_password(response: Response, body: dict = Body(...)):
    if not auth.check_password(str(body.get("current", ""))):
        raise HTTPException(400, "La contraseña actual no es correcta")
    new = str(body.get("new", ""))
    if len(new) < 10:
        raise HTTPException(400, "La nueva contraseña debe tener al menos 10 caracteres")
    auth.set_password(new)
    (store.EVENTS_DIR.parent / "admin-password.txt").unlink(missing_ok=True)
    response.set_cookie(auth.COOKIE, auth.make_cookie(), **auth.cookie_kwargs())
    return {"ok": True}


# ---------- Invitations (admin) ----------

@app.get("/api/templates", dependencies=admin)
def templates():
    out = []
    for key, label, desc in store.TEMPLATES:
        c = store.template_config(key)
        out.append({"id": key, "label": label, "description": desc, "theme": (c.get("theme") or {}).get("preset", "crema")})
    return out


@app.get("/api/events", dependencies=admin)
def list_events():
    return [store.summary(e) for e in store.all_events()]


@app.post("/api/events", dependencies=admin)
def create_event(body: dict = Body(...)):
    ev = store.create(str(body.get("title", "")), str(body.get("template", "blanco")))
    return store.summary(ev)


def _event(event_id: str) -> dict:
    ev = store.get(event_id)
    if not ev:
        raise HTTPException(404, "No existe esa invitación")
    return ev


@app.get("/api/events/{event_id}", dependencies=admin)
def get_event(event_id: str):
    ev = _event(event_id)
    return {"id": ev["id"], "slug": ev["slug"], "title": ev["title"], "config": ev["config"], "updated_at": ev["updated_at"]}


@app.put("/api/events/{event_id}", dependencies=admin)
def save_event(event_id: str, body: dict = Body(...)):
    _event(event_id)
    config = body.get("config")
    if config is not None and not isinstance(config, dict):
        raise HTTPException(400, "Configuración inválida")
    if config is not None and len(json.dumps(config)) > 3_000_000:
        raise HTTPException(413, "La configuración es demasiado grande (¿una imagen pegada como texto?)")
    ev = store.save(event_id, config=config, title=body.get("title"), slug=body.get("slug"))
    return {"slug": ev["slug"], "title": ev["title"], "updated_at": ev["updated_at"]}


@app.post("/api/events/{event_id}/duplicate", dependencies=admin)
def duplicate_event(event_id: str):
    _event(event_id)
    return store.summary(store.duplicate(event_id))


@app.delete("/api/events/{event_id}", dependencies=admin)
def delete_event(event_id: str):
    _event(event_id)
    store.delete(event_id)
    return {"ok": True}


@app.post("/api/events/{event_id}/upload", dependencies=admin)
async def upload(event_id: str, request: Request, uid: str, idx: int, total: int, name: str):
    """One piece of a file (raw body). On the last piece the file is stored and, if needed, converted."""
    _event(event_id)
    k = media.kind_of(name)
    if not k:
        raise HTTPException(400, "Tipo de archivo no permitido (usa imágenes, MP3 o videos)")
    data = await request.body()
    if len(data) > CHUNK_MAX:
        raise HTTPException(413, "Parte demasiado grande")
    try:
        media.append_chunk(uid, idx, data, k[0])
        if idx < total - 1:
            return {"state": "partial"}
        return media.finish(event_id, uid, name)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/events/{event_id}/media-status", dependencies=admin)
def media_status(event_id: str, file: str):
    if not re.fullmatch(r"[\w.-]+", file):
        raise HTTPException(400, "Archivo inválido")
    return media.status(event_id, file)


# ---------- Public ----------

@app.get("/media/{event_id}/{file}")
def media_file(event_id: str, file: str):
    path = MEDIA_DIR / event_id / file
    if not re.fullmatch(r"[a-z0-9]{6,20}", event_id) or not re.fullmatch(r"[\w-]+\.[a-z0-9]+", file) or ".work." in file or not path.is_file():
        raise HTTPException(404)
    return FileResponse(path, headers={"Cache-Control": "public, max-age=2592000, immutable"})


@app.get("/api/i/{slug}")
def public_config(slug: str):
    ev = store.by_slug(slug)
    if not ev:
        raise HTTPException(404, "No existe esa invitación")
    return JSONResponse(ev["config"], headers={"Cache-Control": "no-cache"})


def _guest(ev: dict, guest_slug: str):
    return next((g for g in (ev["config"].get("guests") or []) if g.get("slug") == guest_slug), None)


@app.get("/{slug}")
def invitation_redirect(slug: str):
    if slug in RESERVED:
        raise HTTPException(404)
    return RedirectResponse(f"/{slug}/", 301)


@app.get("/{slug}/", response_class=HTMLResponse)
def invitation(slug: str):
    ev = store.by_slug(slug)
    if not ev:
        return HTMLResponse(pages.not_found_page(), 404)
    return HTMLResponse(pages.invitation_page(ev), headers={"Cache-Control": "no-cache"})


@app.get("/{slug}/{guest_slug}")
def guest_redirect(slug: str, guest_slug: str):
    return RedirectResponse(f"/{slug}/{guest_slug}/", 301)


@app.get("/{slug}/{guest_slug}/", response_class=HTMLResponse)
def guest_invitation(slug: str, guest_slug: str):
    ev = store.by_slug(slug)
    g = ev and _guest(ev, guest_slug)
    if not ev:
        return HTMLResponse(pages.not_found_page(), 404)
    if not g:                                   # a mistyped guest link still opens the general invitation
        return RedirectResponse(f"/{slug}/", 302)
    return HTMLResponse(pages.invitation_page(ev, g), headers={"Cache-Control": "no-cache"})
