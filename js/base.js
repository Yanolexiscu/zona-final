'use strict';
// Zona Final · Constantes, estado, sonido, geometría, mapa, terreno y jugadores
// (los archivos comparten variables globales y se cargan en orden desde index.html)
/* =========================================================
   Zona Final v2 — battle royale offline (vista 3D con Three.js; 2D de reserva)
   ========================================================= */
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1, touchMode = false;
function resize() {
  DPR = Math.min(touchMode ? 1.5 : 2, window.devicePixelRatio || 1);
  VW = innerWidth; VH = innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
}
addEventListener('resize', resize); resize();

/* ---------- Constantes ---------- */
const WORLD = 3200, T = 14, GAP = 72, HEAL_TIME = 2.5, SPEED = 210, SPRINT = 1.45, GS = 0.75;
const PLANE_DUR = 15, GLIDE = 5, GLIDE_SPEED = 300, CRATE_HP = 50;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const lerp = (a, b, k) => a + (b - a) * k;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const TIERS = [
  { name: 'Común',      color: '#b8c0cc', mult: 1 },
  { name: 'Rara',       color: '#4dabf7', mult: 1.12 },
  { name: 'Épica',      color: '#c77dff', mult: 1.25 },
  { name: 'Legendaria', color: '#ffb020', mult: 1.4 },
];
const WEAPONS = {
  pistola:       { name: 'Pistola',       dmg: 20, rate: 0.28,  speed: 950,  spread: 0.04,  mag: 12, reload: 1.1, range: 650,  pellets: 1, auto: false, rank: 0, color: '#c9d1d9', len: 14, pref: 300, snd: [2600, 0.18] },
  subfusil:      { name: 'Subfusil',      dmg: 11, rate: 0.075, speed: 950,  spread: 0.11,  mag: 32, reload: 1.6, range: 520,  pellets: 1, auto: true,  rank: 1, color: '#7ee787', len: 20, pref: 230, snd: [3200, 0.12] },
  escopeta:      { name: 'Escopeta',      dmg: 13, rate: 0.85,  speed: 850,  spread: 0.26,  mag: 5,  reload: 2.2, range: 380,  pellets: 8, auto: false, rank: 1, color: '#ffa657', len: 22, pref: 140, snd: [1100, 0.38] },
  rifle:         { name: 'Rifle',         dmg: 16, rate: 0.11,  speed: 1150, spread: 0.05,  mag: 30, reload: 1.9, range: 800,  pellets: 1, auto: true,  rank: 2, color: '#79c0ff', len: 26, pref: 420, snd: [2200, 0.2] },
  francotirador: { name: 'Francotirador', dmg: 85, rate: 1.4,   speed: 1900, spread: 0.004, mag: 5,  reload: 2.6, range: 1400, pellets: 1, auto: false, rank: 2, color: '#d2a8ff', len: 32, pref: 650, snd: [800, 0.55] },
  // Solo aparece en los suministros aéreos
  ametralladora: { name: 'Ametralladora', dmg: 17, rate: 0.085, speed: 1150, spread: 0.07,  mag: 60, reload: 3.0, range: 820,  pellets: 1, auto: true,  rank: 3, color: '#ffd700', len: 30, pref: 380, snd: [1800, 0.22] },
  revolver:      { name: 'Revólver',      dmg: 38, rate: 0.55,  speed: 1050, spread: 0.025, mag: 6,  reload: 1.8, range: 700,  pellets: 1, auto: false, rank: 1, color: '#b0895a', len: 16, pref: 320, snd: [1400, 0.3] },
  mini:          { name: 'Mini metralleta', dmg: 8, rate: 0.05, speed: 900,  spread: 0.16,  mag: 25, reload: 1.3, range: 420,  pellets: 1, auto: true,  rank: 1, color: '#ff7ab8', len: 15, pref: 180, snd: [3600, 0.09] },
  tirador:       { name: 'Rifle de tirador', dmg: 42, rate: 0.42, speed: 1500, spread: 0.012, mag: 10, reload: 2.2, range: 1100, pellets: 1, auto: false, rank: 2, color: '#9be7ff', len: 30, pref: 520, snd: [1200, 0.35] },
  // silenciosa: los bots no oyen sus disparos
  ballesta:      { name: 'Ballesta',      dmg: 72, rate: 1.0,   speed: 1250, spread: 0.008, mag: 1,  reload: 1.3, range: 1000, pellets: 1, auto: false, rank: 2, color: '#8a5a2b', len: 24, pref: 500, snd: [500, 0.12], silent: true },
  // el cohete explota al chocar (rara; también sale en los suministros aéreos)
  lanzacohetes:  { name: 'Lanzacohetes',  dmg: 30, rate: 1.4,   speed: 620,  spread: 0.01,  mag: 1,  reload: 2.8, range: 900,  pellets: 1, auto: false, rank: 3, color: '#5a7a3a', len: 30, pref: 420, snd: [300, 0.5], rocket: true },
};
const NADE_R = 150, NADE_DMG = 80, NADE_FUSE = 1.8, NADE_FLY = 0.7, NADE_MAX = 420, DROP_FALL = 8;
const makeGun = (type, tier = 0) => ({ type, tier, mag: WEAPONS[type].mag });
const rollTier = () => { const r = Math.random(); return r < 0.55 ? 0 : r < 0.86 ? 1 : 2; };
const gunValue = g => WEAPONS[g.type].rank + g.tier * 0.6;

const DIFFS = {
  facil:   { aim: 0.22, react: 0.8,  bots: 19 },
  normal:  { aim: 0.13, react: 0.5,  bots: 24 },
  dificil: { aim: 0.07, react: 0.28, bots: 29 },
};
const NAMES = ['Lobo', 'Halcón', 'Zorro', 'Tigre', 'Cobra', 'Puma', 'Águila', 'Oso', 'Lince', 'Búho',
  'Jaguar', 'Tiburón', 'Coyote', 'Cuervo', 'Pantera', 'Toro', 'Rayo', 'Sombra', 'Trueno', 'Fénix',
  'Mapache', 'Hiena', 'Bisonte', 'Escorpión', 'Dragón', 'Vikingo', 'Ninja', 'Pirata', 'Cometa', 'Tornado'];
