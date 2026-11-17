"use strict";
// =====================================================================
//  Menus: loja, baú, banco, VIP, clínica, atributos, missões, viagem,
//  mapa e painel de administrador (F2) — lógica e desenho.
// =====================================================================

// ---------- Teclas dentro dos menus ----------
function menuKey(k) {
  if (game.input) { inputKey(k); return; }
  if (game.menu === "admin") { if (!canUseAdmin()) { game.menu = null; game.input = null; return; } adminKey(k); return; }
  if (game.menu === "name") { nameKey(k); return; }
  if (game.menu === "friends") { friendsKey(k); return; }
  if (game.menu === "messages") { messagesKey(k); return; }
  if (game.menu === "prof") { profKey(k); return; }
  if (game.menu === "junk") { junkKey(k); return; }
  if (game.menu === "creditshop") { creditShopKey(k); return; }
  if (k === "escape" || k === "e" || k === "b" || (k === "c" && game.menu === "stats") || (k === "m" && game.menu === "sector") || (k === "n" && game.menu === "map") || (k === "o" && game.menu === "obj")) { game.menu = null; return; }
  if (game.menu === "bank") {
    if (k === "d") game.input = { mode: "deposit", text: "" };
    else if (k === "s") game.input = { mode: "withdraw", text: "" };
    else if (k === "c") game.input = { mode: "credits", text: "" };
    else if (k === "a") deposit(game.money);
    else if (k === "t") withdraw(save.bank);
    else if (k === "g") buyGM();
  } else if (game.menu === "clinic") clinicKey(k);
  else if (game.menu === "stats") statsKey(k);
  else if (game.menu === "missions") missionKey(k);
  else if (game.menu === "travel") travelKey(k);
  else if (game.menu === "stash") stashKey(k);
  else if (game.menu === "pack") packKey(k);
  else if (game.menu === "craft") craftKey(k);
  else if (game.menu === "map") mapKey(k);
  else if (game.menu === "obj") objKey(k);
}
function inputKey(k) {
  const inp = game.input;
  if (k === "escape") { game.input = null; return; }
  if (k === "enter") {
    const rawText = inp.text || "";
    const a = parseInt(rawText || "0", 10);
    game.input = null;
    if (inp.mode === "admText") { if (canUseAdmin() && rawText.trim()) inp.fn(rawText.trim()); }
    else if (inp.mode === "adm") { if (canUseAdmin() && rawText !== "") inp.fn(a); }
    else if (inp.mode === "deposit") deposit(a);
    else if (inp.mode === "credits") buyCredits(a);
    else withdraw(a);
    return;
  }
  if (k === "backspace") { inp.text = inp.text.slice(0, -1); return; }
  if (inp.mode === "admText") {
    const raw = game.rawKey || "";
    if (raw.length === 1 && /[\p{L}\p{N} _.-]/u.test(raw) && inp.text.length < 40)
      inp.text += raw;
  } else if (/^[0-9]$/.test(k) && inp.text.length < 9) inp.text += k;
}

// ---------- Banco e VIP (loja, baú e mochila ficam em inventory.js) ----------
function deposit(a) {
  if (a <= 0) { toast("Nada para depositar"); return; }
  if (game.money < a) { toast("Dinheiro insuficiente na mochila"); return; }
  game.money -= a; save.bank += a; persist(); toast(`Depositou $${a}`);
}
function withdraw(a) {
  if (a <= 0) { toast("O banco está vazio"); return; }
  if (save.bank < a) { toast("Saldo insuficiente"); return; }
  save.bank -= a; game.money += a; persist(); toast(`Sacou $${a}`);
}
function buyCredits(n) {
  if (n <= 0) { toast("Digite uma quantidade de créditos"); return; }
  const cost = n * CREDIT_PRICE;
  if (save.bank < cost) { toast(`Saldo do banco insuficiente (${n} créditos = $${cost})`); return; }
  save.bank -= cost; save.credits += n; persist(); toast(`Comprou ${n} créditos`);
}
function buyGM() {
  if (save.gm) { toast("Você já tem VIP legado permanente"); return; }
  if (save.credits < GM_COST) { toast(`Precisa de ${GM_COST} créditos para ativar o VIP`); return; }
  save.credits -= GM_COST; addVipMonths(1); persist(); toast("VIP de 1 mês ativado!"); sfx.level();
}

// ---------- Atributos ----------
function statsKey(k) {
  if (k === "tab") { game.stab = game.stab ? 0 : 1; game.skc = save.skin; return; }
  if (game.stab === 1) { skinsKey(k); return; }
  if (k === "w" || k === "arrowup") game.cur = Math.max(0, game.cur - 1);
  else if (k === "s" || k === "arrowdown") game.cur = Math.min(ATTRS.length - 1, game.cur + 1);
  else if (k === "enter" || k === "arrowright") addPoint(1);
  else if (k === "d") addPoint(5);
}
function addPoint(n) {
  const d = ATTRS[game.cur], weapon = WEAPON_SKILL_IDS.includes(d.id), pool = weapon ? "wpoints" : "points";
  if (player[pool] <= 0) { toast(weapon ? "Sem pontos de armas" : "Sem pontos de atributo"); return; }
  const amt = Math.min(n, player[pool], weaponSkillCap(d.id) - player.attrs[d.id]);
  if (amt <= 0) { toast("Atributo no máximo"); return; }
  const previousMaxHp = player.maxHp;
  player.attrs[d.id] += amt; player[pool] -= amt;
  if (d.id === "endurance") {
    recalcImplants();
    player.hp = Math.min(player.maxHp, player.hp + Math.max(0, player.maxHp - previousMaxHp));
  }
  syncChar();
}

