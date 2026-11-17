"use strict";
// =====================================================================
//  Ferro Velho (na base): vende qualquer item e desmonta armas em
//  peças de arma e sucata. Itens raros pedem confirmação antes.
//  Os preços são provisórios: o jogo ainda não tem economia oficial.
// =====================================================================
const JUNK_RAR = [40, 130, 380, 950, 2400];          // piso de venda por raridade da arma
const RESET_STATS_PRICE = MATS.reset_stats.price;
const JUNK_CONS = { comum: 8, fresca: 16, podre: 2, water: 6, med: 25, anti: 40 };

function weaponSellPrice(inst) {
  const d = WDEF[inst.id];
  return Math.round(Math.max(JUNK_RAR[d.rar] || 40, (d.price || 0) * 0.3) * (1 + upSum(inst) * 0.12));
}
function weaponParts(inst) {
  const d = WDEF[inst.id], r = d.rar, up = upSum(inst);
  const out = { sucata: 1 + r + (d.cat === "machinegun" || d.cat === "shotguns" ? 1 : 0), pecas: 1 + r * 2 + Math.floor(up / 2) };
  if (r >= 3) out.eletronicos = r - 2;
  if (r >= 4 || d.legendary) out.nucleo = 1;
  if (d.melee) { out.pecas = Math.max(1, out.pecas - 1); }
  return out;
}
function partsText(p) { return Object.keys(p).map((k) => `${p[k]}x ${MATS[k].name}`).join(" + "); }
function implantSellPrice(im) { return IMP[im.id].scrap; }
function matSellPrice(id) { return { sucata: 15, pecas: 35, eletronicos: 55, nucleo: 400, placa: 300 }[id] || 10; }
function ammoSellPrice(t) { return Math.max(0.2, AMMO[t].price / AMMO[t].box * 0.3); }

