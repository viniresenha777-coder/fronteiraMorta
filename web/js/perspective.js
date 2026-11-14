"use strict";
// =====================================================================
//  Câmera aérea com perspectiva ("olho de pássaro"): a câmera fica bem
//  alta, em cima do centro da tela, olhando quase reto para baixo.
//  Tudo que tem altura (prédios, árvores, postes) é projetado a partir
//  desse ponto: quanto mais alto e mais longe do centro, mais o topo se
//  afasta, e as paredes viradas para a câmera aparecem.
// =====================================================================
const CAM_H = 1100;                // altura da câmera (em pixels do mundo)
const PERSPECTIVE = true;

function eye() { return { x: cam.x + W / 2, y: cam.y + H / 2 }; }
// ponto (x, y) a uma altura h, visto pela câmera
function proj(x, y, h, e) { const k = CAM_H / (CAM_H - h); return { x: e.x + (x - e.x) * k, y: e.y + (y - e.y) * k }; }

function bHeight(b) {
  if (b.safe) return 70;
  if (b.type === "guarita" || b.noDoor) return 38;
  const f = buildingFloors(b);
  return b.landmark ? 46 + f * 40 : 30 + f * 34;
}
function bFloorsVis(b) { return b.safe ? 2 : b.noDoor ? 1 : buildingFloors(b); }

// chão do prédio (sombra, base e porta): desenhado junto com a rua
function drawBuildingGround(b) {
  const h = bHeight(b);
  ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(b.x + 6, b.y + 8, b.w + h * 0.12, b.h + h * 0.16);
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
    // linha do andar
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
  if (e.y < y0) drawWall(b, x0, y0, x1, y0, h, e, -0.05);   // parede de cima
  if (e.y > y1) drawWall(b, x0, y1, x1, y1, h, e, -0.32);   // parede de baixo
  if (e.x < x0) drawWall(b, x0, y0, x0, y1, h, e, -0.18);   // parede da esquerda
  if (e.x > x1) drawWall(b, x1, y0, x1, y1, h, e, -0.4);    // parede da direita
  // telhado: o mesmo desenho de antes, ampliado a partir da câmera
  const k = CAM_H / (CAM_H - h);
  ctx.save(); ctx.translate(e.x, e.y); ctx.scale(k, k); ctx.translate(-e.x, -e.y);
  if (b.roof === "pitched") drawPitched(b); else drawFlat(b);
  ctx.restore();
}

// tudo que é alto, desenhado por cima do chão e das criaturas
function drawTall() {
  if (game.inside) return;
  const e = eye();
  // postes
  for (const l of world.lamps) {
    if (!inView(l.x - 80, l.y - 80, 160, 160)) continue;
    const top = proj(l.x, l.y, l.big ? 70 : 55, e);
    ctx.strokeStyle = "#1c1c1c"; ctx.lineWidth = l.big ? 4 : 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    ctx.fillStyle = "#2a2a2a"; circle(top.x, top.y, l.big ? 6 : 4.5);
    ctx.fillStyle = isNight() ? "#ffe6a0" : "#9a9a90"; circle(top.x, top.y, l.big ? 3.5 : 2.5);
  }
  // prédios: os mais longe da câmera primeiro
  const list = world.buildings.filter((b) => inView(b.x - 140, b.y - 140, b.w + 280, b.h + 280));
  list.sort((a, b) => Math.hypot(b.x + b.w / 2 - e.x, b.y + b.h / 2 - e.y) - Math.hypot(a.x + a.w / 2 - e.x, a.y + a.h / 2 - e.y));
  for (const b of list) drawBuildingTall(b, e);
}

// copas das árvores lá em cima, com tronco ligando ao chão
function drawCanopiesP() {
  const e = eye();
  for (const t of world.trees) {
    if (!inView(t.x - t.r * 2.5, t.y - t.r * 2.5, t.r * 5, t.r * 5)) continue;
    const th = 48 + t.r * 1.2, k = CAM_H / (CAM_H - th), c = proj(t.x, t.y, th, e);
    const under = Math.hypot(player.x - c.x, player.y - c.y) < t.r * k * 1.05;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,0.28)"; circle(t.x + 8, t.y + 10, t.r * 0.95);
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
