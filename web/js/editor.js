// Editor: tabs on the left, the form in the middle (its own scroll), the phone preview on the right.
// Everything is saved on the server by itself (/api/events/<id>); files are uploaded in pieces (api.js).
import { h, fillTemplate } from './util.js';
import { normalize, getPath, setPath, fixSlugs, slugify, genderize } from './config.js';
import { THEMES, THEME_KEYS, FONTS, TEXTURES, PARTICLES, resolveTheme, fontStack, loadFonts } from './themes.js';
import { SEAL_ICONS, sealIcon } from './decor.js';
import { compressImage, previewImage } from './image.js';
import { api, uploadFile, dataUriToBlob, copyText } from './api.js';
import * as sfx from './sfx.js';

const EVENT_ID = location.pathname.split('/').filter(Boolean).pop();
const $ = s => document.querySelector(s);
const panel = $('#panel'), pane = $('#pane'), frame = $('#frame');
let cfg = null;
let ev = { title: '', slug: '' };                      // name and address of the invitation (outside the config)
let frameReady = false;
let previewAs = '';                                    // '' = general link; otherwise a guest slug
let tab = 'design';
const open = new Set();                                // expanded cards, guest rows and font lists
const uploads = new Map();                             // path or guest key → { frac, phase } while uploading
const guestKeys = new WeakMap();                       // guest → key for its upload (lives only in this session)
const keyOf = g => guestKeys.get(g) || (guestKeys.set(g, 'guest-' + Math.random().toString(36).slice(2)), guestKeys.get(g));

/* ---------- Small helpers ---------- */

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
function download(name, text, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
}
const eventLink = () => `${location.origin}/${ev.slug}/`;
const guestLink = g => `${eventLink()}${g.slug}/`;
const shortLink = url => url.replace(/^https?:\/\//, '');
async function copy(text, msg = 'Copiado') {
  if (await copyText(text)) toast(msg); else prompt('Copia el texto:', text);
}
const svg = (d, cls = '') => h('span', { class: cls, svg: `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>` });
const I = {
  design: '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3-3.5 3H16a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z"/>',
  envelope: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  content: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  media: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  sound: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  guests: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.7-.3 4.9 1.3 5.5 4.4"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.9 7.6-4.4M8.2 13.1l7.6 4.4"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};

/* ---------- Saving + preview ---------- */

let saving = Promise.resolve();
function setStatus(text, cls = '') {
  const el = $('#saveState');
  el.textContent = text; el.className = `save-state ${cls}`;
}
const saveNow = (extra = {}) => {
  fixSlugs(cfg.guests);
  setStatus('Guardando…', 'busy');
  saving = saving.then(async () => {
    try {
      const r = await api(`/api/events/${EVENT_ID}`, { method: 'PUT', body: { config: cfg, title: ev.title, ...extra } });
      const slugChanged = r.slug !== ev.slug;
      ev.slug = r.slug;
      setStatus('Guardado', 'ok');
      if (slugChanged) { renderTop(); render(); }
    } catch (e) { setStatus('No se guardó: ' + e.message, 'err'); }
  });
  return saving;
};
const saveSoon = debounce(() => saveNow(), 800);
addEventListener('beforeunload', e => { if ($('#saveState').classList.contains('busy') || uploads.size) e.preventDefault(); });

const sendPreview = debounce((replay = false) => {
  if (!frameReady) return;
  const g = cfg.guests.find(x => x.slug === previewAs);
  frame.contentWindow.postMessage({ type: 'config', config: cfg, replay, as: g ? { slug: g.slug } : { slug: '', name: 'Laura Gómez' } }, location.origin);
}, 250);

// Changes that are seen on the envelope: the preview plays the opening again.
const REPLAY = /^(opening\.|guest\.|sounds\.|theme\.(envelope|seal|fontName|curtain|bg|letter))/;

function changed({ rebuild = false, replay = false } = {}) {
  setStatus('Sin guardar', 'busy');
  saveSoon();
  sendPreview(replay);
  if (rebuild) render();
}

/* ---------- Building blocks ---------- */

function control(path, o = {}) {
  const v = getPath(cfg, path);
  const set = val => { setPath(cfg, path, val); changed({ rebuild: o.rebuild, replay: REPLAY.test(path) }); };
  if (o.type === 'textarea') return h('textarea', { rows: o.rows || 3, placeholder: o.placeholder || '', value: v ?? '', oninput: e => set(e.target.value) });
  if (o.type === 'select') {
    return h('select', { onchange: e => set(o.number ? Number(e.target.value) : e.target.value) },
      o.options.map(([val, label]) => h('option', { value: val, selected: String(val) === String(v ?? '') }, label)));
  }
  if (o.type === 'checkbox') {
    return h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!v, onchange: e => set(e.target.checked) }), h('i'), o.label || '');
  }
  return h('input', {
    type: o.type || 'text', value: v ?? '', placeholder: o.placeholder || '', min: o.min, max: o.max, maxlength: o.maxlength,
    oninput: e => set(o.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value),
  });
}
const field = (label, path, o = {}) => h('label', { class: 'field' }, h('span', null, label), control(path, o), o.help && h('p', { class: 'hint' }, o.help));
const hint = text => h('p', { class: 'hint' }, text);
const label = text => h('p', { class: 'label' }, text);
const page = (title, desc, ...body) => [h('header', { class: 'page-head' }, h('h1', null, title), desc && h('p', null, desc)), ...body];

/** A card. collapsible → opens/closes (remembered); toggle → switch to show/hide that part of the invitation. */
function card({ id, icon, title, sub, toggle, collapsible = false }, ...body) {
  const on = toggle ? !!getPath(cfg, toggle) : true;
  const sw = toggle && h('label', { class: 'switch', title: on ? 'Se muestra' : 'Oculta', onclick: e => e.stopPropagation() },
    h('input', { type: 'checkbox', checked: on, 'aria-label': `Mostrar ${title}`, onchange: e => { setPath(cfg, toggle, e.target.checked); changed({ rebuild: true }); } }), h('i'));
  const head = h(collapsible ? 'summary' : 'div', { class: 'card-head' },
    icon && h('span', { class: 'ic', 'aria-hidden': 'true' }, icon),
    h('div', null, h('h2', null, title), sub && h('span', { class: 'sub-title' }, sub)),
    h('div', { class: 'end' }, sw, collapsible && svg(I.chev, 'chev')));
  const content = h('div', { class: 'card-body' }, body);
  if (!collapsible) return h('section', { class: `card${on ? '' : ' off'}` }, title && head, content);
  const d = h('details', { class: `card${on ? '' : ' off'}`, open: open.has(id) || null }, head, content);
  d.addEventListener('toggle', () => (d.open ? open.add(id) : open.delete(id)));
  return d;
}

function choices(path, options, { rebuild = true } = {}) {
  const v = getPath(cfg, path);
  return h('div', { class: 'choices', role: 'radiogroup' }, options.map(([val, text]) =>
    h('button', { type: 'button', class: `choice${v === val ? ' on' : ''}`, role: 'radio', 'aria-checked': String(v === val),
      onclick: () => { setPath(cfg, path, val); changed({ rebuild, replay: REPLAY.test(path) }); } }, text)));
}

