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

function drawLampTall(l, e) {
  const top = proj(l.x, l.y, l.big ? 70 : 55, e);
  ctx.strokeStyle = "#1c1c1c"; ctx.lineWidth = l.big ? 4 : 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(top.x, top.y); ctx.stroke();
  ctx.fillStyle = "#2a2a2a"; circle(top.x, top.y, l.big ? 6 : 4.5);
  ctx.fillStyle = isNight() ? "#ffe6a0" : "#9a9a90"; circle(top.x, top.y, l.big ? 3.5 : 2.5);
}
// pinta de trás (norte) para a frente (sul) pela linha do chão de cada coisa:
// quem está na frente de um prédio aparece por cima da parede; quem está atrás fica escondido
function drawSortedScene() {
  const e = eye(), list = [];
  for (const b of world.buildings) if (inView(b.x - 140, b.y - 40, b.w + 280, b.h + 260)) list.push({ y: b.y + b.h, f: () => drawBuildingTall(b, e) });
  for (const l of world.lamps) if (inView(l.x - 80, l.y - 120, 160, 200)) list.push({ y: l.y, f: () => drawLampTall(l, e) });
  for (const z of Zs()) if (inView(z.x - 60, z.y - 120, 120, 160)) list.push({ y: z.y, f: () => { drawZombie(z); drawZombieExtra(z); } });
  const es = game.escort;
  if (es && !game.over) list.push({ y: es.y, f: () => drawSurvivor(es.x, es.y, es.ang, es.walk, es.moving) });
  if (!game.over) list.push({ y: player.y + 0.5, f: () => { if (!drawPlayerSprite()) drawPlayer(); } });
  list.sort((a, b) => a.y - b.y);
  for (const it of list) it.f();
}
// (compatibilidade) só prédios e postes
function drawTall() {
  if (game.inside) return;
  const e = eye();
  for (const l of world.lamps) if (inView(l.x - 80, l.y - 120, 160, 200)) drawLampTall(l, e);
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

// ---------- Personagem: uma spritesheet por pose de arma (8 direções × 8 quadros, 128 px) ----------
// O corpo vem sem arma; cada arma do jogo é desenhada nas mãos usando os pontos de
// SPRITE_POSES (empunhadura, eixo da arma, mãos e lanterna), gerados em tools/gerar_variantes.py.
const PSHEET = { ok: false, cell: 128, size: 72, footY: 0.82, stride: 12.5, sheets: {} };
const POSES = ["longa", "pesada", "pistola", "melee", "punhos"];
(function loadPlayerSheets() {
  let n = 0;
  for (const pose of POSES) {
    const im = new Image();
    im.onload = () => { if (++n === POSES.length) PSHEET.ok = true; };
    im.src = `img/player_${pose}.png`;
    PSHEET.sheets[pose] = im;
  }
})();
// qual pose de braços cada arma usa
function weaponPose(w) {
  if (!w || w.fists) return "punhos";
  if (w.look === "chainsaw") return "pesada";
  if (w.melee) return "melee";
  if (w.look === "pistol" || w.look === "revolver") return "pistola";
  if (w.look === "minigun" || w.look === "lmg" || w.look === "flamer") return "pesada";
  return "longa";
}
// tamanho de verdade (metros) de cada tipo de arma, para ficar proporcional ao corpo
const WEAPON_M = { pistol: 0.24, revolver: 0.27, smg: 0.5, ar: 0.82, rifle: 1.0, shotgun: 0.95, lmg: 1.0, minigun: 1.0, flamer: 0.9,
  crossbow: 0.72, knife: 0.32, machete: 0.58, katana: 0.98, sword: 0.92, bat: 0.82, axe: 0.78, hammer: 0.82, chainsaw: 0.9 };
function weaponMeters(w) { return WEAPON_M[w.look] || (w.melee ? 0.6 : 0.85); }

function useSpriteChar() { return PSHEET.ok && typeof SPRITE_POSES !== "undefined" && !save.classicChar && !game.over; }
function sheetRow(vx, vy) { const a = Math.atan2(vx, -vy); return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; }
function angDelta(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
// gira o corpo suavemente atrás da mira e só troca de direção com uma folga (sem tremer na divisa)
function spriteTick(dt) {
  const p = player;
  if (p.dispAng == null) p.dispAng = p.angle;
  const d = angDelta(p.dispAng, p.angle), maxStep = 14 * dt / 1000;
  p.dispAng += Math.abs(d) <= maxStep ? d : Math.sign(d) * maxStep;
  const center = (r) => -Math.PI / 2 + r * Math.PI / 4;
  if (p.sRow == null) p.sRow = sheetRow(Math.cos(p.dispAng), Math.sin(p.dispAng));
  if (Math.abs(angDelta(center(p.sRow), p.dispAng)) > Math.PI / 8 + 0.12) p.sRow = sheetRow(Math.cos(p.dispAng), Math.sin(p.dispAng));
  if (p.moving) p.stepDist = (p.stepDist || 0) + (p.lastSp || 0) * dt / 16.67;
}
function spriteFrame() { const p = player; return p.moving ? Math.floor((p.stepDist || 0) / PSHEET.stride) % 8 : 1; }
function spriteOrigin() { const S = PSHEET.size; return { x: player.x - S / 2, y: player.y + 6 - S * PSHEET.footY }; }
// ponto do quadro atual (px de 0 a 128) -> mundo
function posePt(key, pose) {
  pose = pose || weaponPose(curW());
  const o = spriteOrigin(), k = PSHEET.size / PSHEET.cell, pt = SPRITE_POSES[pose][player.sRow | 0][spriteFrame()][key];
  return { x: o.x + pt[0] * k, y: o.y + pt[1] * k };
}
// ponta do cano da arma em uso
function muzzlePoint() {
  if (!useSpriteChar()) return null;
  const w = curW(); if (w.melee) return null;
  const A = posePt("a"), B = posePt("b"), m = weaponMeters(w);
  return { x: A.x + (B.x - A.x) * m, y: A.y + (B.y - A.y) * m };
}
function chestPoint() { return useSpriteChar() ? posePt("c") : { x: player.x, y: player.y }; }

// desenha a arma em uso nas mãos, seguindo o eixo da pose naquele quadro
function drawHeldWeapon(w, pose) {
  if (w.fists) return;
  const A = posePt("a", pose), B = posePt("b", pose), U = posePt("u", pose);
  const m = weaponMeters(w), axX = B.x - A.x, axY = B.y - A.y;
  const lenPx = Math.hypot(axX, axY) * m, pxPerM = PSHEET.size / PSHEET.cell * 64;
  let ang = Math.atan2(axY, axX);
  const thick = clamp(0.5 + 0.5 * Math.hypot(U.x - A.x, U.y - A.y) / (0.1 * pxPerM), 0.55, 1);
  ctx.save(); ctx.translate(A.x, A.y);
  if (w.melee) {
    // golpe: a lâmina varre de um lado para o outro em volta da mão
    if (game.slashT > 0) ang += (-1 + (1 - game.slashT / 200) * 2) * (game.slashA || 0.9) * 1.2 + (player.angle - ang) * 0.6;
    ctx.rotate(ang);
    const model = (w.len || 20) + 18;
    ctx.scale(Math.max(0.25, lenPx / model), thick); ctx.translate(-8, -6);
    drawWeaponShape(w, 0);
  } else {
    ctx.rotate(ang);
    const model = (w.len || 20) + 20, start = w.look === "pistol" || w.look === "revolver" ? 10 : 0;
    ctx.scale(Math.max(0.2, lenPx / (model - start)), thick); ctx.translate(-start, 0);
    if (w.tint) ctx.filter = w.tint;
    drawWeaponShape(w, 0);
    ctx.filter = "none";
  }
  ctx.restore();
}

function drawPlayerSprite() {
  if (!useSpriteChar()) return false;
  const p = player, w = curW(), pose = weaponPose(w), S = PSHEET.size, c = PSHEET.cell, row = p.sRow | 0, col = spriteFrame();
  const kick = p.flashT > 0 ? 2 : 0, o = spriteOrigin(), info = SPRITE_POSES[pose][row][col];
  if (info.bh) drawHeldWeapon(w, pose);       // arma atrás do corpo (de costas)
  ctx.drawImage(PSHEET.sheets[pose], col * c, row * c, c, c, o.x - Math.cos(p.angle) * kick, o.y - Math.sin(p.angle) * kick, S, S);
  if (!info.bh) drawHeldWeapon(w, pose);      // arma na frente do corpo
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
  if (p.flashT > 0 && !w.melee) {
    const m = muzzlePoint(), ang = p.shotAng != null ? p.shotAng : p.angle;
    if (m) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.translate(m.x, m.y); ctx.rotate(ang);
      ctx.fillStyle = "rgba(255,220,120,0.9)"; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(18, 0); ctx.lineTo(0, 6); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,220,0.9)"; circle(2, 0, 4);
      ctx.restore();
    }
  }
  return true;
}

