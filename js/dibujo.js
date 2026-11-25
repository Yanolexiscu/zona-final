'use strict';
// Zona Final · Dibujo 2D (vista desde arriba): personas, objetos y fotograma 2D
// (los archivos comparten variables globales y se cargan en orden desde index.html)
/* ---------- Dibujo ---------- */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}
function txt(s, x, y, size = 15, color = '#eef0ff', align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px system-ui, "Segoe UI", sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 4;
  ctx.fillText(s, x, y);
  ctx.shadowBlur = 0;
}
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function drawLoot(it) {
  ctx.save(); ctx.translate(it.x, it.y);
  const pulse = 1 + Math.sin(time * 4 + it.x) * 0.07;
  ctx.scale(pulse, pulse);
  if (it.kind === 'gun') {
    const W = WEAPONS[it.gun.type], tc = TIERS[it.gun.tier].color;
    if (it.gun.tier > 0) {
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
      g.addColorStop(0, tc + '88'); g.addColorStop(1, tc + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
    ctx.strokeStyle = tc; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = W.color; ctx.fillRect(-10, -3, 20, 6); ctx.fillRect(-10, 1, 5, 7);
    ctx.restore();
    txt(W.name, it.x, it.y - 25, 11, tc, 'center', 700);
    return;
  }
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2);
  if (it.kind === 'med') {
    ctx.fillStyle = '#f5f5f5'; ctx.fill();
    ctx.fillStyle = '#e5484d'; ctx.fillRect(-3, -9, 6, 18); ctx.fillRect(-9, -3, 18, 6);
  } else if (it.kind === 'nade') {
    ctx.fillStyle = '#3d5a2a'; ctx.fill(); ctx.strokeStyle = '#9ccc65'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 2, 6, 0, Math.PI * 2); ctx.fillStyle = '#6b8f45'; ctx.fill();
    ctx.fillStyle = '#9ccc65'; ctx.fillRect(-3, -10, 6, 5);
  } else if (it.kind === 'wall') {
    ctx.fillStyle = '#1d4e6b'; ctx.fill(); ctx.strokeStyle = '#9be7ff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineCap = 'round'; ctx.strokeStyle = '#50beff'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-7, 4); ctx.lineTo(7, -4); ctx.stroke(); ctx.lineCap = 'butt';
  } else {
    ctx.fillStyle = '#2b6cb0'; ctx.fill(); ctx.strokeStyle = '#90cdf4'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, -4); ctx.lineTo(6, 4); ctx.lineTo(0, 9); ctx.lineTo(-6, 4); ctx.lineTo(-7, -4); ctx.closePath();
    ctx.fillStyle = '#e2f0ff'; ctx.fill();
  }
  ctx.restore();
}
/* ---------- Personas (vista desde arriba) ---------- */
// c: contexto; sk: skin; (x, y) centro; ang: hacia dónde mira.
// o: { W: arma, tier, rc: retroceso, flash, hit, av: foto, ring: color del contorno, pose: 'lying' | 'glide' }
function drawPerson(c, sk, x, y, ang, o = {}) {
  const S = SKINS[sk] || SKINS[0], dark = 'rgba(0,0,0,.5)';
  c.save(); c.translate(x, y); c.rotate(ang);
  if (o.sc) c.scale(o.sc, o.sc);
  if (S.alpha) c.globalAlpha *= S.alpha;
  c.lineCap = 'round'; c.lineJoin = 'round';
  // mochila
  if (S.cape && !o.pose) { // capa por detrás
    c.fillStyle = S.cape; c.beginPath(); c.moveTo(-3, -13); c.quadraticCurveTo(-22, -16, -24, 0); c.quadraticCurveTo(-22, 16, -3, 13); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.4; c.stroke();
  }
  if (S.pack) { c.fillStyle = S.pack; c.beginPath(); c.ellipse(-10, 0, 5, 9, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = dark; c.lineWidth = 1.5; c.stroke(); }
  // pies: se mueven al caminar (o.step = fase del paso, o.walk = 0..1)
  if (!o.pose) {
    const sw = Math.sin(o.step || 0) * 10 * (o.walk || 0);
    c.fillStyle = S.shoe || '#22252b';
    for (const [fx, fy] of [[sw, 6.5], [-sw, -6.5]]) { c.beginPath(); c.ellipse(fx, fy, 5, 3.4, 0, 0, Math.PI * 2); c.fill(); }
  }
  // brillo neón
  if (S.glow && !o.hit) { c.shadowColor = S.glow; c.shadowBlur = 12; }
  // torso (hombros)
  c.beginPath(); c.ellipse(-2, 0, 8.5, 14, 0, 0, Math.PI * 2);
  c.fillStyle = o.hit ? '#ffffff' : S.shirt; c.fill();
  c.shadowBlur = 0;
  if (!o.hit && S.pat) { c.save(); c.clip(); skinPattern(c, S); c.restore(); }
  c.lineWidth = o.ring ? 2.5 : 1.8; c.strokeStyle = o.ring || dark; c.stroke();
  // arma y manos
  let h1 = [11, 8], h2 = [11, -8];
  if (o.pose === 'lying') { h1 = [3, 18]; h2 = [3, -18]; }
  else if (o.pose === 'glide') { h1 = [9, 13]; h2 = [9, -13]; }
  else if (o.W) {
    const L = o.W.len, rc = o.rc || 0;
    c.fillStyle = '#1c1c1c'; c.fillRect(8 - rc, -4, L + 6, 8);
    c.fillStyle = o.W.color; c.fillRect(9 - rc, -2.5, L + 4, 5);
    if (o.tier > 0) { c.fillStyle = TIERS[o.tier].color; c.fillRect(9 - rc, -2.5, 4, 5); }
    if (o.flash) {
      const mx = 14 + L - rc;
      c.fillStyle = '#ffe27a'; c.beginPath(); c.moveTo(mx, -5); c.lineTo(mx + 16, 0); c.lineTo(mx, 5); c.lineTo(mx + 5, 0); c.closePath(); c.fill();
    }
    h1 = [12 - rc, 5]; h2 = [16 + L * 0.45 - rc, -1];
  }
  // brazos (manga) y manos
  c.strokeStyle = o.hit ? '#ffffff' : S.sleeve || S.shirt; c.lineWidth = 5.5;
  c.beginPath(); c.moveTo(-1, 11); c.lineTo(h1[0], h1[1]); c.moveTo(-1, -11); c.lineTo(h2[0], h2[1]); c.stroke();
  c.strokeStyle = dark; c.lineWidth = 1.2;
  for (const h of [h1, h2]) { c.beginPath(); c.arc(h[0], h[1], 3.6, 0, Math.PI * 2); c.fillStyle = S.glove || S.skin; c.fill(); c.stroke(); }
  // cabeza
  drawHead(c, S, o.av, o.hit);
  c.restore();
}
function drawHead(c, S, av, hit) {
  const R = 8.5, im = av ? avImg(av) : null;
  if (im) { // con foto de perfil: la foto es la cara
    c.save(); c.beginPath(); c.arc(0, 0, R + 1, 0, Math.PI * 2); c.clip();
    c.rotate(Math.PI / 2); c.drawImage(im, -R - 1, -R - 1, R * 2 + 2, R * 2 + 2); c.restore();
    c.beginPath(); c.arc(0, 0, R + 1, 0, Math.PI * 2); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
    return;
  }
  const ring = () => { c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1.3; c.stroke(); };
  c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fillStyle = hit ? '#fff' : S.skin; c.fill(); ring();
  if (hit) return;
  const hair = () => { c.beginPath(); c.arc(-1.8, 0, R - 0.6, 0, Math.PI * 2); c.fillStyle = S.hair || '#222'; c.fill(); };
  switch (S.hat) {
    case 'hair': hair(); break;
    case 'cap':
      hair();
      c.beginPath(); c.arc(-1, 0, R - 0.8, 0, Math.PI * 2); c.fillStyle = S.hatC; c.fill(); ring();
      c.beginPath(); c.ellipse(6.5, 0, 4.5, 6.5, 0, -Math.PI / 2, Math.PI / 2); c.fill(); ring();
      break;
    case 'hood':
      c.beginPath(); c.arc(-2.5, 0, R + 1.5, Math.PI * 0.32, Math.PI * 1.68); c.closePath(); c.fillStyle = S.hatC; c.fill(); ring();
      if (S.band) { c.strokeStyle = S.band; c.lineWidth = 2.5; c.beginPath(); c.moveTo(3, -7); c.lineTo(3, 7); c.stroke(); c.beginPath(); c.moveTo(-9, 1); c.lineTo(-15, 4); c.moveTo(-9, -1); c.lineTo(-15, -3); c.stroke(); }
      break;
    case 'helmet':
      c.beginPath(); c.arc(0, 0, R + 1.2, 0, Math.PI * 2); c.fillStyle = S.hatC; c.fill(); ring();
      if (S.visor) { c.beginPath(); c.ellipse(4.5, 0, 3.6, 6.5, 0, 0, Math.PI * 2); c.fillStyle = S.visor; c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(4, -4, 1.5, 3); }
      else { c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.arc(-2, -2, 4, 0, Math.PI * 2); c.fill(); }
      break;
    case 'robot':
      c.fillStyle = S.hatC; c.fillRect(-R, -R, R * 2, R * 2); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1.3; c.strokeRect(-R, -R, R * 2, R * 2);
      c.shadowColor = '#ff3b3b'; c.shadowBlur = 8; c.fillStyle = '#ff3b3b'; c.fillRect(4, -5, 3, 10); c.shadowBlur = 0;
      c.strokeStyle = '#5d6878'; c.beginPath(); c.moveTo(-3, 0); c.lineTo(-12, 0); c.stroke();
      c.beginPath(); c.arc(-12, 0, 2, 0, Math.PI * 2); c.fillStyle = '#ff3b3b'; c.fill();
      break;
    case 'bandana':
      hair();
      c.beginPath(); c.arc(-1.5, 0, R - 1.2, Math.PI * 0.35, Math.PI * 1.65); c.closePath(); c.fillStyle = S.hatC; c.fill();
      c.fillStyle = '#fff'; for (const [dx, dy] of [[-4, -3], [-2, 3], [-6, 2]]) { c.beginPath(); c.arc(dx, dy, 1, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = S.hatC; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-8, 0); c.lineTo(-14, 3); c.moveTo(-8, 0); c.lineTo(-13, -3); c.stroke();
      break;
    case 'mohawk':
      c.shadowColor = S.glow || S.hair; c.shadowBlur = 8;
      c.strokeStyle = S.hair; c.lineWidth = 4; c.beginPath(); c.moveTo(-8, 0); c.lineTo(5, 0); c.stroke();
      c.shadowBlur = 0;
      break;
    case 'cowboy': case 'safari': // sombrero de ala ancha
      c.beginPath(); c.ellipse(-1, 0, R + 5, R + 6, 0, 0, Math.PI * 2); c.fillStyle = S.hatC; c.fill(); ring();
      c.beginPath(); c.ellipse(-1, 0, R - 2, R - 1.5, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill();
      c.strokeStyle = S.hat === 'cowboy' ? '#2a1a0e' : '#8a6d3a'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(-1, 0, R - 2, R - 1.5, 0, 0, Math.PI * 2); c.stroke();
      break;
    case 'chef':
      for (const [dx, dy] of [[-3, -4], [-3, 4], [2, 0], [-6, 0]]) { c.beginPath(); c.arc(dx, dy, 5.5, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); ring(); }
      c.beginPath(); c.arc(-2, 0, 5, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
      break;
    case 'knight':
      c.beginPath(); c.arc(0, 0, R + 1.5, 0, Math.PI * 2); c.fillStyle = S.hatC; c.fill(); ring();
      c.fillStyle = '#1d2128'; c.fillRect(4, -5, 2.5, 10);
      c.strokeStyle = '#e5484d'; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, 0); c.lineTo(2, 0); c.stroke();
      break;
    case 'horns':
      hair();
      c.beginPath(); c.arc(-0.5, 0, R - 0.5, 0, Math.PI * 2); c.fillStyle = S.hatC; c.fill(); ring();
      c.fillStyle = '#f2ead3';
      for (const sgn of [1, -1]) { c.beginPath(); c.moveTo(-2, sgn * 6); c.quadraticCurveTo(2, sgn * 15, 8, sgn * 15); c.lineTo(1, sgn * 7); c.closePath(); c.fill(); ring(); }
      break;
    case 'wizard':
      c.beginPath(); c.arc(-1, 0, R + 4, 0, Math.PI * 2); c.fillStyle = S.hatC; c.fill(); ring();
      c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 2.5 : 6; c.lineTo(-1 + Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fillStyle = '#ffd34d'; c.fill();
      break;
    case 'ears':
      c.beginPath(); c.arc(-1.5, 0, R + 0.5, Math.PI * 0.3, Math.PI * 1.7); c.closePath(); c.fillStyle = S.hatC; c.fill(); ring();
      for (const sgn of [1, -1]) { c.beginPath(); c.moveTo(0, sgn * 4); c.lineTo(-2, sgn * 13); c.lineTo(-7, sgn * 6); c.closePath(); c.fillStyle = S.hatC; c.fill(); ring();
        c.beginPath(); c.moveTo(-1, sgn * 6); c.lineTo(-2.5, sgn * 10.5); c.lineTo(-5, sgn * 7); c.closePath(); c.fillStyle = '#ffb3c1'; c.fill(); }
      break;
    case 'spikes':
      c.fillStyle = S.spikeC || '#ffd34d';
      for (let k = 0; k < 4; k++) { const x = -4 - k * 4.5; c.beginPath(); c.moveTo(x + 2.5, -2.5); c.lineTo(x - 2, 0); c.lineTo(x + 2.5, 2.5); c.closePath(); c.fill(); }
      c.beginPath(); c.arc(-1, 0, R + 0.5, Math.PI * 0.28, Math.PI * 1.72); c.closePath(); c.fillStyle = S.hatC; c.fill(); ring();
      c.fillStyle = '#fff'; for (const sgn of [1, -1]) { c.beginPath(); c.arc(4, sgn * 6, 2, 0, Math.PI * 2); c.fill(); }
      break;
    case 'kabuto':
      c.beginPath(); c.arc(0, 0, R + 1.5, 0, Math.PI * 2); c.fillStyle = S.hatC; c.fill(); ring();
      c.strokeStyle = '#c9a227'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(6, -9); c.quadraticCurveTo(2, 0, 6, 9); c.stroke();
      c.strokeStyle = '#8e1b1b'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, R - 2, Math.PI * 0.6, Math.PI * 1.4); c.stroke();
      break;
    case 'skull':
      c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fillStyle = '#ececec'; c.fill(); ring();
      c.fillStyle = '#141414'; for (const sgn of [1, -1]) { c.beginPath(); c.arc(3.5, sgn * 3.2, 2.2, 0, Math.PI * 2); c.fill(); }
      c.fillRect(6.5, -1, 1.5, 2);
      break;
    case 'ghost':
      c.beginPath(); c.arc(0, 0, R + 0.5, 0, Math.PI * 2); c.fillStyle = '#f4f6ff'; c.fill();
      c.fillStyle = '#2a2f5a'; for (const sgn of [1, -1]) { c.beginPath(); c.ellipse(3.5, sgn * 3, 1.6, 2.4, 0, 0, Math.PI * 2); c.fill(); }
      break;
    case 'melon': { // cabeza de sandía con gafas de sol
      c.beginPath(); c.arc(0, 0, R + 2, 0, Math.PI * 2); c.fillStyle = '#2e8b3e'; c.fill(); ring();
      c.strokeStyle = '#1b5e28'; c.lineWidth = 2; c.beginPath();
      for (const k of [-6, -2, 2, 6]) { c.moveTo(-R, k); c.quadraticCurveTo(0, k * 1.35, R, k); }
      c.stroke();
      c.fillStyle = '#111'; for (const sgn of [1, -1]) { c.beginPath(); c.ellipse(6, sgn * 3.6, 2.4, 3, 0, 0, Math.PI * 2); c.fill(); }
      c.fillRect(5.2, -1, 1.6, 2);
      break;
    }
    case 'stone': // cabeza de piedra con grietas
      c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fillStyle = '#b4bac0'; c.fill(); ring();
      c.strokeStyle = 'rgba(60,64,70,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-6, -4); c.lineTo(-1, -1); c.lineTo(-3, 4); c.moveTo(-1, -1); c.lineTo(4, -5); c.stroke();
      c.fillStyle = '#e8f6ff'; for (const sgn of [1, -1]) { c.beginPath(); c.arc(4.5, sgn * 3, 1.3, 0, Math.PI * 2); c.fill(); }
      break;
    case 'shark': // capucha de tiburón: aleta arriba y dientes delante
      c.beginPath(); c.arc(-1, 0, R + 2, 0, Math.PI * 2); c.fillStyle = S.hatC; c.fill(); ring();
      c.beginPath(); c.arc(2.5, 0, R - 3, -Math.PI / 2, Math.PI / 2); c.fillStyle = S.skin; c.fill();
      c.fillStyle = '#fff'; for (let k = -5; k <= 5; k += 2.5) { c.beginPath(); c.moveTo(6.5, k - 1.2); c.lineTo(9.5, k); c.lineTo(6.5, k + 1.2); c.closePath(); c.fill(); }
      c.beginPath(); c.moveTo(-11, -1.5); c.lineTo(-3, 0); c.lineTo(-11, 1.5); c.quadraticCurveTo(-15, 0, -11, -1.5); c.fillStyle = '#356a9e'; c.fill();
      break;
    case 'pumpkin': { // calabaza con ojos que brillan
      c.beginPath(); c.ellipse(0, 0, R + 1, R + 2.5, 0, 0, Math.PI * 2); c.fillStyle = S.hatC; c.fill(); ring();
      c.strokeStyle = '#c4610f'; c.lineWidth = 1.4; c.beginPath();
      for (const k of [-5, 0, 5]) { c.moveTo(-R, k); c.quadraticCurveTo(0, k * 1.5, R, k); }
      c.stroke();
      c.fillStyle = '#3a6b1e'; c.fillRect(-4, -1.5, 4, 3);
      c.shadowColor = '#ffe066'; c.shadowBlur = 8; c.fillStyle = '#ffe066';
      for (const sgn of [1, -1]) { c.beginPath(); c.moveTo(4, sgn * 1.5); c.lineTo(7.5, sgn * 3.5); c.lineTo(4, sgn * 5.5); c.closePath(); c.fill(); }
      c.shadowBlur = 0;
      break;
    }
    case 'cactushead': // cabeza de cactus con espinas y sombrero
      c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fillStyle = '#3f9a4a'; c.fill(); ring();
      c.beginPath(); c.ellipse(-1, 0, R + 4.5, R + 5.5, 0, 0, Math.PI * 2); c.fillStyle = S.hatC; c.fill(); ring();
      c.beginPath(); c.arc(-1, 0, R - 3, 0, Math.PI * 2); c.fillStyle = '#5c3618'; c.fill();
      c.fillStyle = '#e5484d'; c.fillRect(4, -6, 3, 12);
      c.strokeStyle = '#f5f0d0'; c.lineWidth = 1; c.beginPath();
      for (const [x, y] of [[-12, -5], [-12, 5], [-8, -12], [-8, 12], [5, -13], [5, 13]]) { c.moveTo(x, y); c.lineTo(x * 1.2, y * 1.2); }
      c.stroke();
      break;
    case 'fox': // máscara de zorro con orejas de punta oscura
      c.beginPath(); c.arc(0, 0, R + 0.5, 0, Math.PI * 2); c.fillStyle = S.hatC; c.fill(); ring();
      c.beginPath(); c.moveTo(9.5, 0); c.lineTo(3, -5); c.lineTo(3, 5); c.closePath(); c.fillStyle = '#fff3e6'; c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(9.5, 0, 1.4, 0, Math.PI * 2); c.fill();
      for (const sgn of [1, -1]) {
        c.beginPath(); c.moveTo(-1, sgn * 4); c.lineTo(-4, sgn * 13); c.lineTo(-8, sgn * 5); c.closePath(); c.fillStyle = S.hatC; c.fill(); ring();
        c.beginPath(); c.moveTo(-3, sgn * 10); c.lineTo(-4, sgn * 13); c.lineTo(-5.5, sgn * 10.5); c.closePath(); c.fillStyle = '#24232b'; c.fill();
      }
      c.strokeStyle = S.band; c.lineWidth = 2.5; c.beginPath(); c.moveTo(4, -7.5); c.lineTo(4, 7.5); c.stroke();
      break;
    case 'burger': { // cabeza de hamburguesa con gorra de repartidor
      const layers = [['#d99a4e', R + 2], ['#5a2e14', R + 1.2], ['#ffcf3a', R + 0.6], ['#4caf50', R], ['#e0903c', R - 1.5]];
      for (const [col, r] of layers) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
      ring();
      c.fillStyle = '#fff6d8'; for (const [x, y] of [[-3, -3], [1, 2], [-5, 3], [2, -4], [-1, 5]]) { c.beginPath(); c.ellipse(x, y, 1.2, 0.6, 0.6, 0, Math.PI * 2); c.fill(); }
      c.beginPath(); c.ellipse(-3, 0, 5, 6.5, 0, 0, Math.PI * 2); c.fillStyle = S.hatC; c.fill(); ring();
      c.beginPath(); c.ellipse(2.5, 0, 2.8, 5, 0, -Math.PI / 2, Math.PI / 2); c.fill(); ring();
      break;
    }
    case 'yeti': // pelo blanco y cuernos azules
      for (const sgn of [1, -1]) { c.beginPath(); c.moveTo(-3, sgn * 5); c.quadraticCurveTo(-4, sgn * 14, 3, sgn * 13); c.lineTo(0, sgn * 6); c.closePath(); c.fillStyle = '#6fb8f0'; c.fill(); ring(); }
      c.beginPath();
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, r = k % 2 ? R + 0.5 : R + 3; c.lineTo(-1 + Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fillStyle = S.hatC; c.fill(); ring();
      c.beginPath(); c.arc(3.5, 0, 4.5, 0, Math.PI * 2); c.fillStyle = S.skin; c.fill();
      c.fillStyle = '#1d2a3a'; for (const sgn of [1, -1]) { c.beginPath(); c.arc(5, sgn * 2, 1, 0, Math.PI * 2); c.fill(); }
      break;
    case 'crown':
      hair();
      c.beginPath();
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 4 : 7.5; c.lineTo(-1 + Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fillStyle = S.hatC; c.fill(); c.strokeStyle = '#8a6d00'; c.lineWidth = 1; c.stroke();
      c.beginPath(); c.arc(-1, 0, 1.8, 0, Math.PI * 2); c.fillStyle = '#e5484d'; c.fill();
      break;
  }
}
function skinPattern(c, S) {
  if (S.pat === 'stripe') { c.fillStyle = S.patC; for (let y = -14; y < 14; y += 6) c.fillRect(-12, y, 22, 2.5); }
  else if (S.pat === 'camo') {
    for (const [x, y, r, col] of [[-5, -8, 4, '#3e4a26'], [1, 5, 4.5, '#7d8b52'], [-6, 6, 3, '#2f3a1d'], [2, -4, 3, '#3e4a26'], [-3, 11, 3, '#7d8b52']]) {
      c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
  } else if (S.pat === 'torn') {
    c.fillStyle = '#8fbf6a'; c.beginPath(); c.moveTo(6, -12); c.lineTo(1, -8); c.lineTo(5, -5); c.lineTo(0, -1); c.lineTo(7, 0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(120,20,20,.6)'; c.beginPath(); c.arc(-4, 6, 2.5, 0, Math.PI * 2); c.fill();
  } else if (S.pat === 'panel') {
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-11, -5); c.lineTo(7, -5); c.moveTo(-11, 5); c.lineTo(7, 5); c.stroke();
    c.fillStyle = '#3df2ff'; c.fillRect(-4, -2, 3, 4);
  } else if (S.pat === 'frost') {
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.2; c.beginPath();
    for (const [x, y] of [[-4, -7], [0, 7]]) for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.moveTo(x - Math.cos(a) * 3, y - Math.sin(a) * 3); c.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); }
    c.stroke();
  } else if (S.pat === 'vest') { c.fillStyle = S.patC; c.fillRect(-12, -14, 22, 6); c.fillRect(-12, 8, 22, 6); }
  else if (S.pat === 'reflect') { c.fillStyle = S.patC; c.fillRect(-12, -9, 22, 3); c.fillRect(-12, 6, 22, 3); }
  else if (S.pat === 'cross') { c.fillStyle = S.patC; c.fillRect(-5, -2, 8, 4); c.fillRect(-3, -4, 4, 8); }
  else if (S.pat === 'buttons') { c.fillStyle = S.patC; for (const y of [-6, 0, 6]) { c.beginPath(); c.arc(-4, y, 1.2, 0, Math.PI * 2); c.fill(); } }
  else if (S.pat === 'fur') { c.fillStyle = '#d9c3a0'; c.beginPath(); c.ellipse(-2, 0, 5, 14, 0, 0, Math.PI * 2); c.fill(); }
  else if (S.pat === 'stars') {
    c.fillStyle = S.patC;
    for (const [x, y, r] of [[-6, -8, 1.4], [1, -3, 1], [-3, 6, 1.6], [3, 10, 1], [-8, 2, 0.9], [2, -11, 0.9]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  } else if (S.pat === 'plates') { c.strokeStyle = S.patC; c.lineWidth = 1.4; c.beginPath(); for (const y of [-9, -4, 1, 6, 11]) { c.moveTo(-12, y); c.lineTo(10, y); } c.stroke(); }
  else if (S.pat === 'bones') {
    c.strokeStyle = S.patC; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-9, 0); c.lineTo(5, 0);
    for (const y of [-8, -4, 4, 8]) { c.moveTo(-6, y); c.lineTo(3, y * 0.6); } c.stroke();
  } else if (S.pat === 'lava') {
    c.strokeStyle = '#ff7a1f'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-10, -9); c.lineTo(-4, -3); c.lineTo(-7, 3); c.lineTo(0, 9); c.moveTo(-4, -3); c.lineTo(4, -7); c.moveTo(-7, 3); c.lineTo(3, 3); c.stroke();
  } else if (S.pat === 'gem') {
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.1; c.beginPath();
    c.moveTo(-10, 0); c.lineTo(-2, -12); c.lineTo(6, 0); c.lineTo(-2, 12); c.closePath(); c.moveTo(-10, 0); c.lineTo(6, 0); c.moveTo(-2, -12); c.lineTo(-2, 12); c.stroke();
  } else if (S.pat === 'track') { c.fillStyle = S.patC; c.fillRect(-12, -14, 22, 2.5); c.fillRect(-12, 11.5, 22, 2.5); c.fillRect(1, -3, 2, 6); }
  else if (S.pat === 'cracks') {
    c.strokeStyle = 'rgba(60,64,70,.65)'; c.lineWidth = 1.1; c.beginPath();
    c.moveTo(-9, -10); c.lineTo(-4, -5); c.lineTo(-6, 0); c.lineTo(-1, 6); c.moveTo(-4, -5); c.lineTo(2, -8); c.moveTo(-6, 0); c.lineTo(-10, 5); c.stroke();
    c.fillStyle = '#c62828'; c.fillRect(-12, -14, 22, 3);
  } else if (S.pat === 'belly') { c.fillStyle = S.patC; c.beginPath(); c.ellipse(2, 0, 5, 10, 0, 0, Math.PI * 2); c.fill(); }
  else if (S.pat === 'spines') {
    c.strokeStyle = '#2b7a35'; c.lineWidth = 1.2; c.beginPath(); for (const y of [-8, 0, 8]) { c.moveTo(-10, y); c.lineTo(6, y); } c.stroke();
    c.strokeStyle = '#f5f0d0'; c.lineWidth = 0.9; c.beginPath(); for (const [x, y] of [[-6, -10], [0, -4], [-4, 4], [2, 10], [-9, 6]]) { c.moveTo(x, y); c.lineTo(x + 2, y - 2); } c.stroke();
  } else if (S.pat === 'belt') { c.fillStyle = S.patC; c.save(); c.rotate(0.6); c.fillRect(-14, -1.5, 28, 3); c.restore(); }
  else if (S.pat === 'apron') { c.fillStyle = '#fff'; c.fillRect(-2, -9, 10, 18); c.fillStyle = S.patC; c.fillRect(1, -2, 4, 4); }
  else if (S.pat === 'fur2') {
    c.strokeStyle = 'rgba(150,175,200,.7)'; c.lineWidth = 1.1; c.beginPath();
    for (const [x, y] of [[-8, -10], [-3, -6], [-8, -1], [-2, 2], [-7, 8], [0, 9], [3, -2]]) { c.moveTo(x, y); c.lineTo(x + 2.5, y + 2); }
    c.stroke();
  } else if (S.pat === 'royal') {
    c.fillStyle = S.patC; c.fillRect(-12, -3, 22, 6);
    c.fillStyle = '#ffd700'; c.beginPath(); c.arc(-2, 0, 1.6, 0, Math.PI * 2); c.fill();
  }
}
const ringOf = e => e.isPlayer ? '#ffffff' : e.human ? e.color : null;
// Derribado: tumbado, sin arma, aro rojo que late y progreso de reanimación en verde
function drawDowned(e) {
  const pulse = 0.5 + Math.sin(time * 6) * 0.5;
  ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 10 + pulse * 4, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,70,90,${0.35 + pulse * 0.4})`; ctx.lineWidth = 3; ctx.stroke();
  ctx.save(); ctx.globalAlpha = 0.75;
  drawPerson(ctx, e.sk, e.x, e.y, e.ang, { sc: 1.25, pose: 'lying', hit: e.hitT > 0, av: e.av, ring: ringOf(e) });
  ctx.restore();
  if (e.rev > 0) {
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, e.rev));
    ctx.strokeStyle = '#5dffb1'; ctx.lineWidth = 4; ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - 18, e.y - e.r - 14, 36, 5);
  ctx.fillStyle = '#fc8181'; ctx.fillRect(e.x - 18, e.y - e.r - 14, 36 * Math.max(0, e.hp) / 100, 5);
  const mine = player && e.team === player.team;
  txt(`🩸 ${e.isPlayer ? 'Tú' : e.name}`, e.x, e.y - e.r - 26, 12, mine ? '#5dffb1' : '#ff8fa3', 'center', 800);
}
function drawEnt(e) {
  if (e.down) { drawDowned(e); return; }
  const g = e.guns[e.slot], W = g ? WEAPONS[g.type] : null;
  ctx.beginPath(); ctx.arc(e.x + 3, e.y + 5, e.r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
  // fase del paso según lo que se ha movido (funciona igual en el anfitrión y en los invitados)
  const md = e.lx == null ? 0 : Math.hypot(e.x - e.lx, e.y - e.ly);
  e.lx = e.x; e.ly = e.y;
  if (md < 40) e.stepP = (e.stepP || 0) + md * 0.16;
  e.walkA = lerp(e.walkA || 0, md > 0.4 ? 1 : 0, 0.25);
  drawPerson(ctx, e.sk, e.x, e.y, e.ang, {
    sc: 1.25, step: e.stepP, walk: e.walkA,
    W, tier: g ? g.tier : 0, rc: Math.max(0, 0.08 - (time - e.lastShot)) * 45, flash: time - e.lastShot < 0.05,
    hit: e.hitT > 0, av: e.av, ring: ringOf(e),
  });
  if (e.armor > 0) {
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * e.armor / 100);
    ctx.strokeStyle = '#63b3ed'; ctx.lineWidth = 3; ctx.stroke();
  }
  if (e.healT > 0) {
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, 1 - e.healT / healDur(e)));
    ctx.strokeStyle = '#68d391'; ctx.lineWidth = 3; ctx.stroke();
  }
  const mate = teamsOn() && !e.isPlayer && player && e.team === player.team;
  if (mate) { // compañero de equipo: aro verde
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(93,255,177,.85)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
  }
  if (!e.isPlayer && (time - e.lastHurt < 3 || mate)) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - 18, e.y - e.r - 14, 36, 5);
    ctx.fillStyle = e.hp > 50 ? '#68d391' : e.hp > 25 ? '#f6ad55' : '#fc8181';
    ctx.fillRect(e.x - 18, e.y - e.r - 14, 36 * Math.max(0, e.hp) / 100, 5);
  }
  if (mate) txt(e.name, e.x, e.y - e.r - 24, 12, '#5dffb1', 'center', 800);
  else if (e.human && !e.isPlayer) txt(e.name, e.x, e.y - e.r - 24, 12, e.color, 'center', 800);
}
function drawGlider(e) {
  const k = clamp(e.glideT / GLIDE, 0, 1), h = k * 150, s = 1 + k * 0.55;
  ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 - k * 0.4), 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
  ctx.save(); ctx.translate(e.x, e.y - h); ctx.scale(s, s);
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-30, -38); ctx.moveTo(10, -4); ctx.lineTo(30, -38); ctx.moveTo(0, -8); ctx.lineTo(0, -52); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -40, 34, 18, 0, Math.PI, 0); ctx.closePath();
  ctx.fillStyle = '#f5f5f5'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = e.color;
  for (let i = -3; i <= 3; i += 2) ctx.fillRect(i * 10 - 5, -60, 10, 22);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.stroke();
  drawPerson(ctx, e.sk, 0, 0, -Math.PI / 2, { pose: 'glide', av: e.av, ring: ringOf(e) });
  ctx.restore();
  if (e.isPlayer) txt('Tú', e.x, e.y - h - 80 * s, 14, '#ffd34d', 'center', 800);
  else if (teamsOn() && player && e.team === player.team) txt('🤝 ' + e.name, e.x, e.y - h - 80 * s, 13, '#5dffb1', 'center', 800);
  else if (e.human) txt(e.name, e.x, e.y - h - 80 * s, 13, e.color, 'center', 800);
}
// Cactus (mapa desierto): vista desde arriba, con costillas, espinas y brazos
// Palmera (mapa playa): hojas largas en estrella y cocos
function drawPalm(c) {
  const r = c.r * 2.1;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(c.x + 10, c.y + 12, r * 0.7, 0, Math.PI * 2); ctx.fill();
  const seed = c.x * 0.37 + c.y * 0.11;
  for (let k = 0; k < 7; k++) {
    const a = seed + k / 7 * Math.PI * 2;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(r * 0.5, 0, r * 0.52, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fillStyle = k % 2 ? TH.tree[1] : TH.tree[2]; ctx.fill(); ctx.strokeStyle = TH.tree[0]; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(r * 0.95, 0); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#6b4423'; for (const [dx, dy] of [[-4, -3], [4, -2], [0, 4]]) { ctx.beginPath(); ctx.arc(c.x + dx, c.y + dy, 4.5, 0, Math.PI * 2); ctx.fill(); }
}
function drawCactus(c) {
  const r = c.r * 0.8;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.arc(c.x + 5, c.y + 6, r, 0, Math.PI * 2); ctx.fill();
  for (const [dx, dy] of [[r * 0.95, -r * 0.2], [-r * 0.9, r * 0.3]]) {
    ctx.beginPath(); ctx.arc(c.x + dx, c.y + dy, r * 0.45, 0, Math.PI * 2); ctx.fillStyle = TH.tree[1]; ctx.fill();
    ctx.strokeStyle = TH.tree[0]; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fillStyle = TH.tree[1]; ctx.fill();
  ctx.strokeStyle = TH.tree[0]; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = TH.tree[2]; ctx.lineWidth = 2; ctx.beginPath();
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ctx.moveTo(c.x + Math.cos(a) * r * 0.25, c.y + Math.sin(a) * r * 0.25); ctx.lineTo(c.x + Math.cos(a) * r * 0.9, c.y + Math.sin(a) * r * 0.9); }
  ctx.stroke();
  ctx.fillStyle = '#ff7ab8'; ctx.beginPath(); ctx.arc(c.x - r * 0.15, c.y - r * 0.15, r * 0.18, 0, Math.PI * 2); ctx.fill();
}
function drawPlane() {
  if (plane.t > plane.dur + 4) return;
  for (const shadow of [true, false]) {
    ctx.save();
    ctx.translate(plane.x + (shadow ? 70 : 0), plane.y + (shadow ? 110 : 0));
    ctx.rotate(plane.ang);
    ctx.fillStyle = shadow ? 'rgba(0,0,0,.22)' : '#dfe3ea';
    ctx.beginPath(); // alas
    ctx.moveTo(20, -14); ctx.lineTo(-20, -120); ctx.lineTo(-50, -120); ctx.lineTo(-35, -14);
    ctx.lineTo(-35, 14); ctx.lineTo(-50, 120); ctx.lineTo(-20, 120); ctx.lineTo(20, 14); ctx.closePath(); ctx.fill();
    ctx.beginPath(); // cola
    ctx.moveTo(-90, -8); ctx.lineTo(-120, -45); ctx.lineTo(-135, -45); ctx.lineTo(-125, 0); ctx.lineTo(-135, 45); ctx.lineTo(-120, 45); ctx.lineTo(-90, 8); ctx.closePath(); ctx.fill();
    rr(-130, -16, 230, 32, 16); ctx.fill();
    if (!shadow) {
      ctx.fillStyle = '#c2c8d2'; ctx.fillRect(-30, -120, 10, 240);
      ctx.fillStyle = '#e5484d'; ctx.fillRect(-130, -3, 230, 6);
      ctx.fillStyle = '#2b3a55'; rr(70, -10, 22, 20, 8); ctx.fill();
      ctx.fillStyle = '#6b7a95'; for (let i = -100; i < 60; i += 22) { ctx.beginPath(); ctx.arc(i, -9, 3, 0, Math.PI * 2); ctx.arc(i, 9, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
}
function render(dt) {
  if (replay) {
    if (replayBegin()) {
      try { renderNow(dt); } finally { replayEnd(); }
      drawReplayBanner();
      return;
    }
  }
  renderNow(dt);
}
function renderNow(dt) {
  if (on3D(true)) {
    try { render3D(dt); return; }
    catch (err) { console.error('Fallo en 3D, vuelvo a 2D', err); use3D = false; $('v3d').checked = false; $('c3').style.display = 'none'; }
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = TH.bg; ctx.fillRect(0, 0, VW, VH);
  if (!ents || !ground) return;
  updateCamera(dt);
  const z = cam.z, sh = shake > 0 ? shake * 14 : 0;
  const ox = cam.x + rand(-sh, sh), oy = cam.y + rand(-sh, sh);
  ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (VW / 2 - ox * z), DPR * (VH / 2 - oy * z));
  const hw = VW / 2 / z, hh = VH / 2 / z;
  const x0 = ox - hw - 80, y0 = oy - hh - 80, x1 = ox + hw + 80, y1 = oy + hh + 80;
  const vis = (x, y, r) => x + r > x0 && x - r < x1 && y + r > y0 && y - r < y1;
  const f = state === 'menu' ? null : focusEnt();
  const fogOn = state !== 'menu' && player.alive && player.air === 'ground';

  // terreno
  const gx0 = clamp(x0, 0, WORLD), gy0 = clamp(y0, 0, WORLD), gx1 = clamp(x1, 0, WORLD), gy1 = clamp(y1, 0, WORLD);
  if (gx1 > gx0 && gy1 > gy0) ctx.drawImage(ground, gx0 * GS, gy0 * GS, (gx1 - gx0) * GS, (gy1 - gy0) * GS, gx0, gy0, gx1 - gx0, gy1 - gy0);

  // sombras
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  for (const c of circles) {
    if (!vis(c.x, c.y, c.r * 2)) continue;
    if (c.kind === 'tree') for (const b of c.blobs) { ctx.beginPath(); ctx.arc(c.x + b.dx + 12, c.y + b.dy + 14, b.r, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(c.x + 6, c.y + 8, c.r, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const q of rects) if (vis(q.x + q.w / 2, q.y + q.h / 2, Math.max(q.w, q.h))) ctx.fillRect(q.x + 5, q.y + 7, q.w, q.h);
  for (const b of buildings) {
    if (b.roofA < 0.05 || !vis(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    ctx.fillStyle = `rgba(0,0,0,${0.22 * b.roofA})`; ctx.fillRect(b.x + 12, b.y + 14, b.w, b.h);
  }

  for (const it of loot) if (vis(it.x, it.y, 40)) drawLoot(it);
  for (const b of boxes) if (vis(b.x, b.y, 40)) drawBox(b);

  // jugadores en el suelo y coches (un coche con conductor solo se ve si ves al conductor)
  for (const e of ents) e.seen = e.alive && e.air === 'ground' && (!fogOn || e === player || e.team === player.team || canSee(player, e));
  for (const v of vehicles) {
    if (!vis(v.x, v.y, 60) || (v.driver && !v.driver.seen)) continue;
    drawVehicle(v);
    const d = v.driver;
    if (d && d !== player && (d.human || (teamsOn() && d.team === player.team)))
      txt(d.name, v.x, v.y - 46, 12, d.team === player.team && teamsOn() ? '#5dffb1' : d.color, 'center', 800);
  }
  for (const e of ents) if (e.seen && !e.veh && vis(e.x, e.y, 60)) drawEnt(e);

  // balas con brillo
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,200,90,.25)'; ctx.lineWidth = 6; ctx.beginPath();
  for (const b of bullets) if (!b.rk && vis(b.x, b.y, 40)) { ctx.moveTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); ctx.lineTo(b.x, b.y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,245,200,.95)'; ctx.lineWidth = 2; ctx.beginPath();
  for (const b of bullets) if (!b.rk && vis(b.x, b.y, 40)) { ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018); ctx.lineTo(b.x, b.y); }
  ctx.stroke();
  for (const b of bullets) { // cohetes: cuerpo con llama
    if (!b.rk || !vis(b.x, b.y, 40)) continue;
    const a = Math.atan2(b.vy, b.vx);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    ctx.fillStyle = 'rgba(255,150,40,.8)'; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-20 - Math.random() * 8, 0); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a7a3a'; ctx.fillRect(-9, -3.5, 14, 7); ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.moveTo(5, -3.5); ctx.lineTo(10, 0); ctx.lineTo(5, 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  for (const e of ents) {
    if (!e.seen || e.veh || e.down || time - e.lastShot > 0.06) continue;
    const W = WEAPONS[e.guns[e.slot].type], mx = e.x + Math.cos(e.ang) * (e.r + W.len), my = e.y + Math.sin(e.ang) * (e.r + W.len);
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, 70);
    g.addColorStop(0, 'rgba(255,190,80,.45)'); g.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = g; ctx.fillRect(mx - 70, my - 70, 140, 140);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';

  // obstáculos
  for (const c of circles) {
    if (c.kind !== 'rock' || !vis(c.x, c.y, c.r * 1.2)) continue;
    ctx.beginPath();
    for (let i = 0; i < c.pts.length; i += 2) { if (i) ctx.lineTo(c.x + c.pts[i], c.y + c.pts[i + 1]); else ctx.moveTo(c.x + c.pts[i], c.y + c.pts[i + 1]); }
    ctx.closePath(); ctx.fillStyle = TH.rock[0]; ctx.fill(); ctx.strokeStyle = TH.rock[1]; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < c.pts.length; i += 2) { const px = c.x - c.r * 0.18 + c.pts[i] * 0.55, py = c.y - c.r * 0.22 + c.pts[i + 1] * 0.55; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.fill();
  }
  for (const q of rects) {
    if (!vis(q.x + q.w / 2, q.y + q.h / 2, Math.max(q.w, q.h))) continue;
    if (q.kind === 'wall') {
      ctx.fillStyle = '#5a4632'; ctx.fillRect(q.x, q.y, q.w, q.h);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(q.x, q.y, q.w, Math.min(3, q.h));
    } else {
      ctx.fillStyle = '#b07b3e'; ctx.fillRect(q.x, q.y, q.w, q.h);
      ctx.strokeStyle = '#7a5228'; ctx.lineWidth = 3; ctx.strokeRect(q.x + 1.5, q.y + 1.5, q.w - 3, q.h - 3);
      ctx.beginPath(); ctx.moveTo(q.x + 4, q.y + 4); ctx.lineTo(q.x + q.w - 4, q.y + q.h - 4);
      ctx.moveTo(q.x + q.w - 4, q.y + 4); ctx.lineTo(q.x + 4, q.y + q.h - 4); ctx.stroke();
      if (q.hp < CRATE_HP * 0.6) {
        ctx.strokeStyle = 'rgba(40,20,5,.8)'; ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(q.x + q.w * 0.2, q.y + 3); ctx.lineTo(q.x + q.w * 0.45, q.y + q.h * 0.5); ctx.lineTo(q.x + q.w * 0.3, q.y + q.h - 3); ctx.stroke();
      }
    }
  }
  drawShields(vis);
  // arbustos
  for (const b of bushes) {
    if (!vis(b.x, b.y, b.r * 1.3)) continue;
    const mine = f && dist(b.x, b.y, f.x, f.y) < b.r;
    ctx.globalAlpha = mine ? 0.5 : 0.96;
    ctx.fillStyle = TH.bush[0];
    for (const k of b.blobs) { ctx.beginPath(); ctx.arc(b.x + k.dx, b.y + k.dy, k.r + 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = TH.bush[1];
    for (const k of b.blobs) { ctx.beginPath(); ctx.arc(b.x + k.dx, b.y + k.dy, k.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = TH.bush[2];
    for (const k of b.blobs) { ctx.beginPath(); ctx.arc(b.x + k.dx - 3, b.y + k.dy - 4, k.r * 0.45, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // copas de los árboles
  for (const c of circles) {
    if (c.kind !== 'tree' || !vis(c.x, c.y, c.r * 2)) continue;
    const under = f && dist(f.x, f.y, c.x, c.y) < c.r * 1.8;
    ctx.globalAlpha = under ? 0.42 : 0.97;
    if (TH.cactus) { drawCactus(c); ctx.globalAlpha = 1; continue; }
    if (TH.palm) { drawPalm(c); ctx.globalAlpha = 1; continue; }
    ctx.fillStyle = TH.tree[0];
    for (const k of c.blobs) { ctx.beginPath(); ctx.arc(c.x + k.dx, c.y + k.dy, k.r + 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = TH.tree[1];
    for (const k of c.blobs) { ctx.beginPath(); ctx.arc(c.x + k.dx, c.y + k.dy, k.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = TH.tree[2];
    for (const k of c.blobs) { ctx.beginPath(); ctx.arc(c.x + k.dx - 4, c.y + k.dy - 5, k.r * 0.5, 0, Math.PI * 2); ctx.fill(); }
    if (TH.snow) { ctx.fillStyle = 'rgba(250,252,255,.9)'; for (const k of c.blobs) { ctx.beginPath(); ctx.arc(c.x + k.dx - 5, c.y + k.dy - 6, k.r * 0.38, 0, Math.PI * 2); ctx.fill(); } }
    ctx.globalAlpha = 1;
  }
  // techos
  const fb = f && f.air === 'ground' ? f.bld : -1;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    b.roofA = lerp(b.roofA, i === fb ? 0 : 1, Math.min(1, dt * 8));
    if (b.roofA < 0.02 || !vis(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    ctx.globalAlpha = b.roofA;
    ctx.fillStyle = b.roof; ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; ctx.beginPath();
    const horiz = b.w >= b.h;
    if (horiz) for (let y = b.y + 14; y < b.y + b.h; y += 16) { ctx.moveTo(b.x - 4, y); ctx.lineTo(b.x + b.w + 4, y); }
    else for (let x = b.x + 14; x < b.x + b.w; x += 16) { ctx.moveTo(x, b.y - 4); ctx.lineTo(x, b.y + b.h + 4); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    if (horiz) ctx.fillRect(b.x - 4, b.y + b.h / 2, b.w + 8, b.h / 2 + 4); else ctx.fillRect(b.x + b.w / 2, b.y - 4, b.w / 2 + 4, b.h + 8);
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 4; ctx.beginPath();
    if (horiz) { ctx.moveTo(b.x + 10, b.y + b.h / 2); ctx.lineTo(b.x + b.w - 10, b.y + b.h / 2); }
    else { ctx.moveTo(b.x + b.w / 2, b.y + 10); ctx.lineTo(b.x + b.w / 2, b.y + b.h - 10); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 3; ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.globalAlpha = 1;
  }
  // partículas
  for (const p of particles) {
    if (!vis(p.x, p.y, 5)) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  // granadas en vuelo
  for (const n of nades) {
    if (!vis(n.x, n.y, NADE_R)) continue;
    const zz = Math.sin(Math.PI * Math.min(1, n.age / NADE_FLY));
    ctx.beginPath(); ctx.arc(n.x + 4, n.y + 4, 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
    ctx.beginPath(); ctx.arc(n.x, n.y - zz * 18, 6 + zz * 3, 0, Math.PI * 2);
    ctx.fillStyle = '#3d5a2a'; ctx.fill(); ctx.strokeStyle = '#9ccc65'; ctx.lineWidth = 2; ctx.stroke();
    if (NADE_FUSE - n.age < 0.8 && Math.floor(n.age * 12) % 2 === 0) {
      ctx.beginPath(); ctx.arc(n.x, n.y - zz * 18, 3, 0, Math.PI * 2); ctx.fillStyle = '#ff3b3b'; ctx.fill();
    }
    if (NADE_FUSE - n.age < 1) {
      ctx.beginPath(); ctx.arc(n.x, n.y, NADE_R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,80,60,.4)'; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  for (const b of blasts) {
    const k = 1 - b.t / 0.45;
    ctx.beginPath(); ctx.arc(b.x, b.y, NADE_R * (0.3 + 0.7 * k), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,170,60,${0.5 * (1 - k)})`; ctx.fill();
    ctx.strokeStyle = `rgba(255,240,200,${0.8 * (1 - k)})`; ctx.lineWidth = 4; ctx.stroke();
  }

  // niebla de guerra: solo ves lo que está en tu línea de visión
  if (fogOn) {
    visPoly = computeVis(player.x, player.y, Math.hypot(hw, hh) + 120);
    ctx.beginPath(); ctx.rect(x0 - 200, y0 - 200, x1 - x0 + 400, y1 - y0 + 400);
    ctx.moveTo(visPoly[0], visPoly[1]);
    for (let i = 2; i < visPoly.length; i += 2) ctx.lineTo(visPoly[i], visPoly[i + 1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6,10,24,.55)'; ctx.fill('evenodd');
  }
  if (TH.night) { // noche: solo se ve bien cerca de ti
    const c = f || cam, g = ctx.createRadialGradient(c.x, c.y, 120, c.x, c.y, 470);
    g.addColorStop(0, 'rgba(4,6,20,0)'); g.addColorStop(1, 'rgba(4,6,20,.72)');
    ctx.fillStyle = g; ctx.fillRect(x0 - 200, y0 - 200, x1 - x0 + 400, y1 - y0 + 400);
  }

  // zona
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.arc(zone.x, zone.y, Math.max(0.1, zone.r), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(110,30,170,.3)'; ctx.fill('evenodd');
  ctx.beginPath(); ctx.arc(zone.x, zone.y, Math.max(0.1, zone.r), 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(199,125,255,.25)'; ctx.lineWidth = 16 + Math.sin(time * 3) * 4; ctx.stroke();
  ctx.strokeStyle = '#c77dff'; ctx.lineWidth = 4; ctx.stroke();
  if (zone.state !== 'done') {
    ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.arc(zone.tx, zone.ty, Math.max(0.1, zone.tr), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
  }

  if (state !== 'menu') drawPingsWorld(vis);

  // cielo: suministros, paracaidistas y avión
  for (const d of drops) {
    const k = 1 - d.t / DROP_FALL, h = (1 - k) * 260, px = d.x, py = d.y - h;
    ctx.beginPath(); ctx.arc(d.x, d.y, 10 + 18 * k, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.25 * k})`; ctx.fill();
    ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(d.x, d.y, 36 + Math.sin(time * 6) * 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,80,80,.85)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(px - 28, py - 34); ctx.lineTo(px - 12, py - 14); ctx.moveTo(px + 28, py - 34); ctx.lineTo(px + 12, py - 14);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py - 34, 30, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = '#e5484d'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#d29922'; ctx.fillRect(px - 16, py - 16, 32, 32);
    ctx.strokeStyle = '#7a5228'; ctx.lineWidth = 3; ctx.strokeRect(px - 14.5, py - 14.5, 29, 29);
  }
  if (state !== 'menu') {
    for (const e of ents) if (e.alive && e.air === 'glide' && vis(e.x, e.y, 250)) drawGlider(e);
    drawPlane();
  }
  // reacciones (encima de todo, solo de quien puedes ver)
  if (state !== 'menu') for (const e of ents) {
    if (!e.alive || time - e.emoT > 2.6 || !vis(e.x, e.y, 80)) continue;
    if (e.air === 'ground' && !e.seen) continue;
    drawEmo(e);
  }
  // números de daño
  for (const fl of floats) {
    ctx.globalAlpha = Math.min(1, fl.t * 2);
    const s = 1 + Math.max(0, fl.t - 0.85) * 3;
    ctx.font = `800 ${Math.round(17 * s)}px system-ui, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(Math.round(fl.v), fl.x, fl.y);
    ctx.fillStyle = fl.armor ? '#90cdf4' : '#ffffff'; ctx.fillText(Math.round(fl.v), fl.x, fl.y);
  }
  ctx.globalAlpha = 1;
  wxUpdate(); drawWeather2D();
  drawHUD();
}
