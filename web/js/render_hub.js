"use strict";
// =====================================================================
//  Tela da base: ao entrar num posto seguro aparece a planta da base
//  (salas clicáveis) e, à esquerda, o personagem com as armas e a munição.
// =====================================================================
const HUB_ROOMS = [
  { kind: "shopc",  name: "Loja",           x: 300, y: 92,  w: 190, h: 120, furn: "shelves" },
  { kind: "bank",   name: "Banco",          x: 506, y: 92,  w: 150, h: 120, furn: "counter" },
  { kind: "travel", name: "Rádio · Viagem", x: 672, y: 92,  w: 160, h: 120, furn: "radio" },
  { kind: "board",  name: "Missões",        x: 300, y: 228, w: 150, h: 130, furn: "tables" },
  { kind: "craft",  name: "Oficina",        x: 466, y: 228, w: 210, h: 130, furn: "bench" },
  { kind: "clinic", name: "Clínica",        x: 692, y: 228, w: 140, h: 130, furn: "beds" },
  { kind: "stash",  name: "Baú da base",    x: 300, y: 374, w: 190, h: 110, furn: "crates" },
  { kind: "junk",   name: "Ferro Velho",    x: 506, y: 374, w: 166, h: 110, furn: "junk" },
  { kind: "exit",   name: "Sair para a rua", x: 688, y: 374, w: 144, h: 110, furn: "gate" }
];

function openStation(kind) {
  mouse.down = false; game.clicks = [];   // o clique seguinte só vale para o que for desenhado depois
  if (kind === "exit") { leaveHouse(); return; }
  if (kind === "shopc") { openShop(); return; }
  if (kind === "junk") { game.menu = "junk"; game.jcur = 0; game.jconfirm = null; return; }
  game.menu = kind === "board" ? "missions" : kind;
  game.atBase = true; game.tab = 0; game.cur = 0; game.input = null; game.vside = 0; game.vcur = 0; game.ccur = 0; game.cstat = 0;
}

function shadowTxt(s, x, y, size, color, align, bold, maxW) {
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 4; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
  txt(s, x, y, size, color, align, bold, maxW); ctx.restore();
}
function hubBar(x, y, w, label, v, max, color) {
  txt(label, x, y, 11, "#c9c4ad", "left", true);
  txt(`${Math.round(v)} / ${Math.round(max)}`, x + w, y, 11, color, "right", true);
  ctx.fillStyle = "rgba(0,0,0,0.6)"; rr(x, y + 4, w, 6, 3); ctx.fill();
  ctx.fillStyle = color; rr(x, y + 4, Math.max(0, w * Math.min(1, v / max)), 6, 3); ctx.fill();
}

