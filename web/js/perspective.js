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
const ROOF_TILE = ["#a75b45", "#95503b", "#8b4d42", "#987057", "#a56a4b", "#765750", "#855744"];
function roofColor(b) { return b.roofCol || (b.roofCol = ROOF_TILE[Math.floor(bHash(b, 3) * ROOF_TILE.length)]); }

// chão do prédio (sombra, base e porta): desenhado junto com a rua
function drawBuildingGround(b) {
  const h = bHeight(b);
  ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(b.x + 6, b.y - h * 0.18, b.w + h * 0.14, b.h + h * 0.18);
  ctx.fillStyle = shade(b.color, -0.55); ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
  drawDoor(b);
}

// Parede projetada: reboco gasto, cantoneiras, caixilhos, vidro e tábuas.
// A geometria continua a mesma (não altera hitboxes nem portas).
function drawWall(b, ax, ay, bx, by, h, e, tone) {
  const p0 = proj(ax, ay, 0, e), p1 = proj(bx, by, 0, e), p2 = proj(bx, by, h, e), p3 = proj(ax, ay, h, e);
  poly([[p0.x, p0.y], [p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y]], shade(b.color, tone));
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p3.x, p3.y); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  const house = b.type === "casa";
  const floors = bFloorsVis(b), len = Math.hypot(bx - ax, by - ay), fh = h / (floors + 0.35);
  const nW = Math.max(1, Math.floor(len / (house ? 66 : 46))), night = isNight();
  const at = (t, hh) => proj(ax + (bx - ax) * t, ay + (by - ay) * t, hh, e);
  if (house) {
    // Alicerce escuro + molduras nas quinas, contrastando com o reboco.
    const f0 = at(0, 0), f1 = at(1, 0), f2 = at(1, 8), f3 = at(0, 8);
    poly([[f0.x, f0.y], [f1.x, f1.y], [f2.x, f2.y], [f3.x, f3.y]], shade(b.color, -0.54));
    ctx.strokeStyle = "rgba(230,198,151,0.29)"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const t of [0.025, 0.975]) {
      const a = at(t, 8), c = at(t, h - 3);
      ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
    // Reboco com juntas e goteiras finas; mantém-se legível em zoom distante.
    for (let n = 1; n < 6; n++) {
      const hh = 7 + (h - 14) * n / 6;
      const a = at(0.02, hh), c = at(0.98, hh);
      ctx.strokeStyle = n % 2 ? "rgba(20,18,14,0.11)" : "rgba(232,218,183,0.09)";
      ctx.lineWidth = n % 2 ? 1 : 0.8;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const seed = bHash(b, 410 + i), t = 0.04 + 0.90 * seed;
      const y = 6 + (h - 14) * bHash(b, 460 + i);
      const a = at(t, y), c = at(t + 0.018, y - (3 + 7 * bHash(b, 490 + i)));
      ctx.strokeStyle = "rgba(29,25,24,0.14)"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
    // Friso de argamassa logo abaixo dos beirais.
    const a = at(0, h - 3), c = at(1, h - 3);
    ctx.strokeStyle = "rgba(14,12,12,0.58)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    ctx.strokeStyle = "rgba(218,193,157,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 2); ctx.lineTo(c.x, c.y - 2); ctx.stroke();
  }
  for (let f = 0; f < floors; f++) {
    if (f > 0) {
      const l0 = at(0, f * fh), l1 = at(1, f * fh);
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath(); ctx.moveTo(l0.x, l0.y); ctx.lineTo(l1.x, l1.y); ctx.stroke();
    }
    const h0 = f * fh + fh * 0.32, h1 = f * fh + fh * 0.78;
    for (let i = 0; i < nW; i++) {
      const t0 = (i + 0.27) / nW, t1 = (i + 0.73) / nW;
      const q0 = at(t0, h0), q1 = at(t1, h0), q2 = at(t1, h1), q3 = at(t0, h1);
      const lit = night && bHash(b, f * 31 + i + 7) < (house ? 0.30 : 0.22);
      const pane = lit ? "rgba(251,188,92,0.92)" : night ? "rgba(21,29,39,0.94)" : "rgba(44,65,76,0.88)";
      if (house) {
        // Reentrância escura e moldura aparente.
        ctx.strokeStyle = "rgba(19,17,17,0.78)"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.lineTo(q3.x, q3.y); ctx.closePath(); ctx.stroke();
      }
      poly([[q0.x, q0.y], [q1.x, q1.y], [q2.x, q2.y], [q3.x, q3.y]], pane);
      if (house) {
        const mid = (t0 + t1) / 2, m0 = at(mid, h0), m1 = at(mid, h1);
        ctx.strokeStyle = "rgba(144,128,107,0.86)"; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y);
        const mid0 = at(t0, (h0 + h1) / 2), mid1 = at(t1, (h0 + h1) / 2);
        ctx.moveTo(mid0.x, mid0.y); ctx.lineTo(mid1.x, mid1.y); ctx.stroke();
        ctx.strokeStyle = "rgba(202,221,217,0.26)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(q3.x + 2, q3.y + 2); ctx.lineTo(q2.x - 3, q2.y - 3); ctx.stroke();
        // Peitoril de concreto projeta pequena sombra abaixo da janela.
        const sill0 = at(t0 - 0.025 / nW, h0 - 2), sill1 = at(t1 + 0.025 / nW, h0 - 2);
        ctx.strokeStyle = "rgba(18,17,16,0.5)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sill0.x, sill0.y + 2); ctx.lineTo(sill1.x, sill1.y + 2); ctx.stroke();
        ctx.strokeStyle = "rgba(194,182,161,0.75)"; ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.moveTo(sill0.x, sill0.y); ctx.lineTo(sill1.x, sill1.y); ctx.stroke();
        // Algumas janelas estão protegidas com tábuas tortas.
        if (bHash(b, 130 + f * 37 + i) < 0.17) {
          ctx.strokeStyle = "rgba(74,52,37,0.97)"; ctx.lineWidth = 4.5;
          ctx.beginPath(); ctx.moveTo(q0.x - 2, q0.y - 2); ctx.lineTo(q2.x + 2, q2.y + 2); ctx.stroke();
          ctx.strokeStyle = "rgba(155,112,67,0.8)"; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(q0.x - 2, q0.y - 4); ctx.lineTo(q2.x + 2, q2.y); ctx.stroke();
        } else if (bHash(b, 205 + f * 37 + i) < 0.24) {
          // Trincas pontuais, mantendo as janelas reconhecíveis.
          const center = at(mid, (h0 + h1) / 2);
          ctx.strokeStyle = "rgba(208,228,239,0.5)"; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(center.x - 4, center.y - 5); ctx.lineTo(center.x + 2, center.y + 1);
          ctx.lineTo(center.x - 1, center.y + 6); ctx.stroke();
        }
      }
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
  // Haste vertical ligada apenas à base: sem deslocamento visual
  // semelhante a uma sombra longa sobre o asfalto.
  const height = l.big ? 53 : 40, topY = l.y - height;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#292c2c"; ctx.lineWidth = l.big ? 4 : 3;
  ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, topY); ctx.stroke();
  ctx.strokeStyle = "#666b6e"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(l.x - 1, l.y - 2); ctx.lineTo(l.x - 1, topY + 2); ctx.stroke();
  ctx.fillStyle = "#3b4042"; circle(l.x, topY, l.big ? 6 : 4.5);
  ctx.fillStyle = "#fff0b9"; circle(l.x, topY, l.big ? 3.5 : 2.5);
  // Brilho da lâmpada acesa, inclusive no modo 2D.
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(l.x, topY, 0, l.x, topY, l.big ? 29 : 23);
  glow.addColorStop(0, "rgba(255,245,194,0.84)");
  glow.addColorStop(0.18, "rgba(255,219,130,0.40)");
  glow.addColorStop(1, "rgba(255,190,100,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(l.x, topY, l.big ? 29 : 23, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// pinta de trás (norte) para a frente (sul) pela linha do chão de cada coisa:
// quem está na frente de um prédio aparece por cima da parede; quem está atrás fica escondido
function drawSortedScene() {
  const e = eye(), list = [];
  for (const b of world.buildings) if (inView(b.x - 140, b.y - 40, b.w + 280, b.h + 260)) list.push({ y: b.y + b.h, f: () => drawBuildingTall(b, e) });
  for (const l of world.lamps) if (inView(l.x - 80, l.y - 120, 160, 200)) list.push({ y: l.y, f: () => drawLampTall(l, e) });
  // cenário 3D, furgões e caçambas (ordenados pela beirada de baixo, como os prédios)
  for (const m of world.models || []) if (!m.bodyReplacement &&
      inView(m.x - 160, m.y - 220, 320, 300))
    list.push({ y: m.south, f: () => drawModel(m.id, m.x, m.y, m.k) });
  for (const c of world.cars) if (carModel(c) && inView(c.x - 20, c.y - 60, c.w + 40, c.h + 80)) list.push({ y: c.y + c.h, f: () => drawCarModel(c) });
  if (modelOk("dumpster")) for (const o of world.loot.query(cam.x - 60, cam.y - 60, cam.x + W + 60, cam.y + H + 100)) if (o.kind === "dumpster") list.push({ y: o.y + o.h, f: () => { if (!drawDumpsterModel(o)) drawLootObj(o); } });
  for (const g of world.guards || []) if (inView(g.x - 32, g.y - 75, 64, 115)) list.push({ y: g.y + 0.2, f: () => drawBaseGuard(g) });
  for (const z of Zs()) if (inView(z.x - 60, z.y - 120, 120, 160)) list.push({ y: z.y, f: () => { drawZombie(z); drawZombieExtra(z); } });
  const es = game.escort;
  if (es && !game.over) list.push({ y: es.y, f: () => drawSurvivor(es.x, es.y, es.ang, es.walk, es.moving) });
  // Jogadores de outras contas: mesmos setores e ruas, ordenados pela profundidade.
  for (const online of fmSocial.inSector()) {
    if (inView(online.x - 60, online.y - 100, 120, 160))
      list.push({ y: online.y + 0.4, f: () => drawOnlinePlayer(online) });
  }
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
const PSHEET = { ok: false, cell: 128, size: 72, footY: 0.82, stride: 12.5, sheets: {}, masks: {}, tinted: {}, tintKey: "" };
const POSES = ["longa", "pesada", "pistola", "melee", "punhos"];
(function loadPlayerSheets() {
  let n = 0;
  const done = () => { if (++n === POSES.length * 2) PSHEET.ok = true; };
  for (const pose of POSES) {
    const im = new Image(); im.onload = done; im.src = `img/player_${pose}.png`; PSHEET.sheets[pose] = im;
    const mk = new Image(); mk.onload = done; mk.onerror = done; mk.src = `img/player_${pose}_mask.png`; PSHEET.masks[pose] = mk;
  }
})();

// ---------- Roupa e equipamento do jogador 3D (Male-low fotografado no Blender) ----------
// O corpo vem com a roupa em cinza; a máscara diz onde é jaqueta (vermelho) e calça (verde).
// Cada personagem (SKINS) pinta a roupa com as suas cores. Colete, mochila e acessórios
// de cabeça são camadas separadas (mesmas 8 direções x 8 quadros) desenhadas por cima.
const VEST_GEAR = ["vest0", "vest1", "vest2", "vest3", "vest4", "vest5", "vest6", "vest7", "vest8", "vest9"];
const SKIN_GEAR = [[], ["headset"], ["shemagh"], ["helmet2"], [], ["balaclava"], ["gasmask"], ["helmet", "ballistic"], ["balaclava", "ballistic"]];
const GEAR_IMG = {};
function gearImg(id, pose) {
  const k = id + "_" + pose;
  let im = GEAR_IMG[k];
  if (!im) { im = GEAR_IMG[k] = new Image(); im.onerror = () => { im.bad = true; }; im.src = `img/gear/${k}.png`; }
  if (!(im.complete && !im.bad && im.naturalWidth)) return null;
  const tint = gearTint(id);
  return tint ? tintedImg(im, k, tint) : im;
}
// capas 3D: todas usam a capa de pano, que vem em cinza e é pintada com a cor de cada capa (CAPES)
const CAPE_GEAR = CAPES.map((c) => (c.color ? "cape_cloak" : null));
function gearTint(id) {
  if (id !== "cape_cloak") return null;
  const cp = CAPES[save.cape | 0];
  return cp && cp.color ? cp.color : null;
}
const TINT_CACHE = {};
function tintedImg(im, key, hex) {
  const ck = key + hex;
  if (TINT_CACHE[ck]) return TINT_CACHE[ck];
  const w = im.naturalWidth, h = im.naturalHeight, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(im, 0, 0);
  try {
    const img = g.getImageData(0, 0, w, h), d = img.data, C = hexRgb(hex), K = 1.7 / 255;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.min(255, d[i + ch] * C[ch] * K);
    }
    g.putImageData(img, 0, 0);
  } catch (e) { /* aberto direto do disco: fica sem pintar */ }
  return (TINT_CACHE[ck] = c);
}
// armas com modelo 3D na mão (camada img/gear/<m>_<pose>.png, já com o corpo escondendo o que fica atrás);
// f = filtro de cor para as versões especiais. As outras armas continuam com o desenho 2D.
const WEAPON_3D = {
  ak47: { m: "w_ak" }, ak_ouro: { m: "w_ak", f: "sepia(1) saturate(4) hue-rotate(-12deg) brightness(1.25)" },
  m4: { m: "w_m4" }, baioneta: { m: "w_m4" }, fal: { m: "w_fal" }, scar: { m: "w_scar" },
  uzi: { m: "w_uzi" }, vector: { m: "w_vector" }, m249: { m: "w_m249" },
  canoduplo: { m: "w_canoduplo" }, spas: { m: "w_spas" }, aa12: { m: "w_aa12" },
  caca: { m: "w_caca" }, sniper: { m: "w_sniper" }, barrett: { m: "w_barrett" },
  pistola: { m: "w_g17" }, glock: { m: "w_g17" }, silenciada: { m: "w_g17" }, colt: { m: "w_g17" }, deagle: { m: "w_deagle" },
  revolver: { m: "w_peacemaker" }, revolver_orn: { m: "w_peacemaker", f: "sepia(0.8) saturate(2.2) brightness(1.1)" },
  katana: { m: "w_katana" }, katana_dragao: { m: "w_katana", f: "sepia(1) saturate(5) hue-rotate(-40deg)" },
  lamina: { m: "w_katana", f: "sepia(1) saturate(4) hue-rotate(220deg)" },
  espada: { m: "w_espada" }, espadafogo: { m: "w_glory" },
  marreta: { m: "w_marreta" }, machado: { m: "w_machado" }, facao: { m: "w_facao" }, serra: { m: "w_serra" },
};
// foto de cada arma 3D para a loja e o inventário (img/weapons/<m>.png: de lado, cano para a direita)
const WEAPON_ICON = {};
function weaponIcon(d) {
  const w = WEAPON_3D[d.id];
  if (!w) return null;
  let im = WEAPON_ICON[w.m];
  if (!im) { im = WEAPON_ICON[w.m] = new Image(); im.onerror = () => { im.bad = true; }; im.src = `img/weapons/${w.m}.png`; }
  return im.bad || !im.complete || !im.naturalWidth ? null : im;
}
function weapon3dImg(w, pose) { const d = w && WEAPON_3D[w.id]; return d ? gearImg(d.m, pose) : null; }
function hexRgb(h) { const n = parseInt((h || "#808080").slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
// pinta a roupa cinza com as cores do personagem escolhido (uma vez por troca de personagem)
function tintedSheet(pose) {
  const s = SKINS[save.skin] || SKINS[0], key = `${save.skin}`;
  if (PSHEET.tintKey !== key) { PSHEET.tinted = {}; PSHEET.tintKey = key; }
  if (PSHEET.tinted[pose]) return PSHEET.tinted[pose];
  const base = PSHEET.sheets[pose], mask = PSHEET.masks[pose];
  if (!mask || !mask.naturalWidth) return (PSHEET.tinted[pose] = base);
  const w = base.naturalWidth, h = base.naturalHeight;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  try {
    g.drawImage(mask, 0, 0); const m = g.getImageData(0, 0, w, h).data;
    g.clearRect(0, 0, w, h); g.drawImage(base, 0, 0);
    const img = g.getImageData(0, 0, w, h), d = img.data;
    const J = hexRgb(s.jacket), P = hexRgb(s.pants), K = 1.7 / 255;   // cinza da roupa (~0.6) vira a cor escolhida
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const mj = m[i] / 255, mp = m[i + 1] / 255;
      if (mj + mp < 0.02) continue;
      for (let ch = 0; ch < 3; ch++) {
        const v = d[i + ch], tj = Math.min(255, v * J[ch] * K), tp = Math.min(255, v * P[ch] * K);
        d[i + ch] = v * (1 - mj - mp) + tj * mj + tp * mp;
      }
    }
    g.putImageData(img, 0, 0);
  } catch (e) { return (PSHEET.tinted[pose] = base); }   // aberto direto do disco (sem servidor): usa sem pintar
  return (PSHEET.tinted[pose] = c);
}
// camadas de equipamento visíveis agora (colete, mochila e o acessório do personagem)
function playerGear() {
  const list = [];
  if (save.vest >= 0 && VEST_GEAR[save.vest]) list.push(VEST_GEAR[save.vest]);
  list.push("pack");
  if (CAPE_GEAR[save.cape | 0]) list.push(CAPE_GEAR[save.cape | 0]);
  for (const id of SKIN_GEAR[save.skin] || []) list.push(id);
  return list;
}
// ordem das camadas: de frente a capa vai primeiro (fica atrás de tudo); de lado/costas o colete
// vai antes, depois a capa por cima dele e a mochila por cima da capa. Cabeça sempre por último.
function gearOrder(list, back) {
  const rank = (id) => id.startsWith("cape") ? (back ? 1 : 0) : id.startsWith("vest") ? (back ? 0 : 1) : id === "pack" ? 2 : 3;
  return list.slice().sort((a, b) => rank(a) - rank(b));
}
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
// Oito poses discretas: a direção visual deve trocar no MESMO quadro
// da mira. Antes havia um atraso de rotação e histerese que fazia o
// jogador olhar para um lado enquanto as balas saíam para outro.
function spriteTick(dt) {
  const p = player;
  p.dispAng = p.angle;
  p.sRow = sheetRow(Math.cos(p.angle), Math.sin(p.angle));
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
// A posição do cano usa a empunhadura da spritesheet, porém o
// ângulo vem EXCLUSIVAMENTE da direção do personagem. Isso evita o
// tiro inverter ao colocar o cursor atrás ou próximo da empunhadura.
function gunGripAndLength(w) {
  const pose = weaponPose(w), a = posePt("a", pose), b = posePt("b", pose);
  return { x: a.x, y: a.y, length: Math.hypot(b.x - a.x, b.y - a.y) * weaponMeters(w) };
}
function updateWeaponAim() {
  // Nunca calcular novamente a direção a partir do cano ou da mão.
  // A origem continua no cano; a direção é sempre a do corpo/mouse,
  // estabilizada pela zona morta aplicada no movimento.
  player.gunAngle = player.angle;
}
function muzzlePoint() {
  if (!useSpriteChar()) return null;
  const w = curW(); if (w.melee || w.fists) return null;
  const grip = gunGripAndLength(w);
  const a = Number.isFinite(player.gunAngle) ? player.gunAngle : player.angle;
  return { x: grip.x + Math.cos(a) * grip.length, y: grip.y + Math.sin(a) * grip.length };
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
    // Rotação contínua da arma 2D enquanto o corpo usa oito poses.
    ctx.rotate(Number.isFinite(player.gunAngle) ? player.gunAngle : player.angle);
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
  // Sombra ambiental macia no piso, com leve deslocamento de luz direcional.
  // Dá profundidade ao soldado 3D sem alterar colisão ou posição.
  if (!game.inside) {
    ctx.save();
    ctx.translate(p.x + 12, p.y + 13);
    ctx.rotate(-0.22);
    ctx.scale(1.25, 0.62);
    const shadow = ctx.createRadialGradient(0, 0, 2, 0, 0, 39);
    shadow.addColorStop(0, "rgba(7,13,9,0.43)");
    shadow.addColorStop(0.4, "rgba(10,13,9,0.23)");
    shadow.addColorStop(1, "rgba(10,13,9,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath(); ctx.arc(0,0,39,0,6.283); ctx.fill();
    ctx.restore();
  }
  const kick = p.flashT > 0 ? 2 : 0, o = spriteOrigin(), info = SPRITE_POSES[pose][row][col];
  const w3 = weapon3dImg(w, pose);
  if (info.bh && !w3) drawHeldWeapon(w, pose);       // arma atrás do corpo (de costas)
  const ox = o.x - Math.cos(p.angle) * kick, oy = o.y - Math.sin(p.angle) * kick;
  ctx.drawImage(tintedSheet(pose), col * c, row * c, c, c, ox, oy, S, S);
  // arma 3D: a camada já vem recortada pelo corpo; atrás do corpo vai antes do colete/mochila
  const drawW3 = () => {
    const d = WEAPON_3D[w.id];
    ctx.save();
    if (!w.melee) {
      // Camada da arma 3D: vira em torno da empunhadura sem rodar o
      // personagem inteiro. A mira e o disparo usam este mesmo ângulo.
      const A = posePt("a", pose), B = posePt("b", pose);
      const baseAngle = Math.atan2(B.y - A.y, B.x - A.x);
      const aim = Number.isFinite(p.gunAngle) ? p.gunAngle : p.angle;
      ctx.translate(A.x, A.y);
      ctx.rotate(angDelta(baseAngle, aim));
      ctx.translate(-A.x, -A.y);
    } else if (w.look !== "chainsaw" && game.slashT > 0) {
      const A = posePt("a", pose), sw = (-1 + (1 - game.slashT / 200) * 2) * (game.slashA || 0.9) * 0.9;
      ctx.translate(A.x, A.y); ctx.rotate(sw); ctx.translate(-A.x, -A.y);
    }
    if (d.f) ctx.filter = d.f;
    ctx.drawImage(w3, col * c, row * c, c, c, ox, oy, S, S);
    ctx.restore();
  };
  if (w3 && info.bh) drawW3();
  // colete, mochila, capacete/máscara; de frente a mochila vai antes (o colete a cobre),
  // de lado e de costas ela vai depois do colete (fica por cima dele)
  const gearList = gearOrder(playerGear(), row !== 3 && row !== 4 && row !== 5);
  for (const id of gearList) {
    const g = gearImg(id, pose);
    if (g) ctx.drawImage(g, col * c, row * c, c, c, ox, oy, S, S);
  }
  if (w3 && !info.bh) drawW3();
  else if (!w3 && !info.bh) drawHeldWeapon(w, pose);      // arma na frente do corpo
  // A lanterna no colete fica fisicamente apagada sob o sol.
  if (info.cb == null ? row >= 1 && row <= 7 : !info.cb) {
    const L = chestPoint();
    if (flashlightActive()) {
      const a = row === 1 || row === 7 ? 0.55 : 1;
      ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, 7);
      g.addColorStop(0, "rgba(255,240,190,0.95)"); g.addColorStop(1, "rgba(255,220,140,0)");
      ctx.fillStyle = g; circle(L.x, L.y, 7);
      ctx.restore();
    }
    ctx.fillStyle = "#1c1c1c"; ctx.fillRect(L.x - 2.5, L.y - 2, 5, 4);
    ctx.fillStyle = flashlightActive() ? "#fff4cf" : "#595850"; circle(L.x, L.y, 1.6);
  }
  // clarão do tiro na ponta do cano
  if (p.flashT > 0 && !w.melee) {
    const m = muzzlePoint(), ang = p.shotAng != null ? p.shotAng : (p.gunAngle != null ? p.gunAngle : p.angle);
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
  const names = ["z_walker", "z_walker2", "z_runner", "z_brute", "z_hazmat", "z_dog", "z_creeper"];
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
    case "dog": return "z_dog";
    case "creeper": return "z_creeper";
    default: return null;
  }
}
// ---------- Morte: queda e corpo no chão ----------
// img/<nome>_death.png: 8 direções x 8 quadros de 256 px (o dobro do quadro de andar, mesma escala:
// cobre 4 m em vez de 2 m) com o pé no meio do quadro. O último quadro é o corpo deitado.
const ZDEATH = {};
function zombieDeathImg(nm) {
  let im = ZDEATH[nm];
  if (!im) { im = ZDEATH[nm] = new Image(); im.onerror = () => { im.bad = true; }; im.src = `img/${nm}_death.png?v=20261117-morte01`; }
  return im.bad || !im.complete || !im.naturalWidth ? null : im;
}
// dados que o corpo guarda ao morrer (null = zumbi sem sprite 3D, usa o boneco antigo)
function zombieDeathInfo(z) {
  if (!ZSHEET.ok || save.classicChar || z.boss) return null;
  const nm = zombieSheet(z); if (!nm) return null;
  zombieDeathImg(nm);
  return { dsheet: nm, drow: sheetRow(Math.cos(z.angle), Math.sin(z.angle)), dS: zSpriteSize(z, nm), fx: z.x, fy: z.y, t0: game.time,
    dfilter: z.type === "toxic" ? "hue-rotate(55deg) saturate(1.5)" : z.type === "infected" ? "brightness(0.8) contrast(1.15)" : null };
}
function drawZombieDeath(c) {
  const im = zombieDeathImg(c.dsheet);
  if (!im) return false;
  const el = game.time - c.t0, col = el < 0 ? 7 : Math.min(7, Math.floor(el / 70));   // queda em ~0,5 s
  const S = c.dS * 2, x = c.fx - S / 2, y = c.fy - S * 0.5;
  ctx.save();
  if (col === 7) {                                     // poça de sangue embaixo do corpo
    ctx.fillStyle = "rgba(70,5,5,0.35)"; ellipse(c.fx, c.fy, c.dS * 0.22, c.dS * 0.16);
  }
  if (c.life < 2000) ctx.globalAlpha = Math.max(0, c.life / 2000);   // some aos poucos no fim
  if (c.dfilter) ctx.filter = c.dfilter;
  ctx.drawImage(im, col * 256, c.drow * 256, 256, 256, x, y, S, S);
  ctx.restore();
  return true;
}
// tamanho do quadro na tela: todos os modelos 3D foram fotografados na mesma escala
function zSpriteSize(z, nm) {
  if (nm === "z_dog") return ZSHEET.base * (z.r / 11);
  return ZSHEET.base * (z.r / 13) / (nm === "z_brute" ? 1.15 : 1);
}
// ---------- Corpo do zumbi para os acertos ----------
// O ponto do zumbi (z.x, z.y) é onde ele pisa; com o desenho em pé, o corpo vai dos pés até
// a cabeça. O acerto usa uma cápsula vertical com essa altura e a largura do zumbi (z.r).
function zBodyH(z) {
  if (!ZSHEET.ok || save.classicChar || z.boss) return 0;
  const nm = zombieSheet(z); if (!nm) return 0;
  return zSpriteSize(z, nm) * (nm === "z_dog" ? 0.3 : 0.6);
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
  const S = zSpriteSize(z, nm);
  const row = sheetRow(Math.cos(z.angle), Math.sin(z.angle));
  const TAU = Math.PI * 2, col = Math.floor((((z.anim || 0) % TAU) + TAU) % TAU / TAU * 8) % 8;
  const lunge = z.lunge > 0 ? 5 : 0, x = z.x - S / 2 + Math.cos(z.angle) * lunge, y = z.y + 6 - S * 0.82 + Math.sin(z.angle) * lunge;
  if (z.type === "toxic") ctx.filter = "hue-rotate(55deg) saturate(1.5)";
  else if (z.type === "infected") ctx.filter = "brightness(0.8) contrast(1.15)";
  ctx.drawImage(ZSHEET.sheets[nm], col * 128, row * 128, 128, 128, x, y, S, S);
  ctx.filter = "none";
  if (z.flash > 0) { ctx.save(); ctx.globalAlpha = 0.55; ctx.globalCompositeOperation = "lighter"; ctx.drawImage(ZSHEET.sheets[nm], col * 128, row * 128, 128, 128, x, y, S, S); ctx.restore(); }
  if (z.type === "creeper") {                   // brasa no peito: aviso de que explode
    const low = 1 - Math.max(0, z.hp / z.maxHp), pulse = 0.6 + 0.4 * Math.sin(game.time / (220 - 120 * low));
    const cx = z.x - Math.cos(z.angle) * 2, cy = z.y - S * 0.48, rr = (5 + 4 * low) * S / 86;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr * 2.4);
    g.addColorStop(0, `rgba(255,90,40,${0.85 * pulse})`); g.addColorStop(1, "rgba(255,40,20,0)");
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g; circle(cx, cy, rr * 2.4); ctx.restore();
  }
  if (z.type === "spitter") {
    const pulse = 0.8 + 0.2 * Math.sin(game.time / 150);
    ctx.fillStyle = `rgba(143,209,79,${0.75 * pulse})`; circle(z.x - Math.cos(z.angle) * 5, z.y - S * 0.42, 6 * pulse * S / 86);
  }
  const top = z.y - S * (nm === "z_dog" ? 0.4 : 0.72);
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
  const sun = game.inside ? 0 : sunIntensity();
  const L = chestPoint(), px = L.x - cam.x, py = L.y - cam.y, a = player.angle;
  if (sun > 0.001) {
    // Sol externo simulado, com luz dourada difusa vindo do alto/esquerda.
    // Sem cone artificial: o sol ilumina o cenário inteiro, ao contrário
    // da lanterna. Entardecer reduz o efeito continuamente.
    ctx.save();
    const warmth = ctx.createLinearGradient(0, 0, W, H);
    warmth.addColorStop(0, `rgba(255,201,132,${0.11 * sun})`);
    warmth.addColorStop(0.55, `rgba(249,193,112,${0.075 * sun})`);
    warmth.addColorStop(1, `rgba(233,165,89,${0.025 * sun})`);
    ctx.fillStyle = warmth; ctx.fillRect(0, 0, W, H);
    const sunlight = ctx.createRadialGradient(W * 0.16, -H * 0.22, 12,
      W * 0.16, -H * 0.22, Math.max(W, H) * 1.15);
    sunlight.addColorStop(0, `rgba(255,235,176,${0.105 * sun})`);
    sunlight.addColorStop(0.45, `rgba(255,213,146,${0.038 * sun})`);
    sunlight.addColorStop(1, "rgba(255,199,130,0)");
    ctx.fillStyle = sunlight; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // A lanterna só existe à noite; desliga automaticamente ao amanhecer.
  if (flashlightActive()) {
    const reach = 360, half = 0.42, I = 0.05 + dark * 0.22;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(px, py, 12, px, py, reach);
    g.addColorStop(0, `rgba(255,214,140,${I})`);
    g.addColorStop(0.55, `rgba(255,200,120,${I * 0.55})`);
    g.addColorStop(1, "rgba(255,190,110,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(px, py);
    ctx.arc(px, py, reach, a - half, a + half); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Neblina azul no escuro e poeira quente bem mais sutil de dia.
  const fog = ctx.createRadialGradient(px, py, 140, px, py, Math.max(W, H) * 0.8);
  fog.addColorStop(0, "rgba(70,100,140,0)");
  fog.addColorStop(1, sun > 0 ? `rgba(166,141,98,${0.07 * sun + 0.10 * (1 - sun)})` :
    `rgba(60,88,128,${game.inside ? 0.16 : 0.26})`);
  ctx.fillStyle = fog; ctx.fillRect(0, 0, W, H);
  if (sun < 0.1) {
    ctx.fillStyle = `rgba(40,70,110,${0.06 * (1 - sun)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Vinheta suavizada em dias de sol, preservada na escuridão.
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, `rgba(0,0,6,${0.55 - 0.22 * sun})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
