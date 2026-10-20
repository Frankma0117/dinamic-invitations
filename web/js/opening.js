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

function letterPreview(cfg, decor, guest) {
  const hd = cfg.sections.header, lt = cfg.opening.letter || {};
  const who = guest || cfg.guest.fallback || '';
  const fill = t => String(t || '').replace(/\{nombre\}/g, who).trim();
  const title = fill(lt.title) || hd.title, sub = fill(lt.subtitle) || hd.names, text = fill(lt.text);
  return h('div', { class: 'letter-in' },
    lt.ornament !== false && h('div', { class: 'ornament small', svg: ornament(decor) }),
    title && h('p', { class: 'letter-title' }, title),
    sub && h('p', { class: sub.length > 16 ? 'letter-names long' : 'letter-names' }, sub),
    text && h('p', { class: 'letter-text' }, text));
}

const BUILD = {
  envelope(cfg, guest, decor) {
    return h('div', { class: 'scene' },
      h('div', { class: 'env-wrap float' },
        h('div', { class: 'env' },
          h('div', { class: 'env-back' }),
          h('div', { class: 'letter' }, letterPreview(cfg, decor, guest)),
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
          h('div', { class: 'dip-page' }, letterPreview(cfg, decor, guest)),
          h('div', { class: 'dip-cover' },
            h('div', { class: 'face front' }, h('div', { class: 'ornament small', svg: ornament(decor) }), nameEl(cfg, guest), seal(cfg)),
            h('div', { class: 'face back' }, cfg.sections.header.pretitle && h('p', { class: 'letter-greeting' }, cfg.sections.header.pretitle))))),
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
export function playOpening(cfg, { guest, decor, onTap, onReveal, onDone, sound = () => {} }) {
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
      sound('chime');
      intro.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: 'ease-out' }).onfinish = finish;
      return;
    }
    TIMELINES[style](gsap, intro, finish, onReveal, sound);
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
  envelope(gsap, intro, done, reveal, sound) {
    const q = s => intro.querySelector(s);
    const wrap = q('.env-wrap'), flap = q('.flap'), letter = q('.letter');
    wrap.classList.remove('float');
    const tl = gsap.timeline({ onComplete: done });
    tl.call(sound, ['crack'], .05).call(sound, ['paper'], .5).call(sound, ['slide'], 1.1).call(sound, ['chime'], 2.4);
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
  diptych(gsap, intro, done, reveal, sound) {
    const q = s => intro.querySelector(s);
    q('.dip-wrap').classList.remove('float');
    const dip = q('.dip');
    const tl = gsap.timeline({ onComplete: done });
    tl.call(sound, ['crack'], .05).call(sound, ['paper'], .55).call(sound, ['chime'], 1.85);
    tl.to(q('.intro-hint'), { opacity: 0, duration: .3 }, 0);
    breakSeal(gsap, tl, intro, 0);
    tl.to(q('.dip-cover'), { rotationY: -180, duration: 1.1, ease: 'power2.inOut' }, .5)
      .to(dip, { xPercent: 50, duration: 1.1, ease: 'power2.inOut' }, .5);
    growToScreen(gsap, tl, q('.dip-page'), intro, 1.9);
    tl.to(q('.dip-cover'), { opacity: 0, duration: .4 }, 1.9);
  },
  curtain(gsap, intro, done, reveal, sound) {
    const q = s => intro.querySelector(s);
    const tl = gsap.timeline({ onComplete: done });
    tl.call(sound, ['crack'], .05).call(sound, ['whoosh'], .55).call(sound, ['chime'], 1.3);
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

const SPEAKER_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const SPEAKER_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>';
const PHONE = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="20" y="6" width="24" height="52" rx="5"/><path d="M29 52h6"/></svg>';

/**
 * The video or image that IS the invitation, shown clean on the invitation's background (no frame).
 * Horizontal media on a phone held upright is turned 90° by the page itself and fills the screen, so the guest only
 * has to turn the phone — it works even with the phone's auto-rotate locked. If the phone does rotate, it simply
 * shows full screen. "Continuar" never waits for the phone: a short "turn it back" note and the invitation goes on.
 */
export function playIntroMedia(m, { videoEmbed, el, decor, onEnd, sound = () => {}, silent = false }) {
  const html = document.documentElement;
  const isPhone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
  const portrait = matchMedia('(orientation: portrait)');
  let media, done = false, wide = false, upright = false, hintTimer = 0;

  const finish = () => {
    if (done) return;
    done = true;
    portrait.removeEventListener?.('change', update);
    media.pause?.();
    sound('whoosh');
    box.classList.add('leaving');
    setTimeout(() => { box.remove(); html.classList.remove('locked', 'iv-turned'); }, 600);
    onEnd?.();
  };
  const close = () => {
    if (box.classList.contains('rotated') || box.classList.contains('full')) {
      showHint(true);                            // friendly note, then on its own: nothing to wait for
      setTimeout(finish, 1600);
      return;
    }
    finish();
  };

  const cont = h('button', { class: 'btn solid iv-continue', type: 'button', onclick: close }, 'Continuar ›');
  const x = h('button', { class: 'iv-x', type: 'button', 'aria-label': 'Salir de pantalla completa', onclick: () => { upright = true; update(); } },
    h('span', { svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>' }));
  const bigBtn = h('button', { class: 'btn iv-big', type: 'button', hidden: true, onclick: () => { upright = false; update(); } }, '⤢ Ver en grande');
  let soundBtn = null;
  if (m.kind === 'image') {
    media = h('img', { src: m.src, alt: m.alt || '', decoding: 'async' });
    const measure = () => setWide(media.naturalWidth, media.naturalHeight);
    if (media.complete) setTimeout(measure); else media.addEventListener('load', measure);
  } else if (m.src) {
    media = el || h('video', { src: m.src, playsinline: true, preload: 'auto', poster: m.poster || null });
    // It must feel like part of the invitation, not like a player: no controls, no picture-in-picture, no pause on tap.
    media.controls = false;
    media.loop = true;
    media.disablePictureInPicture = true;
    media.setAttribute('disablepictureinpicture', '');
    media.setAttribute('disableremoteplayback', '');
    media.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback');
    media.addEventListener('contextmenu', e => e.preventDefault());
    const paintSound = () => {
      soundBtn.classList.toggle('muted', media.muted);
      soundBtn.setAttribute('aria-label', media.muted ? 'Activar sonido' : 'Silenciar');
      soundBtn.replaceChildren(h('span', { svg: media.muted ? SPEAKER_OFF : SPEAKER_ON }), ...(media.muted ? [h('b', null, 'Activar sonido')] : []));
    };
    if (silent) media.muted = true;              // the background music is playing instead
    else {
      soundBtn = h('button', { class: 'iv-sound', type: 'button', onclick: () => { media.muted = !media.muted; media.play().catch(() => {}); paintSound(); } });
      media.addEventListener('volumechange', paintSound);
      paintSound();
    }
    let last = 0;                               // after the first full round "Continuar" starts to pulse
    media.addEventListener('timeupdate', () => { if (media.currentTime + .5 < last) cont.classList.add('ready'); last = media.currentTime; });
    const measure = () => setWide(media.videoWidth, media.videoHeight);
    if (media.readyState >= 1) setTimeout(measure); else media.addEventListener('loadedmetadata', measure);
    media.play().catch(() => { media.muted = true; if (soundBtn) paintSound(); media.play().catch(() => {}); });   // sound blocked: start silent
  } else {
    media = h('iframe', { src: videoEmbed(m.url, { autoplay: true }).src, title: 'Video', allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: true });
    setTimeout(() => cont.classList.add('ready'), 4000);
    setTimeout(() => setWide(16, 9));            // YouTube / Vimeo are almost always horizontal
  }

  const hintText = h('p', { class: 'rh-text' });
  const hintBtn = h('button', { class: 'btn', type: 'button' });
  const phone = h('div', { class: 'rh-phone', svg: PHONE });
  const rotate = h('div', { class: 'rotate-hint', hidden: true, role: 'status', 'aria-live': 'polite' }, phone, hintText, hintBtn);

  function showHint(back) {
    clearTimeout(hintTimer);
    rotate.hidden = false;
    phone.className = `rh-phone ${back ? 'to-portrait' : 'to-landscape'}`;
    hintText.textContent = back ? 'Ya puedes volver a poner tu celular derecho' : 'Gira tu celular para verla en grande';
    hintBtn.hidden = back;
    hintBtn.textContent = 'Ver sin girar';
    hintBtn.onclick = () => { upright = true; update(); };
    if (!back) hintTimer = setTimeout(() => { rotate.hidden = true; }, 3200);
  }
  function setWide(w, hgt) {
    const first = !wide;
    wide = w > hgt * 1.05;
    update();
    if (first && wide && isPhone && portrait.matches) showHint(false);
  }
  function update() {
    if (done) return;
    const turnable = isPhone && wide;
    const landscape = !portrait.matches;
    box.classList.toggle('full', turnable && landscape);                    // the phone rotated by itself
    box.classList.toggle('rotated', turnable && !landscape && !upright);    // auto-rotate locked: the page turns it
    bigBtn.hidden = !(turnable && !landscape && upright);
    html.classList.toggle('iv-turned', box.classList.contains('full') || box.classList.contains('rotated'));   // music button out of the way
    if (box.classList.contains('full') || upright) { clearTimeout(hintTimer); rotate.hidden = true; }
  }
  portrait.addEventListener?.('change', () => { if (!portrait.matches) upright = false; update(); });

  const box = h('div', { class: `intro-video${m.kind === 'image' ? ' is-image' : ''}` },
    h('div', { class: 'iv-stage' },
      h('div', { class: `iv-frame${m.kind === 'image' ? ' image' : m.src ? '' : ' embed'}` }, media, soundBtn),
      h('div', { class: 'iv-actions' }, bigBtn, cont),
      x),
    rotate);
  if (m.kind === 'image') setTimeout(() => cont.classList.add('ready'), 3500);
  document.body.append(box);
  html.classList.add('locked');
  return finish;
}