// ---------- Zumbis humanoides com spritesheet (mesmo estilo e câmera) ----------
const ZSHEET = { ok: false, sheets: {}, base: 72 };
(function loadZombieSheets() {
  const names = ["z_walker", "z_walker2", "z_runner", "z_brute", "z_hazmat"];
  let n = 0;
  for (const nm of names) { const im = new Image(); im.onload = () => { if (++n === names.length) ZSHEET.ok = true; }; im.src = `img/${nm}.png`; ZSHEET.sheets[nm] = im; }
})();
function zombieSheet(z) {
  z.var = z.var == null ? Math.random() : z.var;
  switch (z.type) {
    case "walker": return z.var < 0.5 ? "z_walker" : "z_walker2";
    case "runner": case "infected": return "z_runner";
    case "brute": return "z_brute";
    case "hazmat": return "z_hazmat";
    case "spitter": return "z_walker2";
    case "toxic": return "z_walker";
    default: return null;
  }
}
// ---------- Corpo do zumbi para os acertos ----------
// O ponto do zumbi (z.x, z.y) é onde ele pisa; com o desenho em pé, o corpo vai dos pés até
// a cabeça. O acerto usa uma cápsula vertical com essa altura e a largura do zumbi (z.r).
function zBodyH(z) {
  if (!ZSHEET.ok || save.classicChar || z.boss) return 0;
  const nm = zombieSheet(z); if (!nm) return 0;
  return ZSHEET.base * (z.r / 13) / (nm === "z_brute" ? 1.4 : 1) * 0.6;
}
function zDist(z, x, y) {
  const h = zBodyH(z);
  if (!h) return Math.hypot(x - z.x, y - z.y);
  return Math.hypot(x - z.x, y - clamp(y, z.y - h, z.y));
}
function zCenter(z) { return { x: z.x, y: z.y - zBodyH(z) / 2 }; }

