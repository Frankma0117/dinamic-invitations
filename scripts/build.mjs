// Builds the publishable site in a folder (dist/ by default). No dependencies, only Node 18+.
//   node scripts/build.mjs --out dist --url https://invitaciones.cania.app
// - Copies the site (invitation + editor).
// - Images/audio embedded in config.json (data:) become files in assets/media/.
// - Writes the link-preview tags (Open Graph) into index.html and creates <slug>/index.html for each guest.
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, fixSlugs } from '../js/config.js';
import { bakeHtml, extractDataUris, dataUriParts } from '../js/og.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def = '') => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const out = join(root, arg('out', 'dist'));
const configFile = arg('config', 'config.json');

const raw = JSON.parse(await readFile(join(root, configFile), 'utf8'));
const base = (arg('url') || process.env.SITE_URL || raw.meta?.url || '').replace(/\/+$/, '');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const item of ['css', 'js', 'assets', 'editor']) await cp(join(root, item), join(out, item), { recursive: true });

// Embedded files → assets/media/<hash>.<ext> (the same file is written once).
await mkdir(join(out, 'assets', 'media'), { recursive: true });
let saved = 0;
const cfg = await extractDataUris(raw, async uri => {
  const p = dataUriParts(uri);
  if (!p) return uri;
  const buf = p.base64 ? Buffer.from(p.data, 'base64') : Buffer.from(decodeURIComponent(p.data));
  const name = `assets/media/${createHash('sha1').update(buf).digest('hex').slice(0, 14)}.${p.ext}`;
  await writeFile(join(out, name), buf);
  saved++;
  return name;
});
cfg.guests = fixSlugs(cfg.guests || []);
if (base) cfg.meta = { ...cfg.meta, url: base };
await writeFile(join(out, 'config.json'), JSON.stringify(cfg, null, 2));

const html = await readFile(join(root, 'index.html'), 'utf8');
const full = normalize(cfg);
await writeFile(join(out, 'index.html'), bakeHtml(html, full, { base }));
for (const g of full.guests) {
  await mkdir(join(out, g.slug), { recursive: true });
  await writeFile(join(out, g.slug, 'index.html'), bakeHtml(html, full, { base, guest: g }));
}

console.log(`Sitio listo en ${out}`);
console.log(`  ${full.guests.length} invitado(s) con enlace propio, ${saved} archivo(s) extraído(s) del config.`);
if (!base) console.log('  Aviso: sin --url (o meta.url) la imagen de vista previa no tendrá dirección completa; WhatsApp podría no mostrarla.');
