"use strict";
// =====================================================================
//  Cidade em grade: cada área é um mapa separado com 2 x 2 quadras.
//  Ao sair pela borda de uma área a tela escurece e carrega a vizinha
//  (para cima, para baixo ou para os lados). A planta de cada área usa
//  uma semente fixa, então você aprende o caminho a cada vida. Os chefes
//  aparecem em áreas sorteadas e trocam de lugar com o tempo.
// =====================================================================
let world = null;   // área atual
let MAP = null;     // grade com todas as áreas
const MS = 0.1;     // escala do minimapa
const BOSS_MAX = 12;
const CAR_COLORS = ["#a33b32", "#3d5f8a", "#c9c3b0", "#5b6b4a", "#7a5a2e", "#2f2f33", "#8a8f96", "#6a2f4a"];

// ---------- Grade de áreas ----------
function makeMap(seed) {
  const R = mulberry(seed), cells = [];
  for (let cy = 0; cy < MAP_H; cy++) {
    cells.push([]);
    for (let cx = 0; cx < MAP_W; cx++) {
      const ch = MAP_GRID[cy][cx];
      if (ch === ".") { cells[cy].push(null); continue; }
      const tier = TIER_OF[ch], op = OUTPOSTS.find((o) => o.cx === cx && o.cy === cy);
      cells[cy].push({
        cx, cy, tier, zone: tier * REGION_ROWS + ((cx * 2 + cy) % REGION_ROWS), code: cellCode(cx, cy),
        name: HOODS[(cx * 7 + cy * 11) % HOODS.length], op: op ? op.id : null, seed: Math.floor(R() * 1e9),
        w: null, boss: null, bossHp: null, cleared: false, leftAt: -1e9, visited: false
      });
    }
  }
  // pontos especiais: hospital, prisão e bunker em áreas sorteadas de cada região (sem base)
  const LR = mulberry(seed + 99173);
  for (const tier in LANDMARKS) {
    const opts = cells.flat().filter((c) => c && c.tier === +tier && c.op == null);
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(LR() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    LANDMARKS[tier].forEach((t, i) => { if (opts[i]) opts[i].landmark = t; });
  }
  MAP = { cells, bossT: 240000, bossRandom: mulberry(seed + 1234507) };
  for (let i = 0; i < BOSS_MAX; i++) placeBoss();
}
function cellAt(cx, cy) { return (MAP.cells[cy] && MAP.cells[cy][cx]) || null; }
function allCells() { return MAP.cells.flat().filter(Boolean); }
function bossCells() { return allCells().filter((c) => c.boss); }
// sorteia uma área sem chefe (nunca a base, nem a área onde você está) e coloca um chefe lá
function placeBoss() {
  const cur = world && world.cell;
  const free = allCells().filter((c) => !c.boss && c.op == null && c !== cur && !(c.tier === 0 && c.cx === 0));
  if (!free.length) return null;
  // escolhe primeiro o chefe que está aparecendo menos, depois uma área da cor certa para ele
  const count = (id) => bossCells().filter((c) => c.boss === id).length;
  const ids = Object.keys(BOSSES).sort((a, b) => count(a) - count(b) || a.localeCompare(b));
  for (const id of ids) {
    const opts = free.filter((c) => BOSSES[id].tiers.includes(c.tier));
    if (!opts.length) continue;
    const c = opts[Math.floor(MAP.bossRandom() * opts.length)];
    c.boss = id; c.bossHp = null; c.cleared = false;
    return c;
  }
  return null;
}
function makeWorld(seed) {
  makeMap(seed);
  const o = OUTPOSTS[0], c = cellAt(o.cx, o.cy);
  c.w = makeArea(c); c.visited = true;
  world = c.w;
  return world;
}

// ---------- Uma área ----------
function makeArea(cell) {
  const R = mulberry(cell.seed);
  const wd = {
    cell, zone: cell.zone, obstacles: [], obs: new Grid(160), loot: new Grid(160), lootList: [], buildings: [], cars: [], lamps: [], trees: [],
    props: [], decals: [], blood: [], corpses: [], blocks: [], outposts: [], paths: [], fences: [], spaces: [], bodies: [], shells: [],
    pop: false, wave1N: 0, opBlock: null, guards: []
  };
  const prev = world;
  world = wd;
  for (let i = 0; i < 4; i++) {
    const bx = AREA_EDGE + (i % 2) * (BLOCK_W + ST_W), by = AREA_EDGE + Math.floor(i / 2) * (BLOCK_H + ST_W);
    genBlock(wd, { x: bx, y: by, w: BLOCK_W, h: BLOCK_H, i }, R);
  }
  genStreets(wd, R);
  genBodies(wd, R);
  if (typeof genScenery === "function") genScenery(wd); else wd.models = [];   // cenário 3D (models.js)
  // Reaplica saques ao reconstruir a área, inclusive novos cadáveres
  // decorativos. Índices antigos permanecem iguais; os novos são anexados.
  if (Array.isArray(cell._savedLoot)) {
    wd.lootList.forEach((loot, i) => {
      if (cell._savedLoot[i]) {
        loot.opened = true;
        loot.openedAt = 0;
      }
    });
    cell._savedLoot = null;
  }
  wd.mini = buildMinimap(wd);
  world = prev || wd;
  return wd;
}

// ---------- Ajudantes de geração ----------
function solid(wd, o, tall) { o.solid = true; o.tall = !!tall; wd.obstacles.push(o); wd.obs.add(o); return o; }
function lootable(wd, o) { o.opened = false; o.openedAt = 0; wd.loot.add(o); wd.lootList.push(o); return o; }
function free(wd, x, y, w, h, m) {
  return !wd.obs.query(x - m, y - m, x + w + m, y + h + m).some((o) => x < o.x + o.w + m && x + w > o.x - m && y < o.y + o.h + m && y + h > o.y - m);
}
function blockAt(x, y, wd) { return (wd || world).blocks.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || null; }
function placeLoot(wd, a, w, h, kind, table, name, R, isSolid) {
  for (let t = 0; t < 25; t++) {
    const x = a.x + R() * Math.max(1, a.w - w), y = a.y + R() * Math.max(1, a.h - h);
    if (!free(wd, x, y, w, h, 10)) continue;
    const o = { x, y, w, h, kind, table, name };
    if (isSolid) solid(wd, o, false);
    return lootable(wd, o);
  }
  return null;
}
function addTree(wd, x, y, r, R) {
  if (!free(wd, x - 9, y - 9, 18, 18, 8)) return;
  const lobes = [], n = 4 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + R();
    lobes.push({ dx: Math.cos(a) * r * 0.45, dy: Math.sin(a) * r * 0.45, r: r * (0.5 + R() * 0.25) });
  }
  wd.trees.push({ x, y, r, lobes, tone: R() });
  solid(wd, { x: x - 6, y: y - 6, w: 12, h: 12, kind: "trunk" }, false);
}
function addCar(wd, x, y, w, h, vert, R) {
  const color = pick(CAR_COLORS, R), wreck = R() < 0.25;
  const car = { x, y, w, h, vert, color, wreck, c1: shade(color, wreck ? -0.55 : 0), c2: shade(color, wreck ? -0.45 : 0.12),
    rot: (R() - 0.5) * 0.12, dir: R() < 0.5, kind: "car", table: "car", name: "Carro", searchable: R() < 0.1 };
  car.explosive = !wreck && R() < 0.17; car.chp = 160;
  solid(wd, car, false);
  if (car.searchable) lootable(wd, car);
  wd.cars.push(car);
  return car;
}
function fence(wd, x, y, w, h) { const o = solid(wd, { x, y, w, h, kind: "fence", thin: true }, false); wd.fences.push(o); }

