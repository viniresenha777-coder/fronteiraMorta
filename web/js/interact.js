"use strict";
// =====================================================================
//  Interação: vasculhar, entrar e sair de prédios, postos e viagem rápida
// =====================================================================
const EXIT = { x: W / 2 - 60, y: H - 96, w: 120, h: 56, kind: "exit", name: "Porta" };
// tamanho do lugar atual (interiores grandes rolam a câmera)
function IW() { return game.inside ? game.inside.iw || W : WORLD_W; }
function IH() { return game.inside ? game.inside.ih || H : WORLD_H; }
const SAFE_KINDS = ["stash", "bank", "clinic", "board", "travel", "shopc", "craft"];

function spots() {
  if (game.inside) {
    const h = game.inside;
    const drops = (game.groundDrops || []).filter(d => d.expiresAt > performance.now() && d.inside === h);

    EXIT.x = IW() / 2 - 60; EXIT.y = IH() - 96;
    return [...drops, ...h.interior.filter((f) => !f.opened && f.searchable !== false && f.kind !== "decor" && f.kind !== "shopc"), ...h.corpses.filter((c) => !c.opened), ...((h.level | 0) === 0 ? [EXIT] : [])];
  }
  const near = world.loot.query(player.x - 60, player.y - 60, player.x + 60, player.y + 60).filter((o) => !o.opened && !(o.fall > 0));
  for (const c of world.corpses) if (!c.opened && Math.abs(c.x - player.x) < 90 && Math.abs(c.y - player.y) < 90) near.push(c);
  for (const d of game.groundDrops || []) {
    if (!d.inside && d.cx === world.cell.cx && d.cy === world.cell.cy &&
        d.expiresAt > performance.now() && Math.abs(d.x - player.x) < 60 &&
        Math.abs(d.y - player.y) < 60) near.push(d);
  }
  return near;
}
function nearSpot() {
  let best = null, bd = 32;
  for (const s of spots()) { if (s.table && !spotHasRealLoot(s)) continue; const d = rectDist(player.x, player.y, s); if (d < bd) { bd = d; best = s; } }
  return best;
}
function spotPrompt(s) {
  if (s.kind === "grounddrop") return "E: recolher item (" + Math.ceil(Math.max(0, s.expiresAt - performance.now()) / 1000) + "s)";
  if (s.kind === "door") return s.house.safe ? `E: entrar em ${s.name}` : s.house.type === "casa" ? "E: entrar na casa" : `E: entrar (${s.name.toLowerCase()})`;
  if (s.kind === "exit") return "E: sair";
  if (s.kind === "stairs") return `E: ${s.label}`;
  if (s.kind === "survivor") return "E: resgatar o sobrevivente";
  if (s.kind === "shopc") return ""; // Loja é decoração.
  if (SAFE_KINDS.includes(s.kind)) return `E: usar ${s.name.toLowerCase()}`;
  return `Segure E: vasculhar ${s.name.toLowerCase()}`;
}

