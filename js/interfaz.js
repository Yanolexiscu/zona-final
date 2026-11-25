'use strict';
// Zona Final · Interfaz (HUD), partida y modo espectador
// (los archivos comparten variables globales y se cargan en orden desde index.html)
/* ---------- Interfaz ---------- */
function drawMap(x, y, m, big) {
  const s = m / WORLD;
  ctx.save();
  rr(x - 3, y - 3, m + 6, m + 6, 8); ctx.fillStyle = 'rgba(10,12,28,.8)'; ctx.fill();
  ctx.beginPath(); ctx.rect(x, y, m, m); ctx.clip();
  ctx.drawImage(mini, x, y, m, m);
  ctx.beginPath(); ctx.rect(x, y, m, m); ctx.arc(x + zone.x * s, y + zone.y * s, Math.max(0.1, zone.r * s), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(110,30,170,.45)'; ctx.fill('evenodd');
  ctx.beginPath(); ctx.arc(x + zone.x * s, y + zone.y * s, Math.max(0.1, zone.r * s), 0, Math.PI * 2);
  ctx.strokeStyle = '#c77dff'; ctx.lineWidth = 2; ctx.stroke();
  if (zone.state !== 'done') {
    ctx.beginPath(); ctx.arc(x + zone.tx * s, y + zone.ty * s, Math.max(0.1, zone.tr * s), 0, Math.PI * 2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  if (plane.t < plane.dur) {
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(x + plane.x0 * s, y + plane.y0 * s); ctx.lineTo(x + plane.x1 * s, y + plane.y1 * s); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(x + plane.x * s, y + plane.y * s); ctx.rotate(plane.ang);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (Math.floor(time * 3) % 2 === 0) for (const d of drops) {
    ctx.fillStyle = '#ff4d4d'; ctx.fillRect(x + d.x * s - 4, y + d.y * s - 4, 8, 8);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x + d.x * s - 4, y + d.y * s - 4, 8, 8);
  }
  if (teamsOn() && state !== 'menu') for (const o of ents) { // compañeros vivos
    if (o === player || !o.alive || o.team !== player.team || o.air === 'plane') continue;
    ctx.beginPath(); ctx.arc(x + o.x * s, y + o.y * s, big ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = C_MATE(); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    if (big) txt(o.name, x + o.x * s, y + o.y * s - 14, 12, C_MATE(), 'center', 800);
  }
  if (big && state !== 'menu') for (const v of vehicles) { // coches libres
    if (v.driver && v.driver.team !== player.team) continue;
    ctx.save(); ctx.translate(x + v.x * s, y + v.y * s); ctx.rotate(v.ang);
    ctx.fillStyle = v.color; ctx.fillRect(-6, -4, 12, 8); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(-6, -4, 12, 8);
    ctx.restore();
  }
  if (state !== 'menu') {
    // Rastreador: enemigos que han disparado hace poco cerca de ti
    if (chIs(player, 'rastreador') && player.alive && player.air === 'ground') for (const o of ents) {
      if (!o.alive || o.team === player.team || o.air !== 'ground' || time - o.lastShot > 1.6 || dist(o.x, o.y, player.x, player.y) > 1100) continue;
      ctx.globalAlpha = 1 - (time - o.lastShot) / 1.6;
      ctx.beginPath(); ctx.arc(x + o.x * s, y + o.y * s, big ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4d4d'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const e of activePings()) { // marcas
      const px = x + e.ping.x * s, py = y + e.ping.y * s, r = big ? 7 : 5;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - r * 0.8, py - r * 1.6); ctx.arc(px, py - r * 2, r, Math.PI * 0.8, Math.PI * 0.2); ctx.closePath();
      ctx.fillStyle = pingColor(e); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }
  const f = player.alive ? (player.air === 'plane' ? null : player) : spectate && spectate.alive ? spectate : null;
  if (f) {
    const px = x + f.x * s, py = y + f.y * s;
    if (big) {
      ctx.strokeStyle = 'rgba(255,211,77,.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + m); ctx.moveTo(x, py); ctx.lineTo(x + m, py); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(px, py, big ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = f === player ? '#ffd34d' : '#ff5c7a'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();
}

function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const p = player;
  if (hurtFlash > 0) {
    const g = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.3, VW / 2, VH / 2, Math.max(VW, VH) * 0.7);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${Math.min(0.45, hurtFlash * 1.4)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  if (state !== 'menu' && p.alive && p.air === 'ground' && p.hp < 30) {
    const a = 0.18 + Math.sin(time * 6) * 0.08;
    const g = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(120,0,0,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  updateCursor();
  if (showFps) { // contador de FPS (Ajustes)
    const q = typeof r3 !== 'undefined' && r3 && use3D ? ' · 3D ' + r3.q : ' · 2D';
    txt(`${fpsNow} FPS${q}`, VW / 2, VH - 8, 11, fpsNow >= 50 ? '#9ae6b4' : fpsNow >= 30 ? '#f6e05e' : '#fc8181', 'center', 800);
  }
  if (state === 'menu') return;
  // burbujas de chat rápido sobre los jugadores
  for (const e of ents) {
    if (e.qc == null || time - e.qcT > 3 || time < e.qcT || !e.alive || (e.air === 'ground' && !e.seen && e.team !== p.team)) continue;
    const s = w2s(e.x, e.y, typeof PS === 'number' ? 66 * PS : 0), t = QC[e.qc];
    if (!s.ok) continue;
    const y = s.y - (on3D() ? 30 : 58);
    ctx.font = `800 ${bigTxt ? 14 : 12}px system-ui, "Segoe UI", sans-serif`;
    const w = ctx.measureText(t).width + 18;
    ctx.globalAlpha = Math.min(1, (3 - (time - e.qcT)) * 2);
    rr(s.x - w / 2, y - 12, w, 24, 12); ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(s.x - 5, y + 11); ctx.lineTo(s.x, y + 18); ctx.lineTo(s.x + 5, y + 11); ctx.fill();
    ctx.fillStyle = '#1b1f3b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, s.x, y);
    ctx.globalAlpha = 1;
  }
  const alive = ents.filter(e => e.alive).length;

  // panel de estado
  const tm = teamsOn(), teamsLeft = tm ? aliveTeams() : 0;
  if (touchMode) {
    const pw = tm ? 196 : 150;
    rr(54, 12, pw, 30, 15); ctx.fillStyle = 'rgba(10,12,28,.7)'; ctx.fill();
    txt(tm ? `👥 ${alive}  🚩 ${teamsLeft}  🎯 ${p.kills}` : `👥 ${alive}   🎯 ${p.kills}`, 68, 27, 14);
    if (muted) txt('🔇', 64 + pw, 27, 14);
  } else {
    rr(12, 12, 212, 135, 10); ctx.fillStyle = 'rgba(10,12,28,.7)'; ctx.fill();
    txt(tm ? `👥 Vivos: ${alive} · 🚩 Equipos: ${teamsLeft}` : `👥 Vivos: ${alive} / ${totalPlayers}`, 24, 32, tm ? 14 : 15);
    txt(`🎯 Bajas: ${p.kills}`, 24, 55, 15);
    txt(`➕ Botiquines: ${p.meds}  [Q]`, 24, 78, 15);
    txt(`💣 Granadas: ${p.nades}  [G]`, 24, 101, 15);
    txt(`🧱 Paredes: ${p.walls}  [F]`, 24, 124, 15);
    if (muted) txt('🔇', 24, 163, 16);
  }

  // zona
  let zt;
  if (zone.state === 'wait') zt = `${touchMode ? 'Zona en' : 'La zona se cierra en'} ${fmtTime(zone.timer)}`;
  else if (zone.state === 'shrink') zt = touchMode ? '⚠️ ¡Zona cerrándose!' : '⚠️ ¡La zona se está cerrando!';
  else zt = 'Zona final';
  const zw = touchMode ? 190 : 300;
  rr(VW / 2 - zw / 2, 12, zw, 30, 15); ctx.fillStyle = zone.state === 'shrink' ? 'rgba(120,30,170,.8)' : 'rgba(10,12,28,.7)'; ctx.fill();
  txt(zt, VW / 2, 27, touchMode ? 13 : 14, '#fff', 'center');
  if (gmode === 'zombis') txt(`🧟 Oleada ${Math.max(1, zWave)} de ${ZW_MAX} · quedan ${ents.filter(e => e.zombie && e.alive).length}`, VW / 2, 54, 13, '#b5f08a', 'center', 800);
  else if (gmode === 'duelo') txt(`⚔️ Ronda ${Math.max(1, duelRound)} · ` + (duelScore.length ? duelScore.map(([id, n]) => `${ents[id] ? (ents[id] === player ? 'Tú' : ents[id].name) : '?'} ${n}`).join(' – ') : 'a 3 victorias'), VW / 2, 54, 13, '#ffd34d', 'center', 800);
  else txt(`Fase ${Math.min(zone.phase + 1, PH().length)} de ${PH().length}${gmode === 'rapida' ? ' · ⚡ rápida' : gmode === 'semana' && weekRule ? ' · ' + weekRule.name : ''}`, VW / 2, 54, 12, '#c8c8e8', 'center');

  // compañeros de equipo: nombre, foto y vida
  let matesH = 0;
  if (tm) {
    let my = touchMode ? 50 : muted ? 181 : 155;
    for (const o of ents) {
      if (o === p || o.team !== p.team) continue;
      rr(12, my, 168, 22, 7); ctx.fillStyle = 'rgba(10,12,28,.7)'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(24, my + 11, 8, 0, Math.PI * 2); ctx.fillStyle = o.color; ctx.fill();
      const im = avImg(o.av); if (im) { ctx.clip(); ctx.drawImage(im, 16, my + 3, 16, 16); }
      ctx.restore();
      txt(o.name, 37, my + 11, 11, o.alive ? (o.down ? C_FOE() : C_MATE()) : '#7d84ad', 'left', 700);
      if (o.alive && o.down) {
        ctx.fillStyle = '#2a2f5a'; ctx.fillRect(112, my + 8, 60, 6);
        ctx.fillStyle = Math.floor(time * 3) % 2 ? '#f56565' : '#ff9aa8'; ctx.fillRect(112, my + 8, 60 * Math.max(0, o.hp) / 100, 6);
        txt('🩸', 104, my + 11, 11, '#fff', 'center');
      } else if (o.alive) {
        ctx.fillStyle = '#2a2f5a'; ctx.fillRect(112, my + 8, 60, 6);
        ctx.fillStyle = o.hp > 50 ? '#48bb78' : o.hp > 25 ? '#ed8936' : '#f56565'; ctx.fillRect(112, my + 8, 60 * Math.max(0, o.hp) / 100, 6);
      } else txt('💀', 142, my + 11, 12, '#fff', 'center');
      my += 26; matesH += 26;
    }
  }

  // minimapa + noticias
  const mm = miniSize();
  drawMap(VW - mm - 12, 12, mm, false);
  uiRects.minimap = { x: VW - mm - 16, y: 8, w: mm + 8, h: mm + 8 };
  let fy = touchMode ? 50 + matesH : mm + 24;
  for (const f of touchMode ? feed.slice(0, 3) : feed) {
    ctx.globalAlpha = Math.min(1, f.t);
    const fs = touchMode ? 11 : 13;
    ctx.font = `600 ${fs}px system-ui, "Segoe UI", sans-serif`;
    const w = ctx.measureText(f.text).width + 18;
    const fx = touchMode ? 12 : VW - 12 - w;
    rr(fx, fy, w, fs + 11, 6); ctx.fillStyle = f.mine ? 'rgba(255,211,77,.25)' : 'rgba(10,12,28,.65)'; ctx.fill();
    txt(f.text, touchMode ? fx + 9 : VW - 21, fy + (fs + 11) / 2, fs, f.mine ? '#ffe9a3' : '#eef0ff', touchMode ? 'left' : 'right');
    fy += fs + 15;
  }
  ctx.globalAlpha = 1;
  if (!showMap) drawPingArrows();

  // anuncio grande
  if (announce) {
    const k = announce.t / announce.max, s = 1 + Math.max(0, k - 0.85) * 2.5;
    ctx.globalAlpha = Math.min(1, announce.t * 2);
    txt(announce.text, VW / 2, VH * 0.22, Math.round(30 * s), announce.color, 'center', 900);
    ctx.globalAlpha = 1;
  }

  if (!p.alive) {
    if (!specMode && spectate && spectate.alive) txt(`Observando a ${spectate.name}`, VW / 2, VH - 40, 16, '#eef0ff', 'center', 700);
    if (showMap) drawBigMap();
    return;
  }
  if (p.air === 'plane') {
    txt(touchMode ? '✈️ Toca la pantalla para saltar' : '✈️ Pulsa ESPACIO o haz clic para saltar', VW / 2, VH - 90, touchMode ? 20 : 24, '#ffd34d', 'center', 800);
    txt(`${touchMode ? 'Toca el minimapa para ver el mapa' : 'Mantén TAB para ver el mapa'} · El avión sale en ${fmtTime(plane.dur - plane.t)}`, VW / 2, VH - 58, touchMode ? 13 : 15, '#eef0ff', 'center');
    if (showMap) drawBigMap(); else drawTouchUI();
    return;
  }
  if (p.air === 'glide') {
    txt(touchMode ? '🪂 Dirige tu caída con el joystick izquierdo' : '🪂 Dirige tu caída con WASD', VW / 2, VH - 90, touchMode ? 18 : 22, '#ffd34d', 'center', 800);
    txt(`Aterrizas en ${Math.max(0, p.glideT).toFixed(1)} s`, VW / 2, VH - 58, 15, '#eef0ff', 'center');
    if (showMap) drawBigMap(); else drawTouchUI();
    return;
  }

  // barras de vida, escudo y resistencia
  const bw = Math.min(touchMode ? 260 : 340, VW - 40), bx = VW / 2 - bw / 2, by = VH - 50;
  rr(bx - 6, by - 20, bw + 12, 52, 10); ctx.fillStyle = 'rgba(10,12,28,.7)'; ctx.fill();
  ctx.fillStyle = '#2a2f5a'; ctx.fillRect(bx, by - 12, bw, 7);
  ctx.fillStyle = '#63b3ed'; ctx.fillRect(bx, by - 12, bw * p.armor / 100, 7);
  ctx.fillStyle = '#2a2f5a'; ctx.fillRect(bx, by, bw, 18);
  ctx.fillStyle = p.hp > 50 ? '#48bb78' : p.hp > 25 ? '#ed8936' : '#f56565';
  ctx.fillRect(bx, by, bw * Math.max(0, p.hp) / 100, 18);
  txt(`${Math.ceil(Math.max(0, p.hp))}`, VW / 2, by + 9, 13, '#fff', 'center', 800);
  ctx.fillStyle = '#2a2f5a'; ctx.fillRect(bx, by + 22, bw, 4);
  ctx.fillStyle = p.stamina > 25 ? '#f6e05e' : '#ed8936'; ctx.fillRect(bx, by + 22, bw * p.stamina / 100, 4);
  const C = CHARS[p.ch];
  if (C && bx > 110) txt(`${C.icon} ${C.name}`, bx - 14, by + 9, 13, '#c8c8e8', 'right', 700);

  // derribado / reanimando a un compañero
  if (p.down) {
    txt('🩸 ¡DERRIBADO!', VW / 2, VH * 0.3, touchMode ? 24 : 30, '#ff5c7a', 'center', 900);
    txt(p.rev > 0 ? `Te están reanimando… ${Math.floor(p.rev * 100)} %` : 'Arrástrate hasta un compañero: si se queda quieto a tu lado, te reanima',
      VW / 2, VH * 0.3 + 30, touchMode ? 13 : 15, p.rev > 0 ? C_MATE() : '#eef0ff', 'center', 700);
  } else if (teamsOn() && !p.veh) {
    let dm = null, dd = 130;
    for (const o of ents) { if (o !== p && o.alive && o.down && o.team === p.team) { const d = dist(o.x, o.y, p.x, p.y); if (d < dd) { dd = d; dm = o; } } }
    if (dm) {
      const close = dd < 55;
      txt(close && dm.rev > 0 ? `💚 Reanimando a ${dm.name}… ${Math.floor(dm.rev * 100)} %` : close ? `💚 Quédate quieto y sin disparar para reanimar a ${dm.name}` : `Acércate a ${dm.name} para reanimarle`,
        VW / 2, VH / 2 + 36, touchMode ? 13 : 15, C_MATE(), 'center', 800);
    }
  }

  // armas
  const sw = Math.min(touchMode ? 130 : 170, (VW - 40) / 2), sy = VH - 126;
  for (let i = 0; i < 2; i++) {
    const g = p.guns[i], x = VW / 2 + (i === 0 ? -sw - 5 : 5), sel = i === p.slot;
    const tc = g ? TIERS[g.tier].color : '#6b7099';
    uiRects.slots[i] = { x, y: sy, w: sw, h: 54 };
    rr(x, sy, sw, 54, 10); ctx.fillStyle = sel ? 'rgba(255,211,77,.14)' : 'rgba(10,12,28,.7)'; ctx.fill();
    ctx.strokeStyle = sel ? tc : 'rgba(255,255,255,.15)'; ctx.lineWidth = sel ? 2.5 : 1.5; ctx.stroke();
    txt(String(i + 1), x + 12, sy + 14, 12, '#9aa0c8');
    if (!g) { txt('Vacío', x + sw / 2, sy + 27, 14, '#6b7099', 'center'); continue; }
    const W = WEAPONS[g.type];
    txt(W.name, x + 28, sy + 15, 14, tc, 'left', 700);
    if (W.name.length <= (touchMode ? 8 : 11)) txt(TIERS[g.tier].name, x + sw - 10, sy + 15, 10, tc, 'right');
    if (sel && p.reloadT > 0) {
      txt('Recargando…', x + 28, sy + 37, 13, '#ffd34d');
      ctx.fillStyle = '#ffd34d'; ctx.fillRect(x + 8, sy + 48, (sw - 16) * (1 - p.reloadT / W.reload), 3);
    } else txt(`${g.mag} / ${W.mag}`, x + 28, sy + 37, 15, g.mag === 0 ? '#f56565' : '#eef0ff', 'left', 700);
  }
  if (p.healT > 0) txt('Curando…', VW / 2, sy - 18, 14, C_GOOD(), 'center', 700);

  // recoger
  const it = p.veh || p.down ? null : nearestGunLoot();
  uiRects.pickup = null;
  if (it) {
    const tc = TIERS[it.gun.tier].color;
    const t = `${touchMode ? '👆 Recoger' : '[E] Recoger'} ${WEAPONS[it.gun.type].name} (${TIERS[it.gun.tier].name})`;
    ctx.font = '700 15px system-ui, sans-serif';
    const w = ctx.measureText(t).width + 24, ph = touchMode ? 40 : 30, py = VH / 2 + 50;
    rr(VW / 2 - w / 2, py, w, ph, ph / 2); ctx.fillStyle = 'rgba(10,12,28,.85)'; ctx.fill();
    ctx.strokeStyle = tc; ctx.lineWidth = touchMode ? 2.5 : 1.5; ctx.stroke();
    txt(t, VW / 2, py + ph / 2, 15, tc, 'center', 700);
    uiRects.pickup = { x: VW / 2 - w / 2 - 10, y: py - 10, w: w + 20, h: ph + 20 };
  }
  // coche
  if (!touchMode && !p.down && (p.veh || nearFreeVehicle(p))) {
    const t = p.veh ? '[V] Bajar del coche' : '🚗 [V] Conducir';
    ctx.font = '700 15px system-ui, sans-serif';
    const w = ctx.measureText(t).width + 24, py = VH / 2 + (it ? 90 : 50);
    rr(VW / 2 - w / 2, py, w, 30, 15); ctx.fillStyle = 'rgba(10,12,28,.85)'; ctx.fill();
    ctx.strokeStyle = '#9be7ff'; ctx.lineWidth = 1.5; ctx.stroke();
    txt(t, VW / 2, py + 15, 15, '#9be7ff', 'center', 700);
  }
  if (p.veh) {
    const v = p.veh;
    txt(`🚗 ${Math.round(Math.abs(v.sp) / 4)} km/h · ❤️ ${Math.max(0, Math.ceil(v.hp / VEH_HP * 100))} %`, VW / 2, VH - 140, 14, '#9be7ff', 'center', 800);
  }

  // fuera de la zona
  if (dist(p.x, p.y, zone.x, zone.y) > zone.r) {
    txt('¡Estás fuera de la zona! Sigue la flecha', VW / 2, 84, 17, C_FOE(), 'center', 800);
    const a = Math.atan2(zone.ty - p.y, zone.tx - p.x) - camYaw(), ax = VW / 2 + Math.cos(a) * 70, ay = VH / 2 + Math.sin(a) * 70;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6; ctx.fill(); ctx.restore();
  }

  // indicadores de daño recibido
  for (const ind of indicators) {
    const a = Math.atan2(ind.y - p.y, ind.x - p.x) - camYaw();
    ctx.beginPath(); ctx.arc(VW / 2, VH / 2, 78, a - 0.32, a + 0.32);
    ctx.strokeStyle = `rgba(255,60,60,${Math.min(0.9, ind.t)})`; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
  }

  // mira
  const g = p.guns[p.slot];
  if (g && !showMap && !p.veh && !p.down && (!touchMode || (touch.aim && touch.aim.mag >= 0.2))) {
    const W = WEAPONS[g.type], gap = 5 + W.spread * 160 * (p.moving ? 1.5 : 1), L = 7, mx = mouse.x, my = mouse.y;
    ctx.lineCap = 'round';
    for (const [col, lw] of [['rgba(0,0,0,.7)', 4], [p.sprint ? 'rgba(255,255,255,.35)' : '#ffffff', 2]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      ctx.moveTo(mx - gap - L, my); ctx.lineTo(mx - gap, my); ctx.moveTo(mx + gap, my); ctx.lineTo(mx + gap + L, my);
      ctx.moveTo(mx, my - gap - L); ctx.lineTo(mx, my - gap); ctx.moveTo(mx, my + gap); ctx.lineTo(mx, my + gap + L);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#fff'; ctx.fillRect(mx - 1, my - 1, 2, 2);
    if (p.reloadT > 0) {
      ctx.beginPath(); ctx.arc(mx, my, gap + L + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.reloadT / W.reload));
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.stroke();
    }
  }
  if (hitMarker > 0 || killMarker > 0) {
    const k = killMarker > 0, s = k ? 13 : 10;
    ctx.strokeStyle = k ? '#ff4d6d' : '#ffffff'; ctx.lineWidth = k ? 3 : 2; ctx.beginPath();
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      ctx.moveTo(mouse.x + dx * 5, mouse.y + dy * 5); ctx.lineTo(mouse.x + dx * s, mouse.y + dy * s);
    }
    ctx.stroke();
  }
  drawTutorial();
  drawChatMenu();
  if (showMap) drawBigMap(); else drawTouchUI();
}
function drawBigMap() {
  ctx.fillStyle = 'rgba(5,8,20,.6)'; ctx.fillRect(0, 0, VW, VH);
  const m = Math.min(VW, VH) - (touchMode ? 70 : 120);
  drawMap(VW / 2 - m / 2, VH / 2 - m / 2 + 10, m, true);
  uiRects.bigMap = { x: VW / 2 - m / 2, y: VH / 2 - m / 2 + 10, w: m, h: m };
  const canPing = state === 'play' && player.alive;
  txt(touchMode ? (canPing ? 'Mapa · toca un punto para marcarlo 📍 · fuera para cerrar' : 'Mapa · toca para cerrar')
    : canPing ? 'Mapa · clic para marcar un punto 📍 · suelta TAB para cerrar' : 'Mapa · suelta TAB para cerrar', VW / 2, VH / 2 - m / 2 - 12, 14, '#eef0ff', 'center', 700);
}
// Toque o clic en el mapa grande: marca ese punto para tu equipo
function bigMapPing(x, y) {
  const r = uiRects.bigMap;
  if (!r || !inRect(x, y, r) || !(state === 'play' && player.alive)) return false;
  act('ping', (x - r.x) / r.w * WORLD, (y - r.y) / r.h * WORLD);
  tone(880, 0.08, 'sine', 0.07); tone(1320, 0.1, 'sine', 0.06, 0, 0.08);
  return true;
}
const miniSize = () => touchMode ? Math.min(110, VH * 0.3) : Math.min(180, VW * 0.28);
// Botones táctiles: posición propia guardada (Ajustes → Colocar los botones táctiles)
let btnEdit = false, btnDrag = null, btnOff = {};
try { btnOff = JSON.parse(localStorage.getItem('zf-btn')) || {}; } catch (e) {}
const EDIT_OK = () => ({ x: VW / 2 - 70, y: 40 }), EDIT_RESET = () => ({ x: VW / 2 + 70, y: 40 });
function btnEditDown(x, y, pid) {
  if (dist(x, y, EDIT_OK().x, EDIT_OK().y) < 30) { btnEdit = false; btnDrag = null; try { localStorage.setItem('zf-btn', JSON.stringify(btnOff)); } catch (e) {} paused = false; return; }
  if (dist(x, y, EDIT_RESET().x, EDIT_RESET().y) < 30) { btnOff = {}; return; }
  let best = null, bd = 44;
  for (const b of touchButtons()) { const d = dist(x, y, b.x, b.y); if (d < bd) { bd = d; best = b; } }
  if (best) btnDrag = { id: best.id, pid, sx: x, sy: y, o: (btnOff[best.id] || [0, 0]).slice() };
}
function btnEditMove(x, y, pid) {
  if (!btnDrag || btnDrag.pid !== pid) return;
  btnOff[btnDrag.id] = [btnDrag.o[0] + x - btnDrag.sx, btnDrag.o[1] + y - btnDrag.sy];
}
function touchButtons() {
  return touchButtonsBase().map(b => {
    const o = btnOff[b.id];
    if (o) { b.x = clamp(b.x + o[0], 30, VW - 30); b.y = clamp(b.y + o[1], 30, VH - 30); }
    return b;
  });
}
function touchButtonsBase() {
  const base = Math.max(VH * 0.5, miniSize() + 130), p = player, busy = p.down || !!p.veh;
  return [
    { id: 'nade', x: VW - 52, y: base - 66, icon: '💣', n: p.nades, hide: busy },
    { id: 'heal', x: VW - 118, y: base - 33, icon: '➕', n: p.meds, hide: busy },
    { id: 'reload', x: VW - 52, y: base, icon: '🔄', hide: busy },
    { id: 'emo', x: VW - 184, y: base - 66, icon: '😀' },
    { id: 'chat', x: VW - 118, y: base - 99, icon: '💬' },
    { id: 'wall', x: VW - 184, y: base, icon: '🧱', n: p.walls, hide: busy },
    { id: 'veh', x: VW - 250, y: base - 33, icon: p.veh ? '🚪' : '🚗', hide: p.down || (!p.veh && !nearFreeVehicle(p)) },
    { id: 'cam', x: VW - miniSize() - 52, y: 40, icon: '🧭', hide: !on3D() },
  ].filter(b => btnEdit || !b.hide);
}
// Abanico de reacciones que se abre al tocar 😀
function emoButtons() {
  const b = touchButtons().find(b => b.id === 'emo');
  // cuadrícula 2×2 a la izquierda del botón, sin tapar el centro (donde está tu personaje)
  return EMOS.map((icon, i) => ({ i, icon, x: b.x - 50 * (Math.floor(i / 2) + 1), y: b.y - 24 + (i % 2) * 48 }));
}
function drawStick(s, defX, defY, label, active) {
  const bx = s ? s.bx : defX, by = s ? s.by : defY;
  ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, Math.PI * 2);
  ctx.fillStyle = s ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.04)'; ctx.fill();
  ctx.strokeStyle = s ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.stroke();
  const kx = bx + (s ? s.dx * STICK_R : 0), ky = by + (s ? s.dy * STICK_R : 0);
  ctx.beginPath(); ctx.arc(kx, ky, 26, 0, Math.PI * 2);
  ctx.fillStyle = active ? 'rgba(255,90,90,.55)' : s ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.12)'; ctx.fill();
  if (!s) txt(label, bx, by + STICK_R + 14, 12, 'rgba(255,255,255,.4)', 'center');
}
// Panel de frases del chat rápido (T en teclado, 💬 en el móvil)
let chatOpen = false;
function chatRects() {
  const w = touchMode ? 150 : 180, h = touchMode ? 30 : 28, x0 = VW / 2 - w - 4, y0 = touchMode ? 72 : 96;
  return QC.map((t, i) => ({ i, t, x: x0 + (i % 2) * (w + 8), y: y0 + Math.floor(i / 2) * (h + 6), w, h }));
}
function drawChatMenu() {
  if (!chatOpen || state !== 'play' || !player.alive) { if (state !== 'play') chatOpen = false; return; }
  for (const r of chatRects()) {
    rr(r.x, r.y, r.w, r.h, 10); ctx.fillStyle = 'rgba(10,12,28,.9)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,77,.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    txt((touchMode ? '' : (r.i + 1) + ' · ') + r.t, r.x + r.w / 2, r.y + r.h / 2, 13, '#ffe9a3', 'center', 700);
  }
  if (!touchMode) txt('Pulsa 1-8 para enviar · T para cerrar', VW / 2, chatRects()[7].y + 44, 12, '#c8cde8', 'center', 600);
}
function drawBtnEdit() {
  ctx.fillStyle = 'rgba(5,8,20,.55)'; ctx.fillRect(0, 0, VW, VH);
  txt('Arrastra los botones a donde quieras', VW / 2, 82, 15, '#ffe9a3', 'center', 800);
  for (const [b, t, c] of [[EDIT_OK(), '✔', '#5dffb1'], [EDIT_RESET(), '↺', '#ffd34d']]) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 26, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10,12,28,.9)'; ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke();
    txt(t, b.x, b.y + 1, 22, c, 'center', 800);
  }
  txt('Guardar', EDIT_OK().x, EDIT_OK().y + 38, 11, '#c8cde8', 'center'); txt('Restablecer', EDIT_RESET().x, EDIT_RESET().y + 38, 11, '#c8cde8', 'center');
  for (const b of touchButtons()) {
    ctx.beginPath(); ctx.arc(b.x, b.y, BTN_R, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10,12,28,.8)'; ctx.fill();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = btnDrag && btnDrag.id === b.id ? '#ffd34d' : 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    txt(b.icon, b.x, b.y + 1, 22, '#fff', 'center');
  }
}
function drawTouchUI() {
  if (btnEdit) { drawBtnEdit(); return; }
  if (!touchMode || state !== 'play' || paused || !player.alive) return;
  // pausa
  ctx.beginPath(); ctx.arc(30, 27, 18, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10,12,28,.7)'; ctx.fill();
  ctx.fillStyle = '#eef0ff'; ctx.fillRect(24, 19, 4, 16); ctx.fillRect(32, 19, 4, 16);
  if (player.air === 'plane') return;
  drawStick(touch.move, 110, VH - 100, player.air === 'glide' ? 'Dirigir' : player.veh ? 'Conducir' : player.down ? 'Arrastrarte' : 'Mover', false);
  if (player.air !== 'ground') return;
  if (!player.veh && !player.down) drawStick(touch.aim, VW - 110, VH - 100, 'Apuntar · disparar', touch.aim && touch.aim.mag > 0.5);
  for (const b of touchButtons()) {
    const empty = b.n === 0;
    ctx.beginPath(); ctx.arc(b.x, b.y, BTN_R, 0, Math.PI * 2);
    ctx.fillStyle = empty ? 'rgba(10,12,28,.35)' : 'rgba(10,12,28,.65)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = empty ? 0.35 : 1;
    txt(b.icon, b.x, b.y + 1, 22, '#fff', 'center');
    ctx.globalAlpha = 1;
    if (b.n !== undefined) {
      ctx.beginPath(); ctx.arc(b.x + 20, b.y - 20, 10, 0, Math.PI * 2); ctx.fillStyle = '#ffd34d'; ctx.fill();
      txt(String(b.n), b.x + 20, b.y - 20, 12, '#1b1f3b', 'center', 800);
    }
  }
  if (emoOpen) for (const b of emoButtons()) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,77,.9)'; ctx.lineWidth = 2; ctx.stroke();
    txt(b.icon, b.x, b.y + 1, 21, '#000', 'center');
  }
  if (player.reloadT > 0 && touchButtons().some(b => b.id === 'reload')) {
    const b = touchButtons().find(b => b.id === 'reload'), W = WEAPONS[player.guns[player.slot].type];
    ctx.beginPath(); ctx.arc(b.x, b.y, BTN_R + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - player.reloadT / W.reload));
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.stroke();
  }
}
function updateCursor() {
  const c = state === 'play' && !paused && player.alive && player.air === 'ground' && !showMap ? 'none' : 'crosshair';
  if (c !== lastCursor) { cv.style.cursor = c; lastCursor = c; }
}

/* ---------- Partida ---------- */
function loadStats() {
  try { return JSON.parse(localStorage.getItem('zf-stats')) || { games: 0, wins: 0, kills: 0, best: 0 }; }
  catch (e) { return { games: 0, wins: 0, kills: 0, best: 0 }; }
}
function showStats() {
  const s = loadStats();
  $('stats').textContent = (s.games
    ? `Partidas: ${s.games} · Victorias: ${s.wins} · Bajas totales: ${s.kills} · Mejor puesto: #${s.best}`
    : 'Todos empiezan con pistola. Salta del avión, busca armas raras en las casas y vigila los suministros aéreos.')
    + ` · 🪙 ${coins} monedas · ⭐ Nivel ${s.level || 1}`;
}
function resetRound() {
  bullets = []; particles = []; feed = []; nades = []; blasts = []; drops = []; floats = []; indicators = [];
  shake = 0; announce = null; visPoly = null;
  time = 0; dmgDealt = 0; spectate = null; hitMarker = killMarker = hurtFlash = 0;
  specMode = false; specLabel = ''; resToken++; $('spec').classList.add('hidden');
  roundStats = null; emoOpen = false; roundCoins = 0;
  roundFlags = { healed: false, racha: false, nadeK: 0 }; myKillTimes.length = 0;
  if (typeof stopReplay === 'function' && replay) stopReplay();
  hist.length = 0; wasAlive = false;
  mouse.down = mouse.pressed = false; showMap = false;
  touch.move = touch.aim = null;
  for (const k in keys) keys[k] = false;
  net.actions = []; net.bev = [];
  shields = []; boxes = []; boxUiSig = ''; $('boxUI').classList.add('hidden');
}
function setupWorld() {
  gmode = 'normal';
  genMap($('map').value); rects.forEach((q, i) => { q.id = i; }); buildGround(); initPlane(); spawnEnts([{ name: 'Tú' }]); initZone();
  resetRound(); spawnVehicles();
}
function enterPlay() {
  if (touchMode) goFullscreen();
  cam.x = plane.x; cam.y = plane.y; cam.z = baseZoom() * 0.5;
  state = 'play'; paused = false;
  ['menu', 'result', 'pause', 'lobby'].forEach(id => $(id).classList.add('hidden'));
  try { ac(); } catch (e) {}
}
// humans: [{ name, conn? }] — el primero es el jugador local, el resto amigos conectados
function startGame(humans) {
  tut = null;
  diff = DIFFS[$('diff').value] || DIFFS.normal;
  gmode = GM_DESC[$('gm').value] != null ? $('gm').value : 'normal';
  teamSize = gmode === 'zombis' ? 8 : gmode === 'duelo' ? 1 : [1, 2, 4].includes(+$('mode').value) ? +$('mode').value : 1;
  genMap($('map').value); rects.forEach((q, i) => { q.id = i; }); buildGround(); initPlane(); spawnEnts(humans); initZone();
  resetRound(); spawnVehicles();
  applyModeStart();
  enterPlay();
}
function newGame() { startGame([{ name: 'Tú', av: myAv, ch: myCh, sk: mySk }]); if (!tutDone()) tutStart(); }
function endGame(win) {
  if (state !== 'play') return;
  state = 'over';
  emoOpen = false;
  if (win) { sfx.win(); buzz([60, 60, 60, 60, 200]); showResult(true, null, 900); return; }
  sfx.lose(); buzz(300);
  // Has muerto: modo espectador hasta que termine la partida (specTick decide cuándo acaba).
  // Primero sigue a un compañero vivo; si no hay, a quien te eliminó.
  specMode = true; specLabel = '';
  spectate = specPick(player);
  $('spec').classList.remove('hidden');
  specTick();
}
// Estadísticas del teléfono: se guardan una vez por partida (y se corrigen si luego gana tu equipo)
function saveRoundStats(win, place) {
  const r = roundStats || (roundStats = { saved: false, win: false });
  try {
    const s = loadStats(), before = SKINS.map((_, i) => skinOpen(i, s));
    // monedas: por jugar, por cada baja, por buen puesto y por ganar
    let earn = 0;
    if (!r.saved) {
      s.games++; s.kills += player.kills; earn += 10 + player.kills * 15 + (place > 0 && place <= 10 ? 10 : 0) + (place > 0 && place <= 3 ? 20 : 0);
      s.dmg = (s.dmg || 0) + Math.round(dmgDealt); s.time = (s.time || 0) + Math.round(time); s.bestKills = Math.max(s.bestKills || 0, player.kills);
      if (place > 0 && place <= 5) s.top5 = (s.top5 || 0) + 1;
      s.maps = s.maps || {}; s.maps[mapKey] = (s.maps[mapKey] || 0) + 1;
      misAdd('games', 1); misAdd('kills', player.kills); misAdd('dmg', Math.round(dmgDealt));
      if (place > 0 && place <= 5) misAdd('top5', 1);
      if (TH.night) misAdd('night', 1);
      if (teamsOn()) misAdd('team', 1);
      if (net.role !== 'solo') misAdd('friends', 1);
    }
    if (!r.saved) {
      s.days = (s.days || []).filter(d => d !== today()).concat(today()).slice(-30);
      r.xp = 40 + player.kills * 20 + (place > 0 && place <= 10 ? 20 : 0) + (place > 0 && place <= 3 ? 40 : 0);
    }
    if (win && !r.win) {
      s.wins++; earn += 60; misAdd('wins', 1); r.xp = (r.xp || 0) + 120;
      if (!roundFlags.healed) s.ach_sincura = true;
      if (TH.night) s.ach_noche = true;
      if (gmode === 'zombis') s.ach_zombi = true;
      if (gmode === 'duelo') s.ach_duelo = true;
    }
    if (roundFlags.racha) s.ach_racha = true;
    s.nadeK = (s.nadeK || 0) + roundFlags.nadeK; roundFlags.nadeK = 0;
    const gain = (r.xp || 0) - (r.xpGiven || 0);
    if (gain > 0) { addXP(s, gain); passAdd(gain); r.xpGiven = r.xp; }
    checkAch(s);
    if (earn) { coins += earn; roundCoins += earn; saveWallet(); }
    if (place > 0) s.best = s.best ? Math.min(s.best, place) : place;
    localStorage.setItem('zf-stats', JSON.stringify(s));
    newSkins = newSkins.concat(SKINS.filter((_, i) => !before[i] && skinOpen(i, s)).map(k => k.name));
  } catch (e) {}
  r.saved = true; r.win = r.win || win;
}
/* ---------- Modo espectador ---------- */
const specList = () => ents.filter(e => e.alive && e !== player && e.air !== 'plane');
function specPick(prev) {
  const c = specList();
  if (!c.length) return null;
  const mates = c.filter(e => e.team === player.team);
  if (!mates.length && prev && prev.killer && prev.killer !== prev && c.includes(prev.killer)) return prev.killer;
  const friends = c.filter(e => e.human);
  const pool = mates.length ? mates : friends.length ? friends : c;
  let best = pool[0], bd = Infinity;
  for (const e of pool) { const d = dist(e.x, e.y, cam.x, cam.y); if (d < bd) { bd = d; best = e; } }
  return best;
}
function specCycle(dir) {
  if (!specMode) return;
  const c = specList();
  if (!c.length) return;
  const i = c.indexOf(spectate);
  spectate = c[i < 0 ? 0 : (i + dir + c.length) % c.length];
  specTick();
}
function specTick() {
  if (!specMode || state !== 'over') return;
  const alive = ents.filter(e => e.alive);
  if (aliveTeams() <= 1) {
    const w = alive.find(e => e.human) || alive[0] || null;
    finishSpectate(w, 2200, !!w && w.team === player.team);
    return;
  }
  if (!spectate || !spectate.alive || spectate.air === 'plane') spectate = specPick(spectate);
  const mate = spectate && teamsOn() && spectate.team === player.team;
  const name = spectate ? (mate ? '🤝 ' : '') + spectate.name : '—';
  const count = teamsOn() ? `🚩 ${aliveTeams()} equipos` : `👥 ${alive.length} vivos`;
  const info = spectate ? `❤️ ${Math.ceil(Math.max(0, spectate.hp))} · ${count}` : count;
  const label = name + '|' + info + '|' + (spectate ? spectate.id : -1);
  if (label !== specLabel) {
    specLabel = label; $('specName').textContent = `👁 ${name}`; $('specInfo').textContent = info;
    const av = $('specAv'), src = spectate && spectate.av;
    if (src) { if (av.getAttribute('src') !== src) av.src = src; av.hidden = false; } else av.hidden = true;
  }
}
function finishSpectate(winner, delay, win = false) {
  if (!specMode) return;
  specMode = false; showMap = false;
  $('spec').classList.add('hidden');
  if (winner) {
    spectate = winner;
    if (win) pushFeed('🏆 ¡Tu equipo ganó la partida!', 6, true);
    else if (winner !== player) pushFeed(teamsOn() ? `🏆 Ganó el equipo de ${winner.name}` : `🏆 ${winner.name} ganó la partida`, 6, true);
  }
  if (win) { sfx.win(); buzz([60, 60, 60, 60, 200]); }
  showResult(win, winner, delay);
}
function showResult(win, winner, delay) {
  const tok = ++resToken;
  // si te saltaste el espectador y tu equipo aún vive, el puesto es provisional (el mejor posible)
  const place = win ? 1 : player.place || aliveTeams();
  saveRoundStats(win, place);
  setTimeout(() => {
    if (state !== 'over' || tok !== resToken) return;
    const tm = teamsOn();
    $('resTitle').textContent = win ? (tm ? '🏆 ¡VICTORIA EN EQUIPO!' : '🏆 ¡VICTORIA!') : '💀 Eliminado';
    $('resTitle').className = 'big ' + (win ? 'win' : 'lose');
    $('resSub').textContent = win
      ? (!tm ? '¡Eres el último en pie!' : player.alive ? '¡Tu equipo es el último en pie!' : '¡Tu equipo ganó la partida!')
      : (player.killer === player ? 'Tu propia granada acabó contigo.'
        : player.killer ? `Te eliminó ${player.killer.name}.` : 'La zona acabó contigo.')
        + (winner && winner !== player ? (tm ? ` Ganó el equipo de ${winner.name}.` : ` Ganó ${winner.name}.`) : '');
    $('resCoins').textContent = (roundCoins ? `🪙 +${roundCoins} monedas · tienes ${coins}` : `🪙 Tienes ${coins} monedas`)
      + (roundStats && roundStats.xp ? ` · ⭐ +${roundStats.xp} XP (nivel ${loadStats().level || 1})` : '');
    if (newSkins.length) { $('resSub').textContent += ` 🎁 ¡Nueva skin desbloqueada: ${newSkins.join(', ')}! Pruébala en 👕 Skin.`; newSkins = []; showSkinBtns(); }
    $('resPlace').textContent = tm ?`#${place} de ${Math.ceil(totalPlayers / teamSize)} equipos` : `#${place} de ${totalPlayers}`;
    $('resKills').textContent = player.kills;
    $('resTime').textContent = fmtTime(time);
    $('resDmg').textContent = Math.round(dmgDealt);
    const again = $('again');
    again.style.display = net.role === 'client' ? 'none' : '';
    again.textContent = net.role === 'host' ? 'Nueva partida (sala)' : 'Jugar otra vez';
    $('toMenu').textContent = net.role === 'solo' ? 'Menú' : 'Salir de la sala';
    const friendsAlive = ents.some(e => e.alive && e.human && e !== player);
    $('resWait').textContent = net.role === 'client' ? 'Esperando a que el anfitrión empiece otra partida…'
      : net.role === 'host' && friendsAlive ? 'La partida sigue para tus amigos: no cierres esta página.'
      : net.role === 'host' ? 'Pulsa «Nueva partida» para jugar otra con tus amigos.' : '';
    $('result').classList.remove('hidden');
  }, delay);
}
function toMenu() {
  state = 'menu'; paused = false; showMap = false;
  specMode = false; resToken++; $('spec').classList.add('hidden');
  ['result', 'pause', 'lobby'].forEach(id => $(id).classList.add('hidden'));
  showStats(); $('menu').classList.remove('hidden');
}
function setPause(v) {
  if (state !== 'play') return;
  paused = v; $('pause').classList.toggle('hidden', !v);
  $('pauseTxt').textContent = net.role === 'solo' ? 'Pulsa Esc para continuar.' : 'En multijugador la partida sigue en marcha.';
  mouse.down = mouse.pressed = false;
  touch.move = touch.aim = null;
  for (const k in keys) keys[k] = false;
}
function goFullscreen() {
  try {
    const el = document.documentElement, fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn || document.fullscreenElement || document.webkitFullscreenElement) return;
    const r = fn.call(el);
    const lock = () => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) {} };
    if (r && r.then) r.then(lock).catch(() => {}); else lock();
  } catch (e) {}
}
