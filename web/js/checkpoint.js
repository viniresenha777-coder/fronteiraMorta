"use strict";
// =====================================================================
//  Checkpoint: salva TODO o progresso (personagem, mochila, armas,
//  dinheiro, área e posição) por cima do save antigo:
//   · a cada troca de área
//   · a cada 1 minuto de jogo
//  e avisa no registro de mensagens. No .exe para Windows o save vai
//  para um arquivo no computador; no navegador, para o armazenamento local.
// =====================================================================
const NATIVE = typeof window !== "undefined" && !!window.__FM_NATIVE__;
const CP_EVERY = 60000;

function storeGet() {
  if (NATIVE) return window.__FM_SAVE__ || null;
  try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
}
function storeWrite(str) {
  if (NATIVE) {
    window.__FM_SAVE__ = str;
    if (typeof window.fmSave === "function") return window.fmSave(str).catch(() => toast("Erro: não deu para gravar o save no disco"));
    return Promise.resolve();
  }
  try { localStorage.setItem(SAVE_KEY, str); } catch (e) { /* sem armazenamento */ }
  return Promise.resolve();
}

function runSnapshot() {
  const pos = game.inside ? game.exitPos : { x: player.x, y: player.y };
  const p = player;
  return {
    v: 1, cx: world.cell.cx, cy: world.cell.cy, x: Math.round(pos.x), y: Math.round(pos.y),
    p: { hp: p.hp, hunger: p.hunger, thirst: p.thirst, stamina: p.stamina, food: p.food, foodQ: p.foodQ, water: p.water, med: p.med,
         anti: p.anti, infect: p.infect || 0, slots: p.slots, pack: p.pack, reserve: p.reserve, bag: p.bag, cur: p.cur },
    g: { money: game.money, clock: game.clock, kills: game.kills, best: game.best }
  };
}
function checkpoint(reason) {
  if (!game || game.over || !save.name || !save.prof || !world) return Promise.resolve();
  save.run = runSnapshot();
  game.cpT = 0; game.lastSave = performance.now();
  toast(`Checkpoint: progresso salvo (${reason})`);
  return storeWrite(JSON.stringify(save));
}
// botões da pausa (Esc)
function manualSave() { game.paused = false; checkpoint("manual"); game.paused = true; }
function saveAndQuit() {
  const p = checkpoint("saindo do jogo");
  game.quitting = true; game.paused = false;
  if (NATIVE && typeof window.fmQuit === "function") p.then(() => setTimeout(() => window.fmQuit(), 400));
}
function drawQuitScreen() {
  ctx.fillStyle = "rgba(6,7,5,0.94)"; ctx.fillRect(0, 0, W, H);
  txt("Progresso salvo", W / 2, H / 2 - 40, 40, "#f2eedc", "center", true);
  txt(NATIVE ? "Fechando o jogo..." : "Você já pode fechar esta aba com segurança.", W / 2, H / 2, 16, "#a9a58f", "center");
  if (!NATIVE) btn(W / 2 - 110, H / 2 + 34, 220, 42, "Voltar ao jogo", () => { game.quitting = false; }, true);
}
// morreu: apaga o checkpoint da partida (o que não se perde ao morrer continua salvo)
function clearRun() { save.run = null; storeWrite(JSON.stringify(save)); }

function restoreRun() {
  const r = save.run;
  if (!r || r.v !== 1) return;
  try {
    const p = r.p;
    for (const k of ["hunger", "thirst", "stamina", "food", "water", "med", "anti", "infect", "cur"]) if (typeof p[k] === "number") player[k] = p[k];
    if (p.foodQ) player.foodQ = Object.assign({ podre: 0, comum: 0, fresca: 0 }, p.foodQ);
    if (Array.isArray(p.slots)) player.slots = p.slots.map((it) => (it && validItem(it) ? it : null)).slice(0, SLOT_N);
    while (player.slots.length < SLOT_N) player.slots.push(null);
    if (Array.isArray(p.pack)) player.pack = p.pack.filter(validItem).slice(0, PACK_MAX);
    if (p.reserve) for (const t in AMMO) player.reserve[t] = Math.max(0, p.reserve[t] | 0);
    if (Array.isArray(p.bag)) player.bag = p.bag.filter((im) => im && IMP[im.id]).slice(0, BAG_MAX);
    recalcImplants();
    player.hp = Math.max(1, Math.min(player.maxHp, p.hp || player.maxHp));
    game.money = r.g.money | 0; game.clock = r.g.clock || game.clock; game.kills = r.g.kills | 0; game.best = r.g.best | 0;
    const c = cellAt(r.cx, r.cy);
    if (c && !(c.tier === 8 && player.level < GRAY_LEVEL)) { game.restoring = true; gotoCell(c, { x: r.x, y: r.y }); game.restoring = false; }
    game.snapCam = true;
    toast("Progresso carregado do último checkpoint");
  } catch (e) { save.run = null; game.restoring = false; }
}
function checkpointTick(dt) {
  if (!game || game.over) return;
  game.cpT = (game.cpT || 0) + dt;
  if (game.cpT >= CP_EVERY) checkpoint("1 minuto");
}