// ---------- Missões ----------
function missionText(m) {
  switch (m.type) {
    case "kill": return `Elimine ${m.target} zumbis`;
    case "killcat": return `Elimine ${m.target} zumbis usando ${CATNAME[m.cat]}`;
    case "killtype": return `Elimine ${m.target} ${ZTYPES[m.cat] ? ZTYPES[m.cat].plural : "zumbis"}`;
    case "search": return `Vasculhe ${m.target} lugares`;
    case "boss": return "Derrote um chefe";
    case "rescue": return m.progress >= m.target ? `Sobrevivente de ${m.code} resgatado` : game.escort ? "Leve o sobrevivente a um posto seguro" : `Resgate o sobrevivente em ${m.code} (num prédio marcado SOS)`;
    default: return `Chegue a uma área de perigo ${m.target} (${REGIONS[regionOf(m.target)].name})`;
  }
}
function makeOffers() {
  const L = player.level, cats = Object.keys(CATNAME), offers = [];
  const mk = (type, target, f, extra) => offers.push(Object.assign({ type, target, progress: 0, money: Math.round((30 + 12 * L) * f * econ(game.best).reward), xp: Math.round(xpNeed(L) * 0.6 * f) }, extra || {}));
  mk("kill", Math.min(80, 8 + Math.floor(L * 0.6)), 1);
  mk("killcat", Math.min(40, 6 + Math.floor(L / 8)), 1.1, { cat: pick(cats) });
  const types = Object.keys(ZTYPES).filter((t) => t !== "walker" && ZTYPES[t].from <= Math.max(game.best, 2));
  if (types.length) mk("killtype", Math.min(25, 3 + Math.floor(L / 6)), 1.3, { cat: pick(types) });
  mk("search", Math.min(20, 4 + Math.floor(L / 10)), 0.8);
  if (Math.random() < 0.6 && !save.missions.some((m) => m.type === "rescue")) rescueOffer(mk);
  if (L >= 5 && Math.random() < 0.6) mk("boss", 1, 2.2);
  else if (game.best < MAX_ZONE) mk("area", Math.min(MAX_ZONE, game.best + 2 + Math.floor(L / 20)), 1.2);
  else mk("kill", Math.min(120, 20 + L), 1.4);
  return offers;
}
function missionProgress(type, n, cat) {
  let changed = false;
  for (const m of save.missions) {
    if (m.type !== type || m.progress >= m.target) continue;
    if ((type === "killcat" || type === "killtype") && m.cat !== cat) continue;
    m.progress = Math.min(m.target, type === "area" ? Math.max(m.progress, n) : m.progress + n);
    changed = true;
    if (m.progress >= m.target) toast(`Missão concluída: ${missionText(m)} (entregue num posto)`);
  }
  if (changed) persist();
}
function missionItems() {
  return [...(game.atBase ? game.board.map((m) => ({ src: "offer", m })) : []), ...save.missions.map((m) => ({ src: "active", m }))];
}
function missionKey(k) {
  const items = missionItems();
  if (k === "w" || k === "arrowup") game.cur = Math.max(0, game.cur - 1);
  else if (k === "s" || k === "arrowdown") game.cur = Math.max(0, Math.min(items.length - 1, game.cur + 1));
  else if (k === "enter") missionAct(items[game.cur]);
  else if (k === "v") {
    const it = items[game.cur];
    if (it && it.src === "active") {
      if (it.m.type === "rescue") game.escort = null;
      save.missions.splice(save.missions.indexOf(it.m), 1); persist(); toast("Missão abandonada");
      game.cur = Math.max(0, Math.min(game.cur, missionItems().length - 1));
    }
  }
}
function missionAct(it) {
  if (!it) return;
  if (it.src === "offer") {
    if (save.missions.length >= 3) { toast("Máximo de 3 missões ativas"); return; }
    game.board.splice(game.board.indexOf(it.m), 1);
    if (it.m.type === "area") it.m.progress = Math.min(it.m.target, game.best);
    save.missions.push(it.m); persist(); toast("Missão aceita");
  } else if (it.m.progress >= it.m.target) {
    if (!game.atBase) { toast("Entregue no quadro de missões de um posto"); return; }
    save.missions.splice(save.missions.indexOf(it.m), 1);
    game.money += it.m.money; gainXp(it.m.xp); sfx.buy();
    toast(`Missão entregue: +$${it.m.money} e ${Math.round(it.m.xp * xpMult())} de XP`);
    if (game.board.length < 2) game.board = makeOffers();
    persist();
  } else toast("Missão em andamento");
  game.cur = Math.max(0, Math.min(game.cur, missionItems().length - 1));
}

// ---------- Clínica de implantes ----------
function clinicItems() {
  return [...player.bag.map((im) => ({ src: "bag", im })), ...save.installed.map((im) => ({ src: "inst", im }))];
}
function clinicKey(k) {
  if (allocOpen()) { ALLOC.im = null; return; }
  if (k === "tab") { game.tab ^= 1; game.cur = 0; return; }
  const len = game.tab === 0 ? clinicItems().length : game.stock.length;
  if (k === "w" || k === "arrowup") game.cur = Math.max(0, game.cur - 1);
  else if (k === "s" || k === "arrowdown") game.cur = Math.max(0, Math.min(len - 1, game.cur + 1));
  else if (k === "enter") clinicAct();
  else if (k === "v" && game.tab === 0) sellImplant();
  else if (k === "a" && game.tab === 0) { const it = clinicItems()[game.cur]; if (it) openAlloc(it.im); }
  else if ((k === "q" || k === "arrowleft") && game.tab === 0) shiftImplant(-1);
  else if ((k === "d" || k === "arrowright") && game.tab === 0) shiftImplant(1);
}
function clinicAct() {
  if (game.tab === 1) { buyImplant(game.cur); return; }
  const it = clinicItems()[game.cur];
  if (!it) return;
  if (it.src === "bag") {
    const why = installBlock(it.im);
    if (why) { toast(why); return; }
    player.bag.splice(player.bag.indexOf(it.im), 1); save.installed.push(it.im);
    toast(`Instalou ${implantName(it.im)}`);
  } else {
    if (player.bag.length >= BAG_MAX) { toast("Mochila de implantes cheia"); return; }
    save.installed.splice(save.installed.indexOf(it.im), 1); player.bag.push(it.im);
    toast(`Removeu ${implantName(it.im)} (volta para a mochila)`);
  }
  persist(); recalcImplants();
  game.cur = Math.max(0, Math.min(game.cur, clinicItems().length - 1));
}
// muda a ordem dos instalados (o Mímico copia quem está à esquerda dele)
function shiftImplant(dir) {
  const it = clinicItems()[game.cur];
  if (!it || it.src !== "inst") { toast("Selecione um implante instalado"); return; }
  const a = save.installed.indexOf(it.im), b = a + dir;
  if (b < 0 || b >= save.installed.length) return;
  save.installed[a] = save.installed[b]; save.installed[b] = it.im;
  game.cur = player.bag.length + b; persist(); recalcImplants();
}
function buyImplant(i) {
  const st = game.stock[i];
  if (!st) return;
  if (player.bag.length >= BAG_MAX) { toast("Mochila de implantes cheia"); return; }
  if (save.credits < st.price) { toast(`Precisa de ${st.price} créditos (compre no banco)`); return; }
  save.credits -= st.price; sfx.buy();
  const im = newImplant(st.id);
  player.bag.push(im); persist();
  toast(`Comprou ${implantName(im)}`);
}
function sellImplant() {
  const it = clinicItems()[game.cur];
  if (!it || it.src !== "bag") { toast("Só dá para vender implantes da mochila"); return; }
  const v = IMP[it.im.id].scrap;
  player.bag.splice(player.bag.indexOf(it.im), 1); game.money += v;
  toast(`Vendeu ${implantName(it.im)} por $${v}`);
  game.cur = Math.max(0, Math.min(game.cur, clinicItems().length - 1));
}


