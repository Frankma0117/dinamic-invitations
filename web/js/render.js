// Builds the invitation's sections. A section that is off or empty is not rendered at all.
import { h, paragraphs, filled, formatDate, formatTime, fillTemplate, waLink, videoEmbed, googleCalendarUrl, downloadIcs } from './util.js';
import { SECTION_ORDER, eventName } from './config.js';
import { ornament, sectionDivider, corners, ICONS } from './decor.js';

const icon = (name, cls = 'ic') => h('span', { class: cls, svg: ICONS[name] });

// Children of a section appear one after another (--d = delay step).
function sec(id, title, ...kids) {
  const items = kids.flat(Infinity).filter(Boolean);
  let i = 0;
  const heading = filled(title) ? h('h2', { class: 'sec-title', 'data-reveal': '', style: { '--d': i++ } }, title) : null;
  items.forEach(el => { if (el instanceof Element && !el.hasAttribute('data-reveal')) { el.setAttribute('data-reveal', ''); el.style.setProperty('--d', i++); } });
  return h('section', { class: `sec sec-${id}`, id: `s-${id}` }, heading, items);
}

const BUILD = {
  header(s, cfg, ctx) {
    if (!filled(s.greeting) && !filled(s.title) && !filled(s.names)) return null;
    return sec('header', null,
      h('div', { class: 'ornament' }, h('span', { svg: ornament(ctx.decor) })),
      filled(s.greeting) && h('p', { class: 'greeting' }, s.greeting),
      ctx.guest && h('p', { class: 'guest-name' }, ctx.guest),
      ctx.seats > 0 && h('p', { class: 'seats' }, fillTemplate(cfg.guest.seatsText || 'Pase para {cupos}', { cupos: ctx.seats }).replace('(s)', ctx.seats === 1 ? '' : 's')),
      filled(s.title) && h('h1', { class: 'title' }, s.title),
      filled(s.names) && h('p', { class: s.names.length > 16 ? 'names long' : 'names' }, s.names),
    );
  },

  message(s) {
    if (!filled(s.text)) return null;
    return sec('message', null, paragraphs(s.text, 'lead'));
  },

  media(s, cfg, ctx) {
    if (s.kind === 'video') return videoBlock(s.video, ctx);
    const img = s.image;
    if (!filled(img.src) || img.intro) return null;          // an intro image is shown right after opening instead
    const effect = img.effect || 'none';
    const pic = h('img', { src: img.src, alt: img.alt || '', loading: 'lazy', decoding: 'async', 'data-parallax': effect === 'parallax' ? '' : null });
    return sec('media', null, h('figure', { class: `hero fx-${effect}` }, h('div', { class: 'hero-in' }, pic)));
  },

  when(s, cfg) {
    const ev = cfg.event;
    const rows = [
      filled(ev.date) && row('calendar', 'Fecha', formatDate(ev.date)),
      filled(ev.time) && row('clock', 'Hora', formatTime(ev.time) + (filled(ev.endTime) ? ` a ${formatTime(ev.endTime)}` : '')),
      (filled(ev.venue) || filled(ev.address)) && row('pin', 'Lugar', ev.venue, ev.address),
    ].filter(Boolean);
    if (!rows.length) return null;
    return sec('when', null, h('div', { class: 'when-list' }, rows));
  },

  countdown(s, cfg) {
    if (!filled(cfg.event.date)) return null;
    const unit = label => h('div', { class: 'cd-unit' }, h('div', { class: 'cd-num' }), h('div', { class: 'cd-label' }, label));
    return sec('countdown', s.title, h('div', { class: 'countdown', role: 'timer', 'aria-live': 'off' },
      unit('días'), unit('horas'), unit('min'), unit('seg')));
  },

  location(s, cfg) {
    const ev = cfg.event;
    const query = [ev.venue, ev.address].filter(filled).join(', ');
    if (!filled(query) && !filled(s.mapsUrl)) return null;
    const url = s.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    return sec('location', s.title,
      filled(ev.address) && h('p', { class: 'muted center' }, ev.address),
      s.embed && filled(query) && h('div', { class: 'map' }, h('iframe', {
        title: 'Mapa', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade',
        src: `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`,
      })),
      h('div', { class: 'center' }, h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener' }, icon('route'), s.buttonText || 'Cómo llegar')),
    );
  },

  dresscode(s) {
    const colors = (s.colors || []).filter(filled);
    if (!filled(s.text) && !colors.length) return null;
    return sec('dresscode', s.title,
      h('div', { class: 'center' }, icon('dress', 'ic big')),
      filled(s.text) && paragraphs(s.text, 'center'),
      colors.length && h('div', { class: 'swatches' }, colors.map(c => h('span', { class: 'swatch', style: { '--c': c }, title: c, 'aria-label': `Color ${c}` }))),
    );
  },

  itinerary(s) {
    const items = (s.items || []).filter(it => filled(it.title) || filled(it.time));
    if (!items.length) return null;
    return sec('itinerary', s.title, h('ol', { class: 'timeline' }, items.map(it =>
      h('li', null,
        h('span', { class: 'tl-time' }, filled(it.time) ? formatTime(it.time) : ''),
        h('span', { class: 'tl-dot', 'aria-hidden': 'true' }),
        h('div', { class: 'tl-body' }, h('strong', null, it.title), filled(it.text) && h('p', null, it.text)),
      ))));
  },

  gallery(s) {
    const imgs = (s.images || []).filter(im => filled(im.src));
    if (!imgs.length) return null;
    return sec('gallery', s.title, carousel(imgs));
  },

  rsvp(s, cfg, ctx) {
    if (!filled(s.phone)) return null;
    let nameInput = null;
    const send = yes => {
      const name = ctx.guest || nameInput?.value.trim();
      if (!name) { nameInput.focus(); nameInput.classList.add('shake'); setTimeout(() => nameInput.classList.remove('shake'), 500); return; }
      const msg = fillTemplate(yes ? s.yesMessage : s.noMessage, { nombre: name, evento: eventName(cfg) });
      window.open(waLink(s.phone, msg), '_blank', 'noopener');
    };
    if (!ctx.guest) nameInput = h('input', { class: 'input', type: 'text', placeholder: 'Escribe tu nombre', 'aria-label': 'Tu nombre', autocomplete: 'name', maxlength: '60' });
    return sec('rsvp', s.title,
      filled(s.text) && paragraphs(s.text, 'center'),
      filled(s.deadline) && h('p', { class: 'deadline' }, `Por favor confirma antes del ${formatDate(s.deadline).replace(/^\w/, c => c.toLowerCase())}`),
      nameInput && h('div', { class: 'center' }, nameInput),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn solid', type: 'button', onclick: () => send(true) }, icon('wa'), s.yesLabel || 'Asistiré'),
        s.twoButtons && h('button', { class: 'btn', type: 'button', onclick: () => send(false) }, s.noLabel || 'No podré asistir'),
      ),
    );
  },

  calendar(s, cfg) {
    const g = googleCalendarUrl(cfg);
    if (!g) return null;
    return sec('calendar', s.title, h('div', { class: 'btn-row' },
      h('a', { class: 'btn', href: g, target: '_blank', rel: 'noopener' }, icon('plus'), 'Google Calendar'),
      h('button', { class: 'btn', type: 'button', onclick: () => downloadIcs(cfg) }, icon('calendar'), 'iPhone / Outlook'),
    ));
  },

  closing(s) {
    if (!filled(s.text) && !filled(s.signature)) return null;
    return sec('closing', null, filled(s.text) && paragraphs(s.text, 'lead'), filled(s.signature) && h('p', { class: 'signature' }, s.signature));
  },
};

