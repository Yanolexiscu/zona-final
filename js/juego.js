'use strict';
// Zona Final · Zona, combate, objetos, vehículos, bots y actualización de la partida
// (los archivos comparten variables globales y se cargan en orden desde index.html)
/* ---------- Zona ---------- */
function initZone() {
  zone = { x: WORLD / 2, y: WORLD / 2, r: 2400, sx: 0, sy: 0, sr: 0, tx: 0, ty: 0, tr: 0, phase: 0, state: 'wait', timer: PH()[0].wait, dps: 1 };
  nextZoneTarget();
}
function nextZoneTarget() {
  const P = PH()[zone.phase];
  const a = Math.random() * Math.PI * 2, d = Math.random() * Math.max(0, zone.r - P.r) * 0.8;
  zone.tx = clamp(zone.x + Math.cos(a) * d, 300, WORLD - 300);
  zone.ty = clamp(zone.y + Math.sin(a) * d, 300, WORLD - 300);
  zone.tr = P.r;
}
function updateZone(dt) {
  if (zone.state === 'done') return;
  const P = PH()[zone.phase];
  zone.timer -= dt;
  if (zone.state === 'wait') {
    if (zone.timer <= 0) {
      zone.state = 'shrink'; zone.timer = P.shrink; zone.sx = zone.x; zone.sy = zone.y; zone.sr = zone.r; zone.dps = P.dps;
      announceAll('⚠️ La zona se está cerrando', '#d8a8ff', 'alarm');
      if (zone.phase < 3) spawnDrop();
    }
  } else {
    const k = 1 - Math.max(0, zone.timer) / P.shrink;
    zone.x = lerp(zone.sx, zone.tx, k); zone.y = lerp(zone.sy, zone.ty, k); zone.r = lerp(zone.sr, zone.tr, k);
    if (zone.timer <= 0) {
      zone.phase++;
      if (zone.phase < PH().length) { zone.state = 'wait'; zone.timer = PH()[zone.phase].wait; nextZoneTarget(); }
      else zone.state = 'done';
    }
  }
}


/* ---------- Modos: preparación (anfitrión o solo) ---------- */
function applyModeStart() {
  zWave = 0; duelRound = 0; duelScore = []; modeT = 0;
  weekRule = gmode === 'semana' ? currentWeekRule() : null;
  if (weekRule) {
    if (weekRule.guns) for (const it of loot) if (it.kind === 'gun') { it.gun = makeGun(pick(weekRule.guns), Math.max(it.gun.tier, 1)); }
    if (weekRule.nades) for (const it of loot) if (it.kind === 'med' && Math.random() < 0.4) it.kind = 'nade';
    for (const e of ents) { e.guns[0] = makeGun(weekRule.start, weekRule.start === 'pistola' ? 0 : 1); if (weekRule.nades) e.nades = weekRule.nades; }
    announceAll(`🗓️ Modo de la semana: ${weekRule.name}`, '#ffd34d');
  }
  if (gmode === 'zombis') {
    for (const e of ents) e.team = 0; // todos los humanos juntos
    for (let i = 0; i < ZPOOL; i++) {
      const z = makeEnt(false, 'Zombi', '#7cb85a');
      z.id = ents.length; z.zombie = true; z.team = 50; z.sk = 6; z.alive = false; z.air = 'ground'; z.meds = 0; z.walls = 0; z.nades = 0;
      z.x = z.y = -500; ents.push(z);
    }
    zone.state = 'done'; zone.r = 6000; zone.tr = 6000; zone.x = zone.tx = WORLD / 2; zone.y = zone.ty = WORLD / 2;
    modeT = 22; // la primera oleada llega cuando ya habéis aterrizado
  }
  if (gmode === 'duelo') {
    for (const e of ents) e.team = e.id;
    duelScore = ents.map(e => [e.id, 0]);
    modeT = -1; duelNextRound(true);
  }
}
let modeT = 0;
// Temporizadores de los modos (solo el anfitrión o en solitario)
function updateMode(dt) {
  if (gmode === 'zombis') {
    if (modeT > 0) { modeT -= dt; if (modeT <= 0) zombieWave(); }
    for (const e of ents) if (e.zombie && e.alive && e.air === 'ground' && !e.dropZ) e.dropZ = 1;
  } else if (gmode === 'duelo' && modeT > 0) { modeT -= dt; if (modeT <= 0) duelNextRound(false); }
}
// ---- Zombis ----
function zombieWave() {
  zWave++;
  const humans = ents.filter(e => e.human && e.alive);
  if (!humans.length) return;
  const n = Math.min(ZPOOL, 4 + zWave * 4);
  let k = 0;
  for (const z of ents) {
    if (!z.zombie || z.alive || k >= n) continue;
    const h = pick(humans);
    let x = 0, y = 0;
    for (let t = 0; t < 30; t++) { const a = Math.random() * Math.PI * 2, d = rand(650, 1000); x = h.x + Math.cos(a) * d; y = h.y + Math.sin(a) * d; if (outdoorFree(x, y, 20)) break; }
    Object.assign(z, { alive: true, hp: 50 + zWave * 12, armor: 0, down: false, x: clamp(x, 60, WORLD - 60), y: clamp(y, 60, WORLD - 60), cd: 0, place: 0, killer: null, target: null, lx: null });
    k++;
  }
  announceAll(`🧟 ¡Oleada ${zWave} de ${ZW_MAX}! (${k} zombis)`, '#b5f08a', 'alarm');
  bcast({ k: 'wv', n: zWave });
}
function zombieAfterKill() {
  const humansAlive = ents.some(e => e.human && e.alive);
  if (!humansAlive) { pushFeed(`🧟 Los zombis ganaron en la oleada ${zWave}`, 8, true); finishMatch(50); return; }
  if (ents.some(e => e.zombie && e.alive) || modeT > 0) return;
  if (zWave >= ZW_MAX) { announceAll('🏆 ¡Sobrevivisteis a todas las oleadas!', '#5dffb1'); finishMatch(0); return; }
  announceAll(`✅ Oleada ${zWave} superada · la siguiente en 8 s`, '#5dffb1');
  for (const e of ents) if (e.human && e.alive) { e.meds = Math.min(5, e.meds + 1); e.armor = Math.min(100, e.armor + 25); }
  modeT = 8;
}
function zombieUpdate(e, dt) {
  let best = null, bd = Infinity;
  for (const o of ents) {
    if (!o.human || !o.alive || o.air !== 'ground') continue;
    const d = dist(e.x, e.y, o.x, o.y) + (o.down ? 300 : 0);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return;
  const s = steer(e, best.x, best.y), dx = s.x - e.x, dy = s.y - e.y, l = Math.hypot(dx, dy) || 1;
  e.ang = Math.atan2(best.y - e.y, best.x - e.x);
  e.cd -= dt;
  if (dist(e.x, e.y, best.x, best.y) < e.r + best.r + 8) {
    if (e.cd <= 0) { e.cd = 0.7; damage(best, 12 + zWave * 2, e, 'Mordisco'); e.lastShot = time; }
  } else moveEnt(e, dx / l * SPEED * charSpeed(e), dy / l * SPEED * charSpeed(e), dt);
}
// ---- Duelo ----
function duelSpawns() {
  const c = { x: zone.x, y: zone.y }, list = ents.filter(e => e.human || !e.zombie), n = list.length;
  return list.map((e, i) => { const a = i / n * Math.PI * 2 + 0.4; return [e, c.x + Math.cos(a) * 380, c.y + Math.sin(a) * 380]; });
}
function duelNextRound(first) {
  duelRound++;
  // zona pequeña alrededor de una zona abierta del mapa
  if (first) {
    let cx = WORLD / 2, cy = WORLD / 2;
    for (let t = 0; t < 60; t++) { const x = rand(700, WORLD - 700), y = rand(700, WORLD - 700); if (!insideBuilding(x, y, 300) && !pondNear(x, y, 300)) { cx = x; cy = y; break; } }
    zone.cx0 = cx; zone.cy0 = cy;
  }
  Object.assign(zone, { x: zone.cx0, y: zone.cy0, r: 700, phase: 0, state: 'wait', timer: PH()[0].wait });
  nextZoneTarget();
  const gun = pick(['rifle', 'escopeta', 'subfusil', 'revolver', 'tirador']);
  bullets = []; nades = []; boxes = [];
  for (const [e, x, y] of duelSpawns()) {
    let px = x, py = y;
    for (let t = 0; t < 20 && !outdoorFree(px, py, 20); t++) { px = x + rand(-120, 120); py = y + rand(-120, 120); }
    Object.assign(e, { alive: true, hp: 100, armor: 0, down: false, rev: 0, x: px, y: py, air: 'ground', glideT: 0,
      guns: [makeGun(gun, 1), makeGun('pistola', 1)], slot: 0, meds: 2, nades: 1, walls: 1, reloadT: 0, healT: 0, place: 0, killer: null, target: null, veh: null, lx: null });
    e.ang = Math.atan2(zone.y - py, zone.x - px);
  }
  if (!first) announceAll(`⚔️ Ronda ${duelRound} · ${WEAPONS[gun].name}`, '#ffd34d');
  bcast({ k: 'rd', n: duelRound, sc: duelScore });
}
function duelAfterKill() {
  const alive = ents.filter(e => e.alive);
  if (aliveTeams() > 1 || modeT > 0) return;
  const w = alive[0];
  if (w) { const s = duelScore.find(q => q[0] === w.id); if (s) s[1]++; }
  bcast({ k: 'rd', n: duelRound, sc: duelScore });
  const best = duelScore.reduce((a, b) => b[1] > a[1] ? b : a, [0, -1]);
  if (best[1] >= 3) { // fin del duelo
    const W = ents[best[0]];
    announceAll(`🏆 ${W.isPlayer ? '¡Ganaste' : W.name + ' gana'} el duelo!`, '#ffd34d');
    for (const h of ents) {
      if (!h.human || h === W) continue;
      h.place = 2;
      if (h.alive) { h.alive = false; h.hp = 0; }
      if (h === player) endGame(false); else toHuman(h, { k: 'dead', place: 2, killer: W.id });
    }
    W.place = 1;
    finishMatch(W.team);
    return;
  }
  announceAll(w ? `${w.isPlayer ? '¡Ganaste' : w.name + ' gana'} la ronda ${duelRound}!` : 'Ronda empatada', '#ffd34d');
  modeT = 3;
}

/* ---------- Avisos ---------- */
function pushFeed(text, t, mine) {
  feed.unshift({ text, t, mine });
  if (feed.length > 6) feed.length = 6;
}
function showAnnounce(text, color = '#ffd34d') { announce = { text, color, t: 2.6, max: 2.6 }; }
// Aviso para todos los jugadores (local + amigos conectados)
function announceAll(text, color = '#ffd34d', s) {
  showAnnounce(text, color);
  if (s && sfx[s]) sfx[s]();
  bcast({ k: 'a', text, c: color, s });
}
// Evento para todos los clientes (solo tiene efecto si somos anfitrión)
function bcast(ev) { if (net.role === 'host') net.bev.push(ev); }
// Evento privado para un jugador humano: si es el local se aplica ya; si es un amigo se le envía
function toHuman(e, ev) {
  if (!e || !e.human) return;
  if (e === player) handleEvent(ev);
  else if (e.conn && net.role === 'host') e.conn.ev.push(ev);
}

/* ---------- Suministros aéreos ---------- */
function spawnDrop() {
  for (let t = 0; t < 200; t++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * Math.max(60, zone.tr * 0.7);
    const x = clamp(zone.tx + Math.cos(a) * r, 100, WORLD - 100), y = clamp(zone.ty + Math.sin(a) * r, 100, WORLD - 100);
    if (!outdoorFree(x, y, 40)) continue;
    drops.push({ x, y, t: DROP_FALL });
    const text = '📦 ¡Suministro aéreo en camino! Búscalo en el minimapa';
    pushFeed(text, 7, true); sfx.drop();
    bcast({ k: 'fd', text, all: 1, s: 'drop' });
    return;
  }
}
function updateDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.t -= dt;
    if (d.t > 0) continue;
    drops.splice(i, 1);
    loot.push({ x: d.x, y: d.y - 16, kind: 'gun', gun: makeGun(Math.random() < 0.6 ? 'ametralladora' : 'lanzacohetes', 3) });
    loot.push({ x: d.x - 24, y: d.y + 14, kind: 'armor' });
    loot.push({ x: d.x + 24, y: d.y + 14, kind: 'nade' });
    loot.push({ x: d.x, y: d.y + 32, kind: 'nade' });
    loot.push({ x: d.x - 30, y: d.y - 14, kind: 'wall' });
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2, s = rand(60, 220);
      particles.push({ x: d.x, y: d.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, color: '#d8c9a0', size: 4 });
    }
    const [v, pan] = spatial(d.x, d.y, 1500);
    noise(0.3 * v, 300, 0.5, pan);
  }
}

