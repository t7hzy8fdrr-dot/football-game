/* ГОЛЕАДОР — оригінальний 3D-футбол у браузері (three.js). */
'use strict';
(() => {

// ───────────────────────── Константи ─────────────────────────
const L = 105, W = 68;                         // поле, м
const GOAL_W = 8.0, GOAL_H = 2.68, GOAL_D = 2.0, POST_R = 0.06;
const PT = W / 2 - GOAL_W / 2, PB = W / 2 + GOAL_W / 2;
const G = 9.81, DT = 1 / 60;
const BALL_R = 0.11;                           // фізичний радіус
const BALL_VIS = window.matchMedia('(pointer: coarse)').matches ? 1.6 : 1.4;                         // м'яч трохи більший візуально, щоб його було видно
const AIR_K = 0.0125;                          // опір повітря (на метр)
const MAGNUS = 0.0042;                         // ефект Магнуса (закрут)
const ROLL_A = 0.42, ROLL_C = 0.75;            // тертя кочення по траві

const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hyp = Math.hypot;
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return hyp(px - ax - dx * t, py - ay - dy * t);
}

const DIFF = {
  easy:   { speed: 0.88, react: 0.5,  tackle: 0.25, acc: 0.55, gk: 0.55 },
  normal: { speed: 0.96, react: 0.3,  tackle: 0.38, acc: 0.72, gk: 0.7 },
  hard:   { speed: 1.03, react: 0.16, tackle: 0.52, acc: 0.86, gk: 0.84 },
};
// Вигадані клуби у класичних кольорах великих європейських команд (без справжніх назв і гербів)
const CLUBS = [
  { name: 'ЛЕВИ',     short: 'ЛЕВ', shirt: 0xc8102e, trim: 0xffffff, shorts: 0xf2f2f2, socks: 0xc8102e, gk: 0x1fae5b, gkTrim: 0x0b4d28, num: '#ffffff', css: '#d7263d' },
  { name: 'ВОВКИ',    short: 'ВОВ', shirt: 0x1f56c8, trim: 0xf2c230, shorts: 0x0e1a33, socks: 0x1f56c8, gk: 0xf2c230, gkTrim: 0x7a5d00, num: '#f2c230', css: '#2a6be0' },
  { name: 'КОРОЛІ',   short: 'КОР', shirt: 0xf4f4f4, trim: 0xd4af37, shorts: 0xf4f4f4, socks: 0xf4f4f4, gk: 0x2b2b2b, gkTrim: 0x8a8a8a, num: '#1b2a4a', css: '#f4f4f4' },
  { name: 'ГРАНАТ',   short: 'ГРН', shirt: 0x1d3f8f, stripe: 0x9b1b3a, trim: 0xf2c230, shorts: 0x1d3f8f, socks: 0x1d3f8f, gk: 0xf28c28, gkTrim: 0x7a3d00, num: '#f2c230', css: '#7a2a5a' },
  { name: 'НЕБЕСНІ',  short: 'НЕБ', shirt: 0x7ec3ee, trim: 0x123a63, shorts: 0xffffff, socks: 0x7ec3ee, gk: 0x2bbf6a, gkTrim: 0x0b4d28, num: '#123a63', css: '#7ec3ee' },
  { name: 'БДЖОЛИ',   short: 'БДЖ', shirt: 0xf7d417, trim: 0x111111, shorts: 0x111111, socks: 0xf7d417, gk: 0x7d3cc4, gkTrim: 0x2d1150, num: '#111111', css: '#f7d417' },
  { name: 'ЗЕБРИ',    short: 'ЗЕБ', shirt: 0xf4f4f4, stripe: 0x111111, trim: 0x111111, shorts: 0x111111, socks: 0x111111, gk: 0xf28c28, gkTrim: 0x7a3d00, num: '#d4af37', css: '#999999' },
  { name: 'ДИЯВОЛИ',  short: 'ДИЯ', shirt: 0xc8102e, stripe: 0x111111, trim: 0x111111, shorts: 0xf4f4f4, socks: 0x111111, gk: 0x1fae5b, gkTrim: 0x0b4d28, num: '#ffffff', css: '#a01020' },
  { name: 'ЗМІЇ',     short: 'ЗМІ', shirt: 0x1f56c8, stripe: 0x111111, trim: 0x111111, shorts: 0x111111, socks: 0x111111, gk: 0xc6e83a, gkTrim: 0x4a5a10, num: '#ffffff', css: '#1a3a90' },
  { name: 'БАРОНИ',   short: 'БАР', shirt: 0xdc0f2d, trim: 0xffffff, shorts: 0xdc0f2d, socks: 0xdc0f2d, gk: 0x111111, gkTrim: 0x444444, num: '#ffffff', css: '#dc0f2d' },
];
const TEAMS = [{ ...CLUBS[0], dir: 1 }, { ...CLUBS[1], dir: -1 }];
const FORM = [
  { r: 'GK', x: 3, y: 34 },
  { r: 'DF', x: 20, y: 13 }, { r: 'DF', x: 16, y: 34 }, { r: 'DF', x: 20, y: 55 },
  { r: 'MF', x: 37, y: 23 }, { r: 'MF', x: 37, y: 45 },
  { r: 'FW', x: 49, y: 34 },
];
const NUMS = [1, 2, 4, 3, 8, 10, 9];
// вигадані прізвища для підписів над гравцями
const SURNAMES = ['КОВАЛЬ', 'МОРЕНО', 'ГАРСІЯ', 'ШЕВЧУК', 'ЛОРЕНЦ', 'БЕРТІ', 'ДЮПОН', 'СІЛВА', 'НОВАК', 'РОССІ', 'КРУЗ', 'ГОНЧАР', 'ФЕРРО', 'ВАЛЕНТІ', 'КЛЕЙН',
  'ОЛІВЕЙРА', 'ТКАЧ', 'МАРТЕН', 'БРАУН', 'ДІАС', 'ЯНСЕН', 'ЛУКАЧ', 'САНТОС', 'ВОЛКЕР', 'КАРУЗО', 'МЕЛЬНИК', 'ПЕРЕС', 'ГРІН', 'ЛЕБЕДЬ', 'ФОНТЕН',
  'КОСТА', 'ВЕБЕР', 'ЛІНДЕ', 'БОНДАР', 'РІВЕРА', 'ОРТІС', 'ШМІДТ', 'МАЛДІ', 'ПОЛІЩУК', 'ЕНЦО', 'ДАЛЬ', 'РЕЙЕС', 'ГОРДОН', 'САВЧЕНКО', 'НАВАРРО'];
const SKINS = [0xf1c7a5, 0xe0ac85, 0xc68863, 0x8d5a3b, 0xf5d3b8, 0x6b4128];
const HAIRS = [0x1b1209, 0x3b2412, 0x6b4320, 0xc9a15a, 0x0d0d0d, 0x7a3d18];

const toW = (t, lx, ly) => (TEAMS[t].dir > 0 ? [lx, ly] : [L - lx, W - ly]);
const toL = toW;
const isMobile = window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const isPortrait = () => window.innerHeight > window.innerWidth * 1.05;
// на телефоні, який тримають вертикально, — камера за спиною гравця (поле видно на весь екран)
let camPicked = false;   // гравець сам обрав камеру кнопкою — тоді не перемикаємо автоматично
const camModeEff = () => (isMobile && isPortrait() && !demo && !camPicked ? 2 : camMode);

// ───────────────────────── 3D-сцена ─────────────────────────
const T3 = THREE;
if (T3.ColorManagement) T3.ColorManagement.legacyMode = false;   // кольори в sRGB, як на екрані
const V = (x, y, z = 0) => new T3.Vector3(x - L / 2, z, y - W / 2);
let renderer;
try { renderer = new T3.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
catch (e) { if (window.__showErr) window.__showErr('Браузер не дав увімкнути 3D-графіку (WebGL). Спробуйте інший браузер або оновіть сторінку.'); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T3.PCFSoftShadowMap;
renderer.outputEncoding = T3.sRGBEncoding;
renderer.toneMapping = T3.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('view').appendChild(renderer.domElement);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new T3.Scene();
scene.background = new T3.Color(0x0a1424);
scene.fog = new T3.Fog(0x0a1424, 140, 320);
const camera = new T3.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 600);
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => { setTimeout(onResize, 120); setTimeout(onResize, 500); });
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
document.addEventListener('fullscreenchange', () => setTimeout(onResize, 60));

// Світло: небо + прожектори
scene.add(new T3.HemisphereLight(0xcfe0ff, 0x2a3d1e, 0.5));
const sun = new T3.DirectionalLight(0xfff4e0, 1.55);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
const SH = 32;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 10, far: 200 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun); scene.add(sun.target);
const fill = new T3.DirectionalLight(0xdfe8ff, 0.55); fill.position.set(60, 70, -50); scene.add(fill);
const fill2 = new T3.DirectionalLight(0xffffff, 0.3); fill2.position.set(-70, 60, 60); scene.add(fill2);

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T3.CanvasTexture(c); t.encoding = T3.sRGBEncoding; t.anisotropy = maxAniso;
  if (repeat) { t.wrapS = t.wrapT = T3.RepeatWrapping; }
  return t;
}

