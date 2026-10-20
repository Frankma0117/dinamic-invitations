// The whole invitation lives in one config.json. DEFAULTS documents every key; normalize() fills what is missing.

export const SECTION_ORDER = ['header', 'message', 'media', 'when', 'countdown', 'location', 'dresscode', 'itinerary', 'gallery', 'rsvp', 'calendar', 'closing'];

export const SECTION_LABELS = {
  header: 'Encabezado', message: 'Mensaje principal', media: 'Imagen o video', when: 'Fecha, hora y lugar',
  countdown: 'Cuenta regresiva', location: 'Ubicación', dresscode: 'Código de vestimenta', itinerary: 'Itinerario',
  gallery: 'Galería de fotos', rsvp: 'Confirmar asistencia', calendar: 'Agregar al calendario', closing: 'Mensaje final',
};

export const DEFAULTS = {
  version: 1,
  // Vista previa al compartir. previewStyle: 'envelope' = el servidor dibuja un sobre con el nombre de cada invitado;
  // 'image' = la imagen propia (meta.image o la del invitado).
  meta: { title: '', description: '', image: '', url: '', previewStyle: 'envelope' },
  guest: { param: 'para', fallback: 'Para ti', seatsText: 'Pase válido para {cupos} persona(s)' },   // ?para=Laura%20Gómez
  // Invitados con enlace propio (/laura-gomez/): cada campo vacío usa el general.
  // { slug, name, callName ("Señor Rector": va en el mensaje de WhatsApp), gender ('' | f | m | p = grupo), phone,
  //   greeting, pretitle, message, image, video, seats }
  guests: [],
  share: { message: 'Hola {nombre} ✨ Te comparto tu invitación: {enlace}' },   // texto al enviar el enlace por WhatsApp (sin emojis: algunos WhatsApp los muestran como �)
  event: { name: '', date: '', time: '', endTime: '', tz: '-05:00', venue: '', address: '' },
  opening: {
    style: 'envelope',                       // envelope | diptych | curtain | none
    hint: 'Toca para abrir',
    seal: { type: 'initials', text: '', icon: 'heart', image: '' },   // type: initials | icon | image
    confetti: false,
    // The letter that comes out of the envelope. Empty = title and subtitle of the header. {nombre} = the guest.
    letter: { title: '', subtitle: '', text: '', ornament: true },
  },
  sounds: { enabled: true, volume: 0.7 },     // seal, paper, page transitions (synthesized, no files)
  theme: { preset: 'crema' },                // + any key of THEME_KEYS (themes.js) to change a color or a font

  // src: file/URL or "builtin:<id>" (sfx.js MELODIES). duringVideo: 'music' = the music plays and the invitation video
  // is silent; 'video' = the video's own sound, the music starts on "Continuar".
  music: { enabled: false, src: '', title: '', volume: 0.6, duringVideo: 'music' },
  sections: {
    // pretitle → title → names (subtitle); then greeting + the guest's name ("Querida tutora · Carolina").
    header: { enabled: true, pretitle: '', title: '', names: '', greeting: '', guestPosition: 'after' },
    message: { enabled: true, text: '' },
    media: {
      enabled: false, kind: 'image',         // image | video
      image: { src: '', alt: '', effect: 'kenburns', intro: false },  // effect: kenburns | parallax | blur | glow | none; intro = la imagen ES la invitación
      video: { src: '', url: '', poster: '', play: 'muted', intro: false },   // play: muted (auto, sin sonido) | button
    },
    when: { enabled: true },
    countdown: { enabled: true, title: 'Faltan', doneText: '¡Hoy es el gran día!' },
    location: { enabled: false, title: 'Ubicación', mapsUrl: '', embed: true, buttonText: 'Cómo llegar' },
    dresscode: { enabled: false, title: 'Código de vestimenta', text: '', colors: [] },
    itinerary: { enabled: false, title: 'Itinerario', items: [] },          // { time, title, text }
    gallery: { enabled: false, title: 'Galería', images: [] },              // { src, alt }
    rsvp: {
      enabled: false, title: 'Confirma tu asistencia', text: '', phone: '', deadline: '', twoButtons: true,
      yesLabel: 'Asistiré', noLabel: 'No podré asistir',
      yesMessage: 'Hola, soy {nombre} y confirmo mi asistencia a {evento}.',
      noMessage: 'Hola, soy {nombre}. Lamentablemente no podré asistir a {evento}. ¡Gracias por la invitación!',
    },
    calendar: { enabled: true, title: 'Guarda la fecha' },
    closing: { enabled: true, title: '¡Te esperamos!', text: '', signature: '' },
  },
};

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

export function merge(base, over) {
  if (!isObj(over)) return over === undefined ? structuredClone(base) : over;
  const out = isObj(base) ? structuredClone(base) : {};
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : structuredClone(v);
  return out;
}

export function normalize(cfg) {
  const raw = structuredClone(cfg || {});
  // Before 2026-10-20 the header had only "greeting", used as the line above the title.
  const hd = raw.sections?.header;
  if (hd && !('pretitle' in hd)) { hd.pretitle = hd.greeting || ''; hd.greeting = ''; hd.guestPosition = 'after'; }
  const c = merge(DEFAULTS, raw);
  // A list that arrived as an object ({"0": {...}, "1": {...}}) is turned back into a list.
  for (const [obj, key] of [[c, 'guests'], [c.sections.itinerary, 'items'], [c.sections.gallery, 'images'], [c.sections.dresscode, 'colors']]) {
    if (!Array.isArray(obj[key])) obj[key] = obj[key] && typeof obj[key] === 'object' ? Object.values(obj[key]) : [];
  }
  return c;
}