/* ---------- Granadas ---------- */
function throwNade(e, tx, ty) {
  if (e.nades <= 0 || time - e.nadeT < 0.8 || e.down || e.veh) return;
  e.nades--; e.nadeT = time; e.healT = 0;
  const a = Math.atan2(ty - e.y, tx - e.x), d = Math.min(NADE_MAX, dist(e.x, e.y, tx, ty));
  const s = 2 * d / NADE_FLY;
  nades.push({ x: e.x + Math.cos(a) * (e.r + 6), y: e.y + Math.sin(a) * (e.r + 6),
    ux: Math.cos(a), uy: Math.sin(a), s, dec: s / NADE_FLY, age: 0, owner: e });
  if (e.isPlayer) tone(420, 0.12, 'triangle', 0.08, -200);
}
function explodeFx(x, y) {
  const n = { x, y };
  blasts.push({ x: n.x, y: n.y, t: 0.45 });
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(80, 420);
    particles.push({ x: n.x, y: n.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6,
      color: Math.random() < 0.5 ? '#ffb347' : '#ff6a3d', size: 5 });
  }
  decal(c => {
    const g = c.createRadialGradient(n.x, n.y, 0, n.x, n.y, 75);
    g.addColorStop(0, 'rgba(25,18,12,.6)'); g.addColorStop(1, 'rgba(25,18,12,0)');
    c.fillStyle = g; c.fillRect(n.x - 75, n.y - 75, 150, 150);
  }, n.x, n.y, 80);
  const [v, pan] = spatial(n.x, n.y, 1500);
  noise(0.45 * v, 500, 0.9, pan);
  const l = listener(), pd = dist(l.x, l.y, n.x, n.y);
  if (pd < 900) tone(90, 0.5, 'sine', 0.25 * (1 - pd / 900), -40);
  shake = Math.max(shake, 0.45 * (1 - Math.min(1, pd / 700)));
}
function explode(n, name = 'Granada') {
  explodeFx(n.x, n.y);
  bcast({ k: 'x', x: r0(n.x), y: r0(n.y) });
  for (const e of ents) {
    if (!e.alive || e.air !== 'ground' || e.veh) continue;
    const d = dist(n.x, n.y, e.x, e.y);
    if (d < NADE_R + e.r && los(n.x, n.y, e.x, e.y))
      damage(e, NADE_DMG * (1 - Math.max(0, d - e.r) / NADE_R), n.owner, name);
  }
  for (const s of shields.slice()) if (dist(n.x, n.y, s.x, s.y) < NADE_R + WALL_LEN / 2) hitShield(s.id, 110);
  for (const v of vehicles.slice()) if (dist(n.x, n.y, v.x, v.y) < NADE_R + VEH_R) hurtVehicle(v, NADE_DMG * 1.2, n.owner, name);
  for (const q of rects.slice()) {
    if (q.kind === 'crate' && circleRectHit(n.x, n.y, NADE_R * 0.8, q)) { q.hp -= 60; if (q.hp <= 0) breakCrate(q); }
  }
}
function updateNades(dt) {
  for (let i = nades.length - 1; i >= 0; i--) {
    const n = nades[i];
    n.age += dt;
    if (n.s > 0) {
      const steps = Math.max(1, Math.ceil(n.s * dt / 8)), st = n.s * dt / steps;
      for (let k = 0; k < steps; k++) {
        const nx = n.x + n.ux * st, ny = n.y + n.uy * st;
        if (blockedBy(nx, ny) || nx < 5 || ny < 5 || nx > WORLD - 5 || ny > WORLD - 5) {
          n.ux = -n.ux; n.uy = -n.uy; n.s *= 0.4; n.dec *= 0.4; break;
        }
        n.x = nx; n.y = ny;
      }
      n.s = Math.max(0, n.s - n.dec * dt);
    }
    if (n.age >= NADE_FUSE) { nades.splice(i, 1); explode(n); }
  }
  for (let i = blasts.length - 1; i >= 0; i--) { blasts[i].t -= dt; if (blasts[i].t <= 0) blasts.splice(i, 1); }
}
function breakCrateFx(q) {
  const i = rects.indexOf(q);
  if (i < 0) return false;
  rects.splice(i, 1);
  const cx = q.x + q.w / 2, cy = q.y + q.h / 2;
  for (let k = 0; k < 22; k++) {
    const a = Math.random() * Math.PI * 2, s = rand(60, 240);
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, color: Math.random() < 0.5 ? '#b07b3e' : '#7a5228', size: 5 });
  }
  const [v, pan] = spatial(cx, cy);
  noise(0.25 * v, 900, 0.25, pan);
  return true;
}
function breakCrate(q) {
  if (!breakCrateFx(q)) return;
  if (Math.random() < 0.65) loot.push(randomLoot(q.x + q.w / 2, q.y + q.h / 2));
  bcast({ k: 'c', id: q.id });
}
function dieFx(e) {
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(60, 260);
    particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7, max: 0.7, color: e.color, size: 4 });
  }
  decal(c => {
    c.fillStyle = 'rgba(110,10,20,.45)';
    for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(e.x + rand(-18, 18), e.y + rand(-18, 18), rand(4, 11), 0, Math.PI * 2); c.fill(); }
  }, e.x, e.y, 32);
}

