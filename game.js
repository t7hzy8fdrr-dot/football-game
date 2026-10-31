/* ГОЛЕАДОР — оригінальний футбол у браузері. Без залежностей, лише canvas. */
'use strict';
(() => {

// ───────────────────────── Константи ─────────────────────────
const L = 105, W = 68;                       // розміри поля, м
const GOAL_W = 7.32, GOAL_H = 2.44, GOAL_D = 2.0;
const PT = W / 2 - GOAL_W / 2, PB = W / 2 + GOAL_W / 2;  // штанги по y
const M = 12;                                // поля навколо газону (трибуни)
const GR = 5;                                // трава за лініями
const PPM = 26, YS = 0.78, HZ = 0.9;         // пікселів на метр, стиснення y, висота
const G = 9.81, BALL_R = 0.2, DT = 1 / 60;
const FIG = 1.25;   // фігурки гравців трохи більші за реальний масштаб — так краще видно

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
  easy:   { speed: 0.86, react: 0.5,  tackle: 0.22, acc: 0.55, gk: 0.55 },
  normal: { speed: 0.95, react: 0.3,  tackle: 0.36, acc: 0.72, gk: 0.7 },
  hard:   { speed: 1.03, react: 0.16, tackle: 0.5,  acc: 0.86, gk: 0.84 },
};

const TEAMS = [
  { name: 'ЛЕВИ',  short: 'ЛЕВ', shirt: '#d7263d', shirt2: '#8e1222', shorts: '#f4f4f4', socks: '#d7263d', gk: '#20b765', gk2: '#0f6b3a', dir: 1 },
  { name: 'ВОВКИ', short: 'ВОВ', shirt: '#2a6be0', shirt2: '#123a88', shorts: '#0e1a33', socks: '#f4f4f4', gk: '#f2c230', gk2: '#a07800', dir: -1 },
];
// Розстановка (локальні координати: своя брама на x=0)
const FORM = [
  { r: 'GK', x: 3,  y: 34 },
  { r: 'DF', x: 20, y: 13 }, { r: 'DF', x: 16, y: 34 }, { r: 'DF', x: 20, y: 55 },
  { r: 'MF', x: 37, y: 23 }, { r: 'MF', x: 37, y: 45 },
  { r: 'FW', x: 49, y: 34 },
];
const NUMS = [1, 2, 4, 3, 8, 10, 9];
const SKIN = ['#f1c7a5', '#e0ac85', '#c68863', '#8d5a3b', '#f5d3b8', '#b0784f'];
const HAIR = ['#1b1209', '#3b2412', '#6b4320', '#c9a15a', '#0d0d0d', '#7a3d18'];

const toW = (t, lx, ly) => (TEAMS[t].dir > 0 ? [lx, ly] : [L - lx, W - ly]);
const toL = toW;

// ───────────────────────── Canvas ─────────────────────────
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let viewW = 1280, viewH = 720, scale = 1, dpr = 1, vignette = null;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  scale = clamp(Math.sqrt((cw * ch) / (1280 * 720)), 0.45, 2.4);
  viewW = cw / scale; viewH = ch / scale;
  vignette = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.35, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
}
window.addEventListener('resize', resize);
resize();

const cam = { x: L / 2, y: W / 2 };
const sx = (x) => (x - cam.x) * PPM + viewW / 2;
const sy = (y, z = 0) => (y - cam.y) * PPM * YS + viewH / 2 - z * PPM * HZ;

