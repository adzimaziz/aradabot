// AR ADAbot: ADAbot (and ADAprime) on your floor, on a phone. No server, no AI: everything runs in the browser.
// WebXR immersive-ar with hit-test (Android Chrome). Phones without it (iPhone) get "camera mode": the robots over
// the camera picture, without floor tracking.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createPrime } from './prime.js';
import * as sfx from './sfx.js';

const $ = id => document.getElementById(id);
const RED = '#E3000F';
const asset = f => new URL('../assets/' + f, import.meta.url).href;
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

// Everything (ADAbot, ADAprime, shadows, effects) lives in `world`: its origin is the spot you tapped on the floor,
// and its scale is the size slider. Positions inside it are "local units" (1 = 1 m at 100%).
const HOVER = .5, BOT_SCALE = .22, BOT_SPEED = .9;
let renderer, scene, camera, clock, world, bot, model, prime, reticle, tapMark, pad;
let mode = 'start';                                           // 'start' | 'ar' | 'cam'
let session = null, hitSource = null, placed = false, size = 1;
const head = new THREE.Vector3(), headL = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();

/* ------------------------------------------------------------------ scene */
function initScene() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.xr.enabled = true; renderer.setClearColor(0x000000, 0);
  $('stage').appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .01, 80);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d8f97, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(1.5, 3, 2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, .6); rim.position.set(-2, 1.5, -2); scene.add(rim);
  clock = new THREE.Clock();

  world = new THREE.Group(); world.visible = false; scene.add(world);
  bot = new THREE.Group(); bot.scale.setScalar(BOT_SCALE); bot.position.set(0, HOVER, 0); world.add(bot);
  prime = createPrime(world, bot);

  // soft round shadows under the robots (cheap, and they make them sit on the real floor)
  const blob = spriteTex((x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.55, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
  const shadow = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = -1; world.add(m); return m; };
  shadows.bot = shadow(); shadows.prime = shadow();

  // floor ring that shows where the robots will appear while you scan
  const ringTex = spriteTex((x, s) => { x.strokeStyle = '#fff'; x.lineWidth = s * .06; x.shadowColor = RED; x.shadowBlur = s * .05; x.beginPath(); x.arc(s / 2, s / 2, s * .4, 0, 7); x.stroke();
    x.fillStyle = RED; x.beginPath(); x.arc(s / 2, s / 2, s * .07, 0, 7); x.fill(); }, 256);
  reticle = new THREE.Mesh(new THREE.PlaneGeometry(.3, .3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false }));
  reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);
  tapMark = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: 0 }));
  tapMark.visible = false; world.add(tapMark);
  // camera mode only: a faint pad so the robots don't float in the picture
  pad = new THREE.Mesh(new THREE.CircleGeometry(2.2, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: spriteTex((x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }), transparent: true, depthWrite: false }));
  pad.visible = false; pad.position.y = -.002; world.add(pad);

  buildFace();
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, sfx.unlock, { passive: true }));
  addEventListener('resize', () => { if (renderer.xr.isPresenting) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  renderer.setAnimationLoop(safeFrame);
  window.aradabot = { prime, bot, world, THREE, get size() { return size; } };   // debug handle
}
const shadows = {};
function spriteTex(draw, s = 128) { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

function loadBot() {
  return new GLTFLoader().loadAsync(asset('ada.glb')).then(g => {
    model = g.scene; model.position.y = -.5;
    model.traverse(o => { if (o.isMesh) { o.material.side = THREE.DoubleSide; o.frustumCulled = false; } });
    bot.add(model); model.add(face);
    const glow = spriteTex((x, s) => { const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,215,205,1)'); gr.addColorStop(.3, 'rgba(255,40,30,.85)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, s, s); });
    thrusters = [-.19, .19].map(xx => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.position.set(xx, -.035, .02); model.add(s); return s; });
  });
}
let thrusters = [];