function row(ic, label, main, sub) {
  return h('div', { class: 'when-row' }, icon(ic, 'ic circle'),
    h('div', null, h('span', { class: 'when-label' }, label), filled(main) && h('strong', null, main), filled(sub) && h('span', { class: 'muted' }, sub)));
}

function videoBlock(v, ctx) {
  const emb = videoEmbed(v.url);
  if (!filled(v.src) && !emb) return null;
  if (v.intro) return null;                  // shown full screen right after opening (see introMedia); not repeated in the card
  const auto = v.play !== 'button';
  let el;
  if (filled(v.src)) {
    el = h('video', { src: v.src, poster: v.poster || null, playsinline: true, preload: 'metadata', controls: !auto, loop: true, muted: auto, 'data-autoplay': auto ? '' : null });
    if (auto) {
      const sound = h('button', { class: 'vid-sound', type: 'button', 'aria-label': 'Activar sonido' }, '🔇');
      sound.onclick = () => { el.muted = !el.muted; sound.textContent = el.muted ? '🔇' : '🔊'; if (!el.muted) { ctx.music?.pause(); el.play(); } };
      el = h('div', { class: 'vid-wrap' }, el, sound);
    } else el.addEventListener('play', () => ctx.music?.pause());
  } else if (auto) {
    el = h('iframe', { 'data-src': videoEmbed(v.url, { autoplay: true, muted: true }).src, 'data-autoplay': '', title: 'Video', allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: true });
  } else {
    const thumb = emb.kind === 'youtube' ? `https://i.ytimg.com/vi/${emb.id}/hqdefault.jpg` : v.poster;
    el = h('button', { class: 'vid-poster', type: 'button', 'aria-label': 'Reproducir video', style: thumb ? { 'background-image': `url("${thumb}")` } : null },
      h('span', { class: 'play', svg: ICONS.play }));
    el.onclick = () => {
      ctx.music?.pause();
      el.replaceWith(h('iframe', { src: videoEmbed(v.url, { autoplay: true }).src, title: 'Video', allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: true }));
    };
  }
  return sec('media', null, h('figure', { class: 'video' }, el));
}

