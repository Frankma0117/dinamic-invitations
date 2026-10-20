// Panel: sign in, list of invitations, create from a template, duplicate, delete, change password.
import { h, formatDate, formatTime } from './util.js';
import { THEMES } from './themes.js';
import { api, ApiError, copyText } from './api.js';

const app = document.getElementById('app');
let events = [];
let query = '';

let toastTimer;
function toast(msg, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

const linkOf = ev => `${location.origin}/${ev.slug}/`;

/** Cover: the invitation's image, or a small envelope in its theme colors. */
function cover(theme, img, onclick) {
  const t = THEMES[theme] || THEMES.crema;
  const vars = { '--t-bg': t.bg, '--t-env': t.envelope, '--t-seal': t.seal };
  const attrs = onclick ? { class: 'ev-cover', type: 'button', onclick, style: vars, 'aria-label': 'Editar' } : { class: 'ev-cover', style: vars };
  return h(onclick ? 'button' : 'div', attrs,
    img ? h('img', { src: img, alt: '', loading: 'lazy' }) : h('div', { class: 'mini-env' }, h('i')));
}

/* ---------- Sign in ---------- */

function loginView() {
  const pw = h('input', { type: 'password', autocomplete: 'current-password', required: true, placeholder: 'Tu contraseña' });
  const err = h('p', { class: 'error' });
  const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Entrar');
  const form = h('form', null, h('label', { class: 'field' }, 'Contraseña', pw), err, btn);
  form.onsubmit = async e => {
    e.preventDefault();
    btn.disabled = true; err.textContent = '';
    try { await api('/api/login', { method: 'POST', body: { password: pw.value } }); await dashboard(); }
    catch (x) { err.textContent = x.message; pw.select(); }
    finally { btn.disabled = false; }
  };
  app.replaceChildren(h('main', { class: 'login' }, h('div', { class: 'login-card' },
    h('img', { class: 'logo-env', src: '/assets/favicon.svg', alt: '' }),
    h('h1', { class: 'brand-name' }, 'Invitaciones'),
    h('p', { class: 'brand-sub' }, 'digitales con magia'),
    form)));
  pw.focus();
}

/* ---------- List ---------- */

function card(ev) {
  const edit = () => { location.href = `/panel/editar/${ev.id}`; };
  const when = [ev.date && formatDate(ev.date), ev.time && formatTime(ev.time)].filter(Boolean).join(' · ');
  return h('article', { class: 'ev' },
    h('div', { style: { position: 'relative' } }, cover(ev.theme, ev.cover, edit),
      h('div', { class: 'ev-badges' },
        h('span', { class: 'badge' }, THEMES[ev.theme]?.label || 'Tema'),
        ev.has_video && h('span', { class: 'badge' }, '🎬 Video'))),
    h('div', { class: 'ev-body' },
      h('h2', { class: 'ev-title' }, ev.title),
      h('div', { class: 'ev-meta' }, when && h('span', null, '📅 ', when), h('span', null, `👥 ${ev.guests} invitado${ev.guests === 1 ? '' : 's'}`)),
      h('a', { class: 'ev-link', href: linkOf(ev), target: '_blank', rel: 'noopener' }, linkOf(ev).replace(/^https?:\/\//, ''))),
    h('div', { class: 'ev-actions' },
      h('button', { class: 'btn primary', type: 'button', onclick: edit }, '✏️ Editar'),
      h('button', { class: 'btn icon', type: 'button', title: 'Copiar enlace', 'aria-label': 'Copiar enlace',
        onclick: async () => toast((await copyText(linkOf(ev))) ? 'Enlace copiado' : linkOf(ev)) }, '🔗'),
      h('button', { class: 'btn icon', type: 'button', title: 'Duplicar', 'aria-label': 'Duplicar', onclick: () => duplicate(ev) }, '⧉'),
      h('button', { class: 'btn icon danger', type: 'button', title: 'Eliminar', 'aria-label': 'Eliminar', onclick: () => remove(ev) }, '🗑')));
}

function renderList() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  const q = query.trim().toLowerCase();
  const list = events.filter(e => !q || `${e.title} ${e.slug}`.toLowerCase().includes(q));
  if (!events.length) {
    grid.replaceWith(h('div', { id: 'grid', class: 'empty' },
      h('div', { style: { 'font-size': '3rem' } }, '💌'),
      h('h2', null, 'Crea tu primera invitación'),
      h('p', { class: 'muted' }, 'Elige una plantilla, cambia los textos, sube tu imagen o video y comparte un enlace por invitado.'),
      h('button', { class: 'btn primary', type: 'button', onclick: newDialog }, '+ Nueva invitación')));
    return;
  }
  grid.className = 'grid';
  grid.replaceChildren(...(list.length ? list.map(card) : [h('p', { class: 'muted' }, 'Ninguna invitación coincide con la búsqueda.')]));
}

async function dashboard() {
  try { events = await api('/api/events'); }
  catch (e) { if (e instanceof ApiError && e.status === 401) return loginView(); throw e; }
  const search = h('input', { type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar invitaciones', value: query, oninput: e => { query = e.target.value; renderList(); } });
  app.replaceChildren(
    h('header', { class: 'top' },
      h('a', { class: 'brand', href: '/panel' }, h('img', { src: '/assets/favicon.svg', alt: '' }), 'Invitaciones'),
      h('nav', null,
        h('button', { class: 'btn ghost', type: 'button', onclick: accountDialog }, '👤', h('span', { class: 'label' }, 'Mi cuenta')),
        h('button', { class: 'btn ghost', type: 'button', onclick: logout }, '↩', h('span', { class: 'label' }, 'Salir')))),
    h('main', { class: 'wrap' },
      h('section', { class: 'hero' },
        h('div', null, h('h1', null, 'Mis invitaciones'), h('p', { class: 'muted' }, events.length ? `${events.length} invitación${events.length === 1 ? '' : 'es'}` : 'Aún no tienes invitaciones')),
        h('div', { class: 'tools' }, events.length > 3 && search, h('button', { class: 'btn primary', type: 'button', onclick: newDialog }, '+ Nueva invitación'))),
      h('div', { id: 'grid', class: 'grid' })));
  renderList();
}

/* ---------- Actions ---------- */

async function duplicate(ev) {
  try {
    const copy = await api(`/api/events/${ev.id}/duplicate`, { method: 'POST' });
    events.unshift(copy); renderList(); toast('Copia creada');
  } catch (e) { toast(e.message); }
}

async function remove(ev) {
  if (!confirm(`¿Eliminar "${ev.title}"?\n\nSe borran también sus imágenes y videos, y el enlace deja de funcionar. No se puede deshacer.`)) return;
  try {
    await api(`/api/events/${ev.id}`, { method: 'DELETE' });
    events = events.filter(e => e.id !== ev.id); renderList(); toast('Invitación eliminada');
  } catch (e) { toast(e.message); }
}

async function logout() {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  loginView();
}

function dialog(...content) {
  const d = h('dialog', null, ...content);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
  document.body.append(d);
  d.showModal();
  return d;
}

async function newDialog() {
  let templates;
  try { templates = await api('/api/templates'); } catch (e) { return toast(e.message); }
  let chosen = templates[0].id;
  const title = h('input', { type: 'text', placeholder: 'Ej. Prom Grado Décimo', maxlength: 120, required: true });
  const err = h('p', { class: 'error' });
  const tiles = templates.map(t => {
    const el = h('button', { type: 'button', class: `tpl${t.id === chosen ? ' on' : ''}`, onclick: () => { chosen = t.id; tiles.forEach(x => x.classList.toggle('on', x === el)); } },
      cover(t.theme, '', null), h('b', null, t.label), h('span', null, t.description));
    return el;
  });
  const create = h('button', { class: 'btn primary', type: 'submit' }, 'Crear y editar');
  const form = h('form', { class: 'dlg', method: 'dialog' },
    h('h2', null, 'Nueva invitación'),
    h('label', { class: 'field' }, 'Nombre (solo lo ves tú; también arma el enlace)', title),
    h('div', { class: 'field' }, h('span', { class: 'muted', style: { 'font-weight': 600, 'font-size': '.9rem' } }, 'Plantilla'), h('div', { class: 'tpls' }, tiles)),
    err,
    h('div', { class: 'dlg-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => d.close() }, 'Cancelar'), create));
  form.onsubmit = async e => {
    e.preventDefault();
    if (!title.value.trim()) { err.textContent = 'Ponle un nombre a la invitación'; title.focus(); return; }
    create.disabled = true;
    try {
      const ev = await api('/api/events', { method: 'POST', body: { title: title.value.trim(), template: chosen } });
      location.href = `/panel/editar/${ev.id}`;
    } catch (x) { err.textContent = x.message; create.disabled = false; }
  };
  const d = dialog(form);
  title.focus();
}

function accountDialog() {
  const cur = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const nw = h('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: 10 });
  const err = h('p', { class: 'error' });
  const form = h('form', { class: 'dlg', method: 'dialog' },
    h('h2', null, 'Mi cuenta'),
    h('p', { class: 'muted', style: { margin: 0 } }, 'Cambia la contraseña del panel (mínimo 10 caracteres).'),
    h('label', { class: 'field' }, 'Contraseña actual', cur),
    h('label', { class: 'field' }, 'Contraseña nueva', nw),
    err,
    h('div', { class: 'dlg-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => d.close() }, 'Cancelar'), h('button', { class: 'btn primary', type: 'submit' }, 'Guardar')));
  form.onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/api/password', { method: 'POST', body: { current: cur.value, new: nw.value } });
      d.close(); toast('Contraseña cambiada');
    } catch (x) { err.textContent = x.message; }
  };
  const d = dialog(form);
}

dashboard().catch(() => loginView());