// Loja do refúgio: 29 implantes novos (preço individual em créditos) e
// Trindade consumível (dinheiro do jogo, não é implante).
const TRINDADE_PRICE = 20000000;
function creditShopItem() {
  const i = Math.max(0, Math.min(IMP_IDS.length, game.creditCur | 0));
  return i === 0 ? "trindade_eterna" : IMP_IDS[i - 1];
}
function buyTrindade() {
  if (!inSafe()) { toast("Compre a Trindade na base."); return; }
  if (game.money < TRINDADE_PRICE) { toast("É preciso $20.000.000."); return; }
  if (!addMat("trindade_eterna", 1)) { toast("Mochila cheia."); return; }
  game.money -= TRINDADE_PRICE;
  sfx.buy(); checkpoint("compra de Trindade");
  toast("Trindade adquirida! Arraste-a sobre o personagem para consumir.");
}
function buyCreditImplant(id) {
  const d = IMP[id];
  if (!d || !inSafe()) { toast("Implante indisponível."); return; }
  if (player.bag.length >= BAG_MAX) { toast("Mochila de implantes cheia."); return; }
  if (player.bag.some(im => im.id === id) || save.installed.some(im => im.id === id)) { toast("Você já possui este implante."); return; }
  if (save.credits < d.price) { toast("Créditos insuficientes. Necessário: " + d.price); return; }
  save.credits -= d.price;
  player.bag.push(newImplant(id));
  sfx.buy(); checkpoint("compra de implante");
  toast("Comprou " + d.name + " por " + d.price + " créditos.");
}
function creditShopBuy(id) {
  if (id === "trindade_eterna") buyTrindade();
  else if (IMP[id]) buyCreditImplant(id);
}
function creditShopKey(k) {
  if (game.creditConfirm) {
    if (k === "escape" || k === "n") game.creditConfirm = null;
    else if (k === "enter" || k === "s" || k === "y") {
      const chosen = game.creditConfirm; game.creditConfirm = null;
      creditShopBuy(chosen);
    }
    return;
  }
  if (k === "escape" || k === "e" || k === "b") { game.menu = null; return; }
  if (k === "w" || k === "arrowup") game.creditCur = Math.max(0, (game.creditCur | 0) - 1);
  else if (k === "s" || k === "arrowdown") game.creditCur = Math.min(IMP_IDS.length, (game.creditCur | 0) + 1);
  else if (k === "enter") game.creditConfirm = creditShopItem();
}
function drawCreditShop() {
  game.creditCur = Math.max(0, Math.min(IMP_IDS.length, game.creditCur | 0));
  menuFrame("Loja de Créditos", "Créditos: " + save.credits.toLocaleString("pt-BR") + " · Dinheiro: $" + game.money.toLocaleString("pt-BR") + " · 29 implantes disponíveis");
  const visible = 11, top = Math.max(0, Math.min(IMP_IDS.length + 1 - visible, game.creditCur - 5));
  for (let j = 0; j < visible && j + top <= IMP_IDS.length; j++) {
    const i = top + j, special = i === 0, id = special ? "trindade_eterna" : IMP_IDS[i - 1], y = 96 + j * 37;
    const d = special ? null : IMP[id];
    const owned = !special && (player.bag.some(im => im.id === id) || save.installed.some(im => im.id === id));
    rowBox(36, y, 514, 34, game.creditCur === i, special ? "#aa8933" : d.event ? "#8c476d" : owned ? "#47774d" : "#454338");
    if (special) drawMatIcon("trindade_eterna", 58, y + 17, 0.42);
    else drawEntryIcon({ type:"implant", im:{id, alloc:{}} }, 58, y + 17, 0.40);
    txt(special ? "★ Trindade · 100 anos (item)" : d.name, 82, y + 22, 13, game.creditCur === i ? "#ffd96a" : "#e5e0c8", "left", true, 306);
    txt(special ? "$20.000.000" : owned ? "POSSUI" : d.price.toLocaleString("pt-BR") + " cr", 532, y + 22, 12, special ? "#ffcb72" : owned ? "#7ed39d" : "#d4af37", "right", true);
    regClick(36, y, 514, 34, () => { if (game.creditCur === i) game.creditConfirm = id; else game.creditCur = i; });
  }
  const id = creditShopItem(), special = id === "trindade_eterna";
  if (special) {
    txt("Trindade · consumível", 578, 114, 20, "#ffd96a", "left", true, 348);
    drawMatIcon(id, 753, 215, 2.1);
    txtWrap("Dura 100 anos após o uso. +35% de dano, +35% de velocidade de corrida e +35% de proteção proporcional aos atributos. Não ocupa espaço de implante.", 574, 300, 13, "#c9c4ad", 344, 19, 8);
    if (trindadeActive()) txt("Ativa até " + new Date(save.trindadeUntil).toLocaleDateString("pt-BR"), 578, 418, 12, "#8fd08a");
  } else {
    const d = IMP[id], im = { id, alloc: {} };
    txt(d.name, 574, 114, 20, "#ffd96a", "left", true, 348);
    drawEntryIcon({ type: "implant", im }, 754, 201, 1.8);
    txtWrap(implantDesc(im), 574, 290, 13, "#c9c4ad", 344, 18, 9);
    if (d.event) txt("★ Edição de evento", 574, 425, 12, "#e7a2d2");
  }
  const price = special ? "$20.000.000" : IMP[id].price.toLocaleString("pt-BR") + " créditos";
  btn(608, 457, 270, 38, "Comprar · " + price, () => { game.creditConfirm = id; }, true);
  hint("W/S seleciona · Enter confirma · Esc fecha");
  if (game.creditConfirm) {
    const cid = game.creditConfirm, sp = cid === "trindade_eterna", cd = sp ? null : IMP[cid];
    ctx.fillStyle = "rgba(0,0,0,0.82)"; ctx.fillRect(0, 0, W, H);
    regClick(0, 0, W, H, () => {});
    ctx.fillStyle = "#27231b"; rr(226, 188, 508, 195, 9); ctx.fill();
    ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 2; ctx.stroke();
    txt("CONFIRMAR COMPRA", W / 2, 228, 20, "#f2eedc", "center", true);
    txt(sp ? "Trindade · $20.000.000" : cd.name + " · " + cd.price + " créditos", W / 2, 272, 15, "#e3c46a", "center", true, 480);
    btn(276, 315, 184, 40, "Confirmar", () => { game.creditConfirm = null; creditShopBuy(cid); }, true);
    btn(506, 315, 184, 40, "Cancelar", () => { game.creditConfirm = null; });
  }
  menuToast();
}

// ---------- Viagem ----------
function travelKey(k) {
  if (k === "w" || k === "arrowup") game.cur = Math.max(0, game.cur - 1);
  else if (k === "s" || k === "arrowdown") game.cur = Math.min(OUTPOSTS.length - 1, game.cur + 1);
  else if (k === "enter") travelTo(game.cur);
}