// personagem de frente (desenhado com as cores da roupa escolhida)
function drawHero(cx, cy, s) {
  const pal = SKINS[save.skin] || SKINS[0];
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,0.45)"; ellipse(0, 92, 46, 10);
  // pernas e botas
  ctx.fillStyle = pal.pants; rr(-20, 20, 17, 66, 5); ctx.fill(); rr(3, 20, 17, 66, 5); ctx.fill();
  ctx.fillStyle = "#1e1a16"; rr(-22, 80, 21, 12, 4); ctx.fill(); rr(1, 80, 21, 12, 4); ctx.fill();
  ctx.fillStyle = "#4a3a26"; ctx.fillRect(-22, 18, 44, 6);
  // braços
  ctx.fillStyle = pal.jacket; rr(-36, -38, 13, 58, 6); ctx.fill(); rr(23, -38, 13, 58, 6); ctx.fill();
  ctx.fillStyle = pal.skin === "#141414" || pal.mask || pal.helmet ? "#2a2a2a" : pal.skin;
  circle(-29.5, 24, 6); circle(29.5, 24, 6);
  // tronco
  ctx.fillStyle = pal.jacket; rr(-24, -42, 48, 66, 10); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(-1, -40, 2, 62);
  if (pal.accent) { ctx.strokeStyle = pal.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, -36); ctx.lineTo(20, 18); ctx.stroke(); }
  if (save.vest >= 0) {
    ctx.fillStyle = VESTS[save.vest].color; rr(-20, -36, 40, 50, 7); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)"; for (let i = 0; i < 3; i++) ctx.fillRect(-14 + i * 10, -6, 8, 12);
  }
  ctx.fillStyle = "#5a4a32"; ctx.fillRect(-26, -40, 6, 30); // alça da mochila
  // pescoço e cabeça
  ctx.fillStyle = pal.mask || pal.helmet ? "#2a2a2a" : pal.skin === "#141414" ? "#1a1a1a" : pal.skin; ctx.fillRect(-6, -50, 12, 10);
  if (pal.hood || pal.helmet) {
    ctx.fillStyle = pal.hood || pal.helmet; circle(0, -66, 20);
    ctx.fillStyle = pal.helmet ? "#1a1a1a" : pal.skin; ellipse(0, -62, 12, 13);
    if (pal.helmet) { ctx.fillStyle = pal.accent || "#888"; ctx.fillRect(-12, -68, 24, 5); }
    else { ctx.fillStyle = "rgba(220,220,200,0.5)"; circle(-5, -64, 1.6); circle(5, -64, 1.6); }
  } else if (pal.mask) {
    ctx.fillStyle = pal.mask; circle(0, -66, 18);
    ctx.fillStyle = "#151515"; circle(-7, -69, 5); circle(7, -69, 5);
    ctx.fillStyle = "#5a5d60"; circle(0, -56, 6); ctx.fillStyle = "#2a2a2a"; circle(0, -56, 3);
  } else {
    ctx.fillStyle = pal.skin; ellipse(0, -66, 15, 18);
    ctx.fillStyle = pal.hair; ctx.beginPath(); ctx.ellipse(0, -74, 16, 11, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1410"; circle(-5, -66, 1.8); circle(5, -66, 1.8);
    ctx.strokeStyle = "rgba(60,30,20,0.6)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -56); ctx.lineTo(4, -56); ctx.stroke();
    if (pal.cap) { ctx.fillStyle = pal.cap; ctx.beginPath(); ctx.ellipse(0, -76, 17, 10, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillRect(-17, -77, 34, 4); }
    if (pal.band) { ctx.fillStyle = pal.band; ctx.fillRect(-15, -76, 30, 5); }
    if (pal.glasses) { ctx.fillStyle = "#111"; rr(-12, -70, 10, 6, 2); ctx.fill(); rr(2, -70, 10, 6, 2); ctx.fill(); ctx.fillRect(-2, -68, 4, 2); }
  }
  ctx.restore();
  // arma em uso atravessada no corpo
  const d = curW();
  if (d && !d.fists) { ctx.save(); ctx.translate(cx + 4 * s, cy - 6 * s); ctx.rotate(-0.35); drawWeaponSide(d, 0, 0, 0.8 * s); ctx.restore(); }
}

function drawHubRoom(r) {
  const hov = mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h;
  const { x, y, w, h } = r, wall = 12;
  // sombra e chão
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x + 8, y + 10, w, h);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, r.kind === "exit" ? "#2a2c28" : "#3a3328"); g.addColorStop(1, r.kind === "exit" ? "#1c1e1b" : "#26221c");
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // piso
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
  for (let i = x + 22; i < x + w; i += 22) { ctx.beginPath(); ctx.moveTo(i, y + wall); ctx.lineTo(i, y + h); ctx.stroke(); }
  for (let j = y + wall + 22; j < y + h; j += 22) { ctx.beginPath(); ctx.moveTo(x, j); ctx.lineTo(x + w, j); ctx.stroke(); }
  // paredes com volume (de cima e da esquerda)
  ctx.fillStyle = "#57514a"; ctx.fillRect(x, y, w, wall);
  ctx.fillStyle = "#6c655c"; ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = "#47423c"; ctx.fillRect(x, y, 5, h);
  ctx.fillStyle = "#2c2925"; ctx.fillRect(x + w - 4, y, 4, h); ctx.fillRect(x, y + h - 4, w, 4);
  // móveis de cada sala
  ctx.save(); ctx.beginPath(); ctx.rect(x + 5, y + wall, w - 9, h - wall - 4); ctx.clip();
  const fx = x + 14, fy = y + wall + 10;
  switch (r.furn) {
    case "shelves":
      for (let i = 0; i < 3; i++) { ctx.fillStyle = "#5e5a52"; ctx.fillRect(fx, fy + i * 26, w - 70, 12); for (let k = 0; k < 8; k++) { ctx.fillStyle = ["#a84a3a", "#c9a040", "#4a7aa0", "#6a9a4a"][(k + i) % 4]; ctx.fillRect(fx + 4 + k * ((w - 82) / 8), fy + i * 26 + 2, 7, 8); } }
      ctx.fillStyle = "#6a5236"; ctx.fillRect(x + w - 48, fy, 30, 70); break;
    case "counter":
      ctx.fillStyle = "#6a5236"; ctx.fillRect(fx, fy + 30, w - 30, 14);
      ctx.fillStyle = "#3a3d40"; ctx.fillRect(x + w - 50, fy, 32, 26); ctx.fillStyle = "#7a7e82"; circle(x + w - 34, fy + 13, 7); break;
    case "radio":
      ctx.fillStyle = "#2c2e30"; ctx.fillRect(fx, fy, 60, 30); ctx.fillStyle = "#4ad07a"; ctx.fillRect(fx + 6, fy + 6, 30, 7);
      ctx.strokeStyle = "#9a9a9a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx + 54, fy); ctx.lineTo(fx + 66, fy - 14); ctx.stroke();
      ctx.fillStyle = "#6a5236"; ctx.fillRect(fx, fy + 50, w - 30, 12); break;
    case "tables":
      ctx.fillStyle = "#6a5236"; ctx.fillRect(fx + 6, fy + 18, 60, 34); ctx.fillRect(fx + 76, fy + 18, 40, 34);
      ctx.fillStyle = "#e0d8c0"; ctx.fillRect(fx + 14, fy + 24, 14, 10); ctx.fillRect(fx + 36, fy + 30, 12, 9);
      ctx.fillStyle = "#8a6a3a"; ctx.fillRect(fx, fy - 4, w - 30, 8); break;
    case "bench":
      ctx.fillStyle = "#5e4a36"; ctx.fillRect(fx, fy, w - 30, 18); ctx.fillRect(fx, fy + 54, 90, 18);
      ctx.fillStyle = "#9aa0a6"; ctx.fillRect(fx + 10, fy + 4, 26, 5); ctx.fillRect(fx + 60, fy + 6, 18, 7);
      ctx.fillStyle = "#a84a3a"; ctx.fillRect(fx + 110, fy + 2, 14, 14); ctx.fillStyle = "#4e5a2e"; ctx.fillRect(x + w - 60, fy + 50, 40, 30); break;
    case "beds":
      for (let i = 0; i < 2; i++) { ctx.fillStyle = "#8a9090"; ctx.fillRect(fx + i * 56, fy, 40, 76); ctx.fillStyle = "#d8dcdc"; ctx.fillRect(fx + 3 + i * 56, fy + 3, 34, 70); ctx.fillStyle = "#f6f3ea"; ctx.fillRect(fx + 8 + i * 56, fy + 6, 24, 12); }
      ctx.fillStyle = "#d04040"; ctx.fillRect(x + w - 26, y + h - 30, 4, 14); ctx.fillRect(x + w - 31, y + h - 25, 14, 4); break;
    case "crates":
      for (let i = 0; i < 4; i++) { const cx = fx + i * 38, cy = fy + (i % 2) * 22; ctx.fillStyle = "#8a6a3a"; ctx.fillRect(cx, cy, 32, 28); ctx.strokeStyle = "#4a3820"; ctx.lineWidth = 2; ctx.strokeRect(cx + 1, cy + 1, 30, 26); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 32, cy + 28); ctx.stroke(); }
      ctx.fillStyle = "#d4af37"; ctx.fillRect(fx + 8, fy + 60, 10, 6); break;
    case "junk": {
      // pilhas de sucata, pneus e um carro desmontado
      ctx.fillStyle = "#5a4a3a"; ctx.fillRect(fx + 70, fy + 10, 60, 34); ctx.fillStyle = "#3a3d40"; ctx.fillRect(fx + 76, fy + 14, 22, 12);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = ["#6a5a4a", "#7a6a52", "#8a7a5a", "#4a4a46"][i % 4]; ctx.fillRect(fx + (i * 13) % 56, fy + 40 + (i * 7) % 26, 14, 9); }
      ctx.strokeStyle = "#1e1e1e"; ctx.lineWidth = 4; for (const [a, b] of [[fx + 120, fy + 62], [fx + 138, fy + 70]]) { ctx.beginPath(); ctx.arc(a, b, 8, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = "#c9a040"; ctx.fillRect(x + w - 34, fy - 2, 18, 6); break;
    }
    case "gate":
      ctx.fillStyle = "#3a3a36"; ctx.fillRect(x + w - 70, y + wall, 50, h - wall - 4);
      ctx.strokeStyle = "#6a6a62"; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + w - 66 + i * 10, y + wall); ctx.lineTo(x + w - 66 + i * 10, y + h - 4); ctx.stroke(); }
      ctx.fillStyle = "rgba(255,217,106,0.25)"; for (let i = 0; i < 6; i++) ctx.fillRect(fx + 20 + i * 34, y + h / 2 + 4, 18, 4);
      ctx.fillStyle = "#ffd96a"; poly([[x + w - 96, y + h / 2 - 2], [x + w - 80, y + h / 2 + 6], [x + w - 96, y + h / 2 + 14]], "#ffd96a"); break;
  }
  ctx.restore();
  if (hov) { ctx.fillStyle = "rgba(255,217,106,0.10)"; ctx.fillRect(x, y, w, h); ctx.strokeStyle = "#ffd96a"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); }
  shadowTxt(r.name, x + w / 2, y + h / 2 + 6, 15, hov ? "#ffe9a8" : "#f0c9a0", "center", true, w - 10);
  regClick(x, y, w, h, () => openStation(r.kind));
}