// ---------- Quantos itens vêm por lugar ----------
// lixeira: 1 (70%) ou 2 (30%) · corpo na rua: sempre 1 · resto: 1 (70%), 2 (20%), 3 (8%), 4 (2% e +1 crédito)
function lootCount(table) {
  if (table === "body") return 1;
  const r = Math.random(), k = r < 0.7 ? 1 : r < 0.9 ? 2 : r < 0.98 ? 3 : 4;
  return table === "trash" ? Math.min(2, k) : k;
}
function lootAmt(e) { return e[1] + Math.floor(Math.random() * (e[2] - e[1] + 1)); }
// efeitos dos implantes no saque
function upChance() { return 0.25 * (1 + player.fx.mcChance / 100); }                 // arma já vir com melhorias
function upBonus() { return player.flags && player.flags.mc ? 2 : 0; }
function ammoMult() { return Math.max(0.2, 1 + player.fx.ammoLoot / 100); }
// colete achado no saque (só os que se compram com dinheiro; regiões piores dão coletes melhores)
function lootVest(zone) {
  const ids = VESTS.map((v, i) => i).filter((i) => VESTS[i].price), max = Math.min(ids.length - 1, 1 + regionOf(zone));
  return { type: "vest", idx: ids[Math.floor(Math.random() * (max + 1))], mcArmor: player.flags.mc ? 6 : 0 };
}
function vestChance(t) { return (t.weapon || 0) * 0.3 * (1 + player.fx.armorFind / 100) * (vipActive() ? 1.6 : 1); }
function lootEntry(cat, t, table, zone) {
  if (cat === "weapon") {
    const up = {};
    if (zone >= 4 && Math.random() < upChance()) for (let i = 0; i < 1 + Math.floor(zone / 5) + upBonus(); i++) { const s = pick(UP_STATS).id; up[s] = Math.min(UP_MAX, (up[s] || 0) + 1); }
    return { type: "weapon", inst: newInst(randomWeaponDrop(zone, vipActive() ? 1 : 0), up) };
  }
  if (cat === "cash") return { type: "cash", amt: lootCash(lootAmt(t.cash), zone) };
  if (cat === "ammo") {
    const types = usedAmmoTypes(), ammo = types.length ? pick(types) : "9mm";
    return { type: "ammo", ammo, amt: Math.round(lootAmt(t.ammo) * AMMO[ammo].box * (vipActive() ? 2 : 1) * ammoMult()) };
  }
  if (cat === "mat") {
    const r = Math.random(), id = table === "chest" && r < 0.06 ? "nucleo" : r < 0.5 ? "sucata" : r < 0.78 ? "pecas" : "eletronicos";
    return { type: "mat", id, amt: id === "nucleo" ? 1 : 1 + Math.floor(Math.random() * 2) };
  }
  if (cat === "implant") return { type: "implant", im: randomImplant() };
  if (cat === "food") return { type: "food", amt: lootAmt(t.food), q: rollFoodQ(zone), spr: pick(FOOD_SPR) };
  if (cat === "anti") return { type: "anti", amt: lootAmt(t.anti), spr: "pills" };
  return { type: cat, amt: lootAmt(t[cat]), spr: cat === "med" ? pick(MED_SPR) : Math.random() < 0.5 ? "soda" : null };
}
// sorteia QUANTOS itens e depois QUAIS (tipos diferentes, pesados pelo que cada lugar costuma ter)
function rollLoot(table, zone) {
  if (table === "airdrop") return rollLootFull(table, zone);
  const ec = EMPTY_CHANCE[table] != null ? EMPTY_CHANCE[table] : EMPTY_CHANCE.furniture;
  if (Math.random() < ec * (game.inside && game.inside.landmark ? 0.45 : 1) * Math.max(0, 1 - player.fx.lootSpots / 100)) return [];
  const t = TABLES[table] || {}, sc = 1 + player.fx.scavenger / 100, vip = vipActive() ? 1.6 : 1, pool = [];
  for (const k of ["cash", "food", "water", "med", "ammo", "anti"]) if (t[k]) pool.push([k, t[k][0] * (k === "cash" ? 1 : sc) * vip]);
  const mc = MAT_CHANCE[table] != null ? MAT_CHANCE[table] : 0.06;
  if (mc && table !== "body") pool.push(["mat", mc * sc * (1 + player.fx.miscFind / 100)]);
  // arma e implante têm chance própria (antes, móveis com poucos tipos de item davam implante demais)
  const special = [];
  if (t.weapon && Math.random() < 2 * t.weapon * (1 + player.fx.hunter / 100) * vip * (1 + diffOf(zone) * 0.3)) special.push(lootEntry("weapon", t, table, zone));
  // nos pontos especiais os implantes acompanham a região (azul dá pouco, roxa dá mais)
  const ic = (IMPLANT_CHANCE[table] || 0) * (game.inside && game.inside.landmark ? 0.35 + regionOf(zone) * 0.12 : 1);
  if (ic && Math.random() < 2 * ic * IMPLANT_RARITY * (1 + player.fx.implantLoot / 100) * vip) special.push(lootEntry("implant", t, table, zone));
  if (t.weapon && special.length < 2 && Math.random() < vestChance(t)) special.push(lootVest(zone));
  const want = lootCount(table), k = Math.min(special.length ? want - special.length : want, pool.length), out = special;
  for (let i = 0; i < k; i++) {
    let r = Math.random() * pool.reduce((s, p) => s + p[1], 0), idx = 0;
    for (; idx < pool.length - 1; idx++) { r -= pool[idx][1]; if (r <= 0) break; }
    out.push(lootEntry(pool.splice(idx, 1)[0][0], t, table, zone));
  }
  if (want === 4) out.push({ type: "credit", amt: 1 });
  return out;
}

