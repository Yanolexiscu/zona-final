'use strict';
// Zona Final · Controles, bucle principal y arranque
// (los archivos comparten variables globales y se cargan en orden desde index.html)
/* ---------- Controles ---------- */
const canAct = () => state === 'play' && !paused && player.alive;
addEventListener('keydown', e => {
  if (replay && state !== 'menu') { stopReplay(); e.preventDefault(); return; }
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT') { if (e.key === 'Enter' && e.target.id === 'code') joinRoom(); return; }
  if (e.code === 'Tab') { e.preventDefault(); if (state !== 'menu') showMap = true; return; }
  if (state === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) { setPause(!paused); return; }
  if (specMode && state === 'over') {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); specCycle(-1); return; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Space') { e.preventDefault(); specCycle(1); return; }
    if (e.code === 'Escape' || e.code === 'Enter') { finishSpectate(null, 0); return; }
  }
  if (e.code === 'KeyM') {
    muted = !muted;
    try { localStorage.setItem('zf-mute', muted ? '1' : '0'); } catch (err) {}
  }
  if (!canAct()) return;
  keys[e.code] = true;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyC') { rotateCam(); return; }
  if (e.code === 'KeyT') { chatOpen = !chatOpen && player.alive; return; }
  if (chatOpen && /^Digit[1-8]$/.test(e.code)) { act('qc' + (+e.code[5] - 1)); chatOpen = false; return; }
  if (chatOpen && e.code === 'Escape') { chatOpen = false; return; }
  if (player.air === 'plane') { if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'KeyF') act('jump'); return; }
  if (e.code === 'KeyZ') { const m = mouseWorld(); act('ping', m.x, m.y); tone(880, 0.08, 'sine', 0.07); return; }
  if (player.air !== 'ground') return;
  if (e.code === 'KeyV') act('veh');
  else if (e.code === 'KeyF') act('wall', player.ang);
  else if (e.code === 'KeyE') act('pickup');
  else if (e.code === 'KeyR') act('reload');
  else if (e.code === 'KeyQ') act('heal');
  else if (e.code === 'KeyG') { const m = mouseWorld(); act('nade', m.x, m.y); }
  else if (e.code === 'Digit1') act('s0');
  else if (e.code === 'Digit2') act('s1');
  else if (/^Digit[5-8]$/.test(e.code)) act('emo' + (+e.code[5] - 5));
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') showMap = false; });
/* ---------- Controles táctiles ---------- */
function enableTouch() {
  if (touchMode) return;
  touchMode = true;
  document.body.classList.add('touch');
  resize();
  if (r3 && qualSet === 'auto') applyQuality(autoQ());
}
const inRect = (x, y, r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
function pressButton(id) {
  const p = player;
  if (id === 'emo') { emoOpen = !emoOpen; return; }
  if (id === 'cam') { rotateCam(); return; }
  if (id === 'chat') { chatOpen = !chatOpen; emoOpen = false; return; }
  if (id === 'reload') act('reload');
  else if (id === 'heal') act('heal');
  else if (id === 'wall') act('wall', p.ang);
  else if (id === 'veh') act('veh');
  else if (id === 'nade') {
    if (touch.aim && touch.aim.mag >= 0.2) { const m = mouseWorld(); act('nade', m.x, m.y); }
    else act('nade', p.x + Math.cos(p.ang) * 240, p.y + Math.sin(p.ang) * 240);
  }
}
cv.addEventListener('pointerdown', e => {
  if (replay) { stopReplay(); e.preventDefault(); return; }
  if (e.pointerType !== 'touch') return;
  e.preventDefault();
  lastTouchT = performance.now();
  enableTouch();
  if (specMode && state === 'over') {
    if (showMap) showMap = false; else if (inRect(e.clientX, e.clientY, uiRects.minimap)) showMap = true;
    return;
  }
  if (!canAct()) return;
  const x = e.clientX, y = e.clientY;
  if (showMap) { bigMapPing(x, y); showMap = false; return; }
  if (dist(x, y, 30, 27) < 26) { setPause(true); return; }
  if (inRect(x, y, uiRects.minimap)) { showMap = true; return; }
  if (player.air === 'plane') { act('jump'); return; }
  if (chatOpen) {
    for (const r of chatRects()) if (inRect(x, y, r)) { act('qc' + r.i); chatOpen = false; return; }
    const cb = touchButtons().find(b => b.id === 'chat');
    if (!cb || dist(x, y, cb.x, cb.y) >= BTN_R + 10) chatOpen = false;
  }
  if (player.air === 'ground') {
    if (emoOpen) {
      for (const b of emoButtons()) if (dist(x, y, b.x, b.y) < 26) { act('emo' + b.i); emoOpen = false; return; }
      { const eb = touchButtons().find(b => b.id === 'emo'); if (dist(x, y, eb.x, eb.y) >= BTN_R + 10) emoOpen = false; }
    }
    for (const b of touchButtons()) if (dist(x, y, b.x, b.y) < BTN_R + 10) { pressButton(b.id); return; }
    for (let i = 0; i < 2; i++) if (inRect(x, y, uiRects.slots[i])) { act('s' + i); return; }
    if (inRect(x, y, uiRects.pickup)) { act('pickup'); return; }
  }
  const s = { id: e.pointerId, bx: x, by: y, dx: 0, dy: 0, mag: 0 };
  if (x < VW / 2) { if (!touch.move) touch.move = s; }
  else if (player.air === 'ground' && !touch.aim) touch.aim = s;
}, { passive: false });
addEventListener('pointermove', e => {
  if (e.pointerType !== 'touch') return;
  for (const k of ['move', 'aim']) {
    const s = touch[k];
    if (!s || s.id !== e.pointerId) continue;
    let dx = e.clientX - s.bx, dy = e.clientY - s.by;
    const l = Math.hypot(dx, dy);
    if (l > STICK_R) { // la base sigue al dedo si te pasas del borde
      s.bx += dx / l * (l - STICK_R); s.by += dy / l * (l - STICK_R);
      dx = e.clientX - s.bx; dy = e.clientY - s.by;
    }
    s.dx = dx / STICK_R; s.dy = dy / STICK_R; s.mag = Math.min(1, Math.hypot(s.dx, s.dy));
  }
});
function endTouch(e) {
  if (e.pointerType !== 'touch') return;
  if (touch.move && touch.move.id === e.pointerId) touch.move = null;
  if (touch.aim && touch.aim.id === e.pointerId) { touch.aim = null; mouse.down = false; mouse.pressed = false; }
}
addEventListener('pointerup', endTouch);
addEventListener('pointercancel', endTouch);
const fromTouch = () => performance.now() - lastTouchT < 1000;

addEventListener('mousemove', e => { if (fromTouch()) return; mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', e => {
  if (replay) { stopReplay(); return; }
  if (!canAct() || fromTouch()) return;
  if (showMap) { if (e.button === 0) bigMapPing(e.clientX, e.clientY); return; }
  if (player.air === 'plane') { act('jump'); return; }
  if (player.air !== 'ground') return;
  if (e.button === 0) { mouse.down = true; mouse.pressed = true; }
  else if (e.button === 2) { const m = mouseWorld(); act('nade', m.x, m.y); }
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', () => {
  if (canAct() && player.air === 'ground') act(player.slot === 0 ? 's1' : 's0');
}, { passive: true });
addEventListener('blur', () => { showMap = false; if (state === 'play' && !paused) setPause(true); });

$('play').onclick = () => { leaveRoom(); menuMsg(''); newGame(); };
$('host').onclick = () => createRoom();
$('join').onclick = () => joinRoom();
$('lobbyStart').onclick = () => hostStartGame();
$('lobbyLeave').onclick = () => { leaveRoom(); toMenu(); };
$('lobbyShare').onclick = async () => {
  const url = location.origin + location.pathname + '?sala=' + net.code;
  const text = `¡Únete a mi partida de Zona Final! Código: ${net.code}`;
  if (navigator.share) { try { await navigator.share({ title: 'Zona Final', text, url }); } catch (e) {} return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); lobbyMsg('Enlace copiado: pégalo en WhatsApp.'); }
  catch (e) { lobbyMsg(url); }
};
$('again').onclick = () => { if (net.role === 'host') hostStartGame(); else if (net.role === 'solo') newGame(); };
$('toMenu').onclick = () => { leaveRoom(); toMenu(); };
$('resume').onclick = () => setPause(false);
$('quit').onclick = () => { leaveRoom(); toMenu(); };
// Modo de juego (se recuerda en el teléfono); en la sala solo lo cambia el anfitrión
try { const m = localStorage.getItem('zf-mode'); if (['1', '2', '4'].includes(m)) $('mode').value = m; } catch (e) {}
function setMode(v) {
  if (!['1', '2', '4'].includes(v)) return;
  $('mode').value = v; $('lobbyMode').value = v;
  try { localStorage.setItem('zf-mode', v); } catch (e) {}
  if (net.role === 'host') hostLobbyUpdate();
}
// Personaje (se recuerda en el teléfono; en la sala se avisa al anfitrión)
for (const id of ['char', 'lobbyChar']) CHARS.forEach((c, i) => {
  const o = document.createElement('option'); o.value = String(i); o.textContent = `${c.icon} ${c.name}`; $(id).appendChild(o);
});
function setChar(v) {
  v = +v; if (!(v >= 0 && v < CHARS.length)) return;
  myCh = v | 0; $('char').value = $('lobbyChar').value = String(myCh);
  $('charDesc').textContent = `${CHARS[myCh].icon} ${CHARS[myCh].desc}`;
  try { localStorage.setItem('zf-char', String(myCh)); } catch (e) {}
  if (net.role === 'host') hostLobbyUpdate();
  else if (net.role === 'client' && net.host && net.host.open) { try { netSend(net.host, { t: 'hello', name: getName(), av: myAv, ch: myCh, sk: mySk }); } catch (e) {} }
}
$('char').onchange = () => setChar($('char').value);
$('lobbyChar').onchange = () => setChar($('lobbyChar').value);
setChar(myCh);
// Skins: vista previa dibujada con el mismo código del juego
function skinPreview(cv, i, big) {
  if (THREE && r3 && use3D) { try { preview3D(cv, i, big); return; } catch (e) { console.warn(e); } }
  const c = cv.getContext('2d'), s = cv.width / (big ? 52 : 30);
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(s, 0, 0, s, cv.width / 2, cv.height * (big ? 0.7 : 0.5));
  drawPerson(c, i, 0, 0, -Math.PI / 2, big ? { W: WEAPONS.subfusil, tier: 0 } : {});
}
function showSkinBtns() {
  for (const id of ['skinBtn', 'lobbySkinBtn']) {
    const b = $(id); skinPreview(b.querySelector('canvas'), mySk, false);
    b.querySelector('span').textContent = SKINS[mySk].name;
  }
}
function setSkin(i) {
  if (!skinOpen(i)) return;
  mySk = i;
  try { localStorage.setItem('zf-skin', String(i)); } catch (e) {}
  showSkinBtns();
  if (net.role === 'client' && net.host && net.host.open) { try { netSend(net.host, { t: 'hello', name: getName(), av: myAv, ch: myCh, sk: mySk }); } catch (e) {} }
}
// Tienda: las skins con precio se compran con monedas (o se ganan con su logro). Comprar pide un segundo toque.
let pendingBuy = -1;
const SHOP_INFO = 'Toca una skin para usarla. Las 🔒 se compran con monedas 🪙 que ganas jugando.';
const preview = new Map(); // las vistas previas se dibujan una sola vez
function openSkins() {
  const grid = $('skinsGrid'), st = loadStats();
  $('skinsCoins').textContent = `🪙 ${coins}`;
  grid.textContent = '';
  SKINS.forEach((S, i) => {
    const open = skinOpen(i, st), card = document.createElement('button');
    card.type = 'button'; card.className = 'skin' + (i === mySk ? ' sel' : '') + (open ? '' : ' lock') + (i === pendingBuy ? ' buy' : '');
    const pk = i + (THREE && r3 && use3D ? '3' : '2');
    let cv = preview.get(pk);
    if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = 144; skinPreview(cv, i, true); preview.set(pk, cv); }
    card.appendChild(cv);
    const nm = document.createElement('span'); nm.textContent = (open ? '' : '🔒 ') + S.name; card.appendChild(nm);
    const sm = document.createElement('small');
    sm.textContent = open ? (i === mySk ? 'En uso' : 'Tuya')
      : i === pendingBuy ? '¡Toca para comprar!'
      : `🪙 ${S.price}` + (S.need ? ` · o ${S.need.n} ${NEED_TXT[S.need.k]}` : '');
    if (!open && coins >= S.price) sm.className = 'afford';
    card.appendChild(sm);
    card.onclick = () => {
      const info = $('skinsInfo');
      if (open) { pendingBuy = -1; info.textContent = SHOP_INFO; setSkin(i); openSkins(); return; }
      if (coins < S.price) {
        pendingBuy = -1;
        info.textContent = `🔒 ${S.name} cuesta 🪙 ${S.price}. Te faltan ${S.price - coins} monedas` + (S.need ? ` (o consigue ${S.need.n} ${NEED_TXT[S.need.k]}; llevas ${st[S.need.k] || 0}).` : '.');
        openSkins(); return;
      }
      if (pendingBuy !== i) { pendingBuy = i; info.textContent = `¿Comprar ${S.name} por 🪙 ${S.price}? Toca otra vez para confirmar.`; openSkins(); return; }
      coins -= S.price; owned.push(i); saveWallet(); pendingBuy = -1;
      info.textContent = `🎉 ¡Compraste ${S.name}! Ya la llevas puesta.`;
      buzz([40, 40, 90]); try { ac(); sfx.heal(); } catch (e) {}
      setSkin(i); showStats(); openSkins();
    };
    grid.appendChild(card);
  });
  $('skinsBox').classList.remove('hidden');
  if (!shopSpin.on) { shopSpin.on = true; requestAnimationFrame(shopSpin); }
}
// La skin elegida gira en la tienda (vista 3D)
function shopSpin() {
  if ($('skinsBox').classList.contains('hidden') || !(THREE && r3 && use3D)) { shopSpin.on = false; if (r3 && r3.pv) dropKeep(); return; }
  const cv = preview.get(mySk + '3');
  if (cv) try { preview3D(cv, mySk, true, performance.now() / 1000 * 1.3, true); } catch (e) {}
  requestAnimationFrame(shopSpin);
}
$('skinBtn').onclick = () => { $('skinsInfo').textContent = SHOP_INFO; openSkins(); };
$('lobbySkinBtn').onclick = () => { $('skinsInfo').textContent = SHOP_INFO; openSkins(); };
$('skinsOk').onclick = () => { $('skinsBox').classList.add('hidden'); pendingBuy = -1; };
if (!skinOpen(mySk)) mySk = 0;
showSkinBtns();
// Mapa (se recuerda; en la sala lo elige el anfitrión)
try { const m = localStorage.getItem('zf-map'); if (m === 'azar' || MAPS[m]) $('map').value = m; } catch (e) {}
function setMap(v) {
  if (v !== 'azar' && !MAPS[v]) return;
  $('map').value = $('lobbyMap').value = v;
  try { localStorage.setItem('zf-map', v); } catch (e) {}
  if (net.role === 'host') hostLobbyUpdate();
}
$('map').onchange = () => setMap($('map').value);
$('lobbyMap').onchange = () => { if (net.role === 'host') setMap($('lobbyMap').value); };
$('mode').onchange = () => setMode($('mode').value);
$('lobbyMode').onchange = () => { if (net.role === 'host') setMode($('lobbyMode').value); };
// Vibración (solo si el teléfono la permite; en iPhone el navegador no deja)
if (navigator.vibrate) $('vibRow').classList.add('can');
$('vib').checked = vibOn;
$('v3d').checked = use3D;
$('v3d').onchange = () => { set3D($('v3d').checked); setTimeout(showSkinBtns, 400); };
$('q3d').value = qualSet;
function openSettings() {
  $('v3d').checked = use3D; $('q3d').value = qualSet; $('psz').value = PS; $('vol').value = vol;
  $('vib').checked = vibOn; $('aimA').checked = aimAssist; $('fps30').checked = fps30; $('wxOn').checked = wxOn;
  $('mus').value = musVol; $('cbm').checked = cbMode; $('bigT').checked = bigTxt; $('fpsV').checked = showFps; $('repMsg').textContent = '';
  $('settings').classList.remove('hidden');
}
$('setBtn').onclick = openSettings;
$('mus').oninput = () => { musVol = +$('mus').value; saveSet('zf-mus', musVol); musicLevel(); };
$('cbm').onchange = () => { cbMode = $('cbm').checked; saveSet('zf-cb', cbMode ? 1 : 0); };
$('bigT').onchange = () => { bigTxt = $('bigT').checked; saveSet('zf-big', bigTxt ? 1 : 0); document.body.classList.toggle('bigtxt', bigTxt); };
$('fpsV').onchange = () => { showFps = $('fpsV').checked; saveSet('zf-fpsv', showFps ? 1 : 0); };
document.body.classList.toggle('bigtxt', bigTxt);
// Informe de problemas: copia los datos del teléfono para pegarlos en el chat con Claude
$('repBtn').onclick = async () => {
  let gpu = '—';
  try { const gl = (typeof r3 !== 'undefined' && r3) ? r3.renderer.getContext() : document.createElement('canvas').getContext('webgl'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); gpu = gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'sin WebGL'; } catch (e) {}
  const lines = [
    `Zona Final ${GAME_VER} · informe`,
    `Dispositivo: ${navigator.userAgent}`,
    `Pantalla: ${VW}x${VH} · DPR ${(window.devicePixelRatio || 1).toFixed(2)} · táctil ${touchMode ? 'sí' : 'no'} · mando ${pad.used ? 'sí' : 'no'}`,
    `Gráficos: ${gpu}`,
    `Vista: ${use3D ? '3D' : '2D'} · calidad ${typeof r3 !== 'undefined' && r3 ? r3.q : '—'} (ajuste ${qualSet}) · FPS ahora ${fpsNow} · 30FPS ${fps30 ? 'sí' : 'no'}`,
    `Partida: ${state} · mapa ${mapKey} · clima ${wx} · red ${net.role} · jugadores ${ents ? ents.length : 0}`,
    `Errores: ${errLog.length ? errLog.join(' | ') : 'ninguno'}`,
  ];
  const text = lines.join('\n');
  try { await navigator.clipboard.writeText(text); $('repMsg').textContent = '✅ Copiado. Pégalo en el chat con Claude y cuenta qué pasó.'; }
  catch (e) { $('repMsg').textContent = 'No se pudo copiar automáticamente. Mantén pulsado el texto de abajo y cópialo:'; $('repTxt').value = text; $('repTxt').hidden = false; }
};
$('misBtn').onclick = openMissions;
$('profBtn').onclick = openProfile;
$('misOk').onclick = () => $('missions').classList.add('hidden');
$('profOk').onclick = () => $('profile').classList.add('hidden');
$('pauseSet').onclick = openSettings;
$('setOk').onclick = () => $('settings').classList.add('hidden');
$('psz').oninput = () => { PS = +$('psz').value; AIM_H = 23 * PS; saveSet('zf-psz', PS); };
$('vol').oninput = () => { vol = +$('vol').value; saveSet('zf-vol', vol); if (master) master.gain.value = vol; };
$('vol').onchange = () => { try { ac(); sfx.pickup(); } catch (e) {} };
$('aimA').onchange = () => { aimAssist = $('aimA').checked; saveSet('zf-aim', aimAssist ? 1 : 0); };
$('fps30').onchange = () => { fps30 = $('fps30').checked; saveSet('zf-fps', fps30 ? 1 : 0); };
$('wxOn').onchange = () => { wxOn = $('wxOn').checked; saveSet('zf-wx', wxOn ? 1 : 0); wxFor = null; };
$('tutAgain').onclick = () => { try { localStorage.removeItem('zf-tut'); } catch (e) {} $('tutAgain').textContent = '🎓 Saldrá en tu próxima partida en solitario'; };
$('q3d').onchange = () => setQuality($('q3d').value);
if (use3D) load3D();
$('vib').onchange = () => { vibOn = $('vib').checked; try { localStorage.setItem('zf-vib', vibOn ? '1' : '0'); } catch (e) {} if (vibOn) buzz(60); };
$('updateBtn').onclick = () => {
  if ((state === 'play' || net.role !== 'solo') && !confirm('Actualizar ahora te saca de la partida o de la sala. ¿Seguir?')) return;
  location.reload();
};
$('updateX').onclick = () => $('update').classList.add('hidden');
$('avBtn').onclick = () => $('avFile').click();
$('avFile').onchange = e => { const f = e.target.files && e.target.files[0]; if (f) loadAvFile(f); e.target.value = ''; };
$('avDel').onclick = () => setMyAv('');
showMyAv();
$('specPrev').onclick = () => specCycle(-1);
$('specNext').onclick = () => specCycle(1);
$('specSkip').onclick = () => finishSpectate(null, 0);