// tudo o que você pode vender, numa lista só
function junkItems() {
  const L = [];
  player.slots.forEach((it, i) => { if (it) L.push({ kind: "weapon", it, where: "slot", i, name: instName(it), unit: weaponSellPrice(it), qty: 1, rare: WDEF[it.id].rar >= 2, sub: `slot ${i + 1}${player.cur === i ? " · na mão" : ""}` }); });
  player.pack.forEach((it) => {
    if (it.kind === "mat" && it.id === "reset_stats") return; // cartão consumível não é revendido
    if (it.kind === "weapon") L.push({ kind: "weapon", it, where: "pack", name: instName(it), unit: weaponSellPrice(it), qty: 1, rare: WDEF[it.id].rar >= 2, sub: "mochila" });
    else if (it.kind === "mat") L.push({ kind: "mat", it, name: MATS[it.id].name, unit: matSellPrice(it.id), qty: it.qty, rare: it.id === "nucleo" || it.id === "placa", sub: "material" });
  });
  for (const t of Object.keys(AMMO)) if (player.reserve[t] > 0) L.push({ kind: "ammo", t, name: `Munição ${t}`, unit: ammoSellPrice(t), qty: player.reserve[t], rare: false, sub: "balas" });
  for (const q of ["fresca", "comum", "podre"]) if (player.foodQ[q] > 0) L.push({ kind: "food", q, name: FOOD_Q[q].name[0].toUpperCase() + FOOD_Q[q].name.slice(1), unit: JUNK_CONS[q], qty: player.foodQ[q], sub: "comida" });
  if (player.water > 0) L.push({ kind: "water", name: "Garrafa de água", unit: JUNK_CONS.water, qty: player.water, sub: "água" });
  if (player.med > 0) L.push({ kind: "med", name: "Kit médico", unit: JUNK_CONS.med, qty: player.med, sub: "remédio" });
  if (player.anti > 0) L.push({ kind: "anti", name: "Antibiótico", unit: JUNK_CONS.anti, qty: player.anti, sub: "remédio" });
  player.bag.forEach((im) => L.push({ kind: "implant", im, name: implantName(im), unit: implantSellPrice(im), qty: 1, rare: true, sub: "implante (não instalado)" }));
  VESTS.forEach((v, i) => { if (save.vestsOwned[i] && i !== save.vest) L.push({ kind: "vest", idx: i, name: v.name, unit: Math.round(v.price * 0.3 * (vestDur(i) / 100)) || 20, qty: 1, rare: v.rar >= 2, sub: `colete guardado · ${Math.round(vestDur(i))}%` }); });
  return L;
}
function sellEntry(e, n) {
  n = Math.max(1, Math.min(n, e.qty));
  const total = Math.max(1, Math.round(e.unit * n));
  switch (e.kind) {
    case "weapon":
      if (e.where === "slot") { player.slots[e.i] = null; if (player.cur === e.i) { const j = player.slots.findIndex(Boolean); player.cur = j >= 0 ? j : 0; } player.reloading = 0; }
      else player.pack.splice(player.pack.indexOf(e.it), 1);
      break;
    case "mat": e.it.qty -= n; if (e.it.qty <= 0) player.pack.splice(player.pack.indexOf(e.it), 1); break;
    case "ammo": player.reserve[e.t] -= n; break;
    case "food": player.foodQ[e.q] -= n; player.food -= n; break;
    case "water": player.water -= n; break;
    case "med": player.med -= n; break;
    case "anti": player.anti -= n; break;
    case "implant": player.bag.splice(player.bag.indexOf(e.im), 1); break;
    case "vest": save.vestsOwned[e.idx] = false; if (save.vestDur) delete save.vestDur[e.idx]; break;
  }
  game.money += total; sfx.buy(); persist();
  toast(`Vendeu ${n > 1 ? `${n}x ` : ""}${e.name} por $${total}`);
  game.jcur = Math.max(0, Math.min(game.jcur, junkItems().length - 1));
}
function dismantle(e) {
  const p = weaponParts(e.it);
  if (e.where === "slot") { player.slots[e.i] = null; if (player.cur === e.i) { const j = player.slots.findIndex(Boolean); player.cur = j >= 0 ? j : 0; } player.reloading = 0; }
  else player.pack.splice(player.pack.indexOf(e.it), 1);
  let toVault = false;
  for (const k in p) if (!addMat(k, p[k])) { addMat(k, p[k], save.vault, VAULT_MAX); toVault = true; }
  sfx.reload(); persist();
  toast(`Desmontou ${e.name}: ${partsText(p)}${toVault ? " (parte foi para o baú)" : ""}`);
  game.jcur = Math.max(0, Math.min(game.jcur, junkItems().length - 1));
}
// itens raros pedem confirmação
function askSell(e, n) {
  if (!e) return;
  if (e.rare) game.jconfirm = { text: `Vender ${e.name}${n > 1 ? ` (${n}x)` : ""} por $${Math.round(e.unit * Math.min(n, e.qty))}?`, sub: "Item raro: depois de vendido não volta.", fn: () => sellEntry(e, n) };
  else sellEntry(e, n);
}
function askDismantle(e) {
  if (!e || e.kind !== "weapon") return;
  const fn = () => dismantle(e);
  if (e.rare) game.jconfirm = { text: `Desmontar ${e.name}?`, sub: `Você recebe ${partsText(weaponParts(e.it))}. A arma some.`, fn };
  else fn();
}

function buyResetStatsCard() {
  if (!inSafe()) { toast("Compre o cartão no Ferro Velho da base."); return; }
  if (game.money < RESET_STATS_PRICE) { toast("Dinheiro insuficiente para o cartão."); return; }
  if (!addMat("reset_stats", 1)) { toast("Mochila cheia."); return; }
  game.money -= RESET_STATS_PRICE;
  sfx.buy();
  checkpoint("compra de cartão de reset");
  toast("Cartão Reset de Stats comprado! Abra a mochila (B) e arraste-o até o personagem.");
}
function confirmBuyResetStats() {
  game.jconfirm = {
    text: "Comprar Cartão Reset de Stats?",
    sub: "Custa $" + RESET_STATS_PRICE.toLocaleString("pt-BR") + " · Uso único · Arraste no personagem",
    fn: buyResetStatsCard
  };
}

