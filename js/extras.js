'use strict';
// Zona Final · Misiones diarias, repetición, tutorial y clima
// (los archivos comparten variables globales y se cargan en orden desde index.html)
/* ---------- Misiones diarias (3 al día, dan monedas) ---------- */
const MIS_POOL = [
  { id: 'k3', txt: 'Consigue 3 bajas', k: 'kills', n: 3, r: 60 },
  { id: 'k8', txt: 'Consigue 8 bajas', k: 'kills', n: 8, r: 120 },
  { id: 'g3', txt: 'Juega 3 partidas', k: 'games', n: 3, r: 50 },
  { id: 'g5', txt: 'Juega 5 partidas', k: 'games', n: 5, r: 80 },
  { id: 't5', txt: 'Queda 2 veces en el top 5', k: 'top5', n: 2, r: 90 },
  { id: 'w1', txt: 'Gana una partida', k: 'wins', n: 1, r: 150 },
  { id: 'd5', txt: 'Haz 500 de daño', k: 'dmg', n: 500, r: 70 },
  { id: 'd15', txt: 'Haz 1500 de daño', k: 'dmg', n: 1500, r: 120 },
  { id: 'ni', txt: 'Juega una partida en el mapa de Noche 🌙', k: 'night', n: 1, r: 50 },
  { id: 'tm', txt: 'Juega 2 partidas en dúos o escuadras', k: 'team', n: 2, r: 70 },
  { id: 'fr', txt: 'Juega una partida con amigos', k: 'friends', n: 1, r: 80 },
];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function missions() {
  let M = null;
  try { M = JSON.parse(localStorage.getItem('zf-mis')); } catch (e) {}
  const day = today();
  if (!M || M.day !== day || !Array.isArray(M.list)) {
    let h = 0; for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) % 1000003;
    const pool = MIS_POOL.slice(), list = [];
    while (list.length < 3 && pool.length) { h = (h * 1103515245 + 12345) % 2147483647; const m = pool.splice(h % pool.length, 1)[0]; if (!list.some(x => MIS_POOL.find(q => q.id === x.id).k === m.k)) list.push({ id: m.id, p: 0, done: false }); }
    M = { day, list };
    try { localStorage.setItem('zf-mis', JSON.stringify(M)); } catch (e) {}
  }
  return M;
}
function misAdd(k, v) {
  if (!v) return;
  const M = missions();
  for (const it of M.list) {
    const m = MIS_POOL.find(q => q.id === it.id);
    if (!m || m.k !== k || it.done) continue;
    it.p = Math.min(m.n, it.p + v);
    if (it.p >= m.n) {
      it.done = true; coins += m.r; roundCoins += m.r; saveWallet();
      pushFeed(`📋 ¡Misión cumplida! ${m.txt} · +🪙${m.r}`, 7, true);
    }
  }
  try { localStorage.setItem('zf-mis', JSON.stringify(M)); } catch (e) {}
}
function openMissions() {
  const M = missions(), box = $('misList');
  box.textContent = '';
  for (const it of M.list) {
    const m = MIS_POOL.find(q => q.id === it.id);
    if (!m) continue;
    const d = document.createElement('div'); d.className = 'mis' + (it.done ? ' done' : '');
    const t = document.createElement('div'); t.className = 'mt';
    const a = document.createElement('span'); a.textContent = (it.done ? '✅ ' : '') + m.txt;
    const b = document.createElement('span'); b.textContent = `🪙 ${m.r}`;
    t.append(a, b);
    const bar = document.createElement('div'); bar.className = 'bar';
    const fill = document.createElement('i'); fill.style.width = `${Math.round(it.p / m.n * 100)}%`; bar.appendChild(fill);
    const sm = document.createElement('small'); sm.textContent = `${Math.floor(it.p)} / ${m.n}`;
    d.append(t, bar, sm); box.appendChild(d);
  }
  const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), hrs = Math.ceil((mid - now) / 3600000);
  $('misInfo').textContent = `Se cuentan al terminar cada partida. Nuevas misiones en ${hrs} h.`;
  $('missions').classList.remove('hidden');
}
function openProfile() {
  const s = loadStats(), g = s.games || 0, fav = s.maps ? Object.entries(s.maps).sort((a, b) => b[1] - a[1])[0] : null;
  const mins = Math.round((s.time || 0) / 60);
  const tiles = [
    ['Partidas', g], ['Victorias', s.wins || 0], ['% victorias', g ? Math.round((s.wins || 0) / g * 100) + ' %' : '—'],
    ['Bajas', s.kills || 0], ['Bajas por partida', g ? ((s.kills || 0) / g).toFixed(1) : '—'], ['Más bajas en una', s.bestKills || 0],
    ['Mejor puesto', s.best ? '#' + s.best : '—'], ['Veces en top 5', s.top5 || 0], ['Daño total', Math.round(s.dmg || 0)],
    ['Tiempo jugado', mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`],
    ['Mapa favorito', fav && MAPS[fav[0]] ? MAPS[fav[0]].name : '—'], ['Monedas', '🪙 ' + coins],
    ['Skins', `${SKINS.filter((_, i) => skinOpen(i, s)).length} / ${SKINS.length}`],
  ];
  const grid = $('profGrid'); grid.textContent = '';
  for (const [k, v] of tiles) { const d = document.createElement('div'), b = document.createElement('b'), sp = document.createElement('span'); b.textContent = v; sp.textContent = k; d.append(b, sp); grid.appendChild(d); }
  $('profName').textContent = `${getName()} · ${CHARS[myCh] ? CHARS[myCh].icon + ' ' + CHARS[myCh].name : ''} · ${SKINS[mySk].name}`;
  const L = s.level || 1, X = s.xp || 0;
  $('profLvl').innerHTML = '';
  $('profLvl').append(document.createTextNode(`⭐ Nivel ${L} · ${X} / ${xpNeed(L)} XP`));
  { const b = document.createElement('div'), i = document.createElement('i'); b.className = 'pbar'; i.style.width = `${Math.round(X / xpNeed(L) * 100)}%`; b.appendChild(i); $('profLvl').appendChild(b); }
  const got = s.ach || [], ag = $('achGrid'); ag.textContent = '';
  $('achCount').textContent = `(${got.length} / ${ACH.length})`;
  for (const a of ACH) {
    const d = document.createElement('div'), b = document.createElement('b');
    d.className = got.includes(a.id) ? 'ok' : 'no'; b.textContent = `${a.icon} ${a.name}`;
    d.append(b, document.createTextNode(a.desc)); ag.appendChild(d);
  }
  const W = weekLoad(), wb = $('weekBoard'); wb.textContent = '';
  const rows = Object.entries(W.rows).sort((a, b) => b[1].w - a[1].w || b[1].k - a[1].k);
  if (!rows.length) { const p = document.createElement('p'); p.className = 'stats'; p.textContent = 'Juega en una sala con amigos y aquí verás quién gana más esta semana.'; wb.appendChild(p); }
  rows.slice(0, 10).forEach(([n, r], i) => {
    const row = document.createElement('div'); row.className = 'brow';
    const a = document.createElement('b'); a.textContent = `${i === 0 ? '👑' : i + 1 + '.'} ${n}`;
    const b = document.createElement('span'); b.textContent = `🏆 ${r.w} · 🎯 ${r.k} · 🎮 ${r.g}`;
    row.append(a, b); wb.appendChild(row);
  });
  $('profile').classList.remove('hidden');
}

/* ---------- Niveles, logros y pase de temporada ---------- */
let roundFlags = { healed: false, racha: false, nadeK: 0 };
const myKillTimes = [];
function onMyKill(weapon) {
  myKillTimes.push(time);
  while (myKillTimes.length && time - myKillTimes[0] > 10) myKillTimes.shift();
  if (myKillTimes.length >= 3) roundFlags.racha = true;
  if (/Granada|Barril/.test(weapon || '')) roundFlags.nadeK++;
}
const xpNeed = L => 200 + L * 100;
function addXP(s, xp) {
  s.level = s.level || 1; s.xp = (s.xp || 0) + xp;
  while (s.xp >= xpNeed(s.level)) {
    s.xp -= xpNeed(s.level); s.level++;
    const c = 40 + s.level * 10; coins += c; roundCoins += c; saveWallet();
    pushFeed(`⭐ ¡Subiste al nivel ${s.level}! +🪙${c}`, 8, true);
    try { sfx.kill(); } catch (e) {}
  }
}
const ACH = [
  { id: 'sangre', icon: '🩸', name: 'Primera sangre', desc: 'Consigue tu primera baja', ok: s => s.kills >= 1 },
  { id: 'cazador', icon: '🎯', name: 'Cazador', desc: '100 bajas en total', ok: s => s.kills >= 100 },
  { id: 'top5', icon: '🛡️', name: 'Superviviente', desc: 'Queda 10 veces en el top 5', ok: s => (s.top5 || 0) >= 10 },
  { id: 'gana1', icon: '🏆', name: 'Primera victoria', desc: 'Gana una partida', ok: s => s.wins >= 1 },
  { id: 'gana10', icon: '👑', name: 'Campeón', desc: 'Gana 10 partidas', ok: s => s.wins >= 10 },
  { id: 'racha', icon: '🔥', name: 'Imparable', desc: '3 bajas en 10 segundos', ok: s => !!s.ach_racha },
  { id: 'granada', icon: '💣', name: 'Dinamitero', desc: '5 bajas con granadas o barriles', ok: s => (s.nadeK || 0) >= 5 },
  { id: 'sincura', icon: '💪', name: 'Duro de pelar', desc: 'Gana sin usar botiquines', ok: s => !!s.ach_sincura },
  { id: 'zombi', icon: '🧟', name: 'Cazazombis', desc: 'Supera las 5 oleadas de zombis', ok: s => !!s.ach_zombi },
  { id: 'duelo', icon: '⚔️', name: 'Duelista', desc: 'Gana un duelo', ok: s => !!s.ach_duelo },
  { id: 'noche', icon: '🌙', name: 'Noctámbulo', desc: 'Gana en el mapa de Noche', ok: s => !!s.ach_noche },
  { id: 'skins', icon: '👕', name: 'Coleccionista', desc: 'Consigue 10 skins', ok: s => SKINS.filter((_, i) => skinOpen(i, s)).length >= 10 },
  { id: 'dias', icon: '📅', name: 'Constante', desc: 'Juega 7 días distintos', ok: s => (s.days || []).length >= 7 },
  { id: 'rico', icon: '💰', name: 'Ahorrador', desc: 'Ten 2000 monedas a la vez', ok: () => coins >= 2000 },
  { id: 'nivel10', icon: '⭐', name: 'Veterano', desc: 'Llega al nivel 10', ok: s => (s.level || 1) >= 10 },
];
function checkAch(s) {
  s.ach = s.ach || [];
  for (const a of ACH) {
    if (s.ach.includes(a.id) || !a.ok(s)) continue;
    s.ach.push(a.id); coins += 100; roundCoins += 100; saveWallet();
    pushFeed(`🏅 ¡Logro: ${a.icon} ${a.name}! +🪙100`, 8, true);
  }
}
// Pase de temporada: dura un mes; la XP de cada partida llena sus 30 niveles
const PASS_TIERS = 30, PASS_STEP = 250, PASS_SKINS = { 10: 'Cometa', 20: 'Dragón Rojo', 30: 'Aurora' };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function passState() {
  const d = new Date(), season = `${d.getFullYear()}-${d.getMonth() + 1}`;
  let P = null;
  try { P = JSON.parse(localStorage.getItem('zf-pass')); } catch (e) {}
  if (!P || P.season !== season) P = { season, xp: 0, tier: 0 };
  return P;
}
const passReward = t => PASS_SKINS[t] ? { skin: PASS_SKINS[t] } : { coins: 30 + t * 5 };
function passAdd(xp) {
  const P = passState();
  P.xp += xp;
  while (P.tier < PASS_TIERS && P.xp >= (P.tier + 1) * PASS_STEP) {
    P.tier++;
    const r = passReward(P.tier);
    if (r.skin) { const i = SKINS.findIndex(k => k.name === r.skin); if (i >= 0 && !owned.includes(i)) owned.push(i); saveWallet(); pushFeed(`🎟️ Pase nivel ${P.tier}: ¡skin ${r.skin}!`, 8, true); newSkins.push(r.skin); }
    else { coins += r.coins; roundCoins += r.coins; saveWallet(); pushFeed(`🎟️ Pase nivel ${P.tier}: +🪙${r.coins}`, 7, true); }
  }
  try { localStorage.setItem('zf-pass', JSON.stringify(P)); } catch (e) {}
}
function openPass() {
  const P = passState(), d = new Date(), end = new Date(d.getFullYear(), d.getMonth() + 1, 1), days = Math.ceil((end - d) / 86400000);
  $('passTitle').textContent = `Temporada de ${MONTHS[d.getMonth()]}`;
  const next = Math.min(PASS_TIERS, P.tier + 1), into = P.xp - P.tier * PASS_STEP;
  $('passInfo').textContent = P.tier >= PASS_TIERS ? '¡Completaste el pase! 🎉' : `Nivel ${P.tier} de ${PASS_TIERS} · ${into} / ${PASS_STEP} XP para el ${next} · termina en ${days} días`;
  $('passFill').style.width = `${P.tier >= PASS_TIERS ? 100 : Math.round(into / PASS_STEP * 100)}%`;
  const grid = $('passGrid'); grid.textContent = '';
  for (let t = 1; t <= PASS_TIERS; t++) {
    const r = passReward(t), el = document.createElement('div'), b = document.createElement('b');
    el.className = (t <= P.tier ? 'got' : '') + (r.skin ? ' big' : '');
    b.textContent = (t <= P.tier ? '✅ ' : '') + t;
    el.append(b, document.createTextNode(r.skin ? '👕 ' + r.skin : '🪙 ' + r.coins));
    grid.appendChild(el);
  }
  $('pass').classList.remove('hidden');
}
// Ranking de amigos de la semana (se suma lo que pasa en las salas)
const weekNo = () => { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000 + 3) / 7); };
function weekLoad() {
  let W = null;
  try { W = JSON.parse(localStorage.getItem('zf-week')); } catch (e) {}
  if (!W || W.wk !== weekNo()) W = { wk: weekNo(), rows: {} };
  return W;
}
function weekMerge(rows) {
  const W = weekLoad(), prev = net.prevRows || {};
  for (const r of rows) {
    const p = prev[r.n] || { w: 0, k: 0, g: 0 }, q = W.rows[r.n] || (W.rows[r.n] = { w: 0, k: 0, g: 0 });
    q.w += Math.max(0, r.w - p.w); q.k += Math.max(0, r.k - p.k); q.g += Math.max(0, r.g - p.g);
  }
  net.prevRows = Object.fromEntries(rows.map(r => [r.n, { w: r.w, k: r.k, g: r.g }]));
  try { localStorage.setItem('zf-week', JSON.stringify(W)); } catch (e) {}
}

/* ---------- Repetición de tu eliminación ---------- */
const hist = [];
let replay = null, wasAlive = false;
function recordHist() {
  if ((state !== 'play' && state !== 'over') || !ents) return;
  const last = hist[hist.length - 1];
  if (last && (time < last.t || last.ents !== ents)) hist.length = 0; // partida nueva
  else if (last && time - last.t < 0.05) return;
  hist.push({ t: time, ents, e: ents.map(e => [e.x, e.y, e.ang, time - e.lastShot, e.alive, e.down, e.air, e.hp]), b: bullets.map(b => [b.x, b.y, b.vx, b.vy, !!b.rk]) });
  while (hist.length && time - hist[0].t > 5) hist.shift();
}
function replayCheck() {
  if (!player || !ents) return;
  if (wasAlive && !player.alive && state === 'over' && hist.length > 4 && hist[hist.length - 1].t - hist[0].t > 1.2 && player.killer && player.killer !== player && !replay) {
    const to = hist[hist.length - 1].t;
    replay = { t0: performance.now(), frames: hist.filter(h => h.t >= to - 4 && h.ents === ents), to, killer: player.killer.name };
    replay.from = replay.frames.length ? replay.frames[0].t : to;
    $('spec').style.visibility = 'hidden';
  }
  wasAlive = player.alive;
}
function stopReplay() { replay = null; $('spec').style.visibility = ''; }
function replayBegin() {
  const R = replay, F = R.frames;
  if (F.length < 2) { stopReplay(); return false; }
  // a velocidad normal, y el último segundo a cámara lenta
  const el = (performance.now() - R.t0) / 1000, span = R.to - R.from, slow = Math.min(1, span);
  const fast = span - slow, rt = el < fast ? R.from + el : R.from + fast + (el - fast) * 0.4;
  if (rt > R.to + 0.4 || state === 'menu') { stopReplay(); return false; }
  let i = 0;
  while (i < F.length - 2 && F[i + 1].t < rt) i++;
  const a = F[i], b = F[i + 1], k = clamp((rt - a.t) / ((b.t - a.t) || 1), 0, 1);
  R.saved = ents.map(e => [e.x, e.y, e.ang, e.lastShot, e.alive, e.down, e.air, e.hp]);
  R.savedB = bullets;
  ents.forEach((e, j) => {
    const A = a.e[j], B = b.e[j] || A;
    if (!A) return;
    e.x = lerp(A[0], B[0], k); e.y = lerp(A[1], B[1], k); e.ang = A[2] + angDiff(B[2], A[2]) * k;
    e.lastShot = time - A[3]; e.alive = A[4]; e.down = A[5]; e.air = A[6]; e.hp = A[7];
  });
  bullets = a.b.map(q => ({ x: lerp(q[0], q[0] + q[2] * (b.t - a.t), k), y: lerp(q[1], q[1] + q[3] * (b.t - a.t), k), vx: q[2], vy: q[3], rk: q[4], life: 1 }));
  return true;
}
function replayEnd() {
  const R = replay;
  if (!R || !R.saved) return;
  ents.forEach((e, j) => { const S = R.saved[j]; if (!S) return; [e.x, e.y, e.ang, e.lastShot, e.alive, e.down, e.air, e.hp] = S; });
  bullets = R.savedB; R.saved = null;
}
function drawReplayBanner() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, VW, 46); ctx.fillRect(0, VH - 40, VW, 40);
  const blink = Math.floor(performance.now() / 500) % 2;
  txt(`${blink ? '🔴' : '⭕'} REPETICIÓN · te eliminó ${replay ? replay.killer : ''}`, VW / 2, 23, touchMode ? 15 : 18, '#ffffff', 'center', 800);
  txt(touchMode ? 'Toca para saltar' : 'Pulsa cualquier tecla o haz clic para saltar', VW / 2, VH - 20, 13, '#c8cde8', 'center', 700);
}

/* ---------- Música (sintetizada, sin archivos) ---------- */
// Menú: tranquila. En partida: ritmo; cuando la zona se cierra o quedan pocos: más intensa.
let mus = null;
function musicLevel() { if (mus) mus.out.gain.setTargetAtTime(musVol * 0.22, actx.currentTime, 0.2); }
function musicTick() {
  if (!actx || actx.state !== 'running') return;
  if (!mus) {
    const out = actx.createGain(); out.gain.value = 0; out.connect(master || actx.destination);
    mus = { out, next: actx.currentTime + 0.1, step: 0 };
    musicLevel();
  }
  if (musVol <= 0.001 || document.hidden) return;
  const live = state === 'play' && player && player.alive;
  const hot = live && (zone.state === 'shrink' || ents.filter(e => e.alive).length <= 5);
  const bpm = !live ? 84 : hot ? 132 : 108, sp = 60 / bpm / 2;
  // progresión Lam - Fa - Do - Sol (en Hz: raíces graves)
  const roots = [110, 87.31, 130.81, 98], arp = [[0, 3, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12], [0, 4, 7, 11]];
  while (mus.next < actx.currentTime + 0.25) {
    const t = mus.next, st = mus.step, bar = Math.floor(st / 8) % 4, r = roots[bar];
    const note = (f, dur, type, vol, dest = mus.out) => {
      const o = actx.createOscillator(), gn = actx.createGain();
      o.type = type; o.frequency.value = f;
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.012); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(dest); o.start(t); o.stop(t + dur + 0.02);
    };
    if (st % 4 === 0) note(r, sp * 3.6, 'triangle', 0.55);                     // bajo
    if (live || st % 2 === 0) note(r * 2 * Math.pow(2, arp[bar][st % 4] / 12), sp * 0.9, 'square', live ? 0.07 : 0.05); // arpegio
    if (!live && st % 8 === 0) note(r * 4, sp * 7, 'sine', 0.08);              // pad del menú
    if (live && st % 4 === 0) { // bombo
      const o = actx.createOscillator(), gn = actx.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      gn.gain.setValueAtTime(0.7, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(gn); gn.connect(mus.out); o.start(t); o.stop(t + 0.2);
    }
    if (hot && st % 2 === 1 && noiseBuf) { // charles cuando hay tensión
      const sN = actx.createBufferSource(), f = actx.createBiquadFilter(), gn = actx.createGain();
      sN.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000;
      gn.gain.setValueAtTime(0.12, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      sN.connect(f); f.connect(gn); gn.connect(mus.out); sN.start(t); sN.stop(t + 0.06);
    }
    mus.next += sp; mus.step++;
  }
}
setInterval(() => { try { musicTick(); } catch (e) {} }, 100);

/* ---------- Tutorial (primera partida en solitario) ---------- */
let tut = null;
const tutDone = () => { try { return localStorage.getItem('zf-tut') === '1'; } catch (e) { return true; } };
const TUT = [
  { k: 'Pulsa ESPACIO para saltar del avión', t: 'Toca la pantalla para saltar del avión', done: p => p.air !== 'plane' },
  { k: 'Dirige la caída con W A S D', t: 'Dirige la caída con el joystick izquierdo', done: p => p.air === 'ground' },
  { k: 'Muévete con W A S D (Shift para correr)', t: 'Muévete con el joystick izquierdo (empújalo del todo para correr)', done: (p, s) => dist(p.x, p.y, s.x, s.y) > 220 },
  { k: 'Busca un arma mejor y pulsa E para recogerla', t: 'Busca un arma mejor y toca «Recoger»', done: p => !!p.guns[1] || p.guns[0].type !== 'pistola' || p.guns[0].tier > 0 },
  { k: 'Apunta con el ratón y haz clic para disparar', t: 'Desliza el joystick derecho para apuntar y disparar', done: (p, s) => p.lastShot > s.t0 },
  { k: 'Cúrate con Q cuando te falte vida ➕', t: 'Cúrate con el botón ➕ cuando te falte vida', done: (p, s) => p.healT > 0 || time - s.t0 > 10 },
  { k: 'Pon una pared con F para cubrirte 🧱', t: 'Pon una pared con el botón 🧱 para cubrirte', done: (p, s) => p.walls < s.walls || time - s.t0 > 10 },
  { k: 'Quédate dentro del círculo blanco: fuera, la zona morada hace daño', t: 'Quédate dentro del círculo blanco: fuera, la zona morada hace daño', done: (p, s) => time - s.t0 > 7 },
  { k: '¡Listo! Sé el último en pie 🏆', t: '¡Listo! Sé el último en pie 🏆', done: (p, s) => time - s.t0 > 4 },
];
function tutStart() { tut = { step: 0, t0: time, x: player.x, y: player.y, walls: player.walls }; }
function tutTick() {
  if (player && player.healT > 0 && state === 'play') roundFlags.healed = true;
  if (!tut || state !== 'play' || !player || !player.alive) return;
  const p = player;
  if (!TUT[tut.step].done(p, tut)) return;
  tut.step++; tut.t0 = time; tut.x = p.x; tut.y = p.y; tut.walls = p.walls;
  try { tone(990, 0.08, 'triangle', 0.08); } catch (e) {}
  if (tut.step >= TUT.length) { tut = null; try { localStorage.setItem('zf-tut', '1'); } catch (e) {} }
}
function drawTutorial() {
  if (!tut || state !== 'play' || !player.alive || showMap) return;
  const S = TUT[tut.step], t = `🎓 ${tut.step + 1}/${TUT.length} · ${touchMode ? S.t : S.k}`, y = touchMode ? 94 : 112, fs = touchMode ? 13 : 16;
  ctx.font = `800 ${fs}px system-ui, "Segoe UI", sans-serif`;
  const w = Math.min(VW - 20, ctx.measureText(t).width + 36);
  rr(VW / 2 - w / 2, y - 17, w, 34, 17); ctx.fillStyle = 'rgba(10,12,28,.9)'; ctx.fill();
  ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2; ctx.stroke();
  txt(t, VW / 2, y, fs, '#ffe9a3', 'center', 800);
}

/* ---------- Clima (solo visual; sale igual para todos porque depende del mapa) ---------- */
let wx = 'claro', wxFor = null;
const WX_INFO = { lluvia: '🌧️ Está lloviendo', nieve: '🌨️ Está nevando', niebla: '🌫️ Hay niebla', ceniza: '🌋 Cae ceniza del volcán', polvo: '🏜️ Tormenta de arena' };
function wxUpdate() {
  if (wxFor === ground) return;
  wxFor = ground;
  let h = 0;
  for (const b of buildings) h = (h * 31 + Math.round(b.x) * 7 + Math.round(b.y)) % 1000003;
  const r = (h % 100) / 100;
  wx = !wxOn ? 'claro' : TH.snow ? (r < 0.6 ? 'nieve' : r < 0.8 ? 'niebla' : 'claro')
    : TH.lava ? (r < 0.45 ? 'ceniza' : 'claro') : TH.cactus ? (r < 0.35 ? 'polvo' : 'claro')
    : r < 0.28 ? 'lluvia' : r < 0.42 ? 'niebla' : 'claro';
  if (WX_INFO[wx] && state === 'play') pushFeed(WX_INFO[wx], 6, false);
}
// En 2D: lluvia, nieve, niebla… dibujadas sobre la pantalla
function drawWeather2D() {
  if (wx === 'claro') return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const t = performance.now() / 1000;
  if (wx === 'niebla' || wx === 'polvo') { ctx.fillStyle = wx === 'niebla' ? 'rgba(200,210,222,.28)' : 'rgba(200,160,100,.26)'; ctx.fillRect(0, 0, VW, VH); }
  ctx.beginPath();
  const n = wx === 'lluvia' ? 140 : wx === 'niebla' ? 0 : 90;
  for (let i = 0; i < n; i++) {
    const sx = (i * 97.3 + (wx === 'polvo' ? t * 600 : t * 40)) % (VW + 40) - 20, sp = wx === 'lluvia' ? 900 : wx === 'polvo' ? 60 : 70;
    const sy = (i * 61.7 + t * sp) % (VH + 40) - 20;
    if (wx === 'lluvia') { ctx.moveTo(sx, sy); ctx.lineTo(sx - 4, sy + 16); }
    else { ctx.moveTo(sx + 2, sy); ctx.arc(sx, sy, wx === 'polvo' ? 1.5 : 2.2, 0, Math.PI * 2); }
  }
  if (wx === 'lluvia') { ctx.strokeStyle = 'rgba(190,210,255,.45)'; ctx.lineWidth = 1.3; ctx.stroke(); }
  else { ctx.fillStyle = wx === 'nieve' ? 'rgba(255,255,255,.85)' : wx === 'ceniza' ? 'rgba(80,80,80,.7)' : 'rgba(220,180,120,.6)'; ctx.fill(); }
}