// ---------- Painel de administrador (F2) ----------
const adm = { god: false, infAmmo: false, noReq: false, noHunger: false, infStamina: false, freeze: false, dmg: 1, direct: false, shopAnywhere: false };
const ADM_TABS = ["Geral", "Personagem", "Dinheiro e itens", "Armas", "Implantes", "Presentes"];
function canUseAdmin() {
  return typeof fmCloud !== "undefined" && fmCloud.isActive() && fmCloud.isAdmin();
}
function toggleAdmin() {
  if (!canUseAdmin()) {
    if (game.menu === "admin") { game.menu = null; game.input = null; }
    return; // Para jogadores comuns, F2 não faz nada e não mostra qualquer aviso.
  }
  if (game.menu === "admin") { game.menu = null; game.input = null; return; }
  if (game.over) return;
  game.shop = false; game.input = null; game.menu = "admin";
  game.at = game.at || 0; game.ac = game.ac || 0;
  game.admGift = game.admGift || { name: "", type: "dinheiro", qty: 1000, itemIndex: 0, busy: false };
}
function admAsk(label, fn) { if (!canUseAdmin()) return; game.input = { mode: "adm", text: "", label, fn }; }
function admAskText(label, fn) { if (!canUseAdmin()) return; game.input = { mode: "admText", text: "", label, fn }; }
const ADM_GIFT_TYPES = ["dinheiro", "vip", "arma", "material"];
const ADM_GIFT_MATERIALS = ["sucata", "pecas", "eletronicos", "nucleo", "placa"];
function admGiftOptions(g) {
  return g.type === "arma" ? WLIST.filter(w => !w.fists).map(w => w.id) : ADM_GIFT_MATERIALS;
}
async function admSendGift() {
  if (!canUseAdmin()) return;
  const g = game.admGift;
  if (!g || g.busy) return;
  if (!g.name || g.name.trim().length < 3) { toast("Informe o nome do destinatário."); return; }
  g.busy = true;
  try {
    const options = admGiftOptions(g), item = options[Math.abs(g.itemIndex || 0) % options.length];
    toast(await fmGifts.send(g.name, g.type, g.qty, item));
  } catch (err) {
    toast(err.message || "Não foi possível enviar.");
  } finally { g.busy = false; }
}
function admSetLevel(n) {
  n = Math.max(1, Math.min(MAX_LEVEL, n));
  for (let l = player.level + 1; l <= n; l++) { player.points += survivalPointsForLevel(l); player.wpoints += weaponPointsForLevel(l); }
  player.level = n; player.xp = 0; recalcImplants(); syncChar();
}
function admGiveWeapon(id) {
  const r = addWeapon(newInst(id));
  toast(r ? `${WDEF[id].name} ${r === "slot" ? "equipada" : "na mochila"}` : "Mochila cheia");
}
function admGiveImplant(id) {
  const im = newImplant(id);
  if (adm.direct && !installBlock(im)) { save.installed.push(im); persist(); recalcImplants(); toast(`Instalado: ${implantName(im)}`); }
  else if (player.bag.length < BAG_MAX) { player.bag.push(im); toast(`Na mochila: ${implantName(im)}`); }
  else toast("Mochila de implantes cheia");
}
function admReset() {
  save.bank = 0; save.vault = []; save.installed = []; save.credits = 0; save.gm = false; save.missions = [];
  save.vestUpgrades = {}; save.vestDur = {}; save.vest = -1; save.vestsOwned = VESTS.map(() => false); save.outposts = OUTPOSTS.map((o, i) => i === 0);
  save.char = { level: 1, xp: 0, points: 0, wpoints: 0, attrs: defaultAttrs() };
  persist(); resetGame(); toast("Progresso apagado");
}
function admRows() {
  if (!canUseAdmin()) return [];
  const rows = [], tab = game.at;
  const T = (label, get, set) => rows.push({ label, on: get, val: () => (get() ? "LIGADO" : "desligado"), act: () => set(!get()) });
  const B = (label, fn) => rows.push({ label, val: () => "Enter", act: (d, how) => { if (how === "enter") fn(); } });
  const N = (label, get, set, step, lo, hi) => rows.push({ label, val: () => String(Math.round(get() * 100) / 100),
    act: (d, how) => { if (how === "enter") admAsk(label, (v) => set(Math.max(lo, Math.min(hi, v)))); else set(Math.max(lo, Math.min(hi, get() + d * step))); } });
  if (tab === 0) {
    B("Restaurar vida, energia, fome e sede", () => { player.hp = player.maxHp; player.stamina = 100; player.exhausted = false; player.hunger = 100; player.thirst = 100; toast("Status restaurados"); });
    T("Modo deus (não morre)", () => adm.god, (v) => { adm.god = v; });
    T("Energia infinita (correr sem limite)", () => adm.infStamina, (v) => { adm.infStamina = v; });
    T("Sem fome e sem sede", () => adm.noHunger, (v) => { adm.noHunger = v; });
    T("Munição infinita", () => adm.infAmmo, (v) => { adm.infAmmo = v; });
    T("Ignorar requisitos de armas", () => adm.noReq, (v) => { adm.noReq = v; });
    T("Zumbis congelados", () => adm.freeze, (v) => { adm.freeze = v; });
    // Loja fica somente como imagem decorativa.
    rows.push({ label: "Multiplicador de dano", val: () => "x" + adm.dmg, act: (d) => { const o = [1, 2, 5, 10, 100, 1000], i = o.indexOf(adm.dmg); adm.dmg = o[(i + (d || 1) + o.length) % o.length]; } });
    N("Hora do dia (0 a 23)", () => Math.floor(game.clock / 60) % 24, (v) => { game.clock = Math.floor(game.clock / 1440) * 1440 + v * 60; }, 1, 0, 23);
    rows.push({ label: `Ir para área de perigo (0 a ${MAX_ZONE})`, val: () => `agora: zona ${game.area}`, act: (d, how) => { if (how === "enter") admAsk("Ir para qual zona?", (v) => teleportZone(v)); } });
    B("Liberar todos os postos (viagem rápida)", () => { save.outposts = OUTPOSTS.map(() => true); persist(); toast("Postos liberados"); });
    B("Disparar uma horda agora", () => { if (game.inside) { toast("Saia do prédio primeiro"); return; } startHorde(); });
    B("Soltar uma caixa de suprimentos", () => { if (game.inside) { toast("Saia do prédio primeiro"); return; } spawnAirdrop(); });
    B("Invocar um chefe aqui", () => {
      if (game.inside) { toast("Saia do prédio primeiro"); return; }
      const a = Math.random() * 6.283; spawnBoss(player.x + Math.cos(a) * 260, player.y + Math.sin(a) * 260, game.area); toast("Chefe invocado");
    });
    B("Eliminar todos os zumbis por perto", () => { [...Zs()].forEach((z) => { if (z.hp > 0) hurt(z, 1e9, null, true); }); toast("Zumbis eliminados"); });
    B("Apagar TODO o progresso salvo (pede confirmação)", () => admAsk("Digite 1 para confirmar o reset", (v) => { if (v === 1) admReset(); else toast("Reset cancelado"); }));
  } else if (tab === 1) {
    N("Nível", () => player.level, (v) => admSetLevel(v), 1, 1, MAX_LEVEL);
    B("Subir 10 níveis", () => admSetLevel(player.level + 10));
    N("Pontos de atributo livres", () => player.points, (v) => { player.points = v; syncChar(); }, 5, 0, 99999);
    N("Pontos de armas livres", () => player.wpoints, (v) => { player.wpoints = v; syncChar(); }, 5, 0, 99999);
    B("Atributos no máximo (Stats 100 · Proficiências 120)", () => { ATTRS.forEach((d) => { player.attrs[d.id] = weaponSkillCap(d.id); }); recalcImplants(); syncChar(); toast("Atributos nos limites permitidos"); });
    B("Voltar atributos ao valor inicial", () => { ATTRS.forEach((d) => { player.attrs[d.id] = d.start; }); recalcImplants(); syncChar(); toast("Atributos reiniciados"); });
    ATTRS.forEach((d) => N(d.name + (CATNAME[d.id] ? " (arma)" : ""), () => player.attrs[d.id], (v) => { player.attrs[d.id] = v; if (d.id === "endurance") recalcImplants(); syncChar(); }, 5, d.start, weaponSkillCap(d.id)));
  } else if (tab === 2) {
    N("Dinheiro na mochila", () => game.money, (v) => { game.money = v; }, 1000, 0, 999999999);
    N("Dinheiro no banco", () => save.bank, (v) => { save.bank = v; persist(); }, 10000, 0, 999999999);
    N("Créditos", () => save.credits, (v) => { save.credits = v; persist(); }, 50, 0, 999999);
    T("VIP ativo", () => save.gm, (v) => { save.gm = v; persist(); });
    rows.push({ label: "Colete (A/D troca, ganha o colete)", val: () => (save.vest >= 0 ? VESTS[save.vest].name : "nenhum"), act: (d) => { save.vest = ((save.vest + 1 + (d || 1) + VESTS.length + 1) % (VESTS.length + 1)) - 1; if (save.vest >= 0) save.vestsOwned[save.vest] = true; recalcImplants(); persist(); } });
    N("Comida", () => player.food, (v) => { player.food = v; }, 1, 0, 999);
    N("Água", () => player.water, (v) => { player.water = v; }, 1, 0, 999);
    N("Kits médicos", () => player.med, (v) => { player.med = v; }, 1, 0, 999);
    B("Munição +200 de todos os tipos", () => { for (const t in AMMO) player.reserve[t] += 200; toast("Munição adicionada"); });
    B("Concluir as missões ativas", () => { save.missions.forEach((m) => { m.progress = m.target; }); persist(); toast("Missões concluídas (entregue no quadro)"); });
    B("Novas missões no quadro", () => { game.board = makeOffers(); toast("Quadro renovado"); });
  } else if (tab === 3) {
    B("Materiais +10 de cada (na mochila)", () => { for (const m in MATS) addMat(m, 10); toast("Materiais adicionados"); });
    B("Arma na mão: todas as melhorias no máximo", () => { const it = curInst(); if (!it) { toast("Sem arma na mão"); return; } UP_STATS.forEach((s) => { it.up[s.id] = UP_MAX; }); toast("Arma no máximo"); });
    B("Esvaziar a mochila", () => { player.pack.length = 0; toast("Mochila vazia"); });
    WLIST.forEach((d) => {
      if (d.fists) return;
      rows.push({ label: `${d.name} · ${CAT_LABEL[d.cat]}${d.legendary ? " (lendária)" : d.special ? " (especial)" : ""}`, val: () => "dar", act: (x, how) => { if (how === "enter") admGiveWeapon(d.id); } });
    });
  } else if (tab === 4) {
    T("Instalar direto (sem passar pela clínica)", () => adm.direct, (v) => { adm.direct = v; });
    IMP_IDS.forEach((id) => rows.push({ label: `${IMP[id].name} · ${IMP[id].price} créditos`, val: () => "dar", act: (d, how) => { if (how === "enter") admGiveImplant(id); } }));
    B("Limpar a mochila de implantes", () => { player.bag.length = 0; toast("Mochila de implantes vazia"); });
    B("Remover os implantes instalados", () => { save.installed.length = 0; persist(); recalcImplants(); toast("Implantes removidos"); });
  } else if (tab === 5) {
    const g = game.admGift || (game.admGift = { name: "", type: "dinheiro", qty: 1000, itemIndex: 0, busy: false });
    B("Destinatário: " + (g.name || "(digitar nome in-game)"), () => admAskText("Nome do jogador", name => { g.name = name.slice(0,16); }));
    rows.push({ label: "Tipo de presente (A/D para escolher)", val: () =>
      ({dinheiro:"Dinheiro",vip:"VIP temporário",arma:"Arma",material:"Material"})[g.type],
      act: (d) => { g.type = ADM_GIFT_TYPES[(ADM_GIFT_TYPES.indexOf(g.type) + (d < 0 ? -1 : 1) + ADM_GIFT_TYPES.length) % ADM_GIFT_TYPES.length]; g.itemIndex = 0; g.qty = g.type === "vip" ? 1 : g.type === "arma" ? 1 : g.type === "material" ? 10 : 1000; } });
    if (g.type === "vip") {
      rows.push({ label: "Duração do VIP (A/D para escolher)", val: () =>
        g.qty === 1 ? "1 mês" : g.qty === 6 ? "6 meses" : "1 ano",
        act: (d) => { const o = [1,6,12]; g.qty = o[(o.indexOf([1,6,12].includes(g.qty)?g.qty:1)+(d<0?-1:1)+o.length)%o.length]; } });
    } else if (g.type === "dinheiro" || g.type === "material") {
      N("Quantidade", () => g.qty, n => { g.qty = n; }, 100, 1, g.type === "material" ? 1000 : 10000000);
    }
    if (g.type === "arma" || g.type === "material") {
      rows.push({label: "Item (A/D alterna)", val: () => {
        const list = admGiftOptions(g), item = list[(g.itemIndex || 0) % list.length];
        return g.type === "arma" ? WDEF[item].name : MATS[item].name;
      }, act: (d) => { const list = admGiftOptions(g);
        g.itemIndex = ((g.itemIndex || 0) + (d < 0 ? -1 : 1) + list.length) % list.length; }});
    }
    B("ENVIAR PRESENTE PARA O JOGADOR", () => admSendGift());
    rows.push({ label: "A entrega é automática e aparece em Mensagens (I).",
      val: () => g.busy ? "enviando..." : "somente ADM", act: () => {} });
  }
  return rows;
}
function adminKey(k) {
  if (!canUseAdmin()) { game.menu = null; game.input = null; return; }
  if (k === "escape" || k === "f2") { game.menu = null; return; }
  if (k === "tab") { game.at = (game.at + 1) % ADM_TABS.length; game.ac = 0; return; }
  const rows = admRows();
  game.ac = Math.max(0, Math.min(rows.length - 1, game.ac));
  const r = rows[game.ac];
  if (k === "w" || k === "arrowup") game.ac = Math.max(0, game.ac - 1);
  else if (k === "s" || k === "arrowdown") game.ac = Math.min(rows.length - 1, game.ac + 1);
  else if (k === "a" || k === "arrowleft") r.act(-1, "adjust");
  else if (k === "d" || k === "arrowright") r.act(1, "adjust");
  else if (k === "enter") r.act(1, "enter");
}