// Arte da base (img/hub.png): uma imagem só com os 9 painéis numa grade 3x3, na mesma ordem de HUB_ROOMS
// (os nomes já vêm escritos na arte). Sem o arquivo, o jogo desenha as salas antigas.
// Arte original em alta resolução (sem miniatura em base64).
const CREDIT_SHOP_BUTTON_ART = new Image();
CREDIT_SHOP_BUTTON_ART.src = "img/loja_creditos_highres.webp?v=20261116-crbutton2";

const FM_BASE_INTERIOR_BG = new Image();
FM_BASE_INTERIOR_BG.src = "img/fm_interior.webp?v=20261116-interior2";

const HUB_ART = new Image();
HUB_ART.onerror = () => { HUB_ART.bad = true; };
HUB_ART.src = "img/hub.png";
// onde fica cada coluna e cada linha de painéis, em fração da largura/altura da imagem
const HUB_COLS = [[0.012, 0.325], [0.349, 0.658], [0.682, 0.988]], HUB_ROWS = [[0.017, 0.315], [0.343, 0.640], [0.666, 0.974]];
function drawHubArt() {
  if (HUB_ART.bad || !HUB_ART.complete || !HUB_ART.naturalWidth) return false;
  const bx = 282, by = 56, bw = 668, bh = 452;
  const k = Math.min(bw / HUB_ART.naturalWidth, bh / HUB_ART.naturalHeight), w = HUB_ART.naturalWidth * k, h = HUB_ART.naturalHeight * k;
  const x = bx + (bw - w) / 2, y = by + (bh - h) / 2;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(HUB_ART, x, y, w, h);
  HUB_ROOMS.forEach((r, i) => {
    const c = HUB_COLS[i % 3], rw = HUB_ROWS[Math.floor(i / 3)];
    const rx = x + c[0] * w, ry = y + rw[0] * h, rW = (c[1] - c[0]) * w, rH = (rw[1] - rw[0]) * h;
    const hov = r.kind !== "shopc" && !game.menu && !game.shop && !game.found && mouse.x >= rx && mouse.x <= rx + rW && mouse.y >= ry && mouse.y <= ry + rH;
    if (hov) {
      ctx.fillStyle = "rgba(255,217,106,0.10)"; ctx.fillRect(rx, ry, rW, rH);
      ctx.strokeStyle = "#ffd96a"; ctx.lineWidth = 2; ctx.strokeRect(rx + 1, ry + 1, rW - 2, rH - 2);
    }
    regClick(rx, ry, rW, rH, () => openStation(r.kind));
  });
  return true;
}