// ---------- Saque dos chefes: só arma, colete e implante (+ componentes de craft) ----------
function weaponBetween(minR, maxR) {
  const list = WLIST.filter((d) => d.rar >= minR && d.rar <= maxR && !d.craftOnly && !d.fists && d.id !== "pistola");
  return pick(list).id;
}
// chefes: o implante agora é raro; quando não vem, cai uma arma boa no lugar
function bossImplant() {
  if (Math.random() < BOSS_IMPLANT * (1 + player.fx.implantLoot / 100)) return { type: "implant", im: randomImplant() };
  return { type: "weapon", inst: newInst(weaponBetween(2, 4), upgrades(1 + upBonus())) };
}
function bossVest(a, b) { return { type: "vest", idx: a + Math.floor(Math.random() * (b - a + 1)), mcArmor: player.flags.mc ? 6 : 0 }; }
function upgrades(n) { const up = {}; for (let i = 0; i < n; i++) { const s = pick(UP_STATS).id; up[s] = Math.min(UP_MAX, (up[s] || 0) + 1); } return up; }
function bossLoot(id, zone) {
  const rb = Math.random() * 100 < player.fx.bossRare ? 1 : 0;      // Matador: raridade maior no saque dos chefes
  const Wp = (a, b, up) => ({ type: "weapon", inst: newInst(weaponBetween(Math.min(4, a + rb), Math.min(4, b + rb)), up || (upBonus() ? upgrades(upBonus()) : {})) });
  const special = () => ({ type: "weapon", inst: newInst(pick(["besta", "serra", "lancachamas"])) });
  let out;
  switch (id) {
    case "acougueiro": out = [Wp(2, 2), bossVest(1, 3)]; break;
    case "matriarca":  out = [bossImplant(), bossVest(2, 4)]; break;
    case "capataz":    out = [Wp(2, 3), bossVest(4, 6)]; break;
    case "pestilento": out = [special(), bossImplant()]; break;
    case "carrasco":   out = [Wp(3, 3, upgrades(3 + Math.floor(Math.random() * 4) + upBonus())), Wp(2, 3)]; break;
    case "necromante": out = [bossImplant(), bossImplant()]; break;
    case "alfa":       out = [Wp(3, 4), bossVest(5, 6)]; break;
    case "ceifador":   out = [Wp(4, 4), bossImplant()]; break;
    default:           out = [Wp(2, 3), bossVest(1, 4)];
  }
  out.push({ type: "mat", id: "nucleo", amt: 1 });
  if (regionOf(zone) >= 6 && Math.random() < 0.25) out.push({ type: "mat", id: "placa", amt: 1 });
  return out;
}