// ---------- Quadras ----------
function genBlock(wd, blk, R) {
  const zone = wd.zone;
  Object.assign(blk, { r: zone, kind: "res", ground: "grass" });
  wd.blocks.push(blk);
  const inner = { x: blk.x + SIDEWALK, y: blk.y + SIDEWALK, w: blk.w - SIDEWALK * 2, h: blk.h - SIDEWALK * 2 };
  // a base fica na quadra de baixo à esquerda da área
  if (wd.cell.op != null && blk.i === 2) {
    blk.kind = "outpost"; blk.ground = "plaza"; wd.opBlock = blk;
    genOutpost(wd, blk, inner, OUTPOSTS[wd.cell.op], R); return;
  }
  if (wd.cell.landmark && blk.i === 1) { genLandmark(wd, blk, inner, wd.cell.landmark, R); return; }
  const roll = R(), special = 0.05 + zone * 0.012;
  if (zone === 0) blk.kind = R() < 0.6 ? "res" : "com";
  else if (roll < 0.09) blk.kind = "park";
  else if (roll < 0.18) blk.kind = "parking";
  else if (roll < 0.18 + special) blk.kind = "special";
  else if (roll < 0.55) blk.kind = "com";
  else blk.kind = "res";

  if (blk.kind === "park") { blk.ground = "park"; genPark(wd, blk, inner, R); }
  else if (blk.kind === "parking") { blk.ground = "lot"; genParking(wd, blk, inner, R); }
  else if (blk.kind === "special") { blk.ground = "dirt"; genSpecial(wd, blk, inner, R); }
  else if (blk.kind === "com") { blk.ground = "dirt"; genLots(wd, blk, inner, 2, R, () => pick(["mercado", "farmacia", "escritorio", "armaria", "posto", "escritorio", "mercado"], R)); }
  else genLots(wd, blk, inner, 3, R, () => "casa");
  sidewalkTrash(wd, blk, R);
}

function genLots(wd, blk, inner, n, R, typeFn) {
  const lw = inner.w / n, lh = inner.h / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < n; j++) {
    const lot = { x: inner.x + j * lw, y: inner.y + i * lh, w: lw, h: lh, facing: i === 0 ? "up" : "down" };
    if (R() < 0.08) { yardStuff(wd, lot, R, true, null); continue; } // terreno baldio
    const b = placeBuilding(wd, blk, lot, typeFn(), R);
    yardStuff(wd, lot, R, false, b);
  }
}

