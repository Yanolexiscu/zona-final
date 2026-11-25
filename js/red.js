'use strict';
// Zona Final · Multijugador (PeerJS), foto de perfil, tienda y menús
// (los archivos comparten variables globales y se cargan en orden desde index.html)
/* ---------- Multijugador: salas con código (PeerJS, conexión directa entre dispositivos) ---------- */
function getName() {
  const v = ($('pname').value || '').trim().replace(/\s+/g, ' ').slice(0, 12);
  try { localStorage.setItem('zf-name', v); } catch (e) {}
  return v || 'Jugador';
}
/* ---------- Foto de perfil ---------- */
// Se guarda en el teléfono como JPEG pequeño (96×96) y viaja con el nombre al entrar a una sala.
const AV_SIZE = 96, AV_MAX = 40000;
const cleanAv = v => typeof v === 'string' && v.length <= AV_MAX && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : '';
let myAv = '';
try { myAv = cleanAv(localStorage.getItem('zf-avatar')); } catch (e) {}
const avCache = new Map();
function avImg(src) {
  if (!src) return null;
  let im = avCache.get(src);
  if (!im) { im = new Image(); im.src = src; avCache.set(src, im); }
  return im.complete && im.naturalWidth ? im : null;
}
function showMyAv() {
  $('avImg').hidden = !myAv; if (myAv) $('avImg').src = myAv;
  $('avPh').hidden = !!myAv; $('avDel').hidden = !myAv;
  $('avBtn').classList.toggle('has', !!myAv);
  $('avHint').hidden = !!myAv;
}
function setMyAv(v) {
  myAv = cleanAv(v);
  try { if (myAv) localStorage.setItem('zf-avatar', myAv); else localStorage.removeItem('zf-avatar'); } catch (e) {}
  showMyAv();
}
function loadAvFile(file) {
  if (!file || !/^image\//.test(file.type || 'image/')) { menuMsg('Ese archivo no es una imagen.'); return; }
  const url = URL.createObjectURL(file), im = new Image();
  im.onload = () => {
    URL.revokeObjectURL(url);
    const c = document.createElement('canvas'); c.width = c.height = AV_SIZE;
    const s = Math.min(im.naturalWidth, im.naturalHeight);
    c.getContext('2d').drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, AV_SIZE, AV_SIZE);
    let q = 0.82, data = c.toDataURL('image/jpeg', q);
    while (data.length > AV_MAX && q > 0.3) { q -= 0.15; data = c.toDataURL('image/jpeg', q); }
    setMyAv(data); menuMsg(myAv ? '' : 'No se pudo usar esa foto. Prueba con otra.');
  };
  im.onerror = () => { URL.revokeObjectURL(url); menuMsg('No se pudo abrir esa foto. Prueba con otra.'); };
  im.src = url;
}
function menuMsg(t) { $('menuMsg').textContent = t || ''; }
function lobbyMsg(t) { $('lobbyMsg').textContent = t || ''; }
// Servidores para conectar los teléfonos. STUN: conexión directa. TURN (Metered, plan gratis 500 MB/mes):
// puente que solo se usa cuando la red bloquea la conexión directa. Esta credencial está pensada para ir en el cliente.
const TURN_USER = '6cf62c465907ffac31766ae6', TURN_PASS = 'x4fxrojSgndR1HDA';
function peerOpts() {
  const ice = [
    { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.relay.metered.ca:80' },
  ];
  if (TURN_PASS) ice.push({
    urls: ['turn:global.relay.metered.ca:80', 'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443', 'turns:global.relay.metered.ca:443?transport=tcp'],
    username: TURN_USER, credential: TURN_PASS,
  });
  return { debug: 0, config: { iceServers: ice } };
}
function peerErrorText(err) {
  const t = err && err.type;
  if (t === 'peer-unavailable') return `No existe ninguna sala con el código ${net.code}. Revisa el código.`;
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'No se pudo conectar con el servidor de salas. Revisa tu conexión a internet.';
  if (t === 'browser-incompatible') return 'Este navegador no permite el multijugador. Prueba con Chrome o Safari actualizados.';
  if (t === 'webrtc') return 'No se pudo conectar entre los dispositivos (puede ser la red). Prueba todos con wifi.';
  return 'Error de conexión' + (t ? ` (${t})` : '') + '.';
}
function peerReady() {
  if (typeof Peer === 'undefined') { menuMsg('No se pudo cargar el sistema de salas. Revisa tu conexión a internet y recarga la página.'); return false; }
  return true;
}
function showLobby() {
  ['menu', 'result', 'pause'].forEach(id => $(id).classList.add('hidden'));
  $('lobby').classList.remove('hidden');
  const host = net.role === 'host';
  $('lobbyTitle').textContent = host ? '👥 Tu sala' : '👥 Sala';
  $('lobbyStart').style.display = host ? '' : 'none';
  $('lobbyShare').style.display = host && net.code ? '' : 'none';
  $('lobbyMode').disabled = !host;
  $('lobbyMap').disabled = !host;
  $('lobbyMap').value = host ? $('map').value : net.lobbyMap || 'azar';
  $('lobbyMode').value = host ? $('mode').value : String(net.lobbyTs || 1);
  $('lobbyHint').textContent = host ?'Pasa el código a tus amigos y vuelve aquí: deja el juego abierto en pantalla mientras entran. Cuando estén todos, pulsa Empezar. Los huecos se rellenan con bots.' : '';
  renderLobby();
}
function renderLobby() {
  $('lobbyCode').textContent = net.code || '····';
  const ul = $('lobbyList');
  ul.innerHTML = '';
  const ts = net.role === 'host' ? (+$('mode').value || 1) : (net.lobbyTs || 1);
  net.lobby.forEach((n, i) => {
    const li = document.createElement('li'), av = (net.lobbyAv || [])[i];
    if (av) { const im = document.createElement('img'); im.className = 'av'; im.alt = ''; im.src = av; li.appendChild(im); }
    const ch = CHARS[(net.lobbyCh || [])[i]];
    li.appendChild(document.createTextNode((i === 0 ? '👑 ' : '🎮 ') + n + (ch ? ` · ${ch.icon}` : '')));
    if (ts > 1) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = `Equipo ${Math.floor(i / ts) + 1}`; li.appendChild(t); }
    ul.appendChild(li);
  });
  renderBoard();
}
// Ranking de la sala: lo lleva el anfitrión y lo reparte a todos al final de cada partida
function renderBoard() {
  const rows = net.role === 'solo' ? [] : net.boardRows || [];
  if (rows.length) weekMerge(rows);
  for (const id of ['board', 'lobbyBoard']) {
    const box = $(id);
    box.classList.toggle('hidden', !rows.length);
    box.textContent = '';
    if (!rows.length) continue;
    const t = document.createElement('div'); t.className = 'bt'; t.textContent = '🏆 Ranking de la sala'; box.appendChild(t);
    rows.forEach((r, i) => {
      const row = document.createElement('div'); row.className = 'brow';
      const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = i === 0 && r.w > 0 ? '👑' : String(i + 1); row.appendChild(pos);
      if (r.av) { const im = document.createElement('img'); im.className = 'av'; im.alt = ''; im.src = r.av; row.appendChild(im); }
      const nm = document.createElement('b'); nm.textContent = r.n; row.appendChild(nm);
      const st = document.createElement('span'); st.className = 'st';
      st.textContent = `🏆 ${r.w} · 🎯 ${r.k} · 🎮 ${r.g}` + (r.b ? ` · #${r.b}` : ''); row.appendChild(st);
      box.appendChild(row);
    });
  }
}
function recordBoard(wt) {
  if (net.role !== 'host' || roundDone || !ents) return;
  roundDone = true;
  for (const e of ents) {
    if (!e.human || !e.key) continue;
    const r = net.board[e.key] || (net.board[e.key] = { n: e.name, av: '', w: 0, k: 0, g: 0, b: 0 });
    const won = wt != null && e.team === wt, pl = won ? 1 : e.place;
    r.n = e.name; r.av = e.av || ''; r.g++; r.k += e.kills;
    if (won) r.w++;
    if (pl > 0) r.b = r.b ? Math.min(r.b, pl) : pl;
  }
  net.boardRows = Object.values(net.board).sort((a, b) => b.w - a.w || b.k - a.k || a.b - b.b)
    .map(r => ({ n: r.n, av: r.av, w: r.w, k: r.k, g: r.g, b: r.b }));
  renderBoard();
  for (const c of net.conns) { try { netSend(c, { t: 'board', rows: net.boardRows }); } catch (e) {} }
}
function leaveRoom() {
  const p = net.peer, wasClient = net.role === 'client';
  net.role = 'solo'; net.peer = null; net.conns = []; net.host = null; net.code = ''; net.lobby = []; net.lobbyAv = []; net.lobbyCh = []; net.bev = []; net.actions = [];
  net.board = {}; net.boardRows = []; net.lobbyTs = 1; roundDone = true; net.prevRows = null;
  if (p) { try { p.destroy(); } catch (e) {} }
  $('lobby').classList.add('hidden');
  // la copia del invitado no puede seguir la partida sola: vuelve al menú
  if (wasClient && (state === 'play' || state === 'over')) toMenu();
}
function hostGone(msg) {
  if (net.role !== 'client') return;
  leaveRoom(); toMenu(); menuMsg(msg);
}