/* ---------- Paredes desplegables ---------- */
// Una pared es una fila de círculos (bloquean paso, balas y visión) que se rompe con daño o con el tiempo
function placeWall(e, ang) {
  if (!Number.isFinite(ang) || e.walls <= 0 || time - e.wallT < 1 || e.down || e.veh || !e.alive || e.air !== 'ground') return;
  e.walls--; e.wallT = time; e.healT = 0;
  const x = clamp(e.x + Math.cos(ang) * WALL_DIST, 30, WORLD - 30), y = clamp(e.y + Math.sin(ang) * WALL_DIST, 30, WORLD - 30);
  const id = ++netIds;
  addShield(id, x, y, ang, chIs(e, 'ingeniera') ? WALL_HP * 1.5 : WALL_HP);
  bcast({ k: 'wl', id, x: r0(x), y: r0(y), a: r2(ang) });
}
function addShield(id, x, y, ang, hp) {
  const px = -Math.sin(ang), py = Math.cos(ang), parts = [];
  for (let i = 0; i < WALL_PARTS; i++) {
    const k = (i / (WALL_PARTS - 1) - 0.5) * WALL_LEN;
    const c = { x: x + px * k, y: y + py * k, r: 14, kind: 'shield', sid: id };
    parts.push(c); circles.push(c);
  }
  shields.push({ id, x, y, ang, hp, max: hp, t: WALL_LIFE, parts, born: time });
  for (const o of ents) if (o.alive && o.air === 'ground' && !o.veh) resolveObstacles(o);
  for (let k = 0; k < 18; k++) {
    const p = parts[k % parts.length], a = Math.random() * Math.PI * 2;
    particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.45, max: 0.45, color: '#9be7ff', size: 4 });
  }
  const [v, pan] = spatial(x, y, 1000);
  if (v > 0.03) { noise(0.16 * v, 1800, 0.18, pan); tone(320, 0.18, 'triangle', 0.08 * v, 260); }
}
function removeShield(id) {
  const s = shields.find(s => s.id === id);
  if (!s) return;
  shields.splice(shields.indexOf(s), 1);
  circles = circles.filter(c => c.sid !== id);
  for (const p of s.parts) for (let k = 0; k < 4; k++) particles.push({ x: p.x, y: p.y, vx: rand(-120, 120), vy: rand(-120, 120), life: 0.5, max: 0.5, color: '#bfefff', size: 4 });
  const [v, pan] = spatial(s.x, s.y, 1000);
  if (v > 0.03) noise(0.2 * v, 2400, 0.25, pan);
}
function hitShield(id, dmg) {
  const s = shields.find(s => s.id === id);
  if (!s) return;
  s.hp -= dmg;
  if (s.hp <= 0) { removeShield(id); bcast({ k: 'wd', id }); }
}
function updateShields(dt) {
  for (const s of shields.slice()) { s.t -= dt; if (s.t <= 0) { removeShield(s.id); bcast({ k: 'wd', id: s.id }); } }
}
function drawShields(vis) {
  for (const s of shields) {
    if (!vis(s.x, s.y, WALL_LEN)) continue;
    const a = s.parts[0], b = s.parts[s.parts.length - 1], k = clamp(s.hp / s.max, 0.25, 1);
    const fade = net.role === 'client' ? 1 : Math.min(1, s.t / 3 + 0.3);
    ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(a.x + 5, a.y + 7); ctx.lineTo(b.x + 5, b.y + 7); ctx.stroke();
    ctx.strokeStyle = `rgba(80,190,255,${0.55 + 0.4 * k})`; ctx.lineWidth = 28; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,248,255,.75)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(a.x, a.y - 4); ctx.lineTo(b.x, b.y - 4); ctx.stroke();
    if (k < 0.6) { // grietas
      ctx.strokeStyle = 'rgba(20,60,90,.7)'; ctx.lineWidth = 2; ctx.beginPath();
      for (const p of s.parts) { ctx.moveTo(p.x - 6, p.y - 8); ctx.lineTo(p.x + 3, p.y + 2); ctx.lineTo(p.x - 2, p.y + 9); }
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ---------- Derribado y reanimar (solo en equipos) ---------- */
const standingMates = e => ents.some(o => o !== e && o.alive && !o.down && o.team === e.team);
function knock(e, src, weapon) {
  e.down = true; e.hp = 100; e.rev = 0; e.reviver = null; e.knocker = src && src !== e ? src : null;
  e.healT = 0; e.reloadT = 0; e.sprint = false;
  if (e.veh) exitVehicle(e);
  const text = e.knocker ? `${e.knocker.name} derribó a ${e.name}${weapon ? ' · ' + weapon : ''}` : `${e.name} quedó derribado`;
  pushFeed(text, 6, e === player || src === player);
  bcast({ k: 'fd', text, ids: [e.id, src ? src.id : -1] });
  toHuman(e, { k: 'kn' });
  if (src && src.human && src !== e) toHuman(src, { k: 'kl' });
}
function revive(e, r) {
  e.down = false; e.hp = 35; e.rev = 0; e.knocker = null; e.reviver = null;
  const text = `${r.name} reanimó a ${e.name}`;
  pushFeed(text, 6, e === player || r === player);
  bcast({ k: 'fd', text, ids: [e.id, r.id] });
  toHuman(e, { k: 'rv' });
  toHuman(r, { k: 'a', text: '¡Compañero reanimado!', c: C_MATE() });
}
// El anfitrión avanza la reanimación: un compañero quieto, sin disparar y a menos de 55 de distancia
function updateDowned(dt) {
  for (const e of ents) {
    if (!e.alive || !e.down) continue;
    let r = null;
    for (const o of ents) {
      if (o === e || !o.alive || o.down || o.veh || o.team !== e.team || o.air !== 'ground') continue;
      if (dist(o.x, o.y, e.x, e.y) < 55 && !(o.human && o.moving) && time - o.lastShot > 0.6) { r = o; break; }
    }
    e.reviver = r;
    if (r) { e.rev += dt / (REVIVE_TIME * (chIs(r, 'doc') ? 0.6 : 1)); if (e.rev >= 1) revive(e, r); }
    else {
      e.rev = Math.max(0, e.rev - dt * 0.5);
      e.hp -= BLEED * dt; // se desangra mientras nadie le reanima
      if (e.hp <= 0) kill(e, e.knocker, 'Desangrado');
    }
  }
}

/* ---------- Cajas de botín (al ser eliminado) ---------- */
function makeBox(e) {
  const items = [];
  for (const g of e.guns) if (g && (g.type !== 'pistola' || g.tier > 0)) items.push({ k: 'gun', gun: g });
  if (e.meds > 0) items.push({ k: 'med', n: Math.min(e.meds, 3) });
  if (e.nades > 0) items.push({ k: 'nade', n: e.nades });
  if (e.walls > 0) items.push({ k: 'wall', n: e.walls });
  if (e.armor >= 20) items.push({ k: 'armor', n: Math.round(e.armor) });
  if (items.length) boxes.push({ id: ++netIds, x: e.x, y: e.y, name: e.name, items });
}
const boxCap = (p, k) => k === 'med' ? 5 : k === 'nade' ? 3 : k === 'wall' ? wallCap(p) : 0;
function takeItem(p, b, i, all) {
  const it = b.items[i];
  if (!it) return false;
  if (it.k === 'gun') {
    if (!p.guns[1]) { p.guns[1] = it.gun; p.slot = 1; b.items.splice(i, 1); }
    else if (all) return false;
    else { const old = p.guns[p.slot]; p.guns[p.slot] = it.gun; it.gun = old; }
    p.reloadT = 0; p.cd = Math.max(p.cd, 0.2); p.inp.pressed = false;
    if (p === player) mouse.pressed = false;
    return true;
  }
  if (it.k === 'armor') {
    if (p.armor >= it.n) return false;
    const old = p.armor; p.armor = it.n;
    if (old >= 20) it.n = Math.round(old); else b.items.splice(i, 1);
    return true;
  }
  const key = it.k === 'med' ? 'meds' : it.k === 'nade' ? 'nades' : 'walls';
  const take = Math.min(it.n, boxCap(p, it.k) - p[key]);
  if (take <= 0) return false;
  p[key] += take; it.n -= take;
  if (it.n <= 0) b.items.splice(i, 1);
  return true;
}
// idx = -1: tomar todo lo que quepa
function takeFromBox(p, id, idx) {
  const b = boxes.find(b => b.id === id);
  if (!b || !p.alive || p.down || p.veh || p.air !== 'ground' || dist(p.x, p.y, b.x, b.y) > 80) return;
  let got = false;
  if (idx >= 0) got = takeItem(p, b, idx, false);
  else for (let i = b.items.length - 1; i >= 0; i--) got = takeItem(p, b, i, true) || got;
  if (got) toHuman(p, { k: 's', n: 'pickup' });
  if (!b.items.length) boxes.splice(boxes.indexOf(b), 1);
}
function botLootBox(e, b) {
  for (let i = b.items.length - 1; i >= 0; i--) {
    const it = b.items[i];
    if (it.k === 'gun') {
      if (!wantsLoot(e, { kind: 'gun', gun: it.gun })) continue;
      const s = !e.guns[1] ? 1 : e.guns[0].type === it.gun.type ? 0 : e.guns[1].type === it.gun.type ? 1 : worstSlot(e);
      const old = e.guns[s]; e.guns[s] = it.gun; if (e.slot === s) e.reloadT = 0;
      if (old) it.gun = old; else b.items.splice(i, 1);
    } else takeItem(e, b, i, true);
  }
  if (!b.items.length) boxes.splice(boxes.indexOf(b), 1);
}
const nearestBox = (p, lim = 70) => { let best = null, bd = lim; for (const b of boxes) { const d = dist(p.x, p.y, b.x, b.y); if (d < bd) { bd = d; best = b; } } return best; };
function drawBox(b) {
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-15, -9, 34, 26);
  const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 34); g.addColorStop(0, 'rgba(255,211,77,.35)'); g.addColorStop(1, 'rgba(255,211,77,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-18, -13, 36, 26);
  ctx.fillStyle = '#a8713a'; ctx.fillRect(-18, -13, 36, 9);
  ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.5; ctx.strokeRect(-18, -13, 36, 26);
  ctx.fillStyle = '#ffd34d'; ctx.fillRect(-3, -6, 6, 8);
  ctx.restore();
  txt(`📦 ${b.name}`, b.x, b.y - 24, 11, '#ffe9a3', 'center', 700);
}
const itemLabel = it => it.k === 'gun' ? `${WEAPONS[it.gun.type].name} ${TIERS[it.gun.tier].name}`
  : it.k === 'med' ? `➕ Botiquín ×${it.n}` : it.k === 'nade' ? `💣 Granada ×${it.n}` : it.k === 'wall' ? `🧱 Pared ×${it.n}` : `🛡️ Escudo ${it.n}`;
// Panel HTML de la caja cercana (se rehace solo si cambia)
let boxUiSig = '';
function updateBoxUI() {
  const p = player;
  const b = state === 'play' && !paused && p && p.alive && !p.down && !p.veh && p.air === 'ground' ? nearestBox(p) : null;
  const sig = b ? b.id + ':' + b.items.map(itemLabel).join('|') : '';
  if (sig === boxUiSig) return;
  boxUiSig = sig;
  const ui = $('boxUI');
  ui.classList.toggle('hidden', !b);
  if (!b) return;
  $('boxTitle').textContent = `📦 Caja de ${b.name}`;
  const list = $('boxItems'); list.textContent = '';
  b.items.forEach((it, i) => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sec';
    btn.textContent = itemLabel(it);
    if (it.k === 'gun') btn.style.color = TIERS[it.gun.tier].color;
    btn.onclick = () => { act('box', b.id, i); btn.blur(); };
    list.appendChild(btn);
  });
  const all = document.createElement('button'); all.type = 'button'; all.textContent = touchMode ? 'Tomar todo' : 'Tomar todo [E]';
  all.onclick = () => { act('box', b.id, -1); all.blur(); };
  list.appendChild(all);
}