function placeBuilding(wd, blk, lot, type, R, fixed) {
  const d = BTYPES[type], home = type === "casa";
  let bx, by, bw, bh;
  if (fixed) { bx = fixed.x; by = fixed.y; bw = fixed.w; bh = fixed.h; }
  else {
    bw = lot.w * (home ? 0.55 + R() * 0.2 : 0.74 + R() * 0.14);
    bh = lot.h * (home ? 0.48 + R() * 0.14 : 0.6 + R() * 0.14);
    bx = lot.x + (lot.w - bw) / 2 + (R() - 0.5) * (lot.w - bw) * 0.5;
    const gap = home ? 36 + R() * 24 : 20 + R() * 10;
    by = lot.facing === "up" ? lot.y + gap : lot.y + lot.h - bh - gap;
  }
  const b = { x: bx, y: by, w: bw, h: bh, type, def: d, name: d.name, color: pick(d.colors, R), roof: d.roof, facing: lot.facing,
    row: wd.zone, enter: R() < d.enter, noDoor: d.enter === 0, interior: null, zombies: null, decals: [], corpses: [] };
  solid(wd, b, true);
  wd.buildings.push(b);
  const up = lot.facing === "up";
  b.door = { x: bx + bw / 2 - 15, y: up ? by - 9 : by + bh - 1, w: 30, h: 10, kind: "door", house: b, name: d.name };
  if (b.enter) wd.loot.add(b.door);
  if (!b.noDoor) {
    const px = bx + bw / 2 - 11;
    if (up) wd.paths.push({ x: px, y: lot.y, w: 22, h: by - lot.y });
    else wd.paths.push({ x: px, y: by + bh, w: 22, h: lot.y + lot.h - (by + bh) });
  }
  // detalhes do telhado (chaminé ou aparelhos de ar)
  b.details = [];
  const nd = home ? 1 : 2 + Math.floor(R() * 3);
  for (let i = 0; i < nd; i++) b.details.push({ x: 12 + R() * Math.max(1, bw - 44), y: 12 + R() * Math.max(1, bh - 44), s: home ? 12 : 16 + R() * 8 });
  return b;
}

function yardStuff(wd, lot, R, empty, b) {
  const home = !b || b.type === "casa", up = lot.facing === "up";
  // fundos do lote (longe da rua)
  const back = b ? (up ? { x: lot.x + 8, y: b.y + b.h + 6, w: lot.w - 16, h: lot.y + lot.h - (b.y + b.h) - 12 }
                       : { x: lot.x + 8, y: lot.y + 6, w: lot.w - 16, h: b.y - lot.y - 12 })
                 : { x: lot.x + 10, y: lot.y + 10, w: lot.w - 20, h: lot.h - 20 };
  const nt = empty ? 3 + Math.floor(R() * 3) : home ? Math.floor(R() * 3) : Math.floor(R() * 1.6);
  for (let i = 0; i < nt; i++)
    if (back.h > 34) addTree(wd, back.x + 16 + R() * (back.w - 32), back.y + 16 + R() * Math.max(1, back.h - 32), 18 + R() * 16, R);
  if (b && !home && back.h > 34) {
    if (R() < 0.3) placeLoot(wd, back, 46, 28, "dumpster", "dumpster", "Caçamba", R, true);
    const nc = R() < 0.2 ? 1 : 0;
    for (let i = 0; i < nc; i++) placeLoot(wd, back, 24, 24, "crate", "crate", "Caixote", R, true);
  }
  if (b && home && R() < 0.15) {
    const x = b.x + b.w / 2 + 18 + R() * 20, y = up ? lot.y + 6 : lot.y + lot.h - 24;
    lootable(wd, { x, y, w: 14, h: 18, kind: "trash", table: "trash", name: "Lixeira" });
  }
  if (back.h > 30 && R() < (empty ? 0.15 : 0.035)) placeLoot(wd, back, 26, 20, "chest", "chest", "Baú", R, false);
  if (empty && R() < 0.6) wd.props.push({ type: "rubble", x: lot.x + lot.w / 2, y: lot.y + lot.h / 2, s: 0.8 + R() * 0.6, seed: Math.floor(R() * 1e6) });
}

function genPark(wd, blk, inner, R) {
  const cx = inner.x + inner.w / 2, cy = inner.y + inner.h / 2;
  wd.paths.push({ x: inner.x, y: cy - 14, w: inner.w, h: 28 }, { x: cx - 14, y: inner.y, w: 28, h: inner.h });
  wd.props.push({ type: "fountain", x: cx, y: cy, r: 44 });
  solid(wd, { x: cx - 44, y: cy - 44, w: 88, h: 88, kind: "fountain" }, false);
  for (const [bx, by, v] of [[cx - 130, cy - 30, 0], [cx + 86, cy + 18, 0], [cx - 30, cy - 140, 1], [cx + 18, cy + 96, 1]])
    wd.props.push({ type: "bench", x: bx, y: by, v });
  const nt = 10 + Math.floor(R() * 8);
  for (let i = 0; i < nt; i++) {
    const x = inner.x + 30 + R() * (inner.w - 60), y = inner.y + 30 + R() * (inner.h - 60);
    if (Math.abs(x - cx) < 46 || Math.abs(y - cy) < 46) continue;
    addTree(wd, x, y, 22 + R() * 18, R);
  }
  if (R() < 0.55) placeLoot(wd, inner, 26, 20, "chest", "chest", "Baú", R, false);
}