/* ---------- Bucle principal ---------- */
let lastT = performance.now();
/* ---------- Mando (Xbox / PlayStation) ---------- */
// Stick izquierdo: moverte · stick derecho: apuntar · RT/R2: disparar · A: saltar/recoger · B: recargar · X: curarte
// Y: cambiar de arma · LB: granada · RB: pared · cruceta ↑: reacción · ↓: coche · ←/→: girar cámara · Start: pausa · Select: mapa
const pad = { prev: [], aimA: 0, used: false };
function pollPad() {
  const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find(g => g && g.connected) : null;
  if (!gp) return;
  const B = gp.buttons.map(b => b.pressed || b.value > 0.5), ax = gp.axes, P = pad.prev;
  const hit = i => B[i] && !P[i];
  const lx = ax[0] || 0, ly = ax[1] || 0, rx = ax[2] || 0, ry = ax[3] || 0, lm = Math.hypot(lx, ly), rm = Math.hypot(rx, ry);
  if (lm > 0.2 || rm > 0.25 || B.some(Boolean)) pad.used = true;
  pad.prev = B;
  if (!pad.used) return;
  if (state === 'menu' || state === 'over') { if (hit(0) && state === 'menu' && $('menu') && !$('menu').classList.contains('hidden')) newGame(); if (hit(9) && state === 'over') toMenu(); return; }
  if (state !== 'play') return;
  if (hit(9)) { setPause(!paused); return; }
  if (paused) return;
  if (hit(8)) showMap = !showMap;
  if (!player.alive) { if (hit(14)) specCycle(-1); if (hit(15)) specCycle(1); return; }
  touch.move = lm > 0.2 ? { padM: true, dx: lx / Math.max(1, lm), dy: ly / Math.max(1, lm), mag: Math.min(1, lm) } : (touch.move && touch.move.padM ? null : touch.move);
  if (player.air === 'plane') { if (hit(0)) act('jump'); return; }
  if (rm > 0.25) pad.aimA = Math.atan2(ry, rx) + camYaw();
  if (rm > 0.25 || pad.aimSet) {
    const p = player, r = 220 / cam.z, s = w2s(p.x + Math.cos(pad.aimA) * r, p.y + Math.sin(pad.aimA) * r, AIM_H);
    mouse.x = s.x; mouse.y = s.y; pad.aimSet = true;
  }
  const fire = (gp.buttons[7] && gp.buttons[7].value > 0.4) || B[7];
  if (fire && !pad.fire) mouse.pressed = true;
  mouse.down = fire; pad.fire = fire;
  if (hit(0)) act('pickup');
  if (hit(1)) act('reload');
  if (hit(2)) act('heal');
  if (hit(3)) act(player.slot === 0 ? 's1' : 's0');
  if (hit(4)) act('nade', player.x + Math.cos(player.ang) * 240, player.y + Math.sin(player.ang) * 240);
  if (hit(5)) act('wall', player.ang);
  if (hit(12)) act('emo' + Math.floor(Math.random() * EMOS.length));
  if (hit(13)) act('veh');
  if (hit(14) || hit(15)) rotateCam();
}
let fpsNow = 0, fpsN = 0, fpsT0 = 0;
function frame(t) {
  if (fps30 && t - lastT < 30) { requestAnimationFrame(frame); return; } // ahorro de batería
  const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000)); lastT = t;
  fpsN++; if (t - fpsT0 > 1000) { fpsNow = Math.round(fpsN * 1000 / (t - fpsT0)); fpsN = 0; fpsT0 = t; }
  pollPad();
  if (touchMode && VH > VW && state === 'play' && !paused) setPause(true); // en vertical se pausa
  const live = state === 'play' || state === 'over';
  // en multijugador la partida no se detiene aunque abras la pausa
  if (live && (!paused || net.role !== 'solo')) {
    if (net.role === 'client') { clientUpdate(dt); clientSendInput(dt); }
    else update(dt);
  }
  if (live && net.role === 'host') hostTick(dt);
  if (specMode) specTick();
  tutTick();
  if (live) { recordHist(); replayCheck(); }
  render(dt);
  updateBoxUI();
  requestAnimationFrame(frame);
}

// Escena de fondo para el menú
try { if (window.matchMedia && matchMedia('(pointer: coarse)').matches) enableTouch(); } catch (e) {}
try { $('pname').value = localStorage.getItem('zf-name') || ''; } catch (e) {}
try {
  const sala = new URLSearchParams(location.search).get('sala');
  if (sala) { $('code').value = sala.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); menuMsg('Te han invitado a una sala: escribe tu nombre y pulsa «Unirse».'); }
} catch (e) {}
setupWorld();
showStats();
requestAnimationFrame(frame);

// App instalable (PWA): guarda el juego en el teléfono para abrirlo sin conexión
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
  });
  // Cuando llega una versión nueva del juego, avisa con un botón (nunca recarga sola: cortaría salas y partidas)
  const hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadSW) $('update').classList.remove('hidden');
  });
}
