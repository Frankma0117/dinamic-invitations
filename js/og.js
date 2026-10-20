// Static pages for link previews. WhatsApp does not run JavaScript, so the title, description and image of each
// guest's link must be written into the HTML: index.html for the general link and <slug>/index.html per guest.
// Pure functions (no DOM): used by scripts/build.mjs and scripts/serve.mjs.

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const RESERVED = ['assets', 'css', 'js', 'editor', 'media', 'index.html', 'config.json'];

const absolute = (path, base) => {
  if (!path || /^(https?:)?\/\//.test(path) || !base) return path || '';
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\.?\/+/, '');
};

/** Images WhatsApp shows in previews: JPG / PNG / WebP by path (not data: URIs, not SVG). */
const previewable = src => !!src && !src.startsWith('data:') && /\.(jpe?g|png|webp)(\?|$)/i.test(src);

export function ogTags(cfg, { base = '', guest = null } = {}) {
  const m = cfg.meta || {};
  const title = guest ? `${guest.name} · ${m.title || cfg.sections?.header?.title || 'Invitación'}` : (m.title || cfg.sections?.header?.title || 'Invitación');
  const desc = m.description || 'Toca para abrir tu invitación.';
  const img = previewable(guest?.image) ? guest.image : m.image;
  const url = base ? base.replace(/\/+$/, '') + '/' + (guest ? `${guest.slug}/` : '') : '';
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="es_LA">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    url && `<meta property="og:url" content="${esc(url)}">`,
    previewable(img) && `<meta property="og:image" content="${esc(absolute(img, base))}">`,
    previewable(img) && `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="robots" content="noindex">`,
  ].filter(Boolean).map(l => '  ' + l).join('\n');
}

/** Replaces the block between <!-- og:start --> and <!-- og:end -->. For a guest page it also adds <base> and the slug. */
export function bakeHtml(html, cfg, { base = '', guest = null } = {}) {
  const start = html.indexOf('<!-- og:start'), end = html.indexOf('<!-- og:end -->');
  if (start < 0 || end < 0) throw new Error('index.html no tiene los marcadores og:start / og:end');
  const lines = [
    '<!-- og:start (generado; no editar a mano: cambia config.json) -->',
    guest && '  <base href="../">',
    guest && `  <meta name="guest-slug" content="${esc(guest.slug)}">`,
    ogTags(cfg, { base, guest }),
    '  ',
  ].filter(Boolean).join('\n');
  return html.slice(0, start) + lines + html.slice(end);
}

/** Finds every data: URI in the config, hands it to save(dataUri) → path, and returns the config with the paths. */
export async function extractDataUris(cfg, save) {
  const walk = async v => {
    if (typeof v === 'string' && v.startsWith('data:')) return save(v);
    if (Array.isArray(v)) return Promise.all(v.map(walk));
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = await walk(x);
      return o;
    }
    return v;
  };
  return walk(cfg);
}

export function dataUriParts(uri) {
  const m = uri.match(/^data:([\w/+.-]+)(;base64)?,(.*)$/s);
  if (!m) return null;
  const mime = m[1];
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/gif': 'gif',
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'video/mp4': 'mp4', 'video/webm': 'webm' }[mime] || 'bin';
  return { mime, ext, base64: !!m[2], data: m[3] };
}