/* ---------- Vehículos ---------- */
const VEH_COLORS = ['#e5484d', '#3d8bfd', '#f5a524', '#30a46c', '#8e4ec6'];
function spawnVehicles() {
  vehicles = [];
  for (let t = 0; t < 400 && vehicles.length < 5; t++) {
    let x, y;
    if (roads.length && Math.random() < 0.7) { const r = pick(roads), k = Math.random(); x = lerp(r.x1, r.x2, k) + rand(-30, 30); y = lerp(r.y1, r.y2, k) + rand(-30, 30); }
    else { x = rand(200, WORLD - 200); y = rand(200, WORLD - 200); }
    if (!outdoorFree(x, y, 50) || vehicles.some(v => dist(v.x, v.y, x, y) < 600)) continue;
    vehicles.push({ id: ++netIds, x, y, ang: rand(0, Math.PI * 2), sp: 0, hp: VEH_HP, driver: null, color: VEH_COLORS[vehicles.length % VEH_COLORS.length], tx: null, ty: null, ta: 0 });
  }
}
// Física arcade: el coche gira hacia donde apuntas con el joystick/WASD y acelera
function stepVehicle(v, mx, my, dt) {
  const mag = Math.min(1, Math.hypot(mx, my));
  let target = 0;
  if (mag > 0.15) {
    const ta = Math.atan2(my, mx), d = angDiff(ta, v.ang), turn = 2.6 * dt * (0.45 + Math.min(1, Math.abs(v.sp) / 200) * 0.55);
    v.ang += clamp(d, -turn, turn);
    target = VEH_MAX * mag * (Math.abs(d) > 1.8 ? 0.3 : 1);
  }
  v.sp += (target - v.sp) * Math.min(1, dt * (target > v.sp ? 1.4 : 2.4));
  if (inWater(v.x, v.y)) v.sp = Math.min(v.sp, 150);
  const ox = v.x, oy = v.y;
  v.x += Math.cos(v.ang) * v.sp * dt; v.y += Math.sin(v.ang) * v.sp * dt;
  const pe = { x: v.x, y: v.y, r: VEH_R };
  resolveObstacles(pe); v.x = pe.x; v.y = pe.y;
  const exp = Math.abs(v.sp * dt);
  if (exp > 1 && dist(ox, oy, v.x, v.y) < exp * 0.5) { if (v.sp > 220) { const [vv, pan] = spatial(v.x, v.y, 900); noise(0.25 * vv, 200, 0.2, pan); } v.sp *= 0.35; }
}
function driveInput() {
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my--;
  if (keys.KeyS || keys.ArrowDown) my++;
  if (keys.KeyA || keys.ArrowLeft) mx--;
  if (keys.KeyD || keys.ArrowRight) mx++;
  if (touch.move && touch.move.mag > 0.15) { mx = touch.move.dx * Math.min(1, touch.move.mag * 1.15); my = touch.move.dy * Math.min(1, touch.move.mag * 1.15); }
  [mx, my] = rotIn(mx, my);
  const l = Math.hypot(mx, my);
  return l > 1 ? [mx / l, my / l] : [mx, my];
}
const nearFreeVehicle = (p, lim = 75) => { let best = null, bd = lim; for (const v of vehicles) { if (v.driver) continue; const d = dist(p.x, p.y, v.x, v.y); if (d < bd) { bd = d; best = v; } } return best; };
function toggleVehicle(e) {
  if (e.veh) { exitVehicle(e); return; }
  if (!e.alive || e.down || e.air !== 'ground') return;
  const v = nearFreeVehicle(e);
  if (!v) return;
  v.driver = e; e.veh = v; e.healT = 0; e.reloadT = 0; e.sprint = false; e.x = v.x; e.y = v.y;
  toHuman(e, { k: 's', n: 'pickup' });
}
function exitVehicle(e) {
  const v = e.veh;
  if (!v) return;
  v.driver = null; e.veh = null;
  const side = v.ang + Math.PI / 2;
  e.x = v.x + Math.cos(side) * (VEH_R + e.r + 8); e.y = v.y + Math.sin(side) * (VEH_R + e.r + 8);
  resolveObstacles(e);
}
function destroyVehicle(v, src) {
  const i = vehicles.indexOf(v);
  if (i < 0) return;
  vehicles.splice(i, 1);
  const d = v.driver;
  if (d) { exitVehicle(d); damage(d, 40, src, 'Explosión'); }
  explodeFx(v.x, v.y);
  bcast({ k: 'vx', id: v.id, x: r0(v.x), y: r0(v.y) });
  for (const o of ents) if (o.alive && o.air === 'ground' && o !== d && dist(o.x, o.y, v.x, v.y) < 110) damage(o, 35, src, 'Explosión');
}
// Nadie atraviesa los coches (también en el teléfono del invitado, que mueve a su jugador él mismo)
function pushOutOfVehicles(e) {
  for (const v of vehicles) {
    if (v.driver === e) continue;
    const dx = e.x - v.x, dy = e.y - v.y, dd = Math.hypot(dx, dy), min = VEH_R + e.r;
    if (dd < min && dd > 0.01) { e.x = v.x + dx / dd * min; e.y = v.y + dy / dd * min; }
  }
}
function hurtVehicle(v, dmg, src, weapon) {
  if (v.driver && src && src.team === v.driver.team) return;
  v.hp -= dmg * 0.6;
  if (v.driver) damage(v.driver, dmg * 0.35, src, weapon);
  if (v.hp <= 0) destroyVehicle(v, src);
}
// Anfitrión: conductores caídos, atropellos y empujar a quien choca con un coche
function updateVehicles(dt) {
  for (const v of vehicles.slice()) {
    const d = v.driver;
    if (d && (!d.alive || d.down || d.veh !== v)) { if (d.veh === v) exitVehicle(d); else v.driver = null; }
    if (!v.driver) { // sin conductor: frena solo
      if (Math.abs(v.sp) > 1) stepVehicle(v, 0, 0, dt); else v.sp = 0;
    } else if (!v.driver.human) stepVehicle(v, 0, 0, dt);
    const dr = v.driver;
    // un amigo conectado conduce en su teléfono y manda la posición: el coche le sigue a él
    if (dr && dr.human && dr !== player) { v.x = dr.x; v.y = dr.y; v.ang = dr.ang; }
    else if (dr) { dr.x = v.x; dr.y = v.y; dr.ang = v.ang; }
    for (const o of ents) {
      if (!o.alive || o.air !== 'ground' || o.veh) continue;
      const dx = o.x - v.x, dy = o.y - v.y, dd = Math.hypot(dx, dy), min = VEH_R + o.r;
      if (dd >= min || dd < 0.01) continue;
      if (v.driver && Math.abs(v.sp) > 110 && o.team !== v.driver.team && time - o.runT > 0.6) {
        o.runT = time; damage(o, 18 + Math.abs(v.sp) * 0.09, v.driver, 'Atropello');
        v.sp *= 0.75;
      }
      o.x = v.x + dx / dd * (min + 1); o.y = v.y + dy / dd * (min + 1); resolveObstacles(o);
    }
  }
}
function drawVehicle(v) {
  ctx.save(); ctx.translate(v.x, v.y);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.save(); ctx.translate(5, 7); ctx.rotate(v.ang); rr(-30, -18, 60, 36, 9); ctx.fill(); ctx.restore();
  ctx.rotate(v.ang);
  ctx.fillStyle = '#1b1b1b';
  for (const [wx, wy] of [[-19, -19], [13, -19], [-19, 13], [13, 13]]) { rr(wx, wy, 12, 6, 2); ctx.fill(); }
  rr(-29, -16, 58, 32, 9); ctx.fillStyle = v.color; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(-25, -13, 50, 7, 4); ctx.fill();
  ctx.fillStyle = 'rgba(160,220,255,.8)'; rr(8, -11, 9, 22, 3); ctx.fill();
  ctx.fillStyle = '#ffe9a3'; ctx.fillRect(26, -12, 3, 6); ctx.fillRect(26, 6, 3, 6);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(-14, -10, 18, 20, 5); ctx.fill();
  ctx.restore();
  if (v.hp < VEH_HP) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(v.x - 22, v.y - 36, 44, 5);
    ctx.fillStyle = v.hp > VEH_HP * 0.4 ? '#9ae6b4' : '#f6ad55'; ctx.fillRect(v.x - 22, v.y - 36, 44 * Math.max(0, v.hp) / VEH_HP, 5);
  }
}

/* ---------- Marcas en el mapa ---------- */
function setPing(e, x, y) {
  if (!e.alive || !Number.isFinite(x) || !Number.isFinite(y) || (e.ping && time - e.ping.t < 0.5 && time >= e.ping.t)) return;
  x = clamp(x, 0, WORLD); y = clamp(y, 0, WORLD);
  // tipo de marca automático: enemigo cerca del punto, botín, o «vamos aquí»
  let ty = 0, lab = '';
  const foe = ents.find(o => o.alive && o.team !== e.team && o.air === 'ground' && dist(o.x, o.y, x, y) < 110 && canSee(e, o));
  if (foe) { ty = 1; x = foe.x; y = foe.y; }
  else {
    let best = null, bd = 70;
    for (const it of loot) { const d = dist(it.x, it.y, x, y); if (d < bd) { bd = d; best = it; } }
    if (best) { ty = 2; lab = best.kind === 'gun' ? WEAPONS[best.gun.type].name : { med: 'Botiquín', armor: 'Escudo', nade: 'Granada', wall: 'Pared' }[best.kind] || 'Botín'; x = best.x; y = best.y; }
    else if (boxes.some(b => dist(b.x, b.y, x, y) < 70)) { ty = 2; lab = 'Caja de botín'; }
  }
  for (const m of ents) if (m.human && m.team === e.team) toHuman(m, { k: 'pg', id: e.id, x: r0(x), y: r0(y), ty, lab });
  e.ping = { x, y, t: time, ty, lab };
}
// Chat rápido (el anfitrión lo reparte: al equipo, o a todos en individual)
function sayQC(e, i) {
  if (!(i >= 0 && i < QC.length) || time - (e.qcT || -9) < 1.5) return;
  e.qc = i; e.qcT = time;
  for (const m of ents) if (m.human && (!teamsOn() || m.team === e.team)) toHuman(m, { k: 'qc', id: e.id, i });
}
const PING_INFO = [['📍', 'Vamos aquí'], ['⚠️', 'Enemigo'], ['🎁', '']];
const pingColor = e => e === player ? '#ffd34d' : C_MATE();
function activePings() { return player ? ents.filter(e => e.ping && e.team === player.team && time - e.ping.t < PING_LIFE && time - e.ping.t >= 0) : []; }
function drawPingsWorld(vis) {
  for (const e of activePings()) if (vis(e.ping.x, e.ping.y, 60)) drawPing(e);
}
function drawPing(e) {
  {
    const p = e.ping, k = time - p.t, c = p.ty === 1 ? '#ff5c5c' : p.ty === 2 ? '#4dabf7' : pingColor(e);
    const r = 18 + (k * 30) % 30;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.strokeStyle = c; ctx.globalAlpha = 1 - ((k * 30) % 30) / 30; ctx.lineWidth = 3; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 9, p.y - 22); ctx.arc(p.x, p.y - 26, 10, Math.PI * 0.8, Math.PI * 0.2); ctx.closePath();
    ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y - 26, 4, 0, Math.PI * 2); ctx.fillStyle = '#1b1f3b'; ctx.fill();
    const info = PING_INFO[p.ty || 0];
    txt(`${info[0]} ${p.ty === 2 ? p.lab : info[1]} · ${e === player ? 'tú' : e.name}`, p.x, p.y - 46, 12, c, 'center', 800);
  }
}
// Flechas en el borde de la pantalla hacia las marcas que no se ven
function drawPingArrows() {
  const p = player.alive ? player : spectate;
  if (!p) return;
  for (const e of activePings()) {
    const pg = e.ping, ps = w2s(pg.x, pg.y, 0), sx = ps.x, sy = ps.y;
    const m = 40, d = Math.round(dist(p.x, p.y, pg.x, pg.y) / 10);
    if (sx > m && sx < VW - m && sy > m && sy < VH - m) continue;
    const a = Math.atan2(sy - VH / 2, sx - VW / 2), ex = clamp(sx, m, VW - m), ey = clamp(sy, m + 30, VH - m);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -10); ctx.lineTo(-6, 10); ctx.closePath();
    ctx.fillStyle = pingColor(e); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    txt(`${d} m`, ex - Math.cos(a) * 22, ey - Math.sin(a) * 22, 11, pingColor(e), 'center', 800);
  }
}