const ROOF_COLORS = ['#8c3b2e', '#3d5a80', '#5c4b8a', '#2f6d5a', '#7a5c2e', '#6b2f4a'];
// Mapas: cada uno cambia colores, cantidad de casas/árboles/rocas y algunos detalles
const MAPS = {
  bosque: { name: '🌲 Bosque', bg: '#132a12', ground: '#4e8a3e', blobs: ['96,156,70', '58,112,46'], road: ['#7d6a48', '#a08a62'],
    shore: '#c8b98a', water: ['#2f6fa3', '#3b86c4'], grass: ['rgba(25,65,22,.35)', 'rgba(140,200,100,.25)'], grassN: [6000, 3500],
    dots: ['#ffd34d', '#ff8fa3', '#ffffff', '#b197fc'], floor: '#a3865f', roofs: ['#8c3b2e', '#3d5a80', '#5c4b8a', '#2f6d5a', '#7a5c2e', '#6b2f4a'],
    tree: ['#1c4a1b', '#2f6e2b', '#3f8f3a'], bush: ['#25602a', '#3d8c3a', '#56a84c'], rock: ['#8f949b', '#5d6268'],
    lakes: 3, houses: 13, gap: 140, rocks: 55, trees: 75, crates: 30, bushes: 50 },
  desierto: { name: '🏜️ Desierto', bg: '#5a4528', ground: '#d9b97a', blobs: ['236,210,150', '190,150,95'], road: ['#8a7350', '#b89c6c'],
    shore: '#e8d4a0', water: ['#2a8f9e', '#45b3c4'], grass: ['rgba(140,110,60,.3)', 'rgba(250,235,200,.35)'], grassN: [1500, 1500],
    dots: ['#b5865a', '#8a6a4a', '#efe0bb'], floor: '#c9a27a', roofs: ['#b5653a', '#c98b4a', '#9a5a3a', '#d8b48a', '#a8703a'],
    tree: ['#2f5e2a', '#4f8a3c', '#7cb85a'], bush: ['#8a7a3a', '#a89a4a', '#c8b86a'], rock: ['#c07a48', '#7e4f2e'],
    lakes: 1, houses: 11, gap: 140, rocks: 85, trees: 45, crates: 30, bushes: 30, cactus: true },
  nieve: { name: '❄️ Nieve', bg: '#8fa3b8', ground: '#e4ebf2', blobs: ['255,255,255', '196,210,228'], road: ['#93a1b2', '#c1cbd8'],
    shore: '#d3e3f0', water: ['#8cc0e6', '#b8dcf5'], grass: ['rgba(140,160,185,.3)', 'rgba(255,255,255,.6)'], grassN: [2500, 2500],
    dots: ['#ffffff', '#c8d6e6', '#a8b8cc'], floor: '#9c7b5a', roofs: ['#7a2f2f', '#3d4f6b', '#5a3a5a', '#2f4f4a', '#6b4a2f'],
    tree: ['#123222', '#1d4c31', '#2b6745'], bush: ['#6f8f80', '#9cb8aa', '#e8f0f5'], rock: ['#8d9db0', '#5d6c7e'],
    lakes: 3, houses: 12, gap: 140, rocks: 55, trees: 100, crates: 30, bushes: 40, snow: true },
  ciudad: { name: '🏙️ Ciudad', bg: '#25282e', ground: '#80858d', blobs: ['104,109,116', '150,155,160'], road: ['#34373c', '#4b4f55'],
    shore: '#b0b5bb', water: ['#2f6fa3', '#3b86c4'], grass: ['rgba(50,50,50,.3)', 'rgba(210,210,210,.15)'], grassN: [2000, 1000],
    dots: ['#5a5e64', '#a0a4aa'], floor: '#b9b2a6', roofs: ['#4a4f5a', '#6b5a4a', '#3d5a6b', '#7a4a4a', '#5a6b4a', '#8a8070'],
    tree: ['#1c4a1b', '#2f6e2b', '#3f8f3a'], bush: ['#2a5a2a', '#3d7a3a', '#56994c'], rock: ['#9a9ea6', '#62666d'],
    lakes: 1, houses: 26, gap: 85, rocks: 18, trees: 30, crates: 60, bushes: 28, city: true },
  playa: { name: '🏝️ Playa', bg: '#1b6c9c', ground: '#ecd9a0', blobs: ['250,236,190', '214,190,130'], road: ['#b89c6c', '#d8c08c'],
    shore: '#f6e7b8', water: ['#1e8fc6', '#4cc3e8'], grass: ['rgba(170,140,80,.25)', 'rgba(255,255,255,.35)'], grassN: [1500, 1500],
    dots: ['#ffffff', '#ffb3c1', '#f5c46b', '#c9b48a'], floor: '#d8c4a0', roofs: ['#2bb3a8', '#ff8a5c', '#ffd34d', '#5c9eff', '#e5484d'],
    tree: ['#2f6a2a', '#4a9a3a', '#7cc85a'], bush: ['#3d8c3a', '#5aae4c', '#86d46a'], rock: ['#c9bfae', '#8f8676'],
    lakes: 7, pondR: 1.7, houses: 10, gap: 140, rocks: 35, trees: 60, crates: 30, bushes: 35, palm: true },
  volcan: { name: '🌋 Volcán', bg: '#120c0a', ground: '#3d3431', blobs: ['70,58,54', '28,22,20'], road: ['#1f1a18', '#2e2724'],
    shore: '#1a1412', water: ['#c2410c', '#fb8c1f'], grass: ['rgba(10,8,8,.35)', 'rgba(255,120,40,.12)'], grassN: [2500, 1200],
    dots: ['#ff6a1f', '#6b5a52', '#2a2220'], floor: '#5a4a42', roofs: ['#2a2220', '#4a2a22', '#3a3a3a', '#5a2a1a'],
    tree: ['#2a2420', '#4a3a30', '#6b5a48'], bush: ['#3a2e28', '#4a3a30', '#6b4a3a'], rock: ['#4a403c', '#221c1a'],
    lakes: 5, houses: 11, gap: 140, rocks: 90, trees: 35, crates: 30, bushes: 25, lava: true },
  otono: { name: '🍂 Otoño', bg: '#2a1a10', ground: '#7a8a3e', blobs: ['176,140,60', '110,90,40'], road: ['#6b5032', '#8f7048'],
    shore: '#c8b98a', water: ['#2f6fa3', '#3b86c4'], grass: ['rgba(80,60,20,.3)', 'rgba(220,170,80,.3)'], grassN: [4000, 3000],
    dots: ['#e5484d', '#f08c3a', '#ffd34d', '#b85c16'], floor: '#a3865f', roofs: ['#8c3b2e', '#5c4b8a', '#2f6d5a', '#7a5c2e'],
    tree: ['#7a2a10', '#c4501a', '#f0a030'], bush: ['#8a4a1a', '#b86a2a', '#e0a040'], rock: ['#8f949b', '#5d6268'],
    lakes: 3, houses: 13, gap: 140, rocks: 50, trees: 90, crates: 30, bushes: 50 },
  noche: { name: '🌙 Noche', bg: '#04060e', ground: '#35553a', blobs: ['60,95,65', '22,44,30'], road: ['#2c2c33', '#3c3c45'],
    shore: '#5a5a48', water: ['#14304a', '#1f4a70'], grass: ['rgba(10,25,12,.4)', 'rgba(110,150,120,.2)'], grassN: [4000, 2000],
    dots: ['#c8d0ff', '#8890b0', '#ffe9a3'], floor: '#7a6448', roofs: ['#5a3a3a', '#3a4a6a', '#4a3a5a', '#3a5a4a', '#5a4a30'],
    tree: ['#10301a', '#1c4a26', '#2a6236'], bush: ['#1a4420', '#24582c', '#30703a'], rock: ['#6a7080', '#3a3e4a'],
    lakes: 3, houses: 13, gap: 140, rocks: 50, trees: 80, crates: 30, bushes: 50, night: true },
};
const MAP_KEYS = Object.keys(MAPS);
let mapKey = 'bosque', TH = MAPS.bosque;
const HUMAN_COLORS = ['#ffd34d', '#4dd4ff', '#ff6bd6', '#7dff6b', '#ff9f43', '#b28dff', '#ffffff', '#ff5c5c'];
// Códigos compactos para la red
// Personajes originales con una habilidad cada uno
const CHARS = [
  { id: 'rayo', name: 'Rayo', icon: '⚡', desc: 'Corre un 12 % más rápido' },
  { id: 'doc', name: 'Doc', icon: '🩺', desc: 'Se cura y reanima más rápido, y cura +20' },
  { id: 'tanque', name: 'Tanque', icon: '🛡️', desc: 'Aterriza con 50 de escudo' },
  { id: 'rastreador', name: 'Rastreador', icon: '👁️', desc: 'Ve en el minimapa a los enemigos que disparan cerca' },
  { id: 'ingeniera', name: 'Ingeniera', icon: '🧱', desc: 'Empieza con 3 paredes y las suyas aguantan más' },
];
const chIs = (e, id) => !!e && !!CHARS[e.ch] && CHARS[e.ch].id === id;
// Skins originales: ropa, piel, pelo/sombrero y estampado. Algunas se desbloquean jugando (need: estadística del teléfono)
const SKINS = [
  { name: 'Recluta',     shirt: '#4f7a3a', skin: '#f1c27d', hair: '#4a2f1b', hat: 'hair' },
  { name: 'Urbano',      shirt: '#5b6270', skin: '#c68e5a', hair: '#1d1d1d', hat: 'hood', hatC: '#454b57', pack: '#2c3038' },
  { name: 'Deportista',  shirt: '#e5484d', skin: '#8d5a3b', hair: '#111', hat: 'cap', hatC: '#ffffff', pat: 'stripe', patC: '#ffffff' },
  { name: 'Camuflaje',   shirt: '#5f6e3c', skin: '#e0ac69', hair: '#3b2a1a', hat: 'helmet', hatC: '#4c5a30', pat: 'camo', pack: '#4a3b26' },
  { name: 'Pirata',      shirt: '#f2efe6', skin: '#d9a066', hair: '#2a1a0e', hat: 'bandana', hatC: '#c62828', pat: 'stripe', patC: '#c62828', need: { k: 'games', n: 3 }, price: 300 },
  { name: 'Ninja',       shirt: '#1e1f26', skin: '#f1c27d', hair: '#000', hat: 'hood', hatC: '#15161b', band: '#e5484d', need: { k: 'kills', n: 10 }, price: 500 },
  { name: 'Zombi',       shirt: '#5a6b4a', skin: '#8fbf6a', hair: '#2d3a22', hat: 'hair', pat: 'torn', need: { k: 'kills', n: 25 }, price: 600 },
  { name: 'Astronauta',  shirt: '#e9edf2', skin: '#f1c27d', hat: 'helmet', hatC: '#f4f6f8', visor: '#3d8bfd', pack: '#c9d1d9', need: { k: 'wins', n: 1 }, price: 800 },
  { name: 'Robot',       shirt: '#8a96a8', skin: '#b8c2d0', hat: 'robot', hatC: '#a9b4c4', pat: 'panel', need: { k: 'games', n: 10 }, price: 700 },
  { name: 'Hielo',       shirt: '#7cc6ff', skin: '#ffe3cf', hair: '#ffffff', hat: 'hair', pat: 'frost', need: { k: 'kills', n: 50 }, price: 900 },
  { name: 'Neón',        shirt: '#2b1645', skin: '#c68e5a', hair: '#ff3df2', hat: 'mohawk', glow: '#ff3df2', need: { k: 'wins', n: 3 }, price: 1000 },
  { name: 'Rey Dorado',  shirt: '#b8860b', skin: '#e0ac69', hair: '#3b2a1a', hat: 'crown', hatC: '#ffd700', pat: 'royal', patC: '#7a1f1f', need: { k: 'wins', n: 5 }, price: 1500 },
  { name: 'Vaquero',     shirt: '#8b5a2b', skin: '#e0ac69', hair: '#5a3a1a', hat: 'cowboy', hatC: '#6b4423', pat: 'vest', patC: '#3e2a16', price: 250 },
  { name: 'Bombero',     shirt: '#c62828', skin: '#f1c27d', hat: 'helmet', hatC: '#f5c518', pat: 'reflect', patC: '#f5f56a', pack: '#9e9e9e', price: 300 },
  { name: 'Médico',      shirt: '#e8f4f8', skin: '#c68e5a', hair: '#1d1d1d', hat: 'cap', hatC: '#e8f4f8', pat: 'cross', patC: '#e5484d', price: 300 },
  { name: 'Explorador',  shirt: '#c2a878', skin: '#f1c27d', hair: '#6b4423', hat: 'safari', hatC: '#d8c08c', pack: '#6b5a3a', price: 350 },
  { name: 'Chef',        shirt: '#f7f7f7', skin: '#e0ac69', hair: '#222', hat: 'chef', hatC: '#ffffff', pat: 'buttons', patC: '#333', price: 350 },
  { name: 'Buzo',        shirt: '#1f3b57', skin: '#f1c27d', hat: 'helmet', hatC: '#ffb020', visor: '#7fd3ff', pack: '#ffb020', price: 450 },
  { name: 'Caballero',   shirt: '#9aa3ad', skin: '#f1c27d', hat: 'knight', hatC: '#c0c8d2', pat: 'royal', patC: '#2a4d9b', price: 650 },
  { name: 'Vikingo',     shirt: '#7a5230', skin: '#f1c27d', hair: '#e0a040', hat: 'horns', hatC: '#8d969f', pat: 'fur', price: 650 },
  { name: 'Mago',        shirt: '#3a2a7a', skin: '#f1c27d', hat: 'wizard', hatC: '#3a2a7a', pat: 'stars', patC: '#ffd34d', price: 750 },
  { name: 'Gato',        shirt: '#f08c3a', skin: '#ffe0c0', hat: 'ears', hatC: '#f08c3a', pat: 'stripe', patC: '#b85c16', price: 550 },
  { name: 'Dino',        shirt: '#4caf50', skin: '#ffe0c0', hat: 'spikes', hatC: '#4caf50', spikeC: '#ffd34d', price: 700 },
  { name: 'Samurái',     shirt: '#8e1b1b', skin: '#e0ac69', hat: 'kabuto', hatC: '#2a2a2a', pat: 'plates', patC: '#1d1d1d', price: 950 },
  { name: 'Esqueleto',   shirt: '#141414', skin: '#e8e8e8', hat: 'skull', pat: 'bones', patC: '#e8e8e8', price: 900 },
  { name: 'Fantasma',    shirt: '#e6ecff', skin: '#e6ecff', hat: 'ghost', glow: '#b9c8ff', alpha: 0.8, price: 1100 },
  { name: 'Lava',        shirt: '#2a1a14', skin: '#3a2a22', hat: 'hair', hair: '#ff5a1f', pat: 'lava', glow: '#ff5a1f', price: 1300 },
  { name: 'Galaxia',     shirt: '#1a1240', skin: '#c68e5a', hair: '#7a5cff', hat: 'hood', hatC: '#24185a', pat: 'stars', patC: '#ffffff', glow: '#7a5cff', price: 1600 },
  { name: 'Diamante',    shirt: '#5ee7ff', skin: '#e0ac69', hair: '#1d1d1d', hat: 'crown', hatC: '#bff6ff', pat: 'gem', glow: '#5ee7ff', price: 2500 },
  { name: 'Señor Sandía', shirt: '#2e9e4f', skin: '#ff5d6c', glove: '#ffffff', hat: 'melon', pat: 'track', patC: '#ffffff', price: 700 },
  { name: 'Estatua Viva', shirt: '#9aa0a6', skin: '#a9afb5', hat: 'stone', pat: 'cracks', cape: '#c62828', price: 900 },
  { name: 'Tiburón',     shirt: '#4a86c5', skin: '#f1c27d', glove: '#4a86c5', hat: 'shark', hatC: '#4a86c5', pat: 'belly', patC: '#e8f0f8', price: 800 },
  { name: 'Calabaza',    shirt: '#1d1d22', skin: '#e0ac69', glove: '#2a2a30', hat: 'pumpkin', hatC: '#ff8a1f', glow: '#ff8a1f', pat: 'buttons', patC: '#ff8a1f', price: 850 },
  { name: 'Cactus Vaquero', shirt: '#3f9a4a', skin: '#3f9a4a', hat: 'cactushead', hatC: '#7a4a24', pat: 'spines', price: 750 },
  { name: 'Zorro Ninja', shirt: '#24232b', skin: '#f08c3a', hat: 'fox', hatC: '#f08c3a', band: '#24232b', pat: 'belt', patC: '#f08c3a', price: 950 },
  { name: 'Hamburguesa', shirt: '#d8402f', skin: '#f1c27d', hat: 'burger', hatC: '#d8402f', pat: 'apron', patC: '#ffd34d', price: 600 },
  { name: 'Yeti',        shirt: '#eef3f8', skin: '#9fd6ff', hat: 'yeti', hatC: '#eef3f8', pat: 'fur2', glove: '#eef3f8', price: 1200 },
];
const NEED_TXT = { games: 'partidas', wins: 'victorias', kills: 'bajas' };
// Monedas 🪙: se ganan jugando y se gastan en la tienda de skins (todo se guarda en el teléfono)
let coins = 0, owned = [];
try { coins = Math.max(0, Math.floor(+localStorage.getItem('zf-coins') || 0)); const o = JSON.parse(localStorage.getItem('zf-owned')); if (Array.isArray(o)) owned = o.filter(Number.isInteger); } catch (e) {}
function saveWallet() { try { localStorage.setItem('zf-coins', String(coins)); localStorage.setItem('zf-owned', JSON.stringify(owned)); } catch (e) {} }
const needMet = (i, s) => { const n = SKINS[i].need; return !!n && ((s || loadStats())[n.k] || 0) >= n.n; };
const skinOpen = (i, s) => !!SKINS[i] && (!SKINS[i].price || owned.includes(i) || needMet(i, s));