/* ------------------------------------------------------------------ ADAbot's screen face */
let face, faceCtx, faceTex;
const emo = { key: 'idle', until: 0, blink: 0, nextBlink: 2 };
function buildFace() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; faceCtx = c.getContext('2d');
  faceTex = new THREE.CanvasTexture(c); faceTex.colorSpace = THREE.SRGBColorSpace;
  face = new THREE.Mesh(new THREE.PlaneGeometry(.44, .22), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  face.position.set(0, .548, .262);
}
function setEmotion(k, sec = 0) { emo.key = k; emo.until = sec ? clock.elapsedTime + sec : 0; }
function drawFace(t) {
  const x = faceCtx, W = 512, H = 256; x.clearRect(0, 0, W, H);
  x.save(); x.shadowColor = RED; x.shadowBlur = 26; x.fillStyle = RED; x.strokeStyle = RED; x.lineCap = 'round'; x.lineWidth = 22;
  const L = 178, R = 334, cy = 124, k = emo.key;
  emo.nextBlink -= 1 / 60; if (emo.nextBlink < 0) { emo.blink = .14; emo.nextBlink = 2.5 + Math.random() * 3; }
  const b = emo.blink > 0 ? (emo.blink -= 1 / 60, .15) : 1;
  const pill = (cx, h, dy = 0) => { x.beginPath(); x.roundRect(cx - 17, cy - h / 2 * b + dy, 34, Math.max(8, h * b), 17); x.fill(); };
  const arc = (cx, up = true) => { x.beginPath(); x.arc(cx, cy + (up ? 18 : -22), 34, up ? Math.PI * 1.15 : Math.PI * .15, up ? Math.PI * 1.85 : Math.PI * .85); x.stroke(); };
  const star = (cx, s) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * .42 : s; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.fill(); };
  if (k === 'happy') { arc(L); arc(R); }
  else if (k === 'excited') { const s = 44 + Math.sin(t * 10) * 5; star(L, s); star(R, s); }
  else if (k === 'confused') { pill(L, 70); x.beginPath(); x.moveTo(R - 30, cy); x.lineTo(R + 30, cy - 6); x.stroke(); x.font = '700 70px "Chakra Petch", sans-serif'; x.fillText('?', 420, 96); }
  else if (k === 'sleep') { x.beginPath(); x.moveTo(L - 28, cy + 10); x.lineTo(L + 28, cy + 10); x.moveTo(R - 28, cy + 10); x.lineTo(R + 28, cy + 10); x.stroke(); }
  else { pill(L, 76); pill(R, 76); }
  x.restore(); faceTex.needsUpdate = true;
}