// ───────────────────────── Стадіон (малюється один раз) ─────────────────────────
const worldCv = document.createElement('canvas');
const crowdSpots = [];
function buildWorld() {
  const wpx = Math.ceil((L + 2 * M) * PPM), hpx = Math.ceil((W + 2 * M) * PPM * YS);
  worldCv.width = wpx; worldCv.height = hpx;
  const g = worldCv.getContext('2d');
  const X = (x) => (x + M) * PPM, Y = (y) => (y + M) * PPM * YS;

  // Трибуни
  g.fillStyle = '#12151c'; g.fillRect(0, 0, wpx, hpx);
  const inner = { x0: -GR - 1.6, x1: L + GR + 1.6, y0: -GR - 1.6, y1: W + GR + 1.6 };
  // сходинки
  g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 2;
  for (let d = 0; d < M; d += 0.8) {
    g.strokeRect(X(inner.x0 - d), Y(inner.y0 - d), (inner.x1 - inner.x0 + 2 * d) * PPM, (inner.y1 - inner.y0 + 2 * d) * PPM * YS);
  }
  const fanCols = ['#c0392b', '#e8e8e8', '#2c3e50', '#f1c40f', '#2471a3', '#7f8c8d', '#d35400', '#ecf0f1', '#16a085', '#d7263d', '#2a6be0', '#bdc3c7', '#d7263d', '#2a6be0'];
  for (let i = 0; i < 7000; i++) {
    const x = rand(-M + 0.3, L + M - 0.3), y = rand(-M + 0.3, W + M - 0.3);
    if (x > inner.x0 - 0.3 && x < inner.x1 + 0.3 && y > inner.y0 - 0.3 && y < inner.y1 + 0.3) continue;
    // ближче до поля — фанати в кольорах команд
    const near = x < L / 2 ? 0 : 1;
    let col = fanCols[(Math.random() * fanCols.length) | 0];
    if (Math.random() < 0.35) col = near ? TEAMS[0].shirt : TEAMS[1].shirt;
    const depth = Math.max(inner.x0 - x, x - inner.x1, inner.y0 - y, y - inner.y1) / M;
    g.globalAlpha = 0.95 - depth * 0.5;
    g.fillStyle = col;
    g.beginPath(); g.ellipse(X(x), Y(y), 0.32 * PPM, 0.26 * PPM, 0, 0, 7); g.fill();
    g.fillStyle = SKIN[(Math.random() * SKIN.length) | 0];
    g.beginPath(); g.arc(X(x), Y(y) - 0.25 * PPM, 0.13 * PPM, 0, 7); g.fill();
    if (i % 9 === 0) crowdSpots.push([x, y]);
  }
  g.globalAlpha = 1;

  // Газон зі смугами покосу
  const gx0 = X(-GR), gy0 = Y(-GR), gw = (L + 2 * GR) * PPM, gh = (W + 2 * GR) * PPM * YS;
  const sw = L / 18;
  for (let k = -2; k < 20; k++) {
    const x0 = Math.max(-GR, k * sw), x1 = Math.min(L + GR, (k + 1) * sw);
    if (x1 <= x0) continue;
    g.fillStyle = (k & 1) ? '#3f8c37' : '#4b9a40';
    g.fillRect(X(x0), gy0, (x1 - x0) * PPM, gh);
  }
  // легкі поперечні смуги (шахівниця покосу)
  g.globalAlpha = 0.05; g.fillStyle = '#ffffff';
  for (let k = 0; k < 12; k++) if (k & 1) g.fillRect(gx0, Y(-GR + k * (W + 2 * GR) / 12), gw, (W + 2 * GR) / 12 * PPM * YS);
  g.globalAlpha = 1;
  // травинки
  for (let i = 0; i < 60000; i++) {
    const x = gx0 + Math.random() * gw, y = gy0 + Math.random() * gh;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(20,60,15,0.18)' : 'rgba(170,220,120,0.10)';
    g.fillRect(x, y, 1, 2 + Math.random() * 2);
  }
  // освітлення прожекторами
  const lg = g.createRadialGradient(X(L / 2), Y(W / 2), 50, X(L / 2), Y(W / 2), gw * 0.65);
  lg.addColorStop(0, 'rgba(255,255,230,0.08)'); lg.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = lg; g.fillRect(gx0, gy0, gw, gh);
  // витоптані ділянки біля воріт та в центрі
  const wear = (x, y, r, a) => {
    const rg = g.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), r * PPM);
    rg.addColorStop(0, `rgba(140,135,80,${a * 0.6})`); rg.addColorStop(1, 'rgba(140,135,80,0)');
    g.fillStyle = rg; g.beginPath(); g.ellipse(X(x), Y(y), r * PPM, r * PPM * YS, 0, 0, 7); g.fill();
  };
  wear(2.5, W / 2, 4, 0.35); wear(L - 2.5, W / 2, 4, 0.35); wear(11, W / 2, 2.5, 0.2); wear(L - 11, W / 2, 2.5, 0.2); wear(L / 2, W / 2, 3, 0.18);

  // Рекламні борти
  const ads = ['ГОЛЕАДОР', 'ГРАЙ ЧЕСНО', 'ФУТБОЛ 2026', 'ГОЛЕАДОР', 'ВПЕРЕД!', 'СИЛА ГРИ'];
  const adCols = [['#0f1c3d', '#ffd34d'], ['#c81e2e', '#ffffff'], ['#0b6e4f', '#ffffff'], ['#111111', '#ffd34d'], ['#1f5fd6', '#ffffff'], ['#3a1f6b', '#7fe3ff']];
  const by = -GR - 1.2, bh = 1.0 * PPM * HZ;
  const segW = 14;
  for (let x = -GR, i = 0; x < L + GR; x += segW, i++) {
    const w = Math.min(segW, L + GR - x);
    const [bg, fg] = adCols[i % adCols.length];
    const top = Y(by + 0.6) - bh;
    g.fillStyle = bg; g.fillRect(X(x), top, w * PPM - 2, bh);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(X(x), top, w * PPM - 2, 3);
    g.fillStyle = fg; g.font = `900 ${Math.round(bh * 0.62)}px Segoe UI, Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ads[i % ads.length], X(x + w / 2), top + bh / 2 + 1);
  }
  // нижні та бічні борти (видно зверху)
  g.fillStyle = '#1b2233';
  g.fillRect(X(-GR), Y(W + GR + 0.4), (L + 2 * GR) * PPM, 0.35 * PPM);
  g.fillRect(X(-GR - 0.9), Y(-GR - 0.6), 0.35 * PPM, (W + 2 * GR + 1) * PPM * YS);
  g.fillRect(X(L + GR + 0.55), Y(-GR - 0.6), 0.35 * PPM, (W + 2 * GR + 1) * PPM * YS);
  // лави запасних
  for (const bx of [L / 2 - 14, L / 2 + 8]) {
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(X(bx) + 6, Y(W + 2.6) + 6, 6 * PPM, 1.6 * PPM * YS);
    g.fillStyle = 'rgba(160,200,230,0.35)'; g.fillRect(X(bx), Y(W + 2.6), 6 * PPM, 1.6 * PPM * YS);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.strokeRect(X(bx), Y(W + 2.6), 6 * PPM, 1.6 * PPM * YS);
  }
}

// Сітка воріт
const netCv = document.createElement('canvas'); netCv.width = netCv.height = 7;
{ const n = netCv.getContext('2d'); n.strokeStyle = 'rgba(255,255,255,0.55)'; n.lineWidth = 1;
  n.beginPath(); n.moveTo(0, 0.5); n.lineTo(7, 0.5); n.moveTo(0.5, 0); n.lineTo(0.5, 7); n.stroke(); }
const netPat = ctx.createPattern(netCv, 'repeat');

// ───────────────────────── Звук (WebAudio, синтез) ─────────────────────────
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
    g.gain.setValueAtTime(0.25 + power * 0.5, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.15);
    o.connect(g); g.connect(this.master); o.start(n); o.stop(n + 0.16);
    const s = ac.createBufferSource(); s.buffer = this.noise; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500;
    const g2 = ac.createGain(); g2.gain.setValueAtTime(0.15 + power * 0.3, n); g2.gain.exponentialRampToValueAtTime(0.001, n + 0.05);
    s.connect(f); f.connect(g2); g2.connect(this.master); s.start(n, Math.random()); s.stop(n + 0.06);
  },
  whistle(kind = 1) {
    if (!this.ac || demo) return; const ac = this.ac;
    const blasts = kind === 3 ? [0, 0.45, 0.9] : [0];
    const dur = kind === 2 || kind === 3 ? 0.55 : 0.28;
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
const STATS = { shots: 0, passes: 0, tackles: 0 };   // лічильники для тестів
const settings = { diff: 'normal', mins: 4 };
let players = [], ball = null, state = 'kickoff', stateT = 0;
let score = [0, 0], clock = 0, matchLen = 240, humanTeam = -1, ctrl = null, demo = true, paused = false;
let possTeam = 0, kickoffTeam = 0, passTarget = null, setpiece = null, banner = null, lastGoalTeam = 0;
let charge = 0, charging = false, autoSwT = 0, effects = [], flashes = [], trail = [];

function makePlayers() {
  players = [];
  for (let t = 0; t < 2; t++) FORM.forEach((f, i) => players.push({
    team: t, i, role: f.r, gk: f.r === 'GK', num: NUMS[i],
    x: 0, y: 0, vx: 0, vy: 0, tvx: 0, tvy: 0, face: 0, phase: rand(0, 6),
    kickCd: 0, stun: 0, slide: 0, dive: 0, diveDir: 0, tackleCd: 0, saveCd: 0, kickAnim: 0, holdT: 0,
    jx: rand(-2, 2), jy: rand(-2, 2), jT: rand(2, 5), decT: 0, locked: false,
    skin: SKIN[(Math.random() * SKIN.length) | 0], hair: HAIR[(Math.random() * HAIR.length) | 0],
  }));
}

function newBall(x, y) {
  ball = { x, y, z: 0, vx: 0, vy: 0, vz: 0, px: x, owner: null, held: false, protected: false, protT: 0, protX: x, protY: y, last: null, lastTeam: 0, roll: 0, inGoal: -1 };
}

function showBanner(text, sub = '', dur = 1.6, big = false) { banner = { text, sub, t: 0, dur, big }; }

function setupKickoff(team) {
  players.forEach((p) => {
    const f = FORM[p.i];
    let lx = Math.min(f.x, 46), ly = f.y;
    if (p.team === team && p.role === 'FW') { lx = L / 2 - 0.7; ly = W / 2; }
    if (p.team === team && p.i === 4) { lx = L / 2 - 8; ly = W / 2 - 7; }
    if (p.team !== team && p.role === 'FW') lx = L / 2 - 10;
    const [x, y] = toW(p.team, lx, ly);
    Object.assign(p, { x, y, vx: 0, vy: 0, tvx: 0, tvy: 0, stun: 0, slide: 0, dive: 0, locked: false, kickCd: 0, face: TEAMS[p.team].dir > 0 ? 0 : Math.PI });
  });
  newBall(L / 2, W / 2);
  ball.lastTeam = team; possTeam = team; kickoffTeam = team; passTarget = null;
  state = 'kickoff'; stateT = 1.3;
  if (humanTeam >= 0) {
    ctrl = humanTeam === team ? players.find((p) => p.team === team && p.role === 'FW') : players.find((p) => p.team === humanTeam && p.i === 4);
  }
}

function startMatch(isDemo) {
  demo = isDemo; humanTeam = isDemo ? -1 : 0; ctrl = null;
  score = [0, 0]; clock = 0; matchLen = isDemo ? 1e9 : settings.mins * 60;
  makePlayers(); setupKickoff(Math.random() < 0.5 ? 0 : 1);
  if (!isDemo) { showBanner('ПОЧАТОК МАТЧУ', `${TEAMS[0].name} — ${TEAMS[1].name}`, 1.8, true); Sound.crowdTo(0.07); }
  cam.x = L / 2; cam.y = W / 2;
}

// ───────────────────────── Допоміжні ─────────────────────────
const D = () => DIFF[settings.diff];
function spdMul(p) { if (humanTeam < 0) return 1; return p.team === humanTeam ? 0.97 : D().speed; }
function gkSkill(gk) { return humanTeam >= 0 && gk.team !== humanTeam ? D().gk : 0.72; }
function oppGoalX(t) { return TEAMS[t].dir > 0 ? L : 0; }
function ownGoalX(t) { return TEAMS[t].dir > 0 ? 0 : L; }
function inOwnBox(t, x, y) { const [lx, ly] = toL(t, x, y); return lx < 16.5 && lx > -1 && Math.abs(ly - W / 2) < 20.16; }
function nearestOpp(p) { let best = null, bd = 1e9; for (const o of players) if (o.team !== p.team) { const d = hyp(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } } return { o: best, d: bd }; }

function moveTo(p, tx, ty, speed, arrive = 2) {
  const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
  if (d < 0.2) { p.tvx = p.tvy = 0; return; }
  const s = speed * Math.min(1, d / arrive);
  p.tvx = dx / d * s; p.tvy = dy / d * s;
}
function keepAway(p, tx, ty) {
  if (ball.protected && ball.owner && ball.owner.team !== p.team) {
    const dx = tx - ball.x, dy = ty - ball.y, d = hyp(dx, dy) || 1;
    if (d < 8) return [ball.x + dx / d * 8, ball.y + dy / d * 8];
  }
  if (state === 'setpiece' && setpiece && setpiece.team !== p.team) {
    const dx = tx - ball.x, dy = ty - ball.y, d = hyp(dx, dy) || 1;
    if (d < 8) return [ball.x + dx / d * 8, ball.y + dy / d * 8];
  }
  return [tx, ty];
}

function giveBall(p) {
  ball.owner = p; ball.held = p.gk && inOwnBox(p.team, p.x, p.y) && inOwnBox(p.team, ball.x, ball.y);
  ball.last = p; ball.lastTeam = p.team; possTeam = p.team; ball.vz = 0; ball.z = 0; ball.inGoal = -1;
  passTarget = null; p.holdT = 0; ball.grace = 0.6;
  p.decT = humanTeam >= 0 && p.team !== humanTeam ? D().react * rand(0.6, 1.2) : rand(0.15, 0.3);
  if (humanTeam === p.team && !p.gk) ctrl = p;
}

function kickBall(p, vx, vy, vz) {
  ball.owner = null; ball.held = false; ball.protected = false;
  ball.vx = vx; ball.vy = vy; ball.vz = vz; ball.z = Math.max(ball.z, 0.05);
  p.kickCd = 0.3; p.kickAnim = 0.25; ball.last = p; ball.lastTeam = p.team;
  players.forEach((q) => (q.locked = false));
  if (hyp(vx, vy) > 14) {   // воротар суперника реагує із запізненням і може помилитися
    const gk = players.find((q) => q.gk && q.team !== p.team);
    const sk = gkSkill(gk);
    gk.react = 0.16 + (1 - sk) * 0.4; gk.read = rand(-1, 1) * (1 - sk) * 3.4;
  }
  Sound.kick(clamp(hyp(vx, vy) / 30, 0, 1));
}
function kickTo(p, tx, ty, speed, vz) {
  const dx = tx - ball.x, dy = ty - ball.y, d = hyp(dx, dy) || 1;
  kickBall(p, dx / d * speed, dy / d * speed, vz);
}
function passTo(p, t, forceLoft = false) {
  STATS.passes++;
  const d0 = hyp(t.x - ball.x, t.y - ball.y);
  let lane = 99;
  for (const o of players) if (o.team !== p.team) lane = Math.min(lane, distSeg(o.x, o.y, ball.x, ball.y, t.x, t.y));
  const loft = forceLoft || d0 > 26 || (lane < 1.1 && d0 > 10);
  let speed, vz = 0, tt;
  if (!loft) { speed = clamp(7 + d0 * 0.75, 9, 25); tt = d0 / (speed * 0.8); }
  else { vz = clamp(d0 * 0.2, 5, 10.5); tt = 2 * vz / G; speed = d0 / tt * 0.92; }
  const tx = t.x + t.vx * tt * 0.7, ty = t.y + t.vy * tt * 0.7;
  if (loft) { const d1 = hyp(tx - ball.x, ty - ball.y); speed = d1 / tt * 0.92; }
  kickTo(p, tx, ty, speed, vz);
  passTarget = t;
}
function shootAt(p, power, aim, err) {
  STATS.shots++;
  const dir = TEAMS[p.team].dir, gx = oppGoalX(p.team);
  const gd = hyp(gx - p.x, W / 2 - p.y);
  const ty = W / 2 + aim * 3.25 + rand(-1, 1) * err;
  const speed = 15 + power * 17;
  const vz = 0.8 + power * 4.0 + gd * 0.04 + rand(-0.4, 0.7);
  kickTo(p, gx + dir * 0.3, ty, speed, vz);
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
    for (const o of players) if (o.team !== p.team) {
      lane = Math.min(lane, distSeg(o.x, o.y, p.x, p.y, t.x, t.y));
      open = Math.min(open, hyp(o.x - t.x, o.y - t.y));
    }
    const [tlx] = toL(p.team, t.x, t.y);
    let s = (tlx - plx) * 0.13 + open * 0.28 + Math.min(lane, 4) * 0.3 - d * 0.025;
    if (lane < 1.2 && d < 24) s -= 1.5;
    if (s > bs) { bs = s; best = { t, score: s }; }
  }
  return best;
}

// ───────────────────────── Керування ─────────────────────────
const keys = {}, pressed = {}, released = {};
const touch = { dx: 0, dy: 0, pass: false, shoot: false, sprint: false };
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyM') Sound.setMuted(!Sound.muted);
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; released[e.code] = true; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function readInput() {
  let dx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0) + touch.dx;
  let dy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0) + touch.dy;
  const m = hyp(dx, dy); if (m > 1) { dx /= m; dy /= m; }
  const inp = {
    dx, dy,
    sprint: !!(keys.ShiftLeft || keys.ShiftRight || keys.KeyL || touch.sprint),
    passPress: !!(pressed.Space || pressed.KeyJ || pressed.KeyZ || touch.passPress),
    shootPress: !!(pressed.KeyK || pressed.KeyX || touch.shootPress),
    shootDown: !!(keys.KeyK || keys.KeyX || touch.shoot),
    shootRelease: !!(released.KeyK || released.KeyX || touch.shootRelease),
  };
  for (const k in pressed) delete pressed[k];
  for (const k in released) delete released[k];
  touch.passPress = touch.shootPress = touch.shootRelease = false;
  return inp;
}

function closestToBall(team, exclude) {
  let best = null, bd = 1e9;
  for (const p of players) if (p.team === team && !p.gk && p !== exclude) { const d = hyp(p.x - ball.x, p.y - ball.y); if (d < bd) { bd = d; best = p; } }
  return best;
}

function humanControl(dt) {
  const inp = readInput();
  if (!ctrl || ctrl.gk) ctrl = closestToBall(humanTeam);
  const p = ctrl;
  let sp = inp.sprint ? 8.2 : 6.4;
  if (ball.owner === p) sp *= 0.9;
  if (p.locked || state === 'kickoff' || (state === 'setpiece' && setpiece && setpiece.taker === p)) sp = 0;
  p.tvx = inp.dx * sp; p.tvy = inp.dy * sp;
  if (state !== 'play') { charge = 0; charging = false; return; }

  if (ball.owner === p) {
    if (inp.passPress) { humanPass(p, inp, false); return; }
    if (inp.shootPress) { charging = true; charge = 0.12; }
    if (charging && inp.shootDown) charge = Math.min(1, charge + dt / 0.85);
    if (charging && (inp.shootRelease || charge >= 1)) { humanShoot(p, charge, inp); charging = false; charge = 0; }
  } else {
    charging = false; charge = 0;
    if (inp.passPress) { const c = closestToBall(humanTeam, p); if (c) ctrl = c; }
    if (inp.shootPress) humanTackle(p, inp);
    // автоперемикання, якщо інший гравець значно ближче до м'яча
    autoSwT -= dt;
    if (autoSwT <= 0 && (!ball.owner || ball.owner.team !== humanTeam)) {
      autoSwT = 0.4;
      const c = closestToBall(humanTeam);
      if (c && c !== p && hyp(p.x - ball.x, p.y - ball.y) > hyp(c.x - ball.x, c.y - ball.y) + 7) ctrl = c;
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
    if (d < 2) continue;
    const c = (dx * ax + dy * ay) / d;
    if (c < 0.35) continue;
    const s = c * 3 - d * 0.035 - (t.gk ? 1.5 : 0);
    if (s > bs) { bs = s; best = t; }
  }
  if (!best) { kickTo(p, p.x + ax * 15, p.y + ay * 15, loft ? 12 : 15, loft ? 6 : 0); return; }
  passTo(p, best, loft);
  if (!best.gk) ctrl = best;
}

function humanShoot(p, power, inp) {
  if (p.locked) { humanPass(p, inp, true); return; }
  const gx = oppGoalX(p.team);
  const fx = Math.cos(p.face), fy = Math.sin(p.face);
  const gdx = gx - p.x, gdy = W / 2 - p.y, gd = hyp(gdx, gdy);
  if ((fx * gdx + fy * gdy) / gd > 0.1 && gd < 45) {
    const aim = inp.dy !== 0 ? clamp(inp.dy * 1.4, -1, 1) : (p.y < W / 2 ? 0.8 : -0.8);
    shootAt(p, power, aim, 0.2 + power * 1.0 + gd * 0.025);
  } else {
    kickTo(p, p.x + fx * 20, p.y + fy * 20, 14 + power * 14, 2 + power * 6);
  }
}

function humanTackle(p, inp) {
  const db = hyp(ball.x - p.x, ball.y - p.y);
  if (!ball.owner && db < 1.7 && ball.z < 1.9 && p.kickCd <= 0) {   // удар з льоту
    humanShoot(p, 0.75, inp); return;
  }
  if (p.tackleCd > 0) return;
  const o = ball.owner;
  p.tackleCd = 0.7; p.slide = 0.4;
  if (o && o.team !== p.team && !ball.held && !ball.protected && db < 2.1) {
    const a = Math.atan2(ball.y - p.y, ball.x - p.x); p.vx = Math.cos(a) * 9; p.vy = Math.sin(a) * 9;
    if (Math.random() < 0.68) winTackle(p, o); else p.stun = 0.45;
  } else {
    p.vx = Math.cos(p.face) * 8.5; p.vy = Math.sin(p.face) * 8.5; p.stun = 0.3;
  }
}

function winTackle(p, o) {
  STATS.tackles++;
  ball.owner = null; ball.held = false;
  const a = Math.atan2(ball.y - p.y, ball.x - p.x) + rand(-0.6, 0.6), s = rand(3, 6);
  ball.vx = o.vx * 0.3 + Math.cos(a) * s; ball.vy = o.vy * 0.3 + Math.sin(a) * s; ball.vz = rand(0, 1.5);
  o.stun = 0.55; o.kickCd = 0.6; p.kickCd = 0.05; p.slide = Math.max(p.slide, 0.3);
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
    if (p.stun > 0) { p.tvx = p.tvy = 0; continue; }
    if (p.gk) { aiGK(p, dt); continue; }
    if (owner === p) { aiCarrier(p, dt); continue; }
    if (setpiece && state === 'setpiece' && setpiece.taker === p) { p.tvx = p.tvy = 0; continue; }
    if (chasers[p.team] === p) { aiChase(p); continue; }
    if (passTarget === p && !owner) { aiReceive(p); continue; }
    aiPosition(p);
  }
}

function aiChase(p) {
  let tx, ty;
  const o = ball.owner;
  if (o) {
    const og = ownGoalX(p.team);
    tx = o.x + o.vx * 0.25 + Math.sign(og - o.x) * 0.7; ty = o.y + o.vy * 0.25;
  } else {
    const d = hyp(ball.x - p.x, ball.y - p.y), t = Math.min(1, d / 8) * 0.7;
    tx = ball.x + ball.vx * t; ty = ball.y + ball.vy * t;
  }
  [tx, ty] = keepAway(p, tx, ty);
  moveTo(p, tx, ty, 7.7 * spdMul(p), 0.6);
}

function aiReceive(p) {
  const sp = hyp(ball.vx, ball.vy);
  if (sp < 3) { moveTo(p, ball.x, ball.y, 7 * spdMul(p), 0.5); return; }
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
  moveTo(p, tx, ty, (d > 8 ? 6.8 : 4.6) * spdMul(p), 3);
}

function aiGK(p, dt) {
  const gx = ownGoalX(p.team), dir = TEAMS[p.team].dir;
  if (ball.owner === p) {
    p.tvx = p.tvy = 0; p.holdT += dt;
    p.face = TEAMS[p.team].dir > 0 ? 0 : Math.PI;
    if (p.holdT > 1.1 && state === 'play') {
      const b = bestPass(p, true);
      if (b && b.score > 0.2) passTo(p, b.t);
      else kickTo(p, L / 2 + rand(-8, 8), rand(12, W - 12), 22, 9);
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
      const iy = ball.y + ball.vy * t + (p.read || 0);
      tx = p.x; ty = clamp(iy, PT - 1.2, PB + 1.2); speed = (p.react > 0) ? 0 : 2.0 + 2.6 * gkSkill(p);
      if (Math.abs(iy - p.y) > 1.1 && p.dive <= 0 && t < 0.55) { p.dive = 0.65; p.diveDir = Math.sign(iy - p.y); }
    }
  } else if (state === 'play' && inOwnBox(p.team, ball.x, ball.y) && (!ball.owner || ball.owner.team !== p.team)) {
    const myD = hyp(ball.x - p.x, ball.y - p.y);
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
    if (p.decT <= 0) { const b = bestPass(p, true); if (b) passTo(p, b.t); else kickTo(p, gx, W / 2, 18, 4); }
    return;
  }
  if (p.decT <= 0) {
    p.decT = (humanTeam >= 0 && p.team !== humanTeam ? D().react : 0.25) * rand(0.7, 1.3) + 0.15;
    const gd = hyp(gx - p.x, W / 2 - p.y);
    const pd = nearestOpp(p).d;
    if (lx > 70) {
      let c = gd < 12 ? 0.9 : gd < 18 ? 0.55 : gd < 26 ? 0.18 : 0;
      if (pd < 2.5) c += 0.15;
      if (lx > 99) c += 0.4;
      if (Math.random() < c) { aiShoot(p); return; }
    }
    const bp = bestPass(p, false);
    if (bp) {
      const prog = toL(p.team, bp.t.x, bp.t.y)[0] - lx;
      let c = pd < 2.2 ? 0.55 : pd < 3.5 ? 0.16 : 0.015;
      if (prog < -4 && pd > 2.2) c *= 0.3;
      if (bp.score > 2.2 && prog > 8) c += 0.12;
      if (lx > 95 && Math.abs(ly - W / 2) > 10) c += 0.6;   // навіс з флангу
      if (Math.random() < c) { passTo(p, bp.t); return; }
    }
  }
  // дриблінг з обходом суперників
  let ax = gx - p.x, ay = W / 2 - p.y; const am = hyp(ax, ay) || 1; ax /= am; ay /= am;
  if (lx < 85) ay *= 0.45;
  for (const o of players) {
    if (o.team === p.team) continue;
    const dx = o.x - p.x, dy = o.y - p.y, d = hyp(dx, dy);
    if (d > 7 || d < 0.01) continue;
    if (dx * ax + dy * ay < 0) continue;
    const side = (dx * ay - dy * ax) > 0 ? 1 : -1;
    const w = (7 - d) / 7 * 1.6;
    ax += ay * side * w; ay += -ax * side * w * 0.5;
  }
  if (p.y < 4) ay += 0.8; if (p.y > W - 4) ay -= 0.8;
  const m = hyp(ax, ay) || 1;
  const sp = 6.2 * spdMul(p) * 0.92;
  p.tvx = ax / m * sp; p.tvy = ay / m * sp;
}

function aiShoot(p) {
  const acc = humanTeam >= 0 && p.team !== humanTeam ? D().acc : 0.75;
  const aim = (Math.random() < 0.5 ? -1 : 1) * rand(0.45, 1);
  shootAt(p, rand(0.55, 1), aim, (1 - acc) * 5 + rand(0, 0.8));
}

// ───────────────────────── Фізика ─────────────────────────
function movePlayers(dt) {
  for (const p of players) {
    p.kickCd -= dt; p.react = (p.react || 0) - dt; p.stun -= dt; p.slide -= dt; p.dive -= dt; p.tackleCd -= dt; p.saveCd -= dt; p.kickAnim -= dt;
    let tvx = p.tvx, tvy = p.tvy, acc = 9;
    if (p.stun > 0) { tvx = 0; tvy = 0; acc = 3; }
    if (p.dive > 0) acc = 16;
    p.vx += (tvx - p.vx) * Math.min(1, acc * dt);
    p.vy += (tvy - p.vy) * Math.min(1, acc * dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
    const sp = hyp(p.vx, p.vy);
    if (p.stun <= 0 && p.dive <= 0) {
      let tf = null;
      if (sp > 0.5) tf = Math.atan2(p.vy, p.vx);
      else if (ball.owner !== p && p !== ctrl) tf = Math.atan2(ball.y - p.y, ball.x - p.x);
      if (tf !== null) p.face += angDiff(tf, p.face) * Math.min(1, dt * 11);
    }
    p.phase += sp * dt * 2.7;
    p.x = clamp(p.x, -GR + 0.5, L + GR - 0.5); p.y = clamp(p.y, -GR + 0.5, W + GR - 0.5);
  }
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i], b = players[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
    if (d < 0.75 && d > 0.001) { const push = (0.75 - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; }
  }
}

function updateBall(dt) {
  const b = ball;
  b.grace = (b.grace || 0) - dt;
  b.px = b.x; b.py = b.y;
  if (b.owner) {
    const o = b.owner;
    if (b.held) {
      b.x = o.x + Math.cos(o.face) * 0.35; b.y = o.y + Math.sin(o.face) * 0.35; b.z = 0.9;
      b.vx = o.vx; b.vy = o.vy; b.vz = 0; return;
    }
    const sp = hyp(o.vx, o.vy);
    const reach = 0.5 + 0.22 * Math.abs(Math.sin(o.phase * 0.5)) * Math.min(1, sp / 4);
    const tx = o.x + Math.cos(o.face) * reach, ty = o.y + Math.sin(o.face) * reach;
    const k = Math.min(1, dt * 18);
    b.x = lerp(b.x, tx, k); b.y = lerp(b.y, ty, k); b.z = 0; b.vx = o.vx; b.vy = o.vy; b.vz = 0;
    b.roll += sp * dt / BALL_R * 0.6;
    if (b.protected) { b.protT += dt; if (hyp(o.x - b.protX, o.y - b.protY) > 2.5 || (b.protT > 4 && !o.locked)) b.protected = false; }
    return;
  }
  b.vz -= G * dt;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if (b.z <= 0) {
    b.z = 0;
    if (b.vz < -1.6) { b.vz = -b.vz * 0.5; b.vx *= 0.9; b.vy *= 0.9; } else b.vz = 0;
  }
  const sp = hyp(b.vx, b.vy);
  if (b.z <= 0.001 && b.vz === 0) {
    const ns = Math.max(0, sp - (sp * 0.85 + 1.1) * dt);
    if (sp > 0) { b.vx *= ns / sp; b.vy *= ns / sp; }
  } else { b.vx *= 1 - 0.08 * dt; b.vy *= 1 - 0.08 * dt; }
  b.roll += sp * dt / BALL_R * 0.6;

  // штанги
  for (const gx of [0, L]) for (const py of [PT, PB]) {
    if (b.z > GOAL_H) continue;
    const dx = b.x - gx, dy = b.y - py, d = hyp(dx, dy), r = 0.12 + BALL_R;
    if (d < r && d > 0.0001) {
      const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vy -= 1.7 * vn * ny; b.x = gx + nx * r; b.y = py + ny * r; Sound.clang(); if (state === 'play') showBanner('ШТАНГА!', '', 1.0); }
    }
  }
  // поперечина
  for (const gx of [0, L]) {
    const crossed = (b.px - gx) * (b.x - gx) <= 0 && b.px !== b.x;
    if (crossed && b.y > PT && b.y < PB && b.z > GOAL_H - 0.18 && b.z < GOAL_H + 0.25 && b.inGoal < 0) {
      b.vx = -b.vx * 0.55; b.vz = Math.abs(b.vz) * 0.4 + 1; b.x = b.px; Sound.clang();
      if (state === 'play') showBanner('ПОПЕРЕЧИНА!', '', 1.0);
    }
  }
  // сітка (м'яч у воротах)
  if (b.inGoal >= 0) {
    const gx = b.inGoal === 0 ? 0 : L, back = b.inGoal === 0 ? -GOAL_D : L + GOAL_D;
    if (b.inGoal === 0 ? b.x < back + BALL_R : b.x > back - BALL_R) { b.x = back + (b.inGoal === 0 ? BALL_R : -BALL_R); b.vx *= -0.15; b.vy *= 0.5; }
    if (b.y < PT + BALL_R) { b.y = PT + BALL_R; b.vy = Math.abs(b.vy) * 0.2; }
    if (b.y > PB - BALL_R) { b.y = PB - BALL_R; b.vy = -Math.abs(b.vy) * 0.2; }
    if (b.z > GOAL_H - 0.2) { b.z = GOAL_H - 0.2; b.vz = -Math.abs(b.vz) * 0.2; }
    if (b.inGoal === 0 ? b.x > gx - 0.05 : b.x < gx + 0.05) { b.x = gx + (b.inGoal === 0 ? -0.05 : 0.05); b.vx = 0; }
  }
  b.x = clamp(b.x, -M + 1, L + M - 1); b.y = clamp(b.y, -M + 1, W + M - 1);
}

function possession() {
  if (ball.owner) return;
  let best = null, bd = 1e9, hands = false;
  for (const p of players) {
    if (p.kickCd > 0 || p.stun > 0) continue;
    const d = hyp(ball.x - p.x, ball.y - p.y);
    const h = p.gk && inOwnBox(p.team, p.x, p.y) && inOwnBox(p.team, ball.x, ball.y);
    const reach = h ? 0.8 + (p.dive > 0 ? 0.8 : 0) : 0.95;
    const zMax = h ? 2.7 : 1.2;
    if (d < reach && ball.z < zMax && d < bd) { best = p; bd = d; hands = h; }
  }
  if (!best) return;
  const rel = hyp(ball.vx - best.vx, ball.vy - best.vy);
  if (hands) {
    if (best.saveCd > 0) return;
    const skill = gkSkill(best);
    const pc = clamp(skill + 0.25 - Math.max(0, rel - 14) / 20, 0.12, 0.97);
    if (Math.random() < pc) {
      giveBall(best);
      if (rel > 14 && state === 'play' && !demo) showBanner('СЕЙВ!', '', 1.0);
    } else {
      best.saveCd = 0.7;
      const dir = TEAMS[best.team].dir;
      ball.vx = Math.abs(ball.vx) * rand(0.1, 0.3) * dir + dir * 1.5; ball.vy = (ball.y < best.y ? -1 : 1) * rand(5, 10); ball.vz = rand(1, 4);
      ball.lastTeam = best.team; ball.last = best; Sound.kick(0.3);
    }
    return;
  }
  if (rel < 15 || (best === ctrl && rel < 26) || Math.random() < 0.4) giveBall(best);
  else {
    ball.vx = ball.vx * -0.25 + rand(-2, 2); ball.vy = ball.vy * 0.4 + rand(-3, 3); ball.vz = rand(0.5, 2.5);
    best.kickCd = 0.25; ball.lastTeam = best.team; ball.last = best; Sound.kick(0.25);
  }
}

function tackles() {
  const o = ball.owner;
  if (!o || ball.held || ball.protected || ball.grace > 0) return;
  for (const p of players) {
    if (p.team === o.team || p === ctrl || p.gk || p.stun > 0 || p.tackleCd > 0) continue;
    if (hyp(p.x - ball.x, p.y - ball.y) < 1.2) {
      p.tackleCd = rand(0.6, 1.1);
      const chance = o.team === humanTeam ? D().tackle : 0.3;
      if (Math.random() < chance) winTackle(p, o); else { p.stun = 0.35; p.slide = 0.35; }
      return;
    }
  }
}

function checkBounds() {
  const b = ball;
  if (b.x < 0 || b.x > L) {
    const defending = b.x < 0 ? (TEAMS[0].dir > 0 ? 0 : 1) : (TEAMS[0].dir > 0 ? 1 : 0);
    if (b.y > PT && b.y < PB && b.z < GOAL_H) { goalScored(1 - defending); return; }
    const att = 1 - defending;
    if (b.lastTeam === defending) {
      const cx = b.x < 0 ? 0.5 : L - 0.5, cy = b.y < W / 2 ? 0.5 : W - 0.5;
      startSetpiece('corner', att, cx, cy);
    } else {
      const [x, y] = toW(defending, 5.5, b.y < W / 2 ? W / 2 - 5 : W / 2 + 5);
      startSetpiece('goalkick', defending, x, y);
    }
  } else if (b.y < 0 || b.y > W) {
    startSetpiece('throw', 1 - b.lastTeam, clamp(b.x, 1, L - 1), b.y < 0 ? 0.25 : W - 0.25);
  }
}

function startSetpiece(type, team, x, y) {
  STATS[type] = (STATS[type] || 0) + 1;
  const b = ball;
  b.owner = null; b.held = false; b.x = x; b.y = y; b.z = 0; b.vx = b.vy = b.vz = 0; b.inGoal = -1;
  let taker;
  if (type === 'goalkick') taker = players.find((p) => p.team === team && p.gk);
  else {
    let bd = 1e9;
    for (const p of players) if (p.team === team && !p.gk) { const d = hyp(p.x - x, p.y - y); if (d < bd) { bd = d; taker = p; } }
  }
  // гравець стає біля м'яча обличчям до поля
  const ax = L / 2 - x, ay = W / 2 - y, am = hyp(ax, ay);
  taker.x = x - ax / am * 0.55; taker.y = y - ay / am * 0.55; taker.vx = taker.vy = 0;
  taker.face = Math.atan2(ay, ax);
  setpiece = { type, team, taker };
  possTeam = team; passTarget = null;
  state = 'setpiece'; stateT = 1.2;
  const names = { corner: 'КУТОВИЙ', throw: 'ВКИДАННЯ', goalkick: 'УДАР ВІД ВОРІТ' };
  showBanner(names[type], TEAMS[team].name, 1.1);
  Sound.whistle(1);
  if (humanTeam === team && !taker.gk) ctrl = taker;
}

function goalScored(team) {
  score[team]++; lastGoalTeam = team;
  const side = ball.x < 0 ? 0 : 1;
  ball.inGoal = side;
  ball.owner = null; ball.held = false;
  state = 'goal'; stateT = 3.2;
  const scorer = ball.last && ball.last.team === team ? `${TEAMS[team].name} · №${ball.last.num}` : `${TEAMS[team].name} · автогол`;
  showBanner('ГОЛ!', scorer, 3.0, true);
  Sound.whistle(1); Sound.goal();
  for (let i = 0; i < 70; i++) effects.push({ x: viewW / 2, y: viewH * 0.38, vx: rand(-420, 420), vy: rand(-520, 60), life: rand(1.2, 2.4), col: i % 2 ? TEAMS[team].shirt : '#ffd34d', s: rand(3, 7), r: rand(0, 6) });
}

function endMatch() {
  state = 'fulltime'; Sound.whistle(3); Sound.crowdTo(0.15, 1);
  showBanner('ФІНАЛЬНИЙ СВИСТОК', `${score[0]} : ${score[1]}`, 2.5, true);
  setTimeout(() => {
    const t = document.getElementById('endTitle');
    t.textContent = score[0] > score[1] ? 'ПЕРЕМОГА!' : score[0] < score[1] ? 'ПОРАЗКА' : 'НІЧИЯ';
    document.getElementById('endScore').textContent = `${score[0]} : ${score[1]}`;
    document.getElementById('end').classList.remove('hidden');
  }, 2200);
}

// ───────────────────────── Головний крок ─────────────────────────
function step(dt) {
  stateT -= dt;
  if (state === 'kickoff' && stateT <= 0) {
    const t = players.find((p) => p.team === kickoffTeam && p.role === 'FW');
    giveBall(t); ball.protected = true; ball.protT = 0; ball.protX = t.x; ball.protY = t.y;
    t.decT = rand(0.4, 0.8); state = 'play'; Sound.whistle(1);
  } else if (state === 'setpiece' && stateT <= 0) {
    const t = setpiece.taker;
    giveBall(t); ball.protected = true; ball.protT = 0; ball.protX = t.x; ball.protY = t.y;
    t.locked = setpiece.type !== 'goalkick'; t.decT = rand(0.4, 0.8);
    state = 'play';
  } else if (state === 'goal' && stateT <= 0) {
    if (clock >= matchLen) endMatch(); else setupKickoff(1 - lastGoalTeam);
  } else if (state === 'play') {
    clock += dt;
    if (clock >= matchLen) { endMatch(); }
  }
  if (state === 'fulltime') { for (const p of players) { p.tvx *= 0.9; p.tvy *= 0.9; } movePlayers(dt); updateBall(dt); return; }

  if (humanTeam >= 0) humanControl(dt);
  aiControl(dt);
  movePlayers(dt);
  updateBall(dt);
  if (state === 'play') { possession(); tackles(); checkBounds(); }

  // гомін трибун залежить від небезпеки біля воріт
  if (!demo && state === 'play' && Math.random() < 0.05) {
    const near = Math.min(ball.x, L - ball.x);
    Sound.crowdTo(near < 20 ? 0.13 : 0.06, 0.8);
  }
}

function updateCamera(dt) {
  const tx = ball.x + ball.vx * 0.3, ty = ball.y - ball.z * 0.3 + ball.vy * 0.3;
  cam.x = lerp(cam.x, tx, Math.min(1, dt * 3)); cam.y = lerp(cam.y, ty, Math.min(1, dt * 3));
  const hw = viewW / 2 / PPM, hh = viewH / 2 / (PPM * YS);
  cam.x = hw * 2 >= L + 2 * M ? L / 2 : clamp(cam.x, -M + hw, L + M - hw);
  cam.y = hh * 2 >= W + 2 * M ? W / 2 : clamp(cam.y, -M + hh + 1.5, W + M - hh);
}

// ───────────────────────── Малювання ─────────────────────────
function drawLines() {
  ctx.save();
  ctx.translate(sx(0), sy(0)); ctx.scale(PPM, PPM * YS);
  ctx.strokeStyle = 'rgba(255,255,255,0.88)'; ctx.lineWidth = 0.13;
  ctx.beginPath();
  ctx.rect(0, 0, L, W);
  ctx.moveTo(L / 2, 0); ctx.lineTo(L / 2, W);
  ctx.moveTo(L / 2 + 9.15, W / 2); ctx.arc(L / 2, W / 2, 9.15, 0, Math.PI * 2);
  const pa = 40.32, ga = 18.32;
  ctx.rect(0, W / 2 - pa / 2, 16.5, pa); ctx.rect(L - 16.5, W / 2 - pa / 2, 16.5, pa);
  ctx.rect(0, W / 2 - ga / 2, 5.5, ga); ctx.rect(L - 5.5, W / 2 - ga / 2, 5.5, ga);
  const th = Math.acos((16.5 - 11) / 9.15);
  ctx.moveTo(11 + 9.15 * Math.cos(-th), W / 2 + 9.15 * Math.sin(-th)); ctx.arc(11, W / 2, 9.15, -th, th);
  ctx.moveTo(L - 11 + 9.15 * Math.cos(Math.PI - th), W / 2 + 9.15 * Math.sin(Math.PI - th)); ctx.arc(L - 11, W / 2, 9.15, Math.PI - th, Math.PI + th);
  ctx.moveTo(1, 0); ctx.arc(0, 0, 1, 0, Math.PI / 2);
  ctx.moveTo(L, 1); ctx.arc(L, 0, 1, Math.PI / 2, Math.PI);
  ctx.moveTo(L - 1, W); ctx.arc(L, W, 1, Math.PI, Math.PI * 1.5);
  ctx.moveTo(0, W - 1); ctx.arc(0, W, 1, Math.PI * 1.5, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [x, y] of [[L / 2, W / 2], [11, W / 2], [L - 11, W / 2]]) { ctx.beginPath(); ctx.arc(x, y, 0.22, 0, 7); ctx.fill(); }
  ctx.restore();
  // кутові прапорці
  for (const [x, y] of [[0, 0], [L, 0], [0, W], [L, W]]) {
    const X = sx(x), Y = sy(y);
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - 1.5 * PPM * HZ); ctx.stroke();
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(X, Y - 1.5 * PPM * HZ); ctx.lineTo(X + (x ? -10 : 10), Y - 1.5 * PPM * HZ + 4); ctx.lineTo(X, Y - 1.5 * PPM * HZ + 8); ctx.fill();
  }
}

function poly(pts, fill) {
  ctx.beginPath();
  pts.forEach(([x, y, z], i) => (i ? ctx.lineTo(sx(x), sy(y, z)) : ctx.moveTo(sx(x), sy(y, z))));
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function drawGoal(side, front) {
  const gx = side ? L : 0, bx = side ? L + GOAL_D : -GOAL_D, h = GOAL_H, hb = GOAL_H * 0.82;
  if (!front) {
    poly([[gx, PT, 0], [bx, PT, 0], [bx, PB, 0], [gx, PB, 0]], 'rgba(0,0,0,0.22)');
    poly([[bx, PT, 0], [bx, PB, 0], [bx, PB, hb], [bx, PT, hb]], netPat);
    poly([[gx, PT, 0], [bx, PT, 0], [bx, PT, hb], [gx, PT, h]], netPat);
    // тінь воріт на газоні
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(sx(gx), sy(PT)); ctx.lineTo(sx(gx + (side ? 1 : -1) * 1.2), sy(PT + 1)); ctx.lineTo(sx(gx + (side ? 1 : -1) * 1.2), sy(PB + 1)); ctx.stroke();
    // дальня штанга
    ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = 0.14 * PPM;
    ctx.beginPath(); ctx.moveTo(sx(gx), sy(PT, 0)); ctx.lineTo(sx(gx), sy(PT, h)); ctx.stroke();
  } else {
    poly([[gx, PT, h], [bx, PT, hb], [bx, PB, hb], [gx, PB, h]], netPat);
    poly([[gx, PB, 0], [bx, PB, 0], [bx, PB, hb], [gx, PB, h]], netPat);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.2 * PPM;
    ctx.beginPath(); ctx.moveTo(sx(gx), sy(PT, h)); ctx.lineTo(sx(gx), sy(PB, h)); ctx.lineTo(sx(gx), sy(PB, 0)); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.13 * PPM;
    ctx.beginPath(); ctx.moveTo(sx(gx), sy(PT, h)); ctx.lineTo(sx(gx), sy(PB, h)); ctx.lineTo(sx(gx), sy(PB, 0)); ctx.stroke();
    ctx.lineCap = 'butt';
  }
}

function drawShadows() {
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (const p of players) {
    const X = sx(p.x), Y = sy(p.y);
    for (const ox of [-1, 1]) {
      ctx.save(); ctx.translate(X, Y); ctx.rotate(Math.atan2(0.35 * YS, ox * 0.7));
      ctx.beginPath(); ctx.ellipse(0.7 * PPM, 0, 0.75 * PPM, 0.24 * PPM, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(X, Y, 0.45 * PPM, 0.2 * PPM, 0, 0, 7); ctx.fill();
  }
  const X = sx(ball.x), Y = sy(ball.y), s = Math.max(0.35, 1 - ball.z / 6);
  ctx.fillStyle = `rgba(0,0,0,${0.35 * s})`;
  ctx.beginPath(); ctx.ellipse(X + ball.z * 2, Y + 1, BALL_R * PPM * 1.2 * s + ball.z, BALL_R * PPM * 0.55 * s + ball.z * 0.4, 0, 0, 7); ctx.fill();
}

function drawPlayer(p) {
  const T = TEAMS[p.team], m = PPM * FIG;
  const X = sx(p.x), Y = sy(p.y);
  const shirt = p.gk ? T.gk : T.shirt, shirt2 = p.gk ? T.gk2 : T.shirt2;
  const sp = hyp(p.vx, p.vy);
  const fx = Math.cos(p.face), fy = Math.sin(p.face) * YS;
  const s = Math.min(1, sp / 5), st = Math.sin(p.phase) * 0.33 * s;
  const hipH = 0.85 * HZ * m, shH = 1.36 * HZ * m, headH = 1.62 * HZ * m;
  const hw = (0.25 - 0.07 * Math.abs(Math.cos(p.face))) * m;
  const bob = Math.abs(Math.sin(p.phase)) * 0.04 * m * s;
  ctx.save(); ctx.translate(X, Y);
  if (p.dive > 0) ctx.rotate(p.diveDir * (TEAMS[p.team].dir > 0 ? -1 : 1) * 1.25 * Math.min(1, (0.65 - p.dive) * 6 + 0.3));
  else if (p.slide > 0) ctx.rotate((Math.cos(p.face) >= 0 ? 1 : -1) * 1.05);
  ctx.translate(0, -bob);
  ctx.lineCap = 'round';
  // ноги
  for (const side of [-1, 1]) {
    const f = side * st;
    const hx = side * 0.1 * m, hy = -hipH;
    const footX = fx * f * m + side * 0.1 * m, footY = fy * f * m;
    const kx = (hx + footX) / 2 + fx * 0.06 * m, ky = (hy + footY) / 2;
    ctx.strokeStyle = p.skin; ctx.lineWidth = 0.13 * m;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.strokeStyle = T.socks; ctx.lineWidth = 0.12 * m;
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(footX, footY - 0.04 * m); ctx.stroke();
    ctx.fillStyle = '#151515';
    ctx.beginPath(); ctx.ellipse(footX + fx * 0.05 * m, footY, 0.09 * m, 0.06 * m, 0, 0, 7); ctx.fill();
  }
  // шорти
  ctx.fillStyle = p.gk ? '#222' : T.shorts;
  ctx.beginPath(); ctx.roundRect(-hw * 0.95, -hipH - 0.16 * m, hw * 1.9, 0.26 * m, 0.05 * m); ctx.fill();
  // руки (позаду тулуба, якщо дивиться вгору)
  const arm = (side) => {
    const a = -side * st;
    const sxp = side * (hw + 0.02 * m), syp = -shH + 0.06 * m;
    const ex = sxp + fx * a * 0.9 * m + side * 0.05 * m, ey = syp + 0.48 * HZ * m + fy * a * 0.6 * m;
    ctx.strokeStyle = shirt; ctx.lineWidth = 0.12 * m;
    ctx.beginPath(); ctx.moveTo(sxp, syp); ctx.lineTo(lerp(sxp, ex, 0.45), lerp(syp, ey, 0.45)); ctx.stroke();
    ctx.strokeStyle = p.gk ? '#f5f5f5' : p.skin; ctx.lineWidth = p.gk ? 0.12 * m : 0.09 * m;
    ctx.beginPath(); ctx.moveTo(lerp(sxp, ex, 0.45), lerp(syp, ey, 0.45)); ctx.lineTo(ex, ey); ctx.stroke();
  };
  arm(-1); arm(1);
  // тулуб з об'ємом
  const gr = ctx.createLinearGradient(-hw, 0, hw, 0);
  gr.addColorStop(0, shirt); gr.addColorStop(0.55, shirt); gr.addColorStop(1, shirt2);
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.roundRect(-hw, -shH, hw * 2, shH - hipH + 0.02 * m, [0.12 * m, 0.12 * m, 0.05 * m, 0.05 * m]); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-hw, -shH + 0.04 * m, hw * 2, 0.05 * m);
  if (Math.sin(p.face) < -0.25) {   // видно спину — номер
    ctx.fillStyle = p.gk ? '#111' : '#fff';
    ctx.font = `800 ${Math.round(0.3 * m)}px Segoe UI, Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.num, 0, -(shH + hipH) / 2);
  }
  // голова
  const hr = 0.16 * m;
  ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(0, -headH, hr, 0, 7); ctx.fill();
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  if (Math.sin(p.face) < -0.25) ctx.arc(0, -headH, hr, 0, 7);
  else ctx.arc(-fx * hr * 0.35, -headH - fy * hr * 0.3 - hr * 0.15, hr * 0.92, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  ctx.restore();
}

