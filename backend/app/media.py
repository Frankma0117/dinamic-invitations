"""Files of each invitation (data/media/<id>/). They arrive in pieces of 4 MB (the server's nginx accepts 5 MB per
request) and are joined here. Videos are converted to MP4 for phones (H.264, max. 1280 px, fast start) and get a
cover image; audio becomes MP3. Conversion runs in the background: the editor asks for the state until it is ready.
"""
import re
import secrets
import shutil
import subprocess
import threading
from pathlib import Path

from .settings import FFMPEG, MAX_UPLOAD_MB, MEDIA_DIR, TMP_DIR

IMAGE_EXT = {"jpg", "jpeg", "png", "webp", "gif", "svg"}
AUDIO_EXT = {"mp3", "m4a", "aac", "ogg", "wav", "opus"}
VIDEO_EXT = {"mp4", "mov", "m4v", "webm", "mkv", "avi", "3gp"}
_jobs: dict[str, dict] = {}            # "<event>/<file>" → {state: processing|ready|error, poster?}
_lock = threading.Lock()


def kind_of(name: str) -> tuple[str, str] | None:
    ext = (name.rsplit(".", 1)[-1] if "." in name else "").lower()
    for kind, exts in (("image", IMAGE_EXT), ("audio", AUDIO_EXT), ("video", VIDEO_EXT)):
        if ext in exts:
            return kind, ext
    return None


def _part(uid: str) -> Path:
    if not re.fullmatch(r"[a-zA-Z0-9]{8,40}", uid or ""):
        raise ValueError("uid")
    return TMP_DIR / f"{uid}.part"


def append_chunk(uid: str, idx: int, data: bytes, kind: str) -> int:
    """Appends a piece; returns the size so far. Pieces must arrive in order (the editor sends them one by one)."""
    p = _part(uid)
    if idx == 0 and p.exists():
        p.unlink()
    if idx > 0 and not p.exists():
        raise ValueError("Falta la parte anterior")
    with p.open("ab") as f:
        f.write(data)
    size = p.stat().st_size
    if size > MAX_UPLOAD_MB[kind] * 1024 * 1024:
        p.unlink()
        raise ValueError(f"El archivo supera {MAX_UPLOAD_MB[kind]} MB")
    return size


def finish(event_id: str, uid: str, name: str) -> dict:
    """Moves the joined file into the invitation's folder. Returns {url, state, poster?}."""
    k = kind_of(name)
    if not k:
        raise ValueError("Tipo de archivo no permitido")
    kind, ext = k
    folder = MEDIA_DIR / event_id
    folder.mkdir(parents=True, exist_ok=True)
    stem = secrets.token_hex(6)
    src = _part(uid)
    if kind == "image":
        dst = folder / f"{stem}.{'jpg' if ext == 'jpeg' else ext}"
        shutil.move(src, dst)
        return {"url": f"/media/{event_id}/{dst.name}", "state": "ready"}
    if not shutil.which(FFMPEG) and ext in {"mp4", "webm", "mp3", "m4a", "ogg"}:
        # Without ffmpeg (a PC without it installed) web-ready formats are kept as they are.
        dst = folder / f"{stem}.{ext}"
        shutil.move(src, dst)
        return {"url": f"/media/{event_id}/{dst.name}", "state": "ready", "kind": kind}
    raw = TMP_DIR / f"{uid}.{ext}"
    shutil.move(src, raw)
    final = folder / (f"{stem}.mp4" if kind == "video" else f"{stem}.mp3")
    key = f"{event_id}/{final.name}"
    with _lock:
        _jobs[key] = {"state": "processing"}
    threading.Thread(target=_convert, args=(kind, raw, final, key), daemon=True).start()
    return {"url": f"/media/{key}", "state": "processing", "kind": kind}


def _convert(kind: str, raw: Path, final: Path, key: str) -> None:
    tmp = final.with_name(final.stem + ".work" + final.suffix)
    try:
        if kind == "video":
            cmd = [FFMPEG, "-y", "-loglevel", "error", "-i", str(raw),
                   "-vf", "scale='min(1280,iw)':-2:flags=lanczos,format=yuv420p",
                   "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-profile:v", "high",
                   "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-movflags", "+faststart", str(tmp)]
        else:
            cmd = [FFMPEG, "-y", "-loglevel", "error", "-i", str(raw), "-vn", "-c:a", "libmp3lame", "-b:a", "128k", str(tmp)]
        subprocess.run(cmd, check=True, timeout=1800, capture_output=True)
        tmp.replace(final)
        result = {"state": "ready"}
        if kind == "video":
            poster = final.with_suffix(".jpg")
            subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-ss", "1", "-i", str(final), "-frames:v", "1",
                            "-vf", "scale='min(1200,iw)':-2", "-q:v", "4", str(poster)], timeout=120, capture_output=True)
            if poster.exists():
                result["poster"] = f"/media/{key.rsplit('.', 1)[0]}.jpg"
    except (subprocess.SubprocessError, OSError) as e:
        result = {"state": "error", "error": "No se pudo procesar el archivo. Prueba con otro formato (MP4 o MP3)."}
        print("ffmpeg:", e, getattr(e, "stderr", b"")[-400:] if hasattr(e, "stderr") else "", flush=True)
        tmp.unlink(missing_ok=True)
    finally:
        raw.unlink(missing_ok=True)
    with _lock:
        _jobs[key] = result


def status(event_id: str, file: str) -> dict:
    key = f"{event_id}/{file}"
    with _lock:
        job = _jobs.get(key)
    if job:
        return job
    path = MEDIA_DIR / event_id / file
    if path.exists():
        poster = path.with_suffix(".jpg")
        return {"state": "ready", **({"poster": f"/media/{event_id}/{poster.name}"} if poster.exists() and path.suffix == ".mp4" else {})}
    return {"state": "error", "error": "El archivo ya no existe"}