/** Color of the theme; empty = the style's own color (↺ goes back to it). */
function colorField(text, key, preset) {
  const path = `theme.${key}`;
  const v = getPath(cfg, path) || '';
  const shown = v || preset[key] || '#000000';
  const hex = h('small', null, v ? v.toUpperCase() : 'del estilo');
  const pick = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(shown) ? shown : '#000000', 'aria-label': text });
  pick.oninput = () => { setPath(cfg, path, pick.value); hex.textContent = pick.value.toUpperCase(); changed({ replay: REPLAY.test(path) }); };
  pick.onchange = () => render();
  return h('label', { class: 'color-field' }, pick, h('span', { class: 'cf-text' }, h('b', null, text), hex),
    v && h('button', { type: 'button', title: 'Volver al color del estilo', 'aria-label': 'Volver al color del estilo',
      onclick: e => { e.preventDefault(); setPath(cfg, path, ''); changed({ rebuild: true, replay: REPLAY.test(path) }); } }, '↺'));
}

const FONT_KINDS = { serif: 'Elegantes', sans: 'Modernas', script: 'Manuscritas' };

/** Visual font chooser: every option is written in its own typeface. */
function fontPicker(text, path, kind, presetName, sample) {
  const cur = getPath(cfg, path) || '';
  const shown = cur || presetName;
  const id = 'font:' + path;
  const grid = h('div', { class: 'font-grid', hidden: !open.has(id) });
  const fill = () => {
    loadFonts(Object.keys(FONTS));
    const opt = (name, note) => h('button', { type: 'button', class: `font-opt${name === cur ? ' on' : ''}`,
      onclick: () => { setPath(cfg, path, name); changed({ rebuild: true, replay: REPLAY.test(path) }); } },
    h('span', { class: 'font-sample', style: { 'font-family': fontStack(name || presetName) } }, sample), h('small', null, note));
    grid.replaceChildren(opt('', `Del estilo · ${presetName}`),
      ...[kind, ...Object.keys(FONT_KINDS).filter(k => k !== kind)].flatMap(k => [
        h('p', { class: 'font-kind' }, FONT_KINDS[k]),
        ...Object.entries(FONTS).filter(([, f]) => f.kind === k).map(([name]) => opt(name, name))]));
  };
  if (!grid.hidden) fill();
  loadFonts([shown]);
  const btn = h('button', { type: 'button', class: 'font-current', 'aria-expanded': String(!grid.hidden),
    onclick: () => {
      grid.hidden = !grid.hidden;
      btn.setAttribute('aria-expanded', String(!grid.hidden));
      if (grid.hidden) open.delete(id); else { open.add(id); fill(); }
    } },
  h('span', { class: 'fc-txt' }, h('span', { class: 'font-sample', style: { 'font-family': fontStack(shown) } }, sample), h('small', null, cur ? shown : `${shown} · del estilo`)),
  svg(I.chev, 'chev'));
  return h('div', { class: 'field' }, h('span', null, text), btn, grid);
}

/* ---------- Files ---------- */

async function uploadTo(key, file, name, onDone) {
  const st = { frac: 0, phase: 'upload' };
  uploads.set(key, st);
  const paint = () => document.querySelectorAll(`[data-up="${CSS.escape(String(key))}"]`).forEach(box => {
    const bar = box.querySelector('.progress');
    if (!bar) return;
    bar.classList.toggle('indeterminate', st.phase === 'processing');
    bar.firstChild.style.width = `${Math.round(st.frac * 100)}%`;
    const txt = box.querySelector('.up-text');
    if (txt) txt.textContent = st.phase === 'processing' ? 'Preparando el video…' : `Subiendo ${Math.round(st.frac * 100)} %`;
  });
  render();
  try {
    const r = await uploadFile(EVENT_ID, file, name, (f, phase) => { st.frac = f; st.phase = phase; paint(); });
    uploads.delete(key);
    onDone(r);
    changed({ rebuild: true });
    return r;
  } catch (e) {
    uploads.delete(key);
    toast(e.message, 6000);
    render();
    return null;
  }
}
const progressBox = key => {
  const st = uploads.get(key);
  return st && h('div', { class: 'media-actions', 'data-up': String(key) },
    h('span', { class: 'up-text hint' }, st.phase === 'processing' ? 'Preparando el video…' : `Subiendo ${Math.round(st.frac * 100)} %`),
    h('div', { class: `progress${st.phase === 'processing' ? ' indeterminate' : ''}` }, h('i', { style: { width: `${Math.round(st.frac * 100)}%` } })));
};