/* ------------------------------------------------------------------ ADAbot: flies where you steer or tap */
const target = new THREE.Vector3(0, HOVER, 0), vel = new THREE.Vector3(), tv = new THREE.Vector3();
let botMode = null, botAct = null, spin = 0, hopT = 0;       // botMode: 'sit' | 'sleep'
function wakeBot() { if (botMode) { botMode = null; target.y = HOVER; setEmotion('excited', 1.2); } }
// a point `metres` in front of the phone, on the floor, in local units
function inFront(metres) {
  return new THREE.Vector3(headL.x + fwd.x * metres / size, 0, headL.z + fwd.z * metres / size);
}
function botCommand(name) {
  switch (name) {
    case 'sit': botMode = 'sit'; target.y = BOT_SCALE * .45; setEmotion('happy', 2); sfx.play('land', { pos: bot.position }); return 'Duduk diam-diam.';
    case 'sleep': botMode = 'sleep'; target.y = BOT_SCALE * .45; setEmotion('sleep'); return 'Zzz…';
    case 'stand': botMode = null; target.y = HOVER; setEmotion('excited', 2); hopT = .5; sfx.play('recover', { pos: bot.position }); return 'Saya terbang!';
    case 'jump': wakeBot(); vel.y += 2.4; hopT = .5; botAct = { kind: 'flip', t: 0 }; setEmotion('excited', 1.5); sfx.play('throw', { pos: bot.position, power: .5 }); return 'Hup!';
    case 'dance': wakeBot(); botAct = { kind: 'dance', t: 0 }; spin = 1; setEmotion('excited', 3); sfx.play('paired', { pos: bot.position }); return '🎵';
    case 'spin': spin = 1; setEmotion('happy', 1.5); sfx.play('throw', { pos: bot.position, power: .3 }); return 'Wheee!';
    case 'come': wakeBot(); target.copy(inFront(.6)).setY(HOVER); return 'Datang!';
  }
  return null;
}
function updateBot(dt, t, steer) {
  if (prime.holdsBot) { target.copy(bot.position); vel.set(0, 0, 0); return; }   // the transformation moves ADAbot itself
  if (steer.lengthSq() > .0064) { wakeBot(); target.addScaledVector(steer, BOT_SPEED * dt); target.x = bot.position.x + THREE.MathUtils.clamp(target.x - bot.position.x, -.35, .35); target.z = bot.position.z + THREE.MathUtils.clamp(target.z - bot.position.z, -.35, .35); }
  vel.addScaledVector(tv.copy(target).sub(bot.position), 3.6 * dt).multiplyScalar(Math.max(0, 1 - 3 * dt));
  bot.position.addScaledVector(vel, dt);
  if (bot.position.y < BOT_SCALE * .4) { bot.position.y = BOT_SCALE * .4; vel.y = Math.max(0, vel.y); }
  hopT = Math.max(0, hopT - dt);
  const bob = botMode ? Math.sin(hopT / .5 * Math.PI) * .06 : Math.sin(t * 2) * .012 + Math.sin(hopT / .5 * Math.PI) * .06;
  if (model) model.position.y = -.5 + bob / BOT_SCALE;
  // face where it's flying, or you when it's still
  const speed = Math.hypot(vel.x, vel.z), look = speed > .12 ? Math.atan2(vel.x, vel.z) : Math.atan2(headL.x - bot.position.x, headL.z - bot.position.z);
  spin = Math.max(0, spin - dt * .9);
  let dy = look + spin * Math.PI * 2 - bot.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  bot.rotation.y += dy * (1 - Math.pow(.01, dt));
  bot.rotation.x = THREE.MathUtils.lerp(bot.rotation.x, Math.min(.35, speed * .35), 1 - Math.pow(.02, dt));   // leans into flight
  bot.rotation.z = 0;
  if (botAct) {                                              // a front flip, or a happy wiggle
    botAct.t += dt; const p = botAct.t / ({ flip: .7, dance: 3 }[botAct.kind] || 1.4);
    if (botAct.kind === 'flip') bot.rotation.x = -Math.min(1, ease(p)) * Math.PI * 2;
    else { bot.rotation.z = Math.sin(botAct.t * 10) * .35 * (1 - p); bot.position.y += Math.sin(botAct.t * 12) * .004; }
    if (p >= 1) { bot.rotation.x = 0; botAct = null; }
  }
  thrusters.forEach(s => { s.scale.setScalar(botMode ? .04 : .14 + Math.sin(t * 22) * .02); s.material.opacity = botMode ? .3 : 1; });
}

/* ------------------------------------------------------------------ ADAprime */
async function startPrime() {
  if (prime.active || primeBusy) return;
  primeBusy = true; refreshUI();
  if (!prime.ready) hint('ADAprime sedang dimuatkan…');
  try { await prime.start(new THREE.Vector3(bot.position.x, 0, bot.position.z), headL.clone()); }
  catch (e) { console.error(e); toast('ADAprime tak dapat dimuatkan 😢'); }
  primeBusy = false; botMode = null; setEmotion('excited', 4.5); hint(''); refreshUI();
}
function endPrime() { if (!prime.active || prime.cine) return; prime.stop(); setEmotion('happy', 3); refreshUI(); }
let primeBusy = false;
function activeCommand(name) {
  const line = prime.active ? prime.command(name) : botCommand(name);
  toast(line || 'Tak boleh sekarang 🙃');
  refreshUI();
}

/* ------------------------------------------------------------------ size: slider and pinch */
// The robot you're looking at stays where it is: the world is re-anchored around its floor spot.
function setSize(s) {
  s = THREE.MathUtils.clamp(s, .05, 2);
  const focus = (prime.active && prime.group.visible ? prime.group.position : bot.position).clone().setY(0);
  const before = world.localToWorld(focus.clone());
  size = s; world.scale.setScalar(s); world.updateMatrixWorld(true);
  const after = world.localToWorld(focus.clone());
  world.position.x += before.x - after.x; world.position.z += before.z - after.z;
  $('size').value = Math.round(s * 100); $('sizeVal').textContent = Math.round(s * 100) + '%';
}