/* ---------- Combate ---------- */
function startReload(e) {
  const g = e.guns[e.slot];
  if (!g || e.reloadT > 0 || g.mag >= WEAPONS[g.type].mag) return;
  e.reloadT = WEAPONS[g.type].reload; e.healT = 0; e.inp.pressed = false;
  toHuman(e, { k: 's', n: 'reload' });
}
function tryFire(e) {
  if (e.down || e.veh) return false;
  const g = e.guns[e.slot]; if (!g) return false;
  const W = WEAPONS[g.type];
  if (e.reloadT > 0 || e.cd > 0) return false;
  if (g.mag <= 0) { toHuman(e, { k: 's', n: 'empty' }); startReload(e); return false; }
  e.healT = 0; g.mag--; e.cd = W.rate; e.lastShot = time;
  const spreadMul = e.human && e.moving ? 1.5 : 1, dmg = W.dmg * TIERS[g.tier].mult;
  const ox = e.x + Math.cos(e.ang) * (e.r + W.len - 4), oy = e.y + Math.sin(e.ang) * (e.r + W.len - 4);
  const sent = [];
  for (let i = 0; i < W.pellets; i++) {
    const a = e.ang + (Math.random() - 0.5) * 2 * W.spread * spreadMul;
    const sp = W.speed * (W.pellets > 1 ? rand(0.85, 1.15) : 1);
    const b = { x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg, owner: e, life: W.range / W.speed, weapon: W.name, tier: g.tier, rk: !!W.rocket };
    bullets.push(b);
    sent.push([r0(b.x), r0(b.y), r0(b.vx), r0(b.vy), r2(b.life)]);
  }
  bcast({ k: 'f', o: e.id, w: GUNS.indexOf(g.type), b: sent });
  const [v, pan] = spatial(e.x, e.y, 1300);
  noise((e === player ? 0.22 : 0.17) * v * (W.silent ? 0.35 : 1), W.snd[0], W.snd[1], e === player ? 0 : pan);
  // los bots cercanos oyen el disparo (la ballesta no se oye)
  if (!W.silent && time - e.noiseT > 0.8) {
    e.noiseT = time;
    for (const o of ents) {
      if (o === e || o.human || !o.alive || o.air !== 'ground' || o.target) continue;
      const d = dist(o.x, o.y, e.x, e.y);
      if (d > 1000 || d < 100 || Math.random() > 0.35) continue;
      o.wp = o.hp > 50
        ? { x: lerp(o.x, e.x, 0.6), y: lerp(o.y, e.y, 0.6) }
        : { x: clamp(o.x + (o.x - e.x) * 0.6, 60, WORLD - 60), y: clamp(o.y + (o.y - e.y) * 0.6, 60, WORLD - 60) };
    }
  }
  if (g.mag <= 0) startReload(e);
  return true;
}
function damage(e, dmg, src, weapon) {
  if (!e.alive || e.air !== 'ground') return;
  if (src && src !== e && src.team === e.team) return; // sin fuego amigo
  if (e.down) { // derribado: el daño va directo a su vida de "sangrado"
    e.hp -= dmg; e.hitT = 0.1; e.lastHurt = time;
    if (e.human) toHuman(e, { k: 'h' });
    if (src && src.human && src !== e) toHuman(src, { k: 'd', id: e.id, v: r1(dmg), a: 0 });
    if (e.hp <= 0) kill(e, src || e.knocker, weapon);
    return;
  }
  if (src && !src.human && !e.human) dmg *= 0.6; // peleas entre bots más largas: llegan más rivales al final
  let d = dmg;
  const hadArmor = e.armor > 0;
  if (hadArmor) { const ab = Math.min(e.armor, d * 0.5); e.armor -= ab; d -= ab; }
  e.hp -= d; e.hitT = 0.1; e.lastHurt = time;
  if (e.human) toHuman(e, src && src !== e ? { k: 'h', x: r0(src.x), y: r0(src.y) } : { k: 'h' });
  if (src && src.human && src !== e) toHuman(src, { k: 'd', id: e.id, v: r1(dmg), a: hadArmor ? 1 : 0 });
  if (!e.human && src && src !== e && !e.target) e.wp = { x: lerp(e.x, src.x, 0.5), y: lerp(e.y, src.y, 0.5) };
  for (let i = 0; i < 4; i++) particles.push({ x: e.x, y: e.y, vx: rand(-120, 120), vy: rand(-120, 120), life: 0.35, max: 0.35, color: '#ff4d6d', size: 3 });
  if (Math.random() < 0.3) {
    const bx = e.x + rand(-14, 14), by = e.y + rand(-14, 14);
    decal(c => { c.fillStyle = 'rgba(120,10,20,.35)'; c.beginPath(); c.arc(bx, by, rand(2, 5), 0, Math.PI * 2); c.fill(); }, bx, by, 6);
  }
  if (e.hp <= 0) {
    // en equipos, si te queda un compañero en pie, quedas derribado en vez de morir
    if (teamsOn() && standingMates(e)) knock(e, src, weapon); else kill(e, src, weapon);
  }
}
function kill(e, src, weapon) {
  if (!e.alive) return;
  if (e.down && !src) src = e.knocker; // se desangró: la baja es de quien lo derribó
  if (e.veh) { const v = e.veh; v.driver = null; e.veh = null; }
  e.alive = false; e.hp = 0; e.killer = src; e.down = false; e.rev = 0;
  const aliveNow = ents.filter(o => o.alive).length;
  const teamLeft = ents.some(o => o.alive && o.team === e.team), teamsNow = aliveTeams();
  // puesto: se decide cuando cae el último del equipo (en individual, al morir)
  e.place = teamLeft ? 0 : teamsNow + 1;
  if (!teamLeft) for (const m of ents) if (m !== e && m.team === e.team) {
    m.place = e.place;
    if (m.human && m !== player) toHuman(m, { k: 'pl', place: e.place });
  }
  if (src && src !== e) src.kills++;
  const text = e.disc ? `${e.name} se desconectó`
    : src === e ? (e === player && net.role === 'solo' ? 'Te alcanzó tu propia granada' : `${e.name} cayó en su propia granada`)
    : src ? `${src.name} eliminó a ${e.name}${weapon ? ' · ' + weapon : ''}` : weapon === 'Lava' ? `${e.name} cayó en la lava` : `${e.name} murió en la zona`;
  pushFeed(text, 6, e === player || src === player);
  bcast({ k: 'fd', text, ids: [e.id, src ? src.id : -1] });
  bcast({ k: 'k', id: e.id });
  if (e.air === 'ground') makeBox(e); // su equipo queda en una caja de botín
  if (!e.disc) dieFx(e);
  if (src && src.human && src !== e) {
    toHuman(src, { k: 'kl' });
    src.streak = time - src.lastKillT < 5 ? src.streak + 1 : 1; src.lastKillT = time;
    if (src.streak >= 2) toHuman(src, { k: 'a', text: src.streak === 2 ? '¡Doble baja!' : src.streak === 3 ? '¡Triple baja!' : '¡Imparable!', c: '#ff7b7b' });
  }
  if (src && !src.human && src !== e && Math.random() < 0.12) setEmo(src, 1); // a veces los bots se ríen
  if (e.human && gmode !== 'duelo') { // en duelo, morir solo pierde la ronda
    if (e === player) endGame(false);
    else toHuman(e, { k: 'dead', place: e.place, killer: src ? src.id : -1 });
  }
  // si en su equipo no queda nadie en pie, los derribados caen también
  if (!ents.some(o => o.alive && !o.down && o.team === e.team)) {
    const downed = ents.filter(o => o.alive && o.down && o.team === e.team);
    if (downed.length) { for (const m of downed) kill(m, m.knocker); return; }
  }
  if (gmode === 'zombis') { zombieAfterKill(); return; }
  if (gmode === 'duelo') { duelAfterKill(); return; }
  if (teamsNow <= 1) {
    const w = ents.find(o => o.alive);
    finishMatch(w ? w.team : null);
  } else if (ents.some(o => o.alive && o.human) && (gmode === 'normal' || gmode === 'rapida' || gmode === 'semana')) {
    if (!teamsOn() && [10, 5, 3, 2].includes(aliveNow) && !(src && src.human && src.streak >= 2)) announceAll(`Quedan ${aliveNow} jugadores`);
    else if (teamsOn() && !teamLeft && [5, 3, 2].includes(teamsNow)) announceAll(`Quedan ${teamsNow} equipos`);
  }
}
function aliveTeams() { const s = new Set(); for (const o of ents) if (o.alive) s.add(o.team); return s.size; }
// Fin de partida (lo decide el anfitrión o el modo solo): gana el equipo wt (null = nadie)
function finishMatch(wt) {
  if (net.role === 'host') recordBoard(wt);
  if (wt == null) return;
  for (const h of ents) {
    if (!h.human || h.team !== wt) continue;
    if (h === player) teamWon(); else toHuman(h, { k: 'win' });
  }
}
// Tu equipo ganó: estés vivo, observando o ya viendo los resultados
function teamWon() {
  if (state === 'play') endGame(true);
  else if (specMode) finishSpectate(ents.find(o => o.alive) || null, 1800, true);
  else if (state === 'over') showResult(true, ents.find(o => o.alive) || null, 200);
}

/* ---------- Movimiento ---------- */
function resolveObstacles(e) {
  for (const c of circles) {
    const dx = e.x - c.x, dy = e.y - c.y, min = c.r + e.r;
    if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
    const d = Math.hypot(dx, dy);
    if (d < min && d > 0.001) { e.x = c.x + dx / d * min; e.y = c.y + dy / d * min; }
  }
  for (const q of rects) {
    if (e.x + e.r < q.x || e.x - e.r > q.x + q.w || e.y + e.r < q.y || e.y - e.r > q.y + q.h) continue;
    const cx = clamp(e.x, q.x, q.x + q.w), cy = clamp(e.y, q.y, q.y + q.h);
    const dx = e.x - cx, dy = e.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= e.r * e.r) continue;
    if (d2 > 0.0001) { const d = Math.sqrt(d2); e.x = cx + dx / d * e.r; e.y = cy + dy / d * e.r; }
    else {
      const l = e.x - q.x, r = q.x + q.w - e.x, t = e.y - q.y, b = q.y + q.h - e.y, m = Math.min(l, r, t, b);
      if (m === l) e.x = q.x - e.r; else if (m === r) e.x = q.x + q.w + e.r;
      else if (m === t) e.y = q.y - e.r; else e.y = q.y + q.h + e.r;
    }
  }
  e.x = clamp(e.x, e.r, WORLD - e.r); e.y = clamp(e.y, e.r, WORLD - e.r);
}
function moveEnt(e, vx, vy, dt) { e.x += vx * dt; e.y += vy * dt; resolveObstacles(e); }
function separate() {
  for (let i = 0; i < ents.length; i++) {
    const a = ents[i]; if (!a.alive || a.air !== 'ground' || a.veh) continue;
    for (let j = i + 1; j < ents.length; j++) {
      const b = ents[j]; if (!b.alive || b.air !== 'ground' || b.veh) continue;
      const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      const d = Math.hypot(dx, dy);
      if (d < min && d > 0.001) {
        const push = (min - d) / 2, ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push;
        resolveObstacles(a); resolveObstacles(b);
      }
    }
  }
}
function canSee(v, o, d = dist(v.x, v.y, o.x, o.y)) {
  if (d < 45) return true;
  if (o.inBush && d > 130 && time - o.lastShot > 0.6) return false;
  if (o.bld >= 0 && o.bld !== v.bld && d > 150) return false; // dentro de una casa con techo
  return los(v.x, v.y, o.x, o.y);
}