// ── Газон з покосом і розміткою (одна велика текстура)
const PAD = 4;
function buildPitch() {
  const AW = L + 2 * PAD, AH = W + 2 * PAD;
  const TW = isMobile ? 2048 : 4096, TH = Math.round(TW * AH / AW), s = TW / AW;
  const tex = canvasTex(TW, TH, (g) => {
    const X = (x) => (x + PAD) * s, Y = (y) => (y + PAD) * s;
    const sw = L / 18;
    for (let k = -1; k < 20; k++) {
      g.fillStyle = (k & 1) ? '#2f6a22' : '#3d7a2c';
      g.fillRect(X(k * sw), 0, sw * s + 1, TH);
    }
    g.globalAlpha = 0.045; g.fillStyle = '#fff';
    for (let k = 0; k < 14; k++) if (k & 1) g.fillRect(0, Y(-PAD + k * AH / 14), TW, AH / 14 * s);
    g.globalAlpha = 1;
    const noise = document.createElement('canvas'); noise.width = noise.height = 256;
    const nc = noise.getContext('2d'), id = nc.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    nc.putImageData(id, 0, 0);
    for (const [sc, a] of [[1, 0.09], [3, 0.05], [9, 0.04]]) {
      g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'overlay'; g.scale(sc, sc);
      g.fillStyle = g.createPattern(noise, 'repeat'); g.fillRect(0, 0, TW / sc, TH / sc); g.restore();
    }
    for (let i = 0; i < TW * TH / 60; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(15,50,10,0.16)' : 'rgba(190,230,140,0.08)';
      g.fillRect(Math.random() * TW, Math.random() * TH, 1, 2 + Math.random() * 3);
    }
    const wear = (x, y, rx, ry, a) => {
      g.save(); g.translate(X(x), Y(y)); g.scale(1, ry / rx);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx * s);
      rg.addColorStop(0, `rgba(125,120,70,${a})`); rg.addColorStop(1, 'rgba(125,120,70,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, rx * s, 0, 7); g.fill(); g.restore();
    };
    wear(2.5, W / 2, 4.5, 3.5, 0.32); wear(L - 2.5, W / 2, 4.5, 3.5, 0.32); wear(11, W / 2, 2, 2, 0.18); wear(L - 11, W / 2, 2, 2, 0.18); wear(L / 2, W / 2, 2.5, 2.5, 0.14);
    for (let i = 0; i < 40; i++) wear(rand(0, L), rand(0, W), rand(1, 4), rand(1, 4), 0.05);
    g.strokeStyle = 'rgba(250,250,245,0.92)';
    g.save(); g.translate(X(0), Y(0)); g.scale(s, s); g.lineWidth = 0.12;
    g.beginPath();
    g.rect(0, 0, L, W); g.moveTo(L / 2, 0); g.lineTo(L / 2, W);
    g.moveTo(L / 2 + 9.15, W / 2); g.arc(L / 2, W / 2, 9.15, 0, Math.PI * 2);
    const pa = 40.32, ga = 18.32;
    g.rect(0, W / 2 - pa / 2, 16.5, pa); g.rect(L - 16.5, W / 2 - pa / 2, 16.5, pa);
    g.rect(0, W / 2 - ga / 2, 5.5, ga); g.rect(L - 5.5, W / 2 - ga / 2, 5.5, ga);
    const th = Math.acos((16.5 - 11) / 9.15);
    g.moveTo(11 + 9.15 * Math.cos(-th), W / 2 + 9.15 * Math.sin(-th)); g.arc(11, W / 2, 9.15, -th, th);
    g.moveTo(L - 11 + 9.15 * Math.cos(Math.PI - th), W / 2 + 9.15 * Math.sin(Math.PI - th)); g.arc(L - 11, W / 2, 9.15, Math.PI - th, Math.PI + th);
    g.moveTo(1, 0); g.arc(0, 0, 1, 0, Math.PI / 2);
    g.moveTo(L, 1); g.arc(L, 0, 1, Math.PI / 2, Math.PI);
    g.moveTo(L - 1, W); g.arc(L, W, 1, Math.PI, Math.PI * 1.5);
    g.moveTo(0, W - 1); g.arc(0, W, 1, Math.PI * 1.5, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(250,250,245,0.92)';
    for (const [x, y] of [[L / 2, W / 2], [11, W / 2], [L - 11, W / 2]]) { g.beginPath(); g.arc(x, y, 0.2, 0, 7); g.fill(); }
    g.restore();
  });
  const mat = new T3.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 });
  const mesh = new T3.Mesh(new T3.PlaneGeometry(AW, AH), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true;
  scene.add(mesh);
  const outer = new T3.Mesh(new T3.PlaneGeometry(AW + 16, AH + 16), new T3.MeshStandardMaterial({ color: 0x2f6424, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true; scene.add(outer);
  const ground = new T3.Mesh(new T3.PlaneGeometry(400, 400), new T3.MeshStandardMaterial({ color: 0x24272d, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
}

// ── Трибуни з уболівальниками (instanced, анімація у шейдері)
const crowdUniforms = { uTime: { value: 0 }, uJump: { value: 0 } };
function crowdMaterial(color) {
  const m = new T3.MeshLambertMaterial({ color });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = crowdUniforms.uTime; sh.uniforms.uJump = crowdUniforms.uJump;
    sh.vertexShader = 'attribute float aPhase;\nuniform float uTime;\nuniform float uJump;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n float bb = abs(sin(uTime * (2.0 + uJump * 6.0) + aPhase * 6.283));\n transformed.y += bb * (0.04 + uJump * 0.45 * step(0.35, fract(aPhase * 7.3)));');
  };
  return m;
}
const flags = [];
let crowd = null;
function buildStadium() {
  const ROWS = isMobile ? 16 : 22, RD = 0.85, RH = 0.5, GAP = 9.5;
  const standMat = new T3.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.95 });
  const seats = [];
  const sides = [
    { cx: L / 2, cy: -GAP, len: L + 22, ang: 0 },
    { cx: L / 2, cy: W + GAP, len: L + 22, ang: Math.PI },
    { cx: -GAP, cy: W / 2, len: W + 4, ang: Math.PI / 2 },
    { cx: L + GAP, cy: W / 2, len: W + 4, ang: -Math.PI / 2 },
  ];
  for (const sd of sides) {
    // профіль сходинок у площині (z: від поля назад = від'ємний, y: висота); трибуна дивиться в +z групи
    const shape = new T3.Shape(); shape.moveTo(0, 0);
    for (let r = 0; r < ROWS; r++) { shape.lineTo(r * RD, (r + 1) * RH); shape.lineTo((r + 1) * RD, (r + 1) * RH); }
    shape.lineTo(ROWS * RD, 0); shape.lineTo(0, 0);
    const geo = new T3.ExtrudeGeometry(shape, { depth: sd.len, bevelEnabled: false });
    geo.translate(0, 0, -sd.len / 2);
    geo.rotateY(Math.PI / 2);            // x профілю → -z, довжина → x
    const grp = new T3.Group();
    const m = new T3.Mesh(geo, standMat); m.receiveShadow = true; grp.add(m);
    grp.position.copy(V(sd.cx, sd.cy, 0.9));
    grp.rotation.y = sd.ang;
    scene.add(grp);
    const wall = new T3.Mesh(new T3.BoxGeometry(sd.len, 0.9, 0.3), new T3.MeshStandardMaterial({ color: 0x1b2233, roughness: 0.8 }));
    wall.position.set(0, -0.45, 0.15); grp.add(wall);
    if (sd.ang !== Math.PI) {   // над ближньою трибуною (де камера) даху немає
    const roof = new T3.Mesh(new T3.BoxGeometry(sd.len + 2, 0.6, ROWS * RD + 6), new T3.MeshStandardMaterial({ color: 0x15181f, roughness: 0.7, metalness: 0.3 }));
    roof.position.set(0, ROWS * RH + 7, -(ROWS * RD) / 2 + 1); roof.rotation.x = -0.08; grp.add(roof);
    const strip = new T3.Mesh(new T3.BoxGeometry(sd.len, 0.15, 0.4), new T3.MeshBasicMaterial({ color: 0xfff6dc }));
    strip.position.set(0, ROWS * RH + 6.6, 3.6); grp.add(strip);
    }
    grp.updateMatrixWorld(true);
    for (let r = 0; r < ROWS; r++) {
      for (let a = -sd.len / 2 + 0.4; a < sd.len / 2 - 0.4; a += 0.56) {
        if (Math.random() < 0.13) continue;
        const local = new T3.Vector3(a, (r + 1) * RH, -(r + 0.45) * RD).applyMatrix4(grp.matrixWorld);
        seats.push([local.x, local.y, local.z, sd.ang]);
      }
    }
  }
  const n = seats.length;
  const bodyG = new T3.BoxGeometry(0.42, 0.62, 0.3); bodyG.translate(0, 0.31, 0);
  const headG = new T3.SphereGeometry(0.12, 6, 5); headG.translate(0, 0.76, 0);
  const phases = new Float32Array(n); for (let i = 0; i < n; i++) phases[i] = Math.random();
  bodyG.setAttribute('aPhase', new T3.InstancedBufferAttribute(phases, 1));
  headG.setAttribute('aPhase', new T3.InstancedBufferAttribute(phases, 1));
  const bodies = new T3.InstancedMesh(bodyG, crowdMaterial(0xffffff), n);
  const heads = new T3.InstancedMesh(headG, crowdMaterial(0xffffff), n);
  const cols = [0xc8102e, 0xc8102e, 0x1f56c8, 0x1f56c8, 0xf2f2f2, 0x2c3e50, 0xf1c40f, 0x7f8c8d, 0x16a085, 0x222222, 0xd35400];
  const m4 = new T3.Matrix4(), q = new T3.Quaternion(), sc = new T3.Vector3(1, 1, 1), c = new T3.Color(), up = new T3.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const [x, y, z, ang] = seats[i];
    q.setFromAxisAngle(up, ang + rand(-0.2, 0.2));
    sc.set(rand(0.9, 1.1), rand(0.85, 1.12), 1);
    m4.compose(new T3.Vector3(x + rand(-0.06, 0.06), y, z), q, sc);
    bodies.setMatrixAt(i, m4); heads.setMatrixAt(i, m4);
    let col = cols[(Math.random() * cols.length) | 0];
    if (Math.random() < 0.3) col = x < 0 ? 0xc8102e : 0x1f56c8;
    bodies.setColorAt(i, c.setHex(col));
    heads.setColorAt(i, c.setHex(SKINS[(Math.random() * SKINS.length) | 0]));
  }
  scene.add(bodies); scene.add(heads);
  crowd = { seats, cubes: [bodies, heads] };

  const glowTex = canvasTex(128, 128, (g) => {
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,240,1)'); rg.addColorStop(0.2, 'rgba(255,250,220,0.6)'); rg.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  });
  for (const [x, y] of [[-24, -26], [L + 24, -26], [-24, W + 26], [L + 24, W + 26]]) {
    const pole = new T3.Mesh(new T3.CylinderGeometry(0.5, 0.9, 42, 10), new T3.MeshStandardMaterial({ color: 0x8a919c, metalness: 0.6, roughness: 0.4 }));
    pole.position.copy(V(x, y, 21)); scene.add(pole);
    const head = new T3.Mesh(new T3.BoxGeometry(7, 4, 0.6), new T3.MeshBasicMaterial({ color: 0xfffbe8 }));
    head.position.copy(V(x, y, 43)); head.lookAt(V(L / 2, W / 2, 0)); scene.add(head);
    const spr = new T3.Sprite(new T3.SpriteMaterial({ map: glowTex, color: 0xfff3d0, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, fog: false }));
    spr.scale.set(26, 26, 1); spr.position.copy(V(x, y, 43)); scene.add(spr);
  }
}

// ── Глядачі: фігури людей (рендер моделі в атлас) на площинах замість кубиків
function buildCrowdSprites() {
  if (!HUMAN || !crowd) return;
  const COLS = 8, ROWS = 4, CW = 128, CH = 256;
  const rt = new T3.WebGLRenderTarget(COLS * CW, ROWS * CH, { generateMipmaps: true, minFilter: T3.LinearMipmapLinearFilter });
  const sc = new T3.Scene();
  sc.add(new T3.HemisphereLight(0xdfe8ff, 0x3a3020, 0.9));
  const dl = new T3.DirectionalLight(0xffffff, 1.4); dl.position.set(1, 3, 4); sc.add(dl);
  const cam = new T3.OrthographicCamera(-0.5, 0.5, 1.95, -0.05, 0.1, 20); cam.position.set(0, 0, 5); cam.lookAt(0, 0, 0);
  // половина вболіває за червоних, половина за синіх, решта — у своєму
  const shirts = [0xc8102e, 0xd7263d, 0x1f56c8, 0x2a6be0, 0xf2f2f2, 0x2c3e50, 0x222222, 0xf1c40f, 0xc8102e, 0x1f56c8, 0x7f8c8d, 0x16a085, 0xd35400, 0x8e44ad, 0xc8102e, 0x1f56c8];
  const prevRT = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new T3.Color()), prevA = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  for (let i = 0; i < COLS * ROWS; i++) {
    const v = i % 16, cheer = i >= 16;
    const fake = { team: 0, skinLight: v % 3 !== 0, skinTint: [0xffffff, 0xf3e3d6, 0xe8d2c0][v % 3], boot: 0x222222 };
    const g = T3.SkeletonUtils.clone(HUMAN.scene);
    let body = null;
    g.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; if (o.name === 'SuperHero_Male') { body = o; o.material = kitMaterial(fake, { shirt: shirts[v], shorts: [0x2b3a55, 0x1d1d1d, 0x4a4a4a][v % 3], socks: 0x222222 }); } } });
    const head = body.skeleton.getBoneByName('Head');
    g.updateMatrixWorld(true);
    if (v % 4 !== 3) {   // зачіска
      const src = HUMAN.hair[v % 2 ? 'Hair_SimpleParted' : 'Hair_Buzzed'];
      if (src) { const h = new T3.Mesh(src.geometry, hairMat(src.material, HAIRS[v % HAIRS.length])); h.matrixAutoUpdate = false; h.matrix.copy(head.matrixWorld.clone().invert().multiply(g.matrixWorld)); head.add(h); }
    }
    const mixer = new T3.AnimationMixer(g);
    mixer.clipAction(HUMAN.clips.Idle_Loop).play(); mixer.setTime(v * 0.37);
    g.updateMatrixWorld(true);
    if (cheer) {   // руки вгору
      const B = (n) => body.skeleton.getBoneByName(n);
      boneRot(B('upperarm_l'), AX_Z, 2.3 + (v % 3) * 0.15, g); g.updateMatrixWorld(true);
      boneRot(B('upperarm_r'), AX_Z, -2.3 - (v % 2) * 0.2, g); g.updateMatrixWorld(true);
      boneRot(B('lowerarm_l'), AX_Z, 0.4, g); boneRot(B('lowerarm_r'), AX_Z, -0.4, g);
    }
    g.rotation.y = (v % 5 - 2) * 0.12;
    sc.add(g);
    const cx = i % COLS, cy = (i / COLS) | 0;
    rt.viewport.set(cx * CW, cy * CH, CW, CH); rt.scissor.set(cx * CW, cy * CH, CW, CH); rt.scissorTest = true;
    renderer.setRenderTarget(rt);
    renderer.render(sc, cam);
    sc.remove(g);
  }
  rt.scissorTest = false; rt.viewport.set(0, 0, COLS * CW, ROWS * CH);
  renderer.setRenderTarget(prevRT); renderer.setClearColor(prevClear, prevA);
  const seats = crowd.seats, n = seats.length;
  const geo = new T3.PlaneGeometry(0.62, 1.2); geo.translate(0, 0.52, 0);
  const cell = new Float32Array(n), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { cell[i] = (Math.random() * 16) | 0; ph[i] = Math.random(); }
  geo.setAttribute('aCell', new T3.InstancedBufferAttribute(cell, 1));
  geo.setAttribute('aPhase', new T3.InstancedBufferAttribute(ph, 1));
  const mat = new T3.MeshBasicMaterial({ map: rt.texture, alphaTest: 0.42, side: T3.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = crowdUniforms.uTime; sh.uniforms.uJump = crowdUniforms.uJump;
    sh.vertexShader = 'attribute float aCell;\nattribute float aPhase;\nuniform float uTime;\nuniform float uJump;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        float cheer = step(0.5, uJump) * step(0.25, fract(aPhase * 5.3));
        float cc = aCell + 16.0 * cheer;
        vUv = (uv + vec2(mod(cc, 8.0), floor(cc / 8.0))) / vec2(8.0, 4.0);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float bb = abs(sin(uTime * (1.6 + uJump * 6.0) + aPhase * 6.283));
        transformed.y += bb * (0.025 + uJump * 0.4 * step(0.35, fract(aPhase * 7.3)));`);
  };
  const mesh = new T3.InstancedMesh(geo, mat, n);
  const m4 = new T3.Matrix4(), q = new T3.Quaternion(), s3 = new T3.Vector3(), c = new T3.Color(), up = new T3.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const [x, y, z, ang] = seats[i];
    q.setFromAxisAngle(up, ang + rand(-0.15, 0.15));
    const k = rand(0.92, 1.08); s3.set(k, k, 1);
    m4.compose(new T3.Vector3(x + rand(-0.05, 0.05), y, z), q, s3);
    mesh.setMatrixAt(i, m4);
    const b = rand(0.62, 0.9); mesh.setColorAt(i, c.setRGB(b, b, b));
  }
  scene.add(mesh);
  for (const cb of crowd.cubes) { scene.remove(cb); cb.geometry.dispose(); }
  buildStandFlags();
}
// Великі прапори вболівальників на трибунах
function buildStandFlags() {
  const mk = (a, b, text) => canvasTex(256, 160, (g) => {
    g.fillStyle = a; g.fillRect(0, 0, 256, 160);
    g.fillStyle = b; g.fillRect(0, 56, 256, 48);
    g.fillStyle = a === '#ffffff' ? '#111' : '#fff'; g.font = '900 34px Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 81);
  });
  const texs = [mk('#c8102e', '#ffffff', 'ВПЕРЕД'), mk('#1f56c8', '#ffffff', 'ФУТБОЛ'), mk('#c8102e', '#ffd34d', 'ГОЛ!'), mk('#1f56c8', '#ffd34d', 'ВПЕРЕД')];
  const geo = new T3.PlaneGeometry(3.4, 2.1, 14, 6);
  for (let i = 0; i < 14; i++) {
    const far = i < 9;
    const x = far ? 8 + i * 11 + rand(-2, 2) : (i % 2 ? -14.5 : L + 14.5);
    const y = far ? -9.5 - rand(4, 12) : W / 2 + (i - 11) * 9;
    const t = texs[(x < L / 2 ? 0 : 1) + (Math.random() < 0.3 ? 2 : 0)];
    const m = new T3.MeshLambertMaterial({ map: t, side: T3.DoubleSide });
    const ph = Math.random() * 6;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = crowdUniforms.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float wx = (position.x + 1.7) / 3.4;
        transformed.z += sin(position.x * 2.2 - uTime * 4.0 + ${ph.toFixed(2)}) * 0.22 * wx;
        transformed.y += sin(position.x * 1.5 - uTime * 3.0 + ${ph.toFixed(2)}) * 0.08 * wx;`);
    };
    const fl = new T3.Mesh(geo, m);
    const yy = far ? -9.5 - (-9.5 - y) : y;
    const dist = far ? -9.5 - y : 0;
    fl.position.copy(V(x, far ? y : y, 0.9 + (far ? dist / 0.85 * 0.5 : rand(2, 6)) + 2.2));
    fl.rotation.y = far ? 0 : (x < 0 ? Math.PI / 2 : -Math.PI / 2);
    fl.rotation.z = rand(-0.15, 0.15);
    scene.add(fl);
  }
}