// =====================================================================
//  Desenho dos menus
// =====================================================================
function menuFrame(title, sub) {
  ctx.fillStyle = "rgba(8,9,7,0.92)"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(212,175,55,0.35)"; ctx.lineWidth = 1; rr(16, 12, W - 32, H - 24, 10); ctx.stroke();
  txt(title, W / 2, 46, 28, "#e5e0c8", "center", true);
  if (sub) txt(sub, W / 2, 72, 15, "#a9a58f", "center");
}
function rowBox(x, y, w, h, sel, accent) {
  ctx.fillStyle = sel ? "#2b2a22" : "#1a1a15"; rr(x, y, w, h, 5); ctx.fill();
  ctx.strokeStyle = sel ? "#ffd96a" : accent || "#3d3b30"; ctx.lineWidth = sel ? 2 : 1; ctx.stroke();
}
function hint(t) { txt(t, W / 2, H - 24, 13, "#a9a58f", "center"); }
function menuToast() {
  if (game.msgT > 0) txt(game.msg, W / 2, H - 50, 17, "#ffd96a", "center", true, W - 80);
}

function drawMenu() {
  if (game.menu === "name") { drawNameScreen(); return; }
  if (game.menu === "prof") { drawProf(); return; }
  if (game.menu === "bank") drawBank();
  else if (game.menu === "clinic") drawClinic();
  else if (game.menu === "stats") drawStats();
  else if (game.menu === "missions") drawMissions();
  else if (game.menu === "sector") drawSector();
  else if (game.menu === "junk") drawJunk();
  else if (game.menu === "creditshop") drawCreditShop();
  else if (game.menu === "admin") drawAdmin();
  else if (game.menu === "travel") drawTravel();
  else if (game.menu === "map") drawMap();
  else if (game.menu === "friends") drawFriends();
  else if (game.menu === "messages") drawMessages();
  else if (game.menu === "pack") drawInventory();
  else if (game.menu === "craft") drawCraft();
  else if (game.menu === "obj") drawObjectives();
  else drawStash();
  if (game.menu !== "admin" && game.menu !== "craft") menuToast();
}

