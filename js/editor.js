// Editor: form on the left, live preview on the right (an iframe of the invitation in preview mode).
// The draft is kept in this browser (IndexedDB); "Guardar config.json" downloads the file to publish.
import { h, fillTemplate } from './util.js';
import { normalize, getPath, setPath, SECTION_LABELS, fixSlugs, slugify } from './config.js';
import { THEMES, FONTS, TEXTURES, PARTICLES, resolveTheme } from './themes.js';
import { SEAL_ICONS } from './decor.js';
import { compressImage, previewImage, fileToDataURL, dataUriMB, draftGet, draftSet } from './image.js';

const SITE = new URL('../', location.href);           // folder of the invitation (index.html, config.json)
const $ = s => document.querySelector(s);
const panel = $('#panel'), frame = $('#frame');
let cfg = null;
let frameReady = false;
let previewAs = '';                                    // '' = general link; otherwise a guest slug
const openGroups = new Set(['design']);

/* ---------- Utilities ---------- */

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

const srcUrl = v => (!v ? '' : /^(data:|https?:|\/\/)/.test(v) ? v : new URL(v, SITE).href);

function siteUrl() {
  if (cfg.meta.url) return cfg.meta.url.replace(/\/+$/, '');
  return SITE.href.replace(/\/+$/, '');
}
const guestLink = g => `${siteUrl()}/${g.slug}/`;

/* ---------- Saving + preview ---------- */

const saveDraft = debounce(async () => {
  const ok = await draftSet('cfg', cfg);
  if (!ok) toast('No pude guardar el borrador en este navegador. Descarga el config.json para no perder cambios.', 5000);
}, 400);

const sendPreview = debounce((replay = false) => {
  if (!frameReady) return;
  const g = cfg.guests.find(x => x.slug === previewAs);
  frame.contentWindow.postMessage({ type: 'config', config: cfg, replay, as: g ? { slug: g.slug } : { slug: '', name: 'Laura Gómez' } }, location.origin);
}, 250);

function changed({ rebuild = false, replay = false } = {}) {
  saveDraft();
  sendPreview(replay);
  if (rebuild) renderPanel();
}

/* ---------- Form controls ---------- */

function control(path, o = {}) {
  const v = getPath(cfg, path);
  const set = val => { setPath(cfg, path, val); changed({ rebuild: o.rebuild, replay: path.startsWith('opening.') || path.startsWith('guest.') }); };
  if (o.type === 'textarea') {
    return h('textarea', { rows: o.rows || 4, placeholder: o.placeholder || '', value: v ?? '', oninput: e => set(e.target.value) });
  }
  if (o.type === 'select') {
    return h('select', { onchange: e => set(o.number ? Number(e.target.value) : e.target.value) },
      o.options.map(([val, label]) => h('option', { value: val, selected: String(val) === String(v ?? '') }, label)));
  }
  if (o.type === 'checkbox') {
    return h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!v, onchange: e => set(e.target.checked) }), h('i'), o.label || '');
  }
  if (o.type === 'color') {
    const shown = v || o.fallback || '#000000';
    const text = h('input', { type: 'text', value: v || '', placeholder: o.fallback ? 'del tema' : '#000000', maxlength: 7 });
    const pick = h('input', { type: 'color', value: shown, 'aria-label': 'Elegir color' });
    pick.oninput = () => { text.value = pick.value; set(pick.value); };
    text.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(text.value) || text.value === '') { if (text.value) pick.value = text.value; set(text.value); } };
    return h('div', { class: 'color' }, pick, text,
      o.fallback && h('button', { class: 'btn sm', type: 'button', title: 'Volver al color del tema', onclick: () => { setPath(cfg, path, ''); changed({ rebuild: true }); } }, '↺'));
  }
  return h('input', {
    type: o.type || 'text', value: v ?? '', placeholder: o.placeholder || '', min: o.min, max: o.max, step: o.step, maxlength: o.maxlength,
    oninput: e => set(o.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value),
  });
}

const field = (label, path, o = {}) => h('label', { class: 'field' }, h('span', null, label), control(path, o), o.help && h('p', { class: 'hint' }, o.help));
const hint = text => h('p', { class: 'hint' }, text);

