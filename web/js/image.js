// Images in the editor are resized and compressed in the browser before being uploaded (api.js).

const readAsDataURL = blob => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(r.result); r.onerror = () => fail(r.error);
  r.readAsDataURL(blob);
});

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fallback below */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url; await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}

/** JPEG (shows in WhatsApp previews too), at most `max` px on the longest side. Transparent PNG/SVG stay PNG. */
export async function compressImage(file, { max = 1600, quality = .82 } = {}) {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return readAsDataURL(file);
  const bmp = await loadBitmap(file);
  const w = bmp.width, h = bmp.height;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const ctx = c.getContext('2d');
  const keepPng = file.type === 'image/png' && hasAlpha(bmp);
  if (!keepPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL(keepPng ? 'image/png' : 'image/jpeg', quality);
}

/** 1200×630 crop (centered) for the link preview. */
export async function previewImage(file) {
  const bmp = await loadBitmap(file);
  const W = 1200, H = 630;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const k = Math.max(W / bmp.width, H / bmp.height);
  const w = bmp.width * k, h = bmp.height * k;
  c.getContext('2d').drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
  return c.toDataURL('image/jpeg', .8);
}

function hasAlpha(bmp) {
  const c = document.createElement('canvas');
  c.width = Math.min(64, bmp.width); c.height = Math.min(64, bmp.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}