function drawBank() {
  menuFrame("Banco", `Mochila: $${game.money}  ·  Banco: $${save.bank}  ·  Créditos: ${save.credits}  ·  VIP: ${vipStatus()}`);
  txt("O dinheiro do banco não se perde quando você morre. Só dá para usar o banco dentro de um posto.", W / 2, 100, 13, "#a9a58f", "center");
  const rows = [["D", "Depositar (digitar valor)"], ["A", "Depositar tudo"], ["S", "Sacar (digitar valor)"], ["T", "Sacar tudo"],
                ["C", `Comprar créditos ($${CREDIT_PRICE} cada)`], ["G", `Ativar VIP por 1 mês (${GM_COST} créditos)`]];
  rows.forEach(([key, label], i) => {
    const x = i % 2 === 0 ? 100 : 500, y = 124 + Math.floor(i / 2) * 60;
    rowBox(x, y, 360, 50, false, i >= 4 ? "#d4af37" : null);
    txt(`${key}  ${label}`, x + 16, y + 31, 16, "#e5e0c8", "left", true);
  });
  txt(`VIP (${GM_COST} créditos = $${CREDIT_PRICE * GM_COST}, pagos com o saldo do banco) — benefícios durante o VIP:`, W / 2, 332, 15, "#d4af37", "center", true);
  txt("+100% de chance de corpos para saquear · +100% de XP · +60% de saque nos lugares vasculháveis", W / 2, 360, 14, "#a9a58f", "center");
  txt("+100% de munição · +100% de dinheiro · armas lendárias podem aparecer nos saques (teclas 9 e 0)", W / 2, 382, 14, "#a9a58f", "center");
  hint("E, B ou Esc fecha");
  if (game.input) {
    const mode = game.input.mode, dep = mode === "deposit";
    ctx.fillStyle = "rgba(0,0,0,0.95)"; rr(220, 200, 520, 180, 10); ctx.fill();
    ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 2; ctx.stroke();
    txt(dep ? "Quanto deseja depositar?" : mode === "credits" ? "Quantos créditos deseja comprar?" : "Quanto deseja sacar?", W / 2, 240, 20, "#e5e0c8", "center", true);
    txt(`${mode === "credits" ? "" : "$"}${game.input.text || "0"}${Math.floor(performance.now() / 500) % 2 ? "|" : ""}`, W / 2, 300, 36, "#e5e0c8", "center", true);
    const avail = dep ? `Disponível: $${game.money}` : mode === "credits" ? `Banco: $${save.bank} (até ${Math.floor(save.bank / CREDIT_PRICE)} créditos)` : `Disponível: $${save.bank}`;
    txt(`${avail} · digite o valor · Enter confirma · Esc cancela`, W / 2, 350, 14, "#a9a58f", "center");
  }
}

function drawStats() {
  menuFrame(game.stab === 1 ? "Personagem" : `Atributos · Nível ${player.level}`);
  ["Atributos", "Personagem"].forEach((t, i) => {
    const sel = (game.stab || 0) === i;
    txt(t, 60 + i * 120, 40, 13, sel ? "#ffd96a" : "#6d6a58", "left", true);
    regClick(50 + i * 120, 24, 110, 24, () => { game.stab = i; game.skc = save.skin; });
  });
  if (game.stab === 1) { drawSkins(); hint("A/D escolhe · Enter usa · Tab volta aos atributos · C ou Esc fecha"); return; }
  txt(`HP ${Math.ceil(player.hp)}/${Math.ceil(player.maxHp)} (máx. 200)  ·  Pontos de atributo: ${player.points}  ·  Armas: ${player.wpoints}   ·   XP ${Math.floor(player.xp)}/${player.level >= MAX_LEVEL ? "máx" : xpNeed(player.level)}`,
    W / 2, 74, 16, player.points + player.wpoints > 0 ? "#ffd96a" : "#a9a58f", "center");
  ATTRS.forEach((d, i) => {
    const y = 90 + i * 31, sel = game.cur === i, v = player.attrs[d.id];
    rowBox(60, y, 840, 28, sel);
    txt(d.name, 76, y + 19, 15, "#e5e0c8", "left", true);
    txt(String(v), 290, y + 19, 15, "#ffd96a", "left", true);
    ctx.fillStyle = "#000"; ctx.fillRect(330, y + 11, 120, 6);
    ctx.fillStyle = WEAPON_SKILL_IDS.includes(d.id) ? "#d08a5a" : "#6d8aa8"; ctx.fillRect(330, y + 11, 120 * Math.min(1, v / weaponSkillCap(d.id)), 6);
    txt(WEAPON_SKILL_IDS.includes(d.id) ? `arma · máx. ${weaponSkillCap(d.id)}` : "stats · máx. 100", 460, y + 19, 11, WEAPON_SKILL_IDS.includes(d.id) ? "#d08a5a" : "#6d8aa8");
    txt(attrEffect(d.id, v), 884, y + 19, 12, "#a9a58f", "right");
  });
  hint("W/S escolhe · Enter +1 · D +5 · pontos de arma: Força + 5 proficiências · Tab: personagem · C ou Esc");
}

function drawMissionRow(x, y, w, m, sel, active) {
  const done = active && m.progress >= m.target;
  rowBox(x, y, w, 48, sel, done ? "#6fae4f" : null);
  txt(missionText(m), x + 10, y + 19, 14, done ? "#6fae4f" : "#e5e0c8", "left", true, w - 20);
  const rew = `Recompensa: $${m.money} + ${Math.round(m.xp * xpMult())} XP`;
  txt(active ? `${done ? "CONCLUÍDA, entregue num posto · " : `${m.progress}/${m.target} · `}${rew}` : rew, x + 10, y + 38, 12, "#a9a58f", "left", false, w - 20);
}
function drawMissions() {
  menuFrame(game.atBase ? "Quadro de missões" : "Missões ativas",
    `Ativas: ${save.missions.length}/3 · Dinheiro: $${game.money}${game.atBase ? "" : " · entregue as concluídas no quadro de um posto"}`);
  const offers = game.atBase ? game.board : [];
  if (game.atBase) txt("Disponíveis", 40, 104, 14, "#e5e0c8", "left", true);
  txt("Ativas", game.atBase ? 500 : 40, 104, 14, "#e5e0c8", "left", true);
  offers.forEach((m, i) => drawMissionRow(40, 114 + i * 54, 440, m, game.cur === i, false));
  save.missions.forEach((m, j) => drawMissionRow(game.atBase ? 500 : 40, 114 + j * 54, game.atBase ? 420 : 880, m, game.cur === offers.length + j, true));
  if (!offers.length && !save.missions.length) txt("Nenhuma missão no momento.", 40, 140, 15, "#6d6a58");
  hint("W/S move · Enter aceita/entrega · V abandona · M ou E fecha");
}

function drawImplantRow(x, y, w, im, selected, right, rightColor) {
  rowBox(x, y, w, 28, selected);
  txt(implantName(im), x + 10, y + 19, 14, impColor(im), "left", true, w - (right ? 170 : 20));
  if (right) txt(right, x + w - 10, y + 19, 13, rightColor || "#a9a58f", "right", true);
}
// caixa com o nome e a descrição inteira do implante selecionado
function drawImplantInfo(im) {
  ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(40, 424, W - 80, 118, 8); ctx.fill();
  if (!im) { txt("Selecione um implante para ver os efeitos", W / 2, 488, 14, "#6d6a58", "center"); return; }
  txt(implantName(im), 56, 448, 17, impColor(im), "left", true);
  txt(`Único (só um instalado) · sucata $${IMP[im.id].scrap}`, W - 56, 448, 12, "#a9a58f", "right");
  txtWrap(implantDesc(im), 56, 470, 13, "#d8d2ba", W - 112, 17, 4);
}
function drawClinic() {
  menuFrame("Clínica de implantes", `Créditos: ${save.credits}  ·  Dinheiro: $${game.money}  ·  Instalados: ${save.installed.length}/${IMPL_SLOTS}  ·  Mochila: ${player.bag.length}/${BAG_MAX}`);
  txt("Meus implantes", W / 2 - 100, 100, 16, game.tab === 0 ? "#ffd96a" : "#6d6a58", "center", true);
  txt("Loja", W / 2 + 100, 100, 16, game.tab === 1 ? "#ffd96a" : "#6d6a58", "center", true);
  if (game.tab === 0) {
    txt("Na mochila (preservados ao morrer)", 40, 126, 13, "#a9a58f");
    txt("Instalados, na ordem dos slots (permanentes)", 500, 126, 13, "#a9a58f");
    const pts = (im) => (IMP[im.id].alloc ? `${allocUsed(im)}/${IMP[im.id].alloc.points} pts` : IMP[im.id].mimic ? "copia ←" : "");
    player.bag.forEach((im, i) => drawImplantRow(40, 134 + i * 32, 440, im, game.cur === i, pts(im)));
    save.installed.forEach((im, j) => drawImplantRow(500, 134 + j * 32, 420, im, game.cur === player.bag.length + j, `${j + 1}º  ${pts(im)}`));
    if (!player.bag.length && !save.installed.length) txt("Nenhum implante ainda. Compre na loja (Tab) ou ache em saques raros.", 40, 160, 15, "#6d6a58");
    const it = clinicItems()[game.cur];
    drawImplantInfo(it ? it.im : null);
    hint("W/S move · Enter instala/remove · A distribui pontos · Q/D muda a ordem · V vende · Tab loja · E fecha");
  } else {
    const N = 9, first = Math.max(0, Math.min(game.stock.length - N, game.cur - 4));
    for (let r = 0; r < N && first + r < game.stock.length; r++) {
      const i = first + r, st = game.stock[i], im = { id: st.id, alloc: {} };
      const has = save.installed.some((x) => x.id === st.id) ? "instalado · " : player.bag.some((x) => x.id === st.id) ? "na mochila · " : "";
      drawImplantRow(140, 126 + r * 32, 680, im, game.cur === i, `${has}${st.price} créditos`, save.credits >= st.price ? "#6fae4f" : "#c0392b");
    }
    txt(`${game.cur + 1} / ${game.stock.length}`, 830, 144, 12, "#a9a58f");
    if (first > 0) txt("▲", 830, 164, 12, "#ffd96a");
    if (first + N < game.stock.length) txt("▼", 830, 400, 12, "#ffd96a");
    const st = game.stock[game.cur];
    drawImplantInfo(st ? { id: st.id, alloc: {} } : null);
    hint("Implantes únicos, pagos com créditos (compre créditos no banco) · W/S move · Enter compra · Tab volta · E fecha");
  }
  drawAllocPanel();
}