/** Image upload: compressed in the browser and stored inside the config. */
function imageField(label, path, o = {}) {
  const v = getPath(cfg, path);
  const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    try {
      toast('Comprimiendo imagen…');
      const data = o.og ? await previewImage(f) : await compressImage(f, { max: o.max || 1600 });
      setPath(cfg, path, data);
      toast(`Imagen lista (${dataUriMB(data).toFixed(2)} MB)`);
      changed({ rebuild: true });
    } catch (e) { console.error(e); toast('No pude leer esa imagen. Prueba con JPG o PNG.'); }
  };
  return h('div', { class: 'field' }, h('span', null, label),
    h('div', { class: 'img-field' },
      h('div', { class: 'thumb', style: v ? { 'background-image': `url("${srcUrl(v)}")` } : null }, v ? '' : 'Sin imagen'),
      h('div', { class: 'img-actions' },
        h('div', { class: 'btns' },
          h('button', { class: 'btn sm primary', type: 'button', onclick: () => input.click() }, v ? 'Cambiar' : 'Subir imagen'),
          v && h('button', { class: 'btn sm danger', type: 'button', onclick: () => { setPath(cfg, path, ''); changed({ rebuild: true }); } }, 'Quitar')),
        o.help && hint(o.help), input)));
}

/** Audio / video: the file goes inside the config (better short), or a link. */
function fileField(label, path, { accept, maxMB = 30, help } = {}) {
  const v = getPath(cfg, path);
  const input = h('input', { type: 'file', accept, hidden: true });
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    const mb = f.size / 1048576;
    if (mb > maxMB) { toast(`El archivo pesa ${mb.toFixed(1)} MB; el máximo es ${maxMB} MB. Compártelo como enlace o comprímelo.`, 5000); return; }
    toast('Cargando archivo…');
    setPath(cfg, path, await fileToDataURL(f));
    toast(mb > 8 ? `Listo (${mb.toFixed(1)} MB). Es pesado: tardará en abrir con datos móviles.` : 'Archivo listo', 4000);
    changed({ rebuild: true });
  };
  const isData = typeof v === 'string' && v.startsWith('data:');
  return h('div', { class: 'field' }, h('span', null, label),
    h('div', { class: 'img-actions' },
      h('div', { class: 'btns' },
        h('button', { class: 'btn sm primary', type: 'button', onclick: () => input.click() }, 'Subir archivo'),
        v && h('button', { class: 'btn sm danger', type: 'button', onclick: () => { setPath(cfg, path, ''); changed({ rebuild: true }); } }, 'Quitar')),
      isData
        ? hint(`Archivo cargado (${dataUriMB(v).toFixed(1)} MB).`)
        : h('input', { type: 'url', placeholder: 'o pega un enlace directo (https://…/archivo)', value: v || '', oninput: e => { setPath(cfg, path, e.target.value.trim()); changed(); } }),
      help && hint(help), input));
}

function choices(path, options, { rebuild = true } = {}) {
  const v = getPath(cfg, path);
  return h('div', { class: 'choices', role: 'radiogroup' }, options.map(([val, label]) =>
    h('button', { type: 'button', class: `choice${v === val ? ' on' : ''}`, role: 'radio', 'aria-checked': String(v === val),
      onclick: () => { setPath(cfg, path, val); changed({ rebuild, replay: path.startsWith('opening.') }); } }, label)));
}

/** Collapsible group. `toggle` = path of an "enabled" flag shown in the title. */
function group(id, emoji, title, body, toggle) {
  const on = toggle ? !!getPath(cfg, toggle) : true;
  const d = h('details', { class: `group${on ? '' : ' off'}`, open: openGroups.has(id) || null });
  d.addEventListener('toggle', () => (d.open ? openGroups.add(id) : openGroups.delete(id)));
  const sw = toggle && h('label', { class: 'switch', title: on ? 'Visible' : 'Oculta', onclick: e => e.stopPropagation() },
    h('input', { type: 'checkbox', checked: on, 'aria-label': `Mostrar ${title}`, onchange: e => { setPath(cfg, toggle, e.target.checked); changed({ rebuild: true }); } }), h('i'));
  d.append(h('summary', null, h('span', { class: 'emoji', 'aria-hidden': 'true' }, emoji), h('span', { class: 'gtitle' }, title), sw),
    h('div', { class: 'gbody' }, body));
  return d;
}