// ── Великі екрани на стадіоні: показують матч з іншої камери
const screens = { rt: null, cam: null, n: 0 };
function buildScreens() {
  const rt = new T3.WebGLRenderTarget(isMobile ? 320 : 480, isMobile ? 180 : 270);
  screens.rt = rt; screens.cam = new T3.PerspectiveCamera(30, 16 / 9, 0.5, 400);
  const frameMat = new T3.MeshStandardMaterial({ color: 0x14171f, roughness: 0.5, metalness: 0.4 });
  const bandTex = canvasTex(512, 42, () => {});
  screens.drawBand = () => {
    const c = bandTex.image.getContext('2d'), w = 512, h = 42;
    c.fillStyle = '#0f1c3d'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd34d'; c.font = '900 30px Segoe UI, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${TEAMS[0].name}  —  ${TEAMS[1].name}`, w / 2, h / 2 + 1);
    bandTex.needsUpdate = true;
  };
  screens.drawBand();
  const scrMat = new T3.MeshBasicMaterial({ map: rt.texture, toneMapped: false });
  for (const x of [17, L - 17]) {
    const g = new T3.Group();
    const fr = new T3.Mesh(new T3.BoxGeometry(17, 9.9, 0.6), frameMat); g.add(fr);
    const sc = new T3.Mesh(new T3.PlaneGeometry(16, 9), scrMat); sc.position.z = 0.31; g.add(sc);
    const band = new T3.Mesh(new T3.PlaneGeometry(17, 1.4), new T3.MeshBasicMaterial({ map: bandTex }));
    band.position.set(0, -5.75, 0.31); g.add(band);
    g.position.copy(V(x, -6.5, 24.3)); g.rotation.x = 0.1;
    scene.add(g);
  }
}
function updateScreens() {
  if (!screens.rt || demo || paused) return;
  if (++screens.n % (isMobile ? 4 : 3)) return;
  const c = screens.cam, dir = ball.x < L / 2 ? -1 : 1;
  // камера «за воротами», ближче до м'яча
  c.position.copy(V(clamp(ball.x - dir * 16, -2, L + 2), clamp(ball.y + (ball.y < W / 2 ? -9 : 9), -6, W + 6), 6.5));
  c.lookAt(V(ball.x + dir * 3, ball.y, 0.8));
  const auto = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
  const vis = ctrlRing.visible, av = aimArrow.visible; ctrlRing.visible = ctrlArrow.visible = aimArrow.visible = false;
  renderer.setRenderTarget(screens.rt); renderer.render(scene, c); renderer.setRenderTarget(null);
  renderer.shadowMap.autoUpdate = auto; ctrlRing.visible = ctrlArrow.visible = vis; aimArrow.visible = av;
}

// ── LED-борти з рекламою, що біжить
const ledTextures = [];
function buildBoards() {
  const ads = ['ГОЛЕАДОР', 'ГРАЙ ЧЕСНО', 'ФУТБОЛ 2026', 'ВПЕРЕД!', 'СИЛА ГРИ', 'ГОЛЕАДОР'];
  const colors = [['#0f1c3d', '#ffd34d'], ['#c81e2e', '#ffffff'], ['#0b6e4f', '#ffffff'], ['#111111', '#ffd34d'], ['#1f5fd6', '#ffffff'], ['#3a1f6b', '#7fe3ff']];
  const tex = canvasTex(2048, 64, (g, w, h) => {
    const seg = w / ads.length;
    ads.forEach((a, i) => {
      g.fillStyle = colors[i][0]; g.fillRect(i * seg, 0, seg, h);
      g.fillStyle = colors[i][1]; g.font = '900 40px Segoe UI, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(a, i * seg + seg / 2, h / 2 + 2);
    });
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < w; x += 3) g.fillRect(x, 0, 1, h);
  }, true);
  const back = new T3.MeshStandardMaterial({ color: 0x1b2233 });
  const mk = (len, x, y, ang) => {
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set(len / 40, 1); ledTextures.push(t);
    const mat = new T3.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.85, roughness: 0.6 });
    const b = new T3.Mesh(new T3.BoxGeometry(len, 0.9, 0.12), [back, back, back, back, mat, back]);
    b.position.copy(V(x, y, 0.45)); b.rotation.y = ang; b.castShadow = true;
    scene.add(b);
  };
  mk(L + 10, L / 2, -5, 0);
  mk(L + 10, L / 2, W + 5, Math.PI);
  mk(W + 10, -5.5, W / 2, Math.PI / 2);
  mk(W + 10, L + 5.5, W / 2, -Math.PI / 2);
  for (const bx of [L / 2 - 12, L / 2 + 12]) {
    const bench = new T3.Mesh(new T3.BoxGeometry(7, 1.8, 1.6), new T3.MeshStandardMaterial({ color: 0x9fc4e0, transparent: true, opacity: 0.45, roughness: 0.2 }));
    bench.position.copy(V(bx, -3.2, 0.9)); scene.add(bench);
  }
}

// ── Ворота з сіткою, що прогинається від м'яча
const nets = [];
function buildGoals() {
  const postMat = new T3.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 });
  const barMat = new T3.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.5, metalness: 0.4 });
  const netMat = new T3.LineBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.5 });
  for (const side of [0, 1]) {
    const gx = side ? L : 0, dir = side ? 1 : -1;
    for (const py of [PT, PB]) {
      const p = new T3.Mesh(new T3.CylinderGeometry(POST_R, POST_R, GOAL_H + POST_R, 14), postMat);
      p.position.copy(V(gx, py, (GOAL_H + POST_R) / 2)); p.castShadow = true; scene.add(p);
      const a = V(gx, py, GOAL_H - 0.25), b = V(gx + dir * GOAL_D, py, 0);
      const s = new T3.Mesh(new T3.CylinderGeometry(0.025, 0.025, a.distanceTo(b), 6), barMat);
      s.position.copy(a.clone().add(b).multiplyScalar(0.5));
      s.quaternion.setFromUnitVectors(new T3.Vector3(0, 1, 0), b.clone().sub(a).normalize()); scene.add(s);
    }
    const bar = new T3.Mesh(new T3.CylinderGeometry(POST_R, POST_R, GOAL_W + 2 * POST_R, 14), postMat);
    bar.rotation.x = Math.PI / 2; bar.position.copy(V(gx, W / 2, GOAL_H)); bar.castShadow = true; scene.add(bar);
    const bk = new T3.Mesh(new T3.CylinderGeometry(0.025, 0.025, GOAL_W, 6), barMat);
    bk.rotation.x = Math.PI / 2; bk.position.copy(V(gx + dir * GOAL_D, W / 2, 0.02)); scene.add(bk);
    // профіль сітки: від поперечини назад дахом, потім вниз задньою стінкою
    const NU = 30, NV = 14, NS = 10;
    const prof = [];
    for (let i = 0; i <= NV; i++) {
      const t = i / NV;
      if (t < 0.35) { const k = t / 0.35; prof.push([dir * GOAL_D * k * 0.9, GOAL_H - k * 0.25]); }
      else { const k = (t - 0.35) / 0.65; prof.push([dir * lerp(GOAL_D * 0.9, GOAL_D, k), lerp(GOAL_H - 0.25, 0, k)]); }
    }
    const pts = [];
    for (let j = 0; j <= NU; j++) { const y = lerp(PT, PB, j / NU); for (let i = 0; i <= NV; i++) pts.push([gx + prof[i][0], y, prof[i][1]]); }
    // бокові сітки: між штангою (x = gx) та профілем
    for (const y of [PT, PB]) for (let a = 0; a <= NS; a++) for (let i = 0; i <= NV; i++) {
      const k = a / NS; const [px, pz] = prof[i];
      pts.push([gx + px * k, y, pz]);
    }
    const idx = [];
    const id = (j, i) => j * (NV + 1) + i;
    for (let j = 0; j <= NU; j++) for (let i = 0; i <= NV; i++) { if (i < NV) idx.push(id(j, i), id(j, i + 1)); if (j < NU) idx.push(id(j, i), id(j + 1, i)); }
    const off = (NU + 1) * (NV + 1);
    for (let s2 = 0; s2 < 2; s2++) {
      const base = off + s2 * (NS + 1) * (NV + 1), sid = (a, i) => base + a * (NV + 1) + i;
      for (let a = 0; a <= NS; a++) for (let i = 0; i <= NV; i++) { if (i < NV) idx.push(sid(a, i), sid(a, i + 1)); if (a < NS) idx.push(sid(a, i), sid(a + 1, i)); }
    }
    const geo = new T3.BufferGeometry();
    geo.setAttribute('position', new T3.BufferAttribute(new Float32Array(pts.length * 3), 3));
    geo.setIndex(idx);
    const lines = new T3.LineSegments(geo, netMat); lines.frustumCulled = false; scene.add(lines);
    const net = { side, base: pts, disp: new Float32Array(pts.length), geo };
    nets.push(net); updateNet(net);
  }
  for (const [x, y] of [[0, 0], [L, 0], [0, W], [L, W]]) {
    const pole = new T3.Mesh(new T3.CylinderGeometry(0.02, 0.02, 1.5, 6), new T3.MeshStandardMaterial({ color: 0xffffff }));
    pole.position.copy(V(x, y, 0.75)); pole.castShadow = true; scene.add(pole);
    const fg = new T3.PlaneGeometry(0.45, 0.32); fg.translate(0.225, 0, 0);
    const flag = new T3.Mesh(fg, new T3.MeshStandardMaterial({ color: 0xffd34d, side: T3.DoubleSide }));
    flag.position.copy(V(x, y, 1.33)); scene.add(flag); flags.push(flag);
  }
}
function updateNet(net) {
  const p = net.geo.attributes.position.array, dir = net.side ? 1 : -1;
  for (let i = 0; i < net.base.length; i++) {
    const [x, y, z] = net.base[i], d = net.disp[i];
    p[i * 3] = x + dir * d - L / 2; p[i * 3 + 1] = z; p[i * 3 + 2] = y - W / 2;
  }
  net.geo.attributes.position.needsUpdate = true;
}
function netImpact(side, bx, by, bz, strength) {
  const net = nets[side];
  for (let i = 0; i < net.base.length; i++) {
    const [x, y, z] = net.base[i], d = hyp(x - bx, y - by, z - bz);
    if (d < 1.4) net.disp[i] = Math.max(net.disp[i], strength * (1 - d / 1.4));
  }
}

// ── Гравці: об'ємні фігури з шарнірами
// Кінцівки — тіла обертання з м'язовим профілем: [радіус, висота] знизу вгору
function limb(prof, seg = 12, sz = 1) {
  const g = new T3.LatheGeometry(prof.map(([r, y]) => new T3.Vector2(r, y)), seg);
  if (sz !== 1) g.scale(1, 1, sz);
  return g;
}
const geoCache = {
  boot: (() => { const g = new T3.CapsuleGeometry(0.046, 0.15, 4, 10); g.rotateX(Math.PI / 2); g.scale(1, 0.72, 1); g.translate(0, 0.034, 0.055); return g; })(),
  sole: (() => { const g = new T3.BoxGeometry(0.095, 0.014, 0.25); g.translate(0, 0.007, 0.055); return g; })(),
  shin: limb([[0.001, -0.47], [0.04, -0.465], [0.037, -0.43], [0.045, -0.33], [0.062, -0.18], [0.066, -0.12], [0.058, -0.03], [0.05, 0], [0.001, 0.01]]),
  knee: (() => { const g = new T3.SphereGeometry(0.058, 12, 8); g.scale(1, 1.1, 1); return g; })(),
  thigh: limb([[0.001, -0.46], [0.055, -0.45], [0.062, -0.38], [0.078, -0.25], [0.09, -0.1], [0.088, 0], [0.001, 0.03]]),
  shortLeg: limb([[0.1, -0.24], [0.104, -0.12], [0.106, 0]], 14),
  pelvis: limb([[0.001, -0.13], [0.11, -0.12], [0.16, -0.07], [0.162, 0.03], [0.15, 0.09], [0.001, 0.1]], 18, 0.74),
  torso: limb([[0.15, -0.02], [0.142, 0.08], [0.15, 0.2], [0.18, 0.32], [0.2, 0.4], [0.19, 0.46], [0.13, 0.51], [0.06, 0.535], [0.001, 0.54]], 24, 0.62),
  neck: (() => { const g = new T3.CylinderGeometry(0.052, 0.06, 0.12, 12); g.translate(0, 0.05, 0); return g; })(),
  head: (() => { const g = new T3.SphereGeometry(0.104, 22, 16); g.scale(0.9, 1.08, 1.0); return g; })(),
  jaw: (() => { const g = new T3.SphereGeometry(0.068, 14, 10); g.scale(1, 0.85, 1); g.translate(0, -0.05, 0.03); return g; })(),
  ear: (() => { const g = new T3.SphereGeometry(0.022, 8, 6); g.scale(0.5, 1.2, 0.9); return g; })(),
  eye: new T3.SphereGeometry(0.0115, 8, 6),
  brow: new T3.BoxGeometry(0.03, 0.007, 0.01),
  hair: (() => { const g = new T3.SphereGeometry(0.112, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.52); g.rotateX(-0.42); g.scale(0.93, 1.06, 1.04); g.translate(0, 0.01, -0.006); return g; })(),
  hairBig: (() => { const g = new T3.SphereGeometry(0.122, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.6); g.rotateX(-0.5); g.scale(0.97, 1.1, 1.08); g.translate(0, 0.015, -0.012); return g; })(),
  nose: (() => { const g = new T3.ConeGeometry(0.016, 0.042, 6); g.rotateX(Math.PI / 2 + 0.3); return g; })(),
  delt: (() => { const g = new T3.SphereGeometry(0.068, 12, 10); g.scale(1, 0.95, 1); return g; })(),
  sleeve: limb([[0.06, -0.19], [0.064, -0.1], [0.068, 0]], 12),
  cuff: (() => { const g = new T3.TorusGeometry(0.06, 0.009, 6, 16); g.rotateX(Math.PI / 2); g.translate(0, -0.19, 0); return g; })(),
  upperArm: limb([[0.001, -0.3], [0.04, -0.295], [0.043, -0.24], [0.05, -0.12], [0.052, -0.05], [0.001, 0]]),
  foreArm: limb([[0.001, -0.25], [0.029, -0.245], [0.031, -0.2], [0.044, -0.07], [0.042, 0], [0.001, 0.02]]),
  hand: (() => { const g = new T3.SphereGeometry(0.045, 10, 8); g.scale(0.72, 1.15, 0.85); return g; })(),
  collar: (() => { const g = new T3.TorusGeometry(0.062, 0.015, 6, 18); g.rotateX(Math.PI / 2); return g; })(),
  numPlane: new T3.PlaneGeometry(0.2, 0.2),
};
const matCache = {};
const std = (hex, rough = 0.75) => matCache[hex + '_' + rough] || (matCache[hex + '_' + rough] = new T3.MeshStandardMaterial({ color: hex, roughness: rough }));
const numMatCache = {};
function numberMat(n, color) {
  const k = n + color;
  if (numMatCache[k]) return numMatCache[k];
  const tex = canvasTex(128, 128, (g) => {
    g.font = '900 104px Arial Black, Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.strokeText(n, 64, 70);
    g.fillStyle = color; g.fillText(n, 64, 70);
  });
  return (numMatCache[k] = new T3.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
}
function buildPlayerModel(p) {
  const T = TEAMS[p.team];
  const shirt = std(p.gk ? T.gk : T.shirt, 0.68), trim = std(p.gk ? T.gkTrim : T.trim, 0.6);
  const shorts = std(p.gk ? 0x1d1d1d : T.shorts, 0.7), socks = std(p.gk ? 0x1d1d1d : T.socks, 0.8);
  const skin = std(p.skin, 0.55), hair = std(p.hair, 0.85), boot = std(p.boot, 0.35), glove = std(0xf5f5f5, 0.5);
  const dark = std(0x141414, 0.6), sole = std(0xe8e8e8, 0.5);
  const M = (g, m, parent, cast = true) => { const mesh = new T3.Mesh(g, m); mesh.castShadow = cast; parent.add(mesh); return mesh; };
  const root = new T3.Group();
  const body = new T3.Group(); root.add(body);
  const hips = new T3.Group(); hips.position.y = 0.95; body.add(hips);
  M(geoCache.pelvis, shorts, hips);
  const torso = new T3.Group(); torso.position.y = 0.03; hips.add(torso);
  M(geoCache.torso, shirt, torso);
  const col = M(geoCache.collar, trim, torso, false); col.position.y = 0.505;
  const num = M(geoCache.numPlane, numberMat(p.num, p.gk ? '#ffffff' : T.num), torso, false);
  num.position.set(0, 0.29, -0.128); num.rotation.y = Math.PI;
  const neck = new T3.Group(); neck.position.y = 0.49; torso.add(neck);
  M(geoCache.neck, skin, neck);
  const head = new T3.Group(); head.position.y = 0.2; neck.add(head);
  M(geoCache.head, skin, head); M(geoCache.jaw, skin, head);
  if (p.hairStyle !== 0) M(p.hairStyle === 2 ? geoCache.hairBig : geoCache.hair, hair, head);
  const nose = M(geoCache.nose, skin, head, false); nose.position.set(0, -0.012, 0.1);
  for (const s of [-1, 1]) {
    const e = M(geoCache.ear, skin, head, false); e.position.set(s * 0.093, -0.005, -0.005);
    const ey = M(geoCache.eye, dark, head, false); ey.position.set(s * 0.034, 0.012, 0.09);
    const br = M(geoCache.brow, hair, head, false); br.position.set(s * 0.035, 0.033, 0.093);
  }
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const sh = new T3.Group(); sh.position.set(s * 0.2, 0.43, 0); torso.add(sh);
    M(geoCache.delt, shirt, sh);
    M(geoCache.sleeve, shirt, sh); M(geoCache.cuff, trim, sh, false);
    M(geoCache.upperArm, p.gk ? shirt : skin, sh);
    const el = new T3.Group(); el.position.y = -0.29; sh.add(el);
    M(geoCache.foreArm, p.gk ? shirt : skin, el);
    const hd = M(geoCache.hand, p.gk ? glove : skin, el); hd.position.y = -0.28;
    if (p.gk) hd.scale.set(1.35, 1.25, 1.35);
    arms.push({ sh, el });
    const hip = new T3.Group(); hip.position.set(s * 0.092, -0.03, 0); hips.add(hip);
    M(geoCache.shortLeg, shorts, hip);
    M(geoCache.thigh, skin, hip);
    const kn = new T3.Group(); kn.position.y = -0.44; hip.add(kn);
    M(geoCache.knee, skin, kn);
    M(geoCache.shin, socks, kn);
    const ft = new T3.Group(); ft.position.y = -0.465; kn.add(ft);
    M(geoCache.boot, boot, ft); M(geoCache.sole, sole, ft, false);
    legs.push({ hip, kn, ft });
  }
  scene.add(root);
  return { root, body, hips, torso, head, arms, legs };
}
function animatePlayer(p, dt = 0) {
  if (p.model.human) { animateHuman(p, dt); return; }
  const m = p.model, sp = hyp(p.vx, p.vy);
  const amp = p.amp, run = clamp((sp - 2.2) / 4.5, 0, 1), ph = p.phase, idle = 1 - Math.min(1, amp * 3);
  const t = performance.now() / 1000 + p.i * 1.7 + p.team * 0.9;
  m.root.position.copy(V(p.x, p.y, 0));
  m.root.rotation.y = Math.atan2(Math.cos(p.face), Math.sin(p.face));
  const [L1, R1] = m.legs, [LA, RA] = m.arms;
  const s = Math.sin(ph), g = Math.min(1, amp * 2.4);
  // ноги: мах уперед/назад, коліно згинається у фазі переносу, стопа відштовхується носком
  // напрямок руху відносно корпусу: уперед, спиною чи боком
  const fx = Math.cos(p.face), fy = Math.sin(p.face);
  const fl = sp > 0.3 ? (p.vx * fx + p.vy * fy) / sp : 1, sl = sp > 0.3 ? (p.vx * fy - p.vy * fx) / sp : 0;
  const A = (0.24 + 0.5 * run) * g, KN = (0.45 + 1.35 * run) * g;
  [[L1, 0, -1], [R1, Math.PI, 1]].forEach(([leg, off, side]) => {
    const sf = Math.sin(ph + off), cf = Math.cos(ph + off);
    leg.hip.rotation.set(-sf * A * fl - 0.1 * run * g * Math.max(0, fl), 0, side * (0.035 + 0.03 * idle) + sl * sf * A * 0.8);
    leg.kn.rotation.x = 0.1 + 0.08 * idle + KN * Math.pow(Math.max(0, Math.cos(ph + off + 0.55)), 1.4) + 0.22 * g * Math.max(0, -cf);
    leg.ft.rotation.x = -0.08 - 0.22 * g * Math.max(0, sf) * Math.max(0, -cf + 0.3) + 0.6 * g * Math.max(0, -sf) * Math.max(0, cf + 0.2);
  });
  // тулуб: таз повертається за ногою, плечі — назустріч, нахил при розгоні й у поворотах
  const lean = 0.04 + 0.14 * run * amp + p.leanF * 0.22;
  m.body.position.set(Math.sin(t * 0.9) * 0.02 * idle, 0, 0);
  m.body.position.y = amp * (lerp(0.028 * (0.5 - Math.abs(s)), 0.05 * (Math.abs(s) - 0.5), run) - 0.025 * run);
  m.body.rotation.set(0, 0, -p.leanS * 0.28 + Math.sin(t * 0.9) * 0.025 * idle);
  m.hips.rotation.set(0.02, s * 0.12 * g, Math.cos(ph) * 0.05 * g + Math.sin(t * 0.9) * 0.03 * idle);
  m.torso.rotation.set(lean + Math.sin(t * 2.1) * 0.012 * idle, -s * 0.3 * g * fl, -Math.cos(ph) * 0.04 * g);
  // голова тримається рівно і стежить за м'ячем
  const ha = clamp(-angDiff(Math.atan2(ball.y - p.y, ball.x - p.x), p.face), -1.0, 1.0);
  p.headY = lerp(p.headY, ha * (0.35 + 0.65 * idle), 0.12);
  m.head.rotation.set(-lean * 0.7, p.headY, 0);
  // руки: мах протилежно ногам, лікті сильніше зігнуті під час бігу
  const AA = (0.22 + 0.62 * run) * g * Math.max(0.35, Math.abs(fl));
  LA.sh.rotation.set(s * AA, 0, -(0.11 + 0.08 * run + 0.05 * idle));
  RA.sh.rotation.set(-s * AA, 0, 0.11 + 0.08 * run + 0.05 * idle);
  LA.el.rotation.x = -(0.25 + 0.15 * idle + 1.05 * run * g + 0.3 * run * Math.max(0, -s));
  RA.el.rotation.x = -(0.25 + 0.15 * idle + 1.05 * run * g + 0.3 * run * Math.max(0, s));
  if (p.kickAnim > 0) {   // удар по м'ячу правою
    const k = 1 - p.kickAnim / 0.3;
    R1.hip.rotation.x = k < 0.4 ? lerp(0, 0.9, k / 0.4) : lerp(0.9, -1.3, (k - 0.4) / 0.6);
    R1.kn.rotation.x = k < 0.4 ? lerp(0.2, 1.4, k / 0.4) : lerp(1.4, 0.05, (k - 0.4) / 0.6);
    L1.hip.rotation.x = 0.15; L1.kn.rotation.x = 0.3;
    LA.sh.rotation.set(-0.4, 0, -0.7); RA.sh.rotation.set(0.5, 0, 0.4);
    m.hips.rotation.x = -0.1;
  } else if (p.touchAnim > 0) R1.hip.rotation.x -= 0.35 * (p.touchAnim / 0.18);
  if (p.jump > 0) {   // стрибок на удар головою
    const k = p.jump / 0.55; m.body.position.y = Math.sin(k * Math.PI) * 0.45;
    LA.sh.rotation.set(-0.6, 0, -0.8); RA.sh.rotation.set(-0.6, 0, 0.8);
    m.torso.rotation.x = -0.3 + (1 - k) * 0.6;
  }
  if (p.slide > 0) {  // підкат
    m.body.rotation.x = -1.15; m.body.position.y = 0.3;
    L1.hip.rotation.x = -0.4; R1.hip.rotation.x = -0.1; L1.kn.rotation.x = 0.9; R1.kn.rotation.x = 0.05;
    LA.sh.rotation.set(-0.5, 0, -1.0); RA.sh.rotation.set(-0.5, 0, 1.0);
  } else if (p.stun > 0 && p.fallen) {   // збитий з ніг
    m.body.rotation.x = 1.3; m.body.position.y = 0.22;
    LA.sh.rotation.set(-2.2, 0, -0.4); RA.sh.rotation.set(-2.2, 0, 0.4);
  }
  if (p.dive > 0) {   // стрибок воротаря вбік
    const k = clamp((0.7 - p.dive) / 0.22, 0, 1);
    const right = Math.cos(p.face) * p.diveDy;   // >0 — стрибок у праву від себе сторону
    m.body.rotation.z = (right > 0 ? -1 : 1) * 1.35 * k;
    m.body.position.y = Math.sin(k * Math.PI * 0.5) * 0.5;
    LA.sh.rotation.set(-2.9, 0, -0.2); RA.sh.rotation.set(-2.9, 0, 0.2);
    LA.el.rotation.x = -0.1; RA.el.rotation.x = -0.1;
    L1.hip.rotation.x = 0.2; R1.hip.rotation.x = -0.3;
  }
  if (state === 'goal' && p.team === lastGoalTeam && !p.gk) {
    LA.sh.rotation.set(-2.7, 0, -0.5); RA.sh.rotation.set(-2.7, 0, 0.5); LA.el.rotation.x = -0.2; RA.el.rotation.x = -0.2;
  }
  if (ball.owner === p && ball.held) { LA.sh.rotation.set(-1.2, 0, 0.25); RA.sh.rotation.set(-1.2, 0, -0.25); LA.el.rotation.x = -0.9; RA.el.rotation.x = -0.9; }
}

// ───────────────────────── Реалістичні гравці ─────────────────────────
// 3D-модель людини зі скелетом і анімаціями (Quaternius, ліцензія CC0), форма команд малюється шейдером
let HUMAN = null;
const LOCO = [['idle', 'Idle_Loop', 0], ['walk', 'Walk_Loop', 1.2], ['jog', 'Jog_Fwd_Loop', 2.8], ['sprint', 'Sprint_Loop', 5.0]];
const EXTRA = [['jump', 'Jump_Loop'], ['fall', 'Death01'], ['dance', 'Dance_Loop'], ['crouch', 'Crouch_Idle_Loop']];
function loadHumans() {
  if (!T3.GLTFLoader) return Promise.resolve(null);
  const gl = new T3.GLTFLoader(), tl = new T3.TextureLoader();
  // моделі лежать у assets/models.js (base64) — підвантажуємо скрипт і розбираємо
  const buf = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
  const parse = (b64) => new Promise((res, rej) => gl.parse(buf(b64), '', res, rej));
  const script = new Promise((res, rej) => {
    if (window.GOLEADOR_ASSETS) { res(); return; }
    const sc = document.createElement('script'); sc.src = 'assets/models.js?v=9'; sc.onload = res;
    sc.onerror = () => { const s2 = document.createElement('script'); s2.src = 'assets/models.js'; s2.onload = res; s2.onerror = rej; document.head.appendChild(s2); };
    document.head.appendChild(sc);
  });
  return script.then(() => { const A = window.GOLEADOR_ASSETS; return Promise.all([parse(A.player), parse(A.anims), parse(A.hair), tl.loadAsync(A.skin)]); })
    .then(([pl, an, hr, light]) => {
      let body = null, brows = null;
      pl.scene.traverse((o) => { if (o.isSkinnedMesh && o.name === 'SuperHero_Male') body = o; if (o.isSkinnedMesh && o.name === 'Eyebrows') brows = o; });
      computeKit(body);
      light.encoding = T3.sRGBEncoding; light.flipY = false; light.anisotropy = maxAniso;
      const dark = body.material.map; dark.anisotropy = maxAniso;
      const clips = {}; for (const c of an.animations) clips[c.name] = c;
      const hair = {}; hr.scene.traverse((o) => { if (o.isMesh) hair[o.name] = o; });
      HUMAN = { scene: pl.scene, bodyMat: body.material, browMat: brows && brows.material, dark, light, clips, hair };
      return HUMAN;
    })
    .catch((e) => { console.warn('Моделі гравців не завантажились, використовую прості', e); return null; });
}
// Для кожної вершини: яка частина форми її вкриває (футболка, шорти, гетри, бутси) — за висотою і кісткою в Т-позі
function computeKit(mesh) {
  const g = mesh.geometry, sk = mesh.skeleton, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const names = sk.bones.map((b) => b.name);
  const kit = new Float32Array(pos.count * 4), v = new T3.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let bi = si.getX(i), bw = sw.getX(i);
    if (sw.getY(i) > bw) { bw = sw.getY(i); bi = si.getY(i); }
    if (sw.getZ(i) > bw) { bw = sw.getZ(i); bi = si.getZ(i); }
    if (sw.getW(i) > bw) { bw = sw.getW(i); bi = si.getW(i); }
    const n = names[bi] || '', ax = Math.abs(v.x);
    let r = -1;
    if (/upperarm|lowerarm|hand|index|middle|pinky|ring|thumb/.test(n)) { if (ax < 0.4 && v.y > 1.3) r = 0; }     // короткий рукав
    else if (/neck|Head/.test(n)) r = -1;
    else if (v.y > 0.985 && v.y < 1.53) r = 0;          // футболка
    else if (v.y > 0.67 && v.y <= 0.985) r = 1;         // шорти
    else if (v.y > 0.105 && v.y < 0.475) r = 2;         // гетри
    else if (v.y <= 0.105) r = 3;                        // бутси
    if (r >= 0) kit[i * 4 + r] = 1;
  }
  g.setAttribute('kit', new T3.BufferAttribute(kit, 4));
}
const kitNumCache = {};
function kitNumTex(n, color) {
  const k = n + color; if (kitNumCache[k]) return kitNumCache[k];
  return (kitNumCache[k] = canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.font = '900 112px Arial Black, Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color; g.fillText(n, 64, 68);
  }));
}
function kitMaterial(p, cols) {
  const T = TEAMS[p.team] || TEAMS[0], m = HUMAN.bodyMat.clone();
  m.map = p.skinLight ? HUMAN.light : HUMAN.dark;
  m.roughness = 0.62; m.metalness = 0;
  m.color.set(p.skinTint);
  const col = (c) => ({ value: new T3.Color(c) });
  const u = {
    uShirt: col(cols ? cols.shirt : p.gk ? T.gk : T.shirt), uShorts: col(cols ? cols.shorts : p.gk ? 0x1d1d1d : T.shorts),
    uSocks: col(cols ? cols.socks : p.gk ? 0x1d1d1d : T.socks), uBoots: col(p.boot),
    uNum: { value: kitNumTex(cols ? '' : p.num, p.gk ? '#ffffff' : T.num) },
    uTrim: col(cols ? cols.shirt : p.gk ? T.gkTrim : T.trim), uDetail: { value: cols ? 0 : 1 },
    uStripe: col(!cols && !p.gk && T.stripe !== undefined ? T.stripe : 0), uStripeOn: { value: !cols && !p.gk && T.stripe !== undefined ? 1 : 0 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute vec4 kit;\nvarying vec4 vKit;\nvarying vec3 vBind;\nvarying vec3 vBindN;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvKit = kit; vBind = position; vBindN = normal;\ntransformed += normal * (0.02 * kit.x + 0.028 * kit.y + 0.005 * kit.z + 0.009 * kit.w);');
    sh.fragmentShader = 'uniform vec3 uShirt, uShorts, uSocks, uBoots, uTrim, uStripe;\nuniform float uDetail, uStripeOn;\nuniform sampler2D uNum;\nvarying vec4 vKit;\nvarying vec3 vBind;\nvarying vec3 vBindN;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float km = clamp(vKit.x + vKit.y + vKit.z + vKit.w, 0.0, 1.0);
        vec3 kc = (uShirt * vKit.x + uShorts * vKit.y + uSocks * vKit.z + uBoots * vKit.w) / max(km, 0.001);
        if (uStripeOn > 0.5 && vKit.x > 0.5 && abs(vBind.x) < 0.27 && fract(vBind.x * 7.0 + 0.25) < 0.5) kc = uStripe;
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        vec3 fab = kc * (0.93 + 0.12 * (lum - 0.45));
        if (uDetail > 0.5) {   // деталі форми: комір, манжети, смуги на шортах, номер спереду
          float ax = abs(vBind.x);
          if (vKit.x > 0.5 && vBind.y > 1.495 && ax < 0.13) fab = uTrim * 0.95;
          if (vKit.x > 0.5 && ax > 0.355) fab = uTrim * 0.95;
          if (vKit.y > 0.5 && abs(vBindN.x) > 0.72 && vBind.y > 0.72) fab = uTrim;
          if (vKit.z > 0.5 && vBind.y > 0.40) fab = uTrim;
          if (vBindN.z > 0.35 && vKit.x > 0.5) {
            vec2 fuv = vec2((vBind.x + 0.055) / 0.11, (vBind.y - 1.27) / 0.11);
            if (fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0) { vec4 nc = texture2D(uNum, fuv); fab = mix(fab, nc.rgb, nc.a); }
          }
        }
        if (vBindN.z < -0.2 && vKit.x > 0.5) {   // номер на спині
          vec2 nuv = vec2((0.15 - vBind.x) / 0.30, (vBind.y - 1.10) / 0.30);
          if (nuv.x > 0.0 && nuv.x < 1.0 && nuv.y > 0.0 && nuv.y < 1.0) { vec4 nc = texture2D(uNum, nuv); fab = mix(fab, nc.rgb, nc.a); }
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, fab, km);`)
      .replace('#include <normal_fragment_maps>', T3.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * (1.0 - 0.7 * clamp(vKit.x + vKit.y, 0.0, 1.0));'))
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, vKit.w > 0.5 ? 0.35 : 0.8, clamp(vKit.x + vKit.y + vKit.z + vKit.w, 0.0, 1.0));');
  };
  m.customProgramCacheKey = () => 'kit-v3';
  return m;
}
const hairMatCache = {};
function hairMat(src, color) {
  const k = src.uuid + color; if (hairMatCache[k]) return hairMatCache[k];
  const m = src.clone(); m.color.set(color); m.roughness = 0.75;
  return (hairMatCache[k] = m);
}
const _q1 = new T3.Quaternion(), _q2 = new T3.Quaternion(), _v1 = new T3.Vector3();
const AX_X = new T3.Vector3(1, 0, 0), AX_Y = new T3.Vector3(0, 1, 0), AX_Z = new T3.Vector3(0, 0, 1);
// повернути кістку навколо осі, заданої в системі координат моделі (а не самої кістки)
function boneRot(bone, axis, ang, model) {
  if (!ang) return;
  bone.parent.getWorldQuaternion(_q1); model.getWorldQuaternion(_q2);
  _q1.premultiply(_q2.invert());                     // поворот батька відносно моделі
  _v1.copy(axis).applyQuaternion(_q1.clone().invert());
  bone.quaternion.premultiply(new T3.Quaternion().setFromAxisAngle(_v1, ang));
}
function buildHumanModel(p) {
  const root = new T3.Group(), body = new T3.Group(); root.add(body);
  const g = T3.SkeletonUtils.clone(HUMAN.scene); body.add(g);
  const sc = p.height; g.scale.set(sc * p.build, sc, sc * (0.5 + p.build * 0.5));
  let bodyMesh = null;
  g.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    if (o.name === 'SuperHero_Male') { bodyMesh = o; o.material = kitMaterial(p); }
    if (o.name === 'Eyebrows' && HUMAN.browMat) o.material = hairMat(HUMAN.browMat, p.hair);
  });
  const sk = bodyMesh.skeleton, B = (n) => sk.getBoneByName(n);
  const head = B('Head');
  g.updateMatrixWorld(true);
  const toHead = head.matrixWorld.clone().invert().multiply(g.matrixWorld);
  const addHair = (name) => {
    const src = HUMAN.hair[name]; if (!src) return;
    const h = new T3.Mesh(src.geometry, hairMat(src.material, p.hair)); h.castShadow = true;
    h.matrixAutoUpdate = false; h.matrix.copy(toHead); head.add(h);
  };
  if (p.hairStyle === 1) addHair('Hair_Buzzed'); else if (p.hairStyle === 2) addHair('Hair_SimpleParted');
  if (p.beard) addHair('Hair_Beard');
  const mixer = new T3.AnimationMixer(g), act = {};
  for (const [k, n] of [...LOCO, ...EXTRA]) {
    const c = HUMAN.clips[n]; if (!c) continue;
    const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); act[k] = a;
    if (k !== 'idle' && LOCO.some((l) => l[0] === k)) a.timeScale = 0;
  }
  if (act.fall) { act.fall.setLoop(T3.LoopOnce); act.fall.clampWhenFinished = true; }
  act.idle.time = Math.random() * 2;
  scene.add(root);
  return { human: true, root, body, g, mixer, act, gph: Math.random(), w: { idle: 1 }, bones: {
    head, neck: B('neck_01'), spine: B('spine_02'), spine3: B('spine_03'), pelvis: B('pelvis'),
    thighR: B('thigh_r'), calfR: B('calf_r'), footR: B('foot_r'), thighL: B('thigh_l'), calfL: B('calf_l'),
    armL: B('upperarm_l'), armR: B('upperarm_r'), foreL: B('lowerarm_l'), foreR: B('lowerarm_r'),
  } };
}
const ramp = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
function animateHuman(p, dt) {
  const m = p.model, sp = hyp(p.vx, p.vy), A = m.act, Bn = m.bones;
  m.root.position.copy(V(p.x, p.y, 0));
  m.root.rotation.y = Math.atan2(Math.cos(p.face), Math.sin(p.face));
  m.body.rotation.set(0, 0, 0); m.body.position.set(0, 0, 0);
  const fx = Math.cos(p.face), fy = Math.sin(p.face);
  const fl = sp > 0.3 ? (p.vx * fx + p.vy * fy) / sp : 1;
  // суміш циклів: стійка → хода → біг → спринт, кроки синхронізовані зі швидкістю
  const s = sp * (0.55 + 0.45 * Math.abs(fl));
  const tw = { idle: 1 - ramp(s, 0.15, 0.9), walk: ramp(s, 0.15, 0.9) * (1 - ramp(s, 1.8, 3.0)), jog: ramp(s, 1.8, 3.0) * (1 - ramp(s, 5.0, 6.6)), sprint: ramp(s, 5.0, 6.6) };
  let special = null;
  if (p.stun > 0 && p.fallen) special = 'fall';
  else if (p.jump > 0) special = 'jump';
  else if (state === 'goal' && p.team === lastGoalTeam && !p.gk && sp < 2.5) special = 'dance';
  else if (p.slide > 0 || p.dive > 0) special = 'crouch';
  const k = dt > 0 ? Math.min(1, dt * 10) : 1;
  let rate = 0;
  for (const [key, , native] of LOCO) {
    const a = A[key]; if (!a) continue;
    const target = special ? 0 : tw[key];
    m.w[key] = lerp(m.w[key] || 0, target, k);
    a.setEffectiveWeight(m.w[key]);
    if (native) rate += tw[key] * clamp(sp / native, 0.6, 1.75) / a.getClip().duration;
  }
  m.gph += rate * dt * (fl < -0.2 ? -1 : 1);
  const ph = ((m.gph % 1) + 1) % 1;
  for (const [key, , native] of LOCO) if (native && A[key]) A[key].time = ph * A[key].getClip().duration;
  for (const [key] of EXTRA) {
    const a = A[key]; if (!a) continue;
    const on = special === key;
    if (on && (m.w[key] || 0) < 0.01) { a.reset(); a.play(); }
    m.w[key] = lerp(m.w[key] || 0, on ? 1 : 0, Math.min(1, k * 1.5));
    a.setEffectiveWeight(m.w[key]);
  }
  m.mixer.update(dt);
  // поверх анімації — удар по м'ячу, погляд на м'яч, нахили
  const md = m.g;
  if (p.kickAnim > 0) {
    const t = 1 - p.kickAnim / 0.3;
    const hip = t < 0.4 ? lerp(0, 0.9, t / 0.4) : lerp(0.9, -1.25, (t - 0.4) / 0.6);
    const knee = t < 0.4 ? lerp(0.2, 1.5, t / 0.4) : lerp(1.5, 0.05, (t - 0.4) / 0.6);
    const w = Math.min(1, Math.min(t, 1 - t) * 6 + 0.3);
    md.updateMatrixWorld(true);
    boneRot(Bn.thighR, AX_X, hip * w, md); md.updateMatrixWorld(true);
    boneRot(Bn.calfR, AX_X, knee * w * 0.8, md);
    boneRot(Bn.armL, AX_Z, 0.5 * w, md); boneRot(Bn.armR, AX_Z, -0.4 * w, md);
    boneRot(Bn.spine, AX_X, 0.12 * w, md);
  } else if (p.touchAnim > 0) {
    md.updateMatrixWorld(true);
    boneRot(Bn.thighR, AX_X, -0.4 * (p.touchAnim / 0.18), md);
  }
  if (!special) {
    const ha = clamp(-angDiff(Math.atan2(ball.y - p.y, ball.x - p.x), p.face), -1.1, 1.1);
    p.headY = lerp(p.headY, ha * (sp < 3 ? 0.9 : 0.4), dt > 0 ? Math.min(1, dt * 6) : 1);
    md.updateMatrixWorld(true);
    boneRot(Bn.neck, AX_Y, p.headY * 0.45, md); md.updateMatrixWorld(true);
    boneRot(Bn.head, AX_Y, p.headY * 0.55, md);
    m.body.rotation.set(p.leanF * 0.1, 0, -p.leanS * 0.22);
  }
  if (p.slide > 0) { m.body.rotation.x = -1.0; m.body.position.y = 0.25; }
  if (p.dive > 0) {
    const t = clamp((0.7 - p.dive) / 0.22, 0, 1), right = Math.cos(p.face) * p.diveDy;
    m.body.rotation.z = (right > 0 ? -1 : 1) * 1.35 * t;
    m.body.position.y = Math.sin(t * Math.PI * 0.5) * 0.45;
    md.updateMatrixWorld(true);
    boneRot(Bn.armL, AX_Z, 1.2 * t, md); boneRot(Bn.armR, AX_Z, -1.2 * t, md);
  }
  if (p.jump > 0) m.body.position.y = Math.sin(p.jump / 0.55 * Math.PI) * 0.45;
  if (ball.owner === p && ball.held) {
    md.updateMatrixWorld(true);
    boneRot(Bn.armL, AX_X, -1.1, md); boneRot(Bn.armR, AX_X, -1.1, md);
  }
}