function drawTravel() {
  menuFrame("Rádio · viagem rápida", "Um motorista leva você entre postos já descobertos. Paga com o dinheiro da mochila.");
  OUTPOSTS.forEach((o, i) => {
    const y = 90 + i * 58, here = game.inside && game.inside.outpost === o.id, known = save.outposts[o.id], cl = opCell(o.id), RG = REGIONS[cl.tier];
    rowBox(180, y, 600, 52, game.cur === i, here ? "#6fae4f" : null);
    rowClick(180, y, 600, 52, game.cur === i, () => { game.cur = i; }, () => travelTo(o.id));
    txt(known ? o.name : "??? (não descoberta)", 200, y + 22, 17, known ? "#e5e0c8" : "#6d6a58", "left", true);
    txt(`Área ${cl.code} · ${RG.name} · ${RG.diff}`, 200, y + 41, 13, RG.color === "#2a2a2e" ? "#9a9aa0" : RG.color);
    txt(here ? "você está aqui" : known ? `$${travelCost(o.id)}` : "explore para achar", 764, y + 32, 16, here ? "#6fae4f" : known ? (game.money >= travelCost(o.id) ? "#ffd96a" : "#c0392b") : "#6d6a58", "right", true);
  });
  txt("Dica: as bases aparecem como ⌂ no mapa (N). Descubra entrando nelas.", W / 2, 470, 14, "#a9a58f", "center");
  hint("W/S escolhe · Enter viaja · E ou Esc fecha");
}