// saque cheio (caixa de suprimentos): cada tipo é sorteado separado
function rollLootFull(table, zone) {
  const t = TABLES[table] || {}, out = [];
  for (const k of ["weapon", "cash", "ammo", "food", "water", "med", "anti"]) {
    if (k === "weapon") {
      const wc = (t.weapon || 0) * (1 + player.fx.hunter / 100) * (vipActive() ? 1.6 : 1) * (1 + diffOf(zone) * 0.3);
      if (wc > 0 && Math.random() < wc) {
        const up = {};
        if (zone >= 4 && Math.random() < upChance()) for (let i = 0; i < 1 + Math.floor(zone / 5) + upBonus(); i++) { const s = pick(UP_STATS).id; up[s] = Math.min(UP_MAX, (up[s] || 0) + 1); }
        out.push({ type: "weapon", inst: newInst(randomWeaponDrop(zone, (vipActive() ? 1 : 0) + (table === "boss" || table === "airdrop" ? 1 : 0) + (table === "boss" && Math.random() * 100 < player.fx.bossRare ? 1 : 0)), up) });
      }
      continue;
    }
    const e = t[k];
    if (!e || Math.random() >= e[0] * (vipActive() ? 1.6 : 1) * (k === "cash" ? 1 : 1 + player.fx.scavenger / 100)) continue;
    let amt = e[1] + Math.floor(Math.random() * (e[2] - e[1] + 1));
    if (k === "cash") out.push({ type: "cash", amt: lootCash(amt, zone) });
    else if (k === "ammo") {
      const types = usedAmmoTypes(), ammo = types.length ? pick(types) : "9mm";
      out.push({ type: "ammo", ammo, amt: Math.round(amt * AMMO[ammo].box * (vipActive() ? 2 : 1) * ammoMult()) });
    } else if (k === "food") out.push({ type: "food", amt, q: table === "airdrop" ? (Math.random() < 0.6 ? "fresca" : "comum") : rollFoodQ(zone), spr: pick(FOOD_SPR) });
    else if (k === "anti") out.push({ type: "anti", amt, spr: "pills" });
    else out.push({ type: k, amt, spr: k === "med" ? pick(MED_SPR) : Math.random() < 0.5 ? "soda" : null });
  }
  if (Math.random() < (MAT_CHANCE[table] != null ? MAT_CHANCE[table] : 0.06) * (1 + player.fx.scavenger / 100) * (1 + player.fx.miscFind / 100)) {
    const r = Math.random(), id = table === "boss" ? "nucleo" : table === "chest" && r < 0.06 ? "nucleo" : r < 0.5 ? "sucata" : r < 0.78 ? "pecas" : "eletronicos";
    out.push({ type: "mat", id, amt: id === "nucleo" ? 1 : 1 + Math.floor(Math.random() * (table === "boss" ? 1 : 3)) });
    if (table === "boss") out.push({ type: "mat", id: pick(["pecas", "eletronicos"]), amt: 3 + Math.floor(Math.random() * 4) });
  }
  if (Math.random() < (IMPLANT_CHANCE[table] || 0) * IMPLANT_RARITY * (1 + player.fx.implantLoot / 100) * (vipActive() ? 1.6 : 1))
    out.push({ type: "implant", im: randomImplant() });
  if (Math.random() < vestChance(t)) out.push(lootVest(zone));
  return out;
}
function interact() {
  const s = nearSpot();
  if (!s) return;
  if (s.kind === "door") { enterHouse(s.house); return; }
  if (s.kind === "exit") { leaveHouse(); return; }
  if (s.kind === "stairs") { changeFloor(s.dir); return; }
  if (s.kind === "survivor") { pickupSurvivor(s); return; }
  if (s.kind === "grounddrop") {
    if (s.expiresAt <= performance.now()) return;
    game.found = [s.entry]; game.foundSrc = "item deixado no chão";
    game.foundDrop = s; game.foundSpot = s; mouse.down = false;
    return;
  }
  if (s.kind === "shopc") return; // Nenhum menu ao interagir.
  if (SAFE_KINDS.includes(s.kind)) {
    game.menu = s.kind === "board" ? "missions" : s.kind;
    game.atBase = true; game.tab = 0; game.cur = 0; game.input = null; game.vside = 0; game.vcur = 0; game.ccur = 0; game.cstat = 0;
    return;
  }
  // vasculhar não é instantâneo: segure E até a barrinha encher
  game.search = { spot: s, t: 0, dur: searchTime(s) };
}
function searchTime(s) {
  const base = s.kind === "airdrop" || s.table === "boss" ? 2200 : s.kind === "chest" || s.table === "chest" ? 1600 : s.table === "trash" || s.table === "body" ? 800 : 1200;
  return base / Math.max(0.3, 1 + player.fx.searchSpeed / 100);
}
// chamado todo quadro: enche a barra enquanto E está apertado e você continua perto
function searchTick(dt) {
  const sr = game.search;
  if (!sr) return;
  if (!keys.e || sr.spot.opened || nearSpot() !== sr.spot) { game.search = null; return; }
  sr.t += dt;
  if (sr.t >= sr.dur) { game.search = null; openSpot(sr.spot); }
}
// O loot é sorteado uma só vez antes de destacar o objeto.
// Assim, só fica amarelo quando existe um item REAL para recolher.
function spotLootPrepared(spot) {
  if (!spot || spot.opened || spot.searchable === false || !spot.table ||
      SAFE_KINDS.includes(spot.kind) ||
      spot.kind === "door" || spot.kind === "decor" || spot.kind === "exit") return [];
  const now = game.time || 0;
  if (!spot.preparedLoot || (spot.preparedAt != null && now - spot.preparedAt >= 300000)) {
    const zone = game.inside ? game.inside.row : rowAt(spot.y + (spot.h || 0) / 2);
    const found = spot.table === "boss" ? bossLoot(spot.bossId, zone) : rollLoot(spot.table, zone);
    const dz = deadZoneDrop(zone);
    if (dz) found.push(dz);
    spot.preparedLoot = found;
    spot.preparedAt = now;
  }
  return spot.preparedLoot;
}
function spotHasRealLoot(spot) { return spotLootPrepared(spot).length > 0; }
function openSpot(s) {
  const found = spotLootPrepared(s).slice();
  s.opened = true; s.openedAt = game.time;
  missionProgress("search", 1); stat("searches");
  if (s.kind === "airdrop") stat("airdrops");

  if (found.some(item => item.dead && item.type === "implant"))
    game.banner = { text: "Implante da Zona Morta!", sub: "Recompensa rara", t: 3200, gold: true };
  if (!found.length) { sfx.empty(); toast(`${s.name}: vazio`); return; }
  game.found = found; game.foundSrc = s.name; game.foundSpot = s; game.foundDrop = null; mouse.down = false;
  sfx.pickup();
}

