"use strict";
// Visibilidade da lanterna. Uma máscara separada do sombreamento ambiental:
// 0 = luz livre; alpha 1 = superfície/atrás de obstáculo alto.
// O mesmo resultado é usado no WebGL e no renderizador Canvas 2D.
const FLASH_BLOCK = { canvas: null, ctx: null, cut: null, cutCtx: null };
const FLASH_RANGE = 475;
const FLASH_SHADOW_LENGTH = 1900;

function flashCanvas() {
  if (!FLASH_BLOCK.canvas) {
    FLASH_BLOCK.canvas = document.createElement("canvas");
    FLASH_BLOCK.canvas.width = Math.ceil(W / 2);
    FLASH_BLOCK.canvas.height = Math.ceil(H / 2);
    FLASH_BLOCK.ctx = FLASH_BLOCK.canvas.getContext("2d");
  }
  return FLASH_BLOCK.canvas;
}
function flashCutCanvas() {
  if (!FLASH_BLOCK.cut) {
    FLASH_BLOCK.cut = document.createElement("canvas");
    FLASH_BLOCK.cut.width = W;
    FLASH_BLOCK.cut.height = H;
    FLASH_BLOCK.cutCtx = FLASH_BLOCK.cut.getContext("2d");
  }
  return FLASH_BLOCK.cut;
}
function flashPolygon(c, points) {
  c.beginPath();
  c.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
  c.closePath();
  c.fill();
}
function flashExtrude(c, source, a, b) {
  const dx1 = a[0] - source.x, dy1 = a[1] - source.y;
  const dx2 = b[0] - source.x, dy2 = b[1] - source.y;
  const d1 = Math.max(1, Math.hypot(dx1, dy1));
  const d2 = Math.max(1, Math.hypot(dx2, dy2));
  flashPolygon(c, [
    a, b,
    [b[0] + dx2 / d2 * FLASH_SHADOW_LENGTH, b[1] + dy2 / d2 * FLASH_SHADOW_LENGTH],
    [a[0] + dx1 / d1 * FLASH_SHADOW_LENGTH, a[1] + dy1 / d1 * FLASH_SHADOW_LENGTH]
  ]);
}
// A base bloqueia a lanterna e projeta uma sombra. Para edifícios,
// a cobertura em perspectiva também bloqueia a luz, mas a parede
// que recebe diretamente o feixe continua iluminada.
function flashBlockRect(c, source, x, y, w, h, roofHeight) {
  if (w <= 0 || h <= 0) return;
  if (source.x > x && source.x < x + w && source.y > y && source.y < y + h) return;
  const corners = [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  for (let i = 0; i < 4; i++) flashExtrude(c, source, corners[i], corners[(i + 1) % 4]);
  c.fillRect(x, y, w, h);
  if (!roofHeight) return;

  // Projeção idêntica à utilizada por drawBuildingTall / proj().
  const k = CAM_H / (CAM_H - roofHeight);
  const roof = corners.map(([px,py]) => [
    W / 2 + (px - W / 2) * k,
    H / 2 + (py - H / 2) * k - roofHeight * LEAN
  ]);
  flashPolygon(c, roof);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    flashPolygon(c, [corners[i], corners[j], roof[j], roof[i]]);
  }

  // Uma lanterna ilumina a fachada voltada para ela, mas nunca
  // o telhado ou o espaço atrás. Restaura SOMENTE essa parede.
  c.save();
  c.globalCompositeOperation = "destination-out";
  if (source.y < y) flashPolygon(c, [corners[0], corners[1], roof[1], roof[0]]);
  if (source.y > y + h) flashPolygon(c, [corners[2], corners[3], roof[3], roof[2]]);
  if (source.x < x) flashPolygon(c, [corners[3], corners[0], roof[0], roof[3]]);
  if (source.x > x + w) flashPolygon(c, [corners[1], corners[2], roof[2], roof[1]]);
  c.restore();
}
// Coluna circular: só os raios que encostam no poste são interrompidos.
// O restante do cone passa pelos dois lados, formando sombra estreita.
function flashBlockCircle(c, source, x, y, r) {
  const dx = x - source.x, dy = y - source.y, d = Math.hypot(dx, dy);
  if (d < r + 1) return;
  const nx = -dy / d, ny = dx / d;
  const a = [x + nx * r, y + ny * r];
  const b = [x - nx * r, y - ny * r];
  flashExtrude(c, source, a, b);
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
function flashInBeam(source, x, y, r) {
  const dx = x - source.x, dy = y - source.y;
  const distance = Math.hypot(dx, dy);
  if (distance > FLASH_RANGE + r || distance < 0.01) return false;
  // Não constrói sombras de objetos muito atrás do foco.
  const forward = (dx * source.ax + dy * source.ay) / distance;
  return forward > -Math.min(0.8, r / distance + 0.12);
}
function flashlightBlocks() {
  const mask = flashCanvas(), c = FLASH_BLOCK.ctx;
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0, 0, mask.width, mask.height);
  // Durante o dia não há feixe a bloquear: economiza CPU e garante a luz desligada.
  if (game.inside || game.over || !world || !player || !flashlightActive()) return mask;
  c.setTransform(0.5,0,0,0.5,0,0);
  c.globalCompositeOperation = "source-over";
  c.fillStyle = "#000";
  const chest = typeof chestPoint === "function" ? chestPoint() : player;
  const angle = player.angle;
  const source = {
    x: chest.x - cam.x, y: chest.y - cam.y,
    ax: Math.cos(angle), ay: Math.sin(angle)
  };
  const near = (x,y,r) => flashInBeam(source,x,y,r);

  // Casas e prédios: corpo inteiro mais telhado em perspectiva.
  for (const b of world.buildings || []) {
    const x=b.x-cam.x, y=b.y-cam.y, radius=Math.hypot(b.w,b.h)/2;
    if (!near(x + b.w / 2, y + b.h / 2, radius)) continue;
    flashBlockRect(c, source, x, y, b.w, b.h,
      typeof bHeight === "function" ? bHeight(b) : 70);
  }

  // Postes: a sombra afeta só a faixa dos raios que cruzam a haste.
  for (const l of world.lamps || []) {
    const x=l.x-cam.x, y=l.y-cam.y, r=l.big?4:3;
    if (near(x,y,r)) flashBlockCircle(c,source,x,y,r);
  }

  // Árvores altas: copa como volume opaco, não só o tronco fino.
  for (const t of world.trees || []) {
    const x=t.x-cam.x, y=t.y-cam.y, r=Math.max(9,t.r*0.65);
    if (near(x,y,r)) flashBlockCircle(c,source,x,y,r);
  }

  // Modelos mais altos que o jogador (contêiner, torre, tanque...).
  for (const m of world.models || []) {
    if (typeof MODEL_TALL === "undefined" || !MODEL_TALL.has(m.id.replace(/_\d+$/,""))) continue;
    const x=m.x-cam.x, y=m.y-cam.y;
    if (m.id==="worklight") {
      if (near(x,y,4)) flashBlockCircle(c,source,x,y,4);
    } else if (typeof modelRect==="function") {
      const r=modelRect(m.id,m.x,m.y,m.k);
      const rad=Math.hypot(r.w,r.h)/2;
      if (near(x,y,rad))
        flashBlockRect(c,source,r.x-cam.x,r.y-cam.y,r.w,r.h,0);
    }
  }
  // Furgões altos também fazem sombra, mas carros baixos não.
  for (const car of world.cars || []) {
    const id=typeof carModel==="function"?carModel(car):null;
    if (id!=="van" && id!=="van_90") continue;
    const x=car.x-cam.x, y=car.y-cam.y;
    if (near(x+car.w/2,y+car.h/2,Math.hypot(car.w,car.h)/2))
      flashBlockRect(c,source,x,y,car.w,car.h,0);
  }
  c.setTransform(1,0,0,1,0,0);
  return mask;
}
