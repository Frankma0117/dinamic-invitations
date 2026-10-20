"""Settings from the environment (.env in the server). Everything has a sensible default for running locally."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("DATA_DIR", ROOT / "data"))
WEB_DIR = Path(os.getenv("WEB_DIR", ROOT / "web"))
BASE_URL = os.getenv("BASE_URL", "http://localhost:5700").rstrip("/")

EVENTS_DIR = DATA_DIR / "events"
MEDIA_DIR = DATA_DIR / "media"
TMP_DIR = DATA_DIR / "tmp"

FFMPEG = os.getenv("FFMPEG", "ffmpeg")
FFPROBE = os.getenv("FFPROBE", "ffprobe")
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "14"))
MAX_UPLOAD_MB = {"image": 25, "audio": 40, "video": 600}
CHUNK_MAX = 4 * 1024 * 1024 + 1024          # the host nginx accepts 5 MB per request: files travel in 4 MB pieces

# First path segment of an invitation (/<slug>/) can't be one of these.
RESERVED = {"api", "panel", "css", "js", "assets", "media", "plantillas", "healthz", "favicon.ico", "robots.txt", "_preview", "admin", "login", "og"}

for d in (EVENTS_DIR, MEDIA_DIR, TMP_DIR):
    d.mkdir(parents=True, exist_ok=True)