// ── М'яч
let ballMesh;
function buildBall() {
  const tex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#fafafa'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1c1f26';
    const pent = [];
    for (let i = 0; i < 5; i++) { pent.push([i / 5, 0.3]); pent.push([(i + 0.5) / 5, 0.7]); }
    g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
    for (const [u, v] of pent) for (const shift of [-w, 0, w]) {
      g.beginPath();
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g.lineTo(u * w + shift + Math.cos(a) * 30, v * h + Math.sin(a) * 24); }
      g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2;
    for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(i * w / 10, h * 0.3); g.lineTo(i * w / 10 + w / 20, h * 0.7); g.stroke(); }
  });
  ballMesh = new T3.Mesh(new T3.SphereGeometry(BALL_R * BALL_VIS, 24, 18), new T3.MeshStandardMaterial({ map: tex, roughness: 0.35 }));
  ballMesh.castShadow = true;
  scene.add(ballMesh);
}

// Маркер обраного гравця
const ctrlRing = new T3.Mesh(new T3.RingGeometry(0.55, 0.7, 40), new T3.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9, depthWrite: false }));
ctrlRing.rotation.x = -Math.PI / 2; ctrlRing.renderOrder = 2;
const ctrlArrow = new T3.Mesh(new T3.ConeGeometry(0.14, 0.32, 3), new T3.MeshBasicMaterial({ color: 0xffe14d }));
ctrlArrow.rotation.x = Math.PI;
const aimGeo = new T3.ConeGeometry(0.18, 0.5, 3); aimGeo.rotateX(Math.PI / 2);   // вістря у +z
const aimArrow = new T3.Mesh(aimGeo, new T3.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.85, depthWrite: false }));
scene.add(ctrlRing, ctrlArrow, aimArrow);