let mySk = 0, newSkins = [], roundCoins = 0;
try { const k = +localStorage.getItem('zf-skin'); if (k >= 0 && k < SKINS.length) mySk = k | 0; } catch (e) {}
const healDur = e => HEAL_TIME * (chIs(e, 'doc') ? 0.5 : 1);
const wallCap = e => chIs(e, 'ingeniera') ? 5 : 3;
const charSpeed = e => chIs(e, 'rayo') ? 1.12 : 1;
let myCh = 0;
try { const c = +localStorage.getItem('zf-char'); if (c >= 0 && c < CHARS.length) myCh = c | 0; } catch (e) {}
// Paredes desplegables, derribos, vehículos y marcas
const WALL_HP = 240, WALL_LIFE = 40, WALL_PARTS = 6, WALL_LEN = 130, WALL_DIST = 52;
const BLEED = 3.4, REVIVE_TIME = 4;
const VEH_R = 24, VEH_MAX = 430, VEH_HP = 320, PING_LIFE = 20;
const GUNS = Object.keys(WEAPONS), KINDS = ['gun', 'med', 'armor', 'nade', 'wall'], AIRS = ['plane', 'glide', 'ground'], ZST = ['wait', 'shrink', 'done'];
const AIR = { plane: 0, glide: 1, ground: 2 };
const r0 = v => Math.round(v), r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
// Estado del multijugador: 'solo' | 'host' (anfitrión, simula todo) | 'client' (envía controles, recibe el estado)
const net = { role: 'solo', peer: null, conns: [], host: null, code: '', myId: 0, sendAcc: 0, inAcc: 0, actions: [], bev: [], lastMsg: 0, lobby: [], round: 0,
  lobbyAv: [], lobbyCh: [], lobbyTs: 1, board: {}, boardRows: [], tick: 0 };
