"""Files of each invitation (data/media/<id>/). They arrive in pieces of 4 MB (the server's nginx accepts 5 MB per
request) and are joined here. Videos keep their quality (see _plan) and get a cover image; audio becomes MP3 unless
it already is. Processing runs in the background: the editor asks for the state until it is ready.
"""
import json
import re
import secrets
import shutil
import subprocess
import threading
from pathlib import Path

from .settings import FFMPEG, FFPROBE, MAX_UPLOAD_MB, MEDIA_DIR, TMP_DIR

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
    if kind == "audio" and ext == "mp3":
        dst = folder / f"{stem}.mp3"                 # MP3 plays everywhere: kept exactly as uploaded
        shutil.move(src, dst)
        return {"url": f"/media/{event_id}/{dst.name}", "state": "ready", "kind": kind}
    raw = TMP_DIR / f"{uid}.{ext}"
    shutil.move(src, raw)
    plan = _plan(kind, raw, ext)
    final = folder / f"{stem}.{plan['ext']}"
    key = f"{event_id}/{final.name}"
    with _lock:
        _jobs[key] = {"state": "processing"}
    threading.Thread(target=_convert, args=(kind, raw, final, key, plan), daemon=True).start()
    return {"url": f"/media/{key}", "state": "processing", "kind": kind, "lossless": plan["lossless"]}


def _probe(path: Path) -> dict:
    """Codec of the first video and audio stream, e.g. {'video': 'h264', 'audio': 'aac'}."""
    try:
        out = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "stream=codec_type,codec_name", "-of", "json", str(path)],
                             capture_output=True, timeout=60, check=True).stdout
        found = {}
        for st in json.loads(out).get("streams", []):
            found.setdefault(st.get("codec_type"), st.get("codec_name"))
        return found
    except (subprocess.SubprocessError, OSError, ValueError):
        return {}


def _plan(kind: str, raw: Path, ext: str) -> dict:
    """Videos keep their quality: if the browser can play the codec, the streams are only copied (no re-encoding,
    no loss) into a container that starts fast. Only codecs many phones can't play (HEVC/H.265 from iPhone, ProRes…)
    are converted, at very high quality and the same resolution."""
    c = _probe(raw)
    v, a = c.get("video", ""), c.get("audio", "")
    if kind == "audio":
        return {"ext": "mp3", "args": ["-vn", "-c:a", "libmp3lame", "-q:a", "0"], "lossless": False}
    if ext == "webm" and v in {"vp8", "vp9", "av1"} and a in {"", "opus", "vorbis"}:
        return {"ext": "webm", "args": ["-c", "copy"], "lossless": True}
    audio = ["-c:a", "copy"] if a in {"aac", "mp3", ""} else ["-c:a", "aac", "-b:a", "256k"]
    if v in {"h264", "av1"}:
        return {"ext": "mp4", "args": ["-map", "0:v:0", "-map", "0:a:0?", "-c:v", "copy", *audio, "-movflags", "+faststart"], "lossless": True}
    return {"ext": "mp4", "args": ["-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "slow", "-crf", "15",
                                    "-pix_fmt", "yuv420p", *audio, "-movflags", "+faststart"], "lossless": False}


def _convert(kind: str, raw: Path, final: Path, key: str, plan: dict) -> None:
    tmp = final.with_name(final.stem + ".work" + final.suffix)
    try:
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(raw), *plan["args"], str(tmp)], check=True, timeout=3600, capture_output=True)
        tmp.replace(final)
        result = {"state": "ready"}
        if kind == "video":
            poster = final.with_suffix(".jpg")
            subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-ss", "1", "-i", str(final), "-frames:v", "1",
                            "-vf", "scale='min(1600,iw)':-2", "-q:v", "2", str(poster)], timeout=120, capture_output=True)
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
        return {"state": "ready", **({"poster": f"/media/{event_id}/{poster.name}"} if poster.exists() and path.suffix in (".mp4", ".webm") else {})}
    return {"state": "error", "error": "El archivo ya no existe"}