export async function loadConfig(url = 'config.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No se pudo leer ${url} (${res.status})`);
  return normalize(await res.json());
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  // Lists stay lists: "guests.2.name" must change one guest, not replace the whole list.
  keys.slice(0, -1).forEach(k => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
  o[keys.at(-1)] = value;
}

/** Name for messages: "la Fiesta de Grado 2026" is up to the author; falls back to the title. */
export const eventName = cfg => cfg.event.name || cfg.sections.header.title || cfg.meta.title || 'el evento';

export function slugify(name) {
  return String(name || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'invitado';
}

/** Unique slugs for the whole list (laura, laura-2…). Mutates and returns the list. */
export function fixSlugs(guests) {
  const seen = new Set();
  for (const g of guests) {
    let base = slugify(g.slug || g.name), n = 2;
    if (['assets', 'css', 'js', 'editor', 'media', 'ejemplos'].includes(base)) base += '-inv';   // folders of the site
    let s = base;
    while (seen.has(s)) s = `${base}-${n++}`;
    g.slug = s; seen.add(s);
  }
  return guests;
}

/* ---------- Gender: one text, the right form for each guest ---------- */

// Words that change with the guest: invitado/invitada/invitados, querido/querida…
const GENDERED = /\b(invitad|querid|bienvenid|estimad|amad|apreciad|homenajead|esperad|honrad|consentid|admirad|respetad|recordad)([oa])(s?)\b/giu;

/**
 * Adjusts a text to the guest: f (mujer), m (hombre), p (grupo: familia, pareja). '' leaves it as written.
 * "invitado(a)" / "invitada" → invitada · invitado · invitados; "tutor(a)" → tutora · tutor · tutores;
 * for a group also "Estás" → "Están" and "te esperamos" → "los esperamos".
 */
export function genderize(text, gender) {
  if (!text || !['f', 'm', 'p'].includes(gender)) return text;
  const keepCase = (orig, s) => (orig === orig.toUpperCase() && orig !== orig.toLowerCase() ? s.toUpperCase() : s);
  let t = String(text).replace(/(\p{L}+)\((a|as)\)/giu, (m, w) => {
    if (gender === 'f') return /o$/i.test(w) ? w.slice(0, -1) + keepCase(w.slice(-1), 'a') : w + keepCase(w.slice(-1), 'a');
    if (gender === 'p') return /[aeiou]$/i.test(w) ? w + keepCase(w.slice(-1), 's') : w + keepCase(w.slice(-1), 'es');
    return w;
  });
  t = t.replace(GENDERED, (m, stem, v, s) => stem + keepCase(v, gender === 'f' ? 'a' : 'o') + (gender === 'p' ? keepCase(v, 's') : s));
  if (gender === 'p') {
    t = t.replace(/\b(E|e)stás\b/gu, (m, e) => `${e}stán`).replace(/\bESTÁS\b/gu, 'ESTÁN')
      .replace(/\b(T|t)e esperamos\b/gu, (m, x) => `${x === 'T' ? 'L' : 'l'}os esperamos`).replace(/\bTE ESPERAMOS\b/gu, 'LOS ESPERAMOS');
  }
  return t;
}

/** The config as this guest sees it: their video, image, greeting and message replace the general ones,
 *  and every text takes the right form for them (genderize). */
export function forGuest(cfg, g) {
  if (!g) return cfg;
  const c = structuredClone(cfg);
  const sec = c.sections, media = sec.media;
  if (g.greeting) sec.header.greeting = g.greeting;
  if (g.pretitle) sec.header.pretitle = g.pretitle;
  if (g.message) sec.message.text = g.message;
  if (g.gender) {
    const gz = t => genderize(t, g.gender);
    for (const k of ['pretitle', 'greeting']) sec.header[k] = gz(sec.header[k]);
    sec.message.text = gz(sec.message.text);
    for (const k of ['title', 'text', 'signature']) sec.closing[k] = gz(sec.closing[k]);
    sec.rsvp.text = gz(sec.rsvp.text);
    const lt = c.opening.letter || {};
    for (const k of ['title', 'subtitle', 'text']) lt[k] = gz(lt[k]);
  }
  if (g.video) {
    // Their own video (e.g. one with their name): same presentation as the general one, another file.
    media.enabled = true;
    media.kind = 'video';
    const isLink = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//.test(g.video);
    media.video = { ...media.video, src: isLink ? '' : g.video, url: isLink ? g.video : '' };
  }
  if (g.image) {
    c.meta.image = g.image;                     // always the WhatsApp preview
    if (introMedia(c)?.kind === 'video') media.video.poster = g.image;
    else { media.enabled = true; media.kind = 'image'; media.image.src = g.image; }   // their own card (keeps "intro")
  }
  return c;
}

/** Video or image that IS the invitation, shown big right after opening (null if none). */
export function introMedia(cfg) {
  const m = cfg.sections.media;
  if (!m.enabled) return null;
  if (m.kind === 'video') return m.video.intro && (m.video.src || m.video.url) ? { kind: 'video', ...m.video } : null;
  return m.image.intro && m.image.src ? { kind: 'image', ...m.image } : null;
}