const PEER_PREFIX = 'zonafinal-v2-', CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ', MAX_PLAYERS = 8;

const PHASES = [
  { wait: 60, shrink: 35, r: 1500, dps: 2 },
  { wait: 35, shrink: 30, r: 950,  dps: 4 },
  { wait: 30, shrink: 25, r: 560,  dps: 7 },
  { wait: 25, shrink: 20, r: 300,  dps: 10 },
  { wait: 20, shrink: 18, r: 130,  dps: 14 },
  { wait: 15, shrink: 20, r: 0,    dps: 20 },
];

/* ---------- Estado ---------- */
let circles, rects, buildings, bushes, ponds, roads, loot, ents, bullets, particles, feed, zone, player;
let nades = [], blasts = [], drops = [], floats = [], indicators = [], shake = 0;
let shields = [], boxes = [], vehicles = [], netIds = 0;
let ground = null, mini = null, plane = null, announce = null, visPoly = null;
let time = 0, state = 'menu', paused = false, diff = DIFFS.normal, showMap = false;
let cam = { x: WORLD / 2, y: WORLD / 2, z: 0.7 }, hitMarker = 0, killMarker = 0, hurtFlash = 0;
let spectate = null, totalPlayers = 0, dmgDealt = 0, lastCursor = '';
let specMode = false, specLabel = '', resToken = 0;
// Equipos: teamSize 1 = todos contra todos, 2 = dúos, 4 = escuadras. Cada jugador tiene e.team.
let teamSize = 1, roundDone = true, roundStats = null, emoOpen = false;
const teamsOn = () => teamSize > 1;
const EMOS = ['👋', '😂', '🔥', '🆘'];
// Chat rápido: frases cortas que ven tus compañeros (o todos, en individual)
const QC = ['¡Vamos!', 'Necesito botiquín', '¡Enemigo aquí!', 'Cúbreme', '¡Buen tiro!', 'Sígueme', 'Espera', '¡Gracias!'];
const GAME_VER = 'zf-v21';
// Ajustes de accesibilidad y diagnóstico (se guardan en el teléfono)
let cbMode = false, bigTxt = false, showFps = false, musVol = 0.45;
try {
  cbMode = localStorage.getItem('zf-cb') === '1'; bigTxt = localStorage.getItem('zf-big') === '1'; showFps = localStorage.getItem('zf-fpsv') === '1';
  const m = localStorage.getItem('zf-mus'); if (m != null && +m >= 0 && +m <= 1) musVol = +m;
} catch (e) {}
// colores de compañero / bueno / enemigo (en modo daltónico: azul y naranja)
function C_MATE() { return cbMode ? '#4da3ff' : '#5dffb1'; }
function C_GOOD() { return cbMode ? '#4da3ff' : '#68d391'; }
function C_FOE() { return cbMode ? '#ffb020' : '#ff8fa3'; }
// los últimos errores, para el informe de problemas
const errLog = [];
addEventListener('error', e => { errLog.push(`${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}`); if (errLog.length > 8) errLog.shift(); });
addEventListener('unhandledrejection', e => { errLog.push('promesa: ' + String(e.reason && (e.reason.message || e.reason)).slice(0, 160)); if (errLog.length > 8) errLog.shift(); });
let vibOn = true;
try { vibOn = localStorage.getItem('zf-vib') !== '0'; } catch (e) {}
function buzz(p) { if (!vibOn || !navigator.vibrate) return; try { navigator.vibrate(p); } catch (e) {} }
const keys = {}, mouse = { x: 0, y: 0, down: false, pressed: false };
// Controles táctiles: joysticks flotantes (izquierda = mover, derecha = apuntar/disparar)
const STICK_R = 60, BTN_R = 28;
const touch = { move: null, aim: null };
const uiRects = { slots: [], pickup: null, minimap: null };
let lastTouchT = -1e9;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

