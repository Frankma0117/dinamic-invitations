// Sounds made in the browser with Web Audio (no files): the seal cracking, paper sliding, a chime when the card
// opens, soft page transitions, and background melodies (music box, piano, waltz, little stars).
// Browsers only allow audio after a touch: init() is called inside the tap that opens the envelope.

let ctx = null, master = null, verb = null;
let enabled = true, volume = .7;

export function configure({ enabled: on = true, volume: v = .7 } = {}) {
  enabled = on; volume = Math.max(0, Math.min(1, Number(v)));
  if (master) master.gain.value = volume;
}

export function init() {
  if (ctx) { ctx.resume?.(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
  // Small room: a generated impulse response (decaying noise) for a soft, warm echo.
  verb = ctx.createConvolver();
  const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = .32;
  verb.connect(wet); wet.connect(master);
  return ctx;
}

const now = () => ctx.currentTime;

function noise(dur) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b;
  return s;
}

function out(node, gain, { wet = false, at = now() } = {}) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  node.connect(g); g.connect(master);
  if (wet) g.connect(verb);
  return g;
}

function tone(freq, at, dur, { type = 'sine', gain = .2, attack = .005, wet = true } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, at);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + attack);
  env.gain.exponentialRampToValueAtTime(.0001, at + dur);
  o.connect(env); out(env, 1, { wet, at });
  o.start(at); o.stop(at + dur + .05);
}

const SOUNDS = {
  crack(at) {                                   // wax seal breaking: two dry snaps + a low thump
    [0, .07].forEach((dt, i) => {
      const n = noise(.09), f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 2400 - i * 700; f.Q.value = 1.2;
      const e = ctx.createGain(); e.gain.setValueAtTime(.9, at + dt); e.gain.exponentialRampToValueAtTime(.001, at + dt + .08);
      n.connect(f); f.connect(e); out(e, .55, { at });
      n.start(at + dt);
    });
    tone(110, at, .18, { gain: .35, wet: false });
  },
  paper(at) {                                    // flap opening / paper moving
    const n = noise(.7), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = .8;
    f.frequency.setValueAtTime(700, at); f.frequency.exponentialRampToValueAtTime(3200, at + .55);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, at);
    e.gain.linearRampToValueAtTime(.35, at + .12); e.gain.exponentialRampToValueAtTime(.001, at + .65);
    n.connect(f); f.connect(e); out(e, .6, { at, wet: true });
    n.start(at);
  },
  slide(at) {                                    // letter sliding out of the envelope
    const n = noise(.9), f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1800;
    const e = ctx.createGain(); e.gain.setValueAtTime(0, at);
    e.gain.linearRampToValueAtTime(.22, at + .3); e.gain.exponentialRampToValueAtTime(.001, at + .85);
    n.connect(f); f.connect(e); out(e, .55, { at });
    n.start(at);
  },
  whoosh(at) {
    const n = noise(.8), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(300, at); f.frequency.exponentialRampToValueAtTime(2600, at + .35); f.frequency.exponentialRampToValueAtTime(400, at + .75);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, at);
    e.gain.linearRampToValueAtTime(.4, at + .3); e.gain.exponentialRampToValueAtTime(.001, at + .78);
    n.connect(f); f.connect(e); out(e, .55, { at, wet: true });
    n.start(at);
  },
  chime(at) {                                    // the card opens: soft bells
    [1046.5, 1318.5, 1568, 2093].forEach((fq, i) => tone(fq, at + i * .09, 1.6, { gain: .09, type: 'sine' }));
  },
  page(at) {                                     // a section appears while scrolling (very soft)
    const n = noise(.2), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = .7;
    const e = ctx.createGain(); e.gain.setValueAtTime(0, at);
    e.gain.linearRampToValueAtTime(.12, at + .04); e.gain.exponentialRampToValueAtTime(.001, at + .18);
    n.connect(f); f.connect(e); out(e, .5, { at });
    n.start(at);
  },
  sparkle(at) {
    [1568, 2093, 2637, 3136].forEach((fq, i) => tone(fq, at + i * .05, .5, { gain: .05 }));
  },
};

let lastPage = 0;
export function play(name, delay = 0) {
  if (!enabled || !ctx || !SOUNDS[name]) return;
  if (name === 'page') {
    if (performance.now() - lastPage < 700) return;
    lastPage = performance.now();
  }
  try { SOUNDS[name](now() + delay); } catch { /* audio is a bonus: never break the page */ }
}

