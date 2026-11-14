"use strict";
// =====================================================================
//  Câmera aérea inclinada (top-down 3/4, ~55°, rotação fixa) seguindo
//  o jogador. Tudo que tem altura (prédios, árvores, postes) é projetado:
//   · um pouco para longe do centro da tela (a câmera está alta), e
//   · "para cima" na tela (a câmera está inclinada, olhando para o norte),
//  por isso aparece a parede da frente (sul) dos prédios.
//  Também cuida do personagem com spritesheet de 8 direções e da
//  atmosfera (cone da lanterna, neblina azulada e vinheta).
// =====================================================================
const CAM_H = 1100;        // altura da câmera (px do mundo): perspectiva radial
const LEAN = 0.5;          // inclinação: quanto o alto "sobe" na tela por px de altura (~tan 27°, leve)
const PERSPECTIVE = true;

function eye() { return { x: cam.x + W / 2, y: cam.y + H / 2 }; }
function projK(h) { return CAM_H / (CAM_H - h); }
// ponto (x, y) a uma altura h, visto pela câmera
function proj(x, y, h, e) { const k = projK(h); return { x: e.x + (x - e.x) * k, y: e.y + (y - e.y) * k - h * LEAN }; }

function bHeight(b) {
  if (b.safe) return 70;
  if (b.type === "guarita" || b.noDoor) return 38;
  const f = buildingFloors(b);
  return b.landmark ? 46 + f * 40 : 30 + f * 34;
}
function bFloorsVis(b) { return b.safe ? 2 : b.noDoor ? 1 : buildingFloors(b); }
// telha laranja para os telhados inclinados (cada casa com um tom)
const ROOF_TILE = ["#b5562c", "#a84f2a", "#c0663a", "#9a4826", "#b8603a"];
function roofColor(b) { return b.roofCol || (b.roofCol = ROOF_TILE[Math.floor(bHash(b, 3) * ROOF_TILE.length)]); }

// chão do prédio (sombra, base e porta): desenhado junto com a rua
function drawBuildingGround(b) {
  const h = bHeight(b);
  ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(b.x + 6, b.y - h * 0.18, b.w + h * 0.14, b.h + h * 0.18);
  ctx.fillStyle = shade(b.color, -0.55); ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
  drawDoor(b);
}

// parede entre dois cantos do chão, com janelas por andar
function drawWall(b, ax, ay, bx, by, h, e, tone) {
  const p0 = proj(ax, ay, 0, e), p1 = proj(bx, by, 0, e), p2 = proj(bx, by, h, e), p3 = proj(ax, ay, h, e);
  poly([[p0.x, p0.y], [p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y]], shade(b.color, tone));
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p3.x, p3.y); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  const floors = bFloorsVis(b), len = Math.hypot(bx - ax, by - ay), fh = h / (floors + 0.35);
  const nW = Math.max(1, Math.floor(len / 46)), night = isNight();
  const at = (t, hh) => proj(ax + (bx - ax) * t, ay + (by - ay) * t, hh, e);
  for (let f = 0; f < floors; f++) {
    if (f > 0) { const l0 = at(0, f * fh), l1 = at(1, f * fh); ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.moveTo(l0.x, l0.y); ctx.lineTo(l1.x, l1.y); ctx.stroke(); }
    const h0 = f * fh + fh * 0.32, h1 = f * fh + fh * 0.78;
    for (let i = 0; i < nW; i++) {
      const t0 = (i + 0.28) / nW, t1 = (i + 0.72) / nW;
      const q0 = at(t0, h0), q1 = at(t1, h0), q2 = at(t1, h1), q3 = at(t0, h1);
      const lit = night && bHash(b, f * 31 + i + 7) < 0.22;
      poly([[q0.x, q0.y], [q1.x, q1.y], [q2.x, q2.y], [q3.x, q3.y]], lit ? "rgba(255,210,120,0.85)" : night ? "rgba(20,26,36,0.9)" : "rgba(40,58,72,0.85)");
    }
  }
}