/* ---------- Groups ---------- */

const fontOptions = (kindFirst, current) => {
  const order = ['serif', 'sans', 'script'];
  order.sort((a, b) => (a === kindFirst ? -1 : b === kindFirst ? 1 : 0));
  const names = order.flatMap(k => Object.entries(FONTS).filter(([, f]) => f.kind === k).map(([n]) => n));
  return [['', `Del tema (${current})`], ...names.map(n => [n, n])];
};

function designGroup() {
  const preset = resolveTheme({ preset: cfg.theme.preset });
  const t = resolveTheme(cfg.theme);
  const cards = Object.entries(THEMES).map(([key, th]) => h('button', {
    type: 'button', class: `theme-card${cfg.theme.preset === key ? ' on' : ''}`,
    onclick: () => {
      cfg.theme = { preset: key, primary: '', secondary: '', fontTitle: '', fontBody: '', fontScript: '', texture: '', particles: '' };
      changed({ rebuild: true });
    },
  }, h('div', { class: 'theme-swatch', style: { background: th.bg } }, h('b', { style: { background: th.paper } }), h('b', { style: { background: th.primary } }), h('b', { style: { background: th.secondary } })), th.label));
  return group('design', '🎨', 'Diseño y colores', [
    h('div', { class: 'themes' }, cards),
    h('div', { class: 'row2' },
      h('label', { class: 'field' }, h('span', null, 'Color principal'), control('theme.primary', { type: 'color', fallback: preset.primary })),
      h('label', { class: 'field' }, h('span', null, 'Color secundario'), control('theme.secondary', { type: 'color', fallback: preset.secondary }))),
    field('Letra de títulos', 'theme.fontTitle', { type: 'select', options: fontOptions('serif', preset.fontTitle) }),
    field('Letra del texto', 'theme.fontBody', { type: 'select', options: fontOptions('sans', preset.fontBody) }),
    field('Letra manuscrita (nombres)', 'theme.fontScript', { type: 'select', options: fontOptions('script', preset.fontScript) }),
    h('div', { class: 'row2' },
      field('Textura de fondo', 'theme.texture', { type: 'select', options: [['', `Del tema (${TEXTURES[preset.texture]})`], ...Object.entries(TEXTURES)] }),
      field('Partículas', 'theme.particles', { type: 'select', options: [['', `Del tema (${PARTICLES[preset.particles]})`], ...Object.entries(PARTICLES)] })),
    control('opening.confetti', { type: 'checkbox', label: 'Lanzar confeti al abrir' }),
    hint(`Usando: ${t.fontTitle} · ${t.fontBody} · ${t.fontScript}`),
  ]);
}

function openingGroup() {
  const seal = cfg.opening.seal;
  return group('opening', '💌', 'Apertura y sobre', [
    h('div', { class: 'field' }, h('span', null, 'Estilo de apertura'),
      choices('opening.style', [['envelope', '✉️ Sobre con carta'], ['diptych', '📖 Tarjeta díptico'], ['curtain', '🎭 Telón'], ['none', 'Sin animación']])),
    field('Texto para invitar a tocar', 'opening.hint', { placeholder: 'Toca para abrir' }),
    field('Texto si el enlace no trae nombre', 'guest.fallback', { placeholder: 'Para ti' }),
    h('div', { class: 'field' }, h('span', null, 'Sello de cera'), choices('opening.seal.type', [['initials', 'Iniciales'], ['icon', 'Ícono']])),
    seal.type === 'icon'
      ? h('div', { class: 'choices' }, Object.entries(SEAL_ICONS).map(([k, ic]) => h('button', { type: 'button', class: `choice${seal.icon === k ? ' on' : ''}`, onclick: () => { seal.icon = k; changed({ rebuild: true, replay: true }); } }, ic.label)))
      : field('Iniciales del sello (máx. 4)', 'opening.seal.text', { placeholder: 'L&M', maxlength: 4 }),
  ]);
}