/* ---------- Sonido (Web Audio, sin archivos, con estéreo) ---------- */
let actx = null, noiseBuf = null, muted = false, sndCount = 0, sndWindow = 0;
try { muted = localStorage.getItem('zf-mute') === '1'; } catch (e) {}
let master = null;
function ac() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = typeof vol === 'number' ? vol : 1; master.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function soundBudget() {
  const now = performance.now();
  if (now - sndWindow > 60) { sndWindow = now; sndCount = 0; }
  return ++sndCount <= 6;
}
function outTo(a, node, pan) {
  if (pan && a.createStereoPanner) {
    const p = a.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    node.connect(p); p.connect(master || a.destination);
  } else node.connect(master || a.destination);
}
function noise(vol, freq, dur, pan = 0) {
  if (muted || vol < 0.02 || !soundBudget()) return;
  try {
    const a = ac();
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate * 0.6, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = a.createBufferSource(); s.buffer = noiseBuf;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = a.createGain(); const t = a.currentTime;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g); outTo(a, g, pan); s.start(t); s.stop(t + dur);
  } catch (e) {}
}
function tone(freq, dur, type = 'sine', vol = 0.12, slide = 0, delay = 0) {
  if (muted) return;
  try {
    const a = ac(), t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
  } catch (e) {}
}
function listener() { return player && player.alive && player.air === 'ground' ? player : cam; }
function spatial(x, y, range = 1400) {
  const l = listener(), d = dist(l.x, l.y, x, y);
  // izquierda/derecha según la pantalla (si la cámara 3D está girada, también)
  const a = typeof camYaw === 'function' ? camYaw() : 0, dx = (x - l.x) * Math.cos(a) + (y - l.y) * Math.sin(a);
  return [Math.max(0, 1 - d / range), dx / 700];
}
const sfx = {
  hit: () => tone(1400, 0.06, 'square', 0.05),
  kill: () => { tone(880, 0.1, 'triangle', 0.12); tone(1320, 0.18, 'triangle', 0.12, 0, 0.08); },
  pickup: () => tone(660, 0.1, 'triangle', 0.1, 400),
  reload: () => { tone(300, 0.05, 'square', 0.06); tone(500, 0.06, 'square', 0.06, 0, 0.08); },
  heal: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'sine', 0.1, 0, i * 0.08)); },
  win: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.25, 'triangle', 0.13, 0, i * 0.12)); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, 0, i * 0.18)); },
  empty: () => tone(200, 0.05, 'square', 0.05),
  alarm: () => { tone(660, 0.25, 'sawtooth', 0.06); tone(520, 0.3, 'sawtooth', 0.06, 0, 0.28); },
  jump: () => noise(0.18, 900, 0.6),
  land: () => noise(0.2, 300, 0.25),
  drop: () => { tone(988, 0.15, 'triangle', 0.1); tone(1318, 0.22, 'triangle', 0.1, 0, 0.15); },
};

