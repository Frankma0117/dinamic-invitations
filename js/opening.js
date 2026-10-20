// Opening sequence: envelope (default), diptych card, curtain, or none. GSAP drives the timelines;
// without GSAP or with prefers-reduced-motion it falls back to a short fade.
import { h, reducedMotion } from './util.js';
import { sealIcon, ornament } from './decor.js';

function seal(cfg) {
  const s = cfg.opening.seal;
  const face = () => (s.type === 'icon'
    ? h('span', { class: 'seal-face icon', svg: sealIcon(s.icon) })
    : h('span', { class: 'seal-face' }, (s.text || '♥').slice(0, 4)));
  return h('div', { class: 'seal', 'aria-hidden': 'true' },
    h('div', { class: 'seal-half l' }, face()), h('div', { class: 'seal-half r' }, face()));
}

const hint = cfg => (cfg.opening.hint ? h('p', { class: 'intro-hint' }, cfg.opening.hint) : null);
const nameEl = (cfg, guest) => h('p', { class: 'env-name' }, guest || cfg.guest.fallback || 'Para ti');

function letterPreview(cfg, decor) {
  const hd = cfg.sections.header;
  return h('div', { class: 'letter-in' },
    h('div', { class: 'ornament small', svg: ornament(decor) }),
    hd.title && h('p', { class: 'letter-title' }, hd.title),
    hd.names && h('p', { class: 'letter-names' }, hd.names));
}

const BUILD = {
  envelope(cfg, guest, decor) {
    return h('div', { class: 'scene' },
      h('div', { class: 'env-wrap float' },
        h('div', { class: 'env' },
          h('div', { class: 'env-back' }),
          h('div', { class: 'letter' }, letterPreview(cfg, decor)),
          h('div', { class: 'env-front' }), h('div', { class: 'env-bottom' }),
          nameEl(cfg, guest),
          h('div', { class: 'flap' }),
          seal(cfg))),
      hint(cfg));
  },
  diptych(cfg, guest, decor) {
    return h('div', { class: 'scene' },
      h('div', { class: 'dip-wrap float' },
        h('div', { class: 'dip' },
          h('div', { class: 'dip-page' }, letterPreview(cfg, decor)),
          h('div', { class: 'dip-cover' },
            h('div', { class: 'face front' }, h('div', { class: 'ornament small', svg: ornament(decor) }), nameEl(cfg, guest), seal(cfg)),
            h('div', { class: 'face back' }, cfg.sections.header.greeting && h('p', { class: 'letter-greeting' }, cfg.sections.header.greeting))))),
      hint(cfg));
  },
  curtain(cfg, guest) {
    return h('div', { class: 'scene curtain-scene' },
      h('div', { class: 'curtain l' }), h('div', { class: 'curtain r' }), h('div', { class: 'valance' }),
      h('div', { class: 'plaque' }, nameEl(cfg, guest), seal(cfg), hint(cfg)));
  },
};

/**
 * Shows the intro over the page. onTap runs inside the tap (audio may start there); onDone when the card is fully shown.
 * Returns a cleanup function.
 */
export function playOpening(cfg, { guest, decor, onTap, onReveal, onDone }) {
  const style = BUILD[cfg.opening.style] ? cfg.opening.style : 'none';
  if (style === 'none') { onDone?.(); return () => {}; }
  const intro = h('div', { class: `intro intro-${style}`, role: 'button', tabindex: '0', 'aria-label': `${cfg.opening.hint || 'Abrir invitación'}` },
    BUILD[style](cfg, guest, decor));
  document.body.append(intro);
  document.documentElement.classList.add('locked');
  intro.focus({ preventScroll: true });
  let started = false;
  const finish = () => {
    intro.remove();
    document.documentElement.classList.remove('locked');
    onDone?.();
  };
  const start = e => {
    if (started) return;
    if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return;
    e.preventDefault?.();
    started = true;
    intro.classList.add('opening');
    onTap?.();
    const gsap = window.gsap;
    if (!gsap || reducedMotion()) {
      intro.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: 'ease-out' }).onfinish = finish;
      return;
    }
    TIMELINES[style](gsap, intro, finish, onReveal);
  };
  intro.addEventListener('click', start);
  intro.addEventListener('keydown', start);
  return () => { intro.remove(); document.documentElement.classList.remove('locked'); };
}

function breakSeal(gsap, tl, root, at = 0) {
  const l = root.querySelector('.seal-half.l'), r = root.querySelector('.seal-half.r');
  tl.to(root.querySelector('.seal'), { scale: 1.12, duration: .14, ease: 'power1.out' }, at)
    .to(l, { x: -26, y: 40, rotation: -32, opacity: 0, duration: .65, ease: 'power2.in' }, at + .16)
    .to(r, { x: 26, y: 46, rotation: 28, opacity: 0, duration: .65, ease: 'power2.in' }, at + .16);
}

