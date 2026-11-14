// ADAprime: ADAbot's powered-up form ("/prime"), a 1.8 m rigged robot standing on the floor.
// Poses (arm/leg IK from the rest pose), HUD eyes on the visor and the transformation come from the ADAbot widget,
// rebuilt for WebXR: everything is in metres and the cinematic happens in your room.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { play, music } from './sfx.js';

export const PRIME_HEIGHT = 1.60;               // floor to the top of the head, in metres
const RED = '#E3000F';
// shape and depth of the visor in model units (the model is 1.0 tall); the eyes are drawn on it
const PV = {"x0":-0.068,"x1":0.068,"y0":0.82,"y1":0.888,"nx":24,"ny":12,"z":[[0.06,0.064,0.0771,0.0897,0.0963,0.1007,0.1043,0.1079,0.1097,0.1098,0.1099,0.1099,0.1099,0.1098,0.1097,0.1096,0.1096,0.1075,0.1039,0.1001,0.0954,0.0886,0.0719,0.0635,0.0595],[0.056,0.0603,0.0751,0.0844,0.0899,0.0992,0.1042,0.1088,0.1111,0.1111,0.1111,0.111,0.111,0.111,0.1111,0.1111,0.1111,0.1082,0.1034,0.0986,0.0888,0.0832,0.0733,0.06,0.0554],[0.0549,0.0631,0.0741,0.0832,0.0898,0.0964,0.1002,0.1053,0.1085,0.1085,0.1086,0.1087,0.1088,0.1088,0.1087,0.1086,0.1085,0.1045,0.0997,0.0952,0.0884,0.0821,0.0725,0.0615,0.0546],[0.055,0.0622,0.0728,0.0821,0.0886,0.0948,0.099,0.103,0.1059,0.1063,0.1066,0.107,0.1073,0.107,0.1066,0.1062,0.1059,0.1026,0.0985,0.0936,0.0869,0.081,0.0718,0.0612,0.0547],[0.0551,0.0614,0.0721,0.0809,0.0871,0.0933,0.0975,0.1016,0.1049,0.1053,0.1057,0.106,0.1063,0.1059,0.1056,0.1052,0.1049,0.1012,0.097,0.0921,0.0857,0.0799,0.0712,0.0605,0.0547],[0.0552,0.0607,0.0714,0.0792,0.0856,0.0918,0.0961,0.1003,0.104,0.1043,0.1047,0.105,0.1053,0.1049,0.1045,0.1042,0.1039,0.0998,0.0956,0.0906,0.0846,0.0784,0.0705,0.0572,0.0547],[0.0551,0.0582,0.0695,0.077,0.0837,0.0903,0.0948,0.0989,0.103,0.1034,0.1037,0.104,0.1042,0.1039,0.1035,0.1032,0.1025,0.0983,0.0941,0.0892,0.0824,0.0759,0.0683,0.0572,0.0546],[0.0549,0.0585,0.0674,0.0749,0.0815,0.0876,0.0926,0.0973,0.1018,0.1023,0.1026,0.1029,0.1032,0.1029,0.1026,0.1023,0.1011,0.0965,0.0919,0.0864,0.0796,0.0736,0.066,0.0586,0.0542],[0.0596,0.0615,0.0648,0.0725,0.0787,0.0849,0.09,0.0946,0.0996,0.1008,0.1011,0.1014,0.1017,0.1014,0.101,0.1007,0.0987,0.094,0.0893,0.0836,0.0772,0.0713,0.0652,0.0617,0.0589],[0.0585,0.0659,0.0683,0.0708,0.0759,0.0821,0.0873,0.0922,0.0972,0.099,0.0993,0.0997,0.1,0.0996,0.0993,0.0989,0.0964,0.0915,0.0867,0.0809,0.072,0.0702,0.0687,0.0654,0.0576],[0.0569,0.0648,0.0701,0.0749,0.0747,0.0767,0.0848,0.0898,0.0948,0.0973,0.0976,0.0979,0.0982,0.0979,0.0975,0.0972,0.094,0.0892,0.0843,0.076,0.074,0.0743,0.0695,0.0641,0.0561],[0.0555,0.0637,0.0688,0.0744,0.0799,0.078,0.0803,0.0871,0.0924,0.0955,0.0958,0.0962,0.0965,0.0961,0.0958,0.0954,0.0917,0.0864,0.0811,0.0776,0.0791,0.0736,0.0682,0.0627,0.0547],[0.0542,0.0624,0.0678,0.0729,0.0786,0.0778,0.0824,0.0838,0.0891,0.0936,0.0939,0.0942,0.0946,0.0942,0.0938,0.0935,0.0882,0.0843,0.0813,0.0796,0.0777,0.0722,0.0671,0.0613,0.0532]]};

// poses: body parts = rotations around the model's axes; arms = elbow (E) and fist (H) targets; legs = knee (K) and ankle (F)
// (arm and leg points are for the LEFT side; the right side is mirrored)
const RELAX = { E: [.19, .635, -.02], H: [.225, .46, .025] }, STAND = { K: [.119, .361, .006], F: [.17, .103, -.033] };
const PPOSE = {
  idle:      () => ({ L: RELAX, R: RELAX }),
  happy:     () => ({ Head: [-.08, 0, 0], L: RELAX, R: { E: [.2, .645, .06], H: [.205, .79, .1] } }),
  listening: () => ({ Spine: [.1, 0, 0], Spine2: [.05, 0, 0], Head: [.05, -.15, -.14], L: { E: [.18, .64, .04], H: [.2, .49, .1] }, R: { E: [.18, .64, .04], H: [.2, .49, .1] } }),
  thinking:  () => ({ Head: [.16, .12, .08], Neck: [.05, 0, 0], Spine2: [.04, 0, 0], R: { E: [.12, .64, .12], H: [.035, .77, .13] }, L: { E: [.17, .655, .07], H: [.03, .645, .14] } }),
  excited:   () => ({ Head: [-.18, 0, 0], L: { E: [.22, .88, 0], H: [.26, 1.06, 0] }, R: { E: [.22, .88, 0], H: [.26, 1.06, 0] } }),
  confused:  () => ({ Head: [0, .15, .3], Spine2: [0, 0, .06], R: { E: [.25, .785, .03], H: [.115, .885, .03] }, L: RELAX }),
  wave:      () => ({ Head: [-.05, 0, -.08], L: RELAX, R: { E: [.27, .8, .04], H: [.3, .98, .06] } }),
  sorry:     () => ({ Spine: [.12, 0, 0], Spine2: [.08, 0, 0], Neck: [.2, 0, 0], Head: [.45, 0, 0], HipsY: -.01, L: { E: [.17, .63, -.05], H: [.185, .46, -.055] }, R: { E: [.17, .63, -.05], H: [.185, .46, -.055] } }),
  kneel:     () => ({ HipsY: -.24, Spine: [.35, 0, 0], Head: [.2, 0, 0], LegL: { K: [.08, .36, .2], F: [.09, .1, .24] }, LegR: { K: [.075, .13, .06], F: [.08, .1, -.2] }, L: RELAX, R: { E: [.17, .6, .1], H: [.15, .42, .2] } }),
  // boxing guard (mirrors your fighting stance), Iron Man hover, sitting on the floor, asleep, jumping, dancing
  guard:     () => ({ HipsY: -.03, Spine: [.08, 0, 0], Head: [.06, 0, 0], L: { E: [.2, .68, .12], H: [.1, .85, .2] }, R: { E: [.2, .68, .12], H: [.1, .85, .2] }, LegL: { K: [.13, .35, .07], F: [.17, .1, .07] }, LegR: { K: [.12, .35, -.03], F: [.16, .1, -.11] } }),
  fly:       () => ({ Spine: [-.06, 0, 0], Head: [-.1, 0, 0], L: { E: [.23, .63, -.05], H: [.3, .5, -.07] }, R: { E: [.23, .63, -.05], H: [.3, .5, -.07] }, LegL: { K: [.08, .36, -.02], F: [.08, .1, -.09] }, LegR: { K: [.08, .36, -.02], F: [.08, .1, -.09] } }),
  sit:       () => ({ HipsY: -.44, Spine: [.06, 0, .05], Spine2: [.03, 0, .03], Head: [.04, .18, .08], LegL: { K: [.09, .02, .23], F: [.11, -.04, .45] }, LegR: { K: [.1, .2, .2], F: [.12, -.03, .33] }, R: { E: [.16, .72, .13], H: [.03, .75, .25] }, L: { E: [.21, .66, .08], H: [.1, .56, .22] } }),
  sleep:     () => ({ ...PPOSE.sit(), HipsY: -.45, Spine: [.14, 0, .1], Spine2: [.07, 0, .06], Neck: [.15, 0, .12], Head: [.35, .1, .28] }),
  air:       () => ({ Spine: [-.04, 0, 0], Head: [-.08, 0, 0], LegL: { K: [.125, .36, .07], F: [.15, .12, -.03] }, LegR: { K: [.125, .36, .07], F: [.15, .12, -.03] }, L: { E: [.22, .64, -.07], H: [.27, .48, -.1] }, R: { E: [.22, .64, -.07], H: [.27, .48, -.1] } }),
  crouch:    () => ({ HipsY: -.09, Spine: [.18, 0, 0], Head: [-.05, 0, 0], LegL: { K: [.13, .32, .1], F: [.16, .1, -.02] }, LegR: { K: [.13, .32, .1], F: [.16, .1, -.02] }, L: { E: [.2, .62, .06], H: [.22, .47, .13] }, R: { E: [.2, .62, .06], H: [.22, .47, .13] } }),
  dance:     () => ({ Head: [-.05, 0, 0], L: { E: [.22, .8, .05], H: [.26, .95, .08] }, R: { E: [.22, .8, .05], H: [.26, .95, .08] } }),
};
const PCTRL = ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head'];
function pflat(p) {
  const o = { HipsY: p.HipsY || 0 }; PCTRL.forEach(n => o[n] = (p[n] || [0, 0, 0]).slice());
  const L = p.L || RELAX, R = p.R || RELAX, GL = p.LegL || STAND, GR = p.LegR || STAND, m = v => [-v[0], v[1], v[2]];
  o.LE = L.E.slice(); o.LH = L.H.slice(); o.RE = m(R.E); o.RH = m(R.H); o.LK = GL.K.slice(); o.LF = GL.F.slice(); o.RK = m(GR.K); o.RF = m(GR.F);
  return o;
}
// Dances copied from videos (frame by frame, with MediaPipe; see tools/dance): moves + the song they go with.
// The service worker keeps these cached: bump v whenever the files change.
const asset = f => new URL('../assets/' + f, import.meta.url).href;
const DANCE = { moves: asset('dance/dance.json?v=3'), song: asset('dance/dance.mp3?v=3') };
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function spriteTex(draw, s = 128) { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }


/**
 * scene: where ADAprime lives. bot: ADAbot's group (hidden and moved by the transformation).
 * Returns the controller; call update(dt, t, emotionKey, head) every frame.
 */
export function createPrime(scene, bot) {
  const P = { active: false, ready: false, holdsBot: false, cine: null };
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  P.group = group;                                            // AR: the app puts a shadow under it
  // tilt: leans the whole body from the feet (staggering, falling over, leaning into flight)
  const tilt = new THREE.Group(); group.add(tilt);
  const inner = new THREE.Group(); tilt.add(inner);
  let B = {}, REST = {}, PW = {}, AR = {}, LR = {}, HIPS, HIPS_UP, now, target, key = 'idle', mats = [], eye, chest, loading = null, jets = [];
  let FEET = [], soleGap = 0, baseY = 0, skin = null, seatT = 0;
  // Sitting / asleep: the buttocks are the lowest part, so plant the lowest point of the skinned mesh itself
  // (CPU skinning, so only a few times a second)
  const parentInv = new THREE.Matrix4();
  function plantSeat(dt) {
    if (!skin) return;
    if ((seatT -= dt) <= 0) {
      seatT = .25;
      skin.skeleton.update(); skin.computeBoundingBox();
      const b = skin.boundingBox.clone().applyMatrix4(skin.matrixWorld).applyMatrix4(parentInv.copy(group.parent.matrixWorld).invert());
      plantSeat.want = inner.position.y - (b.min.y - (spot.y + alt)) / (P.unit * formScale);   // metres off the floor -> model units
    }
    if (plantSeat.want !== undefined) inner.position.y += (plantSeat.want - inner.position.y) * Math.min(1, dt * 8);
  }
  // Keeps the soles on the floor: the leg IK targets don't put the ankles exactly where the rest pose had them,
  // which left ADAprime hovering a few centimetres up. After posing, lower or raise the body so the lowest foot
  // joint is back at its resting height above the floor.
  const footV = new THREE.Vector3();
  function plantFeet(dt) {
    if (!FEET.length) return;
    B.Hips.updateWorldMatrix(true, true);
    let low = Infinity;
    for (const b of FEET) { inner.worldToLocal(b.getWorldPosition(footV)); low = Math.min(low, footV.y); }
    const want = soleGap - low;                              // inner offset that puts that joint soleGap above the floor
    inner.position.y += (want - inner.position.y) * Math.min(1, dt * 12);
  }
  let emissive = 0, eyesOn = 1, formScale = 1, poseOverride = null, fade = 1, prevKey = 'idle', blinkAt = 2, blinkT = -1;
  const spot = new THREE.Vector3(), faceTo = new THREE.Vector3();

  /* ---------- visor eyes (canvas drawn every frame) */
  const PFW = 512, PFH = 256, pc = document.createElement('canvas'); pc.width = PFW; pc.height = PFH;
  const px = pc.getContext('2d'), ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
  const toPC = (x, y) => [(x - PV.x0) / (PV.x1 - PV.x0) * PFW, (PV.y1 - y) / (PV.y1 - PV.y0) * PFH];
  const PVIS = [[-.064, .881], [.064, .881], [.066, .858], [.032, .828], [-.032, .828], [-.066, .858]].map(q => toPC(q[0], q[1]));
  const visorPath = () => { px.beginPath(); PVIS.forEach((q, i) => i ? px.lineTo(q[0], q[1]) : px.moveTo(q[0], q[1])); px.closePath(); };
  function slit(cx, cy, d, w, h, tilt) { px.beginPath(); px.moveTo(cx - d * w, cy - h); px.lineTo(cx + d * w, cy - h + tilt); px.lineTo(cx + d * w * .82, cy + h * .9); px.lineTo(cx - d * w * .95, cy + h * .7); px.closePath(); }
  function scanBar(t, speed, alpha) {
    const x = ((t * speed) % 1.4 - .2) * PFW, g = px.createLinearGradient(x - 60, 0, x + 60, 0);
    g.addColorStop(0, 'rgba(255,40,40,0)'); g.addColorStop(.5, `rgba(255,60,50,${alpha})`); g.addColorStop(1, 'rgba(255,40,40,0)');
    px.save(); px.shadowBlur = 0; px.fillStyle = g; px.fillRect(x - 60, 0, 120, PFH); px.restore();
  }
  function drawEyes(k, t, alpha, blink) {
    px.save(); px.globalAlpha = alpha; px.fillStyle = RED; px.strokeStyle = RED; px.lineJoin = 'miter'; px.shadowColor = 'rgba(255,60,50,.95)'; px.shadowBlur = 18;
    const L = 168, R = 344, Y = 106;
    switch (k) {
      case 'listening': { const h = Math.max(1.5, 19 * (1 - blink)); slit(L, Y, 1, 44, h, 4); px.fill(); slit(R, Y, -1, 44, h, 4); px.fill();
        px.save(); px.shadowBlur = 6; for (let i = 0; i < 7; i++) { const a = .25 + .6 * Math.abs(Math.sin(t * 6 + i * .9)); px.globalAlpha = alpha * a; px.fillRect(220 + i * 11, 150 - a * 14, 6, a * 28); } px.restore(); break; }
      case 'happy': { px.lineWidth = 15; [L, R].forEach(cx => { px.beginPath(); px.moveTo(cx - 42, Y + 13); px.lineTo(cx, Y - 11); px.lineTo(cx + 42, Y + 13); px.stroke(); }); break; }
      case 'thinking': { const o2 = Math.sin(t * 1.2) * 10; slit(L + o2, Y - 6, 1, 40, 10, 10); px.fill(); slit(R + o2, Y - 6, -1, 40, 10, 10); px.fill(); scanBar(t, .55, .35);
        for (let i = 0; i < 5; i++) { const on = ((t * 2.5) % 6) > i; px.globalAlpha = alpha * (on ? 1 : .18); px.fillRect(206 + i * 22, 150, 16, 7); } break; }
      case 'excited': { const q = 1 + Math.sin(t * 10) * .08; slit(L, Y, 1, 46 * q, 20 * q, -2); px.fill(); slit(R, Y, -1, 46 * q, 20 * q, -2); px.fill();
        px.save(); px.globalAlpha = alpha * (.5 + .4 * Math.abs(Math.sin(t * 7))); px.shadowBlur = 26; px.fillRect(110, Y - 1.5, PFW - 220, 3); px.restore(); break; }
      case 'confused': { slit(L, Y, 1, 44, 15, 6); px.fill(); slit(R, Y - 14, -1, 34, 7, -9); px.fill(); px.font = '700 40px "Chakra Petch",sans-serif'; px.textAlign = 'center'; px.fillText('[?]', 412, 86 + Math.sin(t * 2.5) * 3); break; }
      case 'sorry': { px.globalAlpha = alpha * .65 * (Math.random() < .06 ? .35 : 1); slit(L, Y + 8, 1, 40, 11, -13); px.fill(); slit(R, Y + 8, -1, 40, 11, -13); px.fill(); break; }
      case 'kneel': { slit(L, Y, 1, 44, 10, 14); px.fill(); slit(R, Y, -1, 44, 10, 14); px.fill(); break; }
      default: { const h = Math.max(1.5, 14 * (1 - blink)); slit(L, Y, 1, 44, h, 12); px.fill(); slit(R, Y, -1, 44, h, 12); px.fill(); if (((t * .25) % 1) < .35) scanBar(t, .7, .18); }
    }
    px.restore();
  }
  const SEAM = { idle: .55, happy: .9, listening: .75, thinking: 'pulse', excited: 'flash', confused: 'flicker', sorry: .22, kneel: 1 };
  const seamLvl = (v, t) => typeof v === 'number' ? v : v === 'pulse' ? .35 + .4 * (Math.sin(t * 3) + 1) / 2 : v === 'flash' ? .7 + .3 * (Math.sin(t * 14) > 0 ? 1 : .4) : v === 'flicker' ? .45 + .25 * Math.sin(t * 9) * Math.sin(t * 2.3) : .5;

  /* ---------- loading: rest pose, IK chains, eyes and chest light */
  async function load() {
    const g = await new GLTFLoader().loadAsync(asset('adaprime.glb'));
    const root = g.scene; inner.add(root);
    root.traverse(o => { if (o.isMesh) { o.frustumCulled = false; const m = o.material; m.side = THREE.DoubleSide; m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 0; mats.push(m); } if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; });
    // everything below is measured in model units (1.0 tall) with the group at identity. In MR the group has usually
    // been placed and turned toward you already, which skewed every joint measurement (ADAprime ended up "sitting"),
    // so take it to the origin for the measurements and put it back afterwards.
    // AR: the parent (the app's world group) is scaled and moved too, so measure with ADAprime taken out of it
    const keepPos = group.position.clone(), keepRot = group.rotation.clone(), keepScale = group.scale.clone(), keepParent = group.parent;
    if (keepParent) keepParent.remove(group);
    group.position.set(0, 0, 0); group.rotation.set(0, 0, 0); group.scale.set(1, 1, 1);
    group.updateMatrixWorld(true);
    const wq = o => o.getWorldQuaternion(new THREE.Quaternion()), wp = o => o.getWorldPosition(new THREE.Vector3());
    for (const [n, b] of Object.entries(B)) { REST[n] = b.quaternion.clone(); PW[n] = wq(b.parent); }
    HIPS = B.Hips.position.clone();
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(PW.Hips.clone().invert()), h0 = wp(B.Hips).y;
    B.Hips.position.addScaledVector(dir, .1); B.Hips.updateMatrixWorld(true); const h1 = wp(B.Hips).y; B.Hips.position.copy(HIPS); B.Hips.updateMatrixWorld(true);
    HIPS_UP = dir.multiplyScalar(.1 / ((h1 - h0) || .1));
    for (const [s, names, store] of [['L', ['LeftArm', 'LeftForeArm', 'LeftHand'], AR], ['R', ['RightArm', 'RightForeArm', 'RightHand'], AR],
                                      ['L', ['LeftUpLeg', 'LeftLeg', 'LeftFoot'], LR], ['R', ['RightUpLeg', 'RightLeg', 'RightFoot'], LR]]) {
      const [S_, E_, H_] = names.map(n => wp(B[n])); store[s] = { n: names, S: S_, l1: S_.distanceTo(E_), u0: E_.clone().sub(S_).normalize(), f0: H_.clone().sub(E_).normalize() };
    }
    // which way the hands and feet point at rest (for dances: wrist -> middle knuckle, heel -> toes along the floor)
    for (const s of ['L', 'R']) {
      const side = s === 'L' ? 'Left' : 'Right', hand = B[side + 'HandMiddle1'], toe = B[side + 'ToeBase'];
      if (hand) AR[s].end0 = wp(hand).sub(wp(B[side + 'Hand'])).normalize();
      if (toe) LR[s].end0 = wp(toe).sub(wp(B[side + 'Foot'])).setY(0).normalize();
    }
    const eg = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
    for (let r = 0; r <= PV.ny; r++) for (let c = 0; c <= PV.nx; c++) { pos.push(PV.x0 + (PV.x1 - PV.x0) * c / PV.nx, PV.y1 - (PV.y1 - PV.y0) * r / PV.ny, PV.z[r][c]); uv.push(c / PV.nx, 1 - r / PV.ny); }
    for (let r = 0; r < PV.ny; r++) for (let c = 0; c < PV.nx; c++) { const a = r * (PV.nx + 1) + c, b = a + 1, d = a + PV.nx + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
    eg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); eg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); eg.setIndex(idx);
    eye = new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ map: ptex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    eye.frustumCulled = false; inner.add(eye); B.Head.attach(eye);
    chest = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    chest.position.set(0, .728, .128); chest.scale.setScalar(.08); inner.add(chest); B.Spine2.attach(chest);
    // thrusters under the feet and in the palms (Iron Man style), off until it flies or jumps
    jets = ['LeftFoot', 'RightFoot', 'LeftHand', 'RightHand'].map(n => {
      const at = wp(B[n]); at.y -= n.endsWith('Foot') ? .03 : .045;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      glow.position.copy(at); flame.position.copy(at); flame.position.y -= .07;
      inner.add(glow, flame); B[n].attach(glow); B[n].attach(flame); glow.visible = flame.visible = false;
      return { glow, flame };
    });
    // stand the feet on the floor and size it so the top of its HEAD is 1.8 m (not the tips of the ear fins);
    // FEET: the lowest foot joints, used every frame to keep the soles on the floor whatever the pose
    // Box3.setFromObject ignores skinning and came out 0.37 model units too low (ADAprime was ~1.1 m tall and
    // floating); measure the skinned mesh itself with its skeleton applied
    const box = new THREE.Box3();
    root.traverse(o => { if (o.isSkinnedMesh) { skin = o; o.skeleton.update(); o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
    if (box.isEmpty()) box.setFromObject(root);
    const headTop = wp(B.HeadTop_End || B.Head).y;
    FEET = ['LeftToe_End', 'RightToe_End', 'LeftToeBase', 'RightToeBase', 'LeftFoot', 'RightFoot'].map(n => B[n]).filter(Boolean);
    soleGap = Math.min(...FEET.map(b => wp(b).y)) - box.min.y;          // lowest foot joint above the sole, at rest
    baseY = -box.min.y; inner.position.y = baseY;
    P.unit = PRIME_HEIGHT / Math.max(.2, headTop - box.min.y);
    if (keepParent) keepParent.add(group);
    group.position.copy(keepPos); group.rotation.copy(keepRot); group.scale.copy(keepScale); group.updateMatrixWorld(true);
    now = pflat(PPOSE.idle()); target = pflat(PPOSE.idle()); P.ready = true;
  }
  P.load = () => P.ready ? Promise.resolve() : (loading || (loading = load().catch(e => { loading = null; throw e; })));

  /* ---------- posing */
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qc = new THREE.Quaternion(), qd = new THREE.Quaternion(), eu = new THREE.Euler(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  function setQ(n, q) { const b = B[n]; if (!b) return; q2.copy(PW[n]).invert().multiply(q).multiply(PW[n]); b.quaternion.copy(q2).multiply(REST[n]); }
  function setR(n, r) { eu.set(r[0], r[1], r[2], 'XYZ'); q1.setFromEuler(eu); setQ(n, q1); }
  function solve(A, Et, Ht, drop) {
    const S_ = A.S.clone(); S_.y += drop || 0;
    v1.set(Et[0], Et[1], Et[2]).sub(S_).normalize(); qc.setFromUnitVectors(A.u0, v1);
    v2.copy(S_).addScaledVector(v1, A.l1); v3.set(Ht[0], Ht[1], Ht[2]).sub(v2).normalize();
    qd.setFromUnitVectors(A.f0.clone().applyQuaternion(qc), v3);
    setQ(A.n[0], qc); setQ(A.n[1], qc.clone().invert().multiply(qd).multiply(qc));
    (A.acc || (A.acc = new THREE.Quaternion())).copy(qd).multiply(qc);   // how the forearm / shin has turned in all
  }
  // turns a hand or foot (on the end of a solved limb A) to point along d (chest / hips frame), by weight w
  function aimEnd(A, name, d, w) {
    if (!A.end0 || !B[name]) return;
    v1.copy(d).normalize().applyQuaternion(qc.copy(A.acc).invert());
    setQ(name, q1.setFromUnitVectors(A.end0, v1).slerp(ID_Q, 1 - w));
  }
  // a dance clip frame at time t (seconds), blended between the two nearest video frames
  const cq = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], ID_Q = new THREE.Quaternion();
  function sampleClip(c, t) {
    const f = Math.min(c.frames.length - 1.001, Math.max(0, t * c.fps)), i = Math.floor(f), a = f - i, A = c.frames[i], Z = c.frames[i + 1];
    return A.map((x, j) => x + (Z[j] - x) * a);
  }
  // moves the pose targets (o) onto the dancer's: arms in the chest frame, legs in the hips frame; w fades it in and out
  function clipPose(o, r, w) {
    // a limb: elbow/knee one bone length along the upper direction, hand/ankle further along the lower one (IK only uses directions)
    const limb = (A, j, mid, end, ww) => {
      v1.set(r[j], r[j + 1], r[j + 2]).normalize(); v2.set(r[j + 3], r[j + 4], r[j + 5]).normalize(); v3.copy(A.S).addScaledVector(v1, A.l1);
      for (let i = 0; i < 3; i++) { const e = v3.getComponent(i); o[mid][i] += (e - o[mid][i]) * ww; o[end][i] += (e + v2.getComponent(i) * .25 - o[end][i]) * ww; }
    };
    limb(AR.L, 11, 'LE', 'LH', w); limb(AR.R, 17, 'RE', 'RH', w);
    limb(LR.L, 23, 'LK', 'LF', w * r[35]); limb(LR.R, 29, 'RK', 'RF', w * r[36]);   // legs only as far as the video showed them
    for (let i = 0; i < 3; i++) { o.Head[i] += (r[8 + i] - o.Head[i]) * w; o.Neck[i] *= 1 - w; }
    o.HipsY *= 1 - w;
  }
  // X: { walkW 0..1, phase (step cycle), shakeW 0..1, shakeH: Vector3 hand target in model units, clip: dance frame, clipW }
  function pose(dt, t, k, X = {}) {
    if (k !== key) { prevKey = key; key = k; target = pflat((PPOSE[k] || PPOSE.idle)()); fade = 0; }
    const kk = 1 - Math.exp(-dt * (k === 'kneel' ? 14 : 6));
    for (const n of Object.keys(now)) { if (n === 'HipsY') { now.HipsY += (target.HipsY - now.HipsY) * kk; continue; } for (let i = 0; i < 3; i++) now[n][i] += (target[n][i] - now[n][i]) * kk; }
    const o = {}; for (const n of Object.keys(now)) o[n] = Array.isArray(now[n]) ? now[n].slice() : now[n];
    const br = Math.sin(t * 1.3) * .015; o.Spine2[0] += br; o.Head[0] += br * .5;
    if (k === 'idle') o.Head[1] += Math.sin(t * .45) * .18;
    if (k === 'happy') { o.Head[0] += Math.sin(t * 5) * .07; o.RH[1] += Math.sin(t * 5) * .012; }
    if (k === 'excited') { o.LH[0] += Math.sin(t * 10) * .025; o.RH[0] -= Math.sin(t * 10) * .025; }
    if (k === 'confused') { o.RH[1] += Math.sin(t * 12) * .01; o.RH[2] += Math.cos(t * 12) * .01; }
    if (k === 'wave') { o.RH[0] -= Math.sin(t * 9) * .06; o.RE[0] -= Math.sin(t * 9) * .02; }   // hand swings side to side
    if (X.clip) clipPose(o, X.clip, X.clipW);
    else if (k === 'dance') {                                // arms pump in turn, hips bounce, shoulders sway
      o.LH[1] += Math.sin(t * 6) * .09; o.RH[1] -= Math.sin(t * 6) * .09; o.LE[1] += Math.sin(t * 6) * .04; o.RE[1] -= Math.sin(t * 6) * .04;
      o.HipsY -= Math.abs(Math.sin(t * 6)) * .025; o.Spine[2] += Math.sin(t * 3) * .1; o.Head[2] -= Math.sin(t * 3) * .12;
    }
    if (X.mirror && X.fightW > .001) {                       // fight training: copies your fists (as in a mirror)
      const w = X.fightW, m = X.mirror, mix = (n, p) => { o[n][0] += (p.x - o[n][0]) * w; o[n][1] += (p.y - o[n][1]) * w; o[n][2] += (p.z - o[n][2]) * w; };
      mix('LH', m.LH); mix('LE', m.LE); mix('RH', m.RH); mix('RE', m.RE);
      o.HipsY -= (.012 + Math.sin(t * 5) * .006) * w;        // light on its feet
      o.Spine[1] += THREE.MathUtils.clamp((m.LH.z - m.RH.z) * 1.5, -.35, .35) * w;   // turns into the punch
    }
    if (X.walkW > .001) {                                    // walking: legs step, arms swing, a little hip bob
      const w = X.walkW, s1 = Math.sin(X.phase), c1 = Math.cos(X.phase), mix = (n, v) => { for (let i = 0; i < 3; i++) o[n][i] += (v[i] - o[n][i]) * w; };
      const zl = .11 * s1, ll = .055 * Math.max(0, c1), lr = .055 * Math.max(0, -c1);
      mix('LF', [.17, .103 + ll, -.033 + zl]); mix('LK', [.13, .36 + ll * .6, .03 + zl * .5 + ll * .6]);
      mix('RF', [-.17, .103 + lr, -.033 - zl]); mix('RK', [-.13, .36 + lr * .6, .03 - zl * .5 + lr * .6]);
      mix('LE', [.19, .635, -.02 - .035 * s1]); mix('LH', [.215, .465, .02 - .09 * s1]); mix('RE', [-.19, .635, -.02 + .035 * s1]); mix('RH', [-.215, .465, .02 + .09 * s1]);
      o.HipsY += -.016 * Math.abs(s1) * w; o.Spine[0] += .05 * w; o.Spine[1] += -.05 * s1 * w; o.Head[1] += .05 * s1 * w;
    }
    if (X.shakeW > .001) {                                   // handshake: right fist to your hand, elbow bent below the line
      const w = X.shakeW, h = X.shakeH, s = AR.R.S, mix = (n, v) => { for (let i = 0; i < 3; i++) o[n][i] += (v[i] - o[n][i]) * w; };
      mix('RH', [h.x, h.y, h.z]);
      mix('RE', [s.x + (h.x - s.x) * .5 - .04, s.y + (h.y - s.y) * .5 - .06, s.z + (h.z - s.z) * .5]);
      o.Head[0] += .08 * w;                                  // and look down at the hands
    }
    PCTRL.forEach(n => setR(n, o[n]));
    // the dancer's hips turn and lean the whole body; the chest's twist on top of that is shared by the three spine bones
    const cw = X.clip ? X.clipW : 0, r = X.clip;
    setQ('Hips', cw ? cq[0].set(r[0], r[1], r[2], r[3]).normalize().slerp(ID_Q, 1 - cw) : ID_Q);
    if (cw) { cq[1].set(r[4], r[5], r[6], r[7]).normalize(); cq[2].identity().slerp(cq[1], cw / 3); ['Spine', 'Spine1', 'Spine2'].forEach(n => setQ(n, cq[2])); }
    B.Hips.position.copy(HIPS).addScaledVector(HIPS_UP, o.HipsY);
    solve(AR.L, o.LE, o.LH); solve(AR.R, o.RE, o.RH); solve(LR.L, o.LK, o.LF, o.HipsY); solve(LR.R, o.RK, o.RF, o.HipsY);
    if (cw && r.length > 48) {                               // the dancer's wrists and feet
      const e = j => v2.set(r[j], r[j + 1], r[j + 2]);
      aimEnd(AR.L, 'LeftHand', e(37), cw); aimEnd(AR.R, 'RightHand', e(40), cw);
      aimEnd(LR.L, 'LeftFoot', e(43), cw * r[35]); aimEnd(LR.R, 'RightFoot', e(46), cw * r[36]);
    } else ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot'].forEach(n => setQ(n, ID_Q));
    // eyes, visor edge, chest light
    fade = Math.min(1, fade + dt * 4);
    let blink = 0;
    if (k === 'idle' || k === 'listening') { blinkAt -= dt; if (blinkAt <= 0 && blinkT < 0) { blinkT = 0; blinkAt = 2.5 + Math.random() * 2.5; } }
    if (blinkT >= 0) { blinkT += dt; blink = Math.sin(Math.min(1, blinkT / .16) * Math.PI); if (blinkT > .16) blinkT = -1; }
    px.clearRect(0, 0, PFW, PFH); px.save(); visorPath(); px.clip();
    if (fade < 1) drawEyes(prevKey, t, (1 - fade) * eyesOn, 0);
    drawEyes(k, t, fade * eyesOn, blink);
    px.globalCompositeOperation = 'destination-out'; px.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < PFH; y += 4) px.fillRect(0, y, PFW, 1.5);
    px.restore();
    const lvl = Math.min(1, seamLvl(SEAM[k] ?? .5, t) * eyesOn + emissive);
    px.save(); visorPath(); px.lineJoin = 'round'; px.strokeStyle = `rgba(255,40,40,${lvl})`; px.lineWidth = 7; px.shadowColor = `rgba(255,40,40,${lvl})`; px.shadowBlur = 18 * lvl; px.stroke(); px.restore();
    ptex.needsUpdate = true;
    const cl = Math.min(1.3, (k === 'thinking' ? .4 + .4 * (Math.sin(t * 3) + 1) / 2 : .6) * eyesOn + emissive);
    chest.material.opacity = cl; chest.scale.setScalar(.06 + .05 * cl);
    mats.forEach(m => { m.emissiveIntensity = Math.max(emissive, P.glow || 0); });   // P.glow: energy from your laser
  }

  /* ---------- transformation effects */
  const glowTex = spriteTex((x, s) => { const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,215,205,1)'); gr.addColorStop(.3, 'rgba(255,40,30,.85)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, s, s); });
  const whiteGlow = spriteTex((x, s) => { const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,220,210,.9)'); gr.addColorStop(.55, 'rgba(255,40,30,.45)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, s, s); });
  const flameTex = spriteTex((x, s) => { const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,190,150,.95)'); g.addColorStop(.6, 'rgba(255,40,20,.6)'); g.addColorStop(1, 'rgba(255,0,0,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(s * .3, 0); x.lineTo(s * .7, 0); x.lineTo(s * .5, s); x.closePath(); x.fill(); });
  const ringTex = spriteTex((x, s) => { x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = s * .05; x.shadowColor = 'rgba(255,60,40,1)'; x.shadowBlur = s * .06; x.beginPath(); x.arc(s / 2, s / 2, s * .4, 0, 7); x.stroke(); }, 256);
  const fx = new THREE.Group(); scene.add(fx);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: whiteGlow, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); core.visible = false; fx.add(core);
  const burst = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); burst.visible = false; fx.add(burst);
  // shockwave on the floor at the landing spot
  const floorRing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide }));
  floorRing.rotation.x = -Math.PI / 2; floorRing.visible = false; fx.add(floorRing);
  const shardGeo = new THREE.BoxGeometry(1, 1, 1), shardCols = [0xffffff, 0xffffff, 0xE3000F, 0x16171a];
  const shards = Array.from({ length: 44 }, (_, i) => { const m = new THREE.Mesh(shardGeo, new THREE.MeshBasicMaterial({ color: shardCols[i % 4], transparent: true })); m.visible = false; fx.add(m); return m; });
  const corePt = new THREE.Vector3();

  function placeGroup() { group.position.copy(spot); group.rotation.set(0, Math.atan2(faceTo.x - spot.x, faceTo.z - spot.z), 0); }
  P.place = (at, look) => { spot.copy(at); faceTo.copy(look); stopRoaming(); if (!P.cine) placeGroup(); };

  /** ADAbot -> ADAprime. at: floor point where ADAprime lands; look: where it faces (your head). */
  P.start = async (at, look) => {
    if (P.active) return;
    await P.load();
    P.active = true; P.holdsBot = true; spot.copy(at); faceTo.copy(look); placeGroup();
    corePt.copy(spot).add(new THREE.Vector3(0, 1.05, 0));
    P.cine = { dir: 'up', t: 0, boomed: false, landed: false, from: bot.position.clone() };
    play('charge', { pos: corePt });
  };
  /** ADAprime -> ADAbot. ADAbot pops out at chest height where ADAprime stood. */
  P.stop = () => {
    if (!P.active || (P.cine && P.cine.dir === 'down')) return;
    if (P.cine) finish();                                                  // cut a running transformation short
    corePt.copy(spot).add(new THREE.Vector3(0, 1.05, 0));
    P.holdsBot = true; P.cine = { dir: 'down', t: 0, boomed: false }; play('powerDown', { pos: corePt });
  };

  function finish() {
    const up = P.cine.dir === 'up'; P.cine = null;
    shards.forEach(s => s.visible = false); core.visible = false; burst.visible = false; floorRing.visible = false;
    poseOverride = null; emissive = 0; formScale = 1; eyesOn = 1;
    group.visible = up; bot.visible = !up; bot.rotation.set(0, 0, 0);
    if (!up) { P.active = false; P.holdsBot = false; bot.position.copy(corePt); }
  }

  function cineTick(dt) {
    const c = P.cine; c.t += dt; const tt = c.t;
    if (c.dir === 'up') {
      if (tt < 1.0) {                                                      // 1. ADAbot races to the spot, spinning up and glowing
        bot.position.lerp(corePt, Math.min(1, dt * 5)); bot.rotation.y += (6 + 18 * Math.min(1, tt / .75)) * dt;
      } else if (!c.boomed) {                                              // 2. explode: flash, shockwave, shards fly out
        c.boomed = true; bot.visible = false; play('boom', { pos: corePt });
        shards.forEach(s => { const d = new THREE.Vector3().randomDirection(), sp = .9 + Math.random() * 2.2; s.visible = true; s.material.opacity = 1;
          s.position.copy(corePt); s.userData = { v: d.multiplyScalar(sp), rx: (Math.random() - .5) * 14, ry: (Math.random() - .5) * 14, sz: .02 + Math.random() * .045, home: null }; s.scale.setScalar(s.userData.sz); });
        burst.visible = true; burst.position.copy(corePt); burst.userData = { t: 0 };
        core.visible = true; core.position.copy(corePt);
      }
      if (c.boomed && !c.landed) {
        const u = tt - 1.0;
        if (u > .55 && !c.assembled) { c.assembled = true; play('assemble', { pos: corePt }); }   // the parts rush back together
        shards.forEach(s => { const d = s.userData;
          if (u < .55) { d.v.multiplyScalar(Math.exp(-3.2 * dt)); s.position.addScaledVector(d.v, dt); }
          else { if (!d.home) d.home = s.position.clone(); const a = ease(Math.min(1, (u - .55) / .55));      // 3. the parts rush back in
            s.position.lerpVectors(d.home, corePt, a); s.scale.setScalar(d.sz * (1 - a * .7)); if (a >= 1) s.visible = false; }
          s.rotation.x += d.rx * dt; s.rotation.y += d.ry * dt; });
        burst.userData.t += dt; const rt = burst.userData.t; burst.scale.setScalar(.2 + rt * 3.5); burst.material.opacity = Math.max(0, 1 - rt * 1.6);
        const glow = u < .55 ? .6 + u : 1.2 + Math.sin(u * 30) * .15; core.material.opacity = Math.min(1, glow); core.scale.setScalar(1.6 * (.35 + .55 * Math.min(1, u / 1.1)) * (1 + .06 * Math.sin(u * 40)));
        if (u > 1.05) {                                                    // 4. ADAprime forms inside the light, rises, then slams down
          if (!group.visible) group.visible = true;
          const f = Math.min(1, (u - 1.05) / .35); eyesOn = 0; emissive = 1 - f * .4; poseOverride = 'kneel';
          formScale = .25 + .75 * ease(f); group.position.y = spot.y + .55 + f * .25;
          core.material.opacity = Math.max(0, 1.2 - f * 1.2);
        }
        if (u > 1.5) {
          const d = Math.min(1, (u - 1.5) / .26); group.position.y = spot.y + .8 * (1 - d * d); formScale = 1; emissive = Math.max(0, .6 - d * .6);
          if (d >= 1) { c.landed = true; c.landT = tt; group.position.y = spot.y; core.visible = false; play('heroLand', { pos: spot });
            floorRing.visible = true; floorRing.position.set(spot.x, spot.y + .01, spot.z); floorRing.userData = { t: 0 }; }
        }
      }
      if (c.landed) {
        const u = tt - c.landT;
        floorRing.userData.t += dt; const rt = floorRing.userData.t; floorRing.scale.setScalar(.4 + rt * 5); floorRing.material.opacity = Math.max(0, 1 - rt * 1.8);
        poseOverride = u < 1.0 ? 'kneel' : null;                         // 5. hero landing: one knee down, then rise
        eyesOn = Math.min(1, Math.max(0, (u - .35) / .3));
        if (u > .4 && !c.online) { c.online = true; play('online', { pos: corePt }); }
        if (u > 1.9) finish();
      }
    } else {                                                               // ADAprime -> ADAbot: glow white, shrink into light, ADAbot pops out
      if (tt < .55) { emissive = Math.min(1, tt * 2.5); formScale = 1 - ease(tt / .55) * .75; core.visible = true; core.position.copy(corePt);
        core.material.opacity = Math.min(1, tt * 2.2); core.scale.setScalar(.8 * (.6 + tt)); }
      else if (!c.boomed) { c.boomed = true; group.visible = false; emissive = 0; formScale = 1; bot.visible = true; bot.position.copy(corePt); play('boom', { pos: corePt });
        burst.visible = true; burst.position.copy(corePt); burst.userData = { t: 0 }; }
      else { burst.userData.t += dt; const rt = burst.userData.t; burst.scale.setScalar(.15 + rt * 2.4); burst.material.opacity = Math.max(0, 1 - rt * 2.2);
        core.material.opacity = Math.max(0, core.material.opacity - dt * 3); if (tt > 1.2) finish(); }
    }
  }

  /** Debug: how high the lowest foot joint and the top of the head are above the floor it stands on (metres). */
  P.measure = () => {
    if (!P.ready) return null;
    group.updateMatrixWorld(true);
    const floor = spot.y + alt, low = Math.min(...FEET.map(b => b.getWorldPosition(footV).y));
    let skinLow = null, skinTop = null;                       // lowest / highest point of the posed, skinned mesh itself
    inner.traverse(o => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); const b = o.boundingBox.clone().applyMatrix4(o.matrixWorld); skinLow = Math.min(skinLow ?? Infinity, b.min.y); skinTop = Math.max(skinTop ?? -Infinity, b.max.y); } });
    const at = b => +(b.getWorldPosition(footV).y - floor).toFixed(3);
    return { lowestFootJoint: +(low - floor).toFixed(3), restGap: +(soleGap * P.unit).toFixed(3), headTop: at(B.HeadTop_End || B.Head),
             neck: at(B.Neck), head: at(B.Head), meshBottom: skinLow === null ? null : +(skinLow - floor).toFixed(3), meshTop: skinTop === null ? null : +(skinTop - floor).toFixed(3) };
  };

  /** Where ADAprime's head is (for the speech callout); null while it isn't standing in the room. */
  P.headPos = out => (P.active && !P.cine && B.Head) ? B.Head.getWorldPosition(out) : null;
  /** The glowing "D" on its chest (where your energy beam hits); follows the body as it moves, leans or flies. */
  P.chestPos = out => (P.active && !P.cine && chest) ? chest.getWorldPosition(out) : null;

  /* ---------- walking around you, and shaking your hand */
  const WALK_SPEED = .45, STEP = .55, NEAR = .9, FAR = 2.2;   // m/s, metres per step, how close / far it roams from you
  const walk = { target: null, wait: 2, w: 0, phase: 0 };
  const shake = { phase: 'none', hand: new THREE.Vector3(), lost: 0, t: 0, w: 0, offer: 0, cool: 0, last: null };
  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), handLocal = new THREE.Vector3(), shoulderW = new THREE.Vector3();
  P.canWalk = () => true;                                     // set by the app (scanned room)
  // AR phone controls: steer = joystick direction on the floor (length 0..1), goTo(point) = walk to a tapped spot
  P.steer = new THREE.Vector3();
  P.goTo = p => { if (!P.active || P.cine) return; if (P.mode === 'sit' || P.mode === 'sleep' || P.mode === 'dance') P.mode = null;
    shake.phase = 'none'; walk.target = new THREE.Vector3(p.x, spot.y, p.z); walk.wait = 6; };
  P.onHandshake = () => {};
  function stopRoaming() { walk.target = null; shake.phase = 'none'; shake.w = 0; }

  // a hand held out toward ADAprime: arm stretched forward, below the shoulders, pointing at it, held still
  function offeredHand(dt, head, hands) {
    let best = null;
    for (const p of hands) {
      const fwd = flat(p, head), toPrime = tmpA.set(spot.x - head.x, 0, spot.z - head.z).normalize(), dir = tmpB.set(p.x - head.x, 0, p.z - head.z).normalize();
      if (fwd > .32 && p.y < head.y - .15 && p.y > head.y - .9 && dir.dot(toPrime) > .55 && flat(p, spot) < FAR + .6) best = p;
    }
    const still = best && shake.last && best.distanceTo(shake.last) < .4 * dt + .004;
    shake.last = best ? (shake.last || new THREE.Vector3()).copy(best) : null;
    shake.offer = still ? shake.offer + dt : 0;
    return shake.offer > .6 ? best : null;
  }
  const nearestHand = (hands, to) => hands.reduce((a, p) => (!a || p.distanceTo(to) < a.distanceTo(to) ? p : a), null);

  function moveToward(goal, dt, speed) {                     // returns true when there
    const d = flat(spot, goal);
    if (d < .04) return true;
    const step = Math.min(d, speed * dt);
    spot.x += (goal.x - spot.x) / d * step; spot.z += (goal.z - spot.z) / d * step;
    const before = Math.floor(walk.phase / Math.PI);
    walk.phase += step / STEP * Math.PI;
    if (Math.floor(walk.phase / Math.PI) !== before && alt < .05) play('step', { pos: footAt.set(spot.x, spot.y + .05, spot.z), power: speed / .6 });   // a foot lands
    return false;
  }
  const footAt = new THREE.Vector3();

  function behave(dt, t, emoKey, head, hands, roam) {
    shake.cool = Math.max(0, shake.cool - dt);
    let moving = false, look = head;
    if (shake.phase === 'none' && !shake.cool) {
      const p = offeredHand(dt, head, hands);
      if (p) { shake.phase = 'approach'; shake.hand.copy(p); shake.lost = 0; walk.target = null; }
    }
    const steerLen = Math.min(1, P.steer.length());
    if (steerLen > .08) {                                     // joystick: walk (or fly) the way it points
      shake.phase = 'none'; walk.target = null;
      const goal = tmpB.copy(spot).addScaledVector(P.steer, 1 / steerLen);
      moveToward(goal, dt, WALK_SPEED * (.5 + steerLen) * (P.mode === 'fly' ? 1.6 : 1)); moving = true; look = goal;
    } else if (shake.phase !== 'none') {
      const p = nearestHand(hands, shake.hand);
      if (p && p.distanceTo(shake.hand) < .3) { shake.hand.copy(p); shake.lost = 0; } else shake.lost += dt;
      look = shake.hand;
      if (shake.lost > .5) { shake.phase = 'none'; shake.cool = 2; P.onHandshake(false); }
      else if (shake.phase === 'approach') {
        // stand just in front of your hand, on the side ADAprime came from
        const away = tmpA.set(spot.x - shake.hand.x, 0, spot.z - shake.hand.z); if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
        const goal = tmpB.copy(shake.hand).addScaledVector(away.normalize(), .42);
        moving = !moveToward(goal, dt, WALK_SPEED * 1.3);
        if (!moving) { shake.phase = 'shake'; shake.t = 0; P.onHandshake(true); play('servo', { pos: shake.hand }); }   // arm reaches out
      } else {                                               // shaking
        shake.t += dt;
        B.RightArm.getWorldPosition(shoulderW);
        if (shake.t > 2.6 || shoulderW.distanceTo(shake.hand) > 1.1) { shake.phase = 'none'; shake.cool = 3; P.onHandshake(false); }
      }
    } else if ((roam || walk.target) && (emoKey === 'idle' || emoKey === 'happy')) {   // roam while idle (MR/VR only); stop and face you while talking or thinking
      walk.wait -= dt;
      if (roam && !walk.target && walk.wait <= 0) {
        for (let i = 0; i < 10 && !walk.target; i++) {
          const a = Math.random() * Math.PI * 2, r = NEAR + .3 + Math.random() * (FAR - NEAR - .3);
          const c = new THREE.Vector3(head.x + Math.sin(a) * r, spot.y, head.z + Math.cos(a) * r);
          if (flat(c, spot) > .6 && P.canWalk(spot, c)) walk.target = c;
        }
        if (walk.target) play('servo', { pos: footAt.set(spot.x, spot.y + 1, spot.z) });   // joints whir as it sets off
        if (!walk.target) walk.wait = 2;
      }
      if (walk.target) {
        if (flat(spot, head) < NEAR && flat(walk.target, head) < NEAR) walk.target = null;   // don't walk into you
        else if (moveToward(walk.target, dt, WALK_SPEED)) { walk.target = null; walk.wait = 3 + Math.random() * 5; }
        else { moving = true; look = walk.target; }
      }
    } else walk.target = null;
    walk.w += ((moving ? 1 : 0) - walk.w) * Math.min(1, dt * 6);
    shake.w += ((shake.phase === 'shake' ? 1 : 0) - shake.w) * Math.min(1, dt * 5);
    // turn: toward where it's walking, toward your hand, or toward you
    face(dt, look, moving ? 4 : 1.8);
    if (shake.w > .001) {
      group.position.copy(spot); group.position.y += alt; group.updateMatrixWorld(true);
      inner.worldToLocal(handLocal.copy(shake.hand));         // your hand in the model's own units
      handLocal.y += shake.phase === 'shake' ? Math.sin(t * 16) * .014 : 0;
    }
    return { walkW: walk.w, phase: walk.phase, shakeW: shake.w, shakeH: handLocal, moving };
  }
  function face(dt, look, rate) {
    const yaw = Math.atan2(look.x - spot.x, look.z - spot.z);
    let dy = yaw - group.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); group.rotation.y += dy * Math.min(1, dt * rate);
  }

  /* ---------- commands: sit, stand, jump, fly, land, dance, spin, come, sleep */
  P.mode = null;                                              // 'sit' | 'sleep' | 'dance' | 'fly'
  P.thrust = 0;                                               // 0..1 how hard the thrusters burn (for the app's hum)
  let alt = 0, altTarget = 0, jumpV = null, crouchT = 0, landT = 0, spinT = 0, danceT = 0;
  let clip = null, clipLoad = null, song = null, songWait = false, clipW = 0;
  // dancing to the song: loads the moves and the song (first time only), then starts them together
  async function startDance() {
    songWait = true;
    try {
      clip = clip || await (clipLoad = clipLoad || fetch(DANCE.moves).then(r => r.ok ? r.json() : Promise.reject(r.status)));
      const h = await music(DANCE.song, footAt.set(spot.x, spot.y + 1, spot.z));
      if (P.mode !== 'dance' || !P.active) { h.stop(); return; }
      if (song) song.stop();
      song = h; danceT = h.duration + .3; clipW = 0;
    } catch (e) { clipLoad = null; console.warn('dance', e); }   // no clip or song: the made-up dance below carries on
    finally { songWait = false; }
  }
  function stopSong() { if (song) { song.stop(); song = null; } }
  P.danceTime = () => song ? song.time() : null;              // seconds into the song (null when not dancing to it)
  P.danceAt = null;                                           // debugging: hold the dance at this many seconds
  const groundOk = () => P.mode !== 'fly' && jumpV === null && crouchT <= 0;
  /** Returns a short line ADAbot can say, or null if the command doesn't apply right now. */
  P.command = name => {
    if (!P.active || P.cine || fall.kind === 'fall') return null;
    const from = footAt.set(spot.x, spot.y + 1, spot.z);
    switch (name) {
      case 'sit': if (P.mode === 'fly') { altTarget = 0; P.after = 'sit'; return 'Turun dulu, kemudian duduk.'; }
        stopRoaming(); P.mode = 'sit'; play('servo', { pos: from }); return 'Baik, duduk.';
      case 'sleep': stopRoaming(); P.mode = P.mode === 'fly' ? 'fly' : 'sleep'; if (P.mode === 'fly') { altTarget = 0; P.after = 'sleep'; } return 'Zzz…';
      case 'stand': if (P.mode === 'fly') { altTarget = 0; return 'Mendarat.'; } P.mode = null; play('servo', { pos: from }); return 'Berdiri!';
      case 'jump': if (!groundOk()) return null; P.mode = null; stopRoaming(); crouchT = .3; play('servo', { pos: from }); return 'Hup!';
      case 'fly': if (P.mode === 'fly') return null; P.mode = 'fly'; altTarget = 1.3; P.after = null; play('charge', { pos: from }); return 'Terbang!';
      case 'land': if (P.mode !== 'fly') return null; altTarget = 0; return 'Mendarat.';
      case 'dance': if (!groundOk()) return null; stopRoaming(); stopSong(); P.mode = 'dance'; danceT = 8; startDance(); return '🎵';
      case 'spin': spinT = 1; play('servo', { pos: from }); return 'Wheee!';
      case 'come': { if (P.mode === 'sit' || P.mode === 'sleep') P.mode = null;
        const away = tmpA.set(spot.x - faceTo.x, 0, spot.z - faceTo.z); if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
        walk.target = tmpB.copy(faceTo).addScaledVector(away.normalize(), 1).setY(spot.y).clone(); walk.wait = 6; return 'Datang!'; }
    }
    return null;
  };

  /* ---------- your hands push it: a stagger, or a fall if the shove is hard */
  const fall = { kind: null, t: 0, dir: new THREE.Vector3(), amp: 0, cool: 0, hit: false };
  let prevHands = [];
  const headW = new THREE.Vector3(), baseW = new THREE.Vector3(), closest = new THREE.Vector3(), seg = new THREE.Line3();
  P.onPush = () => {};                                        // app hook: 'stagger' | 'fall' | 'down' | 'up'
  function detectPush(dt, hands) {
    fall.cool = Math.max(0, fall.cool - dt);
    const before = prevHands; prevHands = hands.map(p => p.clone());
    if (fall.kind || fall.cool || !B.Head) return;
    B.Head.getWorldPosition(headW); baseW.set(spot.x, spot.y + alt + .2, spot.z); seg.set(baseW, headW);
    hands.forEach((p, i) => {
      const prev = before[i]; if (!prev || fall.kind) return;
      const vel = p.clone().sub(prev).divideScalar(Math.max(dt, 1e-3)), speed = vel.length();
      seg.closestPointToPoint(p, true, closest);
      if (closest.distanceTo(p) > .24 || speed < .6) return;
      const dir = vel.setY(0).lengthSq() > 1e-4 ? vel.normalize() : closest.clone().sub(p).setY(0).normalize();
      if (P.mode === 'sit' || P.mode === 'sleep') { P.onPush('stagger'); fall.cool = 1; return; }
      if (speed > 2 && P.mode !== 'fly') {                   // hard shove: over it goes
        fall.kind = 'fall'; fall.t = 0; fall.hit = false; fall.dir.copy(dir); P.mode = null; stopRoaming(); crouchT = 0;
        play('clank', { pos: p, power: 1 }); P.onPush('fall');
      } else {                                               // a nudge: it staggers back a step
        fall.kind = 'stagger'; fall.t = 0; fall.dir.copy(dir); fall.amp = Math.min(.4, .15 + speed * .1);
        spot.addScaledVector(dir, P.mode === 'fly' ? .3 : .12); play('clank', { pos: p, power: speed / 3 }); P.onPush('stagger');
      }
      fall.cool = .8;
    });
  }
  const tiltAxis = new THREE.Vector3(), tiltQ = new THREE.Quaternion(), leanQ = new THREE.Quaternion(), X_AXIS = new THREE.Vector3(1, 0, 0), UP_AXIS = new THREE.Vector3(0, 1, 0);
  function updateTilt(dt, moving) {
    let ang = 0;
    if (fall.kind === 'stagger') { fall.t += dt; ang = fall.amp * Math.sin(Math.PI * Math.min(1, fall.t / .7)); if (fall.t > .7) fall.kind = null; }
    else if (fall.kind === 'fall') {
      fall.t += dt; const FLAT = Math.PI / 2 - .1;
      if (fall.t < .55) ang = FLAT * Math.pow(fall.t / .55, 2);                        // tips over, faster and faster
      else if (fall.t < 2.3) { ang = FLAT; if (!fall.hit) { fall.hit = true; play('heroLand', { pos: footAt.copy(spot).addScaledVector(fall.dir, .9) }); P.onPush('down'); } }
      else if (fall.t < 3.4) ang = FLAT * (1 - ease((fall.t - 2.3) / 1.1));            // gets back up
      else { fall.kind = null; P.onPush('up'); }
    }
    const dl = tmpA.copy(fall.dir).applyAxisAngle(UP_AXIS, -group.rotation.y);         // push direction in the body's frame
    tiltAxis.set(dl.z, 0, -dl.x); if (tiltAxis.lengthSq() < 1e-6) tiltAxis.set(1, 0, 0);
    tiltQ.setFromAxisAngle(tiltAxis.normalize(), ang);
    leanQ.setFromAxisAngle(X_AXIS, P.mode === 'fly' && moving ? .2 : 0);                // leans into flight
    tilt.quaternion.slerp(tiltQ.multiply(leanQ), fall.kind ? 1 : Math.min(1, dt * 4));
  }
  let jetW = 0;
  function updateJets(dt, t) {
    const burning = P.mode === 'fly' || jumpV !== null;
    jetW += ((burning ? 1 : 0) - jetW) * Math.min(1, dt * 5);
    jetW = THREE.MathUtils.clamp(jetW, 0, 1); P.thrust = jetW;
    jets.forEach((j, i) => {
      const f = jetW * (.85 + .15 * Math.sin(t * 40 + i * 2) + Math.random() * .1);
      j.glow.visible = j.flame.visible = jetW > .03;
      j.glow.scale.setScalar(.06 + .06 * f); j.flame.scale.set(.05 * f, .17 * f, 1);
    });
  }

  /* ---------- fight training: mirror your fists while you hold a boxing guard */
  let fightW = 0;
  const mir = { LH: new THREE.Vector3(), LE: new THREE.Vector3(), RH: new THREE.Vector3(), RE: new THREE.Vector3() };
  const want = { LH: new THREE.Vector3(), LE: new THREE.Vector3(), RH: new THREE.Vector3(), RE: new THREE.Vector3() };
  function elbow(S, H, out) { return out.copy(S).lerp(H, .5).add(tmpB.set(Math.sign(S.x) * .05, -.07, 0)); }
  // f: { L, R } your hands relative to your head ({ r: right, u: up, f: forward } in metres; null if not tracked)
  function fightBehave(dt, f) {
    if (fightW === 0) { const g = pflat(PPOSE.guard()); mir.LH.fromArray(g.LH); mir.LE.fromArray(g.LE); mir.RH.fromArray(g.RH); mir.RE.fromArray(g.RE); }
    stopRoaming(); P.mode = null;
    const away = tmpA.set(spot.x - faceTo.x, 0, spot.z - faceTo.z); if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
    const moving = !moveToward(tmpB.copy(faceTo).addScaledVector(away.normalize(), 1.25), dt, WALK_SPEED);   // squares up at arm's reach
    face(dt, faceTo, 4);
    fightW = Math.min(1, fightW + dt * 3);
    const k = 1.15 / P.unit;                                  // your metres -> its model units (a touch bigger)
    // your right fist -> its left (+x), your left fist -> its right: a mirror image
    if (f.R) want.LH.set(AR.L.S.x + (f.R.r - .18) * k, AR.L.S.y + (f.R.u + .22) * k, AR.L.S.z + f.R.f * k);
    if (f.L) want.RH.set(AR.R.S.x + (f.L.r + .18) * k, AR.R.S.y + (f.L.u + .22) * k, AR.R.S.z + f.L.f * k);
    elbow(AR.L.S, want.LH, want.LE); elbow(AR.R.S, want.RH, want.RE);
    const a = 1 - Math.exp(-dt * 18);
    for (const n of ['LH', 'LE', 'RH', 'RE']) mir[n].lerp(want[n], a);
    return { walkW: moving ? .6 : 0, phase: walk.phase, mirror: mir, fightW, moving };
  }

  // hands: world positions of your tracked hands; roam: walk around (only in MR/VR, where there's a room);
  // fight: your fists relative to your head while you hold a boxing guard (null otherwise)
  P.update = (dt, t, emoKey, head, hands = [], roam = false, fight = null) => {
    if (song && (P.mode !== 'dance' || !P.active || P.cine || song.ended)) { stopSong(); if (P.mode === 'dance') P.mode = null; }
    if (!P.ready || !P.active) return;
    if (head) faceTo.copy(head);
    if (P.cine) { cineTick(dt); stopRoaming(); P.mode = null; alt = altTarget = 0; jumpV = null; fightW = 0; fall.kind = null; tilt.quaternion.identity(); }
    if (!group.visible) return;
    group.scale.setScalar(P.unit * formScale);
    let k = poseOverride || (PPOSE[emoKey] ? emoKey : 'idle'), X = {};
    if (P.cine) {                                            // during the transformation: just face you
      face(dt, faceTo, 1.5);
      pose(dt, t, k, X);
      return;
    }
    detectPush(dt, hands);
    if (fall.kind === 'fall') { k = fall.t > 2.3 ? 'crouch' : 'sorry'; fightW = 0; }   // knocked over: lies there, then gets up
    else if (fight && P.mode !== 'fly') { X = fightBehave(dt, fight); k = 'guard'; }
    else {
      fightW = 0;
      if ((P.mode === 'sit' || P.mode === 'sleep' || P.mode === 'dance') && P.steer.length() > .3) { P.mode = null; stopSong(); }
      if (P.mode === 'sit' || P.mode === 'sleep') { k = P.mode; face(dt, faceTo, 1.2); }
      else if (P.mode === 'dance' && song) {                 // the video's dance, in time with the song, facing you
        const st = P.danceAt ?? song.time(), left = song.duration - st;
        clipW = Math.min(1, st / .4, left / .5); k = 'dance'; X = { clip: sampleClip(clip, st), clipW: Math.max(0, clipW) };
        X.stepX = (X.clip[49] || 0) * X.clipW;
        face(dt, faceTo, 3); song.update(footAt.set(spot.x, spot.y + 1, spot.z));
      }
      else if (P.mode === 'dance') { k = 'dance'; if (!songWait) group.rotation.y += dt * 1.6; if ((danceT -= dt) <= 0 && !songWait) P.mode = null; }
      else {
        X = behave(dt, t, emoKey, faceTo, hands, roam && groundOk() || P.mode === 'fly');
        if (P.mode === 'fly') { k = 'fly'; X.walkW = 0; }
      }
    }
    // up and down: flying, jumping
    if (P.mode === 'fly' || alt > 0 && jumpV === null) {
      alt += (altTarget - alt) * Math.min(1, dt * 1.4);
      if (P.mode === 'fly' && altTarget === 0 && alt < .03) {   // touched down
        alt = 0; P.mode = P.after || null; P.after = null; play('heroLand', { pos: footAt.copy(spot) }); landT = .35;
      }
    }
    if (crouchT > 0 && (crouchT -= dt) <= 0) { jumpV = 3.4; play('throw', { pos: footAt.copy(spot), power: .6 }); }
    if (jumpV !== null) { alt += jumpV * dt; jumpV -= 9.8 * dt; if (alt <= 0) { alt = 0; jumpV = null; landT = .3; play('step', { pos: footAt.copy(spot), power: 1 }); } }
    landT = Math.max(0, landT - dt);
    if (crouchT > 0 || landT > 0) k = 'crouch'; else if (jumpV !== null) k = 'air';
    if (spinT > 0) { spinT -= dt; group.rotation.y += dt * Math.PI * 2; }
    if (X.shakeW > .5) k = 'happy';
    const hover = P.mode === 'fly' && alt > .1 ? Math.sin(t * 2) * .03 : 0;
    group.position.copy(spot); group.position.y += alt + hover;
    if (X.stepX) { const a = group.rotation.y; group.position.x += Math.cos(a) * X.stepX; group.position.z -= Math.sin(a) * X.stepX; }   // the dancer's sideways steps
    updateTilt(dt, X.moving);
    updateJets(dt, t);
    pose(dt, t, k, X);
    if (P.mode === 'sit' || P.mode === 'sleep') plantSeat(dt);                // sitting on the floor
    else if (alt === 0 && jumpV === null && P.mode !== 'fly') { plantFeet(dt); seatT = 0; plantSeat.want = undefined; }   // soles on the floor
    else inner.position.y += (baseY - inner.position.y) * Math.min(1, dt * 6);   // in the air: the plain rest offset
  };
  return P;
}
