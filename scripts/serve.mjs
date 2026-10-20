// Local server to try the site:  node scripts/serve.mjs   →  http://localhost:5700
// Serves the project folder as is, and /<slug>/ as that guest's page (what build.mjs writes for publishing).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize as normPath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, fixSlugs } from '../js/config.js';
import { bakeHtml } from '../js/og.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || process.argv[2] || 5700);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

async function page(slug) {
  const cfg = normalize(JSON.parse(await readFile(join(root, 'config.json'), 'utf8')));
  cfg.guests = fixSlugs(cfg.guests);
  const html = await readFile(join(root, 'index.html'), 'utf8');
  const guest = slug ? cfg.guests.find(g => g.slug === slug) : null;
  if (slug && !guest) return null;
  return bakeHtml(html, cfg, { base: `http://localhost:${port}`, guest });
}

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/' || path === '/index.html') return send(res, 200, TYPES['.html'], await page(null));
    const m = path.match(/^\/([a-z0-9-]+)\/?$/);
    if (m && !['assets', 'css', 'js', 'editor'].includes(m[1])) {
      if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' }); return res.end(); }
      const html = await page(m[1]);
      if (html) return send(res, 200, TYPES['.html'], html);
    }
    let file = normPath(join(root, path));
    if (!file.startsWith(root)) return send(res, 403, 'text/plain', 'No');
    if ((await stat(file).catch(() => null))?.isDirectory()) {
      if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' }); return res.end(); }
      file = join(file, 'index.html');
    }
    const body = await readFile(file);
    send(res, 200, TYPES[extname(file).toLowerCase()] || 'application/octet-stream', body);
  } catch {
    send(res, 404, 'text/plain; charset=utf-8', 'No encontrado');
  }
}).listen(port, () => {
  console.log(`Invitación:  http://localhost:${port}/`);
  console.log(`Editor:      http://localhost:${port}/editor/`);
});

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(body);
}