/* ---------- Geometría ---------- */
function circleRectHit(x, y, r, q) {
  const cx = clamp(x, q.x, q.x + q.w), cy = clamp(y, q.y, q.y + q.h);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy < r * r;
}
function pointFree(x, y, r) {
  for (const c of circles) if (dist(c.x, c.y, x, y) < c.r + r) return false;
  for (const q of rects) if (circleRectHit(x, y, r, q)) return false;
  return true;
}
function insideBuilding(x, y, m = 0) {
  return buildings.some(b => x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.h + m);
}
function buildingAt(x, y) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (x > b.x + T && x < b.x + b.w - T && y > b.y + T && y < b.y + b.h - T) return i;
  }
  return -1;
}
const pondNear = (x, y, m) => ponds.some(p => dist(p.x, p.y, x, y) < p.r + m);
const inWater = (x, y) => ponds.some(p => dist(p.x, p.y, x, y) < p.r - 6);
function outdoorFree(x, y, r) {
  return x > r && y > r && x < WORLD - r && y < WORLD - r && !insideBuilding(x, y, r + 20) && !pondNear(x, y, r) && pointFree(x, y, r);
}
function blockedBy(x, y) {
  for (const c of circles) { const dx = x - c.x, dy = y - c.y; if (dx * dx + dy * dy < c.r * c.r) return c; }
  for (const q of rects) if (x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h) return q;
  return null;
}
function segCircle(x1, y1, x2, y2, c) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((c.x - x1) * dx + (c.y - y1) * dy) / l2, 0, 1);
  return dist(x1 + dx * t, y1 + dy * t, c.x, c.y) < c.r * 0.9;
}
function segRect(x1, y1, x2, y2, q) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy], qq = [x1 - q.x, q.x + q.w - x1, y1 - q.y, q.y + q.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (qq[i] < 0) return false; }
    else {
      const t = qq[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}
function los(x1, y1, x2, y2) {
  const minX = Math.min(x1, x2) - 60, maxX = Math.max(x1, x2) + 60, minY = Math.min(y1, y2) - 60, maxY = Math.max(y1, y2) + 60;
  for (const c of circles) {
    if (c.x < minX || c.x > maxX || c.y < minY || c.y > maxY) continue;
    if (segCircle(x1, y1, x2, y2, c)) return false;
  }
  for (const q of rects) {
    if (q.x > maxX || q.x + q.w < minX || q.y > maxY || q.y + q.h < minY) continue;
    if (segRect(x1, y1, x2, y2, q)) return false;
  }
  return true;
}
// Distancia de un rayo (dirección unitaria) hasta el primer obstáculo
function rayDist(ox, oy, dx, dy, maxD, cs, rs) {
  let best = maxD;
  for (const c of cs) {
    const fx = ox - c.x, fy = oy - c.y, b = fx * dx + fy * dy;
    const cc = fx * fx + fy * fy - c.r * c.r * 0.81, disc = b * b - cc;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 0 && t < best) best = t;
  }
  for (const q of rs) {
    let tmin = 0, tmax = best;
    if (Math.abs(dx) < 1e-9) { if (ox < q.x || ox > q.x + q.w) continue; }
    else {
      let t1 = (q.x - ox) / dx, t2 = (q.x + q.w - ox) / dx;
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }
    if (Math.abs(dy) < 1e-9) { if (oy < q.y || oy > q.y + q.h) continue; }
    else {
      let t1 = (q.y - oy) / dy, t2 = (q.y + q.h - oy) / dy;
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }
    if (tmin > 0 && tmin < best) best = tmin;
  }
  return best;
}
function computeVis(ox, oy, maxD) {
  const cs = circles.filter(c => Math.abs(c.x - ox) < maxD + c.r && Math.abs(c.y - oy) < maxD + c.r);
  const rs = rects.filter(q => q.x < ox + maxD && q.x + q.w > ox - maxD && q.y < oy + maxD && q.y + q.h > oy - maxD);
  const N = touchMode ? 360 : 540, pts = new Array(N * 2);
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    const d = rayDist(ox, oy, dx, dy, maxD, cs, rs);
    pts[2 * i] = ox + dx * d; pts[2 * i + 1] = oy + dy * d;
  }
  return pts;
}

/* ---------- Mapa ---------- */
function addWall(b, side, dir, a1, a2, c, door) {
  const seg = (s, e) => {
    if (e - s <= 0) return;
    if (dir === 'h') rects.push({ x: s, y: c, w: e - s, h: T, kind: 'wall' });
    else rects.push({ x: c, y: s, w: T, h: e - s, kind: 'wall' });
  };
  if (door == null) { seg(a1, a2); return; }
  seg(a1, door); seg(door + GAP, a2);
  const m = door + GAP / 2;
  if (side === 0) b.doors.push({ x: m, y: c + T / 2, nx: 0, ny: -1 });
  if (side === 1) b.doors.push({ x: m, y: c + T / 2, nx: 0, ny: 1 });
  if (side === 2) b.doors.push({ x: c + T / 2, y: m, nx: -1, ny: 0 });
  if (side === 3) b.doors.push({ x: c + T / 2, y: m, nx: 1, ny: 0 });
}
function randomLoot(x, y) {
  const r = Math.random();
  if (r < 0.5) {
    const g = Math.random();
    const type = g < 0.18 ? 'subfusil' : g < 0.3 ? 'mini' : g < 0.46 ? 'escopeta' : g < 0.56 ? 'revolver' : g < 0.74 ? 'rifle' : g < 0.83 ? 'tirador' : g < 0.91 ? 'francotirador' : g < 0.97 ? 'ballesta' : 'lanzacohetes';
    return { x, y, kind: 'gun', gun: makeGun(type, type === 'lanzacohetes' ? 2 : rollTier()) };
  }
  return { x, y, kind: r < 0.68 ? 'med' : r < 0.82 ? 'armor' : r < 0.92 ? 'nade' : 'wall' };
}
function blobs(n, r, spread) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ dx: rand(-spread, spread), dy: rand(-spread, spread), r: r * rand(0.75, 1.05) });
  return out;
}
function genMap(key) {
  mapKey = MAPS[key] ? key : pick(MAP_KEYS); TH = MAPS[mapKey];
  circles = []; rects = []; buildings = []; bushes = []; loot = []; ponds = []; roads = [];
  // lagos
  for (let i = 0, c = 0; i < 80 && c < TH.lakes; i++) {
    const x = rand(450, WORLD - 450), y = rand(450, WORLD - 450);
    if (ponds.some(p => dist(p.x, p.y, x, y) < (TH.pondR ? 650 : 800))) continue;
    const n = 3 + Math.floor(Math.random() * 3);
    const pr = TH.pondR || 1;
    for (let k = 0; k < n; k++) ponds.push({ x: x + rand(-110, 110) * pr, y: y + rand(-110, 110) * pr, r: rand(70, 135) * pr });
    c++;
  }
  // casas
  for (let i = 0; i < 900 && buildings.length < TH.houses; i++) {
    const w = Math.round(rand(240, 360)), h = Math.round(rand(200, 300));
    const x = Math.round(rand(150, WORLD - 150 - w)), y = Math.round(rand(150, WORLD - 150 - h));
    const G = TH.gap; if (buildings.some(b => x < b.x + b.w + G && x + w + G > b.x && y < b.y + b.h + G && y + h + G > b.y)) continue;
    if (ponds.some(p => circleRectHit(p.x, p.y, p.r + 50, { x, y, w, h }))) continue;
    const b = { x, y, w, h, doors: [], roof: pick(TH.roofs), roofA: 1 };
    buildings.push(b);
    const sides = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 2);
    const door = (a1, a2) => Math.round(a1 + 30 + Math.random() * (a2 - a1 - 60 - GAP));
    addWall(b, 0, 'h', x, x + w, y, sides.includes(0) ? door(x, x + w) : null);
    addWall(b, 1, 'h', x, x + w, y + h - T, sides.includes(1) ? door(x, x + w) : null);
    addWall(b, 2, 'v', y + T, y + h - T, x, sides.includes(2) ? door(y + T, y + h - T) : null);
    addWall(b, 3, 'v', y + T, y + h - T, x + w - T, sides.includes(3) ? door(y + T, y + h - T) : null);
    if (Math.random() < 0.7) rects.push({ x: x + rand(60, w - 100), y: y + rand(60, h - 100), w: 40, h: 40, kind: 'crate', hp: CRATE_HP });
    const n = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let k = 0, tries = 0; k < n && tries < 40; tries++) {
      const px = rand(x + 40, x + w - 40), py = rand(y + 40, y + h - 40);
      if (pointFree(px, py, 16)) { loot.push(randomLoot(px, py)); k++; }
    }
  }
  // caminos entre casas (solo decorativos)
  for (let i = 1; i < buildings.length; i++) {
    let best = null, bd = Infinity;
    const a = buildings[i];
    for (let j = 0; j < i; j++) {
      const b = buildings[j], d = dist(a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2);
      if (d < bd) { bd = d; best = b; }
    }
    roads.push({ x1: a.x + a.w / 2, y1: a.y + a.h / 2, x2: best.x + best.w / 2, y2: best.y + best.h / 2, bend: rand(-0.25, 0.25) });
  }
  const place = (n, r0, r1, fn) => {
    for (let i = 0, c = 0; i < n * 30 && c < n; i++) {
      const r = rand(r0, r1), x = rand(r + 20, WORLD - r - 20), y = rand(r + 20, WORLD - r - 20);
      if (!outdoorFree(x, y, r + 30)) continue;
      fn(x, y, r); c++;
    }
  };
  place(TH.rocks, 22, 42, (x, y, r) => {
    const pts = [];
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + rand(-0.2, 0.2), rr = r * rand(0.95, 1.15); pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
    circles.push({ x, y, r, kind: 'rock', pts });
  });
  place(TH.trees, 20, 28, (x, y, r) => circles.push({ x, y, r, kind: 'tree', blobs: blobs(5, r * 1.15, r * 0.55) }));
  place(TH.crates, 32, 32, (x, y) => rects.push({ x: x - 22, y: y - 22, w: 44, h: 44, kind: 'crate', hp: CRATE_HP }));
  for (let i = 0, c = 0; i < 800 && c < TH.bushes; i++) {
    const r = rand(34, 52), x = rand(r, WORLD - r), y = rand(r, WORLD - r);
    if (insideBuilding(x, y, r + 10) || pondNear(x, y, r * 0.3)) continue;
    bushes.push({ x, y, r, blobs: blobs(4, r * 0.7, r * 0.35) }); c++;
  }
  place(45, 20, 20, (x, y) => loot.push(randomLoot(x, y)));
}