// ---------- Interiores ----------
function makeInterior(h, list, lvl) {
  list = list || []; lvl = lvl | 0;
  const R = mulberry(Math.floor(bHash(h, lvl + 71) * 4294967296));
  const choose = a => a[Math.floor(R() * a.length)];
  const range = (a, b) => a + R() * (b - a);
  const d = h.def, iw = h.iw || W, ih = h.ih || H, area = (iw * ih) / (W * H);
  let n = d.n[0] + Math.floor(R() * (d.n[1] - d.n[0] + 1));
  n = Math.round(n * Math.sqrt(area) * (lvl > 0 && !d.landmark ? 0.7 : 1));
  const keepClear = lvl === 0 ? { x: iw / 2 - 100, y: ih - 210, w: 200, h: 210 } : { x: 40, y: ih / 2 - 60, w: 200, h: 170 };
  const add = (name, kind, table) => {
    const f = FURN[name] || { w: 26, h: 20, color: "#8a5a2b" };
    for (let t = 0; t < 50; t++) {
      let x, y;
      const wall = R();
      if (wall < 0.3) { x = 60 + R() * (iw - 120 - f.w); y = 56; }
      else if (wall < 0.5) { x = 56; y = 70 + R() * (ih - 260 - f.h); }
      else if (wall < 0.7) { x = iw - 56 - f.w; y = 70 + R() * (ih - 260 - f.h); }
      else { x = 120 + R() * (iw - 240 - f.w); y = 120 + R() * (ih - 320 - f.h); }
      if (hits(list, x, y, f.w, f.h, kind === "decor" ? 14 : 22) || hits([keepClear], x, y, f.w, f.h, 0)) continue;
      const items = [];
      for (let i = 0; i < 10; i++) items.push({ u: R(), v: R(), c: choose(["#c0392b", "#e0b040", "#4aa3df", "#6fae4f", "#e5e0c8", "#a35bd0", "#d9822b"]) });
      list.push({ x, y, w: f.w, h: f.h, color: f.color, kind, table, name, opened: false, items });
      return;
    }
  };
  for (let i = 0; i < n; i++) { const name = choose(d.furn); add(name, "furniture", name); }
  if (R() < (d.landmark ? 0.35 : 0.22)) add("Baú", "chest", "chest");
  // enfeites (sem saque) para o lugar parecer mobiliado; não mudam a quantidade de saque
  if (d.decor) { const nd = Math.round((2 + Math.floor(R() * 3)) * Math.sqrt(area)); for (let i = 0; i < nd; i++) add(choose(d.decor), "decor", null); }
  h.rug = d.floor === "wood" || d.floor === "carpet" ? { x: range(200, iw - 600), y: range(170, ih - 360), w: range(240, 380), h: range(140, 200), c: choose(["#6e3b3b", "#3b4e6e", "#5a6e3b", "#6e5a3b"]) } : null;
  // Only search availability changes; furniture, decorations and collisions stay fixed.
  const candidates = list.filter(f => f.kind === "furniture" || f.kind === "chest");
  const shuffled = candidates.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const available = new Set(shuffled.slice(0, Math.max(1, Math.ceil(candidates.length * 0.75))));
  for (const f of candidates) f.searchable = available.has(f);
  return list;
}