/** Image / video / audio of the invitation: preview, upload with progress, remove; video and audio also accept a link. */
function mediaField(text, path, { kind = 'image', help, og = false, max = 2400, onPoster, link = kind !== 'image' } = {}) {
  const v = getPath(cfg, path) || '';
  const accept = { image: 'image/*', video: 'video/*', audio: 'audio/*' }[kind];
  const input = h('input', { type: 'file', accept, hidden: true });
  input.onchange = async () => {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    if (kind === 'image') {
      let blob;
      try { blob = dataUriToBlob(og ? await previewImage(f) : await compressImage(f, { max })); }
      catch { return toast('No pude leer esa imagen. Prueba con JPG o PNG.'); }
      const ext = { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/gif': 'gif' }[blob.type] || 'jpg';
      uploadTo(path, blob, `imagen.${ext}`, r => setPath(cfg, path, r.url));
    } else {
      uploadTo(path, f, f.name, r => { setPath(cfg, path, r.url); if (r.poster) onPoster?.(r.poster); });
    }
  };
  const isFile = v.startsWith('/media/');
  const poster = kind === 'video' ? (getPath(cfg, path.replace(/\.src$/, '.poster')) || '') : '';
  const thumb = h('div', { class: 'media-thumb', style: kind === 'image' && v ? { 'background-image': `url("${v}")` } : poster ? { 'background-image': `url("${poster}")` } : null },
    !v ? (kind === 'image' ? 'Sin imagen' : kind === 'video' ? 'Sin video' : 'Sin canción') : kind === 'audio' ? '🎵' : '',
    v && kind === 'video' && h('span', { class: 'badge' }, '▶ Video'));
  const busy = uploads.has(path);
  return h('div', { class: 'field' }, h('span', null, text),
    h('div', { class: 'media-box' }, thumb,
      busy ? progressBox(path) : h('div', { class: 'media-actions' },
        h('div', { class: 'row' },
          h('button', { class: 'btn sm primary', type: 'button', onclick: () => input.click() }, svg(I.upload), v ? 'Cambiar' : 'Subir'),
          v && h('button', { class: 'btn sm danger', type: 'button', onclick: () => { setPath(cfg, path, ''); changed({ rebuild: true, replay: REPLAY.test(path) }); } }, 'Quitar')),
        link && !isFile && h('input', { type: 'url', placeholder: kind === 'video' ? 'o pega un enlace de YouTube / Vimeo' : 'o pega un enlace directo', value: v,
          onchange: e => { setPath(cfg, path, e.target.value.trim()); changed({ rebuild: true }); } }),
        help && hint(help))),
    input);
}

/* ==================== Tabs ==================== */

const TABS = [
  ['design', 'Diseño'], ['envelope', 'Sobre'], ['content', 'Contenido'], ['media', 'Multimedia'],
  ['sound', 'Sonido'], ['guests', 'Invitados'], ['share', 'Compartir'],
];

function designTab() {
  const preset = resolveTheme({ preset: cfg.theme.preset });
  const mine = THEME_KEYS.filter(k => cfg.theme[k]).length;
  const themes = Object.entries(THEMES).map(([key, th]) => h('button', {
    type: 'button', class: `theme-card${cfg.theme.preset === key ? ' on' : ''}`,
    onclick: () => { cfg.theme = { preset: key }; changed({ rebuild: true, replay: true }); },
  }, h('div', { class: 'theme-swatch', style: { background: th.bg } }, h('span', { class: 'env', style: { background: th.envelope } }, h('i', { style: { background: th.seal } }))), th.label));
  return page('Diseño', 'Elige un estilo como punto de partida y cambia lo que quieras: colores, letras y ambiente.',
    card({ icon: '✨', title: 'Estilo base', sub: mine ? `Tienes ${mine} cambio(s) propios sobre este estilo` : 'Cambiarlo reinicia colores y letras' },
      h('div', { class: 'themes' }, themes),
      mine > 0 && h('div', null, h('button', { class: 'btn sm', type: 'button', onclick: () => { cfg.theme = { preset: cfg.theme.preset }; changed({ rebuild: true, replay: true }); } }, '↺ Quitar mis cambios de color y letra'))),
    card({ icon: '🎨', title: 'Colores de la invitación' },
      h('div', { class: 'colors' },
        colorField('Principal', 'primary', preset), colorField('Detalles', 'secondary', preset),
        colorField('Fondo', 'bg', preset), colorField('Papel', 'paper', preset), colorField('Texto', 'ink', preset))),
    card({ icon: 'Aa', title: 'Letras' },
      fontPicker('Títulos', 'theme.fontTitle', 'serif', preset.fontTitle, cfg.sections.header.title || 'Nuestra fiesta'),
      fontPicker('Texto', 'theme.fontBody', 'sans', preset.fontBody, 'Nos encantaría que nos acompañaras'),
      fontPicker('Manuscrita (subtítulo, firma)', 'theme.fontScript', 'script', preset.fontScript, cfg.sections.header.names || 'Con cariño')),
    card({ icon: '🌿', title: 'Ambiente' },
      h('div', { class: 'grid2' },
        field('Textura del fondo', 'theme.texture', { type: 'select', options: [['', `Del estilo (${TEXTURES[preset.texture]})`], ...Object.entries(TEXTURES)] }),
        field('Efecto que cae', 'theme.particles', { type: 'select', options: [['', `Del estilo (${PARTICLES[preset.particles]})`], ...Object.entries(PARTICLES)] })),
      control('opening.confetti', { type: 'checkbox', label: 'Lanzar confeti al abrir el sobre' })),
  );
}

function envelopeTab() {
  const preset = resolveTheme({ preset: cfg.theme.preset });
  const seal = cfg.opening.seal;
  const style = cfg.opening.style;
  const styles = [['envelope', '✉️', 'Sobre', 'Se rompe el sello y sale la carta'], ['diptych', '📖', 'Tarjeta', 'Se abre como un libro'],
    ['curtain', '🎭', 'Telón', 'Se corre una cortina'], ['none', '⚡', 'Directo', 'Sin animación']];
  return page('Sobre', 'Lo primero que ve cada invitado: el sobre con su nombre, el sello y la carta que sale.',
    card({ icon: '✉️', title: 'Cómo se abre' },
      h('div', { class: 'tiles' }, styles.map(([k, e, t, d]) => h('button', { type: 'button', class: `tile${style === k ? ' on' : ''}`,
        onclick: () => { cfg.opening.style = k; changed({ rebuild: true, replay: true }); } }, h('span', { class: 'big' }, e), t, h('small', null, d)))),
      field('Texto para invitar a tocar', 'opening.hint', { placeholder: 'Toca para abrir' })),
    style !== 'none' && card({ icon: '🎨', title: 'Colores del sobre' },
      h('div', { class: 'colors' },
        colorField(style === 'curtain' ? 'Telón' : 'Sobre', style === 'curtain' ? 'curtain' : 'envelope', preset),
        style !== 'curtain' && colorField('Interior', 'envelopeInner', preset),
        colorField('Sello', 'seal', preset), colorField('Ícono del sello', 'sealInk', preset),
        colorField('Nombre escrito', 'envelopeInk', preset))),
    style !== 'none' && card({ icon: '🔏', title: 'Sello de cera' },
      choices('opening.seal.type', [['initials', 'Iniciales'], ['icon', 'Ícono'], ['image', 'Mi imagen o logo']]),
      seal.type === 'icon' && h('div', { class: 'seal-icons' }, Object.entries(SEAL_ICONS).map(([k, ic]) => h('button', {
        type: 'button', class: `seal-icon${seal.icon === k ? ' on' : ''}`, title: ic.label,
        onclick: () => { seal.icon = k; changed({ rebuild: true, replay: true }); } }, h('span', { svg: sealIcon(k) }), h('small', null, ic.label)))),
      seal.type === 'initials' && field('Iniciales (hasta 4)', 'opening.seal.text', { placeholder: 'L&M', maxlength: 4 }),
      seal.type === 'image' && mediaField('Imagen del sello', 'opening.seal.image', { max: 400, help: 'Se recorta en círculo. Un logo o monograma queda muy bien.' })),
    card({ icon: '✍️', title: 'Nombre del invitado' },
      fontPicker('Letra del nombre (en el sobre y en la tarjeta)', 'theme.fontName', 'script', preset.fontName || preset.fontScript, 'Carolina Arévalo'),
      field('Si el enlace no trae nombre, escribir', 'guest.fallback', { placeholder: 'Para ti' })),
    style !== 'none' && style !== 'curtain' && card({ icon: '💌', title: 'La carta que sale del sobre', sub: 'Vacío = el título y subtítulo de la invitación' },
      field('Título', 'opening.letter.title', { placeholder: cfg.sections.header.title || 'PROM' }),
      field('Subtítulo', 'opening.letter.subtitle', { placeholder: cfg.sections.header.names || 'Una tarde para celebrar' }),
      field('Texto corto (opcional)', 'opening.letter.text', { placeholder: 'Para {nombre}, con cariño' }),
      hint('Escribe {nombre} donde quieras que aparezca el nombre de cada invitado.'),
      h('div', { class: 'colors' }, colorField('Papel de la carta', 'letterPaper', { ...preset, letterPaper: preset.letterPaper }), colorField('Letras de la carta', 'letterInk', preset)),
      control('opening.letter.ornament', { type: 'checkbox', label: 'Adorno arriba del título' })),
  );
}

const TZ = [
  ['-05:00', 'Colombia, Perú, Ecuador, Panamá (UTC−5)'], ['-06:00', 'México, Centroamérica (UTC−6)'],
  ['-04:00', 'Venezuela, Bolivia, R. Dominicana, Chile (UTC−4)'], ['-03:00', 'Argentina, Uruguay, Paraguay, Brasil (UTC−3)'],
  ['+01:00', 'España en invierno (UTC+1)'], ['+02:00', 'España en verano (UTC+2)'],
];

const GENDERS = [['f', 'Mujer'], ['m', 'Hombre'], ['p', 'Grupo'], ['', 'Sin especificar']];
const GENDER_ICON = { f: '♀', m: '♂', p: '👥' };

/** Live sample of how a text reads for a woman, a man and a group. */
function genderExamples(text) {
  if (!text || !['f', 'm', 'p'].some(g => genderize(text, g) !== text)) return null;
  return h('p', { class: 'hint gx' }, ['f', 'm', 'p'].flatMap(g => [h('b', null, `${GENDER_ICON[g]} `), genderize(text, g), '   ']));
}

function contentTab() {
  const S = 'sections.';
  const sec = cfg.sections;
  const items = sec.itinerary.items, colors = sec.dresscode.colors, imgs = sec.gallery.images;
  const multi = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  multi.onchange = async () => {
    const files = [...multi.files];
    for (const [n, f] of files.entries()) {
      toast(`Subiendo foto ${n + 1} de ${files.length}…`, 30000);
      try {
        const r = await uploadFile(EVENT_ID, dataUriToBlob(await compressImage(f, { max: 2000 })), 'foto.jpg');
        imgs.push({ src: r.url, alt: '' });
      } catch (e) { toast(e.message); }
    }
    toast('Fotos agregadas ✓');
    changed({ rebuild: true });
  };
  return page('Contenido', 'Los textos de la tarjeta, en el orden en que aparecen. Apaga lo que no quieras mostrar.',
    card({ id: 'event', icon: '📅', title: 'Fecha y lugar', sub: cfg.event.date ? `${cfg.event.date} · ${cfg.event.time || ''}` : 'Falta la fecha', collapsible: true, toggle: S + 'when.enabled' },
      h('div', { class: 'grid3' }, field('Fecha', 'event.date', { type: 'date' }), field('Hora', 'event.time', { type: 'time' }), field('Termina', 'event.endTime', { type: 'time' })),
      field('Lugar', 'event.venue', { placeholder: 'Salón Los Robles' }),
      field('Dirección', 'event.address', { placeholder: 'Calle 10 # 5-20, Ciudad' }),
      h('div', { class: 'grid2' }, field('Zona horaria', 'event.tz', { type: 'select', options: TZ }),
        field('Nombre para los mensajes', 'event.name', { placeholder: 'nuestro Prom', help: '"confirmo mi asistencia a …"' }))),
    card({ id: 'header', icon: '✨', title: 'Encabezado', sub: 'Frase, título, subtítulo y saludo con el nombre', collapsible: true, toggle: S + 'header.enabled' },
      field('Frase arriba del título', S + 'header.pretitle', { placeholder: 'Estás invitado(a) a nuestro', help: 'Se ajusta sola a cada invitado: escribe "invitado(a)", "querido(a)", "tutor(a)"…' }),
      genderExamples(cfg.sections.header.pretitle),
      field('Título', S + 'header.title', { placeholder: 'PROM' }),
      field('Subtítulo', S + 'header.names', { placeholder: 'Una tarde para celebrar' }),
      field('Saludo antes del nombre', S + 'header.greeting', { placeholder: 'Querido(a) docente', help: 'Cada invitado puede tener el suyo: "Querido rector", "Querida tutora"… (pestaña Invitados).' }),
      genderExamples(cfg.sections.header.greeting),
      h('div', { class: 'field' }, h('span', null, 'El nombre del invitado va'), choices(S + 'header.guestPosition', [['after', 'Debajo del título'], ['before', 'Arriba del título']]))),
    card({ id: 'message', icon: '📝', title: 'Mensaje', collapsible: true, toggle: S + 'message.enabled' },
      field('Mensaje', S + 'message.text', { type: 'textarea', rows: 6, help: 'Deja una línea en blanco para separar párrafos. Cada invitado puede tener el suyo.' })),
    card({ id: 'countdown', icon: '⏳', title: 'Cuenta regresiva', collapsible: true, toggle: S + 'countdown.enabled' },
      h('div', { class: 'grid2' }, field('Título', S + 'countdown.title', { placeholder: 'Faltan' }), field('Cuando llegue el día', S + 'countdown.doneText')),
      !cfg.event.date && h('p', { class: 'warn' }, 'Pon la fecha del evento para que aparezca.')),
    card({ id: 'location', icon: '📍', title: 'Ubicación', sub: 'Botón "Cómo llegar" y mapa', collapsible: true, toggle: S + 'location.enabled' },
      field('Enlace de Google Maps (opcional)', S + 'location.mapsUrl', { type: 'url', placeholder: 'https://maps.app.goo.gl/…', help: 'Vacío = se busca la dirección del evento.' }),
      h('div', { class: 'grid2' }, field('Título', S + 'location.title'), field('Texto del botón', S + 'location.buttonText')),
      control(S + 'location.embed', { type: 'checkbox', label: 'Mostrar el mapa dentro de la invitación' })),
    card({ id: 'dresscode', icon: '👗', title: 'Código de vestimenta', collapsible: true, toggle: S + 'dresscode.enabled' },
      field('Título', S + 'dresscode.title'),
      field('Indicaciones', S + 'dresscode.text', { type: 'textarea', rows: 2, placeholder: 'Formal (negro o blanco)' }),
      h('div', { class: 'field' }, h('span', null, 'Colores sugeridos'),
        h('div', { class: 'colors-list' },
          colors.map((c, i) => h('div', { class: 'color-chip' },
            h('input', { type: 'color', value: c, 'aria-label': `Color ${i + 1}`, oninput: e => { colors[i] = e.target.value; changed(); } }),
            h('button', { type: 'button', 'aria-label': 'Quitar color', onclick: () => { colors.splice(i, 1); changed({ rebuild: true }); } }, '✕'))),
          h('button', { class: 'btn sm', type: 'button', onclick: () => { colors.push(resolveTheme(cfg.theme).primary); changed({ rebuild: true }); } }, '+ Color')))),
    card({ id: 'itinerary', icon: '🕖', title: 'Itinerario', collapsible: true, toggle: S + 'itinerary.enabled' },
      field('Título', S + 'itinerary.title'),
      h('div', { class: 'list' }, items.map((it, i) => h('div', { class: 'list-row' },
        h('input', { type: 'time', value: it.time || '', 'aria-label': 'Hora', oninput: e => { it.time = e.target.value; changed(); } }),
        h('div', { class: 'stack' },
          h('input', { type: 'text', value: it.title || '', placeholder: 'Momento (ej. Cena)', oninput: e => { it.title = e.target.value; changed(); } }),
          h('input', { type: 'text', value: it.text || '', placeholder: 'Detalle (opcional)', oninput: e => { it.text = e.target.value; changed(); } })),
        h('button', { class: 'x-btn', type: 'button', 'aria-label': 'Quitar', onclick: () => { items.splice(i, 1); changed({ rebuild: true }); } }, '✕')))),
      h('div', null, h('button', { class: 'btn sm', type: 'button', onclick: () => { items.push({ time: '', title: '', text: '' }); changed({ rebuild: true }); } }, '+ Agregar momento'))),
    card({ id: 'gallery', icon: '📸', title: 'Galería de fotos', collapsible: true, toggle: S + 'gallery.enabled' },
      field('Título', S + 'gallery.title'),
      imgs.length > 0 && h('div', { class: 'gallery-grid' }, imgs.map((im, i) => h('div', { class: 'gal-item', style: { 'background-image': `url("${im.src}")` } },
        h('button', { type: 'button', 'aria-label': 'Quitar foto', onclick: () => { imgs.splice(i, 1); changed({ rebuild: true }); } }, '✕')))),
      h('div', null, h('button', { class: 'btn sm primary', type: 'button', onclick: () => multi.click() }, svg(I.upload), 'Subir fotos'), multi)),
    card({ id: 'rsvp', icon: '✅', title: 'Confirmar asistencia', sub: sec.rsvp.phone ? 'Por WhatsApp' : 'Falta el número de WhatsApp', collapsible: true, toggle: S + 'rsvp.enabled' },
      field('WhatsApp que recibe las confirmaciones', S + 'rsvp.phone', { type: 'tel', placeholder: '573001234567', help: 'Con indicativo del país, sin + ni espacios.' }),
      h('div', { class: 'grid2' }, field('Título', S + 'rsvp.title'), field('Fecha límite (opcional)', S + 'rsvp.deadline', { type: 'date' })),
      field('Texto', S + 'rsvp.text', { type: 'textarea', rows: 2 }),
      control(S + 'rsvp.twoButtons', { type: 'checkbox', label: 'Mostrar también "No podré asistir"', rebuild: true }),
      h('div', { class: 'grid2' }, field('Botón sí', S + 'rsvp.yesLabel'), sec.rsvp.twoButtons && field('Botón no', S + 'rsvp.noLabel')),
      field('Mensaje al confirmar', S + 'rsvp.yesMessage', { type: 'textarea', rows: 2, help: '{nombre} = el invitado · {evento} = nombre para los mensajes.' }),
      sec.rsvp.twoButtons && field('Mensaje si no puede ir', S + 'rsvp.noMessage', { type: 'textarea', rows: 2 })),
    card({ id: 'calendar', icon: '🗓️', title: 'Agregar al calendario', collapsible: true, toggle: S + 'calendar.enabled' },
      field('Título', S + 'calendar.title'), hint('Botones para Google Calendar y para iPhone / Outlook.')),
    card({ id: 'closing', icon: '💛', title: 'Mensaje final', sub: sec.closing.title || '', collapsible: true, toggle: S + 'closing.enabled' },
      field('Frase grande', S + 'closing.title', { placeholder: '¡Te esperamos!' }),
      field('Texto', S + 'closing.text', { type: 'textarea', rows: 2, placeholder: 'Será un honor compartir esta tarde contigo.' }),
      field('Firma', S + 'closing.signature', { placeholder: 'Grado Décimo' })),
  );
}

function mediaTab() {
  const S = 'sections.', m = cfg.sections.media;
  return page('Multimedia', 'La imagen o el video principal. Si es tu tarjeta diseñada, márcala como "la invitación" y se muestra grande al abrir el sobre.',
    card({ icon: '🎬', title: 'Imagen o video principal', toggle: S + 'media.enabled' },
      choices(S + 'media.kind', [['video', '🎬 Video'], ['image', '🖼️ Imagen']]),
      ...(m.kind === 'image' ? [
        mediaField('Imagen', S + 'media.image.src', { help: 'Vertical u horizontal: si es horizontal, en el celular se pide girarlo.' }),
        control(S + 'media.image.intro', { type: 'checkbox', label: 'Esta imagen ES la invitación (se muestra grande al abrir el sobre)', rebuild: true }),
        !m.image.intro && h('div', { class: 'field' }, h('span', null, 'Animación dentro de la tarjeta'),
          choices(S + 'media.image.effect', [['kenburns', 'Zoom lento'], ['parallax', 'Parallax'], ['blur', 'Desenfoque'], ['glow', 'Marco brillante'], ['none', 'Ninguna']], { rebuild: false })),
      ] : [
        mediaField('Video', S + 'media.video.src', { kind: 'video', link: false, help: 'Se guarda con su calidad original y se repite en loop.',
          onPoster: p => { if (!cfg.sections.media.video.poster) cfg.sections.media.video.poster = p; if (!cfg.meta.image) cfg.meta.image = p; } }),
        !m.video.src && field('…o un enlace de YouTube / Vimeo', S + 'media.video.url', { type: 'url', placeholder: 'https://youtu.be/…' }),
        control(S + 'media.video.intro', { type: 'checkbox', label: 'Este video ES la invitación (se muestra grande al abrir el sobre, en loop)', rebuild: true }),
        !m.video.intro && h('div', { class: 'field' }, h('span', null, 'Dentro de la tarjeta'),
          choices(S + 'media.video.play', [['muted', 'Se reproduce solo, sin sonido'], ['button', 'Con botón de play']], { rebuild: false })),
      ]),
      h('p', { class: 'note' }, '¿Un video distinto para cada invitado (con su nombre)? Súbelos en la pestaña ',
        h('a', { href: '#', onclick: e => { e.preventDefault(); setTab('guests'); } }, 'Invitados'), '. Este es el que ve quien no tenga uno propio.')),
  );
}

let previewing = null;
function soundTab() {
  const mus = cfg.music;
  const builtin = mus.src.startsWith('builtin:') ? mus.src.slice(8) : '';
  const tryMelody = id => {
    sfx.init();
    if (previewing) { previewing.pause(); const same = previewing.id === id; previewing = null; render(); if (same) return; }
    const p = sfx.melody(id, .7); p.id = id; p.play(); previewing = p; render();
    setTimeout(() => { if (previewing === p) { p.pause(); previewing = null; render(); } }, 12000);
  };
  const tile = (id, title) => h('div', { class: `tile${builtin === id ? ' on' : ''}`, role: 'button', tabindex: 0,
    onclick: () => { mus.src = `builtin:${id}`; mus.enabled = true; changed({ rebuild: true }); } },
  h('span', { class: 'big' }, '🎼'), title,
  h('button', { class: 'btn sm', type: 'button', onclick: e => { e.stopPropagation(); tryMelody(id); } }, previewing?.id === id ? '■ Parar' : '▶ Escuchar'));
  return page('Sonido', 'Música de fondo y efectos al abrir. Suenan después del primer toque del invitado (así lo exigen los celulares).',
    card({ icon: '🎵', title: 'Música de fondo', toggle: 'music.enabled' },
      h('div', { class: 'tiles' }, Object.entries(sfx.MELODIES).map(([id, m]) => tile(id, m.label)),
        h('div', { class: `tile${mus.src && !builtin ? ' on' : ''}`, role: 'button', tabindex: 0, onclick: () => { if (builtin) { mus.src = ''; changed({ rebuild: true }); } } },
          h('span', { class: 'big' }, '🎧'), 'Mi canción', h('small', null, 'MP3 o enlace'))),
      (!builtin) && mediaField('Tu canción', 'music.src', { kind: 'audio', help: 'Se repite mientras la invitación está abierta. Hay un botón para pausarla.' }),
      field('Volumen', 'music.volume', { type: 'select', number: true, options: [[0.3, 'Bajo'], [0.6, 'Medio'], [0.9, 'Alto']] }),
      cfg.sections.media.enabled && cfg.sections.media.kind === 'video' && cfg.sections.media.video.intro && h('div', { class: 'field' },
        h('span', null, 'Mientras se ve el video de la invitación'),
        choices('music.duringVideo', [['music', '🎵 Suena la música (video en silencio)'], ['video', '🎬 Suena el video (la música después)']], { rebuild: true }))),
    card({ icon: '🔔', title: 'Efectos de sonido', toggle: 'sounds.enabled', sub: 'Sello, papel, campanita y transiciones suaves' },
      h('div', { class: 'choices' }, [['crack', 'Sello'], ['paper', 'Papel'], ['slide', 'Carta'], ['chime', 'Campanita'], ['page', 'Sección'], ['whoosh', 'Continuar']].map(([k, t]) =>
        h('button', { class: 'choice', type: 'button', onclick: () => { sfx.init(); sfx.configure({ enabled: true, volume: cfg.sounds.volume }); sfx.play(k); } }, `▶ ${t}`))),
      field('Volumen', 'sounds.volume', { type: 'select', number: true, options: [[0.35, 'Bajo'], [0.7, 'Medio'], [1, 'Alto']] })),
  );
}

/* ---------- Guests: name + their video → their link ---------- */

const prettyName = base => {
  const s = base.replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s === s.toLowerCase() ? s.replace(/\b\p{L}/gu, c => c.toUpperCase()) : s;
};
const newGuest = name => ({ slug: '', name, callName: '', gender: '', phone: '', greeting: '', pretitle: '', message: '', image: '', video: '', seats: '' });
let bulk = null;                                         // { done, total, name } while uploading several videos

async function bulkVideos(files) {
  const vids = [...files].filter(f => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(f.name));
  if (!vids.length) return toast('Elige archivos de video');
  const jobs = vids.map(f => {
    const base = f.name.replace(/\.[^.]+$/, '');
    const key = slugify(base);
    let g = cfg.guests.find(x => x.slug === key || slugify(x.name) === key);
    if (!g) { g = newGuest(prettyName(base)); cfg.guests.push(g); }
    return { f, g };
  });
  fixSlugs(cfg.guests);
  bulk = { done: 0, total: jobs.length, name: '' };
  changed({ rebuild: true });
  for (const { f, g } of jobs) {
    bulk.name = g.name;
    await uploadTo(keyOf(g), f, f.name, r => { g.video = r.url; if (r.poster && !g.image) g.image = r.poster; });
    bulk.done++;
    await saveNow();
  }
  toast(`Listo: ${bulk.done} video(s) asignados ✓`, 4000);
  bulk = null;
  render();
}

/** WhatsApp message for a guest: {nombre} = how you call them ("Señor Rector") or, if empty, their name. */
const shareText = g => genderize(fillTemplate(cfg.share.message, { nombre: g.callName || g.name, enlace: guestLink(g) }), g.gender);

function guestRow(g, i) {
  const id = `g:${i}`;
  const isOpen = open.has(id);
  const gp = `guests.${i}.`;
  const key = keyOf(g);
  const st = uploads.get(key);
  const waHref = () => `https://wa.me/${(g.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(shareText(g))}`;
  const waBtn = h('a', { class: 'btn sm wa', href: waHref(), target: '_blank', rel: 'noopener', title: 'Enviar por WhatsApp' }, 'WhatsApp');
  const input = h('input', { type: 'file', accept: 'video/*', hidden: true });
  input.onchange = () => {
    const f = input.files[0]; input.value = '';
    if (f) uploadTo(key, f, f.name, r => { g.video = r.url; if (r.poster && !g.image) g.image = r.poster; });
  };
  const videoChip = st
    ? h('span', { class: 'chip up-text' }, st.phase === 'processing' ? 'Preparando el video…' : `Subiendo ${Math.round(st.frac * 100)} %`)
    : g.video ? h('span', { class: 'chip ok' }, '🎬 Video listo')
      : h('span', { class: 'chip warn' }, 'Sin video · ', h('button', { type: 'button', onclick: () => input.click() }, 'Subir'));
  const msgPreview = h('p', { class: 'hint gx' }, h('b', null, 'Mensaje: '), shareText(g));
  const more = !isOpen ? null : h('div', { class: 'grow-more' },
    h('div', { class: 'grid2' },
      h('div', { class: 'field' }, h('span', null, 'Su video'),
        h('div', { class: 'row', style: { display: 'flex', gap: '6px', 'flex-wrap': 'wrap' } },
          h('button', { class: 'btn sm primary', type: 'button', onclick: () => input.click() }, svg(I.upload), g.video ? 'Cambiar video' : 'Subir video'),
          g.video && h('button', { class: 'btn sm danger', type: 'button', onclick: () => { g.video = ''; changed({ rebuild: true }); } }, 'Quitar'))),
      field('Cupos (opcional)', gp + 'seats', { type: 'number', min: 0, max: 50, placeholder: 'ej. 2' })),
    mediaField('Imagen al compartir en WhatsApp', gp + 'image', { help: 'Se llena sola con un cuadro del video; puedes cambiarla.' }),
    h('p', { class: 'label' }, `Personalizar a ${g.name || 'este invitado'}`),
    h('div', { class: 'field' }, h('span', null, 'Trato (ajusta invitado/invitada, querido/querida…)'), choices(gp + 'gender', GENDERS)),
    h('div', { class: 'grid2' },
      field('Saludo propio', gp + 'greeting', { placeholder: genderize(cfg.sections.header.greeting, g.gender) || 'Querido rector, Querida tutora…' }),
      field('Frase arriba del título (propia)', gp + 'pretitle', { placeholder: genderize(cfg.sections.header.pretitle, g.gender) || 'Estás invitado a nuestro' })),
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, h('span', null, 'Cómo llamarlo en WhatsApp'),
        h('input', { type: 'text', value: g.callName || '', placeholder: 'Señor Rector, Profesora Carolina…',
          oninput: e => { g.callName = e.target.value; msgPreview.replaceChildren(h('b', null, 'Mensaje: '), shareText(g)); waBtn.href = waHref(); changed(); } }),
        h('p', { class: 'hint' }, 'Va en el mensaje: "Hola Señor Rector…". Vacío = su nombre.')),
      field('Su WhatsApp (opcional)', gp + 'phone', { type: 'tel', placeholder: '573001234567', help: 'Para enviarle el enlace directo.' })),
    msgPreview,
    field('Mensaje propio (opcional)', gp + 'message', { type: 'textarea', rows: 3, placeholder: 'Vacío = el mensaje general' }),
    h('label', { class: 'field' }, h('span', null, 'Enlace'), h('div', { style: { display: 'flex', 'align-items': 'center', gap: '4px' } },
      h('span', { class: 'muted', style: { 'white-space': 'nowrap' } }, `${location.host}/${ev.slug}/`),
      h('input', { type: 'text', value: g.slug, onchange: e => { g.slug = e.target.value; fixSlugs(cfg.guests); changed({ rebuild: true }); } }))),
    h('div', { style: { display: 'flex', gap: '6px', 'flex-wrap': 'wrap' } },
      h('button', { class: 'btn sm', type: 'button', onclick: () => showAs(g.slug) }, svg(I.play), 'Ver en la vista previa'),
      h('a', { class: 'btn sm', href: guestLink(g), target: '_blank', rel: 'noopener' }, svg(I.open), 'Abrir su enlace'),
      h('button', { class: 'btn sm danger', type: 'button', onclick: () => { if (confirm(`¿Quitar a ${g.name}?`)) { cfg.guests.splice(i, 1); open.delete(id); changed({ rebuild: true }); } } }, svg(I.trash), 'Quitar')));
  return h('div', { class: `grow${isOpen ? ' open' : ''}`, 'data-up': key },
    h('div', { class: 'grow-main' },
      h('div', { class: 'g-thumb', style: g.image ? { 'background-image': `url("${g.image}")` } : null },
        g.image ? '' : (g.name || '?').charAt(0).toUpperCase(), g.video && h('span', { class: 'play' }, '▶')),
      h('div', { class: 'g-info' },
        h('input', { class: 'g-name', type: 'text', value: g.name, 'aria-label': 'Nombre', placeholder: 'Nombre del invitado',
          oninput: e => { g.name = e.target.value; changed(); },
          onchange: () => { g.slug = slugify(g.name); fixSlugs(cfg.guests); changed({ rebuild: true }); } }),
        h('div', { class: 'g-meta' },
          h('button', { class: `chip gender${g.gender ? ' set' : ''}`, type: 'button', title: 'Trato: toca para cambiar',
            onclick: () => { const order = ['', 'f', 'm', 'p']; g.gender = order[(order.indexOf(g.gender || '') + 1) % order.length]; changed({ rebuild: true }); } },
          g.gender ? `${GENDER_ICON[g.gender]} ${GENDERS.find(x => x[0] === g.gender)[1]}` : 'Trato ▾'),
          videoChip, Number(g.seats) > 0 && h('span', { class: 'chip' }, `👥 ${g.seats}`),
          h('span', { class: 'g-link' }, shortLink(guestLink(g))))),
      h('div', { class: 'g-actions' },
        h('button', { class: 'btn sm', type: 'button', title: 'Copiar su enlace', onclick: () => copy(guestLink(g), `Enlace de ${g.name} copiado`) }, svg(I.copy), 'Copiar'),
        waBtn,
        h('button', { class: `btn sm${isOpen ? ' primary' : ''}`, type: 'button', 'aria-expanded': String(isOpen),
          onclick: () => { isOpen ? open.delete(id) : open.add(id); render(); } }, isOpen ? 'Listo ✓' : '✏️ Personalizar'))),
    st && h('div', { class: `progress${st.phase === 'processing' ? ' indeterminate' : ''}` }, h('i', { style: { width: `${Math.round(st.frac * 100)}%` } })),
    input, more);
}