function drawBall() {
  const b = ball, r = BALL_R * PPM;
  const X = sx(b.x), Y = sy(b.y, b.z) - r;
  if (trail.length > 1 && hyp(b.vx, b.vy) > 13 && !b.owner) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = r * 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); trail.forEach(([x, y, z], i) => (i ? ctx.lineTo(sx(x), sy(y, z) - r) : ctx.moveTo(sx(x), sy(y, z) - r))); ctx.stroke();
  }
  const gr = ctx.createRadialGradient(X - r * 0.35, Y - r * 0.35, r * 0.1, X, Y, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#b9bec6');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.clip();
  ctx.fillStyle = '#1d1f24';
  for (let k = 0; k < 3; k++) {
    const a = b.roll + k * 2.094;
    ctx.beginPath(); ctx.arc(X + Math.cos(a) * r * 0.62, Y + Math.sin(a * 0.7 + k) * r * 0.45, r * 0.3, 0, 7); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.stroke();
}

function drawCtrlMarker() {
  if (!ctrl || humanTeam < 0) return;
  const X = sx(ctrl.x), Y = sy(ctrl.y);
  ctx.strokeStyle = 'rgba(255,225,77,0.95)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(X, Y, 0.62 * PPM, 0.62 * PPM * YS, 0, 0, 7); ctx.stroke();
  // стрілка напрямку
  const a = ctrl.face, ex = X + Math.cos(a) * 0.95 * PPM, ey = Y + Math.sin(a) * 0.95 * PPM * YS;
  ctx.fillStyle = 'rgba(255,225,77,0.95)';
  ctx.beginPath(); ctx.moveTo(ex, ey);
  ctx.lineTo(X + Math.cos(a + 0.35) * 0.68 * PPM, Y + Math.sin(a + 0.35) * 0.68 * PPM * YS);
  ctx.lineTo(X + Math.cos(a - 0.35) * 0.68 * PPM, Y + Math.sin(a - 0.35) * 0.68 * PPM * YS); ctx.fill();
}
function drawCtrlLabel() {
  if (!ctrl || humanTeam < 0) return;
  const X = sx(ctrl.x), Y = sy(ctrl.y, 2.45);
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath(); ctx.moveTo(X - 6, Y - 8); ctx.lineTo(X + 6, Y - 8); ctx.lineTo(X, Y); ctx.fill();
  ctx.font = '800 12px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(ctrl.num, X + 1, Y - 9);
  ctx.fillStyle = '#fff'; ctx.fillText(ctrl.num, X, Y - 10);
  if (charging) {
    const w = 46, h = 7, bx = X - w / 2, by = Y - 32;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.beginPath(); ctx.roundRect(bx - 2, by - 2, w + 4, h + 4, 4); ctx.fill();
    const g = ctx.createLinearGradient(bx, 0, bx + w, 0);
    g.addColorStop(0, '#4cd964'); g.addColorStop(0.6, '#ffd34d'); g.addColorStop(1, '#ff3b30');
    ctx.fillStyle = g; ctx.fillRect(bx, by, w * charge, h);
  }
}

function fmtTime() {
  const gs = Math.min(90 * 60, Math.floor(clock / matchLen * 90 * 60));
  return `${String(Math.floor(gs / 60)).padStart(2, '0')}:${String(gs % 60).padStart(2, '0')}`;
}

function drawHUD(dt) {
  if (!demo) {
    // табло
    const x = 18, y = 16, h = 38;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.roundRect(x, y, 44, h, [8, 0, 0, 8]); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#1a1406'; ctx.font = '900 22px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Г', x + 22, y + h / 2 + 1);
    const gx = ctx.createLinearGradient(0, y, 0, y + h); gx.addColorStop(0, 'rgba(26,32,46,0.95)'); gx.addColorStop(1, 'rgba(10,13,20,0.95)');
    ctx.fillStyle = gx; ctx.fillRect(x + 44, y, 236, h);
    ctx.fillStyle = TEAMS[0].shirt; ctx.fillRect(x + 50, y + 8, 5, h - 16);
    ctx.fillStyle = TEAMS[1].shirt; ctx.fillRect(x + 225, y + 8, 5, h - 16);
    ctx.fillStyle = '#fff'; ctx.font = '800 16px Segoe UI, Arial';
    ctx.fillText(TEAMS[0].short, x + 82, y + h / 2 + 1); ctx.fillText(TEAMS[1].short, x + 198, y + h / 2 + 1);
    ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.roundRect(x + 112, y + 5, 56, h - 10, 5); ctx.fill();
    ctx.fillStyle = '#0d111a'; ctx.font = '900 20px Segoe UI, Arial';
    ctx.fillText(`${score[0]}–${score[1]}`, x + 140, y + h / 2 + 1);
    ctx.fillStyle = 'rgba(8,10,16,0.95)'; ctx.beginPath(); ctx.roundRect(x + 280, y, 74, h, [0, 8, 8, 0]); ctx.fill();
    ctx.fillStyle = '#ffd34d'; ctx.font = '700 17px Segoe UI, Arial'; ctx.fillText(fmtTime(), x + 317, y + h / 2 + 1);
    ctx.restore();
    drawMinimap();
  }
  // банер
  if (banner) {
    banner.t += dt;
    const k = banner.t / banner.dur;
    if (k >= 1) banner = null;
    else {
      const a = Math.min(1, banner.t * 6, (1 - k) * 5);
      const sc = banner.big ? 1 + Math.max(0, 0.4 - banner.t * 2) : 1;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(viewW / 2, viewH * (banner.big ? 0.36 : 0.2)); ctx.scale(sc, sc);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fs = banner.big ? 96 : 34;
      ctx.font = `900 ${fs}px Segoe UI, Arial`;
      const tw = ctx.measureText(banner.text).width;
      if (!banner.big) { ctx.fillStyle = 'rgba(8,12,20,0.75)'; ctx.beginPath(); ctx.roundRect(-tw / 2 - 24, -30, tw + 48, banner.sub ? 84 : 60, 12); ctx.fill(); }
      ctx.lineWidth = banner.big ? 10 : 0; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      if (banner.big) ctx.strokeText(banner.text, 0, 0);
      const g = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2); g.addColorStop(0, '#fff7cf'); g.addColorStop(0.5, '#ffd34d'); g.addColorStop(1, '#e09400');
      ctx.fillStyle = banner.big ? g : '#ffffff'; ctx.fillText(banner.text, 0, 0);
      if (banner.sub) { ctx.font = `700 ${banner.big ? 26 : 16}px Segoe UI, Arial`; ctx.fillStyle = '#e8eef8'; ctx.fillText(banner.sub, 0, banner.big ? 70 : 34); }
      ctx.restore();
    }
  }
  // конфеті
  for (const e of effects) {
    e.life -= dt; e.vy += 600 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.r += dt * 8;
    ctx.save(); ctx.globalAlpha = Math.min(1, e.life); ctx.translate(e.x, e.y); ctx.rotate(e.r); ctx.fillStyle = e.col; ctx.fillRect(-e.s / 2, -e.s / 4, e.s, e.s / 2); ctx.restore();
  }
  effects = effects.filter((e) => e.life > 0);
}