function genParking(wd, blk, inner, R) {
  const sw = 50, sd = 84;
  const rowsY = [inner.y + 8, inner.y + inner.h / 2 - sd - 2, inner.y + inner.h / 2 + 2, inner.y + inner.h - sd - 8];
  const n = Math.floor((inner.w - 90) / sw), x0 = inner.x + 10;
  for (const y of rowsY) for (let i = 0; i < n; i++) {
    const x = x0 + i * sw;
    wd.spaces.push({ x, y, w: sw, h: sd });
    if (R() < 0.5) addCar(wd, x + 6, y + 4, 38, 76, true, R);
  }
  placeBuilding(wd, blk, { x: inner.x, y: inner.y, w: inner.w, h: inner.h, facing: "up" }, "guarita", R,
    { x: inner.x + inner.w - 66, y: inner.y + inner.h / 2 - 24, w: 52, h: 48 });
  if (R() < 0.4) placeLoot(wd, inner, 24, 24, "crate", "crate", "Caixote", R, true);
}

function genSpecial(wd, blk, inner, R) {
  const top = { x: inner.x, y: inner.y, w: inner.w, h: inner.h / 2, facing: "up" };
  const b = placeBuilding(wd, blk, top, R() < 0.55 ? "delegacia" : "delegacia", R); // hospitais agora são pontos especiais
  yardStuff(wd, top, R, false, b);
  const lw = inner.w / 2;
  for (let j = 0; j < 2; j++) {
    const lot = { x: inner.x + j * lw, y: inner.y + inner.h / 2, w: lw, h: inner.h / 2, facing: "down" };
    const bb = placeBuilding(wd, blk, lot, j === 0 ? "armaria" : pick(["mercado", "farmacia", "posto"], R), R);
    yardStuff(wd, lot, R, false, bb);
  }
}

// hospital, prisão ou bunker ocupando a quadra inteira
function genLandmark(wd, blk, inner, type, R) {
  blk.kind = "special"; blk.ground = type === "hospital" ? "plaza" : "dirt";
  const fx = type === "bunker" ? { x: inner.x + inner.w / 2 - 160, y: inner.y + inner.h / 2 - 130, w: 320, h: 200 }
                               : { x: inner.x + 56, y: inner.y + 60, w: inner.w - 112, h: inner.h - 250 };
  const b = placeBuilding(wd, blk, { x: inner.x, y: inner.y, w: inner.w, h: inner.h, facing: "down" }, type, R, fx);
  b.landmark = true; b.enter = true;
  const gx = b.x + b.w / 2, f = { x: inner.x + 18, y: inner.y + 18, w: inner.w - 36, h: inner.h - 36 };
  if (type !== "hospital") {
    const t = 8, gate = 130;
    fence(wd, f.x, f.y, f.w, t); fence(wd, f.x, f.y, t, f.h); fence(wd, f.x + f.w - t, f.y, t, f.h);
    fence(wd, f.x, f.y + f.h - t, gx - gate / 2 - f.x, t); fence(wd, gx + gate / 2, f.y + f.h - t, f.x + f.w - gx - gate / 2, t);
  }
  wd.lamps.push({ x: gx - 90, y: b.y + b.h + 40, big: true }, { x: gx + 90, y: b.y + b.h + 40, big: true });
  if (type === "bunker") {
    wd.props.push({ type: "sandbags", x: gx - 150, y: b.y + b.h + 30, w: 56 }, { type: "sandbags", x: gx + 94, y: b.y + b.h + 30, w: 56 });
    for (let i = 0; i < 5; i++) wd.props.push({ type: "crates", x: f.x + 40 + R() * (f.w - 120), y: f.y + 40 + R() * 80 });
  } else if (type === "prisao") {
    wd.props.push({ type: "flag", x: b.x - 26, y: b.y + 20 });
  } else {
    for (let i = 0; i < 3; i++) addCar(wd, inner.x + 40 + i * 70, b.y + b.h + 70, 38, 76, true, R);
  }
}

function genOutpost(wd, blk, inner, op, R) {
  const bw = 300, bh = 200, bx = inner.x + (inner.w - bw) / 2, by = inner.y + inner.h / 2 - bh / 2 - 30;
  const b = placeBuilding(wd, blk, { x: inner.x, y: inner.y, w: inner.w, h: inner.h, facing: "down" }, "seguro", R, { x: bx, y: by, w: bw, h: bh });
  b.safe = true; b.outpost = op.id; b.name = op.name; b.door.name = op.name; b.color = "#3d5a46";
  wd.outposts[op.id] = b;
  // cerca com portão virado para o sul
  const f = { x: inner.x + 22, y: inner.y + 22, w: inner.w - 44, h: inner.h - 44 }, t = 8, gate = 150, gx = bx + bw / 2;
  installBaseGuards(wd, op, f);
  fence(wd, f.x, f.y, f.w, t);
  fence(wd, f.x, f.y, t, f.h);
  fence(wd, f.x + f.w - t, f.y, t, f.h);
  fence(wd, f.x, f.y + f.h - t, gx - gate / 2 - f.x, t);
  fence(wd, gx + gate / 2, f.y + f.h - t, f.x + f.w - gx - gate / 2, t);
  wd.props.push({ type: "sandbags", x: gx - gate / 2 - 60, y: f.y + f.h - 30, w: 56 }, { type: "sandbags", x: gx + gate / 2 + 4, y: f.y + f.h - 30, w: 56 });
  wd.props.push({ type: "flag", x: bx - 30, y: by + 20 });
  wd.lamps.push({ x: gx - gate / 2 - 10, y: f.y + f.h + 6, big: true }, { x: gx + gate / 2 + 10, y: f.y + f.h + 6, big: true },
    { x: f.x + 30, y: f.y + 30, big: true }, { x: f.x + f.w - 30, y: f.y + 30, big: true });
  for (let i = 0; i < 6; i++) wd.props.push({ type: "crates", x: f.x + 40 + R() * (f.w - 120), y: f.y + 40 + R() * 60 });
}

