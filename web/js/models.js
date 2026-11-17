"use strict";
// =====================================================================
//  Cenário 3D: modelos fotografados no Blender (tools/blender/props.py)
//  na mesma projeção do jogo (chão visto de cima, altura subindo na tela).
//  Cada área ganha caçambas, barris, ruínas, contêineres, corpos, barricadas...
//  Tudo é sorteado com uma semente própria, então a cidade continua a mesma.
// =====================================================================
const MODEL_K = 21;                // px do mundo por metro
const MODEL_IMG = {};
function modelOk(id) { return typeof PROP_SPR !== "undefined" && !!PROP_SPR[id]; }
function modelImg(id) {
  let im = MODEL_IMG[id];
  if (!im) { im = MODEL_IMG[id] = new Image(); im.onerror = () => { im.bad = true; }; im.src = `img/props/${id}.png`; }
  return im.complete && !im.bad && im.naturalWidth ? im : null;
}
// desenha o modelo com o centro do chão em (gx, gy); k = px por metro
function drawModel(id, gx, gy, k, filter) {
  const d = modelOk(id) && PROP_SPR[id], im = d && modelImg(id);
  if (!im) return false;
  k = k || MODEL_K;
  const s = k / d.ppm;
  // O refletor/poste worklight usa apenas a própria arte. A elipse
  // antiga simulava uma sombra enorme que parecia área de impacto.
  if (id !== "worklight") {
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ellipse(gx + 3, gy + 3, d.fw * k * 0.55, d.fd * k * 0.55);
  }
  if (filter) ctx.filter = filter;
  ctx.drawImage(im, gx - d.cx * s, gy - d.cy * s, d.w * s, d.h * s);
  if (filter) ctx.filter = "none";
  if (id === "worklight") {
    // A lâmpada acesa ilumina o topo do refletor (Canvas 2D / sem WebGL).
    const bx = gx, by = gy - (d.cy - 13) * s;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(bx, by, 0, bx, by, 38);
    halo.addColorStop(0, "rgba(255,246,200,0.82)");
    halo.addColorStop(0.12, "rgba(255,224,135,0.52)");
    halo.addColorStop(0.45, "rgba(255,204,105,0.16)");
    halo.addColorStop(1, "rgba(255,184,90,0)");
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(bx, by, 38, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  return true;
}
// retângulo no chão ocupado pelo modelo
function modelRect(id, gx, gy, k) {
  const d = PROP_SPR[id]; k = k || MODEL_K;
  return { x: gx - d.fw * k / 2, y: gy - d.fd * k / 2, w: d.fw * k, h: d.fd * k };
}
// Carros das ruas: modelos 3D fotografados no Blender na mesma projeção do cenário
// (fronteiraMorta_src/blender/cars.py), cada um em 4 direções: car_<n>_<giro>.png em img/props.
// Assim o carro fica reto na rua, com o teto e as laterais na perspectiva da câmera, sem girar
// a imagem (girar uma foto 3/4 é o que deixava os carros tortos e "colados" no asfalto).
// 0-3: Zhiguli inteiros (vermelho, verde, azul, branco) · 4, 5, 7: destroçados.
const CAR_WHOLE = [0, 1, 2, 3], CAR_WRECK = [4, 5, 7];
function carHash(c) {
  return (Math.imul(Math.floor(c.x * 7.13), 73856093) ^ Math.imul(Math.floor(c.y * 3.71), 19349663)) >>> 0;
}
function carVariant(c) {
  const h = carHash(c), list = c.burnt || c.wreck || c.chp <= 0 ? CAR_WRECK : CAR_WHOLE;
  return list[h % list.length];
}
// direção do carro: horizontal = frente para a direita (0) ou esquerda (180); vertical = para cima (90) ou baixo (270)
function carYaw(c) { return c.vert ? (c.dir ? 270 : 90) : (c.dir ? 180 : 0); }
function carModel(c) { return `car_${carVariant(c)}_${carYaw(c)}`; }
function drawCarModel(c) {
  const id = carModel(c);
  if (!modelOk(id) || !modelImg(id)) { drawCar(c); return true; }      // até a imagem carregar
  const d = PROP_SPR[id], active = lootSpotActive(c);
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  // o carro ocupa o retângulo de colisão inteiro (mesma escala nas duas direções)
  const k = Math.min(c.w / d.fw, c.h / d.fd);
  // sombra de contato no chão, um pouco para baixo e à direita (luz do cenário vem de cima à esquerda)
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ellipse(cx + 3, cy + 4, d.fw * k * 0.54, d.fd * k * 0.6);
  if (active) {
    const glow = ctx.createRadialGradient(cx, cy, 5, cx, cy, Math.max(c.w, c.h) * 0.75);
    glow.addColorStop(0, "rgba(255,215,101,0.20)");
    glow.addColorStop(1, "rgba(255,205,94,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(c.w, c.h) * 0.75, 0, 6.283); ctx.fill();
  }
  const s = k / d.ppm, im = modelImg(id);
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  if (c.rot) { ctx.translate(cx, cy); ctx.rotate(c.rot); ctx.translate(-cx, -cy); }   // estacionado meio torto
  if (active) ctx.filter = "brightness(1.12) contrast(1.06)";
  else if (c.burnt) ctx.filter = "brightness(.55) saturate(.4) contrast(1.1)";
  ctx.drawImage(im, cx - d.cx * s, cy - d.cy * s, d.w * s, d.h * s);
  ctx.restore();
  if (active) drawLootQuestion(c, cx, c.y - 15);
  return true;
}
function drawDumpsterModel(o) {
  const id = o.w >= o.h ? "dumpster" : "dumpster_90";
  if (!modelOk(id)) return false;
  const d = PROP_SPR[id], k = Math.max(o.w, o.h) / Math.max(d.fw, d.fd);
  if (!drawModel(id, o.x + o.w / 2, o.y + o.h / 2, k, lootSpotActive(o) ? LOOT_YELLOW_FILTER : o.opened ? "brightness(0.7)" : null)) return false;
  if (lootSpotActive(o)) drawLootQuestion(o, o.x + o.w / 2, o.y - 11);
  return true;
}

// móveis dos interiores que têm modelo 3D
const FURN_MODEL = {
  "Armário de armas": "rifle_locker", "Armário de evidências": "lockers", "Armário de suprimentos": "lockers", "Arquivo": "lockers",
  "Mesa": "table", "Bancada": "table", "Caixa de munição": "ammo_box", "Caixa militar": "ammo_box",
  "Armário médico": "med_cart", "Caixas": "woodbox", "Carrinho": "cart"
};

// ---------- Geração: decoração 3D da área ----------
const SCENERY = {
  street: ["barrel_red", "barrel_blue", "barrel_black", "barrel_yellow", "barrel_red", "propane", "fruitbox", "woodbox", "cart"],
  bodies: ["deadbody", "deadbody_60", "bodybag"],
  ruins: ["ruin_a", "ruin_b", "ruin_c", "ruin_d", "ruin_e"],
  military: ["container", "container_90", "barrel_black", "barrel_yellow", "toolbox", "propane"]
};
// Worklights só podem nascer sobre a faixa de concreto das calçadas.
// A regra central também cobre chamadas futuras vindas de outros geradores.
function onCitySidewalk(wd, x, y) {
  return wd.blocks.some(b =>
    x >= b.x + 3 && x <= b.x + b.w - 3 &&
    y >= b.y + 3 && y <= b.y + b.h - 3 &&
    (x <= b.x + SIDEWALK - 3 || x >= b.x + b.w - SIDEWALK + 3 ||
     y <= b.y + SIDEWALK - 3 || y >= b.y + b.h - SIDEWALK + 3));
}
function addModel(wd, id, gx, gy, opt) {
  if (!modelOk(id)) return null;
  if (id === "worklight" && !onCitySidewalk(wd, gx, gy)) return null;
  opt = opt || {};
  const k = opt.k || MODEL_K, r = modelRect(id, gx, gy, k);
  const m = 6;
  if (opt.check !== false && !free(wd, r.x, r.y, r.w, r.h, opt.margin != null ? opt.margin : m)) return null;
  // não cobre baús, lixeiras, portas nem corpos com itens
  if (wd.loot.query(r.x - 20, r.y - 20, r.x + r.w + 20, r.y + r.h + 20).some((o) => r.x - 20 < o.x + o.w && r.x + r.w + 20 > o.x && r.y - 20 < o.y + o.h && r.y + r.h + 20 > o.y)) return null;
  const o = { id, x: gx, y: gy, k, south: gy + r.h / 2 };
  wd.models.push(o);
  if (opt.solid !== false && r.w * r.h > 120) {
    if (id === "worklight") {
      // Contato somente com o pequeno pé central do refletor.
      // Não bloquear por todo o retângulo da imagem ou por sua sombra.
      const foot = Math.max(3, Math.min(4, k * 0.17));
      solid(wd, { x: gx - foot, y: gy - foot, w: foot * 2, h: foot * 2, kind: "model", id, low: false }, false);
    } else {
      solid(wd, { x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4, kind: "model", id, low: !MODEL_TALL.has(id.replace(/_\d+$/, "")) }, false);
    }
  }
  return o;
}
// Modelos mais altos que o personagem: seguram tiros. O resto (barris, botijões, caixas, carrinho,
// barricada, corpos, caçamba, banco...) a bala passa por cima.
const MODEL_TALL = new Set(["van", "container", "tank", "watchtower", "transformer", "worklight", "busstop",
  "ruin_a", "ruin_b", "ruin_c", "ruin_d", "ruin_e"]);
function tryPlace(wd, id, a, R, tries, opt) {
  for (let t = 0; t < tries; t++) {
    const o = addModel(wd, id, a.x + R() * a.w, a.y + R() * a.h, opt);
    if (o) return o;
  }
  return null;
}
function inEdge(x, y) { return x < AREA_EDGE + 30 || y < AREA_EDGE + 30 || x > WORLD_W - AREA_EDGE - 30 || y > WORLD_H - AREA_EDGE - 30; }
// Refletores de obra somente nas quatro faixas de calçada de cada quadra.
function addSidewalkWorklights(wd, R) {
  for (const b of wd.blocks) {
    const n = R() < 0.36 ? 2 : 1;
    for (let j = 0; j < n; j++) for (let attempt = 0; attempt < 20; attempt++) {
      const side = Math.floor(R() * 4), pad = SIDEWALK / 2;
      let x, y;
      if (side === 0 || side === 1) {
        x = b.x + 65 + R() * Math.max(1, b.w - 130);
        y = side === 0 ? b.y + pad : b.y + b.h - pad;
      } else {
        x = side === 2 ? b.x + pad : b.x + b.w - pad;
        y = b.y + 65 + R() * Math.max(1, b.h - 130);
      }
      if (wd.lamps.some(l => Math.hypot(l.x - x, l.y - y) < 60)) continue;
      if (addModel(wd, "worklight", x, y, { k: 15, margin: 3 })) break;
    }
  }
}
function genScenery(wd) {
  wd.models = [];
  if (typeof PROP_SPR === "undefined") return;
  const R = mulberry((wd.cell.seed ^ 0x5eed1e) >>> 0), zone = wd.zone || 0;
  const [hy0, hy1] = H_STREETS[1], [vx0, vx1] = V_STREETS[1];
  // ruínas nos terrenos baldios (onde ficaram escombros)
  for (const p of wd.props) if (p.type === "rubble" && R() < 0.75) {
    const id = pick(SCENERY.ruins, R), d = PROP_SPR[id]; if (!d) continue;
    const k = Math.min(150 / d.fw, 120 / d.fd, 18);
    if (addModel(wd, id, p.x, p.y + 10, { k, margin: 4 })) p.hidden = true;
  }
  // barris, caixas e tralhas nas calçadas e nas ruas do meio
  const nStreet = 10 + Math.floor(R() * 8) + zone;
  for (let i = 0; i < nStreet; i++) for (let t = 0; t < 12; t++) {
    const horiz = R() < 0.5;
    const x = horiz ? AREA_EDGE + 40 + R() * (WORLD_W - 2 * AREA_EDGE - 80) : vx0 + 10 + R() * (vx1 - vx0 - 20);
    const y = horiz ? hy0 + 10 + R() * (hy1 - hy0 - 20) : AREA_EDGE + 40 + R() * (WORLD_H - 2 * AREA_EDGE - 80);
    if (inEdge(x, y)) continue;
    const id = pick(SCENERY.street, R);
    if (!addModel(wd, id, x, y)) continue;
    // às vezes um grupinho
    if (id.startsWith("barrel") && R() < 0.6) addModel(wd, pick(["barrel_red", "barrel_blue", "barrel_black"], R), x + 14 + R() * 6, y + (R() - 0.5) * 12);
    break;
  }
  // hidrantes e pontos de ônibus nas calçadas das quadras
  for (const b of wd.blocks) {
    if (b.kind === "outpost") continue;
    if (R() < 0.7) addModel(wd, "hydrant", b.x + 30 + R() * (b.w - 60), b.y + b.h - 10, { margin: 4, solid: false });
    if (b.kind === "com" && R() < 0.45) addModel(wd, "busstop", b.x + 80 + R() * (b.w - 160), b.y + b.h - 22, { margin: 2, solid: false });
    if (b.kind === "parking" && R() < 0.6) addModel(wd, pick(["dumpster", "container"], R), b.x + 60 + R() * (b.w - 120), b.y + 40, { margin: 4 });
  }
  addSidewalkWorklights(wd, R);
  // corpos espalhados pela rua (só cenário; os que têm itens continuam sendo os de antes)
  const nb = 2 + Math.floor(R() * 3) + Math.floor(zone / 3);
  for (let i = 0; i < nb; i++) for (let t = 0; t < 10; t++) {
    const x = AREA_EDGE + 50 + R() * (WORLD_W - 2 * AREA_EDGE - 100), y = AREA_EDGE + 50 + R() * (WORLD_H - 2 * AREA_EDGE - 100);
    if (blockAt(x, y, wd) && R() < 0.7) continue;
    if (addModel(wd, pick(SCENERY.bodies, R), x, y, { solid: false })) break;
  }
  // barricadas militares atravessadas nas ruas do meio (deixando passagem)
  const nbar = zone >= 2 ? 1 + Math.floor(R() * 3) : Math.floor(R() * 2);
  for (let i = 0; i < nbar; i++) {
    const horizSt = R() < 0.5;
    const x = horizSt ? AREA_EDGE + 120 + R() * (WORLD_W - 2 * AREA_EDGE - 240) : vx0 + 30 + R() * 30;
    const y = horizSt ? hy0 + 30 + R() * 30 : AREA_EDGE + 120 + R() * (WORLD_H - 2 * AREA_EDGE - 240);
    addModel(wd, horizSt ? "barricade_90" : "barricade", x, y);
  }
  // base segura: torres, contêineres e um blindado
  const op = wd.opBlock;
  if (op) {
    // só nas laterais: o meio fica livre entre o portão e a porta da base
    const side = (i) => ({ x: i ? op.x + op.w * 0.68 : op.x + 70, y: op.y + 70, w: op.w * 0.32 - 70, h: op.h - 140 });
    tryPlace(wd, "watchtower", side(0), R, 30, { margin: 4 });
    tryPlace(wd, "watchtower", side(1), R, 30, { margin: 4 });
    tryPlace(wd, "container_90", side(0), R, 30, { margin: 6 });
    tryPlace(wd, "container", side(1), R, 30, { margin: 6 });
    tryPlace(wd, "tank", side(R() < 0.5 ? 0 : 1), R, 30, { k: 15, margin: 6 });
    for (let i = 0; i < 6; i++) tryPlace(wd, pick(SCENERY.military, R), side(i % 2), R, 12);
  }
  // quadras especiais (delegacia/armaria): material militar no pátio
  for (const b of wd.blocks) if ((b.kind === "special" || b.kind === "parking") && R() < 0.8) {
    const a = { x: b.x + 50, y: b.y + 50, w: b.w - 100, h: b.h - 100 };
    for (let i = 0; i < 4; i++) tryPlace(wd, pick(SCENERY.military, R), a, R, 10);
    if (zone >= 2 && R() < 0.5) tryPlace(wd, R() < 0.5 ? "tank" : "tank_90", a, R, 15, { k: 15, margin: 6 });
  }
  wd.models.sort((a, b) => a.south - b.south);
  // Os modelos deadbody/bodybag já tinham coordenadas fixas por semente.
  // Mantemos o gerador e os mesmos RNG calls, mudando somente o desenho.
  // Alguns corpos decorativos passam a oferecer 1 saque, com chance
  // determinística (sem alterar loot nem posições existentes).
  for (const m of wd.models) {
    if (!SCENERY.bodies.includes(m.id)) continue;
    m.bodyReplacement = true;
    const corpse = { x: m.x - 14, y: m.y - 14, w: 28, h: 28,
      kind: "body", table: "body", name: "Zumbi caído", opened: true,
      ang: 0, bag: false };
    wd.bodies.push(corpse);
    const seed = (Math.imul(Math.floor(m.x), 73856093) ^
      Math.imul(Math.floor(m.y), 19349663) ^ (wd.cell.seed >>> 0)) >>> 0;
    const lootChance = Math.max(0.16, 0.36 - diffOf(wd.zone) * 0.03);
    if (seed / 4294967296 < lootChance) lootable(wd, corpse);
  }
}