/* ------------------------------------------------------------------ joystick */
const stick = { id: null, x: 0, y: 0 };
function setupStick() {
  const el = $('stick'), knob = $('knob');
  const move = e => {
    const r = el.getBoundingClientRect(), R = r.width / 2;
    let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    stick.x = x; stick.y = y; knob.style.transform = `translate(${x * R * .6}px,${y * R * .6}px)`;
  };
  el.addEventListener('pointerdown', e => { stick.id = e.pointerId; try { el.setPointerCapture(e.pointerId); } catch {} move(e); e.stopPropagation(); });
  el.addEventListener('pointermove', e => { if (e.pointerId === stick.id) move(e); });
  const end = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

/* ------------------------------------------------------------------ taps and pinches on the screen */
const ptrs = new Map(); let pinch = null, tapStart = null;
function setupTouches() {
  const hud = $('hud'), onUI = e => e.target.closest && e.target.closest('.ui');
  // in AR, taps on buttons must not also count as a tap in the room
  document.querySelectorAll('.ui').forEach(el => el.addEventListener('beforexrselect', e => e.preventDefault()));
  hud.addEventListener('pointerdown', e => {
    if (onUI(e)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) tapStart = { x: e.clientX, y: e.clientY, at: performance.now() };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: size }; tapStart = null; }
  });
  hud.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2 && placed) { const [a, b] = [...ptrs.values()]; setSize(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(20, pinch.d)); }
    if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 14) tapStart = null;
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (tapStart && ptrs.size === 0 && performance.now() - tapStart.at < 450) onTap(e.clientX, e.clientY);
    if (ptrs.size === 0) tapStart = null;
  };
  hud.addEventListener('pointerup', up); hud.addEventListener('pointercancel', up);
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitV = new THREE.Vector3();
function onTap(x, y) {
  if (mode === 'ar' && !placed) { if (reticle.visible) placeWorld(new THREE.Vector3().setFromMatrixPosition(reticle.matrix)); return; }
  if (!placed || prime.cine) return;
  const cam = mode === 'ar' ? renderer.xr.getCamera().cameras[0] || renderer.xr.getCamera() : camera;
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, cam);
  floorPlane.constant = -world.position.y;
  if (!ray.ray.intersectPlane(floorPlane, hitV)) return;
  const p = world.worldToLocal(hitV.clone());
  if (p.distanceTo(headL.clone().setY(0)) > 25 / size) return;   // tapped near the horizon
  tapMark.position.set(p.x, .003, p.z); tapMark.visible = true; tapMark.userData.t = 0;
  if (prime.active) prime.goTo(p); else { wakeBot(); target.set(p.x, HOVER, p.z); }
  sfx.play('servo', { pos: p });
}

/* ------------------------------------------------------------------ UI: buttons, hints, toasts */
function hint(text) { const el = $('hint'); if (el.textContent !== text) el.textContent = text; }
let toastTimer = 0;
function toast(text) { const el = $('toast'); el.textContent = text; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 1600); }
let lastUI = '';
function refreshUI() {
  const P = prime.active, m = P ? prime.mode : botMode, busy = primeBusy || !!prime.cine;
  const list = P
    ? [['dance', '🕺 Menari', m === 'dance'], ['jump', '⤴ Lompat'], [m === 'fly' ? 'land' : 'fly', m === 'fly' ? '⬇ Mendarat' : '🚀 Terbang', m === 'fly'],
       [m === 'sit' || m === 'sleep' ? 'stand' : 'sit', m === 'sit' || m === 'sleep' ? '⬆ Berdiri' : '🪑 Duduk', m === 'sit'], ['spin', '🌀 Pusing'], ['come', '👋 Panggil']]
    : [['dance', '🎵 Goyang'], ['jump', '⤴ Lompat'], [m ? 'stand' : 'sit', m ? '⬆ Terbang' : '🪑 Duduk', !!m], ['sleep', '😴 Tidur', m === 'sleep'], ['spin', '🌀 Pusing'], ['come', '👋 Panggil']];
  const key = JSON.stringify([P, busy, list]);
  if (key === lastUI) return; lastUI = key;
  const box = $('actions'); box.innerHTML = '';
  for (const [cmd, label, on] of list) {
    const b = document.createElement('button'); b.textContent = label; b.disabled = busy; if (on) b.classList.add('on');
    b.addEventListener('click', () => activeCommand(cmd)); box.appendChild(b);
  }
  const bp = $('btnPrime'); bp.disabled = busy;
  bp.textContent = P ? '↩ Balik jadi ADAbot' : '⚡ Jadi ADAprime'; bp.classList.toggle('cool', P);
}
setInterval(() => { if (mode !== 'start') refreshUI(); }, 400);