/* ---------- Jugador ---------- */
function mouseWorld() { if (on3D()) return groundAt(mouse.x, mouse.y, AIM_H); return { x: (mouse.x - VW / 2) / cam.z + cam.x, y: (mouse.y - VH / 2) / cam.z + cam.y }; }
function movePlayer(dt) {
  const p = player;
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my--;
  if (keys.KeyS || keys.ArrowDown) my++;
  if (keys.KeyA || keys.ArrowLeft) mx--;
  if (keys.KeyD || keys.ArrowRight) mx++;
  let analog = 1, stickSprint = false;
  if (touch.move && touch.move.mag > 0.15) {
    mx = touch.move.dx; my = touch.move.dy;
    analog = Math.min(1, touch.move.mag * 1.15); stickSprint = touch.move.mag > 0.97;
  }
  [mx, my] = rotIn(mx, my);
  const l = Math.hypot(mx, my);
  p.moving = l > 0;
  const wantSprint = (keys.ShiftLeft || keys.ShiftRight || stickSprint) && p.moving && !mouse.down && p.healT <= 0 && !p.down;
  p.sprint = wantSprint && p.stamina > 1;
  if (p.sprint) p.stamina = Math.max(0, p.stamina - 28 * dt); else p.stamina = Math.min(100, p.stamina + 16 * dt);
  const sp = SPEED * analog * charSpeed(p) * (p.down ? 0.3 : 1) * (p.healT > 0 ? 0.5 : 1) * (p.sprint ? SPRINT : 1) * (p.wet ? 0.6 : 1);
  if (l > 0) {
    moveEnt(p, mx / l * sp, my / l * sp, dt);
    pushOutOfVehicles(p);
    if ((p.sprint || p.wet) && Math.random() < dt * 14)
      particles.push({ x: p.x + rand(-6, 6), y: p.y + rand(-6, 6), vx: rand(-30, 30), vy: rand(-30, 30), life: 0.4, max: 0.4, color: p.wet ? 'rgba(200,230,255,.8)' : 'rgba(200,190,160,.7)', size: 4 });
  }
  const m = mouseWorld();
  p.ang = Math.atan2(m.y - p.y, m.x - p.x);
}
function updatePlayer(dt) {
  const p = player;
  if (p.veh) { driveLocal(p, dt); return; }
  movePlayer(dt);
  fireWith(p, mouse);
}
// Conducir el coche propio (jugador local, en modo solo, anfitrión o invitado)
function driveLocal(p, dt) {
  const v = p.veh, [mx, my] = driveInput();
  stepVehicle(v, mx, my, dt);
  p.x = v.x; p.y = v.y; p.ang = v.ang; p.moving = false; p.sprint = false;
  p.stamina = Math.min(100, p.stamina + 16 * dt);
  mouse.down = mouse.pressed = false;
}
// inp = { down, pressed }: ratón/pantalla del jugador local o controles recibidos de un amigo
function fireWith(p, inp) {
  const g = p.guns[p.slot];
  if (g && !p.sprint) {
    if (WEAPONS[g.type].auto) { if (inp.down) tryFire(p); }
    else if (inp.pressed) { if (tryFire(p)) inp.pressed = false; }
  }
}
// Joystick derecho → punto de mira virtual (con ayuda de apuntado) y disparo al empujar
function applyTouchAim() {
  const p = player, a = touch.aim;
  if (!a || a.mag < 0.2) {
    if (touch.aimWas) { mouse.down = false; mouse.pressed = false; }
    touch.aimWas = false; return;
  }
  touch.aimWas = true;
  let ang = Math.atan2(a.dy, a.dx) + camYaw();
  const g = p.guns[p.slot], range = g ? WEAPONS[g.type].range : 600;
  let best = null, bd = aimAssist ? 0.26 : 0;
  for (const o of ents) {
    if (o === p || !o.alive || !o.seen || o.air !== 'ground' || o.team === p.team) continue;
    if (dist(p.x, p.y, o.x, o.y) > range) continue;
    const da = Math.abs(angDiff(Math.atan2(o.y - p.y, o.x - p.x), ang));
    if (da < bd) { bd = da; best = o; }
  }
  if (best) ang = Math.atan2(best.y - p.y, best.x - p.x);
  const r = 130 + a.mag * 150;
  if (on3D()) { const s = w2s(p.x + Math.cos(ang) * r / cam.z, p.y + Math.sin(ang) * r / cam.z, AIM_H); mouse.x = s.x; mouse.y = s.y; }
  else { mouse.x = VW / 2 + Math.cos(ang) * r; mouse.y = VH / 2 + Math.sin(ang) * r; }
  const fire = a.mag > 0.5;
  mouse.down = fire; mouse.pressed = fire;
}
function nearestGunLoot(e = player) {
  let best = null, bd = 48;
  for (const it of loot) {
    if (it.kind !== 'gun') continue;
    const d = dist(it.x, it.y, e.x, e.y);
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}
function pickupFor(p) {
  const it = nearestGunLoot(p);
  if (!it) return;
  loot.splice(loot.indexOf(it), 1);
  if (!p.guns[1]) { p.guns[1] = it.gun; p.slot = 1; }
  else { const old = p.guns[p.slot]; p.guns[p.slot] = it.gun; loot.push({ x: p.x, y: p.y, kind: 'gun', gun: old }); }
  p.reloadT = 0; p.cd = Math.max(p.cd, 0.2); p.inp.pressed = false;
  if (p === player) mouse.pressed = false;
  toHuman(p, { k: 's', n: 'pickup' });
}
function swapSlotFor(p, s) {
  if (!p.guns[s] || s === p.slot) return;
  p.slot = s; p.reloadT = 0; p.cd = Math.max(p.cd, 0.25); p.inp.pressed = false;
  if (p === player) mouse.pressed = false;
}
// Acción del jugador local: en modo cliente se envía al anfitrión, si no se ejecuta aquí
function act(a, x, y) {
  if (net.role === 'client') {
    if (a === 'nade') net.actions.push(['n', r0(x), r0(y)]);
    else if (a === 'wall') net.actions.push(['w', r2(x)]);
    else if (a === 'ping') net.actions.push(['pg', r0(x), r0(y)]);
    else if (a === 'box') net.actions.push(['b', x, y]);
    else net.actions.push(a);
    return;
  }
  doAct(player, a, x, y);
}
function doAct(e, a, x, y) {
  if (a === 'jump') { jump(e); return; }
  if (typeof a === 'string' && /^emo[0-9]$/.test(a)) { setEmo(e, +a[3]); return; }
  if (a === 'ping') { setPing(e, x, y); return; }
  if (typeof a === 'string' && /^qc[0-7]$/.test(a)) { sayQC(e, +a[2]); return; }
  if (!e.alive || e.air !== 'ground') return;
  if (a === 'veh') { toggleVehicle(e); return; }
  if (e.down || e.veh) return;
  if (a === 'pickup') {
    if (nearestGunLoot(e)) pickupFor(e);
    else { const b = nearestBox(e); if (b) takeFromBox(e, b.id, -1); }
  }
  else if (a === 'reload') startReload(e);
  else if (a === 'heal') startHeal(e);
  else if (a === 'nade') throwNade(e, x, y);
  else if (a === 'wall') placeWall(e, x);
  else if (a === 'box') takeFromBox(e, x, y);
  else if (a === 's0') swapSlotFor(e, 0);
  else if (a === 's1') swapSlotFor(e, 1);
}
// Reacciones rápidas (emojis sobre el personaje, las ven todos)
function setEmo(e, i) {
  if (!e.alive || !(i >= 0 && i < EMOS.length) || time - e.emoT < 1.2) return;
  e.emo = i; e.emoT = time;
  bcast({ k: 'em', id: e.id, i });
  emoSound(e);
}
function emoSound(e) {
  const [v, pan] = spatial(e.x, e.y, 900);
  if (v > 0.05) { tone(740, 0.07, 'sine', 0.07 * v); tone(1100, 0.09, 'sine', 0.06 * v, 0, 0.07); }
}
function drawEmo(e) {
  const k = time - e.emoT;
  if (e.emo < 0 || k < 0 || k > 2.6) return;
  const s = k < 0.15 ? 0.5 + k / 0.3 : 1, a = k > 2.2 ? (2.6 - k) / 0.4 : 1;
  const x = e.x, y = e.y - e.r - 30 - Math.min(k, 0.3) * 20;
  ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-6, 14); ctx.lineTo(0, 24); ctx.lineTo(6, 14); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke();
  ctx.font = '22px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
  ctx.fillText(EMOS[e.emo], 0, 1);
  ctx.restore();
}
function startHeal(e) {
  if (e.down || e.veh) return;
  if (e.meds > 0 && e.hp < 100 && e.healT <= 0) { e.healT = healDur(e); e.reloadT = 0; }
}

