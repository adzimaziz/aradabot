// Sound effects: recorded clips from static/sfx (trimmed and levelled), with Web Audio synth sounds as a fallback
// for anything without a clip or until the clips have loaded.
// Give a sound a world position and it comes from that spot in your room (HRTF 3D audio); the listener follows your head.
let ctx = null, master = null, noiseBuf = null;
export let muted = false;
export function setMuted(m) { muted = m; }

// sound -> clip variants (one is picked at random), base volume, and pitch jitter for sounds that repeat a lot
const CLIPS = {
  grab:      { files: ['grab_1', 'grab_2'], vol: .7, jitter: .06 },
  throw:     { files: ['throw_1', 'throw_2', 'throw_3'], vol: .5, power: .5, jitter: .05 },
  bounce:    { files: ['bounce_floor_1', 'bounce_floor_2'], vol: .35, power: .65, jitter: .08 },
  clank:     { files: ['bounce_wall_1', 'bounce_wall_2', 'bounce_wall_3'], vol: .35, power: .65, jitter: .06 },
  dizzy:     { files: ['dizzy_1'], vol: .7 },
  recover:   { files: ['recover_1', 'recover_2'], vol: .7 },
  land:      { files: ['land_palm_1', 'land_palm_2'], vol: .6, jitter: .04 },
  listenOn:  { files: ['listen_start_1'], vol: .6 },
  listenOff: { files: ['listen_stop_1'], vol: .6 },
  answer:    { files: ['answer_1', 'answer_2'], vol: .7 },
  error:     { files: ['sorry_1'], vol: .7 },
  paired:    { files: ['paired_1'], vol: .8 },
  step:      { files: ['prime_step_1', 'prime_step_2', 'prime_step_3'], vol: .3, power: .25, jitter: .07 },
  servo:     { files: ['prime_servo_1', 'prime_servo_2'], vol: .45, jitter: .05 },
  charge:    { files: ['prime_charge_1'], vol: .85 },
  boom:      { files: ['prime_explode_1'], vol: 1 },
  assemble:  { files: ['prime_assemble_1'], vol: .85 },
  heroLand:  { files: ['prime_land_1'], vol: 1 },
  online:    { files: ['prime_online_1'], vol: .85 },
  powerDown: { files: ['prime_powerdown_1'], vol: .85 },
};
const LOOP_CLIPS = { hover: 'hover_loop_1', thinking: 'thinking_loop_1' };
const buffers = {};

function loadClips() {
  const names = new Set([...Object.values(CLIPS).flatMap(c => c.files), ...Object.values(LOOP_CLIPS)]);
  names.forEach(n => fetch(new URL(`../assets/sfx/${n}.mp3`, import.meta.url)).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
    .then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).then(buf => { buffers[n] = buf; })
    .catch(() => {}));                                       // a missing clip just leaves the synth sound in its place
}

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .8; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    loadClips();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
/** Call from a user gesture (tap, pinch, entering MR) so the browser lets sound play. */
export function unlock() { try { ac(); } catch {} }

/** Moves the listener to your head; call every frame with the (XR) camera. */
export function setListener(cam) {
  if (!ctx) return;
  const e = cam.matrixWorld.elements, l = ctx.listener, t = ctx.currentTime;
  const set = (p, v) => p ? p.setTargetAtTime(v, t, .02) : null;
  if (l.positionX) {
    set(l.positionX, e[12]); set(l.positionY, e[13]); set(l.positionZ, e[14]);
    set(l.forwardX, -e[8]); set(l.forwardY, -e[9]); set(l.forwardZ, -e[10]);
    set(l.upX, e[4]); set(l.upY, e[5]); set(l.upZ, e[6]);
  } else {
    l.setPosition(e[12], e[13], e[14]); l.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]);
  }
}

function panner() {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = .6; p.rolloffFactor = 1.1;
  return p;
}
function placePanner(p, pos) {
  if (p.positionX) { const t = ctx.currentTime; p.positionX.setTargetAtTime(pos.x, t, .02); p.positionY.setTargetAtTime(pos.y, t, .02); p.positionZ.setTargetAtTime(pos.z, t, .02); }
  else p.setPosition(pos.x, pos.y, pos.z);
}
function out(pos) {                                           // where a sound goes: straight out, or from a spot in the room
  if (!pos) return master;
  const p = panner();
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
  p.connect(master); return p;
}
// plays a loaded clip variant; false if none of its clips has loaded yet
function playClip(c, o) {
  const ready = c.files.filter(f => buffers[f]); if (!ready.length) return false;
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = buffers[ready[Math.floor(Math.random() * ready.length)]];
  if (c.jitter) s.playbackRate.value = 1 + (Math.random() * 2 - 1) * c.jitter;   // so repeats don't sound identical
  g.gain.value = c.vol * (c.power ? 1 - c.power + c.power * clamp01(o.power) * 1.6 : 1);
  s.connect(g).connect(out(o.pos)); s.start();
  return true;
}