// ---------- Andares ----------
function bHash(b, k) { const v = Math.sin(b.x * 12.9898 + b.y * 78.233 + (k || 0) * 3.7) * 43758.5453; return v - Math.floor(v); }
function buildingFloors(b) {
  if (b.floors) return b.floors;
  const d = b.def;
  if (b.safe) b.floors = 1;
  else if (d.floors) b.floors = d.floors[0] + Math.floor(bHash(b) * (d.floors[1] - d.floors[0] + 1));
  else { const r = bHash(b); b.floors = r < 0.5 ? 1 : r < 0.82 ? 2 : r < 0.96 ? 3 : 4; }
  return b.floors;
}
function buildingScale(b) {
  if (b.def.scale) return b.def.scale;
  const r = bHash(b, 1);
  return r < 0.3 ? (b.type === "casa" ? [1.35, 1.3] : [1.45, 1.35]) : [1, 1];
}
function floorName(h, l) { return h.def.under ? (l === 0 ? "Entrada" : `Subsolo ${l}`) : l === 0 ? "Térreo" : `${l}º andar`; }
function stairs(h, lvl, dir, iw, ih) {
  const up = dir > 0, to = lvl + dir, under = h.def.under;
  const label = under ? (up ? `descer para o subsolo ${to}` : to === 0 ? "subir para a entrada" : `subir para o subsolo ${to}`)
                      : up ? `subir para o ${to}º andar` : to === 0 ? "descer para o térreo" : `descer para o ${to}º andar`;
  return { x: up ? iw - 170 : 64, y: Math.round(ih / 2 - 31), w: 104, h: 62, kind: "stairs", dir, name: "Escada", label, opened: false, items: [] };
}
function makeLevel(h, lvl) {
  const sc = buildingScale(h), iw = Math.round(W * sc[0]), ih = Math.round(H * sc[1]), floors = buildingFloors(h);
  h.iw = iw; h.ih = ih;
  const list = [];
  if (lvl < floors - 1) list.push(stairs(h, lvl, 1, iw, ih));
  if (lvl > 0) list.push(stairs(h, lvl, -1, iw, ih));
  makeInterior(h, list, lvl);
  const L = { iw, ih, interior: list, zombies: [], corpses: [], decals: [], rug: h.rug };
  const chance = h.def.zchance * (lvl > 0 && !h.landmark ? 0.8 : 1);
  if (Math.random() < chance) {
    const area = Math.sqrt((iw * ih) / (W * H));
    const base = h.landmark ? 2 + Math.floor(Math.random() * (2 + h.row / 5)) : 1 + Math.floor(Math.random() * Math.min(4, 1 + h.row / 3));
    const n = Math.round(base * area * (h.landmark ? 1 + lvl * 0.15 : 1));
    for (let i = 0; i < n; i++) {
      const p = interiorSpot(list, iw, ih);
      const z = makeZombie(p.x, p.y, pickZType(h.row), h.row);
      z.r = Math.min(z.r, 17);
      L.zombies.push(z);
    }
  }
  return L;
}
function mountLevel(h, l) {
  const L = h.levels[l];
  h.level = l; h.interior = L.interior; h.zombies = L.zombies; h.corpses = L.corpses; h.decals = L.decals; h.iw = L.iw; h.ih = L.ih; h.rug = L.rug;
}
function saveLevel(h) {
  const L = h.levels && h.levels[h.level | 0];
  if (L) { L.zombies = h.zombies; L.corpses = h.corpses; L.decals = h.decals; }
}
// Ao entrar em um prédio, dispersa os zumbis que estavam seguindo a pessoa
// perto da porta. Mantém HP e identidade de rede; não gera cópias novas.
// Só a autoridade da rua altera a horda compartilhada.
function scatterDoorChasers(h) {
  if (h.safe || typeof fmWorld === "undefined" || !fmWorld.isAuthority() || !world) return;
  const entry = { x: player.x, y: player.y };
  const peers = typeof fmSocial !== "undefined" ? fmSocial.inSector() : [];
  let changed = false;
  for (const z of zombies) {
    if (z.hp <= 0 || z.boss || z.state !== "chase" || Math.hypot(z.x - entry.x, z.y - entry.y) > 850) continue;
    // Evita retirar um zumbi que está lutando contra outro jogador na rua.
    if (peers.some(p => Math.hypot(z.x - p.x, z.y - p.y) < 420)) continue;
    for (let attempt = 0; attempt < 36; attempt++) {
      const a = Math.random() * Math.PI * 2, d = rand(650, 1250);
      const x = entry.x + Math.cos(a) * d, y = entry.y + Math.sin(a) * d;
      if (x < 55 || y < 55 || x > WORLD_W - 55 || y > WORLD_H - 55 ||
          nearSafe(x, y, 200) || !walkable(x, y, z.r + 8) ||
          peers.some(p => Math.hypot(x - p.x, y - p.y) < 450)) continue;
      z.x = x; z.y = y;
      z.state = "idle"; z.tx = x; z.ty = y; z.wt = 0; z.lose = 0;
      z.alertT = 0; z.stuckT = 0; z.detourT = 0;
      changed = true;
      break;
    }
  }
  if (changed && typeof fmWorld.publishZombiesNow === "function") fmWorld.publishZombiesNow();
}

