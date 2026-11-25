// Pruebas automáticas de Zona Final.
// Uso:   node tests/pruebas.js          (pruebas rápidas sin internet)
//        node tests/pruebas.js --red    (además prueba una sala multijugador; necesita internet)
// Abre el juego en Edge/Chrome sin ventana, juega solo unos segundos en cada mapa y comprueba
// que no salga ningún error. Termina con código 1 si algo falla (útil antes de publicar).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RED = process.argv.includes('--red');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function findBrowser() {
  const c = [process.env.NAVEGADOR,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  return c.find(p => p && fs.existsSync(p));
}
const getJSON = (u, method = 'GET') => new Promise((res, rej) => {
  const r = http.request(u, { method }, s => { let d = ''; s.on('data', x => d += x); s.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); });
  r.on('error', rej); r.end();
});

async function main() {
  // servidor de archivos
  const server = http.createServer((q, r) => {
    let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
    fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200, { 'Content-Type': TYPES[path.extname(u)] || 'application/octet-stream' }); r.end(d); });
  }).listen(0);
  const port = server.address().port;
  const exe = findBrowser();
  if (!exe) { console.error('No encontré Edge ni Chrome. Indica la ruta en la variable NAVEGADOR.'); process.exit(2); }
  const dbg = 9500 + Math.floor(Math.random() * 300);
  const prof = path.join(require('os').tmpdir(), 'zf-pruebas-' + dbg);
  const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + dbg, '--user-data-dir=' + prof, '--window-size=1280,720',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required', 'about:blank']);
  const results = [];
  const finish = code => { br.kill(); server.close(); try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {} process.exit(code); };

  for (let i = 0; i < 60; i++) { try { await getJSON(`http://127.0.0.1:${dbg}/json/version`); break; } catch (e) { await sleep(250); } }

  async function tab(name) {
    const t = await getJSON(`http://127.0.0.1:${dbg}/json/new?about:blank`, 'PUT');
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const pend = {}, errs = [];
    ws.onmessage = m => {
      const d = JSON.parse(m.data);
      if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
      if (d.method === 'Runtime.exceptionThrown') errs.push(name + ': ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
      if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push(name + ' (consola): ' + d.params.args.map(a => a.value || a.description).join(' ').slice(0, 300));
    };
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Runtime.enable'); await send('Page.enable');
    const ev = async expr => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
      return r.result.result.value;
    };
    const until = async (expr, ms) => { const end = Date.now() + ms; while (Date.now() < end) { try { const v = await ev(expr); if (v) return v; } catch (e) {} await sleep(250); } return null; };
    const open = async () => {
      await send('Page.navigate', { url: `http://localhost:${port}/` });
      if (!await until(`document.readyState === 'complete' && typeof newGame === 'function'`, 15000)) throw new Error('el juego no cargó');
    };
    return { ev, until, send, errs, open, front: () => send('Page.bringToFront') };
  }
  async function check(name, fn) {
    const t0 = Date.now();
    try { await fn(); results.push([true, name]); console.log(`  ✅ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); }
    catch (e) { results.push([false, name, e.message]); console.log(`  ❌ ${name}: ${e.message}`); }
  }
  const expect = (v, msg) => { if (!v) throw new Error(msg); };

  console.log('Zona Final · pruebas automáticas');
  const A = await tab('juego');
  await check('El juego carga sin errores', async () => {
    await A.open();
    await A.ev(`localStorage.clear(); localStorage.setItem('zf-tut', '1'); 'ok'`);
    await A.open();
    expect(await A.until(`!!(r3 && r3.ready)`, 15000), 'la vista 3D no se inició');
    expect(!A.errs.length, A.errs.join(' | '));
  });
  await check('Cada mapa se genera y se dibuja en 3D', async () => {
    for (const k of await A.ev(`MAP_KEYS`)) {
      await A.ev(`$('map').value = '${k}'; newGame(); for (const e of ents) { e.air = 'ground'; e.glideT = 0; } 'ok'`);
      await sleep(700);
      expect(await A.ev(`state === 'play' && r3.built === ground`), `el mapa ${k} no se dibujó`);
    }
    expect(!A.errs.length, A.errs.join(' | '));
  });
  await check('Una partida en solitario avanza (bots, combate, zona)', async () => {
    await A.ev(`$('map').value = 'bosque'; newGame(); for (const e of ents) { e.air = 'ground'; e.glideT = 0; } 'ok'`);
    const r = await A.ev(`(() => { for (let i = 0; i < 1200; i++) update(0.05); return { t: time, vivos: ents.filter(e => e.alive).length, balas: bullets.length >= 0 }; })()`);
    expect(r.t > 50, 'el tiempo de partida no avanzó');
    expect(r.vivos < 25, 'en 60 s simulados no cayó nadie (¿los bots no pelean?)');
    expect(!A.errs.length, A.errs.join(' | '));
  });
  await check('Morir: repetición y modo espectador', async () => {
    await A.ev(`newGame(); for (const e of ents) { e.air = 'ground'; e.glideT = 0; } for (let i = 0; i < 60; i++) { update(0.05); recordHist(); } 'ok'`);
    await A.ev(`{ const b = ents.find(e => !e.isPlayer && e.alive); kill(player, b, 'Prueba'); } 'ok'`);
    expect(await A.until(`!!replay`, 3000), 'no empezó la repetición');
    expect(await A.ev(`specMode && state === 'over'`), 'no entró en modo espectador');
    await A.ev(`stopReplay(); 'ok'`);
    expect(!A.errs.length, A.errs.join(' | '));
  });
  await check('Vista 2D de reserva, noche y clima', async () => {
    await A.ev(`set3D(false); $('map').value = 'noche'; newGame(); wx = 'lluvia'; wxFor = ground; 'ok'`);
    await sleep(800);
    await A.ev(`set3D(true); 'ok'`);
    await sleep(800);
    expect(!A.errs.length, A.errs.join(' | '));
  });
  await check('Menús: ajustes, misiones, perfil y tienda', async () => {
    await A.ev(`toMenu(); $('setBtn').click(); $('setOk').click(); $('misBtn').click(); $('misOk').click(); $('profBtn').click(); $('profOk').click(); $('skinBtn').click(); 'ok'`);
    await sleep(800);
    await A.ev(`$('skinsOk').click(); 'ok'`);
    expect(await A.ev(`missions().list.length === 3`), 'no hay 3 misiones');
    expect(!A.errs.length, A.errs.join(' | '));
  });

  if (RED) {
    await check('Sala multijugador: crear, unirse, jugar y reconectar', async () => {
      const H = A, C = await tab('invitado');
      await H.ev(`$('pname').value = 'Anfitrion'; createRoom(); 'ok'`);
      const code = await H.until(`net.code`, 20000);
      expect(code, 'no se pudo crear la sala (¿hay internet?)');
      await C.open();
      await C.ev(`$('pname').value = 'Invitado'; $('code').value = '${code}'; joinRoom(); 'ok'`);
      expect(await C.until(`/Conectado/.test($('lobbyMsg').textContent)`, 40000), 'el invitado no pudo conectar');
      await H.front(); await H.ev(`hostStartGame(); 'ok'`);
      expect(await C.until(`state === 'play'`, 15000), 'la partida no empezó en el invitado');
      await C.front(); await sleep(1500);
      await C.ev(`net.host.close(); 'ok'`);
      expect(await C.until(`!net.reconT && net.host && net.host.open && state === 'play'`, 35000), 'el invitado no se reconectó');
      expect(!H.errs.length && !C.errs.length, H.errs.concat(C.errs).join(' | '));
    });
  }

  const bad = results.filter(r => !r[0]);
  console.log(bad.length ? `\n${bad.length} de ${results.length} pruebas fallaron.` : `\nTodo bien: ${results.length} pruebas superadas.`);
  finish(bad.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