/** A looping sound that follows something around: h.update(pos, volume) every frame (volume 0 fades it out). */
export function loop(name) {
  const h = { src: null, gain: null, pan: null };
  h.update = (pos, vol) => {
    if (!ctx) return;
    if (!h.src) {
      const b = buffers[LOOP_CLIPS[name]]; if (!b || !vol) return;
      h.gain = ctx.createGain(); h.gain.gain.value = 0; h.pan = panner();
      h.src = ctx.createBufferSource(); h.src.buffer = b; h.src.loop = true;
      h.src.connect(h.gain).connect(h.pan).connect(master); h.src.start();
    }
    if (pos) placePanner(h.pan, pos);
    h.gain.gain.setTargetAtTime(muted ? 0 : vol, ctx.currentTime, .15);
  };
  return h;
}
/**
 * A song that comes from a spot in the room (ADAprime dancing). Resolves to a handle once decoded:
 * h.time() seconds played (on the audio clock, for syncing moves), h.update(pos), h.stop(), h.ended.
 */
const songs = {};
export async function music(url, pos, vol = .9) {
  ac();
  if (!songs[url]) songs[url] = fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
    .then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no)));
  const buf = await songs[url];
  const s = ctx.createBufferSource(), g = ctx.createGain(), p = panner();
  p.refDistance = 1.5; p.rolloffFactor = .6;                 // a song should fill the room, not just its chest
  s.buffer = buf; g.gain.value = muted ? 0 : vol; s.connect(g).connect(p).connect(master); placePanner(p, pos);
  const t0 = ctx.currentTime + .05, h = { duration: buf.duration, ended: false };
  s.onended = () => { h.ended = true; }; s.start(t0);
  h.time = () => Math.max(0, ctx.currentTime - t0);
  h.update = at => { placePanner(p, at); g.gain.setTargetAtTime(muted ? 0 : vol, ctx.currentTime, .1); };
  h.stop = () => { if (h.ended) return; h.ended = true; g.gain.setTargetAtTime(0, ctx.currentTime, .15); try { s.stop(ctx.currentTime + .6); } catch {} };
  return h;
}

function env(g, t0, vol, dur, attack = .005) {
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), t0 + attack);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
}
function tone({ f0, f1 = f0, dur = .2, vol = .2, type = 'sine', at = 0, pos, vib = 0 }) {
  const t0 = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  if (vib) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = vib; lg.gain.value = f0 * .08; lfo.connect(lg).connect(o.frequency); lfo.start(t0); lfo.stop(t0 + dur); }
  env(g, t0, vol, dur); o.connect(g).connect(out(pos)); o.start(t0); o.stop(t0 + dur + .02);
}
function noise({ dur = .2, vol = .2, freq = 1000, freq1 = freq, q = 1, filter = 'bandpass', at = 0, pos, attack = .005 }) {
  const t0 = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = filter; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t0 + dur);
  env(g, t0, vol, dur, attack); s.connect(f).connect(g).connect(out(pos)); s.start(t0, Math.random() * .5); s.stop(t0 + dur + .02);
}