function guestsTab() {
  const guests = cfg.guests;
  const withVideo = guests.filter(g => g.video).length;
  const filesIn = h('input', { type: 'file', accept: 'video/*', multiple: true, hidden: true, onchange: e => { bulkVideos(e.target.files); e.target.value = ''; } });
  const dz = h('div', { class: 'dropzone' },
    h('div', { class: 'dz-ic' }, svg(I.upload)),
    h('b', null, 'Sube los videos de tus invitados'),
    h('p', null, 'Arrástralos aquí o elígelos. Nombra cada archivo con el nombre del invitado (ej. ', h('em', null, 'Carolina Arévalo.mp4'), '): se crea su enlace solo.'),
    h('button', { class: 'btn primary', type: 'button', onclick: () => filesIn.click() }, svg(I.upload), 'Elegir videos'), filesIn);
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); bulkVideos(e.dataTransfer.files); });
  const names = h('textarea', { rows: 2, placeholder: 'O escribe nombres, uno por línea' });
  return page('Invitados', 'Cada invitado tiene su enlace con su nombre en el sobre. Con "✏️ Personalizar" le pones su trato (invitado/invitada), su saludo (Querido rector, Querida tutora…), su video, su mensaje y más.',
    h('div', { class: 'stats', style: { 'margin-bottom': '14px' } },
      h('span', { class: 'stat' }, `👥 ${guests.length} invitado${guests.length === 1 ? '' : 's'}`),
      guests.length > 0 && h('span', { class: `stat ${withVideo === guests.length ? 'ok' : ''}` }, `🎬 ${withVideo} con video`),
      guests.length - withVideo > 0 && withVideo > 0 && h('span', { class: 'stat warn' }, `${guests.length - withVideo} sin video`)),
    card({ icon: '➕', title: 'Agregar invitados' },
      dz,
      bulk && h('div', { class: 'bulk-status' }, h('b', null, `Subiendo ${Math.min(bulk.done + 1, bulk.total)} de ${bulk.total}: ${bulk.name}`),
        h('div', { class: 'progress' }, h('i', { style: { width: `${(bulk.done / bulk.total) * 100}%` } }))),
      h('div', { class: 'or' }, 'o'),
      h('div', { class: 'add-names' }, names, h('button', { class: 'btn', type: 'button', onclick: () => {
        const list = names.value.split('\n').map(s => s.trim()).filter(Boolean);
        if (!list.length) return toast('Escribe al menos un nombre');
        list.forEach(n => cfg.guests.push(newGuest(n)));
        fixSlugs(cfg.guests);
        toast(`${list.length} invitado(s) agregado(s)`);
        changed({ rebuild: true });
      } }, 'Agregar'))),
    guests.length > 0 && h('div', { class: 'glist' }, guests.map(guestRow)),
    guests.length > 0 && card({ icon: '📤', title: 'Enviar a todos', sub: 'Mensaje con el que se comparte cada enlace' },
      field('Mensaje de WhatsApp', 'share.message', { type: 'textarea', rows: 2, help: '{nombre} = cómo llamas a cada invitado ("Señor Rector"; si no lo escribiste, su nombre) · {enlace} = su enlace.' }),
      h('div', { style: { display: 'flex', gap: '8px', 'flex-wrap': 'wrap' } },
        h('button', { class: 'btn sm', type: 'button', onclick: () => copy(guests.map(g => `${g.name}: ${guestLink(g)}`).join('\n'), 'Todos los enlaces copiados') }, svg(I.copy), 'Copiar todos los enlaces'),
        h('button', { class: 'btn sm', type: 'button', onclick: () => download(`invitados-${ev.slug}.csv`, '﻿Nombre;Video;Cupos;WhatsApp;Enlace\n' + guests.map(g => [g.name, g.video ? 'sí' : 'no', g.seats || '', g.phone || '', guestLink(g)].map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv') }, '⬇️ Lista para Excel')),
      hint(`Para alguien que no esté en la lista: ${shortLink(eventLink())}?para=Nombre`)),
  );
}

/** How the link looks in WhatsApp — the same texts and image the server writes in the page. */
function waPreview(guest = null) {
  const m = cfg.meta, hd = cfg.sections.header;
  const event = [hd.title, hd.names].filter(Boolean).join(' · ') || m.title || ev.title;
  const title = guest ? `💌 ${guest.name}, tienes una invitación` : '💌 Tienes una invitación';
  const img = h('img', { alt: '' });
  if ((m.previewStyle || 'envelope') === 'envelope') {
    // drawn by the server from the saved invitation: wait for the save in progress
    saving.then(() => { img.src = `/og/${ev.slug}/${guest ? guest.slug : '_'}.jpg?t=${Date.now()}`; });
  } else {
    const own = (guest && guest.image) || m.image;
    if (own) img.src = own;
  }
  return h('div', { class: 'wa-card' }, img,
    h('div', null, h('b', null, title), h('span', null, `${event} · ${m.description || 'Toca para abrirla'}`), h('small', null, location.host)));
}

let previewGuest = '';
function shareTab() {
  const m = cfg.meta;
  const slugIn = h('input', { type: 'text', value: ev.slug, 'aria-label': 'Dirección', onchange: e => saveNow({ slug: e.target.value }) });
  return page('Compartir', 'La dirección de la invitación y cómo se ve el enlace al pegarlo en WhatsApp.',
    card({ icon: '🔗', title: 'Enlace general' },
      h('div', { class: 'link-box' }, h('input', { type: 'text', readonly: true, value: eventLink(), onclick: e => e.target.select() }),
        h('button', { class: 'btn primary', type: 'button', onclick: () => copy(eventLink(), 'Enlace copiado') }, svg(I.copy), 'Copiar')),
      h('div', { style: { display: 'flex', gap: '8px', 'flex-wrap': 'wrap' } },
        h('a', { class: 'btn sm wa', href: `https://wa.me/?text=${encodeURIComponent(eventLink())}`, target: '_blank', rel: 'noopener' }, 'Enviar por WhatsApp'),
        h('a', { class: 'btn sm', href: eventLink(), target: '_blank', rel: 'noopener' }, svg(I.open), 'Abrir'),
        h('button', { class: 'btn sm', type: 'button', onclick: () => setTab('guests') }, '👥 Enlaces por invitado')),
      h('label', { class: 'field' }, h('span', null, 'Dirección'), h('div', { style: { display: 'flex', 'align-items': 'center', gap: '4px' } }, h('span', { class: 'muted' }, `${location.host}/`), slugIn)),
      hint('Solo letras, números y guiones. Si la cambias, los enlaces que ya enviaste dejan de funcionar.')),
    card({ icon: '💬', title: 'Cómo se ve en WhatsApp', sub: 'Al pegar el enlace en un chat' },
      cfg.guests.length > 0 && h('select', { 'aria-label': 'Ver la vista previa de', onchange: e => { previewGuest = e.target.value; render(); } },
        h('option', { value: '' }, 'Enlace general'),
        cfg.guests.map(g => h('option', { value: g.slug, selected: previewGuest === g.slug }, `Enlace de ${g.name}`))),
      waPreview(cfg.guests.find(g => g.slug === previewGuest) || null),
      h('div', { class: 'field' }, h('span', null, 'Imagen'),
        choices('meta.previewStyle', [['envelope', '✉️ Sobre con el nombre (recomendado)'], ['image', '🖼️ Imagen propia']])),
      m.previewStyle === 'image'
        ? mediaField('Imagen propia (se recorta a 1200×630)', 'meta.image', { og: true, help: 'En el enlace de cada invitado se usa su propia imagen si la tiene.' })
        : hint('Se dibuja sola con los colores, la letra y el sello de tu invitación, y con el nombre de cada invitado.'),
      field('Texto debajo (opcional)', 'meta.description', { placeholder: 'Toca para abrirla', help: 'El título dice "💌 Nombre, tienes una invitación" (o "💌 Tienes una invitación" en el enlace general).' })),
    card({ icon: '💾', title: 'Copia de seguridad' },
      h('div', null, h('button', { class: 'btn sm', type: 'button', onclick: () => download(`${ev.slug || 'invitacion'}.json`, JSON.stringify(cfg, null, 2)) }, '⬇️ Descargar copia (.json)'))),
  );
}

const TAB_RENDER = { design: designTab, envelope: envelopeTab, content: contentTab, media: mediaTab, sound: soundTab, guests: guestsTab, share: shareTab };

/* ---------- Layout ---------- */

function setTab(id) {
  tab = id;
  try { localStorage.setItem(`ed-tab-${EVENT_ID}`, id); } catch { /* optional */ }
  renderTabs(); render(true);
}

function renderTabs() {
  $('#tabs').replaceChildren(...TABS.map(([id, text]) => h('button', { type: 'button', class: `tab${tab === id ? ' on' : ''}`, 'aria-current': tab === id ? 'page' : null, onclick: () => setTab(id) },
    svg(I[id]), text, id === 'guests' && cfg.guests.length > 0 && h('span', { class: 'count' }, cfg.guests.length))));
}

function render(top = false) {
  const y = pane.scrollTop;
  panel.replaceChildren(...TAB_RENDER[tab]());
  if (top) { panel.classList.remove('pane-in'); void panel.offsetWidth; panel.classList.add('pane-in'); }
  pane.scrollTop = top ? 0 : y;
  renderBar();
  const count = $('#tabs .tab:nth-child(6) .count');
  if (count) count.textContent = cfg.guests.length;
}

function showAs(slug) {
  previewAs = slug; renderBar(); sendPreview(true);
  document.body.classList.add('show-preview'); fitPhone();
}

function renderBar() {
  const sel = h('select', { 'aria-label': 'Ver como', onchange: e => { previewAs = e.target.value; sendPreview(true); } },
    h('option', { value: '', selected: !previewAs }, 'Ver como: invitado de ejemplo'),
    cfg.guests.map(g => h('option', { value: g.slug, selected: previewAs === g.slug }, `Ver como: ${g.name}`)));
  $('#pbar').replaceChildren(sel,
    h('button', { class: 'btn sm', type: 'button', onclick: () => sendPreview(true), title: 'Ver la apertura otra vez' }, svg(I.replay), 'Repetir'),
    h('button', { class: 'btn sm close-pv', type: 'button', onclick: () => document.body.classList.remove('show-preview') }, '✕ Volver'));
}

function renderTop() {
  const t = $('#evTitle');
  t.value = ev.title;
  t.oninput = () => { ev.title = t.value; document.title = `${ev.title} · Editor`; setStatus('Sin guardar', 'busy'); saveSoon(); };
  $('#openLink').href = eventLink();
  $('#shareBtn').onclick = shareDialog;
}

function shareDialog() {
  const d = h('dialog', null, h('div', { class: 'dlg' },
    h('button', { class: 'btn icon ghost dlg-close', type: 'button', 'aria-label': 'Cerrar', onclick: () => d.close() }, '✕'),
    h('h2', null, 'Compartir invitación'),
    h('div', { class: 'link-box' }, h('input', { type: 'text', readonly: true, value: eventLink(), onclick: e => e.target.select() }),
      h('button', { class: 'btn primary', type: 'button', onclick: () => copy(eventLink(), 'Enlace copiado') }, svg(I.copy), 'Copiar')),
    h('div', { style: { display: 'flex', gap: '8px', 'flex-wrap': 'wrap' } },
      h('a', { class: 'btn sm wa', href: `https://wa.me/?text=${encodeURIComponent(eventLink())}`, target: '_blank', rel: 'noopener' }, 'Enviar por WhatsApp'),
      h('a', { class: 'btn sm', href: eventLink(), target: '_blank', rel: 'noopener' }, svg(I.open), 'Abrir')),
    waPreview(),
    cfg.guests.length > 0
      ? h('p', { class: 'note' }, `Tienes ${cfg.guests.length} invitado(s) con enlace propio. `, h('a', { href: '#', onclick: e => { e.preventDefault(); d.close(); setTab('guests'); } }, 'Ver y enviar sus enlaces →'))
      : h('p', { class: 'hint' }, 'Para enviar un enlace con el nombre de cada persona, agrégalos en la pestaña Invitados.')));
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
  document.body.append(d);
  d.showModal();
}

/* Phone scaled to fit the space next to the form. */
function fitPhone() {
  const box = $('#phoneBox'), phone = $('#phone');
  const k = Math.min(1, (box.clientWidth - 40) / 390, (box.clientHeight - 24) / 844);
  phone.style.setProperty('--k', Math.max(.35, k).toFixed(3));
}

addEventListener('message', e => {
  if (e.origin !== location.origin || e.data?.type !== 'preview-ready') return;
  frameReady = true;
  sendPreview(true);
});

async function boot() {
  let data;
  try { data = await api(`/api/events/${EVENT_ID}`); }
  catch (e) { panel.replaceChildren(h('p', null, e.message, ' ', h('a', { href: '/panel' }, 'Volver al panel'))); return; }
  ev = { title: data.title, slug: data.slug };
  cfg = normalize(data.config);
  fixSlugs(cfg.guests);
  document.title = `${ev.title} · Editor`;
  try { const t = localStorage.getItem(`ed-tab-${EVENT_ID}`); if (TAB_RENDER[t]) tab = t; } catch { /* optional */ }
  setStatus('Guardado', 'ok');
  renderTop(); renderTabs(); render(true);
  frame.src = '/_preview/?preview=1';
  $('#fab').onclick = () => { document.body.classList.add('show-preview'); fitPhone(); };
  new ResizeObserver(fitPhone).observe($('#phoneBox'));
  fitPhone();
}

boot();
