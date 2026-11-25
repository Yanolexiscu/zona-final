'use strict';
// Zona Final · Vista 3D con Three.js
// (los archivos comparten variables globales y se cargan en orden desde index.html)
/* ---------- Vista 3D (Three.js) ----------
   La lógica del juego sigue siendo 2D (x, y). Aquí solo se dibuja en 3D:
   mundo (x, y) → Three (x, altura, y). El lienzo 2D queda encima para textos y la interfaz. */
let THREE = null, r3 = null, use3D = true;
try { use3D = localStorage.getItem('zf-3d') !== '0'; } catch (e) {}
let PS = 1.7, AIM_H = 23 * PS; // PS: tamaño de los personajes (más grandes que en 2D para verlos bien)
const WALL_H = 74, PITCH = 0.98;
try { const v = +localStorage.getItem('zf-psz'); if (v >= 1.2 && v <= 2.3) { PS = v; AIM_H = 23 * PS; } } catch (e) {}
// Otros ajustes guardados en el teléfono
let vol = 1, aimAssist = true, fps30 = false, wxOn = true;
try {
  const v = localStorage.getItem('zf-vol'); if (v != null && +v >= 0 && +v <= 1) vol = +v;
  aimAssist = localStorage.getItem('zf-aim') !== '0'; fps30 = localStorage.getItem('zf-fps') === '1'; wxOn = localStorage.getItem('zf-wx') !== '0';
} catch (e) {}
const saveSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
const on3D = force => !!(use3D && r3 && (force || r3.ready));
// Calidad: baja (sin sombras), media, alta. En «auto» baja sola si el teléfono no llega a 40 FPS.
const QUALS = { baja: { pr: 0.85, sh: 0, fx: false }, media: { pr: 1.25, sh: 1024, fx: true }, alta: { pr: 2, sh: 2048, fx: true } };
const QORDER = ['baja', 'media', 'alta'];
let qualSet = 'auto';
try { const q = localStorage.getItem('zf-q'); if (q === 'auto' || QUALS[q]) qualSet = q; } catch (e) {}
const autoQ = () => touchMode ? 'media' : 'alta';
function applyQuality(name) {
  if (!r3 || !QUALS[name]) return;
  const Q = QUALS[name], sun = r3.sun;
  r3.q = name; r3.pr = 0; // fuerza a recalcular la resolución
  sun.castShadow = Q.sh > 0;
  if (Q.sh && sun.shadow.mapSize.x !== Q.sh) { sun.shadow.mapSize.set(Q.sh, Q.sh); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
}
function setQuality(v) {
  qualSet = QUALS[v] ? v : 'auto';
  try { localStorage.setItem('zf-q', qualSet); } catch (e) {}
  if (r3) applyQuality(qualSet === 'auto' ? autoQ() : qualSet);
}
// Cámara giratoria (de 90 en 90 grados). Los controles se giran igual para que «arriba» siga siendo arriba en pantalla.
const camYaw = () => on3D() ? r3.yaw : 0;
function rotIn(mx, my) {
  const a = camYaw();
  if (!a) return [mx, my];
  const c = Math.cos(a), s = Math.sin(a);
  return [mx * c - my * s, mx * s + my * c];
}
function rotateCam() {
  if (!on3D()) return;
  r3.yawT += Math.PI / 2;
  try { tone(660, 0.06, 'sine', 0.05); } catch (e) {}
}
function load3D() {
  if (THREE || load3D.p) return load3D.p;
  load3D.p = import(new URL('lib/three.module.min.js', document.baseURI).href).then(m => { THREE = m; init3D(); })
    .catch(err => { console.warn('3D no disponible', err); use3D = false; $('v3d').checked = false; $('c3').style.display = 'none'; });
  return load3D.p;
}
function set3D(v) {
  use3D = v;
  try { localStorage.setItem('zf-3d', v ? '1' : '0'); } catch (e) {}
  $('c3').style.display = v && r3 ? 'block' : 'none';
  if (v) load3D();
}
function init3D() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('c3'), antialias: !touchMode, powerPreference: 'high-performance' });
  } catch (e) { console.warn(e); use3D = false; $('v3d').checked = false; return; }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const cam3 = new THREE.PerspectiveCamera(40, 1, 10, 12000);
  const hemi = new THREE.HemisphereLight(0xe6eeff, 0x51473a, 1.5);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(touchMode ? 1024 : 2048, touchMode ? 1024 : 2048);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
  scene.add(hemi, sun, sun.target);
  // capa 1: tu personaje (se dibuja aparte para mostrar su silueta si algo lo tapa)
  hemi.layers.enable(1); sun.layers.enable(1); sun.shadow.camera.layers.enable(1);
  const pls = [0, 1].map(() => { const l = new THREE.PointLight(0xffc070, 0, 260, 0); l.layers.enable(1); scene.add(l); return l; });
  const flash = new THREE.SpotLight(0xfff2cc, 0, 800, 0.5, 0.6, 0); flash.layers.enable(1);
  const aura = new THREE.PointLight(0xaabbff, 0, 260, 0); aura.layers.enable(1);
  const world = new THREE.Group(), dyn = new THREE.Group();
  scene.add(world, dyn);
  // geometrías base (se escalan al usarlas)
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.IcosahedronGeometry(1, 1), ball: new THREE.SphereGeometry(1, 12, 8),
    hemi: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
    cone: new THREE.ConeGeometry(1, 1, 8), ring: new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2),
    disc: new THREE.CircleGeometry(1, 24),
  };
  const vmat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  r3 = { renderer, scene, cam: cam3, hemi, sun, world, dyn, G, vmat, ready: false, built: null, w: 0, h: 0, pr: 0,
    pls, flash, aura, yaw: 0, yawT: 0, smoke: [], q: 'media', fps: { n: 0, t0: 0, last: 0, good: 0 }, focusMd: null,
    silMat: new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.5, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false }),
    ents: new Map(), vehs: new Map(), loot: new Map(), boxes: new Map(), shields: new Map(), lootGeo: new Map(), tierMat: [],
    avTex: new Map(), colCache: new Map(), tiles: [], dirty: new Set(), trees: [], bushes: [], blds: [], frame: 0 };
  // aros de rareza bajo el botín
  r3.tierMat = TIERS.map(t => new THREE.MeshBasicMaterial({ color: t.color, transparent: true, opacity: 0.75, depthWrite: false }));
  r3.beamMat = TIERS.map(t => new THREE.MeshBasicMaterial({ color: t.color, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  applyQuality(qualSet === 'auto' ? autoQ() : qualSet);
  // cajas de madera (instancias)
  const crateTex = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#b07b3e'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#7a5228'; x.lineWidth = 6; x.strokeRect(3, 3, 58, 58);
    x.lineWidth = 5; x.beginPath(); x.moveTo(6, 6); x.lineTo(58, 58); x.moveTo(58, 6); x.lineTo(6, 58); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 64; i += 8) x.fillRect(0, i, 64, 2);
    return c;
  })());
  crateTex.colorSpace = THREE.SRGBColorSpace;
  r3.crates = new THREE.InstancedMesh(G.box, new THREE.MeshLambertMaterial({ map: crateTex }), 300);
  r3.crates.castShadow = r3.crates.receiveShadow = true; r3.crates.frustumCulled = false;
  r3.crates.setColorAt(0, new THREE.Color(1, 1, 1));
  dyn.add(r3.crates);
  // balas y cohetes
  r3.bul = new THREE.InstancedMesh(G.box, new THREE.MeshBasicMaterial({ color: 0xfff0b0 }), 900);
  r3.bul.frustumCulled = false; dyn.add(r3.bul);
  r3.rk = new THREE.InstancedMesh(G.box, new THREE.MeshLambertMaterial({ color: 0x5a7a3a, emissive: 0x331100 }), 60);
  r3.rk.frustumCulled = false; dyn.add(r3.rk);
  // partículas (puntos con tamaño propio)
  const PMAX = 2500, pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PMAX * 3), 3));
  pg.setAttribute('pcol', new THREE.BufferAttribute(new Float32Array(PMAX * 3), 3));
  pg.setAttribute('psize', new THREE.BufferAttribute(new Float32Array(PMAX), 1));
  pg.setAttribute('palpha', new THREE.BufferAttribute(new Float32Array(PMAX), 1));
  r3.pmat = new THREE.ShaderMaterial({
    uniforms: { scale: { value: 300 } }, transparent: true, depthWrite: false,
    vertexShader: 'attribute vec3 pcol; attribute float psize; attribute float palpha; uniform float scale; varying vec3 vC; varying float vA;' +
      'void main(){ vC = pcol; vA = palpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = psize * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(vC, vA * (1.0 - smoothstep(0.3, 0.5, r))); }',
  });
  r3.parts = new THREE.Points(pg, r3.pmat); r3.parts.frustumCulled = false; r3.PMAX = PMAX; dyn.add(r3.parts);
  // niebla de guerra: abanico de cuadriláteros fuera de lo que ves
  const FMAX = 600, fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FMAX * 18), 3));
  r3.fog = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0x060a18, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
  r3.fog.frustumCulled = false; r3.fog.renderOrder = 2; dyn.add(r3.fog);
  // zona: tinte fuera del círculo + aro objetivo (en el suelo) y pared de energía
  r3.zmat = new THREE.ShaderMaterial({
    uniforms: { zc: { value: new THREE.Vector2() }, zr: { value: 1 }, tc: { value: new THREE.Vector2() }, tr: { value: 1 }, st: { value: 0 }, tm: { value: 0 } },
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec2 zc; uniform float zr; uniform vec2 tc; uniform float tr; uniform float st; uniform float tm; varying vec2 vW;' +
      'void main(){ float d = distance(vW, zc); vec4 c = d > zr ? vec4(0.43, 0.12, 0.67, 0.34) : vec4(0.0);' +
      ' c = mix(c, vec4(0.85, 0.55, 1.0, 0.95), smoothstep(7.0, 0.0, abs(d - zr)));' +
      ' if (st > 0.5) { float e = abs(distance(vW, tc) - tr); float a = atan(vW.y - tc.y, vW.x - tc.x); if (e < 2.6 && fract(a * tr / 24.0) < 0.58) c = vec4(1.0, 1.0, 1.0, 0.8); }' +
      ' gl_FragColor = c; }',
  });
  r3.zplane = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 3, WORLD * 3).rotateX(-Math.PI / 2), r3.zmat);
  r3.zplane.position.set(WORLD / 2, 1.2, WORLD / 2); r3.zplane.renderOrder = 3; r3.zplane.frustumCulled = false; dyn.add(r3.zplane);
  r3.zwall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xa35cff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
  r3.zwall.renderOrder = 4; r3.zwall.frustumCulled = false; dyn.add(r3.zwall);
  // clima: lluvia (líneas) y copos/ceniza/polvo (puntos) en una caja que sigue a la cámara
  const RN = 900, rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RN * 6), 3));
  r3.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaabbdd, transparent: true, opacity: 0.5, depthWrite: false }));
  r3.rain.frustumCulled = false; r3.rain.visible = false; dyn.add(r3.rain);
  const FN = 700, fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FN * 3), 3));
  r3.flakes = new THREE.Points(fgeo, new THREE.PointsMaterial({ color: 0xffffff, size: 6, transparent: true, opacity: 0.9, depthWrite: false }));
  r3.flakes.frustumCulled = false; r3.flakes.visible = false; dyn.add(r3.flakes);
  r3.drops = Array.from({ length: Math.max(RN, FN) }, () => [Math.random() * 2 - 1, Math.random() * 600, Math.random() * 2 - 1, Math.random() * 6.28]);
  r3.RN = RN; r3.FN = FN; r3.bolt = 0; r3.boltT = 6;
  // avión
  const pb = geoB();
  pb.add(G.cyl, '#dfe3ea', 0, 0, 0, 0, 0, Math.PI / 2, 17, 230, 17);
  pb.add(G.cone, '#dfe3ea', 128, 0, 0, 0, 0, -Math.PI / 2, 17, 28, 17);
  pb.add(G.box, '#c2c8d2', -15, -4, 0, 0, 0, 0, 44, 4, 250);
  pb.add(G.box, '#c2c8d2', -112, 2, 0, 0, 0, 0, 22, 3, 92);
  pb.add(G.box, '#e5484d', -112, 22, 0, 0, 0, 0, 26, 36, 3);
  pb.add(G.box, '#e5484d', 0, 4, 0, 0, 0, 0, 220, 4, 34.5);
  pb.add(G.box, '#2b3a55', 104, 8, 0, 0, 0, 0, 16, 8, 26);
  for (const z of [-62, 62]) pb.add(G.cyl, '#6b7a95', 0, -14, z, 0, 0, Math.PI / 2, 8, 34, 8);
  r3.plane = new THREE.Mesh(pb.build(), vmat); r3.plane.scale.setScalar(1.5); r3.plane.castShadow = true; dyn.add(r3.plane);
  // grupos reutilizables
  r3.pools = {};
  const P = (name, make) => { r3.pools[name] = { items: [], n: 0, make }; };
  P('nade', () => { const m = new THREE.Mesh(G.ball, new THREE.MeshLambertMaterial({ color: 0x3d5a2a, emissive: 0 })); m.scale.setScalar(7); m.castShadow = true; return m; });
  P('ring', () => new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: 0xff503c, transparent: true, opacity: 0.5, depthWrite: false })));
  P('blast', () => new THREE.Mesh(G.ball, new THREE.MeshBasicMaterial({ color: 0xffaa3c, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
  P('drop', () => {
    const b = geoB();
    b.add(G.box, '#d29922', 0, 16, 0, 0, 0, 0, 32, 32, 32); b.add(G.box, '#7a5228', 0, 16, 0, 0, 0, 0, 33, 6, 33);
    b.add(G.hemi, '#e5484d', 0, 70, 0, 0, 0, 0, 36, 22, 36);
    for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) b.add(G.box, '#eeeeee', x * 0.55, 50, z * 0.55, 0, 0, 0, 1, 36, 1);
    const m = new THREE.Mesh(b.build(), vmat); m.castShadow = true; return m;
  });
  P('beam', () => {
    const m = new THREE.Mesh(r3.beamGeo || (r3.beamGeo = new THREE.CircleGeometry(1, 14, -0.42, 0.84).rotateX(-Math.PI / 2)),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.userData.sharedGeo = true; m.renderOrder = 6; return m;
  });
  P('flash', () => new THREE.Mesh(G.ball, new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })));
  $('c3').style.display = use3D ? 'block' : 'none';
  try { showSkinBtns(); } catch (e) {}
}
function poolGet(name) {
  const p = r3.pools[name];
  let m = p.items[p.n];
  if (!m) { m = p.make(); p.items.push(m); r3.dyn.add(m); }
  m.visible = true; p.n++;
  return m;
}
function poolsBegin() { for (const k in r3.pools) r3.pools[k].n = 0; }
function poolsEnd() { for (const k in r3.pools) { const p = r3.pools[k]; for (let i = p.n; i < p.items.length; i++) p.items[i].visible = false; } }

// Colores: Three guarda colores lineales; los textos 'rgba(...)' se convierten a mano (sin avisos)
function col3(s) {
  let c = r3.colCache.get(s);
  if (c) return c;
  const m = /^rgba?\(([^)]+)\)/.exec(s);
  if (m) { const a = m[1].split(',').map(Number); c = new THREE.Color().setRGB(a[0] / 255, a[1] / 255, a[2] / 255, THREE.SRGBColorSpace); }
  else c = new THREE.Color(s);
  r3.colCache.set(s, c);
  return c;
}
const colSC = new Map();
function colS(s) { let c = colSC.get(s); if (!c) { const k = col3(s).clone().convertLinearToSRGB(); c = [k.r, k.g, k.b]; colSC.set(s, c); } return c; }
// Une varias piezas (con color por vértice) en una sola geometría: menos llamadas de dibujo
function geoB() {
  const pos = [], nor = [], col = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const api = {
    add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
      q.setFromEuler(eu.set(rx, ry, rz));
      return api.addQ(geo, color, x, y, z, q, sx, sy, sz);
    },
    addQ(geo, color, x, y, z, quat, sx, sy, sz) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      m.compose(p.set(x, y, z), quat, sc.set(sx, sy, sz));
      g.applyMatrix4(m);
      const P = g.attributes.position.array, N = g.attributes.normal ? g.attributes.normal.array : null;
      const fn = typeof color === 'function' ? color : null, c = fn ? null : col3(color);
      for (let i = 0; i < P.length; i += 9) {
        const cc = fn ? col3(fn((P[i] + P[i + 3] + P[i + 6]) / 3, (P[i + 1] + P[i + 4] + P[i + 7]) / 3, (P[i + 2] + P[i + 5] + P[i + 8]) / 3)) : c;
        for (let k = 0; k < 9; k++) { pos.push(P[i + k]); nor.push(N ? N[i + k] : 0); }
        for (let k = 0; k < 3; k++) col.push(cc.r, cc.g, cc.b);
      }
      g.dispose();
      return api;
    },
    // pieza alargada entre dos puntos (brazos, patas…)
    limb(color, a, b, t) {
      const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
      q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
      return api.addQ(G3().box, color, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, q, L, t, t);
    },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeBoundingSphere();
      return g;
    },
  };
  return api;
}
const G3 = () => r3.G;
function disposeTree(o) {
  o.traverse(n => {
    if (n.geometry && !Object.values(r3.G).includes(n.geometry) && !n.userData.sharedGeo) n.geometry.dispose();
    const ms = Array.isArray(n.material) ? n.material : n.material ? [n.material] : [];
    for (const m of ms) if (m !== r3.vmat && !r3.tierMat.includes(m) && !r3.beamMat.includes(m) && !n.userData.sharedMat) { if (m.map && !n.userData.sharedTex) m.map.dispose(); m.dispose(); }
  });
}