/* ---------- Bots ---------- */
const worstSlot = e => gunValue(e.guns[0]) <= gunValue(e.guns[1]) ? 0 : 1;
function wantsLoot(e, it) {
  if (it.kind === 'med') return e.meds < 3;
  if (it.kind === 'armor') return e.armor < 60;
  if (it.kind === 'nade') return e.nades < 3;
  if (it.kind === 'wall') return e.walls < wallCap(e);
  if (!it.gun) return false;
  const v = gunValue(it.gun);
  if (!e.guns[1]) return e.guns[0].type !== it.gun.type || v > gunValue(e.guns[0]) + 0.1;
  const same = e.guns[0].type === it.gun.type ? 0 : e.guns[1].type === it.gun.type ? 1 : -1;
  if (same >= 0) return v > gunValue(e.guns[same]) + 0.1;
  return v > gunValue(e.guns[worstSlot(e)]) + 0.1;
}
function botGunPickup(e, it, i) {
  if (!wantsLoot(e, it)) return;
  loot.splice(i, 1);
  let s;
  if (!e.guns[1]) s = e.guns[0].type === it.gun.type ? 0 : 1;
  else s = e.guns[0].type === it.gun.type ? 0 : e.guns[1].type === it.gun.type ? 1 : worstSlot(e);
  const old = e.guns[s];
  e.guns[s] = it.gun;
  if (e.slot === s) e.reloadT = 0;
  if (old) loot.push({ x: e.x + rand(-15, 15), y: e.y + rand(-15, 15), kind: 'gun', gun: old });
}
function randomWaypoint(e) {
  let px = clamp(e.x + rand(-600, 600), 60, WORLD - 60), py = clamp(e.y + rand(-600, 600), 60, WORLD - 60);
  const zr = Math.max(40, zone.tr * 0.8);
  if (dist(px, py, zone.tx, zone.ty) > zr) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * zr;
    px = clamp(zone.tx + Math.cos(a) * r, 60, WORLD - 60); py = clamp(zone.ty + Math.sin(a) * r, 60, WORLD - 60);
  }
  return { x: px, y: py };
}
function pickWaypoint(e) {
  let best = null, bd = Infinity;
  for (const it of loot) {
    const d = dist(it.x, it.y, e.x, e.y);
    const lim = it.kind === 'gun' && it.gun.tier >= 3 ? 1100 : 450; // el botín aéreo atrae desde lejos
    if (d < lim && d < bd && dist(it.x, it.y, zone.x, zone.y) < zone.r - 40 && wantsLoot(e, it)) { bd = d; best = it; }
  }
  for (const b of boxes) { // cajas de botín de los eliminados
    const d = dist(b.x, b.y, e.x, e.y);
    if (d < 500 && d < bd && dist(b.x, b.y, zone.x, zone.y) < zone.r - 40 && b.items.some(it => wantsLoot(e, { kind: it.k, gun: it.gun }))) { bd = d; best = b; }
  }
  return best ? { x: best.x, y: best.y } : randomWaypoint(e);
}
function chooseSlot(e, d) {
  const a = e.guns[0], b = e.guns[1];
  if (!a || !b) return;
  const score = g => Math.abs(WEAPONS[g.type].pref - d) - gunValue(g) * 60 + (g.mag === 0 ? 400 : 0) + (WEAPONS[g.type].rocket && d < 220 ? 900 : 0);
  const s = score(a) <= score(b) ? 0 : 1;
  if (s !== e.slot) { e.slot = s; e.reloadT = 0; e.cd = Math.max(e.cd, 0.35); }
}
function nearestDoor(b, x, y) {
  let best = null, bd = Infinity;
  for (const d of b.doors) { const k = dist(d.x, d.y, x, y); if (k < bd) { bd = k; best = d; } }
  return best;
}
// Navegación sencilla: usar las puertas para entrar y salir de las casas
function steer(e, tx, ty) {
  const bt = buildingAt(tx, ty), be = e.bld;
  if (be >= 0 && bt !== be) {
    const d = nearestDoor(buildings[be], tx, ty);
    if (d) return dist(e.x, e.y, d.x, d.y) < 45 ? { x: d.x + d.nx * 40, y: d.y + d.ny * 40 } : { x: d.x - d.nx * 26, y: d.y - d.ny * 26 };
  } else if (bt >= 0 && be !== bt) {
    const d = nearestDoor(buildings[bt], e.x, e.y);
    if (d) return dist(e.x, e.y, d.x, d.y) < 45 ? { x: d.x - d.nx * 40, y: d.y - d.ny * 40 } : { x: d.x + d.nx * 28, y: d.y + d.ny * 28 };
  }
  return { x: tx, y: ty };
}
// Punto detrás de un obstáculo cercano, del lado contrario al enemigo
function coverFrom(e, t) {
  let best = null, bd = 380;
  const pt = (ox, oy, rad) => {
    const d = dist(e.x, e.y, ox, oy);
    if (d > bd) return;
    const dx = ox - t.x, dy = oy - t.y, l = Math.hypot(dx, dy) || 1, px = ox + dx / l * (rad + e.r + 14), py = oy + dy / l * (rad + e.r + 14);
    if (px < 40 || py < 40 || px > WORLD - 40 || py > WORLD - 40 || dist(px, py, zone.x, zone.y) > zone.r - 30) return;
    best = { x: px, y: py }; bd = d;
  };
  for (const c of circles) if (c.kind !== 'shield' || c.sid) pt(c.x, c.y, c.r);
  for (const q of rects) if (q.kind !== 'wall') pt(q.x + q.w / 2, q.y + q.h / 2, Math.max(q.w, q.h) / 2);
  return best;
}
function updateBot(e, dt) {
  if (e.zombie) { zombieUpdate(e, dt); return; }
  if (e.target && !e.target.alive) e.target = null;
  if (e.down) { // derribado: se arrastra hacia el compañero en pie más cercano
    let m = null, md = Infinity;
    for (const o of ents) {
      if (o === e || !o.alive || o.down || o.team !== e.team || o.air !== 'ground') continue;
      const d = dist(e.x, e.y, o.x, o.y); if (d < md) { md = d; m = o; }
    }
    if (m && md > 40) {
      const s = steer(e, m.x, m.y), dx = s.x - e.x, dy = s.y - e.y, l = Math.hypot(dx, dy) || 1;
      e.ang = Math.atan2(dy, dx); moveEnt(e, dx / l * SPEED * 0.3, dy / l * SPEED * 0.3, dt);
    }
    return;
  }
  e.think -= dt;
  if (e.think <= 0) {
    e.think = rand(0.18, 0.32);
    e.helpMate = null;
    if (teamsOn()) { // compañero derribado cerca: ir a reanimarle
      let hd = 900;
      for (const o of ents) {
        if (o === e || !o.alive || !o.down || o.team !== e.team) continue;
        const d = dist(e.x, e.y, o.x, o.y); if (d < hd) { hd = d; e.helpMate = o; }
      }
    }
    let best = null, bd = time < 60 ? 520 : 680; // al principio se centran más en conseguir botín
    for (const o of ents) {
      if (o === e || !o.alive || o.air !== 'ground' || o.team === e.team) continue;
      const d = dist(e.x, e.y, o.x, o.y);
      if (d >= bd || (!o.human && d > 420 && e.target !== o) || !canSee(e, o, d)) continue;
      best = o; bd = d;
    }
    if (!best && e.target) { // perdió de vista al objetivo: perseguir o castigar con granada
      const t = e.target, d = dist(e.x, e.y, t.x, t.y);
      if (e.hp > 45) e.wp = { x: t.x, y: t.y };
      if (e.nades > 0 && time - e.nadeT > 4 && d > 150 && d < NADE_MAX && Math.random() < 0.5) throwNade(e, t.x, t.y);
    }
    if (best !== e.target) { e.target = best; if (best) e.fireDelay = diff.react * rand(0.7, 1.3); }
    e.aimErr = (Math.random() - 0.5) * 2 * diff.aim;
    if (best) chooseSlot(e, bd);
    else {
      if (e.hp < 50 && e.meds > 0 && e.healT <= 0 && !e.bushT) { // herido: busca un arbusto cercano para curarse escondido
        let bb = null, bdd = 450;
        for (const b of bushes) { const d = dist(e.x, e.y, b.x, b.y); if (d < bdd && dist(b.x, b.y, zone.x, zone.y) < zone.r - 60) { bdd = d; bb = b; } }
        if (bb) { e.wp = { x: bb.x, y: bb.y }; e.bushT = time; }
      }
      if (e.bushT && time - e.bushT > 6) e.bushT = 0;
      if (e.hp < 65 && (!e.bushT || dist(e.x, e.y, e.wp ? e.wp.x : e.x, e.wp ? e.wp.y : e.y) < 30)) startHeal(e);
      const g = e.guns[e.slot];
      if (e.healT <= 0 && g.mag < WEAPONS[g.type].mag * 0.6) startReload(e);
      if (!e.wp || dist(e.x, e.y, e.wp.x, e.wp.y) < 40) e.wp = pickWaypoint(e);
    }
    if (time - e.stuckT > 1.2) {
      if (!e.target && dist(e.x, e.y, e.stuckX, e.stuckY) < 25) e.wp = randomWaypoint(e);
      e.stuckX = e.x; e.stuckY = e.y; e.stuckT = time;
    }
  }
  let mx = 0, my = 0, sp = SPEED * 0.95 * charSpeed(e);
  const t = e.target, outside = dist(e.x, e.y, zone.x, zone.y) > zone.r - 60;
  const hm = e.helpMate;
  if (hm && hm.alive && hm.down && (!t || dist(e.x, e.y, t.x, t.y) > 380)) {
    // reanimar: llegar junto al compañero y quedarse quieto sin disparar
    const d = dist(e.x, e.y, hm.x, hm.y);
    if (d > 36) {
      const s = steer(e, hm.x, hm.y), dx = s.x - e.x, dy = s.y - e.y, l = Math.hypot(dx, dy) || 1;
      e.ang = Math.atan2(dy, dx);
      const k = sp * 1.15 * (e.wet ? 0.6 : 1);
      moveEnt(e, dx / l * k, dy / l * k, dt);
    } else e.ang = Math.atan2(hm.y - e.y, hm.x - e.x);
    return;
  }
  if (t) {
    const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const W = WEAPONS[e.guns[e.slot].type];
    e.ang = Math.atan2(dy, dx) + e.aimErr;
    const flee = e.hp < 35 && e.armor < 15 && e.meds > 0;
    const radial = flee ? -1 : d > W.pref + 60 ? 1 : d < W.pref - 60 ? -1 : 0;
    e.strafeT -= dt;
    if (time - e.lastHurt < 0.15 && e.strafeT > 0.35) e.strafeT = rand(0.1, 0.35); // le dan: cambia de lado antes
    if (e.strafeT <= 0) { e.strafe = Math.random() < 0.5 ? -1 : 1; e.strafeT = rand(0.6, 1.6); }
    const sw = flee ? 0.4 : 0.8;
    mx = ux * radial - uy * e.strafe * sw; my = uy * radial + ux * e.strafe * sw;
    // huir, recargar con el cargador vacío o curarse: ir a cubrirse detrás de una roca, árbol o caja
    const g0 = e.guns[e.slot];
    if (flee || (e.reloadT > 0 && g0.mag === 0) || e.healT > 0) {
      if (!e.cover || time - e.coverT > 1.5) { e.cover = coverFrom(e, t); e.coverT = time; }
      if (e.cover) {
        const cx = e.cover.x - e.x, cy = e.cover.y - e.y, cd = Math.hypot(cx, cy);
        if (cd > 12) { mx = cx / cd; my = cy / cd; } else { mx = my = 0; if (flee) startHeal(e); }
      }
    } else e.cover = null;
    e.fireDelay -= dt;
    if (e.fireDelay <= 0 && d < W.range * 0.95) { if (tryFire(e) && !W.auto) e.cd += rand(0.05, 0.35); }
    if (e.nades > 0 && d > 170 && d < NADE_MAX && time - e.nadeT > 5 && Math.random() < dt * 0.6)
      throwNade(e, t.x + rand(-30, 30), t.y + rand(-30, 30));
    // herido y a media distancia: se cubre con una pared
    if (e.walls > 0 && e.hp < 55 && d > 140 && time - e.wallT > 8 && time - e.lastHurt < 1 && Math.random() < dt * 2)
      placeWall(e, Math.atan2(dy, dx));
    if (outside) { const zx = zone.tx - e.x, zy = zone.ty - e.y, zd = Math.hypot(zx, zy) || 1; mx += zx / zd * 1.6; my += zy / zd * 1.6; }
  } else {
    let goal = e.wp;
    if (outside || (zone.state === 'shrink' && dist(e.x, e.y, zone.tx, zone.ty) > zone.tr * 0.9)) goal = { x: zone.tx, y: zone.ty };
    if (goal) {
      const s = steer(e, goal.x, goal.y), dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy) || 1;
      mx = dx / d; my = dy / d; e.ang = Math.atan2(dy, dx);
    }
    if (outside) sp *= 1.25;
  }
  if (TH.lava) for (const p of ponds) { // esquivar la lava
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    if (d < p.r + 30 && d > 0.1) { mx += dx / d * 3; my += dy / d * 3; }
  }
  for (const n of nades) { // huir de granadas cercanas
    const dx = e.x - n.x, dy = e.y - n.y, d = Math.hypot(dx, dy);
    if (d < NADE_R + 20 && d > 0.1) { mx += dx / d * 2.5; my += dy / d * 2.5; }
  }
  const l = Math.hypot(mx, my);
  if (l > 0.01) {
    sp *= (e.healT > 0 ? 0.5 : 1) * (e.wet ? 0.6 : 1);
    moveEnt(e, mx / l * sp, my / l * sp, dt);
  }
}