// ---------- Mapa de áreas (grade com cores de dificuldade) ----------
function mapKey(k) {
  const s = game.mapSel || { cx: world.cell.cx, cy: world.cell.cy };
  const mv = { a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0], w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1] }[k];
  if (mv) game.mapSel = { cx: clamp(s.cx + mv[0], 0, MAP_W - 1), cy: clamp(s.cy + mv[1], 0, MAP_H - 1) };
  else if (k === "c") game.mapSel = { cx: world.cell.cx, cy: world.cell.cy };
}
function tierTextColor(t) { return REGIONS[t].color === "#2a2a2e" ? "#9a9aa0" : REGIONS[t].color; }
function drawMap() {
  const here = world.cell;
  if (!game.mapSel) game.mapSel = { cx: here.cx, cy: here.cy };
  menuFrame("Mapa da cidade", `${allCells().length} áreas · ${fmSocial.online().length + 1} jogador(es) online · ☠ = chefe vivo (${bossCells().length})`);
  const cs = 34, gx = 34, gy = 96, now = performance.now();
  for (let cy = 0; cy < MAP_H; cy++) for (let cx = 0; cx < MAP_W; cx++) {
    const c = cellAt(cx, cy), x = gx + cx * cs, y = gy + cy * cs;
    if (!c) { ctx.fillStyle = "#121210"; ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2); continue; }
    const RG = REGIONS[c.tier];
    ctx.fillStyle = RG.color; ctx.globalAlpha = c.visited ? 0.95 : 0.6; ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2); ctx.globalAlpha = 1;
    if (c.tier === 6) { ctx.strokeStyle = "#55555c"; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, cs - 3, cs - 3); }
    if (c.landmark) { ctx.fillStyle = "rgba(0,0,0,0.55)"; rr(x + 3, y + cs - 17, 14, 14, 3); ctx.fill(); txt({ hospital: "H", prisao: "P", bunker: "B" }[c.landmark], x + 10, y + cs - 6, 10, { hospital: "#ff7a6a", prisao: "#ffc060", bunker: "#a8e07a" }[c.landmark], "center", true); }
    if (c.op != null) txt("⌂", x + cs / 2, y + cs / 2 + 7, 20, save.outposts[c.op] ? "#ffffff" : "rgba(255,255,255,0.45)", "center", true);
    if (c.boss) {
      const p = 0.7 + 0.3 * Math.sin(now / 220 + cx);
      ctx.fillStyle = `rgba(0,0,0,${0.45 * p})`; circle(x + cs / 2, y + cs / 2, 12);
      txt("☠", x + cs / 2, y + cs / 2 + 7, 19, `rgba(255,${Math.round(90 * p)},${Math.round(70 * p)},1)`, "center", true);
    }
    if (c.tier === 8 && player.level < GRAY_LEVEL) txt("🔒", x + cs - 9, y + 12, 9, "#fff", "center");
    if (c === here) { ctx.strokeStyle = "#ffd96a"; ctx.lineWidth = 2.5 + Math.sin(now / 200); ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4); }
    if (game.mapSel.cx === cx && game.mapSel.cy === cy) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.strokeRect(x + 4, y + 4, cs - 8, cs - 8); ctx.setLineDash([]); }
    regClick(x, y, cs, cs, () => { game.mapSel = { cx, cy }; });
  }
  // Marcadores de sobreviventes online por setor: azul = jogador, verde = amigo.
  const locations = new Map();
  for (const p of fmSocial.online()) {
    const key = p.cx + "," + p.cy;
    if (!locations.has(key)) locations.set(key, []);
    locations.get(key).push(p);
  }
  for (const [key, group] of locations) {
    const [cx, cy] = key.split(",").map(Number);
    const x = gx + cx * cs + cs - 9, y = gy + cy * cs + 9;
    ctx.fillStyle = group.some(p => fmSocial.isFriend(p.uid)) ? "#8fe0a8" : "#73ceff";
    circle(x, y, 9);
    txt(String(group.length), x, y + 4, 11, "#101613", "center", true);
  }
  for (let cx = 0; cx < MAP_W; cx++) txt(String.fromCharCode(65 + cx), gx + cx * cs + cs / 2, gy - 6, 10, "#a9a58f", "center", true);
  for (let cy = 0; cy < MAP_H; cy++) txt(String(cy + 1), gx - 8, gy + cy * cs + cs / 2 + 4, 10, "#a9a58f", "right", true);
  // legenda das cores
  const ly = gy + MAP_H * cs + 18;
  REGIONS.forEach((RG, i) => {
    const x = gx + (i % 3) * 160, y = ly + Math.floor(i / 3) * 20;
    ctx.fillStyle = RG.color; ctx.fillRect(x, y - 10, 14, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1; ctx.strokeRect(x, y - 10, 14, 14);
    txt(`${RG.name} · ${RG.diff}`, x + 19, y + 2, 11, "#c9c4ad", "left", true);
  });
  txt("⌂ base  ☠ chefe  H hospital  P prisão  B bunker  amarelo = você  azul = online  verde = amigo", gx, ly + 66, 11, "#a9a58f");
  // área escolhida
  const sel = cellAt(game.mapSel.cx, game.mapSel.cy), lx = 540;
  const sectorOnline = fmSocial.online().filter(p => p.cx === game.mapSel.cx && p.cy === game.mapSel.cy);
  txt("ONLINE: " + sectorOnline.length + (sectorOnline.length ? " · " + sectorOnline.map(p => p.name).join(", ") : ""), lx, 87, 12, "#73ceff", "left", true, 370);
  if (!sel) {
    txt(`${cellCode(game.mapSel.cx, game.mapSel.cy)} · sem passagem`, lx, 120, 20, "#6d6a58", "left", true);
    txt("Escombros e prédios caídos fecham essa área.", lx, 144, 13, "#a9a58f");
  } else {
    const RG = REGIONS[sel.tier], col = tierTextColor(sel.tier), z0 = sel.zone;
    txt(`${sel.code} · ${sel.name}`, lx, 118, 20, "#e5e0c8", "left", true, 380);
    txt(`Área ${RG.name} · ${RG.diff}`, lx, 140, 15, col, "left", true);
    txt(RG.desc, lx, 158, 12, "#c9c4ad", "left", false, 380);
    let y = 182;
    if (sel.op != null) { txt(`⌂ ${save.outposts[sel.op] ? OUTPOSTS[sel.op].name : "Base ainda não descoberta"}`, lx, y, 13, save.outposts[sel.op] ? "#6fd08a" : "#6d6a58", "left", true); y += 18; }
    if (sel.landmark) { txt(`★ ${BTYPES[sel.landmark].name}: o melhor saque da região`, lx, y, 13, "#ffb070", "left", true, 380); y += 18; }
    if (sel.boss) { const B = BOSSES[sel.boss]; txt(`☠ ${B.name} · deixa: ${B.drop}`, lx, y, 13, "#e04a4a", "left", true, 380); y += 18; }
    if (sel.tier === 8) { txt(`Só a partir do nível ${GRAY_LEVEL}${player.level >= GRAY_LEVEL ? " (liberada)" : ` · você está no ${player.level}`}`, lx, y, 12, player.level >= GRAY_LEVEL ? "#8fd08a" : "#ff8a6a", "left", true); y += 18; }
    const dist = Math.abs(sel.cx - here.cx) + Math.abs(sel.cy - here.cy);
    txt(sel === here ? "Você está aqui" : `A ${dist} ${dist > 1 ? "áreas" : "área"} de você`, lx, y, 12, "#ffd96a", "left", true); y += 24;
    txt("Criaturas", lx, y, 14, "#e5e0c8", "left", true); y += 18;
    const types = Object.keys(ZTYPES).filter((t) => ZTYPES[t].from <= z0);
    types.forEach((t, i) => txt(`• ${ZTYPES[t].name}`, lx + (i % 3) * 126, y + Math.floor(i / 3) * 16, 12, "#a9a58f"));
    y += Math.ceil(types.length / 3) * 16 + 6;
    txt(`Zumbis com ${Math.round(RG.hp * 100)}% de vida e ${Math.round(RG.dmg * 100)}% de dano`, lx, y, 12, "#e07b5a", "left", true); y += 16;
    const EC = ECON[sel.tier];
    txt(`Economia: dinheiro do saque x${EC.cash} · $${EC.bounty} por abate · missões x${EC.reward}`, lx, y, 12, "#8fe08a", "left", true, 380); y += 24;
    txt("Raridade das armas encontradas", lx, y, 13, "#e5e0c8", "left", true); y += 8;
    const tot = RG.loot.reduce((a, b2) => a + b2, 0);
    RARITY.forEach((ra, i) => {
      const yy = y + i * 18, pc = RG.loot[i] / tot;
      txt(ra.name, lx, yy + 12, 11, ra.color, "left", true);
      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(lx + 76, yy + 3, 220, 10);
      ctx.fillStyle = ra.color; ctx.fillRect(lx + 76, yy + 3, 220 * pc, 10);
      txt(`${Math.round(pc * 100)}%`, lx + 304, yy + 12, 11, "#c9c4ad");
    });
  }
  hint("Clique ou WASD/setas escolhem a área · C volta para onde você está · N, E ou Esc fecha");
}

function drawAdmin() {
  if (!canUseAdmin()) { game.menu = null; game.input = null; return; }
  const rows = admRows();
  game.ac = Math.max(0, Math.min(rows.length - 1, game.ac));
  menuFrame("Painel de administrador");
  ADM_TABS.forEach((t, i) => {
    const x = 36 + i * 148, w = 148;
    ctx.fillStyle = game.at === i ? "rgba(212,175,55,0.16)" : "rgba(0,0,0,0)";
    ctx.fillRect(x, 55, w, 34);
    txt(t, x + w / 2, 78, 14, game.at === i ? "#ffd96a" : "#a9a58f", "center", true);
    regClick(x, 55, w, 34, () => { game.at = i; game.ac = 0; game.input = null; });
  });
  ctx.fillStyle = "#3d3b30"; ctx.fillRect(40, 90, 880, 1);
  const vis = 14, off = Math.max(0, Math.min(rows.length - vis, game.ac - 6));
  rows.slice(off, off + vis).forEach((r, j) => {
    const y = 100 + j * 28, sel = off + j === game.ac, on = r.on ? r.on() : null;
    rowBox(60, y, 840, 25, sel);
    txt(r.label, 74, y + 17, 14, "#e5e0c8", "left", false, 560);
    txt(r.val(), 886, y + 17, 14, on === true ? "#6fae4f" : "#ffd96a", "right", true);
    regClick(60, y, 840, 25, () => { game.ac = off + j; r.act(1,"enter"); });
  });
  if (rows.length > vis) txt(`${game.ac + 1}/${rows.length} · use W/S para rolar`, W / 2, 506, 12, "#a9a58f", "center");
  hint("CLIQUE nas abas e opções · W/S seleciona · A/D muda valor · Enter confirma · F2/Esc fecha");
  if (game.msgT > 0) txt(game.msg, W / 2, 536, 16, "#ffd96a", "center", true);
  if (game.input && (game.input.mode === "adm" || game.input.mode === "admText")) {
    ctx.fillStyle = "rgba(0,0,0,0.96)"; rr(220, 200, 520, 170, 10); ctx.fill();
    ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 2; ctx.stroke();
    txt(game.input.label, W / 2, 240, 20, "#e5e0c8", "center", true);
    txt(`${game.input.text || ""}${Math.floor(performance.now() / 500) % 2 ? "|" : ""}`, W / 2, 300, game.input.mode === "admText" ? 23 : 36, "#e5e0c8", "center", true, 490);
    txt(game.input.mode === "admText" ? "Digite o nome no jogo · Enter confirma · Esc cancela" : "Digite um número · Enter confirma · Esc cancela", W / 2, 345, 14, "#a9a58f", "center");
  }
}