/* ----- Mundo fijo (se rehace con cada mapa) ----- */
function dirty3D(x, y, r) {
  if (!r3 || !r3.tiles.length || x == null) return;
  const S = WORLD / r3.TN;
  for (let ty = Math.floor((y - r) / S); ty <= Math.floor((y + r) / S); ty++)
    for (let tx = Math.floor((x - r) / S); tx <= Math.floor((x + r) / S); tx++)
      if (tx >= 0 && ty >= 0 && tx < r3.TN && ty < r3.TN) r3.dirty.add(ty * r3.TN + tx);
}
function drawTile(t) {
  const px = ground.width / r3.TN;
  t.cx.drawImage(ground, t.i * px, t.j * px, px, px, 0, 0, t.cv.width, t.cv.height);
  t.tex.needsUpdate = true;
}
function build3DWorld() {
  const { world, G, vmat } = r3;
  disposeTree(world); world.clear();
  for (const k of ['treeMat', 'treeFade', 'bushMat', 'bushFade', 'tileGeo', 'wmat']) if (r3[k]) { r3[k].dispose(); r3[k] = null; }
  r3.tiles = []; r3.dirty.clear(); r3.trees = []; r3.bushes = []; r3.blds = [];
  r3.built = ground;
  const bg = new THREE.Color(TH.bg);
  r3.scene.background = bg;
  r3.scene.fog = new THREE.Fog(bg, 1500, 3000);
  // luz según el mapa
  r3.hemi.color.set(TH.lava ? 0xffc8a0 : TH.snow ? 0xdde8ff : 0xe6eeff);
  r3.hemi.groundColor.set(TH.lava ? 0x40180c : TH.snow ? 0x8090a0 : 0x51473a);
  r3.hemi.intensity = TH.snow ? 1.15 : TH.lava ? 1.25 : 1.5;
  r3.sun.color.set(TH.lava ? 0xffa070 : 0xfff1dc);
  r3.sun.intensity = TH.snow ? 1.5 : TH.lava ? 1.6 : 2.1;
  // suelo en baldosas (para poder actualizar manchas sin subir toda la textura)
  const TN = r3.TN = 6, S = WORLD / TN, px = Math.round(ground.width / TN), aniso = Math.min(8, r3.renderer.capabilities.getMaxAnisotropy());
  const tileGeo = r3.tileGeo = new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2);
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
    const cv = document.createElement('canvas'); cv.width = cv.height = px;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
    const t = { i, j, cv, cx: cv.getContext('2d'), tex };
    drawTile(t);
    const m = new THREE.Mesh(tileGeo, new THREE.MeshLambertMaterial({ map: tex }));
    m.userData.sharedGeo = true;
    m.position.set((i + 0.5) * S, 0, (j + 0.5) * S); m.receiveShadow = true;
    world.add(m); r3.tiles.push(t);
  }
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 8, WORLD * 8).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: TH.bg }));
  outer.position.set(WORLD / 2, -2, WORLD / 2); world.add(outer);
  // agua: una lámina brillante encima de los lagos
  if (ponds.length) { // agua (o lava) con ondas animadas
    const wb = geoB();
    for (const p of ponds) wb.add(G.disc, TH.water[1], p.x, 0.6, p.y, -Math.PI / 2, 0, 0, p.r - 4, p.r - 4, 1);
    const wc = new THREE.Color(TH.water[1]);
    r3.wmat = new THREE.ShaderMaterial({
      uniforms: { col: { value: new THREE.Vector3(wc.r, wc.g, wc.b) }, t: { value: 0 }, lava: { value: TH.lava ? 1 : 0 }, dark: { value: TH.night ? 0.45 : 1 } },
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 col; uniform float t; uniform float lava; uniform float dark; varying vec2 vW;' +
        'void main(){ float w = sin(vW.x * 0.045 + t * 1.3) * sin(vW.y * 0.05 - t * 1.1) + 0.6 * sin((vW.x + vW.y) * 0.03 + t * 0.7);' +
        ' vec3 c = pow(col, vec3(1.0 / 2.2)); float a = 0.3 + 0.1 * w; c += vec3(0.22) * smoothstep(0.7, 1.4, w);' +
        ' if (lava > 0.5) { c = mix(c, vec3(1.0, 0.85, 0.3), smoothstep(0.2, 1.4, w)); a = 0.6 + 0.2 * w; }' +
        ' gl_FragColor = vec4(c * dark, a); }',
    });
    const wm = new THREE.Mesh(wb.build(), r3.wmat); wm.userData.sharedMat = true;
    wm.renderOrder = 1; world.add(wm);
  }
  // noche: luna, linterna y farolas
  const night = !!TH.night;
  for (const o of [r3.flash, r3.flash.target, r3.aura]) { if (night && !o.parent) r3.scene.add(o); if (!night && o.parent) r3.scene.remove(o); }
  if (night) {
    r3.hemi.color.set(0x8a9ccc); r3.hemi.groundColor.set(0x101820); r3.hemi.intensity = 0.5;
    r3.sun.color.set(0x9fb4ff); r3.sun.intensity = 0.55;
    const glowTex = new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,220,140,.9)'); g.addColorStop(1, 'rgba(255,220,140,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c;
    })());
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const lb = geoB(), bulbs = geoB(), glowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const lamp = (x, y) => {
      lb.add(G.cyl, '#2a2e36', x, 45, y, 0, 0, 0, 2.6, 90, 2.6); lb.add(G.box, '#2a2e36', x + 8, 89, y, 0, 0, 0, 18, 2.4, 3);
      bulbs.add(G.sph, '#fff1c0', x + 15, 86, y, 0, 0, 0, 4);
      const gm = new THREE.Mesh(glowGeo, glowMat); gm.scale.set(230, 1, 230); gm.position.set(x + 15, 2.2, y); gm.renderOrder = 6; gm.userData.sharedGeo = true; gm.userData.sharedMat = true; world.add(gm);
    };
    for (const r of roads) for (const k of [0.3, 0.7]) {
      const x = lerp(r.x1, r.x2, k), y = lerp(r.y1, r.y2, k), l = Math.hypot(r.x2 - r.x1, r.y2 - r.y1) || 1;
      const px = x - (r.y2 - r.y1) / l * 48, py = y + (r.x2 - r.x1) / l * 48;
      if (!insideBuilding(px, py, 10)) lamp(px, py);
    }
    const lm = new THREE.Mesh(lb.build(), vmat); lm.castShadow = true; world.add(lm);
    world.add(new THREE.Mesh(bulbs.build(), new THREE.MeshBasicMaterial({ vertexColors: true })));
    // ventanas encendidas
    const wl = geoB();
    for (const b of buildings) for (const [x, y, w, h] of [[b.x + b.w * 0.3, b.y - 0.8, 26, 1], [b.x + b.w * 0.7, b.y + b.h + 0.8, 26, 1]]) wl.add(G.box, '#ffd27a', x, WALL_H * 0.55, y, 0, 0, 0, w, 16, h);
    if (buildings.length) world.add(new THREE.Mesh(wl.build(), new THREE.MeshBasicMaterial({ vertexColors: true })));
    r3.hemiBase = r3.hemi.intensity; r3.sunBase = r3.sun.intensity;
  }
  r3.hemiBase = r3.hemi.intensity; r3.sunBase = r3.sun.intensity;
  // casas: paredes por casa (para hacerlas transparentes al entrar) y tejado a dos aguas
  const wallCol = TH.city ? '#a7abb2' : TH.snow ? '#cdbfa8' : TH.lava ? '#5a4a42' : TH.palm ? '#f2e6cc' : '#e0d0b0';
  const trim = TH.city ? '#6d7179' : TH.lava ? '#2e2522' : '#8a6a48';
  for (const b of buildings) {
    const wb = geoB();
    for (const q of rects) {
      if (q.kind !== 'wall' || q.x < b.x - 1 || q.y < b.y - 1 || q.x + q.w > b.x + b.w + 1 || q.y + q.h > b.y + b.h + 1) continue;
      wb.add(G.box, wallCol, q.x + q.w / 2, WALL_H / 2, q.y + q.h / 2, 0, 0, 0, q.w, WALL_H, q.h);
      wb.add(G.box, trim, q.x + q.w / 2, 5, q.y + q.h / 2, 0, 0, 0, q.w + 1.5, 10, q.h + 1.5);
      wb.add(G.box, trim, q.x + q.w / 2, WALL_H - 2, q.y + q.h / 2, 0, 0, 0, q.w + 2, 4, q.h + 2);
    }
    for (const d of b.doors) { // dintel encima de cada puerta
      if (d.ny) wb.add(G.box, trim, d.x, WALL_H - 7, d.y, 0, 0, 0, GAP, 14, T);
      else wb.add(G.box, trim, d.x, WALL_H - 7, d.y, 0, 0, 0, T, 14, GAP);
    }
    const wmat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const walls = new THREE.Mesh(wb.build(), wmat); walls.castShadow = walls.receiveShadow = true; world.add(walls);
    // tejado: prisma sobre el lado largo
    const horiz = b.w >= b.h, o = 8, x0 = b.x - o, x1 = b.x + b.w + o, z0 = b.y - o, z1 = b.y + b.h + o, H = WALL_H, R = Math.min(b.w, b.h) * 0.32;
    const v = [];
    const tri = (a, c, d) => v.push(...a, ...c, ...d);
    if (horiz) {
      const zm = (z0 + z1) / 2, A = [x0, H, z0], B = [x1, H, z0], C = [x1, H, z1], D = [x0, H, z1], E = [x0, H + R, zm], F = [x1, H + R, zm];
      tri(A, E, F); tri(A, F, B); tri(D, C, F); tri(D, F, E); tri(A, D, E); tri(B, F, C);
    } else {
      const xm = (x0 + x1) / 2, A = [x0, H, z0], B = [x1, H, z0], C = [x1, H, z1], D = [x0, H, z1], E = [xm, H + R, z0], F = [xm, H + R, z1];
      tri(A, F, E); tri(A, D, F); tri(B, E, F); tri(B, F, C); tri(A, E, B); tri(D, C, F);
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); rg.computeVertexNormals();
    const rmat = new THREE.MeshLambertMaterial({ color: b.roof, flatShading: true, side: THREE.DoubleSide, transparent: true });
    const roof = new THREE.Mesh(rg, rmat); roof.castShadow = true; world.add(roof);
    r3.blds.push({ b, walls, wmat, roof, rmat });
  }
  // rocas: todas en una pieza
  const rb = geoB();
  for (const c of circles) {
    if (c.kind !== 'rock') continue;
    const sh = new THREE.Shape();
    for (let i = 0; i < c.pts.length; i += 2) { if (i) sh.lineTo(c.pts[i], c.pts[i + 1]); else sh.moveTo(c.pts[i], c.pts[i + 1]); }
    const h = c.r * rand(0.55, 0.85);
    const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: c.r * 0.35, bevelSize: c.r * 0.18, bevelSegments: 1, curveSegments: 1 });
    g.rotateX(Math.PI / 2);
    rb.add(g, Math.random() < 0.5 ? TH.rock[0] : '#' + col3(TH.rock[0]).clone().lerp(col3(TH.rock[1]), 0.35).getHexString(THREE.SRGBColorSpace), c.x, h, c.y);
    g.dispose();
  }
  const rocks = new THREE.Mesh(rb.build(), vmat); rocks.castShadow = rocks.receiveShadow = true; world.add(rocks);
  // árboles (uno por árbol para poder transparentarlo cuando estás debajo)
  r3.treeMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  r3.treeFade = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.3, depthWrite: false });
  for (const c of circles) {
    if (c.kind !== 'tree') continue;
    const b = geoB();
    if (TH.cactus) {
      const r = c.r * 0.55;
      b.add(G.cyl, TH.tree[1], c.x, 38, c.y, 0, 0, 0, r, 76, r);
      b.add(G.sph, TH.tree[1], c.x, 76, c.y, 0, 0, 0, r, r * 0.7, r);
      for (const [dx, dz, h] of [[r * 1.9, -r * 0.4, 52], [-r * 1.8, r * 0.5, 40]]) {
        b.add(G.cyl, TH.tree[2], c.x + dx / 2, h - 12, c.y + dz / 2, 0, Math.atan2(-dz, dx), Math.PI / 2, r * 0.45, Math.hypot(dx, dz), r * 0.45);
        b.add(G.cyl, TH.tree[2], c.x + dx, h, c.y + dz, 0, 0, 0, r * 0.45, 26, r * 0.45);
        b.add(G.sph, TH.tree[2], c.x + dx, h + 13, c.y + dz, 0, 0, 0, r * 0.45);
      }
      b.add(G.sph, '#ff7ab8', c.x, 84, c.y, 0, 0, 0, r * 0.35);
    } else if (TH.palm) {
      const lean = rand(-0.25, 0.25), lz = rand(-0.25, 0.25);
      let x = c.x, y = 0, z = c.y;
      for (let k = 0; k < 6; k++) { b.add(G.cyl, k % 2 ? '#8a6438' : '#a07a48', x, y + 10, z, 0, 0, 0, 6 - k * 0.4, 21, 6 - k * 0.4); x += lean * k * 3; z += lz * k * 3; y += 20; }
      const top = [x, y, z], seed = c.x * 0.37 + c.y * 0.11, R = c.r * 2.1;
      for (let k = 0; k < 7; k++) {
        const a = seed + k / 7 * Math.PI * 2;
        b.add(G.box, k % 2 ? TH.tree[1] : TH.tree[2], top[0] + Math.cos(a) * R * 0.45, top[1] - 8, top[2] + Math.sin(a) * R * 0.45, 0, -a, -0.38, R * 0.95, 2, R * 0.28);
      }
      for (const [dx, dz] of [[-4, -3], [4, -2], [0, 4]]) b.add(G.sph, '#6b4423', top[0] + dx, top[1] - 6, top[2] + dz, 0, 0, 0, 4.5);
    } else {
      b.add(G.cyl, TH.lava ? '#2a2420' : '#6b4a2b', c.x, 24, c.y, 0, 0, 0, c.r * 0.32, 48, c.r * 0.32);
      for (const k of c.blobs) {
        const h = 62 + rand(-4, 14);
        b.add(G.sph, TH.tree[0], c.x + k.dx, h - 4, c.y + k.dy, 0, rand(0, 3), 0, k.r + 3, (k.r + 3) * 0.8, k.r + 3);
        b.add(G.sph, Math.random() < 0.5 ? TH.tree[1] : TH.tree[2], c.x + k.dx - 3, h + 6, c.y + k.dy - 4, 0, rand(0, 3), 0, k.r * 0.8, k.r * 0.7, k.r * 0.8);
        if (TH.snow) b.add(G.sph, '#f4f8ff', c.x + k.dx - 3, h + 13, c.y + k.dy - 4, 0, 0, 0, k.r * 0.55, k.r * 0.3, k.r * 0.55);
      }
    }
    const m = new THREE.Mesh(b.build(), r3.treeMat); m.castShadow = true; m.userData.sharedMat = true; world.add(m);
    r3.trees.push({ c, m });
  }
  // arbustos
  r3.bushMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  r3.bushFade = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.45, depthWrite: false });
  for (const bu of bushes) {
    const b = geoB();
    for (const k of bu.blobs) {
      b.add(G.sph, TH.bush[0], bu.x + k.dx, k.r * 0.75, bu.y + k.dy, 0, rand(0, 3), 0, k.r + 2, (k.r + 2) * 0.95, k.r + 2);
      b.add(G.sph, Math.random() < 0.5 ? TH.bush[1] : TH.bush[2], bu.x + k.dx - 3, k.r * 1.05, bu.y + k.dy - 3, 0, rand(0, 3), 0, k.r * 0.7);
    }
    const m = new THREE.Mesh(b.build(), r3.bushMat); m.castShadow = true; m.userData.sharedMat = true; world.add(m);
    r3.bushes.push({ bu, m });
  }
}