/* ---------- Actualización general ---------- */
function commonUpdate(e, dt) {
  e.cd -= dt; e.hitT -= dt;
  if (e.reloadT > 0) {
    e.reloadT -= dt;
    if (e.reloadT <= 0) { const g = e.guns[e.slot]; if (g) g.mag = WEAPONS[g.type].mag; }
  }
  if (e.healT > 0) {
    e.healT -= dt;
    if (e.healT <= 0 && e.meds > 0) { e.meds--; e.hp = Math.min(100, e.hp + (chIs(e, 'doc') ? 65 : 45)); toHuman(e, { k: 's', n: 'heal' }); }
  }
  if (!e.down && !e.veh) {
    for (let i = loot.length - 1; i >= 0; i--) {
      const it = loot[i];
      if (Math.abs(it.x - e.x) > 28 || Math.abs(it.y - e.y) > 28) continue;
      if (it.kind === 'med' && e.meds < 5) { e.meds++; loot.splice(i, 1); toHuman(e, { k: 's', n: 'pickup' }); }
      else if (it.kind === 'armor' && e.armor < 100) { e.armor = Math.min(100, e.armor + 50); loot.splice(i, 1); toHuman(e, { k: 's', n: 'pickup' }); }
      else if (it.kind === 'nade' && e.nades < 3) { e.nades++; loot.splice(i, 1); toHuman(e, { k: 's', n: 'pickup' }); }
      else if (it.kind === 'wall' && e.walls < wallCap(e)) { e.walls++; loot.splice(i, 1); toHuman(e, { k: 's', n: 'pickup' }); }
      else if (it.kind === 'gun' && !e.human) botGunPickup(e, it, i);
    }
    if (!e.human) { const b = nearestBox(e, 34); if (b) botLootBox(e, b); }
  }
  if (TH.lava && e.wet && !e.veh && e.air === 'ground') {
    e.hp -= 9 * dt;
    if (e === player) hurtFlash = Math.max(hurtFlash, 0.2);
    if (e.hp <= 0) { kill(e, null, 'Lava'); return; }
  }
  if (dist(e.x, e.y, zone.x, zone.y) > zone.r) {
    e.hp -= zone.dps * dt;
    if (e === player) hurtFlash = Math.max(hurtFlash, 0.15);
    if (e.hp <= 0) kill(e, null);
  }
}
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 10));
    const sx = b.vx * dt / steps, sy = b.vy * dt / steps;
    let remove = false;
    for (let s = 0; s < steps && !remove; s++) {
      b.x += sx; b.y += sy;
      const ob = blockedBy(b.x, b.y);
      if (ob) {
        remove = true;
        if (ob.kind === 'crate') { ob.hp -= b.dmg; if (ob.hp <= 0) breakCrate(ob); }
        if (ob.kind === 'shield') hitShield(ob.sid, b.dmg);
        for (let k = 0; k < 3; k++) particles.push({ x: b.x, y: b.y, vx: rand(-80, 80), vy: rand(-80, 80), life: 0.25, max: 0.25, color: ob.kind === 'tree' ? '#3c8a37' : ob.kind === 'shield' ? '#9be7ff' : '#d8d2c0', size: 2 });
        break;
      }
      const hv = vehicles.find(v => v.driver !== b.owner && Math.abs(v.x - b.x) < VEH_R && Math.abs(v.y - b.y) < VEH_R && dist(v.x, v.y, b.x, b.y) < VEH_R);
      if (hv) { hurtVehicle(hv, b.dmg, b.owner, b.weapon); remove = true; break; }
      for (const e of ents) {
        if (!e.alive || e === b.owner || e.air !== 'ground' || e.veh || (b.owner && e.team === b.owner.team)) continue;
        const dx = e.x - b.x, dy = e.y - b.y;
        if (dx * dx + dy * dy < e.r * e.r) { damage(e, b.dmg, b.owner, b.weapon); remove = true; break; }
      }
    }
    b.life -= dt;
    if (b.rk && Math.random() < dt * 40) particles.push({ x: b.x, y: b.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.5, max: 0.5, color: 'rgba(200,200,200,.6)', size: 5 });
    if (remove || b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD || b.y > WORLD) {
      bullets.splice(i, 1);
      if (b.rk) explode({ x: b.x - b.vx * 0.01, y: b.y - b.vy * 0.01, owner: b.owner }, 'Lanzacohetes');
    }
  }
}
function update(dt) {
  updateMode(dt);
  time += dt;
  plane.t += dt;
  plane.x = lerp(plane.x0, plane.x1, plane.t / plane.dur); plane.y = lerp(plane.y0, plane.y1, plane.t / plane.dur);
  updateZone(dt);
  for (const e of ents) {
    if (!e.alive) continue;
    if (e.air === 'plane') {
      e.x = clamp(plane.x, 0, WORLD); e.y = clamp(plane.y, 0, WORLD);
      if ((!e.human && plane.t >= e.jumpAt) || plane.t >= plane.dur - 0.2) jump(e);
    } else if (e.air === 'glide') {
      // los amigos conectados dirigen su caída en su teléfono; aquí solo corre el tiempo
      if (e.human && e !== player) { e.glideT -= dt; if (e.glideT <= 0) land(e); }
      else updateGlide(e, dt);
    }
    if (e.air === 'ground') {
      e.inBush = bushes.some(b => dist(b.x, b.y, e.x, e.y) < b.r - 4);
      e.bld = buildingAt(e.x, e.y); e.wet = inWater(e.x, e.y);
    }
  }
  if (player.alive && player.air === 'ground') {
    if (touchMode) applyTouchAim();
    updatePlayer(dt);
  }
  for (const e of ents) {
    if (!e.alive || e.air !== 'ground') continue;
    if (!e.human) updateBot(e, dt);
    else if (e !== player) fireWith(e, e.inp); // disparos de amigos conectados
  }
  for (const e of ents) if (e.alive && e.air === 'ground') commonUpdate(e, dt);
  updateVehicles(dt);
  separate();
  updateDowned(dt);
  updateBullets(dt);
  updateNades(dt);
  updateShields(dt);
  updateDrops(dt);
  updateFx(dt);
}
function updateFx(dt) {
  shake -= dt;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.y -= 28 * dt; f.t -= dt; if (f.t <= 0) floats.splice(i, 1); }
  for (let i = indicators.length - 1; i >= 0; i--) { indicators[i].t -= dt; if (indicators[i].t <= 0) indicators.splice(i, 1); }
  for (const f of feed) f.t -= dt;
  while (feed.length && feed[feed.length - 1].t <= 0) feed.pop();
  if (announce) { announce.t -= dt; if (announce.t <= 0) announce = null; }
  hitMarker -= dt; killMarker -= dt; hurtFlash -= dt;
}

/* ---------- Cámara ---------- */
const baseZoom = () => clamp(Math.min(VW / 1300, VH / 800), 0.6, 1.1);
function focusEnt() {
  if (player.alive) return player.air === 'plane' ? null : player;
  return spectate && spectate.alive && spectate.air !== 'plane' ? spectate : null;
}
function updateCamera(dt) {
  let zt = baseZoom();
  if (state === 'menu') {
    const t = performance.now() / 1000;
    cam.x = WORLD / 2 + Math.cos(t / 9) * 800; cam.y = WORLD / 2 + Math.sin(t / 11) * 800; cam.z = baseZoom() * 0.7;
    return;
  }
  const f = focusEnt();
  if (player.alive && player.air === 'plane') { cam.x = clamp(plane.x, 0, WORLD); cam.y = clamp(plane.y, 0, WORLD); zt *= 0.5; }
  else if (f === player) {
    cam.x = f.x; cam.y = f.y;
    if (f.air === 'glide') zt *= lerp(1, 0.55, f.glideT / GLIDE);
    else if (f.veh) zt *= 0.78; // conduciendo se ve más lejos
    else { const g = f.guns[f.slot]; if (g && g.type === 'francotirador') zt *= 0.72; else if (g && g.type === 'tirador') zt *= 0.84; }
  } else if (f) { const k = Math.min(1, dt * 4); cam.x = lerp(cam.x, f.x, k); cam.y = lerp(cam.y, f.y, k); }
  cam.z = lerp(cam.z, zt, Math.min(1, dt * 3));
}
