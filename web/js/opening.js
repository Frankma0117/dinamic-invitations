// Opening sequence: envelope (default), diptych card, curtain, or none. GSAP drives the timelines;
// without GSAP or with prefers-reduced-motion it falls back to a short fade.
import { h, reducedMotion } from './util.js';
import { sealIcon, ornament, corners } from './decor.js';

function seal(cfg) {
  const s = cfg.opening.seal;
  const face = () => (s.type === 'image' && s.image
    ? h('span', { class: 'seal-face img' }, h('img', { src: s.image, alt: '' }))
    : s.type === 'icon'
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
    hd.names && h('p', { class: hd.names.length > 16 ? 'letter-names long' : 'letter-names' }, hd.names));
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

/**
 * Creates the <video> inside the tap: starting and pausing it there is what lets phones play it WITH sound a few
 * seconds later, when the letter has opened (iPhone/Android only allow sound after a touch).
 */
export function prepareIntroVideo(v) {
  if (!v?.src) return null;
  const el = h('video', { src: v.src, playsinline: true, preload: 'auto', poster: v.poster || null });
  const p = el.play();
  el.pause();
  p?.catch?.(() => {});
  return el;
}

function bigScreen(video) {
  const req = video.requestFullscreen || video.webkitRequestFullscreen;
  if (!req && video.webkitEnterFullscreen) { video.webkitEnterFullscreen(); return; }   // iPhone
  if (!req) return;
  Promise.resolve(req.call(video))
    .then(() => screen.orientation?.lock?.('landscape'))
    .catch(() => {});
}

const PHONE = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="20" y="6" width="24" height="52" rx="5"/><path d="M29 52h6"/></svg>';

/**
 * The video or image that IS the invitation, framed as a paper card in the theme's colors, right after the letter opens.
 * Horizontal media on a phone held upright: an animation asks to turn the phone and, once turned, it fills the
 * screen; on "Continuar" another animation asks to turn it back before the rest of the invitation shows.
 */
export function playIntroMedia(m, { videoEmbed, el, decor, onEnd }) {
  const html = document.documentElement;
  const isPhone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
  const portrait = matchMedia('(orientation: portrait)');
  let media, done = false, wide = false, leaving = false, skipped = false;

  const finish = () => {
    if (done) return;
    done = true;
    portrait.removeEventListener?.('change', update);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    media.pause?.();
    box.classList.add('leaving');
    setTimeout(() => { box.remove(); html.classList.remove('locked'); }, 600);
    onEnd?.();
  };
  const close = () => {
    if (isPhone && wide && !portrait.matches) { leaving = true; update(); return; }   // first: phone upright again
    finish();
  };

  const cont = h('button', { class: 'btn solid iv-continue', type: 'button', onclick: close }, 'Continuar ›');
  let big = null;
  if (m.kind === 'image') {
    media = h('img', { src: m.src, alt: m.alt || '', decoding: 'async' });
    const measure = () => setWide(media.naturalWidth, media.naturalHeight);
    if (media.complete) setTimeout(measure); else media.addEventListener('load', measure);
  } else if (m.src) {
    media = el || h('video', { src: m.src, playsinline: true, preload: 'auto', poster: m.poster || null });
    media.controls = true;
    media.loop = true;                          // the video plays on repeat until the guest continues
    let last = 0;                               // after the first full round "Continuar" starts to pulse
    media.addEventListener('timeupdate', () => { if (media.currentTime + .5 < last) cont.classList.add('ready'); last = media.currentTime; });
    const measure = () => setWide(media.videoWidth, media.videoHeight);
    if (media.readyState >= 1) setTimeout(measure); else media.addEventListener('loadedmetadata', measure);
    media.play().catch(() => { media.muted = true; media.play().catch(() => {}); });
    big = h('button', { class: 'btn iv-big', type: 'button', onclick: () => bigScreen(media) }, '⛶ Ver en grande');
  } else {
    media = h('iframe', { src: videoEmbed(m.url, { autoplay: true }).src, title: 'Video', allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: true });
    setTimeout(() => cont.classList.add('ready'), 4000);
    setTimeout(() => setWide(16, 9));            // YouTube / Vimeo are almost always horizontal
  }

  const hintText = h('p', { class: 'rh-text' });
  const hintBtn = h('button', { class: 'btn', type: 'button' });
  const phone = h('div', { class: 'rh-phone', svg: PHONE });
  const rotate = h('div', { class: 'rotate-hint', hidden: true, role: 'dialog', 'aria-live': 'polite' }, phone, hintText, hintBtn);

  function setWide(w, hgt) { wide = w > hgt * 1.05; update(); }
  function showHint(back) {
    rotate.hidden = false;
    phone.className = `rh-phone ${back ? 'to-portrait' : 'to-landscape'}`;
    hintText.textContent = back ? 'Vuelve a poner tu celular derecho para seguir' : 'Gira tu celular para verla en grande';
    hintBtn.textContent = back ? 'Seguir así' : 'Ver sin girar';
    hintBtn.onclick = back ? finish : () => { skipped = true; update(); };
  }
  function update() {
    if (done) return;
    const turnable = isPhone && wide;
    if (leaving) {
      if (!turnable || portrait.matches) finish(); else showHint(true);
      return;
    }
    if (turnable && !portrait.matches) { rotate.hidden = true; box.classList.add('full'); return; }
    box.classList.remove('full');
    if (turnable && !skipped) showHint(false); else rotate.hidden = true;
  }
  portrait.addEventListener?.('change', update);

  const art = corners(decor);
  const box = h('div', { class: `intro-video${m.kind === 'image' ? ' is-image' : ''}` },
    h('div', { class: 'iv-card' },
      art && h('div', { class: 'corner tl', 'aria-hidden': 'true', svg: art }),
      art && h('div', { class: 'corner br', 'aria-hidden': 'true', svg: art }),
      h('div', { class: 'ornament small iv-orn', svg: ornament(decor) }),
      h('div', { class: `iv-frame${m.kind === 'image' ? ' image' : m.src ? '' : ' embed'}` }, media),
      h('div', { class: 'btn-row iv-actions' }, big, cont)),
    rotate);
  if (m.kind === 'image') setTimeout(() => cont.classList.add('ready'), 3500);
  document.body.append(box);
  html.classList.add('locked');
  return finish;
}