// Os perseguidores usam a escada 2 segundos depois. Os MESMOS zumbis são
// removidos do andar de origem e inseridos no de destino: não duplicam.
const FLOOR_CHASE_DELAY = 2000;
function queueFloorPursuit(h, fromLevel, targetLevel, dir) {
  if (!h || h.safe || typeof fmWorld !== "undefined" && fmWorld.isFollower()) return;
  const original = h.levels[fromLevel];
  if (!original) return;
  const following = original.zombies.filter(z =>
    z.hp > 0 && z.state === "chase" && Math.hypot(z.x - player.x, z.y - player.y) < 850);
  if (!following.length) return;
  game.floorPursuers = game.floorPursuers || [];
  const now = performance.now();
  for (const z of following) {
    if (game.floorPursuers.some(p => p.zombie === z)) continue;
    game.floorPursuers.push({ house: h, origin: fromLevel, target: targetLevel, dir,
      zombie: z, arriveAt: now + FLOOR_CHASE_DELAY });
  }
}
function floorPursuitTick(now = performance.now()) {
  if (!game.floorPursuers || !game.floorPursuers.length) return;
  game.floorPursuers = game.floorPursuers.filter(f => {
    if (now < f.arriveAt) return true;
    if (!game.inside || game.inside !== f.house || f.zombie.hp <= 0) return false;
    const h = f.house, source = h.levels[f.origin], dest = h.levels[f.target];
    if (!source || !dest) return false;
    const idx = source.zombies.indexOf(f.zombie);
    if (idx < 0) return false;
    source.zombies.splice(idx, 1);
    const stair = dest.interior.find(o => o.kind === "stairs" && o.dir === -f.dir);
    const sx = stair ? stair.x + stair.w / 2 : h.iw / 2;
    const sy = stair ? stair.y + stair.h / 2 : h.ih / 2;
    let x = sx, y = sy + 38;
    for (let n = 0; n < 15; n++) {
      const a = Math.random() * Math.PI * 2, dist = rand(34, 75);
      const px = sx + Math.cos(a) * dist, py = sy + Math.sin(a) * dist;
      if (px < 48 || py < 48 || px > dest.iw - 48 || py > dest.ih - 48 ||
          hits(dest.interior, px - 12, py - 12, 24, 24, 3)) continue;
      x = px; y = py; break;
    }
    f.zombie.x = x; f.zombie.y = y; f.zombie.tx = x; f.zombie.ty = y;
    f.zombie.stuckT = 0; f.zombie.detourT = 0; f.zombie.hitCd = 900;
    f.zombie.state = "chase"; f.zombie.alertT = 550; f.zombie.lose = 0;
    dest.zombies.push(f.zombie);
    if (h.level === f.target) h.zombies = dest.zombies;
    return false;
  });
}
function changeFloor(dir) {
  const h = game.inside;
  if (!h) return;
  const fromLevel = h.level | 0;
  saveLevel(h);
  const nl = fromLevel + dir;
  queueFloorPursuit(h, fromLevel, nl, dir);
  if (!h.levels[nl]) h.levels[nl] = makeLevel(h, nl);
  mountLevel(h, nl);
  // chega ao lado da escada por onde veio
  if (dir > 0) { player.x = 116; player.y = h.ih / 2 + 66; } else { player.x = h.iw - 118; player.y = h.ih / 2 + 66; }
  bullets = []; game.spits = []; game.search = null; game.hazards = []; game.snapCam = true; mouse.down = false;
  if (game.escort) { game.escort.x = player.x + 20; game.escort.y = player.y + 20; }
  sfx.door();
  toast(`${h.name} · ${floorName(h, nl)}${nl === buildingFloors(h) - 1 ? " (último)" : ""}`);
}

function makeBaseInterior() {
  return [
    { x: 100, y: 80, w: 110, h: 56, color: "#7a5a35", kind: "stash", name: "Baú da base" },
    { x: 100, y: 230, w: 110, h: 56, color: "#8a6a3a", kind: "board", name: "Missões" },
    { x: 300, y: 80, w: 130, h: 56, color: "#4a7a68", kind: "clinic", name: "Clínica" },
    { x: 520, y: 80, w: 130, h: 56, color: "#7a6a3a", kind: "shopc", name: "Loja" },
    { x: 750, y: 80, w: 110, h: 56, color: "#4b6b8a", kind: "bank", name: "Banco" },
    { x: 750, y: 230, w: 110, h: 56, color: "#4a4a5a", kind: "travel", name: "Rádio (viagem)" },
    { x: 400, y: 230, w: 160, h: 56, color: "#5e4a36", kind: "craft", name: "Oficina" }
  ];
}
function interiorSpot(list, iw, ih) {
  iw = iw || IW(); ih = ih || IH();
  for (let t = 0; t < 40; t++) {
    const x = rand(90, iw - 90), y = rand(90, ih - 240);
    if (hits(list, x - 18, y - 18, 36, 36, 4)) continue;
    return { x, y };
  }
  return { x: W / 2, y: 140 };
}
function doorFront(b) { return { x: b.door.x + b.door.w / 2, y: b.facing === "up" ? b.y - 26 : b.y + b.h + 26 }; }

