// The whole invitation lives in one config.json. DEFAULTS documents every key; normalize() fills what is missing.

export const SECTION_ORDER = ['header', 'message', 'media', 'when', 'countdown', 'location', 'dresscode', 'itinerary', 'gallery', 'rsvp', 'calendar', 'closing'];

export const SECTION_LABELS = {
  header: 'Encabezado', message: 'Mensaje principal', media: 'Imagen o video', when: 'Fecha, hora y lugar',
  countdown: 'Cuenta regresiva', location: 'Ubicación', dresscode: 'Código de vestimenta', itinerary: 'Itinerario',
  gallery: 'Galería de fotos', rsvp: 'Confirmar asistencia', calendar: 'Agregar al calendario', closing: 'Mensaje final',
};

export const DEFAULTS = {
  version: 1,
  meta: { title: '', description: '', image: '', url: '' },        // Open Graph (vista previa al compartir)
  guest: { param: 'para', fallback: 'Para ti', seatsText: 'Pase válido para {cupos} persona(s)' },   // ?para=Laura%20Gómez
  // Invitados con enlace propio (/laura-gomez/): cada campo vacío usa el general.
  // { slug, name, phone, greeting, message, image (imagen principal y de la vista previa en WhatsApp), seats }
  guests: [],
  share: { message: 'Hola {nombre} 💌 Te comparto tu invitación: {enlace}' },   // texto al enviar el enlace por WhatsApp
  event: { name: '', date: '', time: '', endTime: '', tz: '-05:00', venue: '', address: '' },
  opening: {
    style: 'envelope',                       // envelope | diptych | curtain | none
    hint: 'Toca para abrir',
    seal: { type: 'initials', text: '', icon: 'heart' },
    confetti: false,
  },
  theme: { preset: 'crema', primary: '', secondary: '', fontTitle: '', fontBody: '', fontScript: '', texture: '', particles: '' },
  music: { enabled: false, src: '', title: '', volume: 0.6 },
  sections: {
    header: { enabled: true, greeting: '', title: '', names: '' },
    message: { enabled: true, text: '' },
    media: {
      enabled: false, kind: 'image',         // image | video
      image: { src: '', alt: '', effect: 'kenburns' },  // kenburns | parallax | blur | glow | none
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
      yesMessage: 'Hola, soy {nombre} y confirmo mi asistencia a {evento}. 🎉',
      noMessage: 'Hola, soy {nombre}. Lamentablemente no podré asistir a {evento}. ¡Gracias por la invitación!',
    },
    calendar: { enabled: true, title: 'Guarda la fecha' },
    closing: { enabled: true, text: '', signature: '' },
  },
};

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

export function merge(base, over) {
  if (!isObj(over)) return over === undefined ? structuredClone(base) : over;
  const out = isObj(base) ? structuredClone(base) : {};
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : structuredClone(v);
  return out;
}

export const normalize = cfg => merge(DEFAULTS, cfg || {});

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
  keys.slice(0, -1).forEach(k => { if (!isObj(o[k])) o[k] = {}; o = o[k]; });
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
    if (['assets', 'css', 'js', 'editor', 'media'].includes(base)) base += '-inv';   // folders of the site
    let s = base;
    while (seen.has(s)) s = `${base}-${n++}`;
    g.slug = s; seen.add(s);
  }
  return guests;
}

/** The config as this guest sees it: their image, greeting and message replace the general ones. */
export function forGuest(cfg, g) {
  if (!g) return cfg;
  const c = structuredClone(cfg);
  const sec = c.sections;
  if (g.greeting) sec.header.greeting = g.greeting;
  if (g.message) sec.message.text = g.message;
  if (g.image) {
    // A full-screen intro video still plays (introVideo() reads the general config); the card shows their image.
    sec.media.enabled = true;
    sec.media.kind = 'image';
    sec.media.image.src = g.image;
    c.meta.image = g.image;
  }
  return c;
}

/** Video shown full screen right after opening (null if none). */
export function introVideo(cfg) {
  const m = cfg.sections.media, v = m.video;
  return m.enabled && m.kind === 'video' && v.intro && (v.src || v.url) ? v : null;
}