/* ---------- Background melodies ---------- */

const N = n => 440 * Math.pow(2, (n - 69) / 12);   // MIDI note → Hz

// Each melody: tempo (beats/min), voice, and a list of [beat, midi, length, gain] for one loop.
function arp(chords, pattern, octave = 0) {
  const notes = [];
  chords.forEach((ch, bar) => pattern.forEach((idx, k) => notes.push([bar * pattern.length * .5 + k * .5, ch[idx] + octave, 1.2, .16])));
  return notes;
}
const C = [60, 64, 67, 72], G = [55, 59, 62, 67], Am = [57, 60, 64, 69], F = [53, 57, 60, 65], Em = [52, 55, 59, 64], Dm = [50, 53, 57, 62];

export const MELODIES = {
  cajita: { label: 'Caja musical', bpm: 92, voice: 'box', beats: 32,
    notes: arp([C, G, Am, F, C, Em, F, G], [0, 1, 2, 3, 2, 1, 2, 1], 12) },
  piano: { label: 'Piano suave', bpm: 70, voice: 'piano', beats: 32,
    notes: [...arp([C, Am, F, G, C, Am, Dm, G], [0, 2, 1, 3, 1, 2, 0, 2]),
      ...[[0, 76], [4, 74], [8, 72], [12, 71], [16, 76], [20, 79], [24, 77], [28, 74]].map(([b, n]) => [b, n, 3.4, .1])] },
  vals: { label: 'Vals', bpm: 132, voice: 'piano', beats: 48,
    notes: [C, G, Am, Em, F, C, Dm, G].flatMap((ch, bar) => [[bar * 6, ch[0] - 12, 1.6, .16], [bar * 6 + 2, ch[1], .8, .09], [bar * 6 + 2, ch[2], .8, .08],
      [bar * 6 + 4, ch[1], .8, .09], [bar * 6 + 4, ch[2], .8, .08], [bar * 6, ch[3] + 12, 2.6, .07]]) },
  estrellas: { label: 'Estrellitas', bpm: 84, voice: 'box', beats: 32,
    notes: [72, 72, 79, 79, 81, 81, 79, 0, 77, 77, 76, 76, 74, 74, 72, 0, 79, 79, 77, 77, 76, 76, 74, 0, 79, 79, 77, 77, 76, 76, 74, 0]
      .map((n, i) => n && [i, n + 12, 1.4, .13]).filter(Boolean)
      .concat([C, F, C, G, C, F, C, G].map((ch, i) => [i * 4, ch[0] - 12, 3.5, .08])) },
};

function voiceNote(voice, freq, at, dur, gain) {
  if (voice === 'box') {                         // music box: bright bell with a quick decay
    tone(freq, at, dur, { gain, type: 'sine' });
    tone(freq * 2.01, at, dur * .5, { gain: gain * .35, type: 'sine' });
    tone(freq * 3.98, at, dur * .25, { gain: gain * .12, type: 'triangle' });
  } else {                                       // soft piano: warm tone with gentle harmonics
    tone(freq, at, dur, { gain, type: 'triangle', attack: .01 });
    tone(freq * 2, at, dur * .6, { gain: gain * .25, type: 'sine', attack: .01 });
  }
}

/** A looping melody. Returns { play, pause, playing } like an <audio>. Notes are scheduled 0.6 s ahead only,
 * so pausing stops the music right away. */
export function melody(id, vol = .6) {
  const m = MELODIES[id] || MELODIES.cajita;
  const notes = [...m.notes].sort((a, b) => a[0] - b[0]);
  const spb = 60 / m.bpm, loopDur = m.beats * spb;
  let timer = 0, start = 0, loop = 0, idx = 0, playing = false;
  const schedule = () => {
    const horizon = now() + .6;
    for (;;) {
      const [beat, note, len, g] = notes[idx];
      const at = start + loop * loopDur + beat * spb;
      if (at > horizon) break;
      if (at >= now() - .05) voiceNote(m.voice, N(note), at, len * spb + .4, g * vol * 1.4);
      if (++idx >= notes.length) { idx = 0; loop++; }
    }
  };
  return {
    play() {
      if (!init() || playing) return Promise.resolve();
      playing = true; start = now() + .1; loop = 0; idx = 0;
      schedule(); timer = setInterval(schedule, 150);
      return Promise.resolve();
    },
    pause() { playing = false; clearInterval(timer); },
    get playing() { return playing; },
  };
}