/* ----- Personajes ----- */
function avTex(av) {
  let t = r3.avTex.get(av);
  if (t) return t;
  const im = avImg(av);
  t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace;
  if (im.complete && im.naturalWidth) t.needsUpdate = true; else im.addEventListener('load', () => { t.needsUpdate = true; });
  r3.avTex.set(av, t);
  return t;
}
// Cabeza en (0, HY, 0) mirando hacia +x. Devuelve true si la cabeza ya tiene cara propia (sin ojos normales).
function addHead(b, S) {
  const G = G3(), R = 8.5, HY = 44;
  const A = (geo, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => b.add(geo, c, x, HY + y, z, rx, ry, rz, sx, sy, sz);
  const hair = () => A(G.hemi, S.hair || '#222', -1, 0.5, 0, R + 0.7, R + 0.7, R + 0.7);
  const head = (c = S.skin, s = R) => A(G.sph, c, 0, 0, 0, s, s, s);
  const eyes = (c = '#1b1b22', y = 1) => { for (const z of [-3.2, 3.2]) A(G.box, c, R - 0.6, y, z, 1.6, 2.6, 1.8); };
  const brim = (c, r) => { A(G.cyl, c, -0.5, 5, 0, r, 1.4, r); };
  switch (S.hat) {
    case 'robot':
      A(G.box, S.hatC, 0, 0, 0, 17, 17, 17); A(G.box, '#ff3b3b', 8.7, 1, 0, 1, 3, 11);
      A(G.box, '#5d6878', 0, 11, 0, 1.5, 6, 1.5); A(G.sph, '#ff3b3b', 0, 14.5, 0, 2, 2, 2); return true;
    case 'melon':
      head('#2e8b3e', R + 2); for (const z of [-4, 0, 4]) A(G.box, '#1b5e28', 0, 0, z, R * 2 + 3.2, R * 2 + 3, 0.8);
      for (const z of [-3.6, 3.6]) A(G.box, '#111', R + 1.6, 1.5, z, 1.4, 3.6, 4.2); A(G.box, '#111', R + 1.6, 2, 0, 1, 1, 3.4); return true;
    case 'skull': head('#ececec'); for (const z of [-3.3, 3.3]) A(G.box, '#141414', R - 0.3, 1.5, z, 1.5, 3.4, 3.4); A(G.box, '#141414', R - 0.2, -2.5, 0, 1, 1.6, 1.4); return true;
    case 'ghost': head('#f4f6ff', R + 0.5); for (const z of [-3, 3]) A(G.box, '#2a2f5a', R, 1, z, 1.4, 4.6, 2.4); return true;
    case 'stone': head('#b4bac0'); eyes('#e8f6ff'); return true;
    case 'pumpkin':
      A(G.sph, S.hatC, 0, 0, 0, R + 1.5, R + 0.5, R + 2.5); A(G.cyl, '#3a6b1e', 0, R + 1.5, 0, 1.4, 4, 1.4);
      for (const z of [-3.6, 3.6]) A(G.cone, '#ffe066', R + 1.2, 2, z, 2.2, 3.4, 2.2); A(G.box, '#ffe066', R + 1.2, -3.5, 0, 1, 1.6, 7); return true;
    case 'burger':
      for (const [c, y, r, h] of [['#d99a4e', -6, R + 1, 4], ['#5a2e14', -2.5, R + 1.4, 3.5], ['#ffcf3a', 0, R + 1.8, 1.2], ['#4caf50', 1.2, R + 1.6, 1.5]]) A(G.cyl, c, 0, y, 0, r, h, r);
      A(G.hemi, '#e0903c', 0, 2, 0, R + 1, R * 0.9, R + 1); eyes('#111', -2.8);
      A(G.hemi, S.hatC, -1, 7, 0, 5.5, 4, 6); A(G.box, S.hatC, 5, 7.5, 0, 6, 1, 8); return true;
    case 'yeti':
      A(G.sph, S.hatC, -1, 0, 0, R + 2.5, R + 2.5, R + 2.5); A(G.box, S.skin, R + 0.6, -0.5, 0, 2, 9, 10); eyes('#1d2a3a', 1);
      for (const z of [-1, 1]) A(G.cone, '#6fb8f0', -1, 10, z * 9, 2.5, 8, 2.5, z * 0.6, 0, 0); return true;
    case 'fox':
      head(S.hatC, R + 0.5); A(G.cone, '#fff3e6', R + 3, -2, 0, 3.5, 7, 3.5, 0, 0, -Math.PI / 2); A(G.sph, '#111', R + 6.4, -2, 0, 1.4, 1.4, 1.4);
      for (const z of [-1, 1]) { A(G.cone, S.hatC, -1, 10, z * 5, 3, 8, 3, z * 0.3); A(G.cone, '#24232b', -1, 13.5, z * 6, 1.4, 2.4, 1.4, z * 0.3); }
      A(G.box, S.band || '#24232b', R - 1.5, 1.5, 0, 1.4, 2.6, R * 2 + 1); for (const z of [-3, 3]) A(G.box, '#f5e663', R + 0.4, 1.5, z, 0.8, 1.4, 1.8); return true;
    case 'cactushead':
      head('#3f9a4a'); eyes(); brim(S.hatC, R + 5); A(G.cyl, S.hatC, -0.5, 9, 0, R - 2, 7, R - 2); A(G.box, '#e5484d', -0.5, 6.5, 0, R * 2 - 3, 1.5, R * 2 - 3);
      for (const [y, z] of [[-3, -R], [2, R], [-5, R * 0.9], [3, -R]]) A(G.cone, '#f5f0d0', 0, y, z, 0.5, 3, 0.5, Math.sign(z) * Math.PI / 2); return true;
  }
  head(); eyes();
  switch (S.hat) {
    case 'hair': hair(); break;
    case 'cap': hair(); A(G.hemi, S.hatC, -0.5, 1.5, 0, R + 1, R * 0.8, R + 1); A(G.box, S.hatC, 7, 2, 0, 9, 1.2, 11); break;
    case 'hood':
      A(G.sph, S.hatC, -2.5, 0.5, 0, R + 1.6, R + 1.6, R + 1.8);
      if (S.band) { A(G.box, S.band, 2, 3, 0, R * 2 - 1, 2.4, R * 2 + 3); A(G.box, S.band, -11, 3, 2, 6, 1.6, 1.6, 0, 0.4, 0); }
      break;
    case 'helmet':
      A(G.hemi, S.hatC, 0, -1, 0, R + 1.6, R + 2.5, R + 1.6);
      if (S.visor) A(G.box, S.visor, R - 0.2, 0, 0, 2.2, 6, 11);
      break;
    case 'bandana': hair(); A(G.hemi, S.hatC, -0.5, 1, 0, R + 1, R * 0.7, R + 1); A(G.box, S.hatC, -R - 2, 1, 0, 5, 2.2, 2); break;
    case 'mohawk': A(G.box, S.hair, -1, R, 0, 14, 6, 2.6); break;
    case 'cowboy': case 'safari': hair(); brim(S.hatC, R + 6); A(G.cyl, S.hatC, -0.5, 9.5, 0, R - 1.5, 8, R - 1.5); A(G.box, S.hat === 'cowboy' ? '#2a1a0e' : '#8a6d3a', -0.5, 6.8, 0, R * 2 - 2.5, 1.6, R * 2 - 2.5); break;
    case 'chef': hair(); A(G.cyl, '#ffffff', -1, 13, 0, 6.5, 12, 6.5); A(G.sph, '#ffffff', -1, 20, 0, 8.5, 5, 8.5); break;
    case 'knight':
      A(G.sph, S.hatC, 0, 0, 0, R + 1.6, R + 1.6, R + 1.6); A(G.box, '#1d2128', R + 0.8, 1.5, 0, 1, 2, 11);
      A(G.box, '#e5484d', -3, R + 4, 0, 12, 6, 2.2); break;
    case 'horns':
      hair(); A(G.hemi, S.hatC, -0.5, 0.5, 0, R + 1, R + 0.8, R + 1);
      for (const z of [-1, 1]) A(G.cone, '#f2ead3', 0, 6, z * 11, 2.6, 10, 2.6, z * 1.1); break;
    case 'wizard': brim(S.hatC, R + 5); A(G.cone, S.hatC, -1, 18, 0, 7.5, 22, 7.5, 0, 0, 0.15); A(G.box, '#ffd34d', 4, 12, 0, 3, 3, 3, 0.7, 0.7); break;
    case 'ears':
      A(G.hemi, S.hatC, -1, 0.5, 0, R + 1, R + 0.6, R + 1);
      for (const z of [-1, 1]) { A(G.cone, S.hatC, -1, 10, z * 5.5, 3.4, 8, 3, z * 0.35); A(G.cone, '#ffb3c1', 0, 10, z * 5.5, 1.8, 5, 1.4, z * 0.35); }
      break;
    case 'spikes':
      A(G.hemi, S.hatC, -1, 0.5, 0, R + 1, R + 0.8, R + 1);
      for (let k = 0; k < 4; k++) A(G.cone, S.spikeC || '#ffd34d', -2 - k * 4, 9 - k * 2.4, 0, 2.4, 6, 2.4, 0, 0, 0.5 + k * 0.25);
      break;
    case 'kabuto': A(G.hemi, S.hatC, 0, -1, 0, R + 2, R + 2.5, R + 2); A(G.box, '#c9a227', 5, 9, 0, 2, 8, 14, 0, 0, -0.3); break;
    case 'shark':
      A(G.sph, S.hatC, -1.5, 0.5, 0, R + 2.2, R + 2.2, R + 2.2); A(G.box, S.skin, R + 1.2, -0.5, 0, 1.6, 8, 10);
      for (const z of [-3.5, -1.2, 1.2, 3.5]) A(G.cone, '#ffffff', R + 1.8, 4.5, z, 1, 2.4, 1, Math.PI);
      A(G.cone, '#356a9e', -4, R + 4, 0, 1.8, 9, 5, 0, 0, 0.5); break;
    case 'crown':
      hair(); A(G.cyl, S.hatC, -1, 8, 0, 6, 4, 6);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; A(G.cone, S.hatC, -1 + Math.cos(a) * 5.4, 12, Math.sin(a) * 5.4, 1.4, 3.4, 1.4); }
      A(G.sph, '#e5484d', 4.6, 8, 0, 1.4, 1.4, 1.4); break;
  }
  return false;
}
function personModel(e, parent) {
  const S = SKINS[e.sk] || SKINS[0], G = G3();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: !!S.alpha, opacity: S.alpha || 1 });
  const glow = S.glow ? col3(S.glow).clone().multiplyScalar(0.3) : new THREE.Color(0);
  mat.emissive.copy(glow);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const b = geoB();
  // torso, estampado y accesorios
  b.add(G.box, S.shirt, -1, 25.5, 0, 0, 0, 0, 10, 19, 17);
  b.add(G.box, S.shirt, -1, 34.5, 0, 0, 0, 0, 8, 2, 13);
  const pc = S.patC;
  switch (S.pat) {
    case 'stripe': for (const y of [20, 25, 30]) b.add(G.box, pc, -1, y, 0, 0, 0, 0, 10.4, 2, 17.4); break;
    case 'vest': case 'royal': b.add(G.box, pc, -1, 25.5, 0, 0, 0, 0, 10.6, 19.2, 6); break;
    case 'reflect': for (const y of [21, 29]) b.add(G.box, pc, -1, y, 0, 0, 0, 0, 10.4, 2, 17.4); break;
    case 'cross': b.add(G.box, pc, 4.1, 27, 0, 0, 0, 0, 0.6, 7, 2.4); b.add(G.box, pc, 4.1, 27, 0, 0, 0, 0, 0.6, 2.4, 7); break;
    case 'buttons': for (const y of [21, 25, 29]) b.add(G.box, pc, 4.1, y, 0, 0, 0, 0, 0.8, 1.6, 1.6); break;
    case 'belly': case 'fur': b.add(G.box, pc || '#d9c3a0', 3.5, 24, 0, 0, 0, 0, 3.4, 14, 10); break;
    case 'track': case 'plates': for (const y of [18, 33]) b.add(G.box, pc, -1, y, 0, 0, 0, 0, 10.4, 1.6, 17.4); break;
    case 'belt': b.add(G.box, pc, -1, 26, 0, 0.6, 0, 0, 10.6, 2.4, 20); break;
    case 'apron': b.add(G.box, '#ffffff', 3.6, 23, 0, 0, 0, 0, 3.2, 16, 11); b.add(G.box, pc, 5.3, 25, 0, 0, 0, 0, 0.4, 3, 3); break;
    case 'camo': for (const [y, z, c] of [[21, -4, '#3e4a26'], [28, 5, '#7d8b52'], [31, -3, '#2f3a1d'], [24, 6, '#3e4a26']]) b.add(G.box, c, -1, y, z, 0, 0, 0, 10.6, 4, 5); break;
    case 'stars': case 'gem': case 'frost': for (const [y, z] of [[21, -5], [27, 3], [31, -2], [24, 6]]) b.add(G.box, pc || '#ffffff', 4.1, y, z, 0.7, 0.7, 0, 1, 1.6, 1.6); break;
    case 'lava': case 'cracks': case 'torn': case 'spines': case 'bones': case 'fur2': case 'panel':
      for (const [y, z] of [[20, -4], [26, 4], [31, -1]]) b.add(G.box, S.pat === 'lava' ? '#ff7a1f' : S.pat === 'panel' ? '#3df2ff' : S.pat === 'torn' ? '#8fbf6a' : pc || 'rgba(60,64,70,1)', 4.1, y, z, 0, 0, 0.7, 0.6, 1.2, 6);
      break;
  }
  if (S.pack) b.add(G.box, S.pack, -8.5, 26, 0, 0, 0, 0, 6, 13, 12);
  if (S.cape) b.add(G.box, S.cape, -7.2, 23, 0, 0, 0, 0.12, 1.6, 22, 16);
  b.add(G.box, '#2a2d36', -1, 16.5, 0, 0, 0, 0, 10.4, 2.4, 17.4); // cinturón
  b.add(G.box, S.skin, -1, 37, 0, 0, 0, 0, 5, 3, 5); // cuello
  const ownFace = addHead(b, S);
  const upper = new THREE.Mesh(b.build(), mat); upper.castShadow = true; body.add(upper);
  // piernas (se balancean al andar)
  const pants = '#' + col3(S.shirt).clone().multiplyScalar(0.45).getHexString(THREE.SRGBColorSpace);
  const lb = geoB();
  lb.add(G.box, pants, 0, -7, 0, 0, 0, 0, 6.5, 14, 6.5);
  lb.add(G.box, S.shoe || '#22252b', 1.5, -15, 0, 0, 0, 0, 9.5, 3.5, 7);
  const lg = lb.build(), legs = [];
  for (const z of [-4.3, 4.3]) { const l = new THREE.Mesh(lg, mat); l.position.set(-1, 17, z); l.castShadow = true; body.add(l); legs.push(l); }
  // foto de perfil como cara
  let face = null;
  if (e.av && !ownFace) {
    face = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ map: avTex(e.av) }));
    face.userData.sharedTex = true;
    face.scale.setScalar(7.6); face.position.set(8.7, 44, 0); face.rotation.y = Math.PI / 2; body.add(face);
  }
  const ring = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.scale.setScalar(22); ring.position.y = 1.5; ring.renderOrder = 5; root.add(ring);
  const arms = new THREE.Group(); body.add(arms);
  const flash = new THREE.Mesh(G.ball, new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.visible = false; arms.add(flash);
  (parent || r3.dyn).add(root);
  arms.position.y = 31;
  return { root, body, mat, glow, legs, arms, armMesh: null, armKey: '', flash, ring, chute: null, key: e.sk + '|' + (e.av || '').length + (e.av || '').slice(-24), S };
}
// Brazos, manos y arma (se rehacen al cambiar de arma o de postura)
function armsFor(md, S, W, tier, pose) {
  const key = pose + (W ? W.name + tier : '-');
  if (md.armKey === key) return;
  md.armKey = key;
  if (md.armMesh) { md.arms.remove(md.armMesh); md.armMesh.geometry.dispose(); }
  const b = geoB(), G = G3(), sl = S.sleeve || S.shirt, hand = S.glove || S.skin;
  let h1, h2;
  if (pose === 'glide') { h1 = [3, 50, 9]; h2 = [3, 50, -9]; }
  else if (pose === 'down' || !W) { h1 = [2, 18, 11]; h2 = [2, 18, -11]; }
  else {
    const L = W.len + 6, y = 29;
    b.add(G.box, '#1c1c1c', 8 + L / 2, y, 0, 0, 0, 0, L, 5, 4.4);
    b.add(G.box, W.color, 9 + L / 2, y + 1.6, 0, 0, 0, 0, L - 2, 2.4, 4.8);
    b.add(G.box, '#1c1c1c', 12, y - 4, 0, 0, 0, 0.3, 3, 6, 3.6);
    if (tier > 0) b.add(G.box, TIERS[tier].color, 10.5, y + 0.6, 0, 0, 0, 0, 3, 5.6, 5.2);
    if (W.rocket) b.add(G.cyl, W.color, 8 + L / 2, y + 1, 0, 0, 0, Math.PI / 2, 4, L, 4);
    h1 = [12, y - 1, 3.5]; h2 = [16 + W.len * 0.45, y - 1, -2];
    md.flash.position.set(14 + L, y + 0.5 - 31, 0);
  }
  b.limb(sl, [0, 33, 9.5], h1, 4.6); b.limb(sl, [0, 33, -9.5], h2, 4.6);
  b.add(G.sph, hand, h1[0], h1[1], h1[2], 0, 0, 0, 2.8); b.add(G.sph, hand, h2[0], h2[1], h2[2], 0, 0, 0, 2.8);
  const ag = b.build(); ag.translate(0, -31, 0); // pivote en los hombros
  md.armMesh = new THREE.Mesh(ag, md.mat); md.armMesh.castShadow = true; md.arms.add(md.armMesh);
  if (md.sil) md.armMesh.layers.set(1);
}
function chuteFor(md, e) {
  if (md.chute) return md.chute;
  const b = geoB(), G = G3(), c = e.color;
  b.add(G.hemi, (x, y, z) => Math.floor((z + 48) / 12) % 2 ? c : '#f5f5f5', 0, 88, 0, 0, 0, 0, 34, 16, 46);
  for (const [x, z] of [[-20, -28], [-20, 28], [20, -28], [20, 28]]) b.limb('#eeeeee', [x * 0.95, 88, z * 0.95], [0, 50, Math.sign(z) * 6], 0.8);
  md.chuteMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true });
  md.chute = new THREE.Mesh(b.build(), md.chuteMat); md.chute.castShadow = true; md.root.add(md.chute);
  if (md.sil) md.chute.layers.set(1);
  return md.chute;
}
function syncEnt(e, f, dt) {
  let md = r3.ents.get(e);
  const key = e.sk + '|' + (e.av || '').length + (e.av || '').slice(-24);
  if (md && md.key !== key) { r3.dyn.remove(md.root); disposeTree(md.root); r3.ents.delete(e); md = null; }
  const now = performance.now() / 1000;
  // al morir: cae al suelo y se desvanece (solo si lo estabas viendo)
  if (md && !e.alive && md.dieT == null && md.root.visible && md.used === r3.frame - 1 && e.air === 'ground') { md.dieT = now; md.dieFrom = md.body.rotation.z; }
  if (md && md.dieT != null) {
    const k = (now - md.dieT) / 1.2;
    if (k >= 1 || e.alive) { md.root.visible = false; return; }
    md.used = r3.frame;
    const ease = Math.min(1, k * 2.4), b = md.body;
    b.rotation.z = lerp(md.dieFrom, -Math.PI / 2, ease); b.position.set(-22 * ease, 6 * ease - Math.max(0, k - 0.5) * 24, 0);
    md.mat.transparent = true; md.mat.opacity = Math.min(md.S.alpha || 1, 1 - Math.max(0, (k - 0.45) / 0.55));
    md.ring.visible = md.flash.visible = false;
    if (md.chute) md.chute.visible = false;
    return;
  }
  const show = e.alive && (e.air === 'glide' || (e.air === 'ground' && e.seen && !e.veh));
  if (!show) { if (md) md.root.visible = false; return; }
  if (!md) { md = personModel(e); r3.ents.set(e, md); }
  md.used = r3.frame;
  const { root, body, legs, S } = md;
  root.visible = true;
  // tu personaje (o al que sigues): silueta visible a través de paredes
  const wantSil = e === f;
  if (md.sil !== wantSil) { md.sil = wantSil; root.traverse(n => { if (n.isMesh && n !== md.ring) n.layers.set(wantSil ? 1 : 0); }); }
  if (wantSil) r3.focusMd = md;
  // paso: igual que en 2D, según lo que se ha movido
  const mv = e.lx == null ? 0 : Math.hypot(e.x - e.lx, e.y - e.ly);
  e.lx = e.x; e.ly = e.y;
  if (mv < 40) e.stepP = (e.stepP || 0) + mv * 0.16;
  e.walkA = lerp(e.walkA || 0, mv > 0.4 ? 1 : 0, 0.25);
  root.position.set(e.x, 0, e.y);
  root.rotation.y = -e.ang;
  const g = e.guns[e.slot], W = g ? WEAPONS[g.type] : null;
  let h = 0;
  if (e.air === 'glide') {
    const k = clamp(e.glideT / GLIDE, 0, 1); h = 30 + k * 520;
    body.rotation.set(0, 0, -0.35); body.position.set(0, 0, 0);
    armsFor(md, S, null, 0, 'glide');
    chuteFor(md, e).visible = true;
    md.chuteMat.opacity = e === f ? 0.45 : 1; md.chuteMat.depthWrite = e !== f;
    for (const l of legs) l.rotation.z = 0.5;
    md.arms.position.set(0, 31, 0); md.arms.rotation.z = 0;
  } else {
    if (md.chute) md.chute.visible = false;
    if (e.down) { body.rotation.set(0, 0, -Math.PI / 2); body.position.set(-22, 6, 0); armsFor(md, S, null, 0, 'down'); for (const l of legs) l.rotation.z = 0; md.arms.position.set(0, 31, 0); md.arms.rotation.z = 0; }
    else {
      const kick = Math.max(0, 0.08 - (time - e.lastShot));
      body.rotation.set(0, 0, kick * 1.3); body.position.set(0, inWater(e.x, e.y) ? -6 : 0, 0);
      armsFor(md, S, W, g ? g.tier : 0, 'stand');
      const sw = Math.sin(e.stepP || 0) * 0.65 * (e.walkA || 0);
      legs[0].rotation.z = sw; legs[1].rotation.z = -sw;
      // retroceso (cañón arriba), recarga (arma abajo moviéndose) y curación (brazos bajos + aro verde)
      let rz = 0;
      if (kick > 0) rz = kick * 5;
      else if (e.reloadT > 0) rz = -0.55 + Math.sin(now * 9) * 0.14;
      else if (e.healT > 0) rz = -1.0;
      md.arms.rotation.z = kick > 0 ? rz : lerp(md.arms.rotation.z, rz, 0.3);
      md.arms.position.set(-kick * 45, 31, 0);
      // reacciones: 👋 saludar, 😂 reír, 🔥 bailar, 🆘 saltar pidiendo ayuda
      const ek = time - e.emoT;
      if (e.emo >= 0 && ek >= 0 && ek < 2.4 && kick === 0 && e.reloadT <= 0) {
        const w = now * 10;
        if (e.emo === 0) md.arms.rotation.z = 1.9 + Math.sin(w) * 0.35;
        else if (e.emo === 1) { body.rotation.z = Math.sin(w * 1.3) * 0.14; body.position.y += Math.abs(Math.sin(w)) * 4; md.arms.rotation.z = -0.5; }
        else if (e.emo === 2) {
          body.rotation.x = Math.sin(w * 0.8) * 0.28; body.position.y += Math.abs(Math.sin(w * 0.8)) * 9;
          legs[0].rotation.z = Math.sin(w * 0.8) * 0.8; legs[1].rotation.z = -legs[0].rotation.z; md.arms.rotation.z = 0.8 + Math.sin(w * 1.6) * 0.6;
          root.rotation.y = -e.ang + Math.sin(w * 0.4) * 0.6;
        } else { body.position.y += Math.abs(Math.sin(w * 0.7)) * 14; md.arms.rotation.z = 2.4; }
      }
      if (e.healT > 0) { const r = poolGet('ring'); r.position.set(e.x, 2.2, e.y); r.scale.setScalar(26 + Math.sin(now * 8) * 3); r.material.color.setHex(0x68d391); r.material.opacity = 0.75; }
    }
  }
  root.position.y = h;
  root.scale.setScalar(PS);
  md.flash.visible = !e.down && e.air === 'ground' && time - e.lastShot < 0.05;
  if (md.flash.visible) md.flash.scale.set(9, 5, 5);
  md.mat.emissive.copy(e.hitT > 0 ? WHITE3 : md.glow);
  // aro de color: tú (blanco), amigos (su color), compañeros (verde), derribado (rojo que late)
  const mate = teamsOn() && !e.isPlayer && player && e.team === player.team;
  const rc = e.down ? '#ff465a' : ringOf(e) || (mate ? '#5dffb1' : null);
  md.ring.visible = !!rc && e.air === 'ground';
  if (rc) { md.ring.material.color.copy(col3(rc)); md.ring.material.opacity = e.down ? 0.4 + Math.sin(time * 6) * 0.35 : 0.85; }
}
let WHITE3 = null;