// ───────────────────────── Звук ─────────────────────────
const Sound = {
  ac: null, master: null, crowd: null, muted: false, noise: null,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const ac = this.ac;
    this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.7; this.master.connect(ac.destination);
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.4;
    this.crowd = ac.createGain(); this.crowd.gain.value = 0.05;
    src.connect(bp); bp.connect(this.crowd); this.crowd.connect(this.master); src.start();
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.7; },
  crowdTo(v, t = 0.6) { if (!this.ac) return; const g = this.crowd.gain, n = this.ac.currentTime; g.cancelScheduledValues(n); g.setValueAtTime(g.value, n); g.linearRampToValueAtTime(v, n + t); },
  kick(power) {
    if (!this.ac || demo) return; const ac = this.ac, n = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(150, n); o.frequency.exponentialRampToValueAtTime(45, n + 0.12);
    g.gain.setValueAtTime(0.2 + power * 0.5, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.15);
    o.connect(g); g.connect(this.master); o.start(n); o.stop(n + 0.16);
    const s = ac.createBufferSource(); s.buffer = this.noise; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500;
    const g2 = ac.createGain(); g2.gain.setValueAtTime(0.12 + power * 0.3, n); g2.gain.exponentialRampToValueAtTime(0.001, n + 0.05);
    s.connect(f); f.connect(g2); g2.connect(this.master); s.start(n, Math.random()); s.stop(n + 0.06);
  },
  whistle(kind = 1) {
    if (!this.ac || demo) return; const ac = this.ac;
    const blasts = kind === 3 ? [0, 0.45, 0.9] : [0];
    const dur = kind >= 2 ? 0.55 : 0.28;
    for (const off of blasts) {
      const n = ac.currentTime + off;
      const g = ac.createGain(); g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(0.12, n + 0.02); g.gain.setValueAtTime(0.12, n + dur - 0.05); g.gain.linearRampToValueAtTime(0, n + dur);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 28; lg.gain.value = 120; lfo.connect(lg);
      for (const fr of [2800, 3050]) { const o = ac.createOscillator(); o.frequency.value = fr; lg.connect(o.frequency); o.connect(g); o.start(n); o.stop(n + dur); }
      lfo.start(n); lfo.stop(n + dur); g.connect(this.master);
    }
  },
  clang() {
    if (!this.ac || demo) return; const ac = this.ac, n = ac.currentTime;
    for (const fr of [880, 1320, 2100]) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = fr; g.gain.setValueAtTime(0.12, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.6); o.connect(g); g.connect(this.master); o.start(n); o.stop(n + 0.6); }
  },
  goal() { this.crowdTo(0.4, 0.3); setTimeout(() => this.crowdTo(0.07, 3.5), 1200); },
};

// ───────────────────────── Стан гри ─────────────────────────
const STATS = { shots: 0, passes: 0, tackles: 0, headers: 0 };   // лічильники для тестів
const settings = { diff: 'normal', mins: 4, home: 0, away: 1 };
let players = [], ball = null, state = 'kickoff', stateT = 0;
let score = [0, 0], clock = 0, matchLen = 240, humanTeam = -1, ctrl = null, demo = true, paused = false;
let possTeam = 0, kickoffTeam = 0, passTarget = null, setpiece = null, lastGoalTeam = 0;
let charge = 0, charging = false, autoSwT = 0, camMode = 0, lastInput = { dx: 0, dy: 0 };

function makePlayers() {
  for (const p of players) scene.remove(p.model.root);
  players = [];
  for (let t = 0; t < 2; t++) FORM.forEach((f, i) => {
    const p = {
      team: t, i, role: f.r, gk: f.r === 'GK', num: NUMS[i],
      x: 0, y: 0, vx: 0, vy: 0, tvx: 0, tvy: 0, face: 0, phase: rand(0, 6), sprint: false, amp: 0, leanF: 0, leanS: 0, headY: 0, pace: rand(0.93, 1.06),
      kickCd: 0, stun: 0, slide: 0, dive: 0, diveDy: 0, tackleCd: 0, saveCd: 0, kickAnim: 0, touchAnim: 0, touchCd: 0, jump: 0, holdT: 0,
      jx: rand(-2, 2), jy: rand(-2, 2), jT: rand(2, 5), decT: 0, locked: false, pending: null, fallen: false, react: 0, read: 0,
      skin: SKINS[(Math.random() * SKINS.length) | 0], hair: HAIRS[(Math.random() * HAIRS.length) | 0],
      boot: [0x111111, 0xf2f2f2, 0xff5a1f, 0x2ad1ff, 0xffd34d][(Math.random() * 5) | 0], hairStyle: Math.random() < 0.12 ? 0 : Math.random() < 0.4 ? 2 : 1,
      beard: Math.random() < 0.3, skinLight: Math.random() < 0.6, skinTint: [0xffffff, 0xf3e3d6, 0xffeee0, 0xd9b8a0, 0xb08a70, 0x8a6650][(Math.random() * 6) | 0], height: rand(0.9, 0.98), build: rand(0.9, 1.1),
    };
    p.model = HUMAN ? buildHumanModel(p) : buildPlayerModel(p);
    players.push(p);
  });
  // імена: у кожної команди свої, без повторів
  const pool = SURNAMES.slice().sort(() => Math.random() - 0.5);
  players.forEach((p, k) => (p.name = pool[k % pool.length]));
  nameLayer.innerHTML = '';
  for (const p of players) {
    const el = document.createElement('div');
    el.className = 'pname'; el.textContent = p.name;
    nameLayer.appendChild(el); p.tag = el; p.tagOn = false;
  }
}
const nameLayer = document.getElementById('names');
function updateNames() {
  const show = !demo && state !== 'goal' && humanTeam >= 0;
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  const vis = [];
  for (const p of players) {
    let on = show && (p === ctrl || p === passTarget || p === ball.owner || ballDist(p) < 14);
    if (on) {
      tmpV.copy(V(p.x, p.y, 2.12 * (p.height || 0.94))).project(camera);
      on = tmpV.z < 1 && Math.abs(tmpV.x) < 0.95 && Math.abs(tmpV.y) < 0.92;
      if (on) vis.push({ p, x: (tmpV.x + 1) / 2 * w, y: (1 - tmpV.y) / 2 * h, me: p === ctrl });
    }
    if (on !== p.tagOn) { p.tag.style.display = on ? 'block' : 'none'; p.tagOn = on; }
  }
  // підписи не налазять один на одного: свій гравець — на місці, інші піднімаються вище
  vis.sort((a, b) => (b.me - a.me) || (b.y - a.y));
  const lh = w < 900 ? 13 : 15;
  for (let i = 0; i < vis.length; i++) {
    const a = vis[i], aw = a.p.name.length * (lh * 0.55) + 8;
    for (let j = 0; j < i; j++) {
      const b = vis[j], bw = b.p.name.length * (lh * 0.55) + 8;
      if (Math.abs(a.x - b.x) < (aw + bw) / 2 && Math.abs(a.y - b.y) < lh) a.y = b.y - lh;
    }
    a.p.tag.style.transform = `translate(${a.x | 0}px,${a.y | 0}px) translate(-50%,-100%)`;
    a.p.tag.classList.toggle('me', a.me);
  }
}
function newBall(x, y) {
  ball = { x, y, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, top: 0, px: x, py: y, pz: 0, owner: null, held: false, protected: false, protT: 0, protX: x, protY: y, last: null, lastTeam: 0, grace: 0, inGoal: -1, q: new T3.Quaternion() };
}

const bannerEl = document.getElementById('banner');
let bannerT = 0;
function showBanner(text, sub = '', dur = 1.6, big = false) {
  bannerEl.querySelector('.b-main').textContent = text;
  bannerEl.querySelector('.b-sub').textContent = sub;
  bannerEl.classList.toggle('big', big);
  bannerEl.classList.remove('show'); void bannerEl.offsetWidth; bannerEl.classList.add('show');
  bannerT = dur;
}

function setupKickoff(team) {
  players.forEach((p) => {
    const f = FORM[p.i];
    let lx = Math.min(f.x, 46), ly = f.y;
    if (p.team === team && p.role === 'FW') { lx = L / 2 - 0.5; ly = W / 2; }
    if (p.team === team && p.i === 4) { lx = L / 2 - 8; ly = W / 2 - 7; }
    if (p.team !== team && p.role === 'FW') lx = L / 2 - 10;
    const [x, y] = toW(p.team, lx, ly);
    Object.assign(p, { x, y, vx: 0, vy: 0, tvx: 0, tvy: 0, stun: 0, slide: 0, dive: 0, jump: 0, locked: false, kickCd: 0, pending: null, fallen: false, face: TEAMS[p.team].dir > 0 ? 0 : Math.PI });
  });
  newBall(L / 2, W / 2);
  ball.lastTeam = team; possTeam = team; kickoffTeam = team; passTarget = null;
  state = 'kickoff'; stateT = 1.3;
  for (const n of nets) n.disp.fill(0);
  if (humanTeam >= 0) ctrl = humanTeam === team ? players.find((p) => p.team === team && p.role === 'FW') : players.find((p) => p.team === humanTeam && p.i === 4);
}
function applyClubs() {
  TEAMS[0] = { ...CLUBS[settings.home], dir: 1 }; TEAMS[1] = { ...CLUBS[settings.away], dir: -1 };
  const bt = document.querySelectorAll('#board .b-team');
  if (bt.length === 2) {
    bt[0].innerHTML = `<i style="background:${TEAMS[0].css}"></i>${TEAMS[0].short}`;
    bt[1].innerHTML = `${TEAMS[1].short}<i style="background:${TEAMS[1].css}"></i>`;
  }
  if (screens.drawBand) screens.drawBand();
}
function startMatch(isDemo) {
  applyClubs();
  demo = isDemo; humanTeam = isDemo ? -1 : 0; ctrl = null;
  score = [0, 0]; clock = 0; matchLen = isDemo ? 1e9 : settings.mins * 60;
  makePlayers(); setupKickoff(Math.random() < 0.5 ? 0 : 1);
  if (!isDemo) { showBanner('ПОЧАТОК МАТЧУ', `${TEAMS[0].name} — ${TEAMS[1].name}`, 1.8); Sound.crowdTo(0.07); }
}

// ───────────────────────── Допоміжні ─────────────────────────
const D = () => DIFF[settings.diff];
const isAI = (p) => humanTeam >= 0 && p.team !== humanTeam;
function spdMul(p) { const k = p.pace || 1; if (humanTeam < 0) return k; return (p.team === humanTeam ? 0.97 : D().speed) * k; }
function gkSkill(gk) { return isAI(gk) ? D().gk : 0.72; }
function oppGoalX(t) { return TEAMS[t].dir > 0 ? L : 0; }
function ownGoalX(t) { return TEAMS[t].dir > 0 ? 0 : L; }
function inOwnBox(t, x, y) { const [lx, ly] = toL(t, x, y); return lx < 16.5 && lx > -1 && Math.abs(ly - W / 2) < 20.16; }
function nearestOpp(p) { let best = null, bd = 1e9; for (const o of players) if (o.team !== p.team) { const d = hyp(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } } return { o: best, d: bd }; }
const ballDist = (p) => hyp(ball.x - p.x, ball.y - p.y);

function moveTo(p, tx, ty, speed, arrive = 2) {
  const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
  if (d < 0.2) { p.tvx = p.tvy = 0; return; }
  const s = speed * Math.min(1, d / arrive);
  p.tvx = dx / d * s; p.tvy = dy / d * s; p.sprint = s > 7;
}
function keepAway(p, tx, ty) {
  const guard = (ball.protected && ball.owner && ball.owner.team !== p.team) || (state === 'setpiece' && setpiece && setpiece.team !== p.team);
  if (guard) { const dx = tx - ball.x, dy = ty - ball.y, d = hyp(dx, dy) || 1; if (d < 8) return [ball.x + dx / d * 8, ball.y + dy / d * 8]; }
  return [tx, ty];
}

function giveBall(p, cushion = true) {
  ball.owner = p; ball.held = p.gk && inOwnBox(p.team, p.x, p.y) && inOwnBox(p.team, ball.x, ball.y);
  ball.last = p; ball.lastTeam = p.team; possTeam = p.team; ball.inGoal = -1;
  if (cushion) {   // перший дотик гасить швидкість м'яча
    ball.vx = p.vx + (ball.vx - p.vx) * 0.12; ball.vy = p.vy + (ball.vy - p.vy) * 0.12; ball.vz = Math.min(ball.vz, 0) * 0.2; ball.spin = 0; ball.top = 0;
  }
  passTarget = null; p.holdT = 0; ball.grace = 0.45; p.touchCd = 0.1; p.pending = null;
  p.decT = isAI(p) ? D().react * rand(0.6, 1.2) : rand(0.15, 0.3);
  if (humanTeam === p.team && !p.gk) ctrl = p;
}
function canKick(p) { return (ball.owner === p && (ball.held || (ballDist(p) < 2.0 && ball.z < 0.9))) || (ballDist(p) < 1.3 && ball.z < 0.9); }
function tryKick(p, fn) { if (canKick(p)) fn(); else p.pending = { fn, t: 0.5 }; }

function kickBall(p, vx, vy, vz, spin = 0, top = 0) {
  if (ball.held) ball.z = 1.0;
  ball.owner = null; ball.held = false; ball.protected = false;
  ball.vx = vx; ball.vy = vy; ball.vz = vz; ball.spin = spin; ball.top = top; ball.z = Math.max(ball.z, 0.02);
  p.kickCd = 0.3; p.kickAnim = 0.3; p.pending = null; ball.last = p; ball.lastTeam = p.team;
  players.forEach((q) => (q.locked = false));
  const sp = hyp(vx, vy);
  if (sp > 14) {   // воротар суперника реагує із запізненням і може помилитися
    const gk = players.find((q) => q.gk && q.team !== p.team), sk = gkSkill(gk);
    gk.react = 0.16 + (1 - sk) * 0.4; gk.read = rand(-1, 1) * (1 - sk) * 3.4;
  }
  Sound.kick(clamp(sp / 32, 0, 1));
}
// Скільки пролетить м'яч до першого торкання землі (з опором повітря)
function carry(vh, vz) {
  let x = 0, z = 0.02, h = vh, v = vz; const dt = 1 / 60;
  for (let i = 0; i < 400; i++) { const s = hyp(h, v); h -= AIR_K * s * h * dt; v -= (G + AIR_K * s * v) * dt; x += h * dt; z += v * dt; if (z <= 0) return x; }
  return x;
}
function rollDist(v) { const a = ROLL_A, c = ROLL_C; return v / a - c / (a * a) * Math.log(1 + a * v / c); }
function groundSpeedFor(d) { let lo = 2, hi = 40; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (rollDist(m) < d) lo = m; else hi = m; } return lo; }
function loftSpeedFor(d, vz) { let lo = 2, hi = 45; for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (carry(m, vz) < d) lo = m; else hi = m; } return lo; }

function kickTo(p, tx, ty, speed, vz, spin = 0) {
  const dx = tx - ball.x, dy = ty - ball.y, d = hyp(dx, dy) || 1;
  kickBall(p, dx / d * speed, dy / d * speed, vz, spin);
}
function passTo(p, t, forceLoft = false) {
  STATS.passes++;
  const d0 = hyp(t.x - ball.x, t.y - ball.y);
  let lane = 99;
  for (const o of players) if (o.team !== p.team) lane = Math.min(lane, distSeg(o.x, o.y, ball.x, ball.y, t.x, t.y));
  const loft = forceLoft || d0 > 30 || (lane < 1.3 && d0 > 9);
  // пас на хід: м'яч іде трохи попереду партнера і доходить до нього ще з запасом швидкості
  const gs = (d) => clamp(groundSpeedFor(d * 1.5 + 4), 9, 30);
  let vz = 0, tt;
  if (!loft) tt = d0 / (gs(d0) * 0.8);
  else { vz = clamp(d0 * 0.2, 5, 11); tt = 2 * vz / G; }
  const lead = Math.min(tt, 1.6) * 0.75;
  const tx = clamp(t.x + t.vx * lead, 1, L - 1), ty = clamp(t.y + t.vy * lead, 1, W - 1);
  const d1 = hyp(tx - ball.x, ty - ball.y);
  const speed = loft ? loftSpeedFor(d1 * 0.92, vz) : gs(d1);
  kickTo(p, tx, ty, speed, vz);
  passTarget = t; t.recvT = 0;
}
// Удар: aim −1..1 по ширині воріт, err — розкид, curl — закрут (м'яч летить дугою)
function shootAt(p, power, aim, err, curl = 0) {
  STATS.shots++;
  const dir = TEAMS[p.team].dir, gx = oppGoalX(p.team);
  const speed = 17 + power * 15;
  const tyGoal = W / 2 + aim * 3.2 + rand(-1, 1) * err;
  const gd = hyp(gx - ball.x, tyGoal - ball.y);
  const t = gd / (speed * (1 - AIR_K * speed * 0.35));
  const hgt = clamp(0.35 + power * 1.3 + rand(-0.6, 0.6) * (0.3 + power * 0.9 + err * 0.3), 0.1, 3.6);
  const vz = (hgt + 0.5 * G * t * t) / t;
  const spin = curl * (10 + power * 18);
  const lat = 0.5 * MAGNUS * spin * speed * t * t;
  const ux = (gx - ball.x) / gd, uy = (tyGoal - ball.y) / gd;
  // ціль зміщуємо протилежно до закруту, щоб дуга привела м'яч у кут
  kickTo(p, gx + dir * 0.3 + uy * lat, tyGoal - ux * lat, speed, vz, spin);
}
function bestPass(p, longOk) {
  let best = null, bs = -1e9;
  const [plx] = toL(p.team, p.x, p.y);
  const maxD = longOk ? 55 : 38;
  for (const t of players) {
    if (t.team !== p.team || t === p || t.gk) continue;
    const d = hyp(t.x - p.x, t.y - p.y);
    if (d < 4 || d > maxD) continue;
    let lane = 99, open = 8;
    for (const o of players) if (o.team !== p.team) { lane = Math.min(lane, distSeg(o.x, o.y, p.x, p.y, t.x, t.y)); open = Math.min(open, hyp(o.x - t.x, o.y - t.y)); }
    const [tlx] = toL(p.team, t.x, t.y);
    let s = (tlx - plx) * 0.13 + open * 0.28 + Math.min(lane, 4) * 0.3 - d * 0.025;
    if (lane < 2.0) s -= (2.0 - lane) * 1.4;   // суперник на лінії паса — ризиковано
    if (s > bs) { bs = s; best = { t, score: s }; }
  }
  return best;
}