function drawMinimap() {
  const w = 190, h = w * W / L * 0.95, x = viewW / 2 - w / 2, y = viewH - h - 14;
  ctx.save();
  ctx.fillStyle = 'rgba(10,30,14,0.6)'; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 6); ctx.fill();
  ctx.strokeRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
  const mx = (v) => x + v / L * w, my = (v) => y + v / W * h;
  for (const p of players) {
    ctx.fillStyle = p.gk ? TEAMS[p.team].gk : TEAMS[p.team].shirt;
    ctx.beginPath(); ctx.arc(mx(p.x), my(p.y), p === ctrl ? 4 : 3, 0, 7); ctx.fill();
    if (p === ctrl) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx(ball.x), my(ball.y), 2.4, 0, 7); ctx.fill();
  ctx.restore();
}

function drawCrowdFlashes(dt) {
  if (Math.random() < 0.5 && crowdSpots.length) {
    const [x, y] = crowdSpots[(Math.random() * crowdSpots.length) | 0];
    flashes.push({ x, y, life: 0.12 });
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (const f of flashes) { f.life -= dt; ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y) - 6, 2.2, 0, 7); ctx.fill(); }
  flashes = flashes.filter((f) => f.life > 0);
}

function render(dt) {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, viewW, viewH);
  ctx.drawImage(worldCv, Math.round(sx(-M)), Math.round(sy(-M)));
  drawCrowdFlashes(dt);
  drawLines();
  drawGoal(0, false); drawGoal(1, false);
  drawShadows();
  drawCtrlMarker();
  const ents = players.map((p) => ({ y: p.y, p }));
  ents.push({ y: ball.y + 0.01, b: true });
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) e.b ? drawBall() : drawPlayer(e.p);
  drawGoal(0, true); drawGoal(1, true);
  drawCtrlLabel();
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, viewW, viewH);
  drawHUD(dt);
}

