// Talking to the server from the panel and the editor.

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method, credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.endsWith('/login') && location.pathname !== '/panel') {
    location.href = '/panel';                   // session expired inside the editor: back to sign in
    throw new ApiError(401, 'Inicia sesión');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.detail || 'Algo salió mal. Inténtalo de nuevo.');
  return data;
}

const CHUNK = 4 * 1024 * 1024;     // the server's nginx accepts 5 MB per request
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Uploads a file (or Blob with a name) in 4 MB pieces. onProgress(fraction 0–1, 'upload' | 'processing').
 * Videos and audio are converted on the server: this waits until they are ready. Returns { url, poster? }.
 */
export async function uploadFile(eventId, file, name, onProgress = () => {}) {
  const uid = crypto.getRandomValues(new Uint32Array(4)).reduce((s, n) => s + n.toString(36), '').slice(0, 24).padEnd(12, 'x');
  const total = Math.max(1, Math.ceil(file.size / CHUNK));
  let res;
  for (let i = 0; i < total; i++) {
    const part = file.slice(i * CHUNK, (i + 1) * CHUNK);
    const q = new URLSearchParams({ uid, idx: i, total, name });
    let tries = 0;
    for (;;) {
      const r = await fetch(`/api/events/${eventId}/upload?${q}`, { method: 'POST', body: part, credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream' } }).catch(() => null);
      if (r && r.ok) { res = await r.json(); break; }
      if (r && r.status < 500 && r.status !== 429) throw new ApiError(r.status, (await r.json().catch(() => ({}))).detail || 'No se pudo subir el archivo');
      if (++tries > 3) throw new ApiError(0, 'Se cortó la conexión subiendo el archivo. Inténtalo de nuevo.');
      await sleep(1500 * tries);                // weak signal: retry the same piece
    }
    onProgress((i + 1) / total, 'upload');
  }
  if (res.state === 'processing') {
    const file = res.url.split('/').pop();
    for (;;) {
      onProgress(1, 'processing');
      await sleep(2000);
      const st = await api(`/api/events/${eventId}/media-status?file=${encodeURIComponent(file)}`);
      if (st.state === 'ready') return { url: res.url, poster: st.poster || '' };
      if (st.state === 'error') throw new ApiError(0, st.error || 'No se pudo procesar el archivo');
    }
  }
  return { url: res.url, poster: res.poster || '' };
}

/** data: URI (images compressed in the browser) → Blob. */
export function dataUriToBlob(uri) {
  const [head, data] = uri.split(',');
  const mime = head.match(/data:([^;]+)/)[1];
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function copyText(text) {
  return navigator.clipboard?.writeText(text).then(() => true, () => false) ?? Promise.resolve(false);
}