// ----- Anfitrión -----
function createRoom(tries = 0) {
  if (!peerReady()) return;
  leaveRoom(); menuMsg('');
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  const peer = new Peer(PEER_PREFIX + code, peerOpts());
  net.role = 'host'; net.peer = peer; net.lobby = [getName()]; net.lobbyAv = [myAv]; net.lobbyCh = [myCh];
  showLobby(); lobbyMsg('Creando sala…');
  peer.on('open', () => { if (net.peer !== peer) return; net.code = code; showLobby(); lobbyMsg('Esperando a tus amigos…'); });
  peer.on('connection', conn => { if (net.peer === peer) setupHostConn(conn); });
  peer.on('disconnected', () => { if (net.peer === peer) { try { peer.reconnect(); } catch (e) {} } });
  peer.on('error', err => {
    if (net.peer !== peer) return;
    if (err.type === 'unavailable-id' && tries < 5) { createRoom(tries + 1); return; }
    if (err.type === 'peer-unavailable') return;
    if (state === 'menu') lobbyMsg(peerErrorText(err));
  });
}
// PeerJS corta la conexión si un mensaje JSON pasa de ~16 KB (el inicio de partida lleva el mapa entero),
// así que los mensajes grandes se envían en trozos y se vuelven a juntar al llegar (el canal es ordenado y fiable).
const NET_CHUNK = 7000, SNAP_DT = 1 / 15; // 15 actualizaciones por segundo (antes 20)
let netSeq = 0;
function netSend(conn, msg) {
  const s = JSON.stringify(msg);
  if (s.length <= NET_CHUNK) { conn.send(msg); return; }
  const id = ++netSeq, n = Math.ceil(s.length / NET_CHUNK);
  for (let i = 0; i < n; i++) conn.send({ t: 'ch', id, i, n, d: s.slice(i * NET_CHUNK, (i + 1) * NET_CHUNK) });
}
function netRecv(conn, m) {
  if (!m || typeof m !== 'object' || m.t !== 'ch') return m;
  if (typeof m.d !== 'string' || !(m.n > 0 && m.n <= 400) || !(m.i >= 0 && m.i < m.n)) return null;
  const parts = conn.chunks || (conn.chunks = {});
  if (!parts[m.id]) { for (const k in parts) if (+k < m.id) delete parts[k]; parts[m.id] = { got: 0, d: [] }; }
  const p = parts[m.id];
  if (p.d[m.i] == null) { p.d[m.i] = m.d; p.got++; }
  if (p.got < m.n) return null;
  delete parts[m.id];
  try { return JSON.parse(p.d.join('')); } catch (e) { return null; }
}
function setupHostConn(conn) {
  conn.ev = []; conn.ent = null; conn.pname = ''; conn.pav = ''; conn.lootSig = null;
  conn.on('data', raw => {
    const m = netRecv(conn, raw);
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      if (!net.conns.includes(conn)) {
        if (net.conns.length + 1 >= MAX_PLAYERS) { try { netSend(conn, { t: 'full' }); } catch (e) {} setTimeout(() => conn.close(), 500); return; }
        net.conns.push(conn);
      }
      conn.pname = String(m.name || 'Jugador').slice(0, 12);
      conn.pav = cleanAv(m.av);
      conn.pch = m.ch >= 0 && m.ch < CHARS.length ? m.ch | 0 : 0;
      conn.psk = m.sk >= 0 && m.sk < SKINS.length ? m.sk | 0 : 0;
      conn.rk = typeof m.rk === 'string' ? m.rk.slice(0, 16) : '';
      hostLobbyUpdate();
      if ((state === 'play' || state === 'over') && conn.rk && hostRejoin(conn)) return;
      if (net.boardRows.length) { try { netSend(conn, { t: 'board', rows: net.boardRows }); } catch (e) {} }
      if (state === 'play' || state === 'over') { try { netSend(conn, { t: 'wait' }); } catch (e) {} }
    } else if (m.t === 'in' && conn.ent && ents.includes(conn.ent)) hostApplyInput(conn.ent, m);
  });
  conn.on('close', () => hostDropConn(conn));
  conn.on('error', () => hostDropConn(conn));
}
function hostDropConn(conn) {
  const i = net.conns.indexOf(conn);
  if (i < 0) return;
  net.conns.splice(i, 1);
  const e = conn.ent;
  if (e && e.alive && (state === 'play' || state === 'over') && ents.includes(e) && e.conn === conn) {
    // no se elimina enseguida: tiene 30 s para volver (se queda quieto mientras tanto)
    e.conn = null; e.dropT = time || 0.01; e.inp.down = false; e.moving = false; e.sprint = false;
    pushFeed(`📶 ${e.name} perdió la conexión…`, 5, false);
  }
  hostLobbyUpdate();
}
// Mensaje de inicio de partida para un amigo (al empezar o al volver a entrar)
function startMsgFor(c, map) {
  const pl = { x0: r1(plane.x0), y0: r1(plane.y0), x1: r1(plane.x1), y1: r1(plane.y1), ang: r2(plane.ang), dur: plane.dur };
  return { t: 'start', rd: net.round, map: map || packMap(), plane: pl, pt: r2(plane.t), names: ents.map(e => e.name), colors: ents.map(e => e.color),
    humans: ents.filter(e => e.human).map(e => e.id), avs: ents.map(e => e.av || ''), chs: ents.map(e => e.ch), sks: ents.map(e => e.sk),
    ts: teamSize, you: c.ent.id, diff: $('diff').value, gm: gmode, wr: weekRule ? weekRule.id : '', zw: zWave, dr: duelRound, dsc: duelScore };
}
function hostRejoin(conn) {
  const e = ents.find(o => o.human && o.rk === conn.rk && o.alive && !o.disc && o !== player);
  if (!e) return false;
  const old = e.conn;
  if (old && old !== conn) { old.ent = null; const j = net.conns.indexOf(old); if (j >= 0) net.conns.splice(j, 1); try { old.close(); } catch (er) {} }
  conn.ent = e; e.conn = conn; e.dropT = 0;
  conn.ev = []; conn.lootSig = conn.vehSig = conn.boxSig = null; conn.lastZ = null; conn.lastFocus = undefined;
  try { netSend(conn, startMsgFor(conn)); } catch (er) {}
  pushFeed(`✅ ${e.name} volvió a la partida`, 5, false);
  hostLobbyUpdate();
  return true;
}
function hostLobbyUpdate() {
  net.lobby = [getName()].concat(net.conns.map(c => c.pname));
  net.lobbyAv = [myAv].concat(net.conns.map(c => c.pav || ''));
  net.lobbyCh = [myCh].concat(net.conns.map(c => c.pch || 0));
  renderLobby();
  const ts = +$('mode').value || 1;
  for (const c of net.conns) { try { netSend(c, { t: 'lobby', names: net.lobby, avs: net.lobbyAv, chs: net.lobbyCh, ts, mp: $('map').value, gm: $('gm').value }); } catch (e) {} }
}
function packMap() {
  return {
    t: mapKey,
    c: circles.filter(c => c.kind === 'rock' || c.kind === 'tree' || c.kind === 'barrel').map(c => [r1(c.x), r1(c.y), r1(c.r), c.kind === 'rock' ? 0 : c.kind === 'tree' ? 1 : 2,
      c.kind === 'rock' ? c.pts.map(r1) : c.kind === 'tree' ? c.blobs.map(b => [r1(b.dx), r1(b.dy), r1(b.r)]) : c.bid]),
    r: rects.map(q => [r1(q.x), r1(q.y), r1(q.w), r1(q.h), q.kind === 'wall' ? 0 : 1, q.id]),
    b: buildings.map(b => [b.x, b.y, b.w, b.h, b.roof, b.doors.map(d => [r1(d.x), r1(d.y), d.nx, d.ny])]),
    u: bushes.map(b => [r1(b.x), r1(b.y), r1(b.r), b.blobs.map(k => [r1(k.dx), r1(k.dy), r1(k.r)])]),
    p: ponds.map(p => [r1(p.x), r1(p.y), r1(p.r)]),
    o: roads.map(r => [r1(r.x1), r1(r.y1), r1(r.x2), r1(r.y2), r2(r.bend)]),
  };
}
function unpackMap(m) {
  mapKey = MAPS[m.t] ? m.t : 'bosque'; TH = MAPS[mapKey];
  circles = m.c.map(a => a[3] === 0 ? { x: a[0], y: a[1], r: a[2], kind: 'rock', pts: a[4] }
    : a[3] === 2 ? { x: a[0], y: a[1], r: a[2], kind: 'barrel', hp: 35, bid: a[4] }
    : { x: a[0], y: a[1], r: a[2], kind: 'tree', blobs: a[4].map(k => ({ dx: k[0], dy: k[1], r: k[2] })) });
  rects = m.r.map(a => ({ x: a[0], y: a[1], w: a[2], h: a[3], kind: a[4] === 0 ? 'wall' : 'crate', id: a[5], hp: CRATE_HP }));
  buildings = m.b.map(a => ({ x: a[0], y: a[1], w: a[2], h: a[3], roof: a[4], roofA: 1, doors: a[5].map(d => ({ x: d[0], y: d[1], nx: d[2], ny: d[3] })) }));
  bushes = m.u.map(a => ({ x: a[0], y: a[1], r: a[2], blobs: a[3].map(k => ({ dx: k[0], dy: k[1], r: k[2] })) }));
  ponds = m.p.map(a => ({ x: a[0], y: a[1], r: a[2] }));
  roads = m.o.map(a => ({ x1: a[0], y1: a[1], x2: a[2], y2: a[3], bend: a[4] }));
  loot = [];
}
function hostStartGame() {
  if (net.role !== 'host') return;
  if (!net.code) { lobbyMsg('Espera a que la sala termine de crearse…'); return; }
  const conns = net.conns.filter(c => c.open && c.pname);
  if (!roundDone) recordBoard(null); // la partida anterior se cortó: cuenta igual para el ranking
  net.conns.forEach(c => { c.ent = null; c.ev = []; c.lootSig = null; c.vehSig = null; c.boxSig = null; });
  startGame([{ name: getName(), av: myAv, ch: myCh, sk: mySk }].concat(conns.map(c => ({ name: c.pname, av: c.pav, ch: c.pch, sk: c.psk, conn: c }))));
  roundDone = false;
  const map = packMap();
  const pl = { x0: r1(plane.x0), y0: r1(plane.y0), x1: r1(plane.x1), y1: r1(plane.y1), ang: r2(plane.ang), dur: plane.dur };
  const names = ents.map(e => e.name), colors = ents.map(e => e.color), humans = ents.filter(e => e.human).map(e => e.id);
  const avs = ents.map(e => e.av || ''), chs = ents.map(e => e.ch), sks = ents.map(e => e.sk);
  net.round++;
  for (const c of conns) {
    if (!c.ent) continue;
    try { netSend(c, startMsgFor(c, map)); } catch (e) {}
  }
  net.sendAcc = 0;
}
// Controles recibidos de un amigo: su teléfono manda su posición (movimiento fluido) y sus acciones
function hostApplyInput(e, m) {
  if (Number.isInteger(m.w)) e.watch = m.w; // a quién observa (si está muerto)
  if (!e.alive) return;
  if (e.air !== 'plane' && Number.isFinite(m.x) && Number.isFinite(m.y)) {
    e.x = clamp(m.x, e.r, WORLD - e.r); e.y = clamp(m.y, e.r, WORLD - e.r);
  }
  if (Number.isFinite(m.a)) e.ang = m.a;
  if (e.veh && Number.isFinite(m.vs)) e.veh.sp = clamp(m.vs, -VEH_MAX, VEH_MAX);
  e.moving = !!m.mv; e.sprint = !!m.sp; e.inp.down = !!m.d;
  for (const q of Array.isArray(m.q) ? m.q : []) {
    if (q === 'p') e.inp.pressed = true;
    else if (Array.isArray(q)) {
      if (q[0] === 'n') doAct(e, 'nade', +q[1] || e.x, +q[2] || e.y);
      else if (q[0] === 'w') doAct(e, 'wall', +q[1]);
      else if (q[0] === 'pg') doAct(e, 'ping', +q[1], +q[2]);
      else if (q[0] === 'b') doAct(e, 'box', q[1] | 0, q[2] | 0);
    }
    else if (typeof q === 'string') doAct(e, q);
  }
}
// Envía el estado de la partida a cada amigo (~20 veces por segundo)
function hostTick(dt) {
  if (state === 'play' || state === 'over') for (const e of ents) if (e.dropT && e.alive && time - e.dropT > 30) { e.dropT = 0; e.disc = true; kill(e, null); }
  net.sendAcc += dt;
  if (net.sendAcc < SNAP_DT) return;
  net.sendAcc = 0; net.tick++;
  const live = net.conns.filter(c => c.open && c.ent && ents.includes(c.ent));
  if (!live.length) { net.bev = []; return; }
  // Ahorro de datos (sobre todo por el puente TURN): muerto = 0, en el avión = 1 (el amigo lo calcula solo)
  const full = ents.map(e => {
    if (!e.alive) return 0;
    if (e.air === 'plane') return 1;
    const g = e.guns[e.slot];
    return [r0(e.x), r0(e.y), r2(e.ang), Math.ceil(Math.max(0, e.hp)), r0(e.armor), 1, AIR[e.air],
      g ? GUNS.indexOf(g.type) : 0, g ? g.tier : 0, r1(Math.max(0, e.healT)), r1(Math.min(9, time - e.lastHurt)), r1(Math.max(0, e.glideT)),
      e.down ? 1 : 0, r2(e.rev)];
  });
  // coches y cajas de botín: solo se mandan cuando cambian
  const vs = vehicles.map(v => [v.id, r0(v.x), r0(v.y), r2(v.ang), r0(v.hp), v.driver ? v.driver.id : -1, VEH_COLORS.indexOf(v.color)]);
  const vSig = JSON.stringify(vs);
  const bs = boxes.map(b => [b.id, r0(b.x), r0(b.y), b.name, b.items.map(it => it.k === 'gun' ? [0, GUNS.indexOf(it.gun.type), it.gun.tier] : [KINDS.indexOf(it.k), it.n])]);
  const bSig = JSON.stringify(bs);
  const fullTick = net.tick % 8 === 0;
  const near = (me, o, mx, my) => Math.abs(o.x - me.x) < mx && Math.abs(o.y - me.y) < my;
  const z = [r0(zone.x), r0(zone.y), r0(zone.r), r0(zone.tx), r0(zone.ty), r0(zone.tr), ZST.indexOf(zone.state), r1(zone.timer), zone.phase];
  const ns = nades.map(n => [r0(n.x), r0(n.y), r2(n.age)]), ds = drops.map(d => [r0(d.x), r0(d.y), r2(d.t)]);
  let sig = loot.length;
  for (const it of loot) sig = (sig * 31 + r0(it.x) * 7 + r0(it.y) + (it.gun ? it.gun.tier : 0)) % 1000000007;
  let packedLoot = null;
  for (const c of live) {
    const e = c.ent;
    // los jugadores lejanos a lo que ve en pantalla (él mismo, o a quien observa si está muerto) van solo
    // 1 de cada 8 veces y sus disparos no se envían; en el aire o al cambiar de observado recibe todo
    const w = ents[e.watch];
    const focus = e.alive ? (e.air === 'ground' ? e : null) : w && w.alive && w.air === 'ground' ? w : null;
    const refresh = c.lastFocus !== focus; c.lastFocus = focus;
    const es = !focus || fullTick || refresh ? full : full.map((a, i) => {
      if (typeof a !== 'object') return a;
      const o = ents[i];
      return o === e || o.team === e.team || near(focus, o, 1250, 900) ? a : null;
    });
    const ev = focus ? net.bev.filter(v => v.k !== 'f' || !ents[v.o] || near(focus, ents[v.o], 1600, 1200)) : net.bev;
    const zs = z.filter((_, i) => i !== 7).join(','), sendZ = zs !== c.lastZ || net.tick % 15 === 0; c.lastZ = zs;
    const msg = { t: 's', rd: net.round, tm: r2(time), pt: r2(plane.t), z: sendZ ? z : undefined, e: es,
      n: ns.length ? ns : undefined, d: ds.length ? ds : undefined, ev: ev.concat(c.ev),
      me: { hp: r1(Math.max(0, e.hp)), ar: r0(e.armor), m: e.meds, g: e.nades, k: e.kills, s: e.slot,
        gs: e.guns.map(g => g ? [GUNS.indexOf(g.type), g.tier, g.mag] : null),
        rl: r2(Math.max(0, e.reloadT)), hl: r2(Math.max(0, e.healT)),
        a: AIR[e.air], al: e.alive ? 1 : 0, x: r0(e.x), y: r0(e.y), gt: r2(Math.max(0, e.glideT)),
        wl: e.walls, dn: e.down ? 1 : 0, rv: r2(e.rev), vh: e.veh ? e.veh.id : -1 } };
    if (c.vehSig !== vSig) { msg.v = vs; c.vehSig = vSig; }
    if (c.boxSig !== bSig) { msg.bx = bs; c.boxSig = bSig; }
    if (c.lootSig !== sig) {
      if (!packedLoot) packedLoot = loot.map(it => [r0(it.x), r0(it.y), KINDS.indexOf(it.kind), it.gun ? GUNS.indexOf(it.gun.type) : 0, it.gun ? it.gun.tier : 0]);
      msg.l = packedLoot; c.lootSig = sig;
    }
    c.ev = [];
    try { netSend(c, msg); } catch (err) {}
  }
  net.bev = [];
}

