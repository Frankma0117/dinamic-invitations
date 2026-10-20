// Visual effects: falling particles, scroll reveal, parallax, countdown and the music button.
import { h, eventDate, reducedMotion } from './util.js';
import { ICONS } from './decor.js';
import { melody } from './sfx.js';

/* ---------- Particles (one light canvas, paused when the tab is hidden) ---------- */

export function startParticles(kind, colors) {
  if (!kind || kind === 'none' || reducedMotion()) return () => {};
  const canvas = h('canvas', { class: 'particles', 'aria-hidden': 'true' });
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let W = 0, H = 0, raf = 0, last = performance.now();
  const resize = () => {
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const n = Math.round(Math.min(46, Math.max(18, (W * H) / 26000)));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const palette = kind === 'confetti' ? [...colors, '#ffd166', '#7ed6df', '#ff8fab', '#a29bfe'] : colors;
  const make = (anywhere = true) => ({
    x: Math.random() * W, y: anywhere ? Math.random() * H : -20,
    s: kind === 'stars' ? 1 + Math.random() * 2.2 : kind === 'sparkles' ? 2 + Math.random() * 4 : 5 + Math.random() * 7,
    vy: kind === 'stars' ? 0 : kind === 'sparkles' ? -(6 + Math.random() * 12) : 22 + Math.random() * 40,
    vx: (Math.random() - .5) * 14, rot: Math.random() * 6.28, vr: (Math.random() - .5) * 3,
    ph: Math.random() * 6.28, c: pick(palette),
  });
  const parts = Array.from({ length: n }, () => make(true));

  const star4 = (p, a) => {
    ctx.globalAlpha = a; ctx.fillStyle = p.c;
    ctx.beginPath();
    const s = p.s;
    ctx.moveTo(p.x, p.y - s * 2); ctx.quadraticCurveTo(p.x, p.y, p.x + s * 2, p.y);
    ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + s * 2); ctx.quadraticCurveTo(p.x, p.y, p.x - s * 2, p.y);
    ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - s * 2); ctx.fill();
  };

  const frame = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, W, H);
    const t = now / 1000;
    for (const p of parts) {
      p.ph += dt; p.rot += p.vr * dt;
      if (kind === 'stars') {
        ctx.globalAlpha = .25 + .75 * Math.abs(Math.sin(p.ph * .9));
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.28); ctx.fill();
        continue;
      }
      p.y += p.vy * dt; p.x += (p.vx + Math.sin(t + p.ph) * (kind === 'petals' ? 18 : 6)) * dt;
      if (p.y > H + 30 || p.y < -30 || p.x < -30 || p.x > W + 30) Object.assign(p, make(false), kind === 'sparkles' ? { y: H + 10 } : {});
      if (kind === 'sparkles') { star4(p, .2 + .8 * Math.abs(Math.sin(p.ph * 1.6))); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      if (kind === 'confetti') { ctx.globalAlpha = .9; ctx.scale(1, Math.cos(p.ph * 3)); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
      else { ctx.globalAlpha = .7; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * .55, 0, 0, 6.28); ctx.fill(); }
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  };
  const vis = () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', vis);
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf); canvas.remove();
    removeEventListener('resize', resize); document.removeEventListener('visibilitychange', vis);
  };
}

/* ---------- Reveal on scroll + parallax ---------- */

export function startReveal(root, onSection) {
  const els = root.querySelectorAll('[data-reveal]');
  let secIO = null;
  if (onSection && 'IntersectionObserver' in window) {     // soft "page" sound as each section scrolls into view
    secIO = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { onSection(); secIO.unobserve(e.target); }
    }, { threshold: .35 });
    root.querySelectorAll('.sec:not(.sec-header)').forEach(el => secIO.observe(el));
  }
  if (reducedMotion() || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return () => {}; }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  els.forEach(e => io.observe(e));

  const par = [...root.querySelectorAll('[data-parallax]')];
  let raf = 0;
  const onScroll = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const vh = innerHeight;
      for (const el of par) {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * -.18).toFixed(1)}px, 0)`;
      }
    });
  };
  if (par.length) { addEventListener('scroll', onScroll, { passive: true }); onScroll(); }
  return () => { io.disconnect(); secIO?.disconnect(); removeEventListener('scroll', onScroll); };
}

/** Play muted videos only while visible. */
export function startAutoVideos(root) {
  const vids = root.querySelectorAll('[data-autoplay]');
  if (!vids.length || !('IntersectionObserver' in window)) return () => {};
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      const el = e.target;
      if (el.tagName === 'VIDEO') { if (e.isIntersecting) el.play().catch(() => {}); else el.pause(); }
      else if (e.isIntersecting && !el.src) el.src = el.dataset.src;   // iframe: load once when it shows up
    }
  }, { threshold: .4 });
  vids.forEach(v => io.observe(v));
  return () => io.disconnect();
}

/* ---------- Countdown ---------- */

export function startCountdown(root, cfg) {
  const box = root.querySelector('.countdown');
  if (!box) return () => {};
  const target = eventDate(cfg.event);
  const units = [...box.querySelectorAll('.cd-num')];
  const prev = [];
  let first = true;
  const tick = () => {
    let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    if (s <= 0) {
      box.replaceChildren(h('p', { class: 'cd-done' }, cfg.sections.countdown.doneText || '¡Hoy es el gran día!'));
      clearInterval(timer); return;
    }
    const vals = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
    vals.forEach((v, i) => {
      const txt = String(v).padStart(2, '0');
      if (prev[i] === txt) return;
      prev[i] = txt;
      const span = h('span', { class: first ? '' : 'flip' }, txt);
      units[i].replaceChildren(span);
    });
    first = false;   // from the second tick on, changes animate
  };
  tick();
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}

/* ---------- Music ---------- */

export function createMusic(m) {
  if (!m?.enabled || !m.src) return null;
  const vol = Math.min(1, Math.max(0, Number(m.volume ?? .6)));
  let player;
  if (m.src.startsWith('builtin:')) {
    player = melody(m.src.slice(8), vol);       // synthesized melody (sfx.js), no file
  } else {
    const audio = new Audio();
    audio.src = m.src; audio.loop = true; audio.preload = 'auto'; audio.volume = vol;
    audio.addEventListener('play', () => sync()); audio.addEventListener('pause', () => sync());
    player = {
      play: () => audio.play(), pause: () => audio.pause(), get playing() { return !audio.paused; },
      stop: () => { audio.pause(); audio.src = ''; },
      // Started and stopped inside the guest's tap: after that the phone lets it play whenever we want.
      prime: () => { audio.muted = true; const p = audio.play(); audio.pause(); audio.muted = false; p?.catch?.(() => {}); },
    };
  }
  const btn = h('button', { class: 'music-btn', type: 'button', 'aria-label': 'Pausar o reanudar la música', hidden: true },
    h('span', { class: 'mb-icon', svg: ICONS.music }),
    h('span', { class: 'bars', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')));
  const sync = () => btn.classList.toggle('playing', player.playing);
  const play = () => Promise.resolve(player.play()).catch(() => {}).then(sync);
  btn.addEventListener('click', () => { if (player.playing) { player.pause(); sync(); } else play(); });
  document.body.append(btn);
  return {
    play() { btn.hidden = false; return play(); },
    pause() { player.pause(); sync(); },
    show() { btn.hidden = false; },
    prime() { player.prime?.(); },
    destroy() { player.pause(); player.stop?.(); btn.remove(); },
    get playing() { return player.playing; },
  };
}
