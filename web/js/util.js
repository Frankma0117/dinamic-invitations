// Shared helpers for the invitation and the editor. No innerHTML with user data: everything goes through h().

export function h(tag, attrs = {}, ...kids) {
  const el = tag.startsWith('svg:')
    ? document.createElementNS('http://www.w3.org/2000/svg', tag.slice(4))
    : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'svg') el.innerHTML = v;               // only for the trusted, static SVG strings in decor.js
    else if (['value', 'checked', 'muted', 'selected'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false || kid === '') continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

/** Free text → paragraphs (blank line) and line breaks (single newline). */
export function paragraphs(text, cls = '') {
  return String(text || '').trim().split(/\n\s*\n/).filter(Boolean).map(p => {
    const lines = p.split('\n');
    return h('p', { class: cls }, lines.flatMap((l, i) => (i ? [h('br'), l] : [l])));
  });
}

export const filled = v => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== '');

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Event instant from "2026-12-05" + "19:00" + "-05:00". */
export function eventDate(ev, timeKey = 'time') {
  if (!ev?.date) return null;
  const t = ev[timeKey] || '00:00';
  const d = new Date(`${ev.date}T${t}:00${ev.tz || '-05:00'}`);
  return isNaN(d) ? null : d;
}

/** Dates are shown as written (the event's own time zone), never converted to the guest's zone. */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(d)) return dateStr;
  const s = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatTime(t) {
  if (!t) return '';
  const [H, M] = t.split(':').map(Number);
  const ap = H < 12 ? 'a. m.' : 'p. m.';
  const h12 = H % 12 || 12;
  return `${h12}:${String(M || 0).padStart(2, '0')} ${ap}`;
}

export function fillTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
}

export function waLink(phone, text) {
  const num = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

/** YouTube / Vimeo URL → embeddable URL (null if it is neither). */
export function videoEmbed(url, { autoplay = false, muted = false } = {}) {
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) {
    const p = new URLSearchParams({ rel: '0', playsinline: '1', modestbranding: '1' });
    if (autoplay) p.set('autoplay', '1');
    if (muted) p.set('mute', '1');
    return { kind: 'youtube', id: m[1], src: `https://www.youtube-nocookie.com/embed/${m[1]}?${p}` };
  }
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) {
    const p = new URLSearchParams({ playsinline: '1', title: '0', byline: '0' });
    if (autoplay) p.set('autoplay', '1');
    if (muted) p.set('muted', '1');
    return { kind: 'vimeo', id: m[1], src: `https://player.vimeo.com/video/${m[1]}?${p}` };
  }
  return null;
}

/* ---------- Calendar ---------- */

const icsStamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function eventRange(cfg) {
  const ev = cfg.event;
  const start = eventDate(ev);
  if (!start) return null;
  let end = eventDate(ev, 'endTime');
  if (!end || end <= start) end = end ? new Date(end.getTime() + 864e5) : new Date(start.getTime() + 5 * 36e5);
  return { start, end };
}

function calText(cfg) {
  const title = [cfg.sections.header.title, cfg.sections.header.names].filter(filled).join(' · ') || cfg.meta.title || 'Evento';
  const place = [cfg.event.venue, cfg.event.address].filter(filled).join(', ');
  return { title, place, details: cfg.meta.description || '' };
}

export function googleCalendarUrl(cfg) {
  const r = eventRange(cfg);
  if (!r) return null;
  const { title, place, details } = calText(cfg);
  const p = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${icsStamp(r.start)}/${icsStamp(r.end)}`, details, location: place });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function downloadIcs(cfg) {
  const r = eventRange(cfg);
  if (!r) return;
  const { title, place, details } = calText(cfg);
  const esc = s => String(s).replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Invitaciones//ES', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${icsStamp(r.start)}-${Math.random().toString(36).slice(2)}@invitacion`,
    `DTSTAMP:${icsStamp(new Date())}`, `DTSTART:${icsStamp(r.start)}`, `DTEND:${icsStamp(r.end)}`,
    `SUMMARY:${esc(title)}`, place && `LOCATION:${esc(place)}`, details && `DESCRIPTION:${esc(details)}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: 'evento.ics' });
  document.body.append(a); a.click(); a.remove();
}