// desenha o zumbi com a spritesheet; devolve false se o tipo não tiver (cães, mutantes, chefes...)
function drawZombieSprite(z) {
  if (!ZSHEET.ok || save.classicChar || z.boss) return false;
  const nm = zombieSheet(z); if (!nm) return false;
  const big = nm === "z_brute", S = ZSHEET.base * (z.r / 13) / (big ? 1.4 : 1);
  const row = sheetRow(Math.cos(z.angle), Math.sin(z.angle));
  const TAU = Math.PI * 2, col = Math.floor((((z.anim || 0) % TAU) + TAU) % TAU / TAU * 8) % 8;
  const lunge = z.lunge > 0 ? 5 : 0, x = z.x - S / 2 + Math.cos(z.angle) * lunge, y = z.y + 6 - S * 0.82 + Math.sin(z.angle) * lunge;
  if (z.type === "toxic") ctx.filter = "hue-rotate(55deg) saturate(1.5)";
  else if (z.type === "infected") ctx.filter = "brightness(0.8) contrast(1.15)";
  ctx.drawImage(ZSHEET.sheets[nm], col * 128, row * 128, 128, 128, x, y, S, S);
  ctx.filter = "none";
  if (z.flash > 0) { ctx.save(); ctx.globalAlpha = 0.55; ctx.globalCompositeOperation = "lighter"; ctx.drawImage(ZSHEET.sheets[nm], col * 128, row * 128, 128, 128, x, y, S, S); ctx.restore(); }
  if (z.type === "spitter") {
    const pulse = 0.8 + 0.2 * Math.sin(game.time / 150);
    ctx.fillStyle = `rgba(143,209,79,${0.75 * pulse})`; circle(z.x - Math.cos(z.angle) * 5, z.y - S * 0.42, 6 * pulse * S / 86);
  }
  const top = z.y - S * 0.72;
  if (z.state === "chase") { ctx.fillStyle = "rgba(255,60,40,0.9)"; circle(z.x + Math.cos(z.angle) * 3, top + S * 0.08, 1.6); }
  if (z.alertT > 0) txt("!", z.x, top - 6, 20, "#e03a2f", "center", true);
  if (z.hp < z.maxHp) {
    ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(z.x - 13, top - 4, 26, 4);
    ctx.fillStyle = "#c0392b"; ctx.fillRect(z.x - 13, top - 4, 26 * Math.max(0, z.hp / z.maxHp), 4);
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