// ───────────────────────── Цикл ─────────────────────────
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!paused) {
    acc += dt;
    while (acc >= DT) { step(DT); acc -= DT; }
    trail.push([ball.x, ball.y, ball.z]); if (trail.length > 7) trail.shift();
    updateCamera(dt);
  }
  render(paused ? 0 : dt);
  requestAnimationFrame(frame);
}

// ───────────────────────── Меню та інтерфейс ─────────────────────────
const $ = (id) => document.getElementById(id);
document.querySelectorAll('.choices').forEach((group) => {
  group.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    group.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    settings[group.dataset.opt] = group.dataset.opt === 'mins' ? +b.dataset.v : b.dataset.v;
  });
});
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function play() {
  Sound.init();
  ['menu', 'end', 'pause'].forEach((id) => $(id).classList.add('hidden'));
  if (isTouch) $('touch').classList.remove('hidden');
  paused = false;
  startMatch(false);
}
function toMenu() {
  ['end', 'pause'].forEach((id) => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden'); $('touch').classList.add('hidden');
  paused = false; Sound.crowdTo(0.03);
  startMatch(true);
}
function togglePause() {
  if (demo || state === 'fulltime') return;
  paused = !paused;
  $('pause').classList.toggle('hidden', !paused);
}
$('play').onclick = play;
$('again').onclick = play;
$('resume').onclick = togglePause;
$('toMenu1').onclick = toMenu;
$('toMenu2').onclick = toMenu;
$('tPause').onclick = togglePause;

// сенсорне керування
(() => {
  const stick = $('stick'), knob = $('knob');
  let id = null, cx = 0, cy = 0;
  stick.addEventListener('pointerdown', (e) => { id = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(id); mv(e); });
  const mv = (e) => {
    if (e.pointerId !== id) return;
    let dx = (e.clientX - cx) / 55, dy = (e.clientY - cy) / 55; const m = hyp(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    touch.dx = Math.abs(dx) > 0.15 ? dx : 0; touch.dy = Math.abs(dy) > 0.15 ? dy : 0;
    knob.style.transform = `translate(${dx * 45}px, ${dy * 45}px)`;
  };
  stick.addEventListener('pointermove', mv);
  const up = (e) => { if (e.pointerId !== id) return; id = null; touch.dx = touch.dy = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', up); stick.addEventListener('pointercancel', up);
  const btn = (el, down, upf) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); down(); });
    el.addEventListener('pointerup', (e) => { e.preventDefault(); upf(); });
    el.addEventListener('pointerleave', () => upf());
  };
  btn($('tPass'), () => (touch.passPress = true), () => {});
  btn($('tShoot'), () => { touch.shoot = true; touch.shootPress = true; }, () => { if (touch.shoot) { touch.shoot = false; touch.shootRelease = true; } });
  btn($('tSprint'), () => (touch.sprint = true), () => (touch.sprint = false));
})();

buildWorld();
startMatch(true);
requestAnimationFrame(frame);

// для тестів
window.GOLEADOR = {
  get state() { return state; }, get score() { return score; }, get ball() { return ball; }, get players() { return players; },
  get ctrl() { return ctrl; }, get clock() { return clock; }, step, startMatch, play, settings, STATS, shootAt,
};
})();