const TZ = [
  ['-05:00', 'Colombia, Perú, Ecuador, Panamá (UTC−5)'], ['-06:00', 'México, Centroamérica (UTC−6)'],
  ['-04:00', 'Venezuela, Bolivia, R. Dominicana, Puerto Rico, Chile (UTC−4)'], ['-03:00', 'Argentina, Uruguay, Paraguay, Brasil (UTC−3)'],
  ['+01:00', 'España en invierno (UTC+1)'], ['+02:00', 'España en verano (UTC+2)'],
];

function eventGroup() {
  return group('event', '📅', 'Evento: fecha y lugar', [
    field('Nombre del evento para los mensajes', 'event.name', { placeholder: 'nuestra Fiesta de Grado', help: 'Se usa en "confirmo mi asistencia a …".' }),
    h('div', { class: 'row3' },
      field('Fecha', 'event.date', { type: 'date' }), field('Hora', 'event.time', { type: 'time' }), field('Termina', 'event.endTime', { type: 'time' })),
    field('Zona horaria', 'event.tz', { type: 'select', options: TZ }),
    field('Lugar', 'event.venue', { placeholder: 'Salón Los Robles' }),
    field('Dirección', 'event.address', { placeholder: 'Calle 10 # 5-20, Ciudad' }),
    control('sections.when.enabled', { type: 'checkbox', label: 'Mostrar fecha, hora y lugar', rebuild: true }),
  ]);
}