// paredes viradas para a câmera + telhado lá em cima
function drawBuildingTall(b, e) {
  const h = bHeight(b), x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
  // a parede aparece quando o topo dela "entra" em relação à base (vista pela câmera)
  const seen = (mx, my, nx, ny) => { const t = proj(mx, my, h, e); return (t.x - mx) * nx + (t.y - my) * ny < 0; };
  // você atrás do prédio: ele fica transparente para não te esconder
  const r0 = proj(x0, y0, h, e), r1 = proj(x1, y1, h, e), py = player.y - 20;
  const behind = player.x > Math.min(r0.x, x0) - 10 && player.x < Math.max(r1.x, x1) + 10 && py > Math.min(r0.y, y0) - 10 && player.y < y0 + 6;
  ctx.save(); if (behind) ctx.globalAlpha = 0.38;
  if (seen((x0 + x1) / 2, y0, 0, -1)) drawWall(b, x0, y0, x1, y0, h, e, -0.05);   // norte
  if (seen((x0 + x1) / 2, y1, 0, 1)) drawWall(b, x0, y1, x1, y1, h, e, -0.3);     // sul (frente)
  if (seen(x0, (y0 + y1) / 2, -1, 0)) drawWall(b, x0, y0, x0, y1, h, e, -0.18);   // oeste
  if (seen(x1, (y0 + y1) / 2, 1, 0)) drawWall(b, x1, y0, x1, y1, h, e, -0.4);     // leste
  // telhado: o mesmo desenho de antes, levado para a altura h pela câmera
  const k = projK(h);
  ctx.save(); ctx.translate(e.x, e.y - h * LEAN); ctx.scale(k, k); ctx.translate(-e.x, -e.y);
  if (b.roof === "pitched") drawPitched(b); else drawFlat(b);
  ctx.restore();
  ctx.restore();
}

// tudo que é alto, desenhado por cima do chão e das criaturas
function drawTall() {
  if (game.inside) return;
  const e = eye();
  for (const l of world.lamps) {
    if (!inView(l.x - 80, l.y - 120, 160, 200)) continue;
    const top = proj(l.x, l.y, l.big ? 70 : 55, e);
    ctx.strokeStyle = "#1c1c1c"; ctx.lineWidth = l.big ? 4 : 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    ctx.fillStyle = "#2a2a2a"; circle(top.x, top.y, l.big ? 6 : 4.5);
    ctx.fillStyle = isNight() ? "#ffe6a0" : "#9a9a90"; circle(top.x, top.y, l.big ? 3.5 : 2.5);
  }
  // prédios: de trás (norte) para a frente (sul)
  const list = world.buildings.filter((b) => inView(b.x - 140, b.y - 40, b.w + 280, b.h + 260));
  list.sort((a, b) => a.y + a.h - (b.y + b.h));
  for (const b of list) drawBuildingTall(b, e);
}

// copas das árvores lá em cima, com tronco ligando ao chão
function drawCanopiesP() {
  const e = eye();
  for (const t of world.trees) {
    if (!inView(t.x - t.r * 2.5, t.y - t.r * 3.5, t.r * 5, t.r * 6)) continue;
    const th = 48 + t.r * 1.2, k = projK(th), c = proj(t.x, t.y, th, e);
    const under = Math.hypot(player.x - c.x, player.y - c.y) < t.r * k * 1.05;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,0.28)"; circle(t.x + 8, t.y + 4, t.r * 0.95);
    ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + (c.x - t.x) * 0.7, t.y + (c.y - t.y) * 0.7); ctx.stroke();
    ctx.globalAlpha = under ? 0.38 : 0.96;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(k, k);
    const base = t.tone < 0.5 ? "#26401f" : "#2e4524";
    ctx.fillStyle = base; circle(0, 0, t.r * 0.9);
    ctx.fillStyle = shade(base, 0.12); for (const l of t.lobes) circle(l.dx, l.dy, l.r);
    ctx.fillStyle = shade(base, 0.3); for (const l of t.lobes) circle(l.dx - l.r * 0.25, l.dy - l.r * 0.25, l.r * 0.45);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---------- Personagem: spritesheet 8 direções × 8 quadros (128×128) ----------