function drawHub() {
  const h = game.inside;
  ctx.fillStyle = "#0b0c0a"; ctx.fillRect(0, 0, W, H);
  // Arte original do interior do abrigo: atrás dos painéis e das salas.
  if (FM_BASE_INTERIOR_BG.complete && FM_BASE_INTERIOR_BG.naturalWidth) {
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.drawImage(FM_BASE_INTERIOR_BG, 0, 0, W, H);
    ctx.restore();
  }
  const vg = ctx.createRadialGradient(610, 300, 60, 610, 300, 520);
  vg.addColorStop(0, "rgba(32,33,29,0.26)");
  vg.addColorStop(1, "rgba(7,9,8,0.62)");
  ctx.fillStyle = vg; ctx.fillRect(0, 39, W, H - 39);

  // barra de cima
  ctx.fillStyle = "#17150f"; ctx.fillRect(0, 0, W, 38);
  ctx.fillStyle = "#3d3220"; ctx.fillRect(0, 37, W, 2);
  shadowTxt(h.name.toUpperCase(), 272, 26, 20, "#c8483a", "left", true);
  txt(`Mochila $${game.money}  ·  Banco $${save.bank}  ·  Créditos ${save.credits}`, W - 140, 24, 12, "#c9c4ad", "right", true);
  btn(W - 128, 6, 118, 26, "Sair (E)", () => leaveHouse());
  // Acesso à Loja de Créditos no canto superior esquerdo da base.
  // Imagem original do botão no mesmo ponto do cabeçalho (não criar novo link lateral).
  const cbx = 6, cby = 2, cbw = 144, cbh = 34;
  const creditHover = mouse.x >= cbx && mouse.x <= cbx + cbw && mouse.y >= cby && mouse.y <= cby + cbh;
  if (CREDIT_SHOP_BUTTON_ART.complete && CREDIT_SHOP_BUTTON_ART.naturalWidth) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(CREDIT_SHOP_BUTTON_ART, cbx, cby, cbw, cbh);
    if (creditHover) {
      ctx.strokeStyle = "#ffd96a"; ctx.lineWidth = 1.5;
      ctx.strokeRect(cbx + 1, cby + 1, cbw - 2, cbh - 2);
    }
    regClick(cbx, cby, cbw, cbh, () => {
      game.menu = "creditshop"; game.creditCur = 0; game.creditConfirm = null; game.cur = 0;
    });
  } else {
    btn(cbx, cby + 3, cbw, 28, "Créditos", () => {
      game.menu = "creditshop"; game.creditCur = 0; game.creditConfirm = null; game.cur = 0;
    }, true);
  }

  // planta da base
  if (!drawHubArt()) {
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(290, 82, 552, 412);
    ctx.strokeStyle = "#3d3a33"; ctx.lineWidth = 3; ctx.strokeRect(290, 82, 552, 412);
    for (const r of HUB_ROOMS) drawHubRoom(r);
  }
  txt("Clique numa sala para usar · Esc ou E volta para a rua", 566, 520, 12, "#8a8672", "center");
  if (inSafe() && player.hp < player.maxHp) txt("Descansando na base: a vida volta aos poucos", 566, 540, 12, "#6fd06a", "center");

  // painel do personagem (esquerda)
  const px = 8, pw = 248;
  ctx.fillStyle = "#14130f"; rr(px, 44, pw, H - 52, 8); ctx.fill();
  ctx.strokeStyle = "#5a4a2a"; ctx.lineWidth = 2; ctx.stroke();
  const links = [["Mochila e equipamento", "pack"], ["Atributos", "stats"], ["Objetivos", "obj"], ["Mapa", "map"]];
  links.forEach(([label, m], i) => {
    const ly = 64 + i * 17, hov = mouse.x >= px + 10 && mouse.x <= px + 180 && mouse.y >= ly - 12 && mouse.y <= ly + 4;
    txt(label, px + 12, ly, 12, hov ? "#ffd96a" : "#f2eedc", "left", true);
    regClick(px + 10, ly - 12, 170, 16, () => { game.menu = m; game.cur = 0; if (m === "creditshop") { game.creditCur = 0; game.creditConfirm = null; } if (m === "map") game.mapSel = { cx: world.cell.cx, cy: world.cell.cy }; if (m === "obj") game.oscroll = 0; });
  });
  const skin = SKINS[save.skin] || SKINS[0];
  txt(playerName(), px + pw - 10, 64, 12, "#ffd96a", "right", true, 120);
  txt(prof() ? prof().name : skin.name, px + pw - 10, 110, 10, "#e05a4a", "right", true, 120);
  txt(`Nível ${player.level}`, px + pw - 10, 80, 12, "#e5e0c8", "right", true);
  txt(player.level >= MAX_LEVEL ? "máximo" : `${Math.floor(player.xp)} / ${xpNeed(player.level)} XP`, px + pw - 10, 95, 10, "#a9a58f", "right");

  // retrato de frente (arte do personagem); capa aparece por trás dos ombros
  const cp = CAPES[save.cape | 0], hx = px + 74, hy = 214;
  const cape = () => {
    if (!cp || !cp.color || cape3d()) return;
    const sw = Math.sin(game.time / 400 + performance.now() / 700) * 3;
    ctx.fillStyle = shade(cp.color, -0.15); ctx.beginPath(); ctx.moveTo(hx - 26, hy - 58); ctx.lineTo(hx + 26, hy - 58); ctx.lineTo(hx + 44 + sw, hy + 62); ctx.lineTo(hx - 44 + sw, hy + 62); ctx.closePath(); ctx.fill();
    if (cp.trim) { ctx.fillStyle = cp.trim; ctx.fillRect(hx - 44 + sw, hy + 58, 88, 4); }
  };
  // boneco 3D: arrastar gira; clicar abre o inventário. A capa vai atrás de frente e por cima de costas.
  const openInv = () => { game.menu = "pack"; game.cur = 0; };
  if (portraitView() === "front") cape();
  if (!drawPortrait(hx, hy + 6, 128, 196, openInv) && !drawSpr(skin.spr, hx, hy, 120, 196)) drawHero(hx, hy, 0.95);
  if (portraitView() === "back") cape();
  regClick(px + 10, hy - 100, 128, 200, openInv);   // clicar no boneco abre o inventário
  const bx = px + 140, bw = pw - 152;
  hubBar(bx, 150, bw, "Vida", player.hp, player.maxHp, "#6fd06a");
  hubBar(bx, 182, bw, "Fome", player.hunger, 100, "#e0a040");
  hubBar(bx, 214, bw, "Sede", player.thirst, 100, "#4aa3df");
  hubBar(bx, 246, bw, "Energia", player.stamina, 100, "#e0d040");
  txt(`Comida ${player.food} · Água ${player.water}`, bx, 278, 10, "#a9a58f");
  txt(`Kit ${player.med} · Antib. ${player.anti}`, bx, 292, 10, "#a9a58f");
  if (save.vest >= 0) {
    const vd = Math.round(vestDur()), hov = mouse.x >= bx && mouse.x <= bx + bw && mouse.y >= 296 && mouse.y <= 312;
    txt(vd < 100 ? `Colete ${vd}% · consertar $${Math.max(1, repairCost())}` : `Colete ${vd}%`, bx, 308, 10, vd < 100 ? (hov ? "#ffd96a" : "#e0a040") : "#a9a58f", "left", true, bw);
    if (vd < 100) regClick(bx, 296, bw, 16, repairVest);
  }

  // Na base, exibir SOMENTE os três bônus de combate calculados com os
  // atributos efetivos do personagem. XP/dinheiro/loot e outros bônus
  // continuam disponíveis exclusivamente nas telas detalhadas do jogo.
  const hubWeapon = curW();
  const damageMultiplier = (1 + (player.fx.firepower || 0) / 100) *
    dmgMult(hubWeapon) * (trindadeActive() ? 1.35 : 1);
  const hubSlow = (player.flags.jugger ? 0 :
    (save.vest >= 0 ? VESTS[save.vest].slow || 0 : 0) + (hubWeapon.slow || 0)) -
    (player.fx.adren && player.hp / player.maxHp < 0.5 ? player.fx.adren : 0);
  const sprintMultiplier = (1 + profVal("sprint")) *
    (1 + ((player.fx.agility || 0) + vestSpeedBonus()) / 100) *
    (1 + (A("agi") - 10) * 0.004) * (1 - hubSlow / 100) *
    (trindadeActive() ? 1.35 : 1);
  const signed = n => (n > 0 ? "+" : "") + n + "%";
  const hubBonuses = [
    ["Dano " + signed(Math.round((damageMultiplier - 1) * 100)), "#e89f80"],
    ["Velocidade " + signed(Math.round((sprintMultiplier - 1) * 100)), "#85c5ff"],
    ["Armadura " + Math.round(armorRed() * 100) + "%", "#a8d5a3"]
  ];
  hubBonuses.forEach(([label, color], i) =>
    shadowTxt(label, px + 12, 330 + i * 19, 12, color, "left", true, pw - 24));

  // armas equipadas com a munição embaixo
  ctx.fillStyle = "#3d3220"; ctx.fillRect(px + 10, 404, pw - 20, 2);
  for (let i = 0; i < SLOT_N; i++) {
    const it = player.slots[i], sy = 412 + i * 60, sel = i === player.cur;
    ctx.fillStyle = sel ? "rgba(70,58,24,0.6)" : "rgba(0,0,0,0.35)"; rr(px + 10, sy, pw - 20, 54, 6); ctx.fill();
    if (sel) { ctx.strokeStyle = "#ffd96a"; ctx.lineWidth = 1.5; ctx.stroke(); }
    if (!it) { txt("vazio", px + pw / 2, sy + 32, 12, "#55534a", "center"); continue; }
    const d = WDEF[it.id];
    drawWeaponSide(d, px + pw / 2, sy + 20, 0.5);
    let ammo;
    if (d.melee) ammo = "corpo a corpo";
    else if (d.infinite) ammo = `${it.ammo} · munição infinita`;
    else ammo = `${((player.reserve[d.ammo] || 0) + (it.ammo || 0)).toLocaleString("pt-BR")} balas · ${d.ammo}`;
    txt(ammo, px + pw / 2, sy + 48, 11, d.melee ? "#a9a58f" : "#e05a4a", "center", true, pw - 30);
    txt(instName(it), px + 16, sy + 12, 9, rarColor(d), "left", true, 120);
    regClick(px + 10, sy, pw - 20, 54, () => selectWeapon(i));
  }
}