// corpos de sobreviventes espalhados (só alguns têm 1 item)
function genBodies(wd, R) {
  const CL = ["#4a5a6a", "#6a4a3a", "#3a4a3a", "#7a6a5a", "#5a3a4a", "#2a2a2e", "#8a7a52"];
  const n = 4 + Math.floor(R() * 3), lootChance = Math.max(0.1, 0.25 - diffOf(wd.zone) * 0.03);
  for (let i = 0; i < n; i++) for (let t = 0; t < 25; t++) {
    const x = 40 + R() * (WORLD_W - 80), y = 40 + R() * (WORLD_H - 80);
    if (!free(wd, x - 14, y - 14, 28, 28, 6) || inOpBlock(wd, x, y)) continue;
    const o = { x: x - 14, y: y - 14, w: 28, h: 28, kind: "body", table: "body", name: "Zumbi caído", ang: R() * 6.283,
      cloth: pick(CL, R), pants: pick(["#2e3a4a", "#3a3226", "#2a2a2a", "#4a4a32"], R), skin: pick(["#c9a07a", "#a07850", "#d8b08a", "#7a5a3a"], R), bag: R() < 0.5 };
    wd.bodies.push(o);
    if (R() < lootChance) lootable(wd, o); else o.opened = true;
    break;
  }
}
function inOpBlock(wd, x, y) { const b = wd.opBlock; return !!b && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h; }
function sidewalkTrash(wd, blk, R) {
  const n = R() < 0.2 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const side = Math.floor(R() * 4);
    let x, y;
    if (side === 0) { x = blk.x + 40 + R() * (blk.w - 80); y = blk.y + 4; }
    else if (side === 1) { x = blk.x + 40 + R() * (blk.w - 80); y = blk.y + blk.h - 22; }
    else if (side === 2) { x = blk.x + 6; y = blk.y + 40 + R() * (blk.h - 80); }
    else { x = blk.x + blk.w - 20; y = blk.y + 40 + R() * (blk.h - 80); }
    if (!free(wd, x, y, 14, 18, 6)) continue;
    lootable(wd, { x, y, w: 14, h: 18, kind: "trash", table: "trash", name: "Lixeira" });
  }
}

// ---------- Ruas: carros abandonados, postes e marcas no asfalto ----------
// As ruas da borda ficam livres para você passar de uma área para outra.
function genStreets(wd, R) {
  const [hy0, hy1] = H_STREETS[1], [vx0, vx1] = V_STREETS[1];
  const nh = 2 + Math.floor(R() * 3);
  for (let i = 0; i < nh; i++) for (let t = 0; t < 15; t++) {
    const w = 128, h = 62, x = AREA_EDGE + R() * (WORLD_W - 2 * AREA_EDGE - w);
    // Veículos abandonados no acostamento, perto do meio-fio, nunca
    // atravessados no centro da avenida. Mantém a semente por setor.
    const lane = R();
    const y = lane < 0.5 ? hy0 + 6 + lane * 14 : hy1 - h - 6 - (lane - 0.5) * 14;
    if (!free(wd, x, y, w, h, 24)) continue;
    addCar(wd, x, y, w, h, false, R); break;
  }
  const nv = 1 + Math.floor(R() * 3);
  for (let i = 0; i < nv; i++) for (let t = 0; t < 15; t++) {
    const w = 62, h = 128, lane = R(), y = AREA_EDGE + R() * (WORLD_H - 2 * AREA_EDGE - h);
    // Mesmo alinhamento junto ao meio-fio nas vias verticais.
    const x = lane < 0.5 ? vx0 + 6 + lane * 14 : vx1 - w - 6 - (lane - 0.5) * 14;
    if (!free(wd, x, y, w, h, 24)) continue;
    addCar(wd, x, y, w, h, true, R); break;
  }
  // Iluminação pública exclusivamente na calçada (faixa de concreto das
  // quadras). Evita postes no meio da pista e também remove os antigos
  // postes gerados dentro de pátios de bases e pontos de interesse.
  // Preserve luminárias de bases e pontos especiais; adicione as públicas
  // nas calçadas externas E internas, nunca no asfalto.
  wd.lamps = wd.lamps || [];
  const lampSpacing = 66;
  const addSidewalkLamp = (x, y) => {
    if (!wd.blocks.some(b => x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h &&
      (x < b.x + SIDEWALK || x > b.x + b.w - SIDEWALK ||
       y < b.y + SIDEWALK || y > b.y + b.h - SIDEWALK))) return;
    if (!free(wd, x - 4, y - 4, 8, 8, 4)) return;
    if (wd.lamps.some(l => Math.hypot(l.x - x, l.y - y) < lampSpacing)) return;
    wd.lamps.push({ x, y, big: true });
  };
  for (const b of wd.blocks) {
    const s = SIDEWALK / 2;
    // Calçadas voltadas à avenida central (inalterada em 140 unidades).
    const innerY = b.i < 2 ? b.y + b.h - s : b.y + s;
    const innerX = (b.i % 2) === 0 ? b.x + b.w - s : b.x + s;
    for (const f of [0.27, 0.73]) {
      addSidewalkLamp(b.x + b.w * f, innerY);
      addSidewalkLamp(innerX, b.y + b.h * f);
    }
    // Calçadas voltadas às QUATRO ruas laterais de 150 unidades.
    // Três postes espaçados por lado, inclusive no norte/sul/leste/oeste.
    const outerY = b.i < 2 ? b.y + s : b.y + b.h - s;
    const outerX = (b.i % 2) === 0 ? b.x + s : b.x + b.w - s;
    for (const f of [0.18, 0.50, 0.82]) {
      addSidewalkLamp(b.x + b.w * f, outerY);
      addSidewalkLamp(outerX, b.y + b.h * f);
    }
  }
  for (let i = 0; i < 160; i++) {
    const x = R() * WORLD_W, y = R() * WORLD_H;
    if (blockAt(x, y, wd)) continue;
    const type = pick(["crack", "crack", "oil", "debris", "paper", "manhole", "crack", "debris"], R), pts = [];
    if (type === "crack") { let px = 0, py = 0; for (let j = 0; j < 5; j++) { px += (R() - 0.3) * 18; py += (R() - 0.5) * 14; pts.push([px, py]); } }
    wd.decals.push({ x, y, type, rot: R() * 6.283, s: 0.6 + R() * 0.9, pts });
  }
}

