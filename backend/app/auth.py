"""One administrator with a password. The first start creates a random password in data/admin-password.txt.

Session = signed cookie (HMAC with a key kept in data/secret.key). 5 failed attempts from an IP lock it for 15 min.
"""
import hashlib
import hmac
import json
import secrets
import threading
import time

from fastapi import HTTPException, Request

from .settings import BASE_URL, DATA_DIR, SESSION_DAYS

COOKIE = "inv_session"
_ADMIN = DATA_DIR / "admin.json"
_KEY_FILE = DATA_DIR / "secret.key"
_fails: dict[str, list[float]] = {}
_lock = threading.Lock()


def _key() -> bytes:
    if not _KEY_FILE.exists():
        _KEY_FILE.write_text(secrets.token_hex(32))
        _KEY_FILE.chmod(0o600)
    return _KEY_FILE.read_text().strip().encode()


def _hash(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 240_000).hex()


def set_password(password: str) -> None:
    salt = secrets.token_hex(16)
    # Changing the password also signs out every open session (the version is part of the cookie signature).
    version = secrets.token_hex(4)
    _ADMIN.write_text(json.dumps({"salt": salt, "hash": _hash(password, salt), "version": version}))
    _ADMIN.chmod(0o600)


def ensure_admin() -> None:
    if _ADMIN.exists():
        return
    pw = secrets.token_urlsafe(9)
    set_password(pw)
    out = DATA_DIR / "admin-password.txt"
    out.write_text(f"Contraseña inicial del panel: {pw}\nCámbiala en el panel (Mi cuenta) y borra este archivo.\n")
    out.chmod(0o600)


def _admin() -> dict:
    return json.loads(_ADMIN.read_text())


def check_password(password: str) -> bool:
    a = _admin()
    return hmac.compare_digest(_hash(password or "", a["salt"]), a["hash"])


def _sign(payload: str) -> str:
    return hmac.new(_key(), f"{payload}.{_admin()['version']}".encode(), hashlib.sha256).hexdigest()


def make_cookie() -> str:
    exp = int(time.time()) + SESSION_DAYS * 86400
    return f"{exp}.{_sign(str(exp))}"


def valid_cookie(value: str | None) -> bool:
    try:
        exp, sig = (value or "").split(".", 1)
        return int(exp) > time.time() and hmac.compare_digest(sig, _sign(exp))
    except (ValueError, OSError, KeyError):
        return False


def require(request: Request) -> None:
    if not valid_cookie(request.cookies.get(COOKIE)):
        raise HTTPException(401, "Inicia sesión")


def client_ip(request: Request) -> str:
    return (request.headers.get("x-real-ip") or (request.client.host if request.client else "?"))


def locked(ip: str) -> int:
    """Seconds left of lock for this IP (0 = free)."""
    with _lock:
        recent = [t for t in _fails.get(ip, []) if t > time.time() - 900]
        _fails[ip] = recent
        return int(recent[0] + 900 - time.time()) if len(recent) >= 5 else 0


def failed(ip: str) -> None:
    with _lock:
        _fails.setdefault(ip, []).append(time.time())


def cookie_kwargs() -> dict:
    return {"httponly": True, "samesite": "lax", "secure": BASE_URL.startswith("https"), "max_age": SESSION_DAYS * 86400, "path": "/"}