// =====================================================================
//  Mapa do setor (tecla M): a área onde você está, ou o prédio + a área
// =====================================================================
const GROUND_COL = { grass: "#3a4a32", park: "#3e5a34", lot: "#3a3a38", dirt: "#4a4334", plaza: "#4a4c48" };
function drawAreaMap(x, y, w, h) {
  const k = Math.min(w / WORLD_W, h / WORLD_H), ox = x + (w - WORLD_W * k) / 2, oy = y + (h - WORLD_H * k) / 2;
  const X = (v) => ox + v * k, Y = (v) => oy + v * k;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = "#26272a"; ctx.fillRect(X(0), Y(0), WORLD_W * k, WORLD_H * k);
  for (const b of world.blocks) { ctx.fillStyle = GROUND_COL[b.ground] || "#3a4a32"; ctx.fillRect(X(b.x), Y(b.y), b.w * k, b.h * k); }
  ctx.fillStyle = "#4a4b46"; for (const p of world.paths) ctx.fillRect(X(p.x), Y(p.y), p.w * k, p.h * k);
  ctx.fillStyle = "#2f4a2a"; for (const t of world.trees) circle(X(t.x), Y(t.y), Math.max(1.5, t.r * k * 0.8));
  ctx.fillStyle = "#6a6a62"; for (const f of world.fences) ctx.fillRect(X(f.x), Y(f.y), Math.max(1, f.w * k), Math.max(1, f.h * k));
  for (const c of world.cars) { ctx.fillStyle = c.wreck ? "#3a3a36" : c.color; ctx.fillRect(X(c.x), Y(c.y), c.w * k, c.h * k); }
  const here = game.inside;
  for (const b of world.buildings) {
    ctx.fillStyle = b.safe ? "#3d6a4e" : b.landmark ? shade(b.color, 0.1) : shade(b.color, -0.1);
    ctx.fillRect(X(b.x), Y(b.y), b.w * k, b.h * k);
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1; ctx.strokeRect(X(b.x), Y(b.y), b.w * k, b.h * k);
    if (b.enter && !b.noDoor) { ctx.fillStyle = "#c9a040"; ctx.fillRect(X(b.door.x), Y(b.door.y), Math.max(2, b.door.w * k), 3); }
    if (b.type !== "casa" && b.type !== "guarita" && b.w * k > 40) hudT(b.landmark || b.safe ? b.name.toUpperCase() : b.name, X(b.x + b.w / 2), Y(b.y + b.h / 2) + 4, b.landmark || b.safe ? 12 : 9, b.landmark ? "#ffb070" : b.safe ? "#8fe0a8" : "#d8d4c4", "center", true, b.w * k - 4);
  }
  const rb = rescueBuilding();
  if (rb) hudT("SOS", X(rb.x + rb.w / 2), Y(rb.y + rb.h / 2) + 5, 14, "#6fff9a", "center", true);
  // prédio em que você está: contorno piscando
  if (here && !here.safe) {
    const p = 0.6 + 0.4 * Math.sin(performance.now() / 200);
    ctx.strokeStyle = `rgba(255,217,106,${p})`; ctx.lineWidth = 3; ctx.strokeRect(X(here.x) - 3, Y(here.y) - 3, here.w * k + 6, here.h * k + 6);
  }
  // chefe da área
  const boss = zombies.find((z) => z.boss && z.hp > 0);
  if (boss) hudT("☠", X(boss.x), Y(boss.y) + 6, 16, "#ff4a3a", "center", true);
  // Posição dos jogadores conectados nesta área.
  for (const online of fmSocial.inSector()) {
    const xOnline = X(online.x), yOnline = Y(online.y);
    ctx.fillStyle = fmSocial.isFriend(online.uid) ? "#8fe0a8" : "#73ceff";
    circle(xOnline, yOnline, 4.5);
    hudT(online.name, xOnline, yOnline - 8, 10, "#e5e0c8", "center", true, 130);
  }
  // você
  const pp = here ? game.exitPos : player;
  ctx.save(); ctx.translate(X(pp.x), Y(pp.y)); ctx.rotate(here ? -Math.PI / 2 : player.angle);
  poly([[10, 0], [-7, -7], [-3, 0], [-7, 7]], "#ffd96a"); ctx.restore();
  // vizinhas nas bordas
  const c = world.cell;
  for (const [dx, dy, ax, ay] of [[0, -1, WORLD_W / 2, 30], [0, 1, WORLD_W / 2, WORLD_H - 14], [-1, 0, 50, WORLD_H / 2], [1, 0, WORLD_W - 50, WORLD_H / 2]]) {
    const n = cellAt(c.cx + dx, c.cy + dy);
    if (!n) continue;
    const RG = REGIONS[n.tier];
    hudT(`${dy < 0 ? "▲" : dy > 0 ? "▼" : dx < 0 ? "◀" : "▶"} ${n.code}`, X(ax), Y(ay), 11, RG.color === "#2a2a2e" ? "#9a9aa0" : RG.color, "center", true);
  }
  ctx.restore();
  ctx.strokeStyle = "#5a4a2a"; ctx.lineWidth = 2; ctx.strokeRect(X(0), Y(0), WORLD_W * k, WORLD_H * k);
}
function drawSector() {
  const c = world.cell, RG = REGIONS[c.tier], here = game.inside;
  const rc = RG.color === "#2a2a2e" ? "#9a9aa0" : RG.color;
  if (!here) {
    menuFrame(`Mapa do setor ${c.code}`, `${c.name} · Área ${RG.name} · ${RG.diff}`);
    drawAreaMap(190, 88, 580, 444);
    const lm = world.buildings.find((b) => b.landmark);
    txt(lm ? `★ ${lm.name} nesta área · o melhor saque da região` : "Prédios com a porta dourada dão para entrar", W / 2, H - 46, 12, lm ? "#ffb070" : "#a9a58f", "center", true);
  } else {
    const fl = here.safe ? 1 : buildingFloors(here);
    menuFrame(`${here.name} · ${c.code}`, here.safe ? `${c.name} · posto seguro` : `${floorName(here, here.level | 0)} · ${fl} ${here.def.under ? "níveis" : "andares"} · ${c.name}`);
    txt("ONDE FICA NA ÁREA", 40 + 200, 104, 11, "#c9c4ad", "center", true);
    drawAreaMap(40, 112, 400, 410);
    txt("ANDAR ATUAL", 470 + 225, 104, 11, "#c9c4ad", "center", true);
    if (!here.safe) {
      drawInteriorMinimap(470, 112, 450, 370);
      // lista de andares
      for (let i = 0; i < fl; i++) {
        const bx = 470 + i * 114, cur = i === (here.level | 0), seen = here.levels && here.levels[i];
        ctx.fillStyle = cur ? "rgba(70,58,24,0.8)" : "rgba(0,0,0,0.35)"; rr(bx, 490, 108, 30, 5); ctx.fill();
        if (cur) { ctx.strokeStyle = "#ffd96a"; ctx.lineWidth = 1.5; ctx.stroke(); }
        txt(floorName(here, i), bx + 54, 510, 11, cur ? "#ffd96a" : seen ? "#e5e0c8" : "#6d6a58", "center", true);
      }
    } else txt("Você está no posto seguro", 695, 300, 14, "#8fe0a8", "center", true);
  }
  hint("M ou Esc fecha · N abre o mapa da cidade");
}

