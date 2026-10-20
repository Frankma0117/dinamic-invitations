"""Link preview image (WhatsApp, Facebook…): an envelope in the invitation's colors, sealed, with the guest's name
written by hand on it, "INVITACIÓN" above and the event below. 1200×630, with the important part centered so it
also reads well when WhatsApp crops it to a square.

Fonts come from Google Fonts (TrueType, cached in data/fonts/); if that fails, the bundled OFL fonts are used.
"""
import hashlib
import io
import json
import re
import threading
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .settings import DATA_DIR

W, H = 1200, 630
FONT_DIR = DATA_DIR / "fonts"
OG_DIR = DATA_DIR / "og"
BUNDLED = Path(__file__).parent / "fonts"
FONT_DIR.mkdir(parents=True, exist_ok=True)
OG_DIR.mkdir(parents=True, exist_ok=True)
_lock = threading.Lock()

# Colors and fonts of each style — the same values as THEMES in web/js/themes.js (keep them in sync).
PRESETS = {
    "crema": dict(bg="#efe6d6", paper="#f9f3e7", ink="#4a3a2a", primary="#b08d57", envelope="#e9dcc4", envelopeInk="#4a3a2a", seal="#9b2f3b", sealInk="#f2d8a4", fontTitle="Cormorant Garamond", fontScript="Great Vibes"),
    "grado": dict(bg="#0b1734", paper="#10224a", ink="#f4ead5", primary="#d6b25e", envelope="#24407f", envelopeInk="#d6b25e", seal="#c79a3a", sealInk="#fff4d6", fontTitle="Cinzel", fontScript="Great Vibes"),
    "romantico": dict(bg="#f6e4e2", paper="#fdf5f3", ink="#6a3d45", primary="#c27a86", envelope="#f0d2d0", envelopeInk="#6a3d45", seal="#b4606f", sealInk="#fde9ea", fontTitle="Playfair Display", fontScript="Parisienne"),
    "moderno": dict(bg="#f2f2f0", paper="#ffffff", ink="#141414", primary="#141414", envelope="#ffffff", envelopeInk="#141414", seal="#141414", sealInk="#ffffff", fontTitle="Josefin Sans", fontScript="Caveat"),
    "infantil": dict(bg="#fff4dc", paper="#fffaf0", ink="#3b3770", primary="#ff7f9f", envelope="#ffd36e", envelopeInk="#3b3770", seal="#ff7f9f", sealInk="#ffffff", fontTitle="Fredoka", fontScript="Pacifico"),
    "gala": dict(bg="#0a0a0a", paper="#141312", ink="#f3e7c6", primary="#d4af37", envelope="#1c1b19", envelopeInk="#d4af37", seal="#b8902f", sealInk="#1a1405", fontTitle="Playfair Display", fontScript="Pinyon Script"),
    "botanico": dict(bg="#ece6d8", paper="#f5f0e4", ink="#2e3a30", primary="#2f4a39", envelope="#2f4a39", envelopeInk="#efe3c4", seal="#b8955a", sealInk="#6e5325", fontTitle="Bodoni Moda", fontScript="Homemade Apple"),
}


def theme_of(cfg: dict) -> dict:
    t = cfg.get("theme") or {}
    out = dict(PRESETS.get(t.get("preset"), PRESETS["crema"]))
    for k in ("bg", "paper", "ink", "primary", "envelope", "envelopeInk", "seal", "sealInk", "fontTitle", "fontScript"):
        if t.get(k):
            out[k] = t[k]
    out["fontName"] = t.get("fontName") or out["fontScript"]
    return out


def texts(cfg: dict, guest: dict | None) -> dict:
    hd = (cfg.get("sections") or {}).get("header") or {}
    event = " · ".join(x for x in (hd.get("title"), hd.get("names")) if x) or (cfg.get("meta") or {}).get("title") or "Invitación"
    seal = (cfg.get("opening") or {}).get("seal") or {}
    name = (guest or {}).get("name") or (cfg.get("guest") or {}).get("fallback") or "Para ti"
    return {"name": name, "event": event, "seal": (seal.get("text") or "")[:3] if seal.get("type") == "initials" else ""}


def version(cfg: dict, guest: dict | None) -> str:
    """Changes whenever something drawn on the image changes (WhatsApp caches by URL)."""
    raw = json.dumps([theme_of(cfg), texts(cfg, guest)], sort_keys=True, ensure_ascii=False)
    return hashlib.sha1(raw.encode()).hexdigest()[:10]


def _font(family: str, size: int, fallback: str) -> ImageFont.FreeTypeFont:
    safe = re.sub(r"[^A-Za-z0-9]+", "", family or "")
    path = FONT_DIR / f"{safe}.ttf"
    if safe and not path.exists():
        try:
            url = f"https://fonts.googleapis.com/css2?family={family.replace(' ', '+')}"
            css = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/4.0"}), timeout=8).read().decode()
            ttf = re.search(r"url\((https://[^)]+\.ttf)\)", css)
            if ttf:
                path.write_bytes(urllib.request.urlopen(ttf.group(1), timeout=15).read())
        except (OSError, ValueError):
            pass
    try:
        return ImageFont.truetype(str(path if path.exists() else BUNDLED / fallback), size)
    except OSError:
        return ImageFont.truetype(str(BUNDLED / fallback), size)


def _rgb(hex_color: str, fallback=(120, 120, 120)):
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", str(hex_color or "").strip())
    return tuple(int(m.group(1)[i:i + 2], 16) for i in (0, 2, 4)) if m else fallback


def _shade(c, k: float):
    return tuple(max(0, min(255, int(v * k))) for v in c)


def _fit(draw, text, family, max_w, start, fallback, min_size=26):
    size = start
    while size > min_size:
        f = _font(family, size, fallback)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 4
    return _font(family, min_size, fallback)