// ---------- Minimapa da área (desenhado uma vez) ----------
function buildMinimap(wd) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(WORLD_W * MS); c.height = Math.ceil(WORLD_H * MS);
  const g = c.getContext("2d");
  g.fillStyle = "#36383d"; g.fillRect(0, 0, c.width, c.height);
  const GC = { park: "#2f4a2a", lot: "#3e3f44", plaza: "#33503c", dirt: "#45473a", grass: "#3b4a32" };
  for (const b of wd.blocks) { g.fillStyle = GC[b.ground]; g.fillRect(b.x * MS + 1, b.y * MS + 1, b.w * MS - 2, b.h * MS - 2); }
  for (const t of wd.trees) { g.fillStyle = "#22361d"; g.fillRect(t.x * MS - 1, t.y * MS - 1, 3, 3); }
  for (const b of wd.buildings) {
    g.fillStyle = b.safe ? "#6fd08a" : b.enter ? shade(b.color, 0.3) : shade(b.color, -0.25);
    g.fillRect(b.x * MS, b.y * MS, Math.max(2, b.w * MS), Math.max(2, b.h * MS));
  }
  for (const f of wd.fences) { g.fillStyle = "#8fbf9a"; g.fillRect(f.x * MS, f.y * MS, Math.max(1, f.w * MS), Math.max(1, f.h * MS)); }
  // bordas com passagem ganham a cor da área vizinha
  const cl = wd.cell;
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const n = cellAt(cl.cx + dx, cl.cy + dy);
    g.fillStyle = n ? REGIONS[n.tier].color : "#111";
    if (dy) g.fillRect(0, dy < 0 ? 0 : c.height - 3, c.width, 3); else g.fillRect(dx < 0 ? 0 : c.width - 3, 0, 3, c.height);
  }
  return c;
}

// ---------- Dia e noite ----------
function darkness() {
  const h = (game.clock / 60) % 24;
  if (h >= 7 && h < 17) return 0.08;
  if (h >= 17 && h < 19.5) return 0.08 + ((h - 17) / 2.5) * 0.74;
  if (h >= 19.5 || h < 4.5) return 0.82;
  return 0.82 - ((h - 4.5) / 2.5) * 0.74;
}
function isNight() { return darkness() > 0.5; }
 // Intensidade da luz solar: aurora gradual, sol quente entre manhã/tarde,
 // pôr do sol suave. Mesmo relógio global para todos os jogadores.
function sunIntensity() {
  const h = ((game.clock / 60) % 24 + 24) % 24;
  if (h < 5.5 || h >= 19) return 0;
  if (h < 8) return (h - 5.5) / 2.5;
  if (h < 16) return 1;
  return (19 - h) / 3;
}
// A lanterna NÃO fica acesa sob a luz do dia (inclusive no sprite).
function flashlightActive() { return isNight(); }