/* ----- Coches, botín, cajas ----- */
function vehModel(v) {
  const b = geoB(), G = G3();
  b.add(G.box, '#1b1b1b', 0, 6, 0, 0, 0, 0, 62, 5, 28);
  b.add(G.box, v.color, 0, 13, 0, 0, 0, 0, 60, 12, 34);
  b.add(G.box, v.color, -5, 21, 0, 0, 0, 0, 30, 4, 32);
  b.add(G.box, '#9fd4f5', -4, 26, 0, 0, 0, 0, 26, 9, 29);
  b.add(G.box, v.color, -5, 31, 0, 0, 0, 0, 22, 2.4, 30);
  b.add(G.box, '#ffffff', 19, 19.3, 0, 0, 0, 0, 20, 0.6, 5);
  for (const z of [-10, 10]) { b.add(G.box, '#ffe9a3', 30.4, 15, z, 0, 0, 0, 1.4, 4, 6); b.add(G.box, '#c62828', -30.4, 15, z, 0, 0, 0, 1.4, 3, 6); }
  for (const [x, z] of [[-18, -16], [18, -16], [-18, 16], [18, 16]]) b.add(G.cyl, '#1b1b1b', x, 8, z, Math.PI / 2, 0, 0, 8, 6, 8);
  const m = new THREE.Mesh(b.build(), r3.vmat); m.castShadow = true;
  r3.dyn.add(m);
  return { m };
}
function lootGeo(it) {
  const key = it.kind === 'gun' ? 'g' + it.gun.type : it.kind;
  let g = r3.lootGeo.get(key);
  if (g) return g;
  const b = geoB(), G = G3();
  if (it.kind === 'gun') {
    const W = WEAPONS[it.gun.type], L = W.len + 8;
    b.add(G.box, '#1c1c1c', 0, 0, 0, 0, 0, 0, L, 5, 4.4); b.add(G.box, W.color, 1, 1.8, 0, 0, 0, 0, L - 2, 2.6, 5);
    b.add(G.box, '#1c1c1c', -L / 2 + 6, -5, 0, 0, 0, 0.3, 3.4, 8, 4);
  } else if (it.kind === 'med') {
    b.add(G.box, '#f5f5f5', 0, 0, 0, 0, 0, 0, 16, 11, 16);
    b.add(G.box, '#e5484d', 0, 5.7, 0, 0, 0, 0, 4, 0.6, 12); b.add(G.box, '#e5484d', 0, 5.7, 0, 0, 0, 0, 12, 0.6, 4);
  } else if (it.kind === 'nade') {
    b.add(G.sph, '#3d5a2a', 0, 0, 0, 0, 0, 0, 7); b.add(G.box, '#9ccc65', 0, 7, 0, 0, 0, 0, 4, 4, 4); b.add(G.box, '#9ccc65', 2.5, 9, 0, 0, 0, 0, 6, 1, 1.5);
  } else if (it.kind === 'wall') {
    b.add(G.box, '#1d4e6b', 0, 0, 0, 0, 0, 0, 18, 12, 6); b.add(G.box, '#50beff', 0, 0, 0, 0, 0, 0, 14, 8, 6.6);
  } else {
    b.add(G.box, '#2b6cb0', 0, 0, 0, 0, 0, 0, 7, 16, 15); b.add(G.box, '#e2f0ff', 0, 1, 0, 0, 0, 0, 7.6, 8, 8);
  }
  g = b.build(); r3.lootGeo.set(key, g);
  return g;
}
function syncLoot() {
  for (const it of loot) {
    // clave por valor: en multijugador el invitado recibe objetos nuevos en cada actualización
    const key = it.kind === 'gun' ? `${it.x}|${it.y}|${it.gun.type}|${it.gun.tier}` : `${it.x}|${it.y}|${it.kind}`;
    let md = r3.loot.get(key);
    if (!md) {
      const m = new THREE.Mesh(lootGeo(it), r3.vmat); m.castShadow = true; m.userData.sharedGeo = true;
      const ring = new THREE.Mesh(r3.G.ring, r3.tierMat[it.kind === 'gun' ? it.gun.tier : 0]);
      ring.position.set(it.x, 1.4, it.y);
      md = { m, ring };
      const tier = it.kind === 'gun' ? it.gun.tier : 0;
      if (tier >= 2) { md.beam = new THREE.Mesh(r3.G.cyl, r3.beamMat[tier]); md.beam.scale.set(4, 150, 4); md.beam.position.set(it.x, 75, it.y); r3.dyn.add(md.beam); }
      r3.dyn.add(m, ring); r3.loot.set(key, md);
    }
    md.used = r3.frame;
    md.m.position.set(it.x, 15 + Math.sin(time * 3 + it.x) * 3, it.y);
    md.m.rotation.y = time * 1.4 + it.y;
    md.m.scale.setScalar(touchMode ? 1.6 : 1.3);
    md.ring.scale.setScalar(18 + Math.sin(time * 4 + it.y) * 2);
  }
}
function boxModel() {
  const b = geoB(), G = G3();
  b.add(G.box, '#8a5a2b', 0, 9, 0, 0, 0, 0, 36, 18, 26); b.add(G.box, '#a8713a', 0, 20, 0, 0, 0, 0, 37, 5, 27);
  for (const x of [-16, 16]) b.add(G.box, '#ffd34d', x, 12, 0, 0, 0, 0, 2.4, 24, 27.6);
  b.add(G.box, '#ffd34d', 18.8, 15, 0, 0, 0, 0, 1.4, 7, 6);
  const m = new THREE.Mesh(b.build(), r3.vmat); m.castShadow = true;
  const ring = new THREE.Mesh(r3.G.ring, r3.tierMat[3]); ring.scale.setScalar(30); ring.position.y = 1.4;
  const g = new THREE.Group(); g.add(m, ring); r3.dyn.add(g);
  return { m: g };
}
function syncMap(map, list, make, place, keyOf = o => o) {
  for (const o of list) {
    const k = keyOf(o);
    let md = map.get(k);
    if (!md) { md = make(o); map.set(k, md); }
    md.used = r3.frame;
    place(md, o);
  }
}
function pruneMap(map) {
  for (const [k, md] of map) {
    if (md.used === r3.frame) continue;
    for (const key of ['root', 'm', 'ring', 'beam']) if (md[key]) { r3.dyn.remove(md[key]); disposeTree(md[key]); }
    map.delete(k);
  }
}