function placeWorld(at) {
  const first = !world.visible;
  world.position.copy(at); world.visible = true; reticle.visible = false; placed = true;
  if (first) { bot.position.set(0, HOVER + .5, 0); target.set(0, HOVER, 0); vel.set(0, 0, 0); setEmotion('excited', 2.5); hopT = .5; sfx.play('recover', { pos: bot.position }); toast('Hai! Saya ADAbot 👋'); }
  hint(''); $('controls').hidden = false; $('btnMove').hidden = mode !== 'ar'; refreshUI();
  if (!prime.ready) prime.load().catch(() => {});             // ready before you ask for it
}

/* ------------------------------------------------------------------ AR session (WebXR) / camera mode */
async function arSupported() {
  try { return !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); } catch { return false; }
}
async function startAR() {
  sfx.unlock();
  $('hud').hidden = false;
  try {
    session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test', 'dom-overlay'], optionalFeatures: ['local-floor'], domOverlay: { root: $('hud') } });
  } catch (e) {
    console.warn('AR', e); $('hud').hidden = true;
    $('startNote').textContent = 'AR tak dapat dibuka di telefon ni. Cuba mod kamera.'; setStartButton(false); return;
  }
  mode = 'ar'; $('start').hidden = true;
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  const viewer = await session.requestReferenceSpace('viewer');
  hitSource = await session.requestHitTestSource({ space: viewer });
  session.addEventListener('end', stopAll);
  placed = false; world.visible = false; $('controls').hidden = true;
  hint('Gerakkan telefon perlahan-lahan ke kiri dan kanan untuk scan lantai…');
}
async function startCam() {
  sfx.unlock();
  mode = 'cam'; $('start').hidden = true; $('hud').hidden = false; document.body.classList.add('cammode');
  camera.position.set(0, 1.6, 4.4); camera.lookAt(0, .5, 0);
  pad.visible = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    const v = $('cam'); v.srcObject = stream; v.hidden = false; await v.play().catch(() => {});
  } catch (e) { console.warn('camera', e); }                // no camera: the robots on a plain background
  placeWorld(new THREE.Vector3(0, 0, 0));
  setSize(.6);                                               // no real floor to judge by: start a bit smaller
}
function stopAll() {
  if (session) { const s = session; session = null; s.end().catch(() => {}); }
  hitSource = null; mode = 'start'; placed = false; world.visible = false; reticle.visible = false; pad.visible = false;
  const v = $('cam'); if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; } v.hidden = true;
  document.body.classList.remove('cammode');
  $('hud').hidden = true; $('controls').hidden = true; $('start').hidden = false;
}