function junkKey(k) {
  const items = junkItems(), e = items[game.jcur | 0];
  if (game.jconfirm) {
    if (k === "enter" || k === "y" || k === "s") { const f = game.jconfirm.fn; game.jconfirm = null; f(); }
    else if (k === "n" || k === "escape") game.jconfirm = null;
    return;
  }
  if (k === "escape" || k === "e") { game.menu = null; return; }
  if (k === "c") { confirmBuyResetStats(); return; }
  if (k === "w" || k === "arrowup") game.jcur = Math.max(0, (game.jcur | 0) - 1);
  else if (k === "s" || k === "arrowdown") game.jcur = Math.min(items.length - 1, (game.jcur | 0) + 1);
  else if (k === "enter" || k === "v") askSell(e, 1);
  else if (k === "t") askSell(e, e ? e.qty : 1);
  else if (k === "d") askDismantle(e);
}
function drawJunk() {
  game.jcur = game.jcur | 0;
  menuFrame("Ferro Velho", `Dinheiro: $${game.money}  ·  venda o que achou ou desmonte armas em peças e sucata`);
  const items = junkItems();
  if (game.jcur >= items.length) game.jcur = Math.max(0, items.length - 1);
  // lista (com rolagem)
  const lx = 40, ly = 96, lw = 470, rh = 34, vis = 13;
  const top = Math.max(0, Math.min(game.jcur - 6, items.length - vis));
  if (!items.length) txt("Você não tem nada para vender.", lx + lw / 2, 260, 14, "#6d6a58", "center", true);
  items.slice(top, top + vis).forEach((e, k) => {
    const i = top + k, y = ly + k * rh, sel = i === game.jcur;
    rowBox(lx, y, lw, rh - 4, sel, e.rare ? "#7a5a2a" : null);
    const col = e.kind === "weapon" ? rarColor(WDEF[e.it.id]) : e.kind === "vest" ? RARITY[VESTS[e.idx].rar].color : e.rare ? "#ffd96a" : "#e5e0c8";
    txt(`${e.qty > 1 ? `${e.qty}x ` : ""}${e.name}`, lx + 10, y + 19, 13, col, "left", true, 260);
    txt(e.sub, lx + 280, y + 19, 10, "#a9a58f", "left", false, 100);
    txt(`$${e.qty > 1 ? `${Math.round(e.unit * 100) / 100} un.` : Math.round(e.unit)}`, lx + lw - 10, y + 19, 12, "#8fd08a", "right", true);
    rowClick(lx, y, lw, rh - 4, sel, () => { game.jcur = i; }, () => askSell(e, 1));
  });
  if (items.length > vis) txt(`${game.jcur + 1}/${items.length}`, lx + lw, ly - 6, 10, "#a9a58f", "right");
  // detalhe do item escolhido
  const e = items[game.jcur], px = 540, pw = 380;
  ctx.fillStyle = "rgba(0,0,0,0.3)"; rr(px - 10, 92, pw + 20, 458, 8); ctx.fill();
  if (e) {
    if (e.kind === "weapon") drawWeaponSide(WDEF[e.it.id], px + pw / 2, 160, 1.5);
    else if (e.kind === "mat") drawMatIcon(e.it.id, px + pw / 2, 160, 1.5);
    else if (e.kind === "vest") drawVestIcon(e.idx, px + pw / 2, 160, 1.4);
    else if (e.kind === "implant") drawEntryIcon({ type: "implant", im: e.im }, px + pw / 2, 160, 1.4);
    else if (e.kind === "ammo") drawEntryIcon({ type: "ammo", ammo: e.t }, px + pw / 2, 160, 1.4);
    else drawEntryIcon({ type: e.kind === "food" ? "food" : e.kind, spr: e.kind === "food" ? "beans" : e.kind === "water" ? "soda" : e.kind === "anti" ? "pills" : "medkit" }, px + pw / 2, 160, 1.4);
    txt(e.name, px, 240, 18, "#f2eedc", "left", true, pw);
    txt(e.qty > 1 ? `Você tem ${e.qty} · $${Math.round(e.unit * 100) / 100} cada · tudo por $${Math.round(e.unit * e.qty)}` : `Vende por $${Math.round(e.unit)}`, px, 262, 13, "#8fd08a", "left", true, pw);
    if (e.rare) txt("★ Item raro: pede confirmação antes de vender", px, 282, 12, "#ffd96a", "left", true);
    let by = 300;
    btn(px, by, 180, 36, e.qty > 1 ? "Vender 1 (Enter)" : "Vender (Enter)", () => askSell(e, 1), true);
    if (e.qty > 1) btn(px + 196, by, 180, 36, `Vender tudo (T)`, () => askSell(e, e.qty));
    if (e.kind === "weapon") {
      by += 50;
      btn(px, by, 376, 36, "Desmontar (D)", () => askDismantle(e));
      txt(`Rende: ${partsText(weaponParts(e.it))}`, px, by + 56, 12, "#c9c4ad", "left", false, pw);
      txt("As peças vão para a mochila (ou para o baú, se não couber).", px, by + 74, 11, "#a9a58f", "left", false, pw);
    }
  } else txt("Nada selecionado", px + pw / 2, 280, 14, "#6d6a58", "center");

  // Cartão de reset no espaço inferior do Ferro Velho, abaixo dos comandos
  // de vender/desmontar, sem cobrir detalhes de armas ou outros itens.
  ctx.fillStyle = "rgba(45,35,15,0.96)"; rr(532, 444, 394, 101, 7); ctx.fill();
  ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 1.5; ctx.stroke();
  txt("★ CARTÃO RESET DE STATS", 547, 468, 16, "#ffdf70", "left", true);
  txt("Recupere seus pontos de atributo · uso único", 547, 488, 11, "#d8d2ba");
  // Miniatura original no canto superior direito do cartão, como solicitado.
  if (RESET_CARD_ART.complete && RESET_CARD_ART.naturalWidth) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(RESET_CARD_ART, 815, 446, 100, 47);
  }
  btn(547, 496, 362, 39, "COMPRAR · $" + RESET_STATS_PRICE.toLocaleString("pt-BR") + " (C)", confirmBuyResetStats, true);

  hint("C compra cartão de reset · W/S escolhe · Enter vende · T vende tudo · D desmonta · Esc fecha");
  // confirmação para itens raros
  if (game.jconfirm) {
    const c = game.jconfirm;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
    regClick(0, 0, W, H, () => {}); // bloqueia cliques atrás da confirmação
    ctx.fillStyle = "rgba(40,30,16,0.97)"; rr(W / 2 - 230, 200, 460, 190, 10); ctx.fill();
    ctx.strokeStyle = "#ffd96a"; ctx.lineWidth = 2; ctx.stroke();
    txt("CONFIRMAR", W / 2, 232, 13, "#ffd96a", "center", true);
    txt(c.text, W / 2, 268, 17, "#f2eedc", "center", true, 430);
    txt(c.sub, W / 2, 292, 12, "#c9c4ad", "center", false, 430);
    btn(W / 2 - 170, 320, 150, 42, "SIM (Enter)", () => { game.jconfirm = null; c.fn(); }, true);
    btn(W / 2 + 20, 320, 150, 42, "NÃO (Esc)", () => { game.jconfirm = null; });
  }
}