/* ----- Vista previa 3D (tienda y botón de skin) ----- */
function preview3D(cv, i, big, ang = -0.55, keep = false) {
  if (!r3.pv) {
    const r = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), alpha: true, antialias: true });
    r.setPixelRatio(1);
    const sc = new THREE.Scene(), d = new THREE.DirectionalLight(0xffffff, 1.9);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x505060, 1.7)); d.position.set(80, 140, 100); sc.add(d);
    const cam = new THREE.PerspectiveCamera(30, 1, 10, 1000);
    r3.pv = { r, sc, cam, keep: null };
  }
  const P = r3.pv;
  let md = keep && P.keep && P.keep.i === i ? P.keep.md : null;
  if (!md) {
    if (keep) dropKeep();
    md = personModel({ sk: i, av: '' }, P.sc);
    armsFor(md, md.S, big ? WEAPONS.subfusil : null, 0, big ? 'stand' : 'down');
    md.ring.visible = md.flash.visible = false;
    if (keep) P.keep = { i, md };
  }
  md.root.rotation.y = ang;
  P.cam.position.set(big ? 100 : 92, big ? 56 : 48, 0); P.cam.lookAt(0, big ? 31 : 33, 0);
  if (P.r.domElement.width !== cv.width) P.r.setSize(cv.width, cv.height, false);
  P.r.render(P.sc, P.cam);
  const c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.drawImage(P.r.domElement, 0, 0);
  if (!keep) { P.sc.remove(md.root); disposeTree(md.root); }
}
function dropKeep() {
  const P = r3.pv;
  if (P && P.keep) { P.sc.remove(P.keep.md.root); disposeTree(P.keep.md.root); P.keep = null; }
}

