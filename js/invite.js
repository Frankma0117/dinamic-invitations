// Guest page. Reads config.json (or, inside the editor's preview, the config the editor sends) and shows the invitation.
// Who is the guest: the page /<slug>/ (meta "guest-slug"), ?i=<slug>, or ?para=Name for anyone not on the list.
import { loadConfig, normalize, forGuest, introVideo, fixSlugs } from './config.js';
import { applyTheme } from './themes.js';
import { renderInvitation } from './render.js';
import { playOpening, playIntroVideo } from './opening.js';
import { startParticles, startReveal, startAutoVideos, startCountdown, createMusic } from './fx.js';
import { h, videoEmbed, reducedMotion } from './util.js';

const params = new URLSearchParams(location.search);
const PREVIEW = params.has('preview');
const app = document.getElementById('app');
let cleanups = [];
let music = null;
let opened = false;

function whoIsGuest(cfg, override) {
  const slug = override?.slug ?? (document.querySelector('meta[name="guest-slug"]')?.content || params.get('i') || '');
  const g = slug && (cfg.guests || []).find(x => x.slug === slug);
  if (g) return { guest: g, name: g.name || '' };
  const name = override?.name ?? params.get(cfg.guest.param || 'para') ?? '';
  return { guest: null, name: name.trim().slice(0, 60) };
}

function setMeta(cfg) {
  if (PREVIEW) return;
  const title = cfg.meta.title || cfg.sections.header.title;
  if (title) document.title = title;
}

function confettiBurst(colors) {
  if (!window.confetti || reducedMotion()) return;
  const opts = { particleCount: 90, spread: 75, startVelocity: 42, colors: [...colors, '#ffffff'], zIndex: 60, disableForReducedMotion: true };
  window.confetti({ ...opts, origin: { x: .2, y: .7 }, angle: 60 });
  window.confetti({ ...opts, origin: { x: .8, y: .7 }, angle: 120 });
}

function render(raw, { replay = false, as } = {}) {
  cleanups.forEach(fn => fn()); cleanups = [];
  music?.destroy(); music = null;

  const base = normalize(raw);
  base.guests = fixSlugs(base.guests || []);
  const { guest, name } = whoIsGuest(base, as);
  const cfg = forGuest(base, guest);
  const theme = applyTheme(cfg.theme);
  setMeta(cfg);

  music = createMusic(cfg.music);
  const ctx = { guest: name, seats: Number(guest?.seats) || 0, decor: theme.decor, music };
  app.replaceChildren(renderInvitation(cfg, ctx));
  window.scrollTo(0, 0);

  const colors = [theme.primary, theme.secondary];
  cleanups.push(startParticles(theme.particles, colors));
  cleanups.push(startCountdown(app, cfg));

  let shown = false;
  const showCard = () => {
    if (shown) return;
    shown = true;
    document.documentElement.classList.add('opened');
    cleanups.push(startReveal(app), startAutoVideos(app));
  };
  const afterOpen = () => {
    opened = true;
    if (cfg.opening.confetti) confettiBurst(colors);
    const iv = introVideo(base);
    if (iv) {
      music?.pause();
      const close = playIntroVideo(iv, { videoEmbed, onEnd: () => { music?.play(); showCard(); } });
      cleanups.push(close);
    } else showCard();
  };

  if (opened && !replay) { music?.show(); showCard(); return; }
  document.documentElement.classList.remove('opened');
  if (cfg.opening.style === 'none') {
    // No tap means no audio yet: the music starts with the first touch anywhere.
    if (music) {
      music.show();
      const first = () => music?.play();
      addEventListener('pointerdown', first, { once: true });
      cleanups.push(() => removeEventListener('pointerdown', first));
    }
    afterOpen();
    return;
  }
  cleanups.push(playOpening(cfg, {
    guest: name, decor: theme.decor,
    onTap: () => { if (!introVideo(base)) music?.play(); },
    onReveal: () => { if (!introVideo(base)) showCard(); },
    onDone: afterOpen,
  }));
}

function showError(msg) {
  app.replaceChildren(h('main', { class: 'invite' }, h('article', { class: 'card' }, h('p', { class: 'center' }, msg))));
}

async function boot() {
  if (PREVIEW) {
    // Live preview inside the editor: same origin only.
    addEventListener('message', e => {
      if (e.origin !== location.origin || e.data?.type !== 'config') return;
      if (e.data.replay) opened = false;
      render(e.data.config, { replay: e.data.replay, as: e.data.as });
    });
    parent.postMessage({ type: 'preview-ready' }, location.origin);
    return;
  }
  try {
    render(await loadConfig('config.json'));
  } catch (err) {
    console.error(err);
    showError('No se pudo cargar la invitación. Revisa tu conexión e inténtalo de nuevo.');
  }
}

boot();