/** The letter (or page) grows from where it is until it covers the screen, then the intro fades away. */
function growToScreen(gsap, tl, el, intro, at) {
  tl.add(() => {
    const r = el.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    gsap.to(el, {
      x: `+=${vw / 2 - (r.left + r.width / 2)}`, y: `+=${vh / 2 - (r.top + r.height / 2)}`,
      scale: Math.max(vw / r.width, vh / r.height) * 1.08, duration: .85, ease: 'power3.inOut',
    });
    gsap.to(el.querySelector('.letter-in'), { opacity: 0, duration: .35 });
  }, at);
  tl.to(intro, { opacity: 0, duration: .55, ease: 'power1.out' }, at + .7);
}

const TIMELINES = {
  envelope(gsap, intro, done) {
    const q = s => intro.querySelector(s);
    const wrap = q('.env-wrap'), flap = q('.flap'), letter = q('.letter');
    wrap.classList.remove('float');
    const tl = gsap.timeline({ onComplete: done });
    tl.to(q('.intro-hint'), { opacity: 0, y: 10, duration: .3 }, 0);
    breakSeal(gsap, tl, intro, 0);
    tl.to(flap, { rotationX: 180, duration: .75, ease: 'power2.inOut' }, .45)
      .set(flap, { zIndex: 1 }, .82)
      .to(q('.env-name'), { opacity: 0, duration: .3 }, .5)
      .to(letter, { yPercent: -62, duration: .8, ease: 'power2.out' }, 1.1)
      .set(letter, { zIndex: 8 }, 1.9)
      .to(letter, { yPercent: -18, duration: .45, ease: 'power2.inOut' }, 1.9)
      .to([q('.env-back'), q('.env-front'), q('.env-bottom'), flap], { y: 140, opacity: 0, duration: .6, ease: 'power2.in' }, 1.95);
    growToScreen(gsap, tl, letter, intro, 2.45);
  },
  diptych(gsap, intro, done) {
    const q = s => intro.querySelector(s);
    q('.dip-wrap').classList.remove('float');
    const dip = q('.dip');
    const tl = gsap.timeline({ onComplete: done });
    tl.to(q('.intro-hint'), { opacity: 0, duration: .3 }, 0);
    breakSeal(gsap, tl, intro, 0);
    tl.to(q('.dip-cover'), { rotationY: -180, duration: 1.1, ease: 'power2.inOut' }, .5)
      .to(dip, { xPercent: 50, duration: 1.1, ease: 'power2.inOut' }, .5);
    growToScreen(gsap, tl, q('.dip-page'), intro, 1.9);
    tl.to(q('.dip-cover'), { opacity: 0, duration: .4 }, 1.9);
  },
  curtain(gsap, intro, done, reveal) {
    const q = s => intro.querySelector(s);
    const tl = gsap.timeline({ onComplete: done });
    tl.add(() => reveal?.(), .9);          // the card is already behind the curtain: it appears while it opens
    breakSeal(gsap, tl, intro, 0);
    tl.to(q('.plaque'), { opacity: 0, y: -20, duration: .5 }, .25)
      .to(q('.curtain.l'), { xPercent: -100, scaleX: .55, duration: 1.4, ease: 'power3.inOut' }, .55)
      .to(q('.curtain.r'), { xPercent: 100, scaleX: .55, duration: 1.4, ease: 'power3.inOut' }, .55)
      .to(q('.valance'), { yPercent: -100, duration: .8, ease: 'power2.in' }, 1.5)
      .to(intro, { opacity: 0, duration: .3 }, 2);
  },
};

/** Full-screen video right after opening, with "Continuar". */
export function playIntroVideo(v, { videoEmbed, onEnd }) {
  const close = () => { box.remove(); document.documentElement.classList.remove('locked'); onEnd?.(); };
  const cont = h('button', { class: 'btn solid iv-continue', type: 'button', onclick: close }, 'Continuar');
  let media;
  if (v.src) {
    media = h('video', { src: v.src, playsinline: true, autoplay: true, controls: true, poster: v.poster || null });
    media.addEventListener('ended', () => cont.classList.add('ready'));
    media.play().catch(() => { media.muted = true; media.play().catch(() => {}); });
  } else {
    const emb = videoEmbed(v.url, { autoplay: true });
    media = h('iframe', { src: emb.src, title: 'Video', allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: true });
    setTimeout(() => cont.classList.add('ready'), 4000);
  }
  const box = h('div', { class: 'intro-video' }, h('div', { class: 'iv-frame' }, media), cont);
  document.body.append(box);
  document.documentElement.classList.add('locked');
  return close;
}