// ───────────────────────── Керування ─────────────────────────
const keys = {}, pressed = {}, released = {};
const touch = { dx: 0, dy: 0, far: false, shoot: false, sprint: false, passPress: false, shootPress: false, shootRelease: false };
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyM') Sound.setMuted(!Sound.muted);
  if (e.code === 'KeyC') nextCam();
});
function nextCam() {
  if (demo) return;
  camMode = (camModeEff() + 1) % 3; camPicked = true;
  showBanner(['КАМЕРА: ТРАНСЛЯЦІЯ', 'КАМЕРА: ШИРОКИЙ ПЛАН', 'КАМЕРА: ЗА ГРАВЦЕМ'][camMode], '', 1.0);
}
window.addEventListener('keyup', (e) => { keys[e.code] = false; released[e.code] = true; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function readInput() {
  let dx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0) + touch.dx;
  let dy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0) + touch.dy;
  if (camModeEff() === 2 && humanTeam >= 0) {   // камера за гравцем: «вгору» = вперед
    const dir = TEAMS[humanTeam].dir; const ndx = -dy * dir, ndy = dx * dir; dx = ndx; dy = ndy;
  }
  const m = hyp(dx, dy); if (m > 1) { dx /= m; dy /= m; }
  const inp = {
    dx, dy,
    sprint: !!(keys.ShiftLeft || keys.ShiftRight || keys.KeyL || touch.sprint || touch.far),
    passPress: !!(pressed.Space || pressed.KeyJ || pressed.KeyZ || touch.passPress),
    shootPress: !!(pressed.KeyK || pressed.KeyX || touch.shootPress),
    shootDown: !!(keys.KeyK || keys.KeyX || touch.shoot),
    shootRelease: !!(released.KeyK || released.KeyX || touch.shootRelease),
    throughPress: !!(pressed.KeyV || pressed.KeyI || touch.throughPress),
    crossPress: !!(pressed.KeyB || pressed.KeyU || touch.crossPress),
  };
  for (const k in pressed) delete pressed[k];
  for (const k in released) delete released[k];
  touch.passPress = touch.shootPress = touch.shootRelease = touch.throughPress = touch.crossPress = false;
  return inp;
}
function closestToBall(team, exclude) {
  let best = null, bd = 1e9;
  for (const p of players) if (p.team === team && !p.gk && p !== exclude) { const d = ballDist(p); if (d < bd) { bd = d; best = p; } }
  return best;
}
function humanControl(dt) {
  const inp = readInput(); lastInput = inp;
  if (!ctrl || ctrl.gk) ctrl = closestToBall(humanTeam);
  const p = ctrl;
  let sp = inp.sprint ? 8.6 : 6.6;
  if (ball.owner === p) sp *= 0.93;
  if (p.locked || state === 'kickoff' || (state === 'setpiece' && setpiece && setpiece.taker === p)) sp = 0;
  p.tvx = inp.dx * sp; p.tvy = inp.dy * sp; p.sprint = inp.sprint && hyp(inp.dx, inp.dy) > 0.3;
  if (p.pending && !inp.dx && !inp.dy) moveTo(p, ball.x, ball.y, 6.6, 0.4);   // підбігти до м'яча для удару
  if (passTarget === p && !ball.owner && !inp.dx && !inp.dy && state === 'play') aiReceive(p);   // партнер сам іде назустріч пасу
  if (state !== 'play') { charge = 0; charging = false; return; }
  if (ball.owner === p) {
    if (inp.passPress) { tryKick(p, () => humanPass(p, inp, false)); return; }
    if (inp.throughPress) { const i2 = { ...inp }; tryKick(p, () => humanThrough(p, i2)); return; }
    if (inp.crossPress) { const i2 = { ...inp }; tryKick(p, () => humanPass(p, i2, true)); return; }
    if (inp.shootPress) { charging = true; charge = 0.12; }
    if (charging && inp.shootDown) charge = Math.min(1, charge + dt / 0.85);
    if (charging && (inp.shootRelease || charge >= 1)) { const c = charge, i2 = { ...inp }; tryKick(p, () => humanShoot(p, c, i2)); charging = false; charge = 0; }
  } else {
    charging = false; charge = 0;
    if (inp.passPress) {
      if (!ball.owner && ballDist(p) < 1.6) { const i2 = { ...inp }; tryKick(p, () => humanPass(p, i2, false)); }   // пас в одне торкання
      else { const c = closestToBall(humanTeam, p); if (c) ctrl = c; }
    } else if (inp.throughPress || inp.crossPress) { const c = closestToBall(humanTeam, p); if (c) ctrl = c; }
    if (inp.shootPress) humanTackle(p, inp);
    autoSwT -= dt;
    if (autoSwT <= 0 && !(passTarget && !ball.owner && passTarget.team === humanTeam) && (!ball.owner || ball.owner.team !== humanTeam)) {
      autoSwT = 0.4;
      const c = closestToBall(humanTeam);
      if (c && c !== p && passTarget !== p && ballDist(p) > ballDist(c) + 4.5) ctrl = c;
    }
  }
}
function humanPass(p, inp, loft) {
  let ax = inp.dx, ay = inp.dy;
  if (!ax && !ay) { ax = Math.cos(p.face); ay = Math.sin(p.face); }
  const m = hyp(ax, ay); ax /= m; ay /= m;
  let best = null, bs = -1e9;
  for (const t of players) {
    if (t.team !== p.team || t === p) continue;
    const dx = t.x - p.x, dy = t.y - p.y, d = hyp(dx, dy);
    if (d < 2.5 || d > 50) continue;
    const c = (dx * ax + dy * ay) / d;
    if (c < -0.2) continue;
    let lane = 99, open = 9;
    for (const o of players) if (o.team !== p.team) { lane = Math.min(lane, distSeg(o.x, o.y, p.x, p.y, t.x, t.y)); open = Math.min(open, hyp(o.x - t.x, o.y - t.y)); }
    // головне — напрямок, куди вказали; далі — вільна лінія передачі й відкритість партнера
    const s = c * 4 - d * 0.03 - (t.gk ? 2.5 : 0) - Math.max(0, 1.6 - lane) * 1.2 + Math.min(open, 6) * 0.08;
    if (s > bs) { bs = s; best = t; }
  }
  if (!best) { kickTo(p, p.x + ax * 15, p.y + ay * 15, loft ? loftSpeedFor(14, 6) : groundSpeedFor(20), loft ? 6 : 0); return; }
  passTo(p, best, loft);   // керування перейде до партнера, коли він прийме м'яч
}
// пас на хід: м'яч іде у вільну зону перед партнером, ближче до чужих воріт
function humanThrough(p, inp) {
  const dir = TEAMS[p.team].dir;
  let ax = inp.dx, ay = inp.dy;
  if (!ax && !ay) { ax = dir; ay = 0; }
  const m = hyp(ax, ay); ax /= m; ay /= m;
  let best = null, bs = -1e9;
  for (const t of players) {
    if (t.team !== p.team || t === p || t.gk) continue;
    const dx = t.x - p.x, dy = t.y - p.y, d = hyp(dx, dy);
    if (d < 4 || d > 48) continue;
    const c = (dx * ax + dy * ay) / d;
    if (c < -0.1) continue;
    const s = c * 3 + dx * dir * 0.06 - d * 0.02;
    if (s > bs) { bs = s; best = t; }
  }
  if (!best) { kickTo(p, p.x + ax * 18, p.y + ay * 18, groundSpeedFor(24), 0); return; }
  STATS.passes++;
  const lead = clamp(hyp(best.x - p.x, best.y - p.y) * 0.3, 5, 11);
  const tx = clamp(best.x + dir * lead, 3, L - 3), ty = clamp(best.y + (W / 2 - best.y) * 0.15, 3, W - 3);
  const d1 = hyp(tx - ball.x, ty - ball.y);
  kickTo(p, tx, ty, clamp(groundSpeedFor(d1 * 1.1 + 2), 10, 28), 0);
  passTarget = best; best.recvT = 0;
}
function humanShoot(p, power, inp) {
  if (p.locked) { humanPass(p, inp, true); return; }
  const gx = oppGoalX(p.team), dir = TEAMS[p.team].dir;
  const fx = Math.cos(p.face), fy = Math.sin(p.face);
  const gdx = gx - p.x, gdy = W / 2 - p.y, gd = hyp(gdx, gdy);
  if ((fx * gdx + fy * gdy) / gd > 0.1 && gd < 45) {
    const aim = inp.dy !== 0 ? clamp(inp.dy * 1.4, -1, 1) : (p.y < W / 2 ? 0.8 : -0.8);
    const curl = clamp(-p.vy / 8, -1, 1) * dir * 0.8;   // біг уздовж воріт дає закрут
    shootAt(p, power, aim, 0.2 + power * 0.9 + gd * 0.022, curl);
  } else {
    kickTo(p, p.x + fx * 20, p.y + fy * 20, 14 + power * 14, 2 + power * 6);
  }
}
function humanTackle(p, inp) {
  const db = ballDist(p);
  if (!ball.owner && db < 1.8 && ball.z < 1.0 && p.kickCd <= 0) { const i2 = { ...inp }; tryKick(p, () => humanShoot(p, 0.75, i2)); return; }
  if (p.tackleCd > 0) return;
  const o = ball.owner;
  p.tackleCd = 0.75; p.slide = 0.45;
  const a = o ? Math.atan2(ball.y - p.y, ball.x - p.x) : p.face;
  p.vx = Math.cos(a) * 9; p.vy = Math.sin(a) * 9; p.face = a;
  if (o && o.team !== p.team && !ball.held && !ball.protected && db < 2.4) {
    if (Math.random() < 0.7) winTackle(p, o); else p.stun = 0.5;
  } else p.stun = 0.4;
}
function winTackle(p, o) {
  STATS.tackles++;
  ball.owner = null; ball.held = false;
  const a = Math.atan2(ball.y - p.y, ball.x - p.x) + rand(-0.6, 0.6), s = rand(3, 6);
  ball.vx = o.vx * 0.3 + Math.cos(a) * s; ball.vy = o.vy * 0.3 + Math.sin(a) * s; ball.vz = rand(0, 1.5);
  o.stun = 0.7; o.fallen = Math.random() < 0.55; o.kickCd = 0.7; p.kickCd = 0.05;
  ball.lastTeam = p.team; ball.last = p;
  Sound.kick(0.2);
}

// ───────────────────────── Штучний інтелект ─────────────────────────
function findChaser(t) {
  if (ball.held || state !== 'play') return null;
  const bx = ball.owner ? ball.x : ball.x + ball.vx * 0.35, by = ball.owner ? ball.y : ball.y + ball.vy * 0.35;
  let best = null, bd = 1e9;
  for (const p of players) if (p.team === t && !p.gk && p !== ctrl) { const d = hyp(p.x - bx, p.y - by); if (d < bd) { bd = d; best = p; } }
  if (best && ctrl && ctrl.team === t && hyp(ctrl.x - bx, ctrl.y - by) < bd) return null;
  return best;
}
function aiControl(dt) {
  if (state === 'kickoff') { for (const p of players) if (p !== ctrl) p.tvx = p.tvy = 0; return; }
  const owner = ball.owner;
  const chasers = [null, null];
  for (let t = 0; t < 2; t++) if (!owner || owner.team !== t) chasers[t] = findChaser(t);
  for (const p of players) {
    if (p === ctrl) continue;
    p.jT -= dt; if (p.jT <= 0) { p.jT = rand(2, 5); p.jx = rand(-2.5, 2.5); p.jy = rand(-2.5, 2.5); }
    p.sprint = false;
    if (p.stun > 0) { p.tvx = p.tvy = 0; continue; }
    if (p.gk) { aiGK(p, dt); continue; }
    if (owner === p) { aiCarrier(p, dt); continue; }
    if (setpiece && state === 'setpiece' && setpiece.taker === p) { p.tvx = p.tvy = 0; continue; }
    if (state === 'goal') { aiCelebrate(p); continue; }
    if (chasers[p.team] === p) { aiChase(p); continue; }
    if (passTarget === p && !owner) { aiReceive(p); continue; }
    aiPosition(p);
  }
}
function aiCelebrate(p) {
  const s = ball.last;
  if (p.team === lastGoalTeam && s && s.team === p.team) {
    if (s !== p) moveTo(p, s.x + p.jx * 0.4, s.y + p.jy * 0.4, 6, 2);
    else { const gx = oppGoalX(p.team); moveTo(p, gx - TEAMS[p.team].dir * 8, p.y < W / 2 ? 2 : W - 2, 7, 2); }
  } else { p.tvx *= 0.9; p.tvy *= 0.9; }
}
function aiChase(p) {
  let tx, ty;
  if (ball.owner) {
    const og = ownGoalX(p.team);
    tx = ball.x + ball.owner.vx * 0.2 + Math.sign(og - ball.x) * 0.5; ty = ball.y + ball.owner.vy * 0.2;
  } else {
    const d = ballDist(p), t = Math.min(1, d / 8) * 0.7;
    tx = ball.x + ball.vx * t; ty = ball.y + ball.vy * t;
  }
  [tx, ty] = keepAway(p, tx, ty);
  moveTo(p, tx, ty, 8.0 * spdMul(p), 0.6);
}
function aiReceive(p) {
  const sp = hyp(ball.vx, ball.vy);
  if (sp < 3 || ballDist(p) < 3.5) { moveTo(p, ball.x, ball.y, 7 * spdMul(p), 0.5); return; }
  const t = clamp(((p.x - ball.x) * ball.vx + (p.y - ball.y) * ball.vy) / (sp * sp), 0, 2);
  moveTo(p, ball.x + ball.vx * t * 0.85, ball.y + ball.vy * t * 0.85, 7 * spdMul(p), 0.8);
}
function aiPosition(p) {
  const [blx, bly] = toL(p.team, ball.x, ball.y);
  const att = possTeam === p.team;
  const f = FORM[p.i];
  let lx = f.x + (blx - 40) * 0.5 + (att ? 7 : -3);
  if (p.role === 'FW') lx += att ? 6 : 2;
  if (!att && p.role === 'DF') lx = Math.min(lx, blx - 3);
  if (!att && p.role === 'MF') lx = Math.min(lx, blx + 2);
  lx = clamp(lx, p.role === 'DF' ? 6 : 10, p.role === 'DF' ? 72 : 96);
  let ly = f.y + (bly - W / 2) * (p.role === 'FW' ? 0.45 : 0.32);
  lx += p.jx; ly = clamp(ly + p.jy, 3, W - 3);
  let [tx, ty] = toW(p.team, lx, ly);
  [tx, ty] = keepAway(p, tx, ty);
  const d = hyp(tx - p.x, ty - p.y);
  moveTo(p, tx, ty, (d > 8 ? 7.0 : 4.6) * spdMul(p), 3);
}
function aiGK(p, dt) {
  const gx = ownGoalX(p.team);
  if (ball.owner === p) {
    p.tvx = p.tvy = 0; p.holdT += dt;
    p.face = TEAMS[p.team].dir > 0 ? 0 : Math.PI;
    if (p.holdT > 1.2 && state === 'play') {
      const b = bestPass(p, true);
      if (b && b.score > 0.2) passTo(p, b.t);
      else kickTo(p, L / 2 + rand(-8, 8), rand(12, W - 12), loftSpeedFor(42, 12), 12);
    }
    return;
  }
  const bd = hyp(ball.x - gx, ball.y - W / 2);
  const off = clamp(bd * 0.12, 0.8, 4.2);
  const ang = Math.atan2(ball.y - W / 2, ball.x - gx);
  let tx = gx + Math.cos(ang) * off, ty = clamp(W / 2 + Math.sin(ang) * off, PT - 0.4, PB + 0.4);
  let speed = 6.5 * spdMul(p);
  const bsp = hyp(ball.vx, ball.vy);
  if (!ball.owner && (gx - ball.x) * ball.vx > 0 && bsp > 8) {
    const t = (p.x - ball.x) / ball.vx;
    if (t > 0 && t < 1.3) {
      const iy = ball.y + ball.vy * t + p.read;
      tx = p.x; ty = clamp(iy, PT - 1.2, PB + 1.2); speed = p.react > 0 ? 0 : 2.0 + 2.6 * gkSkill(p);
      if (Math.abs(iy - p.y) > 1.0 && p.dive <= 0 && p.react <= 0 && t < 0.55) { p.dive = 0.7; p.diveDy = Math.sign(iy - p.y); }
    }
  } else if (state === 'play' && inOwnBox(p.team, ball.x, ball.y) && (!ball.owner || ball.owner.team !== p.team)) {
    const myD = ballDist(p);
    const opp = nearestOpp({ team: p.team, x: ball.x, y: ball.y });
    if ((!ball.owner && bsp < 12 && myD < opp.d + 3) || (ball.owner && myD < 7)) { tx = ball.x; ty = ball.y; speed = 7.6; }
  }
  moveTo(p, tx, ty, speed, 1.2);
}
function aiCarrier(p, dt) {
  p.decT -= dt;
  const gx = oppGoalX(p.team);
  const [lx, ly] = toL(p.team, p.x, p.y);
  if (ball.protected) {
    p.tvx = p.tvy = 0;
    if (p.decT <= 0) { const b = bestPass(p, true); tryKick(p, () => (b ? passTo(p, b.t) : kickTo(p, gx, W / 2, 18, 4))); p.decT = 1; }
    return;
  }
  if (p.decT <= 0 && !p.pending) {
    p.decT = (isAI(p) ? D().react : 0.25) * rand(0.7, 1.3) + 0.15;
    const gd = hyp(gx - p.x, W / 2 - p.y);
    const pd = nearestOpp(p).d;
    if (lx > 70) {
      let c = gd < 12 ? 0.9 : gd < 18 ? 0.55 : gd < 26 ? 0.18 : 0;
      if (pd < 2.5) c += 0.15;
      if (lx > 99) c += 0.4;
      if (Math.random() < c) { tryKick(p, () => aiShoot(p)); return; }
    }
    const bp = bestPass(p, false);
    if (bp) {
      const prog = toL(p.team, bp.t.x, bp.t.y)[0] - lx;
      let c = pd < 2.2 ? 0.55 : pd < 3.5 ? 0.16 : 0.015;
      if (prog < -4 && pd > 2.2) c *= 0.3;
      if (bp.score > 2.2 && prog > 8) c += 0.12;
      if (lx > 95 && Math.abs(ly - W / 2) > 10) c += 0.6;
      if (Math.random() < c) { const t = bp.t; tryKick(p, () => passTo(p, t)); return; }
    }
  }
  let ax = gx - p.x, ay = W / 2 - p.y; const am = hyp(ax, ay) || 1; ax /= am; ay /= am;
  if (lx < 85) ay *= 0.45;
  for (const o of players) {
    if (o.team === p.team) continue;
    const dx = o.x - p.x, dy = o.y - p.y, d = hyp(dx, dy);
    if (d > 7 || d < 0.01 || dx * ax + dy * ay < 0) continue;
    const side = (dx * ay - dy * ax) > 0 ? 1 : -1;
    const w = (7 - d) / 7 * 1.6;
    ax += ay * side * w; ay += -ax * side * w * 0.5;
  }
  if (p.y < 4) ay += 0.8; if (p.y > W - 4) ay -= 0.8;
  const m = hyp(ax, ay) || 1;
  const sp = 6.3 * spdMul(p) * 0.93;
  p.tvx = ax / m * sp; p.tvy = ay / m * sp;
}
function aiShoot(p) {
  const acc = isAI(p) ? D().acc : 0.75;
  const aim = (Math.random() < 0.5 ? -1 : 1) * rand(0.45, 1);
  const curl = Math.random() < 0.4 ? -Math.sign(aim) * TEAMS[p.team].dir * rand(0.3, 0.9) : 0;
  shootAt(p, rand(0.55, 1), aim, (1 - acc) * 5 + rand(0, 0.8), curl);
}