const PSHEET = { img: null, ok: false, cell: 128, size: 86, footY: 0.82, stride: 12.5 };
// ponta do cano e lanterna de peito em cada quadro [direção][quadro] = [x, y] dentro do quadro de 128 px
// (calculado com a mesma geometria 3D do tools/gerar_personagem_camera.py)
const PS_MUZZLE = [[[70.0, 0.7], [74.3, 2.2], [76.1, 3.5], [74.3, 2.2], [70.0, 0.7], [65.6, 1.4], [63.8, 2.3], [65.6, 1.4]], [[100.5, 13.2], [103.4, 16.8], [104.6, 18.9], [103.4, 16.8], [100.5, 13.2], [97.4, 11.6], [96.0, 11.6], [97.4, 11.6]], [[114.4, 46.9], [113.7, 51.3], [113.3, 53.7], [113.7, 51.3], [114.4, 46.9], [114.7, 44.2], [114.7, 43.6], [114.7, 44.2]], [[91.3, 77.0], [87.5, 79.7], [85.9, 81.3], [87.5, 79.7], [91.3, 77.0], [94.9, 75.8], [96.3, 75.8], [94.9, 75.8]], [[58.0, 83.2], [53.7, 83.6], [51.9, 84.2], [53.7, 83.6], [58.0, 83.2], [62.4, 84.4], [64.2, 85.3], [62.4, 84.4]], [[27.5, 70.8], [24.6, 69.0], [23.4, 68.7], [24.6, 69.0], [27.5, 70.8], [30.6, 74.2], [32.0, 76.0], [30.6, 74.2]], [[13.6, 37.1], [14.3, 34.4], [14.7, 33.9], [14.3, 34.4], [13.6, 37.1], [13.3, 41.6], [13.3, 44.0], [13.3, 41.6]], [[36.7, 6.9], [40.5, 6.1], [42.1, 6.3], [40.5, 6.1], [36.7, 6.9], [33.1, 9.9], [31.7, 11.8], [33.1, 9.9]]];
const PS_CHEST = [[[60.2, 25.5], [61.2, 26.2], [61.7, 27.1], [61.2, 26.2], [60.2, 25.5], [59.1, 26.8], [58.7, 27.8], [59.1, 26.8]], [[68.9, 25.8], [70.0, 27.1], [70.4, 28.2], [70.0, 27.1], [68.9, 25.8], [67.9, 26.5], [67.4, 27.3], [67.9, 26.5]], [[76.5, 32.6], [76.7, 34.4], [76.8, 35.7], [76.7, 34.4], [76.5, 32.6], [76.1, 32.6], [75.9, 33.2], [76.1, 32.6]], [[74.9, 41.6], [74.2, 43.3], [73.9, 44.5], [74.2, 43.3], [74.9, 41.6], [75.5, 41.8], [75.7, 42.3], [75.5, 41.8]], [[67.8, 45.9], [66.8, 47.1], [66.3, 48.1], [66.8, 47.1], [67.8, 45.9], [68.9, 46.6], [69.3, 47.3], [68.9, 46.6]], [[59.1, 45.6], [58.0, 46.2], [57.6, 46.9], [58.0, 46.2], [59.1, 45.6], [60.1, 46.9], [60.6, 47.9], [60.1, 46.9]], [[51.5, 38.9], [51.3, 38.9], [51.2, 39.4], [51.3, 38.9], [51.5, 38.9], [51.9, 40.7], [52.1, 41.9], [51.9, 40.7]], [[53.1, 29.8], [53.8, 30.0], [54.1, 30.6], [53.8, 30.0], [53.1, 29.8], [52.5, 31.5], [52.3, 32.8], [52.5, 31.5]]];
(function loadPlayerSheet() {
  const im = new Image();
  im.onload = () => { PSHEET.ok = true; };
  im.src = "img/player_camera.png";
  PSHEET.img = im;
})();
function useSpriteChar() { return PSHEET.ok && !save.classicChar && !game.over; }
// linha = direção na tela (0 = cima, sentido horário)
function sheetRow(vx, vy) { const a = Math.atan2(vx, -vy); return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; }
function angDelta(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
// gira o corpo suavemente atrás da mira e só troca de direção com uma folga (sem tremer na divisa)
function spriteTick(dt) {
  const p = player;
  if (p.dispAng == null) p.dispAng = p.angle;
  const d = angDelta(p.dispAng, p.angle), maxStep = 14 * dt / 1000;
  p.dispAng += Math.abs(d) <= maxStep ? d : Math.sign(d) * maxStep;
  const center = (r) => -Math.PI / 2 + r * Math.PI / 4; // ângulo da tela (atan2(y, x)) no meio de cada linha
  if (p.sRow == null) p.sRow = sheetRow(Math.cos(p.dispAng), Math.sin(p.dispAng));
  if (Math.abs(angDelta(center(p.sRow), p.dispAng)) > Math.PI / 8 + 0.12) p.sRow = sheetRow(Math.cos(p.dispAng), Math.sin(p.dispAng));
  // passos pela distância andada: os pés acompanham o chão
  if (p.moving) p.stepDist = (p.stepDist || 0) + (p.lastSp || 0) * dt / 16.67;
}
function spriteFrame() { const p = player; return p.moving ? Math.floor((p.stepDist || 0) / PSHEET.stride) % 8 : 1; }
function spriteOrigin() { const S = PSHEET.size; return { x: player.x - S / 2, y: player.y + 6 - S * PSHEET.footY }; }
// ponto do quadro (px de 0 a 128) -> mundo
function spritePoint(tab) {
  const o = spriteOrigin(), k = PSHEET.size / PSHEET.cell, pt = tab[player.sRow | 0][spriteFrame()];
  return { x: o.x + pt[0] * k, y: o.y + pt[1] * k };
}
function muzzlePoint() { return useSpriteChar() ? spritePoint(PS_MUZZLE) : null; }
function chestPoint() { return useSpriteChar() ? spritePoint(PS_CHEST) : { x: player.x, y: player.y }; }

function drawPlayerSprite() {
  if (!useSpriteChar()) return false;
  const p = player, S = PSHEET.size, c = PSHEET.cell, row = p.sRow | 0, col = spriteFrame();
  const kick = p.flashT > 0 ? 2 : 0, o = spriteOrigin();
  ctx.drawImage(PSHEET.img, col * c, row * c, c, c, o.x - Math.cos(p.angle) * kick, o.y - Math.sin(p.angle) * kick, S, S);
  // lanterna de peito (aparece quando o peito está virado para a câmera)
  if (row >= 1 && row <= 7) {
    const L = chestPoint(), a = row === 1 || row === 7 ? 0.55 : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, 7);
    g.addColorStop(0, "rgba(255,240,190,0.95)"); g.addColorStop(1, "rgba(255,220,140,0)");
    ctx.fillStyle = g; circle(L.x, L.y, 7);
    ctx.restore();
    ctx.fillStyle = "#1c1c1c"; ctx.fillRect(L.x - 2.5, L.y - 2, 5, 4);
    ctx.fillStyle = "#fff4cf"; circle(L.x, L.y, 1.6);
  }
  // clarão do tiro na ponta do cano
  const w = curW();
  if (p.flashT > 0 && !w.melee) {
    const m = muzzlePoint(), ang = p.shotAng != null ? p.shotAng : p.angle;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.translate(m.x, m.y); ctx.rotate(ang);
    ctx.fillStyle = "rgba(255,220,120,0.9)"; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(18, 0); ctx.lineTo(0, 6); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,220,0.9)"; circle(2, 0, 4);
    ctx.restore();
  }
  return true;
}

// ---------- Atmosfera: cone da lanterna, neblina azulada e vinheta ----------
function drawAtmosphere() {
  if (game.over) return;
  const dark = game.inside ? 0.3 : darkness();
  const L = chestPoint(), px = L.x - cam.x, py = L.y - cam.y, a = player.angle;
  // cone amarelado da lanterna na direção da mira
  const reach = 360, half = 0.42, I = 0.05 + dark * 0.22;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(px, py, 12, px, py, reach);
  g.addColorStop(0, `rgba(255,214,140,${I})`); g.addColorStop(0.55, `rgba(255,200,120,${I * 0.55})`); g.addColorStop(1, "rgba(255,190,110,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, reach, a - half, a + half); ctx.closePath(); ctx.fill();
  ctx.restore();
  // neblina azulada (mais forte longe do personagem)
  const fog = ctx.createRadialGradient(px, py, 140, px, py, Math.max(W, H) * 0.8);
  fog.addColorStop(0, "rgba(70,100,140,0)"); fog.addColorStop(1, `rgba(60,88,128,${game.inside ? 0.16 : 0.26})`);
  ctx.fillStyle = fog; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(40,70,110,0.06)"; ctx.fillRect(0, 0, W, H);
  // vinheta escura
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,6,0.55)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