function carousel(imgs) {
  const track = h('div', { class: 'car-track', tabindex: '0', 'aria-label': 'Galería: desliza para ver más' },
    imgs.map((im, i) => h('div', { class: 'car-slide' }, h('img', { src: im.src, alt: im.alt || `Foto ${i + 1}`, loading: 'lazy', decoding: 'async' }))));
  const dots = imgs.map((_, i) => h('button', { class: 'car-dot', type: 'button', 'aria-label': `Foto ${i + 1}`, onclick: () => go(i) }));
  const go = i => track.scrollTo({ left: track.clientWidth * i, behavior: 'smooth' });
  const current = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
  const sync = () => dots.forEach((d, i) => d.classList.toggle('on', i === current()));
  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  setTimeout(sync);
  if (imgs.length < 2) return h('div', { class: 'carousel' }, track);
  return h('div', { class: 'carousel' }, track,
    h('button', { class: 'car-arrow l', type: 'button', 'aria-label': 'Anterior', svg: ICONS.arrowL, onclick: () => go(Math.max(0, current() - 1)) }),
    h('button', { class: 'car-arrow r', type: 'button', 'aria-label': 'Siguiente', svg: ICONS.arrowR, onclick: () => go(Math.min(imgs.length - 1, current() + 1)) }),
    h('div', { class: 'car-dots' }, dots));
}

/** Returns the <main> with every visible section. ctx: { guest, seats, decor, music }. */
export function renderInvitation(cfg, ctx) {
  const parts = [];
  for (const id of SECTION_ORDER) {
    const s = cfg.sections[id];
    if (!s?.enabled) continue;
    const el = BUILD[id](s, cfg, ctx);
    if (!el) continue;
    if (parts.length && id !== 'countdown' && id !== 'calendar') parts.push(h('div', { class: 'divider', 'aria-hidden': 'true', 'data-reveal': '', svg: sectionDivider(ctx.decor) }));
    parts.push(el);
  }
  const art = corners(ctx.decor);
  return h('main', { class: 'invite' }, h('article', { class: 'card' },
    art && h('div', { class: 'corner tl', 'aria-hidden': 'true', svg: art }),
    art && h('div', { class: 'corner br', 'aria-hidden': 'true', svg: art }),
    parts));
}