// mapa do setor por cima do jogo (M): dá para continuar andando com ele aberto
function drawSectorOverlay() {
  const c = world.cell, RG = REGIONS[c.tier], here = game.inside;
  ctx.save(); ctx.globalAlpha = 0.78;
  if (here && !here.safe) {
    const fl = buildingFloors(here), x = W / 2 - 330, y = 78, w = 660, h = 430;
    ctx.fillStyle = "rgba(8,9,7,0.75)"; rr(x - 10, y - 34, w + 20, h + 48, 10); ctx.fill();
    hudT(`${here.name.toUpperCase()} · ${floorName(here, here.level | 0).toUpperCase()}${fl > 1 ? ` (${(here.level | 0) + 1}/${fl})` : ""}`, W / 2, y - 12, 15, "#ffd96a", "center", true);
    drawInteriorMinimap(x, y, w, h);
  } else {
    const x = W / 2 - 250, y = 78, w = 500, h = 470;
    ctx.fillStyle = "rgba(8,9,7,0.75)"; rr(x - 10, y - 34, w + 20, h + 48, 10); ctx.fill();
    hudT(`SETOR ${c.code} · ${c.name.toUpperCase()} · ${RG.name.toUpperCase()}`, W / 2, y - 12, 15, RG.color === "#2a2a2e" ? "#9a9aa0" : RG.color, "center", true);
    drawAreaMap(x, y, w, h);
  }
  ctx.restore();
  hudT("M fecha o mapa", W / 2, H - 52, 11, "#a9a58f", "center", true);
}