// ---------- Zumbis da área ----------
function walkable(x, y, r) {
  return !world.obs.query(x - r, y - r, x + r, y + r).some((o) => x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h);
}
function nearSafe(x, y, d) { return world.outposts.some((b) => b && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < d); }
function randomInArea(minDist) {
  for (let t = 0; t < 60; t++) {
    const x = rand(40, WORLD_W - 40), y = rand(40, WORLD_H - 40);
    if (Math.hypot(x - player.x, y - player.y) < minDist) continue;
    if (nearSafe(x, y, 360) || !walkable(x, y, 16)) continue;
    return { x, y };
  }
  return null;
}
function randomInRow(r, minDist) { return randomInArea(minDist); }
function bossAlive() { const c = world.cell; return !!c.boss; }
// chega na área: zumbis aparecem; numa área de chefe, todos vêm atrás de você
function activateArea() {
  const cell = world.cell;
  if (world.pop) return;
  world.pop = true;
  if (typeof fmWorld !== "undefined" && fmWorld.isFollower()) { fmWorld.requestSync(); return; }
  for (const o of world.lootList) if (o.opened && game.time - o.openedAt > 300000) o.opened = false; // saques voltam depois de 5 min
  const z = cell.zone, reg = regionOf(z), frac = clamp((game.time - cell.leftAt) / 90000, 0.25, 1);
  let n = Math.round(Math.min(18, z === 0 ? 5 : 7 + (z % REGION_ROWS) * 1.2 + reg * 1.1) * REGIONS[reg].spawn * frac * (isNight() ? 1.25 : 1));
  if (cell.op != null) n = Math.round(n * 0.6);
  const boss = !!cell.boss;
  if (boss) n = Math.max(n, 10);
  if (boss && cell.cleared) n = Math.round(n * 0.7);
  const before = zombies.length;
  for (let i = 0; i < n; i++) { const p = randomInArea(420); if (p) spawnGroup(p.x, p.y, pickZType(z), z); }
  world.wave1N = 0;
  if (boss) {
    for (const m of zombies.slice(before)) { m.wave1 = !cell.cleared; alertZombie(m); }
    world.wave1N = cell.cleared ? 0 : zombies.length - before;
    const p = randomInArea(520) || { x: MID_X, y: MID_Y };
    const b = spawnBoss(p.x, p.y, z, cell.boss);
    alertZombie(b);
    game.banner = { text: `☠ ${BOSSES[cell.boss].name}`, sub: cell.cleared ? "O chefe ainda está aqui · menos zumbis nesta área" : "O chefe sentiu sua presença: todos os zumbis da área vêm atrás de você!", t: 4200, color: "#e04a4a" };
    game.shake = 6; sfx.groan(1);
  }
}
// ao matar a primeira leva da área do chefe, o surgimento de zumbis cai 30%
function mapTick(dt) {
  // Chefes iniciais seguem uma semente comum. Não se criam novos chefes
  // aleatórios por navegador durante o multiplayer.
  if (typeof fmWorld === "undefined") MAP.bossT -= dt;
  if (typeof fmWorld === "undefined" && MAP.bossT <= 0) {
    MAP.bossT = 240000;
    if (bossCells().length < BOSS_MAX) {
      const c = placeBoss();
      if (c) toast(`☠ ${BOSSES[c.boss].name} apareceu na área ${c.code} (${REGIONS[c.tier].name}) · veja no mapa (N)`);
    }
  }
  if (game.inside || !world.pop) return;
  const cell = world.cell;
  if (cell.boss && !cell.cleared && world.wave1N > 0 && !zombies.some((z) => z.wave1 && z.hp > 0)) {
    cell.cleared = true;
    game.banner = { text: "Área limpa!", sub: "A primeira leva caiu · agora surgem 30% menos zumbis aqui", t: 3200, gold: true };
  }
  for (const z of zombies) if (z.boss && z.hp > 0 && !z.half && z.hp <= z.maxHp * 0.5) bossHalf(z);
}
// com 50% da vida o chefe chama todos os zumbis da área para cima de você
function bossHalf(z) {
  z.half = true;
  const n = Math.max(5, Math.round((world.wave1N || 8) * 0.6 * (world.cell.cleared ? 0.7 : 1)));
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 12; t++) {
      const a = Math.random() * 6.283, d = rand(160, 420), x = z.x + Math.cos(a) * d, y = z.y + Math.sin(a) * d;
      if (x < 30 || y < 30 || x > WORLD_W - 30 || y > WORLD_H - 30 || !walkable(x, y, 16)) continue;
      const m = makeZombie(x, y, pickZType(z.zone), z.zone); m.mother = z; zombies.push(m); break;
    }
  }
  for (const m of zombies) if (m.hp > 0) alertZombie(m);
  game.banner = { text: `${z.bossName} chamou a horda!`, sub: "Com metade da vida, o chefe convocou todos os zumbis da área", t: 3200, color: "#e04a4a" };
  game.shake = 10; sfx.groan(1);
}
function manageRows() { if (!game.inside && !world.pop) activateArea(); }
// sai da área: guarda a vida do chefe e tira os zumbis
function resetRows() {
  for (const z of zombies) if (z.boss && z.hp > 0) world.cell.bossHp = z.hp;
  zombies = [];
  if (world.pop) { world.pop = false; world.cell.leftAt = game.time; }
}
function trickleSpawn() {
  const cell = world.cell, z = cell.zone, reg = regionOf(z), night = isNight(), calm = cell.cleared ? 0.7 : 1;
  const cap = Math.round(Math.min(45, (12 + (z % REGION_ROWS) * 2 + reg * 1.6) * REGIONS[reg].spawn * (night ? 1.4 : 1)) * calm * (cell.op != null ? 0.5 : 1));
  if (zombies.length >= cap) return;
  if (calm < 1 && Math.random() < 0.3) return;
  for (let t = 0; t < 12; t++) {
    const a = Math.random() * 6.283, d = rand(560, 820), x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d;
    if (x < 20 || y < 20 || x > WORLD_W - 20 || y > WORLD_H - 20) continue;
    if (nearSafe(x, y, 360) || !walkable(x, y, 16)) continue;
    const before = zombies.length;
    spawnGroup(x, y, pickZType(z), z);
    if (cell.boss) for (const m of zombies.slice(before)) alertZombie(m);
    return;
  }
}