function enterHouse(h) {
  scatterDoorChasers(h);
  game.floorPursuers = [];
  let fresh = false;
  if (!h.levels) {
    fresh = true;
    h.levels = [];
    if (h.safe) h.levels[0] = { iw: W, ih: H, interior: makeBaseInterior(), zombies: [], corpses: [], decals: [], rug: null };
    else h.levels[0] = makeLevel(h, 0);
  }
  placeSurvivor(h);
  mountLevel(h, 0);
  game.inside = h; game.exitPos = { x: player.x, y: player.y };
  player.x = h.iw / 2; player.y = h.ih - 120; bullets = []; game.spits = []; game.snapCam = true;
  if (game.escort) { game.escort.x = player.x - 30; game.escort.y = player.y + 10; }
  if (h.safe && game.escort) deliverSurvivor();
  sfx.door();
  if (h.safe && h.outpost != null && !save.outposts[h.outpost]) {
    save.outposts[h.outpost] = true; persist();
    game.banner = { text: `${h.name} descoberto!`, sub: "Viagem rápida liberada no rádio dos postos", t: 3000, gold: true };
  }
  game.hub = !!h.safe; // posto seguro: abre a tela da base
  const fl = buildingFloors(h);
  if (h.safe) toast(`${h.name}: aqui você está seguro`);
  else if (h.landmark && fresh) game.banner = { text: h.name, sub: `${fl} ${h.def.under ? "níveis" : "andares"} · o melhor saque da região, e muitos zumbis`, t: 3200, color: "#ff8a6a" };
  else if (fresh && h.zombies.length) toast("Cuidado: algo se mexe aqui dentro...");
  else toast(`Você entrou: ${h.name}${fl > 1 ? ` · ${fl} ${h.def.under ? "níveis" : "andares"}` : ""}`);
}
function leaveHouse() {
  game.floorPursuers = []; // perseguições pendentes não atravessam prédios.
  game.search = null; game.hub = false; game.menu = null; game.shop = false;
  const h = game.inside;
  if (h && h.levels) { saveLevel(h); mountLevel(h, 0); }
  game.inside = null; player.x = game.exitPos.x; player.y = game.exitPos.y;
  if (game.escort) { game.escort.x = player.x - 20; game.escort.y = player.y + 24; }
  bullets = []; game.spits = []; game.snapCam = true;
  sfx.door();
}

// ---------- Viagem rápida entre postos ----------
function opCell(id) { const o = OUTPOSTS[id]; return cellAt(o.cx, o.cy); }
function travelCost(id) {
  const c = world.cell, o = OUTPOSTS[id];
  const oc = cellAt(o.cx, o.cy);
  return (oc ? ECON[oc.tier].travel : 30) + (Math.abs(o.cx - c.cx) + Math.abs(o.cy - c.cy)) * 20;
}
function travelTo(id) {
  const cell = opCell(id);
  if (!save.outposts[id]) { toast("Você ainda não descobriu esse posto"); return; }
  if (game.inside && game.inside.outpost === id) { toast("Você já está aqui"); return; }
  const cost = travelCost(id);
  if (game.money < cost) { toast(`A viagem custa $${cost} (dinheiro da mochila)`); return; }
  game.money -= cost; game.menu = null; stat("travels");
  game.inside = null;
  gotoCell(cell, (wd) => doorFront(wd.outposts[id]));
  const b = world.outposts[id];
  enterHouse(b);
  toast(`Viagem até ${b.name} · -$${cost}`);
}
// admin: vai para a primeira área com esse nível de perigo
function teleportZone(r) {
  r = clamp(r, 0, MAX_ZONE);
  if (game.inside) leaveHouse();
  const list = allCells().sort((a, b) => Math.abs(a.zone - r) - Math.abs(b.zone - r));
  gotoCell(list[0], { x: MID_X, y: MID_Y });
}