// ───────────────────────── Фізика гравців ─────────────────────────
function movePlayers(dt) {
  for (const p of players) {
    p.kickCd -= dt; p.react -= dt; p.stun -= dt; p.slide -= dt; p.dive -= dt; p.tackleCd -= dt; p.saveCd -= dt; p.kickAnim -= dt; p.touchAnim -= dt; p.jump -= dt;
    if (p.stun <= 0) p.fallen = false;
    if (p.pending) { p.pending.t -= dt; if (state === 'play' && canKick(p)) { const f = p.pending.fn; p.pending = null; f(); } else if (p.pending.t <= 0) p.pending = null; }
    let tvx = p.tvx, tvy = p.tvy;
    // власник м'яча, який відкотився, спершу біжить до м'яча, щоб зробити наступний дотик
    if (ball.owner === p && !ball.held && !ball.protected) {
      const bx = ball.x - p.x, by = ball.y - p.y, bd = hyp(bx, by), ts = hyp(tvx, tvy);
      if (bd > 1.9 && ts > 0.5) {
        const w = clamp((bd - 1.9) / 0.8, 0, 0.6);
        let nx = lerp(tvx / ts, bx / bd, w), ny = lerp(tvy / ts, by / bd, w); const nm = hyp(nx, ny) || 1;
        tvx = nx / nm * ts; tvy = ny / nm * ts;
      }
    }
    // інерція: обмежене прискорення, гальмування сильніше, на швидкості важче різко повертати
    let acc = p === ctrl ? 17 : 11;   // гравець, яким керуєте, відгукується швидше
    if (p.stun > 0) { tvx = 0; tvy = 0; acc = p.slide > 0 ? 6 : 10; }
    if (p.dive > 0) { acc = 22; tvx = 0; tvy = p.diveDy * 6.5; }
    const sp = hyp(p.vx, p.vy), tsp = hyp(tvx, tvy);
    if (tsp < sp) acc = Math.max(acc, 14);
    if (sp > 6 && tsp > 0.1 && Math.abs(angDiff(Math.atan2(tvy, tvx), Math.atan2(p.vy, p.vx))) > 1.4) acc *= 0.85;
    let dvx = tvx - p.vx, dvy = tvy - p.vy; const dv = hyp(dvx, dvy), lim = acc * dt;
    if (dv > lim) { dvx *= lim / dv; dvy *= lim / dv; }
    p.vx += dvx; p.vy += dvy;
    {   // для анімації: нахил при розгоні та в поворотах
      const fx = Math.cos(p.face), fy = Math.sin(p.face), kk = Math.min(1, dt * 7);
      p.leanF += (clamp((dvx * fx + dvy * fy) / dt / 14, -1, 1) - p.leanF) * kk;
      p.leanS += (clamp((dvx * fy - dvy * fx) / dt / 14, -1, 1) * Math.min(1, sp / 5) - p.leanS) * kk;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const nsp = hyp(p.vx, p.vy);
    if (p.stun <= 0 && p.dive <= 0) {
      let tf = null;
      // без м'яча на невеликій швидкості гравці дивляться на м'яч і переступають боком чи спиною
      const watch = ball.owner !== p && p !== ctrl && (p.gk || nsp < 4.2) && state !== 'goal';
      if (watch) tf = Math.atan2(ball.y - p.y, ball.x - p.x);
      else if (nsp > 0.5) tf = Math.atan2(p.vy, p.vx);
      if (tf !== null) p.face += angDiff(tf, p.face) * Math.min(1, dt * (p === ctrl ? 22 : nsp > 6 ? 9 : 12));
    }
    p.amp += (Math.min(1, nsp / 7.5) - p.amp) * Math.min(1, dt * 8);
    if (nsp > 0.25) p.phase += (4.6 + nsp * 0.68) * dt;   // темп кроків: ходьба ~1.7, спринт ~3 кроки/с
    p.x = clamp(p.x, -4.5, L + 4.5); p.y = clamp(p.y, -4.5, W + 4.5);
  }
  for (const p of players) goalBlock(p);
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i], b = players[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
    if (d < 0.7 && d > 0.001) { const push = (0.7 - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; }
  }
}

// Ворота — перешкода: зайти можна лише спереду, крізь бокову й задню сітку не пробігти
function goalBlock(p) {
  const R = 0.35;
  if (!p.gd) { p.gd = [-p.x, p.x - L]; p.gin = -1; }
  for (let side = 0; side < 2; side++) {
    const gx = side ? L : 0, out = side ? 1 : -1, d = (p.x - gx) * out, prev = p.gd[side];
    p.gd[side] = d;
    if (d <= 0) { if (p.gin === side) p.gin = -1; continue; }
    if (prev <= 0 && d < 1.0 && p.y > PT && p.y < PB) p.gin = side;   // зайшов у ворота спереду
    if (p.gin === side) {                                   // усередині — сітка не випускає
      p.y = clamp(p.y, PT + R, PB - R);
      if (d > GOAL_D - R) p.x = gx + out * (GOAL_D - R);
      continue;
    }
    if (d > GOAL_D + R || p.y < PT - R || p.y > PB + R) continue;
    // зовні впритул до сітки — відсунути до найближчої сторони
    const toT = p.y - (PT - R), toB = (PB + R) - p.y, toBack = (GOAL_D + R) - d;
    const m = Math.min(toT, toB, toBack);
    if (m === toBack) p.x = gx + out * (GOAL_D + R);
    else if (m === toT) p.y = PT - R;
    else p.y = PB + R;
    p.gd[side] = (p.x - gx) * out;
  }
}

// ───────────────────────── Фізика м'яча ─────────────────────────
// Дриблінг: м'яч котиться перед гравцем у напрямку бігу; м'яко «тягнеться» до точки перед ногою
function dribble(o, dt) {
  const b = ball;
  const sp = hyp(o.vx, o.vy);
  let fx, fy;
  if (sp > 0.8) { fx = o.vx / sp; fy = o.vy / sp; } else { fx = Math.cos(o.face); fy = Math.sin(o.face); }
  // м'яч біля ніг; на кожному дотику трохи відкочується вперед, на прискоренні — далі
  const lead = 0.4 + (o.sprint ? 0.32 : 0.06) + sp * 0.025 + Math.max(0, o.touchAnim) / 0.18 * (o.sprint ? 0.45 : 0.25);
  const tx = o.x + fx * lead, ty = o.y + fy * lead;
  const d = hyp(b.x - o.x, b.y - o.y);
  o.touchCd -= dt;
  if (b.protected) { b.x = lerp(b.x, tx, 0.3); b.y = lerp(b.y, ty, 0.3); b.vx = b.vy = 0; return; }
  if (d > 3.0 || b.z > 1.4) { b.owner = null; return; }   // м'яч утік — тепер він нічий
  if (o.stun > 0 || b.z > 0.45) return;
  // бажана швидкість м'яча: швидкість гравця + поправка до точки перед ним
  const k = o.sprint ? 10 : 15;
  const wx = o.vx + clamp((tx - b.x) * k * 0.65, -5, 5), wy = o.vy + clamp((ty - b.y) * k * 0.65, -5, 5);
  const bl = 1 - Math.exp(-k * dt);
  b.vx += (wx - b.vx) * bl; b.vy += (wy - b.vy) * bl;
  if (b.z < 0.05) b.vz = 0;
  b.spin *= 0.8; b.top = 0;
  if (o.touchCd <= 0 && sp > 1.2) { o.touchAnim = 0.18; o.touchCd = clamp(0.62 - sp * 0.035, 0.32, 0.62); }
}
function postHit(v, bar) { if (v > 3) { Sound.clang(); if (state === 'play' && !demo) showBanner(bar ? 'ПОПЕРЕЧИНА!' : 'ШТАНГА!', '', 1.0); } }
function collidePosts(b) {
  const r = POST_R + BALL_R;
  for (const gx of [0, L]) {
    for (const py of [PT, PB]) {
      if (b.z > GOAL_H + r) continue;
      const dx = b.x - gx, dy = b.y - py, d = hyp(dx, dy);
      if (d < r && d > 1e-4) {
        const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= 1.65 * vn * nx; b.vy -= 1.65 * vn * ny; b.spin *= -0.5; postHit(-vn, false); }
        b.x = gx + nx * r; b.y = py + ny * r;
      }
    }
    if (b.y > PT - r && b.y < PB + r) {
      const dx = b.x - gx, dz = b.z - GOAL_H, d = hyp(dx, dz);
      if (d < r && d > 1e-4) {
        const nx = dx / d, nz = dz / d, vn = b.vx * nx + b.vz * nz;
        if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vz -= 1.6 * vn * nz; postHit(-vn, true); }
        b.x = gx + nx * r; b.z = GOAL_H + nz * r;
      }
    }
  }
}
function collideNet(b) {
  for (const side of [0, 1]) {
    const gx = side ? L : 0, dir = side ? 1 : -1;
    const depth = (b.x - gx) * dir;
    if (depth <= 0 || depth > GOAL_D + 0.4 || b.z > GOAL_H + 0.3) continue;
    const roofZ = GOAL_H - Math.min(1, depth / (GOAL_D * 0.9)) * 0.25;
    if (b.y > PT && b.y < PB) {   // усередині воріт
      let hit = 0;
      if (depth > GOAL_D - BALL_R) { b.x = gx + dir * (GOAL_D - BALL_R); hit = Math.abs(b.vx); b.vx *= -0.12; b.vy *= 0.5; b.vz *= 0.5; }
      if (b.y < PT + BALL_R) { b.y = PT + BALL_R; hit = Math.max(hit, Math.abs(b.vy)); b.vy = Math.abs(b.vy) * 0.15; b.vx *= 0.6; }
      if (b.y > PB - BALL_R) { b.y = PB - BALL_R; hit = Math.max(hit, Math.abs(b.vy)); b.vy = -Math.abs(b.vy) * 0.15; b.vx *= 0.6; }
      if (b.z > roofZ - BALL_R && depth > 0.15) { b.z = roofZ - BALL_R; hit = Math.max(hit, Math.abs(b.vz)); b.vz = -Math.abs(b.vz) * 0.15; }
      if (hit > 1) netImpact(side, b.x, b.y, b.z, Math.min(0.6, hit * 0.035));
    } else if (depth < GOAL_D) {  // бокова сітка ззовні
      const py = b.y <= PT ? PT : PB, out = b.y <= PT ? -1 : 1;
      if (Math.abs(b.y - py) < BALL_R && b.z < roofZ) {
        b.y = py + out * BALL_R; const hit = Math.abs(b.vy); b.vy = out * Math.abs(b.vy) * 0.15; b.vx *= 0.5;
        if (hit > 1) netImpact(side, b.x, py, b.z, Math.min(0.4, hit * 0.03));
      }
    }
  }
}
const _ax = new T3.Vector3(), _q = new T3.Quaternion(), _up = new T3.Vector3(0, 1, 0);
function updateBall(dt) {
  const b = ball;
  b.px = b.x; b.py = b.y; b.pz = b.z;
  b.grace -= dt;
  if (b.owner) {
    if (b.held) {
      const o = b.owner;
      b.x = o.x + Math.cos(o.face) * 0.32; b.y = o.y + Math.sin(o.face) * 0.32; b.z = 1.05;
      b.vx = o.vx; b.vy = o.vy; b.vz = 0; return;
    }
    dribble(b.owner, dt);
  }
  const hs = hyp(b.vx, b.vy);
  if (b.z > 0.001 || b.vz > 0) {
    const s3 = hyp(b.vx, b.vy, b.vz);
    b.vz -= G * dt;
    b.vx -= AIR_K * s3 * b.vx * dt; b.vy -= AIR_K * s3 * b.vy * dt; b.vz -= AIR_K * s3 * b.vz * dt;
    b.vx += -MAGNUS * b.spin * b.vy * dt; b.vy += MAGNUS * b.spin * b.vx * dt;   // Магнус: закрут
    b.vz -= MAGNUS * b.top * hs * dt;                                             // верхнє обертання
    b.spin *= 1 - 0.35 * dt; b.top *= 1 - 0.35 * dt;
  } else {
    const ns = Math.max(0, hs - (hs * ROLL_A + ROLL_C) * dt);
    if (hs > 0) { b.vx *= ns / hs; b.vy *= ns / hs; }
    b.spin *= 1 - 3 * dt;
  }
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if (b.z < 0) {
    b.z = 0;
    if (b.vz < -1.3) { b.vz = -b.vz * 0.56; b.vx *= 0.84; b.vy *= 0.84; b.spin *= 0.6; } else b.vz = 0;
  }
  collidePosts(b);
  collideNet(b);
  b.x = clamp(b.x, -14, L + 14); b.y = clamp(b.y, -10, W + 10);
  const mx = b.x - b.px, my = b.y - b.py, mv = hyp(mx, my);
  if (mv > 1e-5) { _ax.set(my, 0, -mx).normalize(); b.q.premultiply(_q.setFromAxisAngle(_ax, -mv / (BALL_R * BALL_VIS))); }
  if (Math.abs(b.spin) > 0.5) b.q.premultiply(_q.setFromAxisAngle(_up, b.spin * dt * 0.3));
}

function possession() {
  const b = ball;
  if (b.owner) {   // відбір під час дриблінгу: суперник опинився ближче до м'яча
    if (b.held || b.protected || b.grace > 0) return;
    const o = b.owner, od = ballDist(o);
    for (const p of players) {
      if (p.team === o.team || p.stun > 0 || p.kickCd > 0 || p.gk) continue;
      const pd = ballDist(p);
      if (pd < 0.75 && pd < od - 0.05 && b.z < 0.8) {
        if (p === ctrl || Math.random() < (isAI(p) ? D().tackle + 0.25 : 0.55)) { o.stun = Math.max(o.stun, 0.25); giveBall(p); STATS.tackles++; return; }
        p.kickCd = 0.3;
      }
    }
    return;
  }
  if (b.z > 1.25 && b.z < 2.6 && state === 'play') {   // удари головою
    for (const p of players) {
      if (p.kickCd > 0 || p.stun > 0 || p.gk) continue;
      if (ballDist(p) < 0.75) { header(p); return; }
    }
  }
  let best = null, bd = 1e9, hands = false;
  for (const p of players) {
    if (p.kickCd > 0 || p.stun > 0) continue;
    const d = ballDist(p);
    const h = p.gk && inOwnBox(p.team, p.x, p.y) && inOwnBox(p.team, b.x, b.y);
    const reach = h ? 0.8 + (p.dive > 0 ? 0.8 : 0) : 0.85;
    const zMax = h ? 2.7 : 0.95;
    if (d < reach && b.z < zMax && d < bd) { best = p; bd = d; hands = h; }
  }
  if (!best) return;
  const rel = hyp(b.vx - best.vx, b.vy - best.vy);
  if (hands) {
    if (best.saveCd > 0) return;
    const pc = clamp(gkSkill(best) + 0.25 - Math.max(0, rel - 14) / 20, 0.12, 0.97);
    if (Math.random() < pc) {
      giveBall(best);
      if (rel > 14 && state === 'play' && !demo) showBanner('СЕЙВ!', '', 1.0);
    } else {
      best.saveCd = 0.7;
      const dir = TEAMS[best.team].dir;
      b.vx = Math.abs(b.vx) * rand(0.1, 0.3) * dir + dir * 1.5; b.vy = (b.y < best.y ? -1 : 1) * rand(5, 10); b.vz = rand(1, 4); b.spin = 0;
      b.lastTeam = best.team; b.last = best; Sound.kick(0.3);
      if (!demo && state === 'play') showBanner('СЕЙВ!', '', 0.9);
    }
    return;
  }
  if (rel < 16 || (best === ctrl && rel < 27) || Math.random() < 0.4) giveBall(best);
  else {
    b.vx = b.vx * -0.25 + rand(-2, 2); b.vy = b.vy * 0.4 + rand(-3, 3); b.vz = rand(0.5, 2.5);
    best.kickCd = 0.25; b.lastTeam = best.team; b.last = best; Sound.kick(0.25);
  }
}
function header(p) {
  STATS.headers++;
  p.jump = 0.55; p.kickCd = 0.4;
  const gx = oppGoalX(p.team), gd = hyp(gx - p.x, W / 2 - p.y);
  let tx, ty, speed, vz;
  if (gd < 18) {
    tx = gx; ty = W / 2 + rand(-3.2, 3.2); speed = rand(13, 18); vz = rand(-2.5, 0.5);
    if (p === ctrl && lastInput.dy) ty = W / 2 + lastInput.dy * 2.8;
  } else {
    const bp = bestPass(p, false);
    if (bp) { tx = bp.t.x; ty = bp.t.y; } else { const [lx, ly] = toL(p.team, p.x, p.y); [tx, ty] = toW(p.team, lx + 20, ly); }
    speed = clamp(hyp(tx - p.x, ty - p.y) * 0.6, 8, 15); vz = 3.5;
  }
  const b = ball, dx = tx - b.x, dy = ty - b.y, d = hyp(dx, dy) || 1;
  b.vx = dx / d * speed; b.vy = dy / d * speed; b.vz = vz; b.spin = 0; b.top = 0;
  b.last = p; b.lastTeam = p.team; passTarget = null;
  Sound.kick(0.35);
}
function tackles() {
  const o = ball.owner;
  if (!o || ball.held || ball.protected || ball.grace > 0) return;
  for (const p of players) {
    if (p.team === o.team || p === ctrl || p.gk || p.stun > 0 || p.tackleCd > 0) continue;
    const d = ballDist(p);
    if (d < 1.6 && d > 0.75) {
      p.tackleCd = rand(0.9, 1.6);
      if (Math.random() > 0.35) continue;                 // не завжди йде в підкат
      const chance = o.team === humanTeam ? D().tackle : 0.32;
      const a = Math.atan2(ball.y - p.y, ball.x - p.x);
      p.slide = 0.45; p.stun = 0.45; p.vx = Math.cos(a) * 8; p.vy = Math.sin(a) * 8; p.face = a;
      if (Math.random() < chance) winTackle(p, o);
      return;
    }
  }
}
function checkBounds() {
  const b = ball;
  if (b.x < 0 || b.x > L) {
    const defending = b.x < 0 ? 0 : 1;
    if (b.y > PT && b.y < PB && b.z < GOAL_H) { goalScored(1 - defending); return; }
    if (b.x > -BALL_R && b.x < L + BALL_R) return;
    const att = 1 - defending;
    if (b.lastTeam === defending) startSetpiece('corner', att, b.x < 0 ? 0.5 : L - 0.5, b.y < W / 2 ? 0.5 : W - 0.5);
    else { const [x, y] = toW(defending, 5.5, b.y < W / 2 ? W / 2 - 5 : W / 2 + 5); startSetpiece('goalkick', defending, x, y); }
  } else if (b.y < -BALL_R || b.y > W + BALL_R) {
    startSetpiece('throw', 1 - b.lastTeam, clamp(b.x, 1, L - 1), b.y < 0 ? 0.3 : W - 0.3);
  }
}
function startSetpiece(type, team, x, y) {
  STATS[type] = (STATS[type] || 0) + 1;
  const b = ball;
  b.owner = null; b.held = false; b.x = x; b.y = y; b.z = 0; b.vx = b.vy = b.vz = 0; b.spin = 0; b.inGoal = -1;
  let taker;
  if (type === 'goalkick') taker = players.find((p) => p.team === team && p.gk);
  else { let bd = 1e9; for (const p of players) if (p.team === team && !p.gk) { const d = hyp(p.x - x, p.y - y); if (d < bd) { bd = d; taker = p; } } }
  const ax = L / 2 - x, ay = W / 2 - y, am = hyp(ax, ay);
  taker.x = x - ax / am * 0.6; taker.y = y - ay / am * 0.6; taker.vx = taker.vy = 0; taker.pending = null;
  taker.face = Math.atan2(ay, ax);
  setpiece = { type, team, taker };
  possTeam = team; passTarget = null;
  state = 'setpiece'; stateT = 1.2;
  showBanner({ corner: 'КУТОВИЙ', throw: 'ВКИДАННЯ', goalkick: 'УДАР ВІД ВОРІТ' }[type], TEAMS[team].name, 1.1);
  Sound.whistle(1);
  if (humanTeam === team && !taker.gk) ctrl = taker;
}
function goalScored(team) {
  score[team]++; lastGoalTeam = team;
  ball.inGoal = ball.x < 0 ? 0 : 1; ball.owner = null; ball.held = false;
  state = 'goal'; stateT = 4.0;
  const scorer = ball.last && ball.last.team === team ? `${TEAMS[team].name} · №${ball.last.num}` : `${TEAMS[team].name} · автогол`;
  showBanner('ГОЛ!', scorer, 3.2, true);
  Sound.whistle(1); Sound.goal();
  crowdUniforms.uJump.value = 1;
}
function endMatch() {
  state = 'fulltime'; Sound.whistle(3); Sound.crowdTo(0.15, 1);
  showBanner('ФІНАЛЬНИЙ СВИСТОК', `${score[0]} : ${score[1]}`, 2.5);
  setTimeout(() => {
    $('endTitle').textContent = score[0] > score[1] ? 'ПЕРЕМОГА!' : score[0] < score[1] ? 'ПОРАЗКА' : 'НІЧИЯ';
    $('endScore').textContent = `${score[0]} : ${score[1]}`;
    $('end').classList.remove('hidden');
  }, 2200);
}