def render(cfg: dict, guest: dict | None) -> bytes:
    t, tx = theme_of(cfg), texts(cfg, guest)
    bg, env, ink = _rgb(t["bg"]), _rgb(t["envelope"]), _rgb(t["ink"])
    img = Image.new("RGB", (W, H), bg)

    # Soft light in the middle, darker edges.
    glow = Image.radial_gradient("L").resize((W, H)).point(lambda v: 255 - v)
    img = Image.composite(Image.new("RGB", (W, H), _shade(bg, 1.06)), img, glow.point(lambda v: int(v * .55)))
    img = Image.composite(img, Image.new("RGB", (W, H), _shade(bg, .86)), glow.point(lambda v: min(255, int(v * 1.6))))

    ew, eh = 600, 390
    x0, y0 = (W - ew) // 2, 112
    x1, y1 = x0 + ew, y0 + eh

    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((x0 + 6, y0 + 22, x1 - 6, y1 + 26), 18, fill=150)
    img.paste(Image.new("RGB", (W, H), _shade(bg, .55)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(22)))

    d = ImageDraw.Draw(img)
    mid_x, tip_y = (x0 + x1) // 2, y0 + int(eh * .56)
    d.rounded_rectangle((x0, y0, x1, y1), 12, fill=env)
    d.polygon([(x0, y0 + 6), (mid_x, y0 + int(eh * .58)), (x0, y1 - 6)], fill=_shade(env, .95))       # left fold
    d.polygon([(x1, y0 + 6), (mid_x, y0 + int(eh * .58)), (x1, y1 - 6)], fill=_shade(env, .95))       # right fold
    d.polygon([(x0 + 8, y1), (mid_x, y0 + int(eh * .48)), (x1 - 8, y1)], fill=_shade(env, .9))        # bottom
    d.polygon([(x0, y0), (x1, y0), (mid_x, tip_y)], fill=_shade(env, .84))                           # flap
    d.line([(x0 + 4, y0 + 2), (mid_x, tip_y), (x1 - 4, y0 + 2)], fill=_shade(env, .72), width=2)

    # Wax seal at the tip of the flap.
    seal, seal_ink, r = _rgb(t["seal"]), _rgb(t["sealInk"]), 46
    d.ellipse((mid_x - r - 3, tip_y - r - 1, mid_x + r + 3, tip_y + r + 5), fill=_shade(seal, .6))
    d.ellipse((mid_x - r, tip_y - r, mid_x + r, tip_y + r), fill=seal)
    d.ellipse((mid_x - r + 7, tip_y - r + 7, mid_x + r - 7, tip_y + r - 7), outline=_shade(seal, 1.18), width=2)
    if tx["seal"]:
        f = _fit(d, tx["seal"], t["fontTitle"], 60, 40, "CormorantGaramond-SemiBold.ttf", 22)
        d.text((mid_x, tip_y + 2), tx["seal"], font=f, fill=seal_ink, anchor="mm")
    else:                                                       # little heart
        hx, hy, s = mid_x, tip_y + 3, 15
        d.ellipse((hx - s, hy - s * .9, hx, hy + s * .1), fill=seal_ink)
        d.ellipse((hx, hy - s * .9, hx + s, hy + s * .1), fill=seal_ink)
        d.polygon([(hx - s * .98, hy - s * .25), (hx + s * .98, hy - s * .25), (hx, hy + s * 1.05)], fill=seal_ink)

    # The guest's name, handwritten on the envelope.
    name_font = _fit(d, tx["name"], t["fontName"], ew - 100, 66, "GreatVibes-Regular.ttf", 30)
    while name_font.size > 30:                  # handwriting fonts are tall: keep it inside the envelope
        top, bottom = d.textbbox((mid_x, y1 - 70), tx["name"], font=name_font, anchor="mm")[1::2]
        if bottom <= y1 - 14 and top >= tip_y + r + 4:
            break
        name_font = _font(t["fontName"], name_font.size - 4, "GreatVibes-Regular.ttf")
    d.text((mid_x, y1 - 70), tx["name"], font=name_font, fill=_rgb(t["envelopeInk"]), anchor="mm")

    # "INVITACIÓN" above, the event below.
    label_font = _font("Cormorant Garamond", 30, "CormorantGaramond-SemiBold.ttf")   # always a clear, elegant label
    label = " ".join("INVITACIÓN")
    d.text((W // 2, 62), label, font=label_font, fill=_rgb(t["primary"]) if _rgb(t["primary"]) != bg else ink, anchor="mm")
    lw = d.textlength(label, font=label_font)
    for side in (-1, 1):
        xa = W // 2 + side * (lw / 2 + 26)
        d.line([(xa, 62), (xa + side * 70, 62)], fill=_shade(ink, 1) if t["primary"] == t["bg"] else _rgb(t["primary"]), width=2)
    ev_font = _fit(d, tx["event"], t["fontTitle"], W - 160, 40, "CormorantGaramond-SemiBold.ttf", 24)
    d.text((W // 2, 568), tx["event"], font=ev_font, fill=ink, anchor="mm")

    out = io.BytesIO()
    img.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    return out.getvalue()


def cached(event_id: str, cfg: dict, guest: dict | None) -> Path:
    v = version(cfg, guest)
    folder = OG_DIR / event_id
    path = folder / f"{(guest or {}).get('slug') or '_'}-{v}.jpg"
    if not path.exists():
        with _lock:
            if not path.exists():
                folder.mkdir(parents=True, exist_ok=True)
                for old in folder.glob(f"{(guest or {}).get('slug') or '_'}-*.jpg"):
                    old.unlink(missing_ok=True)
                path.write_bytes(render(cfg, guest))
    return path