/* ---------- Terreno pre-dibujado ---------- */
function decal(fn, x, y, r) {
  if (!ground) return;
  const c = ground.getContext('2d');
  c.save(); c.setTransform(GS, 0, 0, GS, 0, 0); fn(c); c.restore();
  if (typeof dirty3D === 'function') dirty3D(x, y, r);
}
function buildGround() {
  const g = document.createElement('canvas');
  g.width = Math.round(WORLD * GS); g.height = Math.round(WORLD * GS);
  const c = g.getContext('2d');
  c.setTransform(GS, 0, 0, GS, 0, 0);
  c.fillStyle = TH.ground; c.fillRect(0, 0, WORLD, WORLD);
  for (let i = 0; i < 160; i++) {
    const x = rand(0, WORLD), y = rand(0, WORLD), r = rand(90, 280);
    const col = Math.random() < 0.5 ? TH.blobs[0] : TH.blobs[1];
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${col},0.45)`); gr.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // caminos
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [w, col] of [[TH.city ? 84 : 60, TH.road[0]], [TH.city ? 70 : 46, TH.road[1]], [10, 'rgba(255,255,255,.06)']]) {
    c.strokeStyle = col; c.lineWidth = w; c.beginPath();
    for (const r of roads) {
      const mx = (r.x1 + r.x2) / 2 - (r.y2 - r.y1) * r.bend, my = (r.y1 + r.y2) / 2 + (r.x2 - r.x1) * r.bend;
      c.moveTo(r.x1, r.y1); c.quadraticCurveTo(mx, my, r.x2, r.y2);
    }
    c.stroke();
  }
  if (TH.city) { // línea amarilla discontinua en las calles
    c.strokeStyle = '#f5c518'; c.lineWidth = 4; c.setLineDash([26, 22]); c.beginPath();
    for (const r of roads) { const mx = (r.x1 + r.x2) / 2 - (r.y2 - r.y1) * r.bend, my = (r.y1 + r.y2) / 2 + (r.x2 - r.x1) * r.bend; c.moveTo(r.x1, r.y1); c.quadraticCurveTo(mx, my, r.x2, r.y2); }
    c.stroke(); c.setLineDash([]);
  }
  // lagos
  c.fillStyle = TH.shore;
  for (const p of ponds) { c.beginPath(); c.arc(p.x, p.y, p.r + 12, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = TH.water[0];
  for (const p of ponds) { c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = TH.water[1];
  for (const p of ponds) { c.beginPath(); c.arc(p.x - 6, p.y - 6, p.r * 0.72, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2;
  for (const p of ponds) for (let k = 0; k < 3; k++) {
    const a = rand(0, Math.PI * 2), rr = p.r * rand(0.3, 0.6);
    c.beginPath(); c.arc(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, rand(8, 16), Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  }
  // hierba
  for (const [col, n] of [[TH.grass[0], TH.grassN[0]], [TH.grass[1], TH.grassN[1]]]) {
    c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath();
    for (let i = 0; i < n; i++) {
      const x = rand(0, WORLD), y = rand(0, WORLD);
      if (pondNear(x, y, 8)) continue;
      c.moveTo(x, y); c.lineTo(x + rand(-2.5, 2.5), y - rand(4, 9));
    }
    c.stroke();
  }
  // flores y piedrecitas
  for (let i = 0; i < 700; i++) {
    const x = rand(0, WORLD), y = rand(0, WORLD);
    if (pondNear(x, y, 10)) continue;
    c.fillStyle = Math.random() < 0.3 ? 'rgba(120,120,110,.6)' : pick(TH.dots);
    c.beginPath(); c.arc(x, y, rand(1.8, 3), 0, Math.PI * 2); c.fill();
  }
  // suelos de las casas
  for (const b of buildings) {
    c.fillStyle = TH.floor; c.fillRect(b.x, b.y, b.w, b.h);
    c.strokeStyle = 'rgba(60,40,20,.22)'; c.lineWidth = 1.5; c.beginPath();
    for (let y = b.y + 22, row = 0; y < b.y + b.h; y += 22, row++) {
      c.moveTo(b.x, y); c.lineTo(b.x + b.w, y);
      for (let x = b.x + (row % 2 ? 40 : 80); x < b.x + b.w; x += 120) { c.moveTo(x, y - 22); c.lineTo(x, y); }
    }
    c.stroke();
    // alfombra
    const rw = b.w * 0.4, rh = b.h * 0.35;
    c.fillStyle = pick(['rgba(140,40,40,.55)', 'rgba(40,70,140,.5)', 'rgba(60,110,60,.5)']);
    c.fillRect(b.x + b.w / 2 - rw / 2, b.y + b.h / 2 - rh / 2, rw, rh);
  }
  ground = g;
  // minimapa
  const M = 400, s = M / WORLD;
  mini = document.createElement('canvas'); mini.width = mini.height = M;
  const m = mini.getContext('2d');
  m.drawImage(g, 0, 0, M, M);
  for (const b of buildings) { m.fillStyle = b.roof; m.fillRect(b.x * s, b.y * s, b.w * s, b.h * s); }
  for (const o of circles) { m.fillStyle = o.kind === 'rock' ? TH.rock[0] : TH.tree[1]; m.beginPath(); m.arc(o.x * s, o.y * s, Math.max(1.2, o.r * s), 0, Math.PI * 2); m.fill(); }
}

/* ---------- Jugadores ---------- */
function makeEnt(isPlayer, name, color) {
  return {
    x: WORLD / 2, y: WORLD / 2, r: 16, hp: 100, armor: 0, ang: 0, guns: [makeGun('pistola'), null], slot: 0,
    cd: 0, reloadT: 0, healT: 0, meds: 1, alive: true, isPlayer, name, color, kills: 0,
    lastShot: -9, lastHurt: -9, hitT: 0, inBush: false, place: 0, killer: null, bld: -1, wet: false,
    air: 'plane', glideT: 0, land: null, jumpAt: 0, stamina: 100, sprint: false, moving: false,
    streak: 0, lastKillT: -9, noiseT: -9, id: 0, human: isPlayer, conn: null, disc: false,
    inp: { down: false, pressed: false }, tx: null, ty: null, ta: 0,
    target: null, fireDelay: 0, think: Math.random() * 0.3, wp: null, aimErr: 0,
    strafe: 1, strafeT: 0, stuckX: 0, stuckY: 0, stuckT: 0, nades: 0, nadeT: -9,
    team: 0, key: '', emo: -1, emoT: -9, watch: -1,
    ch: 0, sk: 0, walls: 1, wallT: -9, down: false, rev: 0, knocker: null, reviver: null, veh: null, runT: -9, ping: null, helpMate: null,
  };
}
function initPlane() {
  const a = rand(0, Math.PI * 2), cx = WORLD / 2 + rand(-500, 500), cy = WORLD / 2 + rand(-500, 500), L = 1700;
  plane = { x0: cx - Math.cos(a) * L, y0: cy - Math.sin(a) * L, x1: cx + Math.cos(a) * L, y1: cy + Math.sin(a) * L, ang: a, t: 0, dur: PLANE_DUR, x: 0, y: 0 };
  plane.x = plane.x0; plane.y = plane.y0;
}
function pickLanding() {
  if (Math.random() < 0.35 && buildings.length) {
    const b = pick(buildings);
    return { x: b.x + b.w / 2 + rand(-40, 40), y: b.y + b.h / 2 + rand(-30, 30) };
  }
  return { x: rand(200, WORLD - 200), y: rand(200, WORLD - 200) };
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
// humans[0] es el jugador local; el resto son amigos conectados. Los huecos se rellenan con bots.
function spawnEnts(humans = [{ name: 'Tú' }]) {
  ents = [];
  const n = Math.max(diff.bots + 1, humans.length), names = shuffle([...NAMES]);
  for (let i = 0; i < n; i++) {
    const h = humans[i];
    const e = h
      ? makeEnt(i === 0, h.name, HUMAN_COLORS[i % HUMAN_COLORS.length])
      : makeEnt(false, names[i % names.length], `hsl(${Math.floor(rand(0, 360))},55%,58%)`);
    e.id = i; e.human = !!h; e.conn = (h && h.conn) || null; e.av = (h && cleanAv(h.av)) || '';
    e.team = Math.floor(i / teamSize); e.key = h ? (h.conn ? h.conn.peer : 'h') : ''; e.rk = h && h.conn ? h.conn.rk || '' : '';
    e.ch = h ? (CHARS[h.ch] ? h.ch : 0) : Math.floor(Math.random() * CHARS.length);
    e.sk = h ? (SKINS[h.sk] ? h.sk : 0) : Math.floor(Math.random() * SKINS.length);
    e.walls = chIs(e, 'ingeniera') ? 3 : 1;
    if (h && h.conn) h.conn.ent = e;
    if (!h) {
      e.land = pickLanding();
      const dx = plane.x1 - plane.x0, dy = plane.y1 - plane.y0;
      const k = clamp(((e.land.x - plane.x0) * dx + (e.land.y - plane.y0) * dy) / (dx * dx + dy * dy), 0.05, 0.93);
      e.jumpAt = Math.max(0.4, k * plane.dur + rand(-0.6, 0.6));
    }
    ents.push(e);
  }
  player = ents[0];
  totalPlayers = n;
}
function jump(e) {
  if (e.air !== 'plane') return;
  const k = clamp(plane.t / plane.dur, 0, 1);
  e.air = 'glide'; e.glideT = GLIDE;
  e.x = clamp(lerp(plane.x0, plane.x1, k), 60, WORLD - 60);
  e.y = clamp(lerp(plane.y0, plane.y1, k), 60, WORLD - 60);
  toHuman(e, { k: 's', n: 'jump' });
}
function land(e) {
  e.air = 'ground';
  if (chIs(e, 'tanque')) e.armor = Math.max(e.armor, 50);
  for (let i = 0; i < 3; i++) resolveObstacles(e);
  e.stuckX = e.x; e.stuckY = e.y; e.stuckT = time; e.wp = null;
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 0.5, max: 0.5, color: 'rgba(210,200,170,.8)', size: 5 });
  }
  toHuman(e, { k: 's', n: 'land' });
}
function updateGlide(e, dt) {
  let mx = 0, my = 0;
  if (e.isPlayer) {
    if (keys.KeyW || keys.ArrowUp) my--;
    if (keys.KeyS || keys.ArrowDown) my++;
    if (keys.KeyA || keys.ArrowLeft) mx--;
    if (keys.KeyD || keys.ArrowRight) mx++;
    if (touch.move && touch.move.mag > 0.15) { mx = touch.move.dx; my = touch.move.dy; }
    [mx, my] = rotIn(mx, my);
  } else if (e.land) {
    const dx = e.land.x - e.x, dy = e.land.y - e.y, d = Math.hypot(dx, dy);
    if (d > 12) { mx = dx / d; my = dy / d; }
  }
  const l = Math.hypot(mx, my);
  if (l > 0) { e.x += mx / l * GLIDE_SPEED * dt; e.y += my / l * GLIDE_SPEED * dt; e.ang = Math.atan2(my, mx); }
  e.x = clamp(e.x, 40, WORLD - 40); e.y = clamp(e.y, 40, WORLD - 40);
  e.glideT -= dt;
  if (e.glideT <= 0) land(e);
}