// ───────────────────────── Головний крок ─────────────────────────
function step(dt) {
  stateT -= dt;
  if (state === 'kickoff' && stateT <= 0) {
    const t = players.find((p) => p.team === kickoffTeam && p.role === 'FW');
    giveBall(t, false); ball.protected = true; ball.protT = 0; ball.protX = t.x; ball.protY = t.y;
    t.decT = rand(0.4, 0.8); state = 'play'; Sound.whistle(1);
  } else if (state === 'setpiece' && stateT <= 0) {
    const t = setpiece.taker;
    giveBall(t, false); ball.protected = true; ball.protT = 0; ball.protX = t.x; ball.protY = t.y;
    t.locked = setpiece.type !== 'goalkick'; t.decT = rand(0.4, 0.8);
    state = 'play';
  } else if (state === 'goal' && stateT <= 0) {
    crowdUniforms.uJump.value = 0;
    if (clock >= matchLen) endMatch(); else setupKickoff(1 - lastGoalTeam);
  } else if (state === 'play') {
    clock += dt;
    if (clock >= matchLen) endMatch();
  }
  if (ball.protected && ball.owner) {   // захист м'яча на розіграші знімається, коли гравець рушив
    const o = ball.owner; ball.protT += dt;
    if (hyp(o.x - ball.protX, o.y - ball.protY) > 2.5 || (ball.protT > 4 && !o.locked)) ball.protected = false;
  }
  if (state === 'fulltime') { for (const p of players) { p.tvx *= 0.9; p.tvy *= 0.9; } movePlayers(dt); updateBall(dt); return; }
  if (humanTeam >= 0) humanControl(dt);
  aiControl(dt);
  movePlayers(dt);
  updateBall(dt);
  if (state === 'play') { possession(); tackles(); checkBounds(); }
  for (const n of nets) for (let i = 0; i < n.disp.length; i++) n.disp[i] *= 1 - 3 * dt;
  if (!demo && state === 'play' && Math.random() < 0.05) Sound.crowdTo(Math.min(ball.x, L - ball.x) < 20 ? 0.13 : 0.06, 0.8);
}

// ───────────────────────── Камера ─────────────────────────
const camT = new T3.Vector3(), camP = new T3.Vector3(0, 30, 70);
function updateCamera(dt, now) {
  const look = V(ball.x + ball.vx * 0.35, ball.y + ball.vy * 0.25, 0);
  let pos, closeUp = false;
  if (demo) {   // повільний обліт стадіону в меню
    const a = now / 14000;
    look.set(Math.sin(a * 0.7) * 12, 0, 0);
    pos = new T3.Vector3(Math.sin(a) * 48, 24 + Math.sin(a * 0.5) * 5, Math.cos(a) * 38);
  } else if (state === 'goal' && stateT < 3.5 && ball.last && ball.last.team === lastGoalTeam) {
    // крупний план автора гола
    const p = ball.last, mv = hyp(p.vx, p.vy) > 1 ? Math.atan2(p.vy, p.vx) : p.face, a = mv + 0.45 + (3.5 - stateT) * 0.18;
    look.copy(V(p.x + p.vx * 0.3, p.y + p.vy * 0.3, 1.2));
    pos = V(p.x + p.vx * 0.5 + Math.cos(a) * 4.6, p.y + p.vy * 0.5 + Math.sin(a) * 4.6, 1.8);
    closeUp = true;
  } else if (camModeEff() === 2 && humanTeam >= 0) {
    const dir = TEAMS[humanTeam].dir, pt = isPortrait();
    look.copy(V(ball.x + dir * (pt ? 5 : 8), ball.y, 0));
    pos = V(ball.x - dir * (pt ? 12.5 : 14), ball.y, pt ? 9.5 : 7.5);
  } else {
    const wide = camMode === 1;   // 0 — ближня трансляція, 1 — широкий план
    look.x = clamp(look.x, -L / 2 + (wide ? 12 : 2), L / 2 - (wide ? 12 : 2));
    look.z = clamp(look.z, -W / 2 + 4, W / 2 - 4);
    // трансляція: видно третину поля навколо м'яча; широкий план — майже половину
    const back = wide ? 33 : 21, hgt = wide ? 17 : 9.5;   // нижчий кут — видно глибину поля, гравці більші
    pos = new T3.Vector3(look.x * 0.92, hgt, Math.min(W / 2 + (wide ? 16 : 9), look.z + back));
  }
  const k = Math.min(1, dt * (demo ? 1 : closeUp ? 7 : 3.2));
  camT.lerp(look, k); camP.lerp(pos, Math.min(1, dt * (demo ? 1 : closeUp ? 5 : 2.5)));
  camera.position.copy(camP); camera.lookAt(camT);
  const fov = demo ? (isPortrait() ? 62 : 40) : camModeEff() === 2 && isPortrait() ? 60 : camMode === 1 ? 33 : 33;
  camera.fov = lerp(camera.fov, fov, k); camera.updateProjectionMatrix();
  sun.position.copy(camT).add(new T3.Vector3(-26, 60, -32)); sun.target.position.copy(camT); sun.target.updateMatrixWorld();
}

// ───────────────────────── HUD ─────────────────────────
const $ = (id) => document.getElementById(id);
const mm = $('minimap'), mmc = mm.getContext('2d');
function fmtTime() {
  const gs = Math.min(90 * 60, Math.floor(clock / matchLen * 90 * 60));
  return `${String(Math.floor(gs / 60)).padStart(2, '0')}:${String(gs % 60).padStart(2, '0')}`;
}
// без м'яча кнопки міняють підписи: ПАС → ЗМІНА, УДАР → ВІДБІР
let btnAtt = null;
function updateBtnLabels() {
  const att = !!ball.owner && ball.owner.team === humanTeam || (!!ctrl && ballDist(ctrl) < 1.6);
  if (att === btnAtt) return; btnAtt = att;
  $('tPass').textContent = att ? 'ПАС' : 'ЗМІНА';
  $('tShoot').textContent = att ? 'УДАР' : 'ВІДБІР';
  $('btns').classList.toggle('def', !att);
}
function updateHUD() { $('bScore').textContent = `${score[0]}–${score[1]}`; $('bTime').textContent = fmtTime(); }
function drawMinimap() {
  const w = mm.width, h = mm.height, pad = 6, sx = (w - 2 * pad) / L, sy = (h - 2 * pad) / W;
  mmc.clearRect(0, 0, w, h);
  mmc.fillStyle = 'rgba(14,40,18,0.72)'; mmc.beginPath(); if (mmc.roundRect) mmc.roundRect(0, 0, w, h, 8); else mmc.rect(0, 0, w, h); mmc.fill();
  mmc.strokeStyle = 'rgba(255,255,255,0.55)'; mmc.lineWidth = 1.2;
  mmc.strokeRect(pad, pad, L * sx, W * sy);
  mmc.beginPath(); mmc.moveTo(pad + L / 2 * sx, pad); mmc.lineTo(pad + L / 2 * sx, pad + W * sy); mmc.stroke();
  mmc.beginPath(); mmc.arc(pad + L / 2 * sx, pad + W / 2 * sy, 9.15 * sx, 0, 7); mmc.stroke();
  for (const p of players) {
    mmc.fillStyle = p.gk ? '#' + TEAMS[p.team].gk.toString(16).padStart(6, '0') : TEAMS[p.team].css;
    mmc.beginPath(); mmc.arc(pad + p.x * sx, pad + p.y * sy, p === ctrl ? 5 : 3.6, 0, 7); mmc.fill();
    if (p === ctrl) { mmc.strokeStyle = '#ffe14d'; mmc.lineWidth = 2; mmc.stroke(); }
  }
  mmc.fillStyle = '#fff'; mmc.beginPath(); mmc.arc(pad + ball.x * sx, pad + ball.y * sy, 2.8, 0, 7); mmc.fill();
}
const tmpV = new T3.Vector3();
function updatePowerBar() {
  const el = $('power');
  if (!charging || !ctrl) { el.style.display = 'none'; return; }
  tmpV.copy(V(ctrl.x, ctrl.y, 2.5)).project(camera);
  el.style.display = 'block';
  el.style.left = ((tmpV.x + 1) / 2 * window.innerWidth) + 'px';
  el.style.top = ((1 - tmpV.y) / 2 * window.innerHeight) + 'px';
  $('powerFill').style.width = (charge * 100) + '%';
}

// ───────────────────────── Відмальовка ─────────────────────────
function render(dt, now) {
  for (const p of players) animatePlayer(p, dt);
  ballMesh.position.copy(V(ball.x, ball.y, ball.z + BALL_R * BALL_VIS));
  ballMesh.quaternion.copy(ball.q);
  for (const n of nets) updateNet(n);
  for (const t of ledTextures) t.offset.x = (now / 9000) % 1;
  flags.forEach((f, i) => (f.rotation.y = Math.sin(now / 300 + i) * 0.35));
  crowdUniforms.uTime.value = now / 1000;
  const showCtrl = !!ctrl && humanTeam >= 0;
  ctrlRing.visible = ctrlArrow.visible = showCtrl;
  aimArrow.visible = showCtrl && charging;
  if (showCtrl) {
    ctrlRing.position.copy(V(ctrl.x, ctrl.y, 0.03));
    ctrlArrow.position.copy(V(ctrl.x, ctrl.y, 2.3 + Math.sin(now / 200) * 0.06));
    if (charging) {
      const a = ctrl.face;
      aimArrow.position.copy(V(ctrl.x + Math.cos(a) * 1.4, ctrl.y + Math.sin(a) * 1.4, 0.06));
      aimArrow.rotation.set(0, Math.atan2(Math.cos(a), Math.sin(a)), 0);
    }
  }
  updateScreens();
  renderer.render(scene, camera);
  updateNames();
  if (!demo) { updateHUD(); drawMinimap(); updatePowerBar(); updateBtnLabels(); }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) bannerEl.classList.remove('show'); }
}

let last = performance.now(), acc = 0;
let frameErr = 0;
function frame(now) {
  requestAnimationFrame(frame);   // цикл не зупиниться, навіть якщо в кадрі станеться помилка
  try { frameBody(now); } catch (e) { if (frameErr++ < 3) console.error(e); }
}
function frameBody(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!paused) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 6) { step(DT); acc -= DT; n++; }
    if (n === 6) acc = 0;
    updateCamera(dt, now);
  }
  render(paused ? 0 : dt, now);
}

// ───────────────────────── Меню ─────────────────────────
document.querySelectorAll('.choices').forEach((group) => {
  group.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    group.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    settings[group.dataset.opt] = group.dataset.opt === 'mins' ? +b.dataset.v : b.dataset.v;
  });
});
function canFullscreen() { const d = document.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen); }
function goFullscreen() {   // на телефоні гра відкривається на весь екран і горизонтально
  const d = document.documentElement;
  try {
    const r = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : d.webkitRequestFullscreen && d.webkitRequestFullscreen();
    if (r && r.then) r.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
  } catch (e) { /* браузер не дозволив — граємо як є */ }
}
function exitFullscreen() { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* ок */ } }
(() => {   // вибір команд у меню
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');
  const sw = (c) => c.stripe !== undefined ? `repeating-linear-gradient(90deg, ${hex(c.shirt)} 0 3px, ${hex(c.stripe)} 3px 6px)` : hex(c.shirt);
  const draw = () => {
    for (const [id, key] of [['clubHome', 'home'], ['clubAway', 'away']]) {
      const el = $(id); el.innerHTML = '';
      CLUBS.forEach((c, i) => {
        const b = document.createElement('button');
        b.innerHTML = `<i style="background:${sw(c)}"></i>${c.name}`;
        if (settings[key] === i) b.classList.add('on');
        b.onclick = () => {
          const other = key === 'home' ? 'away' : 'home';
          if (settings[other] === i) settings[other] = settings[key];   // не можна грати самим із собою — міняємо місцями
          settings[key] = i; draw();
          if (demo && window.__started) startMatch(true);
        };
        el.appendChild(b);
      });
    }
  };
  draw();
})();
function play() {
  Sound.init();
  if (isMobile && !document.fullscreenElement) goFullscreen();
  ['menu', 'end', 'pause'].forEach((id) => $(id).classList.add('hidden'));
  $('hud').classList.remove('hidden');
  if (isMobile || 'ontouchstart' in window) $('touch').classList.remove('hidden');
  paused = false;
  startMatch(false);
  camP.set(0, 20, 42);
}
function toMenu() {
  ['end', 'pause', 'hud'].forEach((id) => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden'); $('touch').classList.add('hidden');
  paused = false; Sound.crowdTo(0.03);
  startMatch(true);
}
function togglePause() {
  if (demo || state === 'fulltime') return;
  paused = !paused;
  $('pause').classList.toggle('hidden', !paused);
}
$('play').onclick = play; $('again').onclick = play;
$('resume').onclick = togglePause; $('toMenu1').onclick = toMenu; $('toMenu2').onclick = toMenu; $('tPause').onclick = togglePause; $('tCam').onclick = nextCam;

(() => {   // сенсорне керування: джойстик з'являється там, де торкнувся палець (ліва половина екрана)
  const zone = $('stickZone'), stick = $('stick'), knob = $('knob');
  const R = 60;
  let id = null, cx = 0, cy = 0;
  const place = (x, y) => { stick.style.left = (x - 75) + 'px'; stick.style.top = (y - 75) + 'px'; stick.style.bottom = 'auto'; };
  const mv = (e) => {
    if (e.pointerId !== id) return;
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const m = hyp(dx, dy);
    touch.far = m > 1.15;   // палець за межею кола — прискорення
    if (m > 1) { dx /= m; dy /= m; }
    const dm = hyp(dx, dy);
    if (dm < 0.12) { touch.dx = touch.dy = 0; } else { touch.dx = dx; touch.dy = dy; }
    knob.style.transform = `translate(${dx * 48}px, ${dy * 48}px)`;
  };
  zone.addEventListener('pointerdown', (e) => {
    if (id !== null) return;
    e.preventDefault(); id = e.pointerId; cx = e.clientX; cy = e.clientY;
    place(cx, cy); stick.classList.add('on');
    try { zone.setPointerCapture(id); } catch (err) { /* ок */ }
    mv(e);
  });
  zone.addEventListener('pointermove', mv);
  const up = (e) => {
    if (e.pointerId !== id) return;
    id = null; touch.dx = touch.dy = 0; touch.far = false; knob.style.transform = ''; stick.classList.remove('on');
    stick.style.left = ''; stick.style.top = ''; stick.style.bottom = '';
  };
  zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
  const btn = (el, down, upf) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('down'); down(); });
    const u = (e) => { e.preventDefault(); el.classList.remove('down'); upf(); };
    el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); el.addEventListener('pointerleave', u);
  };
  btn($('tPass'), () => (touch.passPress = true), () => {});
  btn($('tShoot'), () => { touch.shoot = true; touch.shootPress = true; }, () => { if (touch.shoot) { touch.shoot = false; touch.shootRelease = true; } });
  btn($('tSprint'), () => (touch.sprint = true), () => (touch.sprint = false));
  btn($('tThrough'), () => (touch.throughPress = true), () => {});
  btn($('tCross'), () => (touch.crossPress = true), () => {});
  const full = $('tFull');
  if (!canFullscreen()) full.classList.add('hidden');
  full.onclick = () => (document.fullscreenElement || document.webkitFullscreenElement ? exitFullscreen() : goFullscreen());
})();
buildPitch(); buildStadium(); buildBoards(); buildGoals(); buildBall(); buildScreens();
$('loading').textContent = 'Завантаження гравців…';
let booted = false;
function boot() {
  if (booted) return; booted = true;
  startMatch(true);
  $('loading').classList.add('hidden');
  window.__started = true;
  requestAnimationFrame(frame);
}
loadHumans().then(() => { try { buildCrowdSprites(); } catch (e) { console.warn('Глядачі: ', e); } boot(); });
setTimeout(boot, 20000);   // якщо моделі довго вантажаться — грати з простими

window.GOLEADOR = {
  get state() { return state; }, get score() { return score; }, get ball() { return ball; }, get players() { return players; },
  get ctrl() { return ctrl; }, get clock() { return clock; }, get passTarget() { return passTarget; }, step, startMatch, play, settings, STATS, shootAt,
  setCam(m) { camMode = m; }, camera, render: () => { for (const p of players) animatePlayer(p); renderer.render(scene, camera); },
};
})();