// ---------- Trocar de área (com transição de tela) ----------
function gotoCell(cell, pos) {
  resetRows();
  if (!cell.w) cell.w = makeArea(cell);
  world = cell.w;
  cell.visited = true;
  game.inside = null;
  const p = typeof pos === "function" ? pos(world) : pos;
  player.x = p.x; player.y = p.y;
  if (!walkable(player.x, player.y, player.r)) {
    for (let r = 10; r < 300; r += 10) {
      let ok = false;
      for (let a = 0; a < 6.283; a += 0.5) { const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (x > 20 && y > 20 && x < WORLD_W - 20 && y < WORLD_H - 20 && walkable(x, y, player.r)) { player.x = x; player.y = y; ok = true; break; } }
      if (ok) break;
    }
  }
  bullets = []; game.spits = []; game.parts = []; game.flashes = []; game.smoke = []; game.fuses = [];
  game.hazards = game.hazards.filter((h) => h.inside);
  for (const a of game.airdrops) { const wd = a.world; if (wd) wd.loot.remove(a); }
  game.airdrops = []; game.horde = null;
  game.area = cell.zone; game.best = Math.max(game.best, cell.zone); missionProgress("area", game.best);
  game.snapCam = true;
  const RG = REGIONS[cell.tier];
  game.banner = { text: `${cell.code} · ${cell.name}`, sub: `Área ${RG.name} · ${RG.diff}${cell.op != null ? " · posto seguro" : ""}`, t: 2600, color: RG.color };
  activateArea();
  if (!game.restoring) checkpoint("troca de zona");
}
// chegou na borda: tenta passar para a área vizinha
function streetExit(sx, sy) {
  const lanes = sx ? H_STREETS : V_STREETS, v = sx ? player.y : player.x;
  return lanes.some(([a, b]) => v >= a && v <= b);
}
function edgeCheck(dx, dy) {
  if (game.trans || game.inside) return;
  const m = player.r + 3;
  let sx = 0, sy = 0;
  if (dx < 0 && player.x <= m) sx = -1; else if (dx > 0 && player.x >= WORLD_W - m) sx = 1;
  else if (dy < 0 && player.y <= m) sy = -1; else if (dy > 0 && player.y >= WORLD_H - m) sy = 1;
  if (!sx && !sy) return;
  // só muda de área nas pontas das ruas (cantos e meio de cada borda)
  if (!streetExit(sx, sy)) return;
  const c = world.cell, n = cellAt(c.cx + sx, c.cy + sy);
  game.edgeT = game.edgeT || 0;
  if (!n) { if (game.time - game.edgeT > 2500) { toast("Sem passagem: escombros bloqueiam o caminho"); game.edgeT = game.time; } return; }
  if (n.tier === 8 && player.level < GRAY_LEVEL && !adm.noReq) {
    if (game.time - game.edgeT > 2500) { toast(`Zona Cinza: só a partir do nível ${GRAY_LEVEL}`); game.edgeT = game.time; }
    return;
  }
  const x = sx > 0 ? m + 24 : sx < 0 ? WORLD_W - m - 24 : player.x;
  const y = sy > 0 ? m + 24 : sy < 0 ? WORLD_H - m - 24 : player.y;
  game.trans = { t: 0, out: true, cell: n, x, y };
  mouse.down = false;
}
function transTick(dt) {
  const tr = game.trans;
  if (!tr) return;
  tr.t += dt;
  if (tr.out && tr.t >= 280) { gotoCell(tr.cell, { x: tr.x, y: tr.y }); tr.out = false; tr.t = 0; }
  else if (!tr.out && tr.t >= 380) game.trans = null;
}
function drawTransition() {
  const tr = game.trans;
  if (!tr) return;
  const a = tr.out ? tr.t / 280 : 1 - tr.t / 380;
  ctx.fillStyle = `rgba(4,5,4,${clamp(a, 0, 1)})`; ctx.fillRect(0, 0, W, H);
  if (a > 0.5) {
    ctx.globalAlpha = (a - 0.5) * 2;
    const c = tr.cell, RG = REGIONS[c.tier];
    txt(`${c.code} · ${c.name}`, W / 2, H / 2 - 4, 26, "#e5e0c8", "center", true);
    txt(`Área ${RG.name} · ${RG.diff}`, W / 2, H / 2 + 22, 15, RG.color === "#2a2a2e" ? "#9a9aa0" : RG.color, "center", true);
    ctx.globalAlpha = 1;
  }
}

function locationName(x, y) {
  const c = world.cell, b = blockAt(x, y);
  const kinds = { res: "bairro residencial", com: "comércio", park: "praça", parking: "estacionamento", special: "centro", outpost: "posto seguro" };
  return `${c.code} · ${c.name} · ${b ? kinds[b.kind] : "rua"}`;
}