/* ------------------------------------------------------------------ every frame */
const steerV = new THREE.Vector3(), ZERO = new THREE.Vector3(), up = new THREE.Vector3(), hitQ = new THREE.Quaternion();
const listener = { matrixWorld: new THREE.Matrix4() };
const hoverHum = sfx.loop('hover'), primeHum = sfx.loop('hover'), soundAt = new THREE.Vector3();
const errors = window.frameErrors = [];
function safeFrame(time, xf) {
  try { frame(time, xf); }
  catch (e) { if (errors.length < 20) { errors.push(String(e && e.stack || e)); console.error(e); } try { renderer.render(scene, camera); } catch {} }
}
function frame(time, xf) {
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  const cam = mode === 'ar' ? renderer.xr.getCamera() : camera;
  head.setFromMatrixPosition(cam.matrixWorld);
  cam.getWorldDirection(fwd); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
  right.set(-fwd.z, 0, fwd.x);
  world.updateMatrixWorld(true);
  headL.copy(head); world.worldToLocal(headL);

  // scanning: the ring sits on the first flat surface the camera finds
  if (mode === 'ar' && !placed && xf && hitSource) {
    const hits = xf.getHitTestResults(hitSource), ref = renderer.xr.getReferenceSpace();
    const pose = hits.length && hits[0].getPose(ref);
    let flat = false;
    if (pose) { const o = pose.transform.orientation; hitQ.set(o.x, o.y, o.z, o.w); up.set(0, 1, 0).applyQuaternion(hitQ); flat = up.y > .85; }
    reticle.visible = !!flat;
    if (flat) { reticle.matrix.fromArray(pose.transform.matrix); reticle.material.opacity = .75 + .25 * Math.sin(t * 5); }
    hint(flat ? 'Ketik skrin untuk letak ADAbot di sini' : 'Gerakkan telefon perlahan-lahan ke kiri dan kanan untuk scan lantai…');
  }

  if (emo.until && t > emo.until) setEmotion(botMode === 'sleep' ? 'sleep' : 'idle');
  if (model) drawFace(t);

  // joystick -> a direction on the floor, relative to where the phone points
  steerV.set(0, 0, 0).addScaledVector(fwd, -stick.y).addScaledVector(right, stick.x);
  if (steerV.lengthSq() < .0064) steerV.set(0, 0, 0);
  if (world.visible) {
    updateBot(dt, t, prime.active ? ZERO : steerV);
    prime.steer.copy(prime.active ? steerV : ZERO);
    const primeEmo = emo.key === 'excited' || emo.key === 'happy' ? 'happy' : 'idle';
    prime.update(dt, t, primeEmo, headL, [], false, null);

    // shadows
    const sb = shadows.bot; sb.visible = bot.visible && !!model;
    if (sb.visible) { const h = bot.position.y; sb.position.set(bot.position.x, .002, bot.position.z); sb.scale.setScalar(.32 * THREE.MathUtils.clamp(1.1 - h * .5, .4, 1)); sb.material.opacity = THREE.MathUtils.clamp(1.15 - h * .6, .25, 1); }
    const sp = shadows.prime, g = prime.group; sp.visible = g.visible;
    if (sp.visible) { const h = Math.max(0, g.position.y); sp.position.set(g.position.x, .003, g.position.z); sp.scale.setScalar(.8 * g.scale.x / prime.unit * THREE.MathUtils.clamp(1 - h * .35, .35, 1)); sp.material.opacity = THREE.MathUtils.clamp(1 - h * .5, .2, 1); }
    if (tapMark.visible) { const u = (tapMark.userData.t += dt); tapMark.scale.setScalar(.15 + u * .5); tapMark.material.opacity = Math.max(0, .9 - u * 1.5); if (u > .6) tapMark.visible = false; }
  }

  // 3D sound: the listener is the phone, expressed in the world's own units
  listener.matrixWorld.copy(world.matrixWorld).invert().multiply(cam.matrixWorld);
  sfx.setListener(listener);
  hoverHum.update(bot.position, world.visible && bot.visible && !botMode ? .15 : 0);
  primeHum.update(prime.active && prime.headPos(soundAt) && world.worldToLocal(soundAt) || bot.position, prime.active ? prime.thrust * .45 : 0);

  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ start */
function setStartButton(ar) {
  const b = $('btnStart'); b.disabled = false;
  b.textContent = ar ? 'Mula AR' : 'Mula (mod kamera)';
  b.onclick = ar ? startAR : startCam;
}
async function boot() {
  initScene(); setupStick(); setupTouches();
  $('btnExit').onclick = stopAll;
  $('btnMove').onclick = () => { placed = false; $('controls').hidden = true; hint('Halakan ke tempat baru, kemudian ketik skrin'); };
  $('btnMute').onclick = () => { sfx.setMuted(!sfx.muted); $('btnMute').textContent = sfx.muted ? '🔇' : '🔊'; };
  $('btnPrime').onclick = () => prime.active ? endPrime() : startPrime();
  $('size').addEventListener('input', e => setSize(e.target.value / 100));
  const [ar] = await Promise.all([arSupported(), loadBot().catch(e => { console.error(e); $('startNote').textContent = 'ADAbot tak dapat dimuatkan. Muat semula halaman.'; })]);
  setStartButton(ar);
  if (!ar) $('startNote').textContent = window.isSecureContext
    ? 'Telefon ni tak sokong AR scan lantai (contohnya iPhone). ADAbot akan keluar atas gambar kamera. Untuk AR penuh, guna Chrome di telefon Android.'
    : 'AR perlukan sambungan https.';
}
boot();