const clamp01 = v => Math.max(0, Math.min(1, Number.isFinite(v) ? v : .5));   // power left out: medium
const SOUNDS = {
  // ADAbot being caught, thrown and bouncing around the room (power: 0..1, how hard)
  grab:     o => { tone({ f0: 520, f1: 860, dur: .09, vol: .18, pos: o.pos }); tone({ f0: 860, f1: 1250, dur: .1, vol: .14, at: .07, pos: o.pos }); },
  putDown:  o => tone({ f0: 700, f1: 480, dur: .12, vol: .12, pos: o.pos }),
  throw:    o => { const p = clamp01(o.power); noise({ dur: .3 + p * .25, vol: .1 + p * .2, freq: 500, freq1: 2600, q: 1.4, attack: .03, pos: o.pos }); },
  bounce:   o => { const p = clamp01(o.power);                // a rubbery boing plus a soft thump
    tone({ f0: 180 + p * 120, f1: 95, dur: .22 + p * .1, vol: .12 + p * .3, pos: o.pos });
    tone({ f0: 420 + p * 200, f1: 260, dur: .18, vol: .05 + p * .12, type: 'triangle', at: .01, pos: o.pos });
    noise({ dur: .08, vol: .06 + p * .2, freq: 300, freq1: 120, filter: 'lowpass', pos: o.pos }); },
  clank:    o => { const p = clamp01(o.power);                // metal body against a wall or furniture
    tone({ f0: 760, f1: 520, dur: .16, vol: .06 + p * .16, type: 'square', pos: o.pos });
    tone({ f0: 1240, f1: 980, dur: .3, vol: .04 + p * .1, type: 'triangle', at: .005, pos: o.pos });
    noise({ dur: .09, vol: .08 + p * .22, freq: 2400, freq1: 900, q: 2, pos: o.pos }); },
  dizzy:    o => tone({ f0: 620, f1: 240, dur: .9, vol: .12, type: 'triangle', vib: 9, pos: o.pos }),
  recover:  o => { tone({ f0: 400, f1: 900, dur: .25, vol: .12, pos: o.pos }); tone({ f0: 900, f1: 1300, dur: .12, vol: .1, at: .22, pos: o.pos }); },
  land:     o => { tone({ f0: 520, f1: 780, dur: .12, vol: .12, pos: o.pos }); tone({ f0: 780, f1: 1040, dur: .12, vol: .1, at: .1, pos: o.pos }); },
  // talking
  listenOn:  () => { tone({ f0: 440, f1: 660, dur: .1, vol: .12 }); tone({ f0: 660, f1: 990, dur: .12, vol: .12, at: .09 }); },
  listenOff: () => { tone({ f0: 990, f1: 660, dur: .1, vol: .1 }); tone({ f0: 660, f1: 440, dur: .12, vol: .1, at: .09 }); },
  send:      () => tone({ f0: 1320, f1: 1500, dur: .14, vol: .08 }),
  answer:    o => { [660, 880, 1320].forEach((f, i) => tone({ f0: f, dur: .35 - i * .05, vol: .08, type: 'triangle', at: i * .07, pos: o.pos })); },
  error:     () => { tone({ f0: 220, f1: 160, dur: .25, vol: .12, type: 'sawtooth' }); tone({ f0: 180, f1: 120, dur: .3, vol: .1, type: 'sawtooth', at: .18 }); },
  click:     () => noise({ dur: .03, vol: .12, freq: 3200, q: 3 }),
  enterXR:   () => { noise({ dur: .6, vol: .08, freq: 300, freq1: 2400, q: .8, attack: .2 }); tone({ f0: 330, f1: 660, dur: .5, vol: .06, at: .15 }); },
  // ADAprime
  step:      o => noise({ dur: .09, vol: .06 + clamp01(o.power) * .06, freq: 220, freq1: 90, filter: 'lowpass', pos: o.pos }),
  paired:    o => [523, 784, 1046].forEach((f, i) => tone({ f0: f, dur: .3, vol: .1, type: 'triangle', at: i * .09, pos: o.pos })),
  servo:     o => tone({ f0: 300, f1: 520, dur: .25, vol: .05, type: 'sawtooth', pos: o.pos }),
  assemble:  o => { for (let i = 0; i < 6; i++) noise({ dur: .05, vol: .12, freq: 2600 - i * 200, q: 4, at: i * .09, pos: o.pos }); },
  handshake: o => { [523, 659, 784, 1046].forEach((f, i) => tone({ f0: f, dur: .28, vol: .09, type: 'triangle', at: i * .08, pos: o.pos })); },
  charge:    o => tone({ f0: 180, f1: 900, dur: 1, vol: .08, type: 'sawtooth', pos: o.pos }),
  boom:      o => { tone({ f0: 120, f1: 30, dur: .9, vol: .3, pos: o.pos }); tone({ f0: 900, f1: 60, dur: .5, vol: .08, type: 'square', pos: o.pos }); noise({ dur: .7, vol: .25, freq: 1800, freq1: 200, filter: 'lowpass', pos: o.pos }); },
  heroLand:  o => { tone({ f0: 90, f1: 35, dur: .6, vol: .32, pos: o.pos }); noise({ dur: .4, vol: .2, freq: 600, freq1: 120, filter: 'lowpass', pos: o.pos }); },
  online:    o => [262, 392, 523, 784].forEach((f, i) => tone({ f0: f, dur: .9 - i * .1, vol: .1, at: .05 + i * .06, type: 'sawtooth', pos: o.pos })),
  powerDown: o => tone({ f0: 700, f1: 160, dur: .7, vol: .1, type: 'triangle', pos: o.pos }),
};

/** play('bounce', { pos: worldVector3, power: 0..1 }) — never throws. */
export function play(name, o = {}) {
  if (muted) return;
  try {
    ac();
    if (CLIPS[name] && playClip(CLIPS[name], o)) return;    // recorded clip first
    SOUNDS[name] && SOUNDS[name](o);                         // synth fallback
  } catch (e) { console.warn('sfx', name, e); }
}