function sectionGroups() {
  const S = 'sections.';
  const out = [];
  out.push(group('header', '✨', SECTION_LABELS.header, [
    field('Saludo', S + 'header.greeting', { placeholder: 'Querido compañero(a)' }),
    field('Título del evento', S + 'header.title', { placeholder: 'Fiesta de Grado' }),
    field('Nombre(s) de los protagonistas', S + 'header.names', { placeholder: 'Promoción 2026' }),
  ], S + 'header.enabled'));

  out.push(group('message', '📝', SECTION_LABELS.message, [
    field('Mensaje', S + 'message.text', { type: 'textarea', rows: 7, help: 'Deja una línea en blanco para separar párrafos.' }),
  ], S + 'message.enabled'));

  const m = cfg.sections.media;
  out.push(group('media', '🖼️', SECTION_LABELS.media, [
    h('div', { class: 'field' }, h('span', null, 'Tipo'), choices(S + 'media.kind', [['image', '🖼️ Imagen'], ['video', '🎬 Video']])),
    ...(m.kind === 'image' ? [
      imageField('Imagen principal', S + 'media.image.src', { help: 'Se comprime sola. Ideal vertical (4:5).' }),
      field('Descripción de la imagen (accesibilidad)', S + 'media.image.alt'),
      h('div', { class: 'field' }, h('span', null, 'Animación'),
        choices(S + 'media.image.effect', [['kenburns', 'Zoom lento'], ['parallax', 'Parallax'], ['blur', 'Aparece desenfocada'], ['glow', 'Marco con brillo'], ['none', 'Ninguna']], { rebuild: false })),
    ] : [
      field('Enlace de YouTube o Vimeo', S + 'media.video.url', { type: 'url', placeholder: 'https://youtu.be/…', help: 'O sube un MP4 abajo (si hay ambos, se usa el MP4).' }),
      fileField('Video MP4', S + 'media.video.src', { accept: 'video/mp4,video/webm', maxMB: 40, help: 'Mejor corto y liviano (menos de 15 MB).' }),
      h('div', { class: 'field' }, h('span', null, 'Reproducción'), choices(S + 'media.video.play', [['muted', 'Sola y sin sonido al verla'], ['button', 'Con botón de play']], { rebuild: false })),
      control(S + 'media.video.intro', { type: 'checkbox', label: 'El video ES la invitación: mostrarlo a pantalla completa al abrir (con botón "Continuar")' }),
    ]),
  ], S + 'media.enabled'));

  out.push(group('countdown', '⏳', SECTION_LABELS.countdown, [
    field('Título', S + 'countdown.title', { placeholder: 'Faltan' }),
    field('Mensaje cuando llegue la fecha', S + 'countdown.doneText'),
    !cfg.event.date && h('p', { class: 'warn' }, 'Pon la fecha del evento para que aparezca.'),
  ], S + 'countdown.enabled'));

  out.push(group('location', '📍', SECTION_LABELS.location, [
    hint('Usa el lugar y la dirección del evento.'),
    field('Título', S + 'location.title'),
    field('Enlace de Google Maps (opcional)', S + 'location.mapsUrl', { type: 'url', placeholder: 'https://maps.app.goo.gl/…', help: 'Si lo dejas vacío, se busca la dirección.' }),
    field('Texto del botón', S + 'location.buttonText'),
    control(S + 'location.embed', { type: 'checkbox', label: 'Mostrar el mapa dentro de la invitación' }),
  ], S + 'location.enabled'));

  const colors = cfg.sections.dresscode.colors;
  out.push(group('dresscode', '👗', SECTION_LABELS.dresscode, [
    field('Título', S + 'dresscode.title'),
    field('Indicaciones', S + 'dresscode.text', { type: 'textarea', rows: 3, placeholder: 'Formal elegante' }),
    h('div', { class: 'field' }, h('span', null, 'Colores sugeridos'),
      h('div', { class: 'colors-list' },
        colors.map((c, i) => h('div', { class: 'color-chip' },
          h('input', { type: 'color', value: c, 'aria-label': `Color ${i + 1}`, oninput: e => { colors[i] = e.target.value; changed(); } }),
          h('button', { type: 'button', 'aria-label': 'Quitar color', onclick: () => { colors.splice(i, 1); changed({ rebuild: true }); } }, '✕'))),
        h('button', { class: 'btn sm', type: 'button', onclick: () => { colors.push(resolveTheme(cfg.theme).primary); changed({ rebuild: true }); } }, '+ Color'))),
  ], S + 'dresscode.enabled'));

  const items = cfg.sections.itinerary.items;
  out.push(group('itinerary', '🕖', SECTION_LABELS.itinerary, [
    field('Título', S + 'itinerary.title'),
    h('div', { class: 'list' }, items.map((it, i) => h('div', { class: 'list-row' },
      h('input', { type: 'time', value: it.time || '', 'aria-label': 'Hora', oninput: e => { it.time = e.target.value; changed(); } }),
      h('div', { class: 'stack' },
        h('input', { type: 'text', value: it.title || '', placeholder: 'Momento (ej. Cena)', oninput: e => { it.title = e.target.value; changed(); } }),
        h('input', { type: 'text', value: it.text || '', placeholder: 'Detalle (opcional)', oninput: e => { it.text = e.target.value; changed(); } })),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Quitar', onclick: () => { items.splice(i, 1); changed({ rebuild: true }); } }, '✕')))),
    h('button', { class: 'btn sm', type: 'button', onclick: () => { items.push({ time: '', title: '', text: '' }); changed({ rebuild: true }); } }, '+ Agregar momento'),
  ], S + 'itinerary.enabled'));

  const imgs = cfg.sections.gallery.images;
  const multi = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  multi.onchange = async () => {
    const files = [...multi.files];
    toast(`Comprimiendo ${files.length} foto(s)…`);
    for (const f of files) {
      try { imgs.push({ src: await compressImage(f, { max: 1280 }), alt: '' }); } catch { toast(`No pude leer ${f.name}`); }
    }
    changed({ rebuild: true });
    toast('Fotos agregadas');
  };
  out.push(group('gallery', '📸', SECTION_LABELS.gallery, [
    field('Título', S + 'gallery.title'),
    h('div', { class: 'gallery-grid' }, imgs.map((im, i) => h('div', { class: 'gal-item' },
      h('div', { class: 'thumb', style: { 'background-image': `url("${srcUrl(im.src)}")` } }),
      h('button', { type: 'button', 'aria-label': 'Quitar foto', onclick: () => { imgs.splice(i, 1); changed({ rebuild: true }); } }, '✕')))),
    h('button', { class: 'btn sm primary', type: 'button', onclick: () => multi.click() }, '+ Subir fotos'), multi,
  ], S + 'gallery.enabled'));

  out.push(group('rsvp', '✅', SECTION_LABELS.rsvp, [
    field('Número de WhatsApp que recibe las confirmaciones', S + 'rsvp.phone', { type: 'tel', placeholder: '573001234567', help: 'Con indicativo del país, sin + ni espacios (Colombia: 57…).' }),
    field('Título', S + 'rsvp.title'),
    field('Texto', S + 'rsvp.text', { type: 'textarea', rows: 2 }),
    field('Fecha límite para confirmar (opcional)', S + 'rsvp.deadline', { type: 'date' }),
    control(S + 'rsvp.twoButtons', { type: 'checkbox', label: 'Mostrar también "No podré asistir"', rebuild: true }),
    h('div', { class: 'row2' }, field('Botón sí', S + 'rsvp.yesLabel'), cfg.sections.rsvp.twoButtons && field('Botón no', S + 'rsvp.noLabel')),
    field('Mensaje al confirmar', S + 'rsvp.yesMessage', { type: 'textarea', rows: 2, help: '{nombre} = nombre del invitado, {evento} = nombre del evento.' }),
    cfg.sections.rsvp.twoButtons && field('Mensaje si no puede ir', S + 'rsvp.noMessage', { type: 'textarea', rows: 2 }),
    !cfg.sections.rsvp.phone && h('p', { class: 'warn' }, 'Sin número de WhatsApp esta sección no aparece.'),
  ], S + 'rsvp.enabled'));

  out.push(group('calendar', '🗓️', SECTION_LABELS.calendar, [
    field('Título', S + 'calendar.title'),
    hint('Botones para Google Calendar y para iPhone / Outlook (archivo .ics).'),
  ], S + 'calendar.enabled'));

  out.push(group('closing', '💛', SECTION_LABELS.closing, [
    field('Texto de cierre', S + 'closing.text', { type: 'textarea', rows: 3 }),
    field('Firma', S + 'closing.signature', { placeholder: 'Con cariño, Laura y Miguel' }),
  ], S + 'closing.enabled'));
  return out;
}

function musicGroup() {
  return group('music', '🎵', 'Música de fondo', [
    fileField('Canción (MP3)', 'music.src', { accept: 'audio/mpeg,audio/mp4,audio/ogg', maxMB: 15, help: 'Arranca al abrir el sobre. Un MP3 de 3–4 minutos pesa unos 4 MB.' }),
    field('Volumen', 'music.volume', { type: 'select', number: true, options: [[0.3, 'Bajo'], [0.6, 'Medio'], [0.9, 'Alto']] }),
  ], 'music.enabled');
}

/* ---------- Guests: personalized links ---------- */

function guestsGroup() {
  const guests = cfg.guests;
  const bulk = h('textarea', { rows: 4, placeholder: 'Pega aquí los nombres, uno por línea:\nLaura Gómez\nAndrés Pérez\nFamilia Rodríguez' });
  const addBulk = () => {
    const names = bulk.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!names.length) return toast('Escribe al menos un nombre');
    names.forEach(name => guests.push({ slug: '', name, phone: '', greeting: '', message: '', image: '', seats: '' }));
    fixSlugs(guests);
    toast(`${names.length} invitado(s) agregado(s)`);
    changed({ rebuild: true });
  };
  const shareText = g => fillTemplate(cfg.share.message, { nombre: g.name, enlace: guestLink(g) });
  const copy = async (text, msg = 'Copiado') => {
    try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt('Copia el texto:', text); }
  };

  const cards = guests.map((g, i) => {
    const d = h('details', { class: 'guest', open: openGroups.has('guest:' + i) || null });
    d.addEventListener('toggle', () => (d.open ? openGroups.add('guest:' + i) : openGroups.delete('guest:' + i)));
    const gp = `guests.${i}.`;
    const reslug = () => { g.slug = slugify(g.name); fixSlugs(guests); };
    d.append(
      h('summary', null,
        h('span', { class: 'avatar', style: g.image ? { 'background-image': `url("${srcUrl(g.image)}")` } : null }, g.image ? '' : (g.name || '?').charAt(0).toUpperCase()),
        h('span', null, h('div', { class: 'gname' }, g.name || 'Sin nombre'), h('div', { class: 'glink' }, guestLink(g)))),
      h('div', { class: 'gbody' },
        h('div', { class: 'guest-actions' },
          h('button', { class: 'btn sm', type: 'button', onclick: () => copy(guestLink(g), 'Enlace copiado') }, '📋 Copiar enlace'),
          h('a', { class: 'btn sm wa', href: `https://wa.me/${(g.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(shareText(g))}`, target: '_blank', rel: 'noopener' }, 'Enviar por WhatsApp'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => { previewAs = g.slug; renderBar(); sendPreview(true); document.body.classList.add('show-preview'); } }, '👁 Ver'),
          h('button', { class: 'btn sm danger', type: 'button', onclick: () => { if (confirm(`¿Quitar a ${g.name}?`)) { guests.splice(i, 1); changed({ rebuild: true }); } } }, 'Quitar')),
        h('div', { class: 'row2' },
          h('label', { class: 'field' }, h('span', null, 'Nombre (como se verá)'),
            h('input', { type: 'text', value: g.name, oninput: e => { g.name = e.target.value; changed(); }, onchange: () => { reslug(); changed({ rebuild: true }); } })),
          field('WhatsApp del invitado (opcional)', gp + 'phone', { type: 'tel', placeholder: '573001234567', rebuild: false })),
        h('div', { class: 'row2' },
          field('Saludo propio (opcional)', gp + 'greeting', { placeholder: cfg.sections.header.greeting || 'Querida Laura' }),
          field('Cupos (opcional)', gp + 'seats', { type: 'number', min: 0, max: 50, placeholder: 'ej. 2' })),
        imageField('Imagen propia (opcional)', gp + 'image', { help: 'Reemplaza la imagen principal y es la que se ve al compartir su enlace.' }),
        field('Mensaje propio (opcional)', gp + 'message', { type: 'textarea', rows: 3, placeholder: 'Vacío = el mensaje general' }),
        h('label', { class: 'field' }, h('span', null, 'Enlace corto'),
          h('input', { type: 'text', value: g.slug, oninput: e => { g.slug = e.target.value; }, onchange: () => { fixSlugs(guests); changed({ rebuild: true }); } })),
      ));
    return d;
  });

  return group('guests', '👥', `Invitados y enlaces (${guests.length})`, [
    h('p', { class: 'note' }, 'Cada invitado tiene su propio enlace con su nombre en el sobre. Opcional por invitado: imagen (también la de la vista previa en WhatsApp), saludo, mensaje y cupos. Lo que dejes vacío usa lo general.'),
    field('Dirección donde se publica la invitación', 'meta.url', { type: 'url', placeholder: 'https://invitaciones.cania.app', help: 'Con ella se arman los enlaces y la imagen de vista previa.', rebuild: false }),
    bulk, h('button', { class: 'btn primary', type: 'button', onclick: addBulk }, '+ Agregar invitados'),
    h('div', { class: 'list' }, cards),
    guests.length > 0 && h('div', { class: 'guest-actions' },
      h('button', { class: 'btn sm', type: 'button', onclick: () => copy(guests.map(g => `${g.name}: ${guestLink(g)}`).join('\n'), 'Todos los enlaces copiados') }, '📋 Copiar todos los enlaces'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => download('enlaces-invitados.csv', '﻿Nombre;WhatsApp;Cupos;Enlace\n' + guests.map(g => [g.name, g.phone || '', g.seats || '', guestLink(g)].map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv') }, '⬇️ Descargar lista (Excel)')),
    field('Mensaje para enviar el enlace', 'share.message', { type: 'textarea', rows: 2, help: '{nombre} y {enlace} se reemplazan solos.' }),
    hint('Para quien no esté en la lista: agrega ?para=Nombre al final de la dirección (ej. …/?para=Ana%20Ruiz).'),
  ]);
}

function shareGroup() {
  return group('share', '🔗', 'Vista previa al compartir (WhatsApp)', [
    field('Título', 'meta.title', { placeholder: 'Fiesta de Grado 2026 · Estás invitado(a)' }),
    field('Descripción', 'meta.description', { type: 'textarea', rows: 2 }),
    imageField('Imagen (se recorta a 1200×630)', 'meta.image', { og: true, help: 'Es la que aparece al pegar el enlace en WhatsApp.' }),
  ]);
}

/* ---------- Layout ---------- */

function renderPanel() {
  const y = panel.scrollTop;
  panel.replaceChildren(designGroup(), openingGroup(), eventGroup(), ...sectionGroups(), musicGroup(), guestsGroup(), shareGroup());
  panel.scrollTop = y;
  renderBar();
}

function renderBar() {
  const sel = h('select', { 'aria-label': 'Ver como', onchange: e => { previewAs = e.target.value; sendPreview(true); } },
    h('option', { value: '', selected: !previewAs }, 'Ver como: enlace general (?para=Laura Gómez)'),
    cfg.guests.map(g => h('option', { value: g.slug, selected: previewAs === g.slug }, `Ver como: ${g.name}`)));
  $('#pbar').replaceChildren(sel,
    h('button', { class: 'btn sm', type: 'button', onclick: () => sendPreview(true) }, '↻ Ver apertura otra vez'),
    h('button', { class: 'btn sm fab-close', type: 'button', onclick: () => document.body.classList.remove('show-preview') }, '✕ Volver a editar'));
}

function renderActions() {
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  file.onchange = async () => {
    try {
      cfg = normalize(JSON.parse(await file.files[0].text()));
      fixSlugs(cfg.guests);
      changed({ rebuild: true }); sendPreview(true);
      toast('Configuración cargada');
    } catch { toast('Ese archivo no es un config.json válido'); }
    file.value = '';
  };
  $('#actions').replaceChildren(
    h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, '📂 Abrir config.json'), file,
    h('button', { class: 'btn primary', type: 'button', onclick: saveFile }, '💾 Guardar config.json'),
    h('button', { class: 'btn', type: 'button', onclick: resetExample }, '↺ Empezar del ejemplo'),
  );
}

function saveFile() {
  fixSlugs(cfg.guests);
  const text = JSON.stringify(cfg, null, 2);
  download('config.json', text);
  const mb = text.length / 1048576;
  toast(mb > 15 ? `Guardado (${mb.toFixed(1)} MB). Es pesado: usa imágenes más livianas o la música como enlace.` : 'config.json descargado', 4000);
}

async function resetExample() {
  if (!confirm('¿Descartar tus cambios y cargar el ejemplo? (Guarda antes tu config.json si lo necesitas)')) return;
  cfg = await fetchConfig();
  changed({ rebuild: true }); sendPreview(true);
}

async function fetchConfig() {
  const res = await fetch(new URL('config.json', SITE), { cache: 'no-cache' });
  const c = normalize(res.ok ? await res.json() : {});
  fixSlugs(c.guests);
  return c;
}

/* Phone frame scaled to fit the available space. */
function fitPhone() {
  const box = $('#phoneBox'), phone = $('#phone');
  if (innerWidth <= 900) { phone.style.transform = 'none'; return; }   // on a phone the preview is full screen
  const k = Math.min(1, (box.clientWidth - 32) / 414, (box.clientHeight - 32) / 868);
  phone.style.transform = `scale(${Math.max(.3, k)})`;
}

addEventListener('message', e => {
  if (e.origin !== location.origin || e.data?.type !== 'preview-ready') return;
  frameReady = true;
  sendPreview(true);
});

async function boot() {
  const draft = await draftGet('cfg');
  cfg = draft ? normalize(draft) : await fetchConfig();
  fixSlugs(cfg.guests);
  if (draft) toast('Recuperé tu último borrador de este navegador');
  renderActions();
  renderPanel();
  frame.src = new URL('index.html?preview=1', SITE).href;
  $('#fab').onclick = () => { document.body.classList.add('show-preview'); fitPhone(); };
  new ResizeObserver(fitPhone).observe($('#phoneBox'));
  fitPhone();
}

boot();