/* ----- Proyección pantalla ↔ mundo ----- */
let _v3 = null, _d3 = null;
function w2s(x, y, h = 0) {
  if (!on3D()) return { x: VW / 2 + (x - cam.x) * cam.z, y: VH / 2 + (y - cam.y) * cam.z, ok: true };
  _v3.set(x, h, y).project(r3.cam);
  return { x: (_v3.x + 1) / 2 * VW, y: (1 - _v3.y) / 2 * VH, ok: _v3.z < 1 };
}
function groundAt(sx, sy, h) {
  const c = r3.cam, o = c.position;
  _v3.set(sx / VW * 2 - 1, 1 - sy / VH * 2, 0.5).unproject(c);
  _d3.copy(_v3).sub(o).normalize();
  let t = _d3.y < -1e-4 ? (h - o.y) / _d3.y : 20000;
  if (!(t > 0)) t = 20000;
  return { x: o.x + _d3.x * t, y: o.z + _d3.z * t };
}
// Dibuja con el contexto 2D algo que usa coordenadas del mundo (x, y) en la posición proyectada
function atWorld(x, y, h, fn) {
  const p = w2s(x, y, h);
  if (!p.ok || p.x < -150 || p.x > VW + 150 || p.y < -150 || p.y > VH + 150) return;
  const s = clamp(cam.z * 1.1, 0.75, 1.15);
  ctx.setTransform(DPR * s, 0, 0, DPR * s, DPR * (p.x - x * s), DPR * (p.y - y * s));
  fn();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
function bar3(x, y, k, c) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 18, y - 2.5, 36, 5);
  ctx.fillStyle = c; ctx.fillRect(x - 18, y - 2.5, 36 * clamp(k, 0, 1), 5);
}
const onScreen = p => p.ok && p.x > -60 && p.x < VW + 60 && p.y > -60 && p.y < VH + 60;