// ----- Invitado -----
function joinRoom() {
  if (!peerReady()) return;
  const code = ($('code').value || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== 4) { menuMsg('Escribe el código de 4 letras de la sala.'); return; }
  leaveRoom(); menuMsg('');
  const peer = new Peer(undefined, peerOpts());
  net.role = 'client'; net.peer = peer; net.code = code; net.lobby = []; net.reconT = 0;
  try { net.rk = sessionStorage.getItem('zf-rk-' + code) || Math.random().toString(36).slice(2, 12); sessionStorage.setItem('zf-rk-' + code, net.rk); }
  catch (e) { net.rk = Math.random().toString(36).slice(2, 12); }
  showLobby(); lobbyMsg('Conectando con la sala…');
  net.noRoom = false;
  peer.on('open', () => { if (net.peer === peer) connectToHost(peer, code, 1); });
  peer.on('error', err => {
    if (net.peer !== peer || state === 'play' || state === 'over') return;
    if (err && err.type === 'peer-unavailable') { net.noRoom = true; net.host = null; }
    lobbyMsg(peerErrorText(err));
  });
}
// Intenta conectar con el anfitrión; si no lo logra, reintenta y al final explica la causa
const JOIN_TRIES = 3, JOIN_WAIT = 10000;
function connectToHost(peer, code, attempt, recon) {
  if (net.peer !== peer || net.role !== 'client') return;
  const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
  net.host = conn;
  let ok = false, done = false;
  const fail = () => {
    if (ok || done || net.host !== conn || net.noRoom) return;
    done = true; clearTimeout(to);
    const pc = conn.peerConnection;
    const answered = !!(pc && pc.remoteDescription), ice = pc ? pc.iceConnectionState : 'sin-conexion';
    try { conn.close(); } catch (e) {}
    if (recon) { clientReconnect(); return; }
    if (attempt < JOIN_TRIES) {
      lobbyMsg(`Reintentando conexión (${attempt + 1}/${JOIN_TRIES})…`);
      setTimeout(() => connectToHost(peer, code, attempt + 1), 800);
      return;
    }
    net.host = null;
    lobbyMsg(answered
      ? `La sala respondió, pero la red no deja conectar los teléfonos entre sí. Prueba con datos móviles en uno de los dos. (código RED-${ice})`
      : 'El anfitrión no respondió. Pídele que tenga el juego abierto en pantalla (no en WhatsApp) y vuelve a intentarlo: Salir → Unirse. (código ANF)');
  };
  const to = setTimeout(fail, JOIN_WAIT);
  setTimeout(() => {
    const pc = conn.peerConnection;
    if (pc) pc.addEventListener('iceconnectionstatechange', () => { if (pc.iceConnectionState === 'failed') fail(); });
  }, 0);
  conn.on('open', () => {
    if (net.host !== conn || done) return;
    ok = true; clearTimeout(to); net.lastMsg = performance.now();
    try { netSend(conn, { t: 'hello', name: getName(), av: myAv, ch: myCh, sk: mySk, rk: net.rk }); } catch (e) {}
    if (net.reconT) { net.reconT = 0; showAnnounce('✅ ¡Reconectado!', C_MATE()); }
    lobbyMsg('¡Conectado! Esperando a que el anfitrión empiece…');
  });
  conn.on('data', raw => { if (net.host === conn) { net.lastMsg = performance.now(); const m = netRecv(conn, raw); if (m) clientOnData(m); } });
  const lost = msg => { if (state === 'play' || state === 'over') clientReconnect(); else hostGone(msg); };
  conn.on('close', () => { if (net.host === conn) { if (ok) lost('El anfitrión cerró la sala.'); else fail(); } });
  conn.on('error', () => { if (net.host === conn) { if (ok) lost('Se perdió la conexión con el anfitrión.'); else fail(); } });
}
// Conexión perdida a media partida: reintenta durante 30 s antes de rendirse
function clientReconnect() {
  if (net.role !== 'client') return;
  const now = performance.now();
  if (!net.reconT) { net.reconT = now; showAnnounce('📶 Conexión perdida · reconectando…', '#ffd34d'); }
  if (now - net.reconT > 30000) { net.reconT = 0; hostGone('Se perdió la conexión con el anfitrión.'); return; }
  const peer = net.peer;
  if (!peer || peer.destroyed) { net.reconT = 0; hostGone('Se perdió la conexión con el anfitrión.'); return; }
  if (net.host) { const old = net.host; net.host = null; try { old.close(); } catch (e) {} }
  if (peer.disconnected) { try { peer.reconnect(); } catch (e) {} }
  setTimeout(() => { if (net.role === 'client' && net.reconT && net.peer === peer) connectToHost(peer, net.code, JOIN_TRIES, true); }, 1500);
}
// Al volver al juego desde otra app (p. ej. WhatsApp), reconecta con el servidor de salas
document.addEventListener('visibilitychange', () => {
  const p = net.peer;
  if (document.visibilityState === 'visible' && p && p.disconnected && !p.destroyed) { try { p.reconnect(); } catch (e) {} }
});
function clientOnData(m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'lobby') {
    net.lobby = Array.isArray(m.names) ? m.names : [];
    net.lobbyAv = Array.isArray(m.avs) ? m.avs.map(cleanAv) : [];
    net.lobbyCh = Array.isArray(m.chs) ? m.chs.map(c => CHARS[c] ? c : 0) : [];
    net.lobbyTs = [1, 2, 4].includes(m.ts) ? m.ts : 1;
    net.lobbyMap = MAPS[m.mp] ? m.mp : 'azar'; $('lobbyMap').value = net.lobbyMap;
    if (GM_DESC[m.gm] != null) { $('lobbyGm').value = m.gm; $('gm').value = m.gm; }
    $('lobbyMode').value = String(net.lobbyTs);
    renderLobby();
  }
  else if (m.t === 'wait') lobbyMsg('Hay una partida en curso. Entrarás en la siguiente.');
  else if (m.t === 'full') hostGone('La sala está llena.');
  else if (m.t === 'start') { net.round = m.rd; clientStart(m); }
  else if (m.t === 's' && m.rd === net.round && (state === 'play' || state === 'over') && ents) applySnap(m);
  else if (m.t === 'board' && Array.isArray(m.rows)) {
    net.boardRows = m.rows.slice(0, MAX_PLAYERS * 3).map(r => ({
      n: String(r && r.n || 'Jugador').slice(0, 12), av: cleanAv(r && r.av),
      w: Math.max(0, r.w | 0), k: Math.max(0, r.k | 0), g: Math.max(0, r.g | 0), b: Math.max(0, r.b | 0),
    }));
    renderBoard();
  }
}
function clientStart(m) {
  diff = DIFFS[m.diff] || DIFFS.normal;
  teamSize = [1, 2, 4, 8].includes(m.ts) ? m.ts : 1;
  gmode = GM_DESC[m.gm] != null ? m.gm : 'normal';
  weekRule = WEEK_RULES.find(w => w.id === m.wr) || null;
  zWave = m.zw | 0; duelRound = m.dr | 0; duelScore = Array.isArray(m.dsc) ? m.dsc : [];
  unpackMap(m.map); buildGround();
  plane = { x0: m.plane.x0, y0: m.plane.y0, x1: m.plane.x1, y1: m.plane.y1, ang: m.plane.ang, dur: m.plane.dur, t: +m.pt || 0, x: m.plane.x0, y: m.plane.y0 };
  ents = m.names.map((name, i) => {
    const e = makeEnt(i === m.you, name, m.colors[i]);
    e.id = i; e.human = m.humans.includes(i); e.team = gmode === 'duelo' ? i : Math.floor(i / teamSize);
    if (gmode === 'zombis' && !e.human) { e.zombie = true; e.team = 50; e.alive = false; e.air = 'ground'; }
    e.av = e.human && Array.isArray(m.avs) ? cleanAv(m.avs[i]) : '';
    e.ch = Array.isArray(m.chs) && CHARS[m.chs[i]] ? m.chs[i] : 0;
    e.sk = Array.isArray(m.sks) && SKINS[m.sks[i]] ? m.sks[i] : 0;
    return e;
  });
  player = ents[m.you]; net.myId = m.you; totalPlayers = ents.length;
  initZone(); resetRound(); vehicles = [];
  net.lastMsg = performance.now();
  enterPlay();
}
function applySnap(s) {
  time = s.tm; plane.t = s.pt;
  const z = s.z; // la zona solo viene cuando cambia
  if (z) {
    zone.x = z[0]; zone.y = z[1]; zone.r = z[2]; zone.tx = z[3]; zone.ty = z[4]; zone.tr = z[5];
    zone.state = ZST[z[6]] || 'wait'; zone.timer = z[7]; zone.phase = z[8];
  }
  for (let i = 0; i < s.e.length; i++) {
    const a = s.e[i], e = ents[i];
    if (!e || e === player || a === null) continue; // null: sin cambios (jugador lejano)
    if (a === 0) { if (e.alive) dieFx(e); e.alive = false; continue; }
    if (a === 1) { e.alive = true; e.air = 'plane'; e.x = e.tx = clamp(plane.x, 0, WORLD); e.y = e.ty = clamp(plane.y, 0, WORLD); continue; }
    const air = AIRS[a[6]];
    if (e.tx == null || e.air !== air || dist(e.x, e.y, a[0], a[1]) > 250) { e.x = a[0]; e.y = a[1]; e.ang = a[2]; }
    e.tx = a[0]; e.ty = a[1]; e.ta = a[2];
    if (e.alive && !a[5]) dieFx(e);
    e.alive = !!a[5]; e.air = air; e.hp = a[3]; e.armor = a[4];
    e.guns[0] = { type: GUNS[a[7]] || 'pistola', tier: a[8], mag: 1 }; e.guns[1] = null; e.slot = 0;
    e.healT = a[9]; e.lastHurt = time - a[10]; e.hitT = a[10] < 0.1 ? 0.1 : 0; e.glideT = a[11];
    e.down = !!a[12]; e.rev = a[13] || 0;
  }
  if (s.v) { // coches (el propio lo mueve este teléfono)
    const old = new Map(vehicles.map(v => [v.id, v]));
    vehicles = s.v.map(a => {
      let v = old.get(a[0]);
      if (!v) v = { id: a[0], x: a[1], y: a[2], ang: a[3], sp: 0, color: VEH_COLORS[a[6]] || VEH_COLORS[0] };
      v.tx = a[1]; v.ty = a[2]; v.ta = a[3]; v.hp = a[4];
      const d = a[5] >= 0 ? ents[a[5]] || null : null;
      v.driver = v.driver === player && player.veh === v ? player : d === player ? null : d;
      return v;
    });
    for (const e of ents) if (e !== player) e.veh = null;
    for (const v of vehicles) if (v.driver && v.driver !== player) v.driver.veh = v;
    if (player.veh && !vehicles.includes(player.veh)) player.veh = null;
  }
  if (s.bx) boxes = s.bx.map(a => ({ id: a[0], x: a[1], y: a[2], name: String(a[3]).slice(0, 12),
    items: a[4].map(it => it[0] === 0 ? { k: 'gun', gun: { type: GUNS[it[1]] || 'pistola', tier: it[2] | 0, mag: 0 } } : { k: KINDS[it[0]] || 'med', n: it[1] | 0 }) }));
  const me = s.me, p = player;
  if (me.hp < p.hp - 0.5 && !p.down && !me.dn) hurtFlash = Math.max(hurtFlash, 0.25);
  p.hp = me.hp; p.armor = me.ar; p.meds = me.m; p.nades = me.g; p.kills = me.k; p.slot = me.s;
  p.guns = me.gs.map(g => g ? { type: GUNS[g[0]] || 'pistola', tier: g[1], mag: g[2] } : null);
  p.reloadT = me.rl; p.healT = me.hl;
  p.walls = me.wl | 0; p.down = !!me.dn; p.rev = me.rv || 0;
  if (me.vh >= 0 && !p.veh) { // el anfitrión te subió al coche
    const v = vehicles.find(v => v.id === me.vh);
    if (v) { p.veh = v; v.driver = p; v.x = v.tx != null ? v.tx : v.x; v.y = v.ty != null ? v.ty : v.y; v.sp = 0; p.x = v.x; p.y = v.y; }
  } else if (me.vh < 0 && p.veh) exitVehicle(p); // te bajaste (o el coche explotó)
  if (me.a > AIR[p.air]) { p.air = AIRS[me.a]; p.x = me.x; p.y = me.y; p.glideT = me.gt; }
  if (p.alive && !me.al) { dieFx(p); p.alive = false; }
  else if (!p.alive && me.al && gmode === 'duelo' && state === 'play') { p.alive = true; p.x = me.x; p.y = me.y; p.air = 'ground'; }
  if (s.l) loot = s.l.map(a => ({ x: a[0], y: a[1], kind: KINDS[a[2]], gun: a[2] === 0 ? { type: GUNS[a[3]], tier: a[4], mag: 0 } : undefined }));
  nades = (s.n || []).map(a => ({ x: a[0], y: a[1], age: a[2] }));
  drops = (s.d || []).map(a => ({ x: a[0], y: a[1], t: a[2] }));
  for (const ev of s.ev || []) handleEvent(ev);
}
// Eventos: los del jugador local (anfitrión o solo) y los que llegan por la red (invitado)
function handleEvent(ev) {
  switch (ev.k) {
    case 'f': {
      if (net.role !== 'client') break;
      const o = ents[ev.o], W = WEAPONS[GUNS[ev.w]] || WEAPONS.pistola;
      for (const b of ev.b) bullets.push({ x: b[0], y: b[1], vx: b[2], vy: b[3], life: b[4], o: ev.o, rk: !!W.rocket });
      if (o) {
        o.lastShot = time;
        const [v, pan] = spatial(o.x, o.y, 1300);
        noise((o === player ? 0.22 : 0.17) * v, W.snd[0], W.snd[1], o === player ? 0 : pan);
      }
      break;
    }
    case 'x': explodeFx(ev.x, ev.y); break;
    case 'c': { const q = rects.find(r => r.id === ev.id); if (q) breakCrateFx(q); break; }
    case 'fd':
      pushFeed(ev.text, ev.all ? 7 : 6, !!ev.all || (ev.ids || []).includes(net.myId));
      if (net.role === 'client' && Array.isArray(ev.ids) && ev.ids[1] === net.myId && ev.ids[0] !== net.myId) onMyKill(String(ev.text).split(' · ')[1] || '');
      if (ev.s && sfx[ev.s]) sfx[ev.s]();
      break;
    case 'a': showAnnounce(ev.text, ev.c); if (ev.s && sfx[ev.s]) sfx[ev.s](); break;
    case 's': if (sfx[ev.n]) sfx[ev.n](); if (ev.n === 'reload') mouse.pressed = false; break;
    case 'h': hurtFlash = 0.35; buzz(35); if (ev.x != null) indicators.push({ x: ev.x, y: ev.y, t: 1.3 }); break;
    case 'd': {
      hitMarker = 0.15; dmgDealt += ev.v; sfx.hit();
      const tg = ents[ev.id];
      if (!tg) break;
      const f = floats.find(f => f.target === tg && f.t > 0.7);
      if (f) { f.v += ev.v; f.t = 1; f.armor = f.armor || !!ev.a; }
      else floats.push({ target: tg, x: tg.x + rand(-10, 10), y: tg.y - 26, v: ev.v, t: 1, armor: !!ev.a });
      break;
    }
    case 'kl': killMarker = 0.5; sfx.kill(); buzz([25, 40, 70]); break;
    case 'dead': {
      const p = player;
      p.alive = false; p.place = ev.place;
      p.killer = ev.killer >= 0 ? ents[ev.killer] || null : null;
      spectate = p.killer && p.killer !== p ? p.killer : null;
      endGame(false);
      break;
    }
    case 'win': teamWon(); break;
    case 'kn': showAnnounce('🩸 ¡Derribado!', '#ff5c7a'); hurtFlash = 0.5; buzz([120, 60, 220]); sfx.lose(); break;
    case 'rv': showAnnounce('💚 ¡Te reanimaron!', C_MATE()); buzz(80); sfx.heal(); break;
    case 'pg': {
      const o = ents[ev.id];
      if (o && Number.isFinite(ev.x) && Number.isFinite(ev.y)) {
        o.ping = { x: ev.x, y: ev.y, t: time, ty: ev.ty | 0, lab: String(ev.lab || '').slice(0, 24) };
        if (o !== player) { if (ev.ty === 1) { tone(1500, 0.06, 'square', 0.05); tone(1500, 0.06, 'square', 0.05, 0, 0.12); } else { tone(1320, 0.07, 'sine', 0.06); tone(990, 0.1, 'sine', 0.05, 0, 0.08); } }
      }
      break;
    }
    case 'wl': if (net.role === 'client' && !shields.some(s => s.id === ev.id)) addShield(ev.id, ev.x, ev.y, ev.a, WALL_HP); break;
    case 'wd': if (net.role === 'client') removeShield(ev.id); break;
    case 'vx': if (net.role === 'client') { explodeFx(ev.x, ev.y); vehicles = vehicles.filter(v => v.id !== ev.id); if (player.veh && player.veh.id === ev.id) player.veh = null; } break;
    case 'pl': if (ev.place > 0) player.place = ev.place; break;
    case 'wv': zWave = ev.n | 0; break;
    case 'bb': if (net.role === 'client') circles = circles.filter(c => c.bid !== ev.id || c.kind !== 'barrel'); break;
    case 'rd': duelRound = ev.n | 0; if (Array.isArray(ev.sc)) duelScore = ev.sc; break;
    case 'qc': {
      const o = ents[ev.id];
      if (o && ev.i >= 0 && ev.i < QC.length) {
        o.qc = ev.i; o.qcT = time;
        pushFeed(`💬 ${o === player ? 'Tú' : o.name}: ${QC[ev.i]}`, 6, o === player);
        if (o !== player) tone(880, 0.06, 'triangle', 0.06);
      }
      break;
    }
    case 'em': {
      if (net.role !== 'client') break;
      const o = ents[ev.id];
      if (o && ev.i >= 0 && ev.i < EMOS.length) { o.emo = ev.i; o.emoT = time; emoSound(o); }
      break;
    }
  }
}
// Balas solo visuales en el teléfono del invitado (el daño lo calcula el anfitrión)
function bulletsVisual(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (b.rk && Math.random() < dt * 40) particles.push({ x: b.x, y: b.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.5, max: 0.5, color: 'rgba(200,200,200,.6)', size: 5 });
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 12));
    let remove = false;
    for (let s = 0; s < steps && !remove; s++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      if (blockedBy(b.x, b.y)) {
        remove = true;
        for (let k = 0; k < 3; k++) particles.push({ x: b.x, y: b.y, vx: rand(-80, 80), vy: rand(-80, 80), life: 0.25, max: 0.25, color: '#d8d2c0', size: 2 });
        break;
      }
      const ow = ents[b.o];
      for (const e of ents) {
        if (!e.alive || e.air !== 'ground' || e.id === b.o || (ow && ow.team === e.team)) continue;
        const dx = e.x - b.x, dy = e.y - b.y;
        if (dx * dx + dy * dy < e.r * e.r) { remove = true; break; }
      }
    }
    b.life -= dt;
    if (remove || b.life <= 0) bullets.splice(i, 1);
  }
}
function clientUpdate(dt) {
  time += dt;
  plane.t += dt;
  plane.x = lerp(plane.x0, plane.x1, plane.t / plane.dur); plane.y = lerp(plane.y0, plane.y1, plane.t / plane.dur);
  const p = player;
  if (p.alive) {
    if (p.air === 'plane') { p.x = clamp(plane.x, 0, WORLD); p.y = clamp(plane.y, 0, WORLD); }
    else if (p.air === 'glide') updateGlide(p, dt);
    if (p.air === 'ground') {
      p.inBush = bushes.some(b => dist(b.x, b.y, p.x, p.y) < b.r - 4);
      p.bld = buildingAt(p.x, p.y); p.wet = inWater(p.x, p.y);
      if (touchMode) applyTouchAim();
      if (p.veh) driveLocal(p, dt); else movePlayer(dt);
      if (mouse.pressed && !p.down && !p.veh) { if (!net.actions.includes('p')) net.actions.push('p'); }
      mouse.pressed = false;
      p.reloadT = Math.max(0, p.reloadT - dt); p.healT = Math.max(0, p.healT - dt);
    }
  }
  for (const e of ents) {
    if (e === p && p.alive) continue;
    if (e.tx != null) {
      const k = Math.min(1, dt * 12);
      e.x = lerp(e.x, e.tx, k); e.y = lerp(e.y, e.ty, k); e.ang += angDiff(e.ta, e.ang) * k;
    }
    if (e.air === 'ground') { e.inBush = bushes.some(b => dist(b.x, b.y, e.x, e.y) < b.r - 4); e.bld = buildingAt(e.x, e.y); }
    else if (e.air === 'glide') e.glideT = Math.max(0, e.glideT - dt);
    e.hitT -= dt;
  }
  for (const v of vehicles) {
    if (v.driver === p && p.veh === v) continue;
    if (v.tx != null) { const k = Math.min(1, dt * 12); v.x = lerp(v.x, v.tx, k); v.y = lerp(v.y, v.ty, k); v.ang += angDiff(v.ta, v.ang) * k; }
  }
  bulletsVisual(dt);
  if (zone.timer > 0) zone.timer = Math.max(0, zone.timer - dt); // el anfitrión solo manda la zona cuando cambia
  for (let i = blasts.length - 1; i >= 0; i--) { blasts[i].t -= dt; if (blasts[i].t <= 0) blasts.splice(i, 1); }
  for (const n of nades) n.age += dt;
  for (const d of drops) d.t -= dt;
  updateFx(dt);
  if (performance.now() - net.lastMsg > 8000 && !net.reconT) clientReconnect();
}
function clientSendInput(dt) {
  net.inAcc += dt;
  if (net.inAcc < 0.05) return;
  net.inAcc = 0;
  const c = net.host, p = player;
  if (!c || !c.open || !p) return;
  try {
    netSend(c, p.alive
      ? { t: 'in', x: r0(p.x), y: r0(p.y), a: r2(p.ang), mv: p.moving ? 1 : 0, sp: p.sprint ? 1 : 0, d: mouse.down && !paused && !p.veh && !p.down ? 1 : 0, q: net.actions,
        vs: p.veh ? r0(p.veh.sp) : undefined }
      : { t: 'in', w: spectate ? spectate.id : -1, q: [] });
  } catch (e) {}
  net.actions = [];
}