/* ----- Fotograma 3D ----- */
function render3D(dt) {
  const { renderer, scene, cam: c3, G } = r3;
  if (!_v3) { _v3 = new THREE.Vector3(); _d3 = new THREE.Vector3(); WHITE3 = new THREE.Color(0.9, 0.9, 0.9); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, VW, VH);
  if (!ents || !ground) return;
  updateCamera(dt);
  if (r3.built !== ground) build3DWorld();
  r3.frame++;
  // FPS: en calidad automática baja (o sube) el detalle según lo que aguante el teléfono
  const now = performance.now(), F = r3.fps;
  if (qualSet === 'auto' && state === 'play' && !paused) {
    const gap = now - (F.last || now); F.last = now;
    if (gap > 250 || !F.t0) { F.n = 0; F.t0 = now; }
    else if (++F.n, now - F.t0 > 3000) {
      const fps = F.n * 1000 / (now - F.t0), i = QORDER.indexOf(r3.q);
      F.n = 0; F.t0 = now;
      if (fps < 40 && i > 0) { applyQuality(QORDER[i - 1]); F.good = 0; }
      else if (fps > 57 && i < QORDER.indexOf(autoQ())) { if (++F.good >= 4) { applyQuality(QORDER[i + 1]); F.good = 0; } }
      else F.good = 0;
    }
  } else F.last = 0;
  const QL = QUALS[r3.q];
  const pr = Math.min(window.devicePixelRatio || 1, QL.pr);
  if (r3.w !== VW || r3.h !== VH || r3.pr !== pr) { r3.w = VW; r3.h = VH; r3.pr = pr; renderer.setPixelRatio(pr); renderer.setSize(VW, VH, false); c3.aspect = VW / VH; c3.updateProjectionMatrix(); }
  const f = state === 'menu' ? null : focusEnt();
  // cámara inclinada que sigue a cam (norte arriba, como en 2D)
  const D = VH / cam.z * (touchMode ? 0.95 : 0.84), sh = shake > 0 ? shake * 14 : 0;
  const tx = cam.x + rand(-sh, sh), tz = cam.y + rand(-sh, sh);
  r3.yaw = lerp(r3.yaw, r3.yawT, Math.min(1, dt * 8 + 0.02));
  const ys = Math.sin(r3.yaw), yc = Math.cos(r3.yaw); // (ys, -yc): dirección del mundo que queda «arriba» en pantalla
  // altura a la que mira: el avión o tu paracaídas, si no el suelo
  const fh = state === 'menu' ? 0 : player.alive && player.air === 'plane' ? 820 : f && f.air === 'glide' ? 70 + clamp(f.glideT / GLIDE, 0, 1) * 520 : 0;
  r3.camH = lerp(r3.camH || 0, fh, Math.min(1, dt * 5));
  c3.position.set(tx - ys * D * Math.cos(PITCH), r3.camH + D * Math.sin(PITCH), tz + yc * D * Math.cos(PITCH));
  c3.lookAt(tx, r3.camH, tz);
  c3.far = D * 6; c3.updateProjectionMatrix();
  wxUpdate();
  const fogK = wx === 'niebla' ? 0.42 : wx === 'polvo' ? 0.5 : wx === 'lluvia' || wx === 'nieve' || wx === 'ceniza' ? 0.8 : 1;
  scene.fog.near = D * 1.5 * fogK; scene.fog.far = D * 3.6 * fogK;
  scene.fog.color.set(wx === 'niebla' ? (TH.night ? '#20242e' : '#a9b2bc') : wx === 'polvo' ? '#c8a070' : TH.bg);
  // relámpagos cuando llueve
  let bolt = 0;
  if (wx === 'lluvia') { r3.boltT -= dt; if (r3.boltT <= 0) { r3.boltT = rand(7, 16); r3.bolt = 0.35; setTimeout(() => { try { noise(0.18 * vol, 120, 1.4); } catch (e) {} }, 500); } }
  if (r3.bolt > 0) { r3.bolt -= dt; bolt = r3.bolt > 0.25 || (r3.bolt < 0.15 && r3.bolt > 0.08) ? 1 : 0; }
  const wl = wx === 'lluvia' ? 0.7 : wx === 'niebla' || wx === 'ceniza' ? 0.85 : wx === 'polvo' ? 0.9 : 1;
  r3.hemi.intensity = (r3.hemiBase || 1.5) * wl * (bolt ? 2.6 : 1); r3.sun.intensity = (r3.sunBase || 2) * (wx === 'claro' ? 1 : wl * 0.85);
  // lluvia / copos alrededor de la cámara
  const rainOn = wx === 'lluvia', flakeOn = wx === 'nieve' || wx === 'ceniza' || wx === 'polvo';
  r3.rain.visible = rainOn; r3.flakes.visible = flakeOn;
  if (rainOn || flakeOn) {
    const B = D * 1.4, n = rainOn ? (QL.fx ? r3.RN : 350) : (QL.fx ? r3.FN : 300), dr = r3.drops;
    const sp = rainOn ? 950 : wx === 'nieve' ? 70 : wx === 'ceniza' ? 45 : 14, wind = wx === 'polvo' ? 380 : rainOn ? 60 : 12;
    const A = (rainOn ? r3.rain : r3.flakes).geometry.attributes.position, P = A.array;
    for (let i = 0; i < n; i++) {
      const d = dr[i];
      d[1] -= sp * dt; d[0] += wind * dt / B + (flakeOn ? Math.sin(now / 900 + d[3]) * dt * 0.02 : 0);
      if (d[1] < 0) { d[1] += 600; d[0] = Math.random() * 2 - 1; d[2] = Math.random() * 2 - 1; }
      if (d[0] > 1) d[0] -= 2;
      const x = tx + d[0] * B, z = tz + d[2] * B - D * 0.2, y = d[1] + r3.camH;
      if (rainOn) { P.set([x, y, z, x - 3, y + 24, z], i * 6); }
      else { P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; }
    }
    (rainOn ? r3.rain : r3.flakes).geometry.setDrawRange(0, rainOn ? n * 2 : n);
    A.needsUpdate = true;
    if (flakeOn) { const m = r3.flakes.material; m.color.set(wx === 'nieve' ? 0xffffff : wx === 'ceniza' ? 0x4a4644 : 0xd8b080); m.size = wx === 'polvo' ? 5 : wx === 'ceniza' ? 5 : 7; }
  }
  const sun = r3.sun, sc = sun.shadow.camera, ext = Math.min(2200, D * 1.25);
  sun.position.set(tx - 500, 1100, tz - 300); sun.target.position.set(tx + ys * D * 0.25, 0, tz - yc * D * 0.25);
  if (Math.abs(sc.right - ext) > 5) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 10; sc.far = 3000; sc.updateProjectionMatrix(); }
  r3.ready = true;

  const fogOn = state !== 'menu' && player.alive && player.air === 'ground';
  for (const e of ents) e.seen = e.alive && e.air === 'ground' && (!fogOn || e === player || e.team === player.team || canSee(player, e));
  // manchas nuevas en el suelo (como mucho 2 baldosas por fotograma)
  let nd = 0;
  for (const i of r3.dirty) { drawTile(r3.tiles[i]); r3.dirty.delete(i); if (++nd >= 2) break; }
  // casas: tejado que desaparece al entrar y paredes transparentes por dentro
  const fb = f && f.air === 'ground' ? f.bld : -1;
  for (let i = 0; i < r3.blds.length; i++) {
    const B = r3.blds[i], b = B.b;
    b.roofA = lerp(b.roofA, i === fb ? 0 : 1, Math.min(1, dt * 8));
    B.roof.visible = b.roofA > 0.02; B.rmat.opacity = b.roofA; B.rmat.depthWrite = b.roofA > 0.98;
    const inside = i === fb;
    if (B.wmat.transparent !== inside) { B.wmat.transparent = inside; B.wmat.opacity = inside ? 0.38 : 1; B.wmat.depthWrite = !inside; B.wmat.needsUpdate = true; }
  }
  // árboles y arbustos transparentes si te tapan
  for (const T of r3.trees) {
    const c = T.c, fade = !!f && (dist(f.x, f.y, c.x, c.y) < c.r * 1.8 || dist(f.x, f.y, c.x + ys * 45, c.y - yc * 45) < c.r * 1.7);
    T.m.material = fade ? r3.treeFade : r3.treeMat;
  }
  for (const Bu of r3.bushes) Bu.m.material = f && dist(Bu.bu.x, Bu.bu.y, f.x, f.y) < Bu.bu.r ? r3.bushFade : r3.bushMat;
  // cajas de madera
  let n = 0;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sv = new THREE.Vector3(), C = new THREE.Color();
  for (const q of rects) {
    if (q.kind === 'wall' || n >= 300) continue;
    M.compose(V.set(q.x + q.w / 2, 20, q.y + q.h / 2), Q.identity(), Sv.set(q.w, 40, q.h));
    r3.crates.setMatrixAt(n, M);
    r3.crates.setColorAt(n, C.setScalar(q.hp < CRATE_HP * 0.6 ? 0.62 : 1));
    n++;
  }
  r3.crates.count = n; r3.crates.instanceMatrix.needsUpdate = true; if (r3.crates.instanceColor) r3.crates.instanceColor.needsUpdate = true;
  // personajes
  poolsBegin();
  r3.focusMd = null;
  for (const e of ents) syncEnt(e, f, dt);
  pruneEnts();
  // coches
  syncMap(r3.vehs, vehicles, vehModel, (md, v) => {
    md.m.visible = !v.driver || v.driver.seen;
    md.m.position.set(v.x, 0, v.y); md.m.rotation.y = -v.ang;
  });
  pruneMap(r3.vehs);
  syncLoot(); pruneMap(r3.loot);
  syncMap(r3.boxes, boxes, boxModel, (md, b) => { md.m.position.set(b.x, 0, b.y); }, b => b.id);
  pruneMap(r3.boxes);
  // paredes desplegables
  syncMap(r3.shields, shields, () => {
    const m = new THREE.Mesh(G.box, new THREE.MeshLambertMaterial({ color: 0x50beff, emissive: 0x15506e, transparent: true, depthWrite: false }));
    m.castShadow = true; r3.dyn.add(m); return { m };
  }, (md, s) => {
    const k = clamp(s.hp / s.max, 0.25, 1), fade = net.role === 'client' ? 1 : Math.min(1, s.t / 3 + 0.3);
    md.m.position.set(s.x, 26, s.y); md.m.rotation.y = -s.ang; md.m.scale.set(12, 52, WALL_LEN + 26);
    md.m.material.opacity = (0.5 + 0.4 * k) * fade;
  }, s => s.id);
  pruneMap(r3.shields);
  // balas
  let nb = 0, nr = 0;
  for (const b of bullets) {
    const a = Math.atan2(b.vy, b.vx), sp = Math.hypot(b.vx, b.vy);
    Q.setFromAxisAngle(V.set(0, 1, 0), -a);
    if (b.rk) {
      if (nr >= 60) continue;
      M.compose(V.set(b.x, 29 * PS, b.y), Q, Sv.set(18, 7, 7)); r3.rk.setMatrixAt(nr++, M);
    } else {
      if (nb >= 900) continue;
      const L = sp * 0.024;
      M.compose(V.set(b.x - Math.cos(a) * L / 2, 29 * PS, b.y - Math.sin(a) * L / 2), Q, Sv.set(L, 3.2, 3.2)); r3.bul.setMatrixAt(nb++, M);
    }
  }
  r3.bul.count = nb; r3.bul.instanceMatrix.needsUpdate = true;
  r3.rk.count = nr; r3.rk.instanceMatrix.needsUpdate = true;
  // partículas
  const pa = r3.parts.geometry.attributes, pp = pa.position.array, pc = pa.pcol.array, ps = pa.psize.array;
  const pal = pa.palpha.array;
  let np = 0;
  for (const p of particles) {
    if (np >= r3.PMAX) break;
    const k = Math.max(0, p.life / p.max), cs = colS(p.color);
    pp[np * 3] = p.x; pp[np * 3 + 1] = 8 + (1 - k) * 10; pp[np * 3 + 2] = p.y;
    pc[np * 3] = cs[0]; pc[np * 3 + 1] = cs[1]; pc[np * 3 + 2] = cs[2];
    ps[np] = p.size * 1.6 * (0.35 + 0.65 * k); pal[np] = 0.95; np++;
  }
  // humo: explosiones y coches muy dañados
  const SM = r3.smoke;
  for (const b of blasts) if (!b._sm) {
    b._sm = 1;
    for (let i = 0; i < (QL.fx ? 16 : 6); i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(10, 70);
      SM.push({ x: b.x + Math.cos(a) * 20, y: b.y + Math.sin(a) * 20, h: rand(10, 40), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: rand(25, 65), life: rand(1.4, 2.4), max: 2.4, size: rand(28, 46), c: Math.random() < 0.5 ? [0.3, 0.28, 0.27] : [0.46, 0.44, 0.42] });
    }
  }
  if (QL.fx) for (const v of vehicles) if (v.hp < VEH_HP * 0.4 && (!v.driver || v.driver.seen) && Math.random() < dt * 10)
    SM.push({ x: v.x + Math.cos(v.ang) * 22, y: v.y + Math.sin(v.ang) * 22, h: 22, vx: rand(-8, 8), vy: rand(-8, 8), vh: rand(30, 50), life: 1.6, max: 1.6, size: rand(14, 22), c: [0.2, 0.2, 0.22] });
  for (let i = SM.length - 1; i >= 0; i--) {
    const m = SM[i];
    m.life -= dt;
    if (m.life <= 0) { SM.splice(i, 1); continue; }
    m.x += m.vx * dt; m.y += m.vy * dt; m.h += m.vh * dt; m.vx *= 0.97; m.vy *= 0.97; m.size += dt * 16;
  }
  if (SM.length > 400) SM.splice(0, SM.length - 400);
  for (const m of SM) {
    if (np >= r3.PMAX) break;
    pp[np * 3] = m.x; pp[np * 3 + 1] = m.h; pp[np * 3 + 2] = m.y;
    pc[np * 3] = m.c[0]; pc[np * 3 + 1] = m.c[1]; pc[np * 3 + 2] = m.c[2];
    ps[np] = m.size; pal[np] = 0.55 * Math.min(1, m.life / m.max * 1.6); np++;
  }
  r3.parts.geometry.setDrawRange(0, np);
  pa.position.needsUpdate = pa.pcol.needsUpdate = pa.psize.needsUpdate = pa.palpha.needsUpdate = true;
  r3.pmat.uniforms.scale.value = renderer.domElement.height / 2 * c3.projectionMatrix.elements[5];
  // granadas, explosiones, suministros
  for (const nd of nades) {
    const zz = Math.sin(Math.PI * Math.min(1, nd.age / NADE_FLY));
    const m = poolGet('nade'); m.position.set(nd.x, 8 + zz * 60, nd.y);
    m.material.emissive.setHex(NADE_FUSE - nd.age < 0.8 && Math.floor(nd.age * 12) % 2 === 0 ? 0xff2020 : 0);
    if (NADE_FUSE - nd.age < 1) { const r = poolGet('ring'); r.position.set(nd.x, 1.6, nd.y); r.scale.setScalar(NADE_R); r.material.color.setHex(0xff503c); r.material.opacity = 0.55; }
  }
  for (const b of blasts) {
    const k = 1 - b.t / 0.45, m = poolGet('blast');
    m.position.set(b.x, 10, b.y); m.scale.set(NADE_R * (0.3 + 0.7 * k), NADE_R * (0.2 + 0.5 * k), NADE_R * (0.3 + 0.7 * k)); m.material.opacity = 0.55 * (1 - k);
  }
  for (const d of drops) {
    const k = 1 - d.t / DROP_FALL, m = poolGet('drop');
    m.position.set(d.x, (1 - k) * 700, d.y); m.rotation.y = time * 0.6;
    const r = poolGet('ring'); r.position.set(d.x, 1.6, d.y); r.scale.setScalar(36 + Math.sin(time * 6) * 4); r.material.color.setHex(0xff5050); r.material.opacity = 0.85;
  }
  // luces de explosiones y fogonazos (2 luces reutilizables)
  const lights = [];
  if (QL.fx) {
    for (const b of blasts) lights.push({ x: b.x, y: b.y, h: 60, c: 0xff9a40, i: 6 * (b.t / 0.45), d: -1 });
    for (const e of ents) if (e.seen && !e.veh && !e.down && time - e.lastShot < 0.06)
      lights.push({ x: e.x + Math.cos(e.ang) * 40, y: e.y + Math.sin(e.ang) * 40, h: 45, c: 0xffd27a, i: 2.4, d: dist(e.x, e.y, cam.x, cam.y) });
    lights.sort((a, b) => a.d - b.d);
  }
  r3.pls.forEach((l, i) => { const L = lights[i]; if (!L) { l.intensity = 0; return; } l.position.set(L.x, L.h, L.y); l.color.setHex(L.c); l.intensity = L.i; });
  // noche: tu linterna (o los faros del coche) y conos de luz de los demás
  if (TH.night) {
    const src = f && f.air === 'ground' ? f : null;
    if (src) {
      const a = src.ang, v = src.veh, o = v ? 30 : 12;
      r3.flash.position.set(src.x + Math.cos(a) * o, v ? 22 : 50, src.y + Math.sin(a) * o);
      r3.flash.target.position.set(src.x + Math.cos(a) * 340, 0, src.y + Math.sin(a) * 340);
      r3.flash.angle = v ? 0.7 : 0.5; r3.flash.intensity = 3.6;
      r3.aura.position.set(src.x, 80, src.y); r3.aura.intensity = 1.1;
    } else { r3.flash.intensity = 0; r3.aura.position.set(cam.x, 120, cam.y); r3.aura.intensity = 0.8; }
    for (const e of ents) {
      if (e === src || !e.seen || e.veh || e.down) continue;
      const m = poolGet('beam'); m.position.set(e.x, 2.4, e.y); m.rotation.y = -e.ang; m.scale.setScalar(280);
    }
    for (const v of vehicles) {
      if (!v.driver || !v.driver.seen || v.driver === src) continue;
      const m = poolGet('beam'); m.position.set(v.x + Math.cos(v.ang) * 28, 2.4, v.y + Math.sin(v.ang) * 28); m.rotation.y = -v.ang; m.scale.setScalar(360);
    }
  }
  if (r3.wmat) r3.wmat.uniforms.t.value = now / 1000;
  poolsEnd();
  // avión
  r3.plane.visible = state !== 'menu' && plane && plane.t <= plane.dur + 4;
  if (r3.plane.visible) { r3.plane.position.set(plane.x, 820, plane.y); r3.plane.rotation.set(0, -plane.ang, Math.sin(time * 1.3) * 0.04); }
  // zona
  r3.zmat.uniforms.zc.value.set(zone.x, zone.y); r3.zmat.uniforms.zr.value = Math.max(0.1, zone.r);
  r3.zmat.uniforms.tc.value.set(zone.tx, zone.ty); r3.zmat.uniforms.tr.value = Math.max(0.1, zone.tr);
  r3.zmat.uniforms.st.value = zone.state !== 'done' ? 1 : 0;
  r3.zwall.position.set(zone.x, 450, zone.y); r3.zwall.scale.set(Math.max(1, zone.r), 900, Math.max(1, zone.r));
  r3.zwall.material.opacity = 0.16 + Math.sin(time * 3) * 0.04;
  // niebla de guerra
  r3.fog.visible = fogOn;
  if (fogOn) {
    const maxD = D * 2.2;
    visPoly = computeVis(player.x, player.y, maxD);
    const N = visPoly.length / 2, fa = r3.fog.geometry.attributes.position, A = fa.array, ox = player.x, oy = player.y, FAR = 9000, Y = 1.8;
    let w = 0;
    for (let i = 0; i < N && i < 600; i++) {
      const j = (i + 1) % N;
      const ax = visPoly[2 * i], ay = visPoly[2 * i + 1], bx = visPoly[2 * j], by = visPoly[2 * j + 1];
      const a1 = i / N * Math.PI * 2, a2 = j / N * Math.PI * 2;
      const fx1 = ox + Math.cos(a1) * FAR, fy1 = oy + Math.sin(a1) * FAR, fx2 = ox + Math.cos(a2) * FAR, fy2 = oy + Math.sin(a2) * FAR;
      A.set([ax, Y, ay, fx2, Y, fy2, fx1, Y, fy1, ax, Y, ay, bx, Y, by, fx2, Y, fy2], w); w += 18;
    }
    r3.fog.geometry.setDrawRange(0, w / 3); fa.needsUpdate = true;
  }
  renderer.render(scene, c3);
  if (r3.focusMd && r3.focusMd.root.visible) {
    const bg = scene.background;
    scene.background = null; renderer.autoClear = false; renderer.shadowMap.autoUpdate = false;
    c3.layers.set(1);
    scene.overrideMaterial = r3.silMat; renderer.render(scene, c3); // solo lo que está tapado
    scene.overrideMaterial = null; renderer.render(scene, c3);       // el personaje normal encima
    c3.layers.set(0); renderer.autoClear = true; renderer.shadowMap.autoUpdate = true; scene.background = bg;
  }

  // ---- textos y marcadores encima (lienzo 2D) ----
  const near = [], cx0 = f ? f.x : cam.x, cy0 = f ? f.y : cam.y;
  for (const it of loot) {
    if (it.kind !== 'gun') continue;
    const d = dist(cx0, cy0, it.x, it.y);
    if (d > 520) continue;
    const bi = buildingAt(it.x, it.y); if (bi >= 0 && buildings[bi].roofA > 0.5) continue; // bajo un tejado no se ve
    near.push([d, it]);
  }
  near.sort((a, b) => a[0] - b[0]);
  for (const [, it] of near.slice(0, 6)) {
    const p = w2s(it.x, it.y, 40);
    if (onScreen(p)) txt(WEAPONS[it.gun.type].name, p.x, p.y, touchMode ? 12 : 11, TIERS[it.gun.tier].color, 'center', 800);
  }
  for (const b of boxes) { const p = w2s(b.x, b.y, 34); if (onScreen(p)) txt(`📦 ${b.name}`, p.x, p.y, 11, '#ffe9a3', 'center', 700); }
  for (const v of vehicles) {
    if (v.driver && !v.driver.seen) continue;
    const p = w2s(v.x, v.y, 40);
    if (!onScreen(p)) continue;
    if (v.hp < VEH_HP) bar3(p.x, p.y, v.hp / VEH_HP, v.hp > VEH_HP * 0.4 ? '#9ae6b4' : '#f6ad55');
    const d = v.driver;
    if (d && d !== player && (d.human || (teamsOn() && d.team === player.team)))
      txt(d.name, p.x, p.y - 12, 12, d.team === player.team && teamsOn() ? '#5dffb1' : d.color, 'center', 800);
  }
  if (state !== 'menu') for (const e of ents) {
    if (!e.alive || e.air === 'plane') continue;
    if (e.air === 'glide') {
      const p = w2s(e.x, e.y, 30 + clamp(e.glideT / GLIDE, 0, 1) * 520 + 118 * PS);
      if (!onScreen(p)) continue;
      if (e.isPlayer) txt('Tú', p.x, p.y, 14, '#ffd34d', 'center', 800);
      else if (teamsOn() && player && e.team === player.team) txt('🤝 ' + e.name, p.x, p.y, 13, '#5dffb1', 'center', 800);
      else if (e.human) txt(e.name, p.x, p.y, 13, e.color, 'center', 800);
      continue;
    }
    if (!e.seen || e.veh) continue;
    const p = w2s(e.x, e.y, e.down ? 22 * PS : 60 * PS);
    if (!onScreen(p)) continue;
    const mine = player && e.team === player.team, mate = teamsOn() && !e.isPlayer && mine;
    if (e.down) {
      bar3(p.x, p.y, e.hp / 100, '#fc8181');
      if (e.rev > 0) bar3(p.x, p.y - 7, Math.min(1, e.rev), '#5dffb1');
      txt(`🩸 ${e.isPlayer ? 'Tú' : e.name}`, p.x, p.y - 18, 12, mine ? '#5dffb1' : '#ff8fa3', 'center', 800);
      continue;
    }
    let y = p.y;
    if (!e.isPlayer && (time - e.lastHurt < 3 || mate)) {
      bar3(p.x, y, e.hp / 100, e.hp > 50 ? '#68d391' : e.hp > 25 ? '#f6ad55' : '#fc8181'); y -= 7;
      if (e.armor > 0) { bar3(p.x, y, e.armor / 100, '#63b3ed'); y -= 7; }
    }
    if (e.healT > 0) { bar3(p.x, y, 1 - e.healT / healDur(e), '#68d391'); y -= 7; }
    if (mate) txt(e.name, p.x, y - 8, 12, '#5dffb1', 'center', 800);
    else if (e.human && !e.isPlayer) txt(e.name, p.x, y - 8, 12, e.color, 'center', 800);
  }
  if (state !== 'menu') {
    for (const e of activePings()) atWorld(e.ping.x, e.ping.y, 0, () => drawPing(e));
    for (const e of ents) {
      if (!e.alive || time - e.emoT > 2.6 || (e.air === 'ground' && !e.seen) || e.air === 'plane') continue;
      const h = e.air === 'glide' ? 30 + clamp(e.glideT / GLIDE, 0, 1) * 520 + 100 * PS : 40 * PS;
      atWorld(e.x, e.y, h, () => drawEmo(e));
    }
  }
  for (const fl of floats) {
    const p = w2s(fl.x, fl.y + 26, 52 * PS);
    if (!onScreen(p)) continue;
    ctx.globalAlpha = Math.min(1, fl.t * 2);
    const s = 1 + Math.max(0, fl.t - 0.85) * 3;
    ctx.font = `800 ${Math.round(17 * s)}px system-ui, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(Math.round(fl.v), p.x, p.y);
    ctx.fillStyle = fl.armor ? '#90cdf4' : '#ffffff'; ctx.fillText(Math.round(fl.v), p.x, p.y);
  }
  ctx.globalAlpha = 1;
  drawHUD();
}
function pruneEnts() {
  for (const [e, md] of r3.ents) {
    if (md.used === r3.frame) continue;
    if (ents.includes(e) && e.alive) { md.root.visible = false; continue; }
    r3.dyn.remove(md.root); disposeTree(md.root); r3.ents.delete(e);
  }
}
