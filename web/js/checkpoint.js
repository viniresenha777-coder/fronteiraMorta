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
  if (typeof fmCloud !== "undefined" && fmCloud.isActive()) return fmCloud.read();
  if (NATIVE) return window.__FM_SAVE__ || null;
  try { return localStorage.getItem(SAVE_KEY); } catch (error) { return null; }
}
function storeWrite(str) {
  if (typeof fmCloud !== "undefined" && fmCloud.isActive()) return fmCloud.write(str);
  if (NATIVE) {
    if (typeof window.fmSave !== "function") return Promise.reject(new Error("Gravador nativo indisponível."));
    return Promise.resolve().then(() => window.fmSave(str)).then(() => { window.__FM_SAVE__ = str; });
  }
  try {
    localStorage.setItem(SAVE_KEY, str);
    if (localStorage.getItem(SAVE_KEY) !== str) throw new Error("A gravação local não foi confirmada.");
    return Promise.resolve();
  } catch (error) { return Promise.reject(error); }
}

function runSnapshot() {
  const pos = game.inside ? game.exitPos : { x: player.x, y: player.y };
  const p = player;
  return {
    v: 1, cx: world.cell.cx, cy: world.cell.cy, x: Math.round(pos.x), y: Math.round(pos.y),
    p: { hp: p.hp, hunger: p.hunger, thirst: p.thirst, stamina: p.stamina, food: p.food, foodQ: p.foodQ, water: p.water, med: p.med,
         anti: p.anti, infect: p.infect || 0, slots: p.slots, pack: p.pack, reserve: p.reserve, bag: p.bag, cur: p.cur },
    g: { money: game.money, clock: game.clock, kills: game.kills, best: game.best, time: game.time },
    map: typeof MAP !== "undefined" && MAP ? {
      bossT: MAP.bossT,
      cells: allCells().map((cell) => ({
        cx: cell.cx, cy: cell.cy, boss: cell.boss, bossHp: cell.bossHp,
        cleared: !!cell.cleared, leftAt: cell.leftAt, visited: !!cell.visited,
        loot: cell.w ? cell.w.lootList.map((it) => !!it.opened) : cell._savedLoot || null
      }))
    } : null
  };
}
function checkpoint(reason) {
  if (!game || game.over || !save.name || !save.prof || !world) return Promise.resolve(false);
  let payload;
  try {
    save.run = runSnapshot();
    payload = JSON.stringify(save);
  } catch (error) {
    console.error("Erro ao preparar checkpoint:", error);
    toast("ERRO: não foi possível preparar seu progresso.");
    return Promise.resolve(false);
  }
  game.cpT = 0; // evita salvar novamente enquanto uma gravação está pendente
  return storeWrite(payload).then(() => {
    game.lastSave = performance.now();
    toast(`Checkpoint: progresso salvo (${reason})`);
    return true;
  }).catch((error) => {
    console.error("Erro ao gravar checkpoint:", error);
    toast("ERRO AO SALVAR: " + (error.message || "sem resposta do servidor"));
    return false;
  });
}
// O jogador permanece pausado enquanto o save remoto é confirmado.
function manualSave() {
  if (!game || game.savingExit) return;
  checkpoint("manual");
}
async function saveAndQuit() {
  if (!game || game.quitting || game.savingExit) return;
  game.savingExit = true;
  const ok = await checkpoint("saindo do jogo");
  if (!ok) { game.savingExit = false; game.paused = true; return; }
  try {
    if (NATIVE && typeof window.fmQuit === "function") {
      game.quitting = true;
      setTimeout(() => window.fmQuit(), 150);
    } else {
      if (typeof fmGifts !== "undefined") fmGifts.stop();
      if (typeof fmSocial !== "undefined") await fmSocial.stop();
      if (typeof fmCloud !== "undefined" && fmCloud.isActive()) await fmCloud.logout();
      game.quitting = true;
      // Abas abertas pelo próprio jogador não podem ser fechadas por JavaScript.
      // Retornar ao login equivale a "sair" sem perder o progresso.
      window.location.replace(window.location.pathname);
    }
  } catch (error) {
    game.quitting = false;
    game.savingExit = false;
    game.paused = true;
    console.error("Erro ao sair da conta:", error);
    toast("Partida salva, mas não foi possível encerrar a sessão: " + (error.message || "erro de conexão"));
  }
}
function drawQuitScreen() {
  ctx.fillStyle = "rgba(6,7,5,0.94)"; ctx.fillRect(0, 0, W, H);
  txt("Progresso salvo", W / 2, H / 2 - 40, 40, "#f2eedc", "center", true);
  txt(NATIVE ? "Fechando jogo..." : "Voltando à tela de login...", W / 2, H / 2, 16, "#a9a58f", "center");
}

// Save retained possessions immediately, before the player presses Enter or reloads.
function recordDeath() {
  if (game.over) return;
  const carried = Math.max(0, game.money);
  game.money = Math.min(carried, cashProtection());
  game.lost = carried - game.money;
  player.hp = 0; game.over = true; mouse.down = false;
  stat("deaths");
  const r = runSnapshot();
  r.respawn = true;
  // Recovery restores health; inventory quantities and loaded ammo stay unchanged.
  r.p.hp = player.maxHp;
  r.p.hunger = 100; r.p.thirst = 100; r.p.stamina = 100; r.p.infect = 0;
  save.run = r;
  return storeWrite(JSON.stringify(save)).catch((error) => {
    console.error("Erro ao salvar os itens após morte:", error);
    toast("Não foi possível salvar o renascimento. Tente novamente ao voltar à base.");
  });
}
function respawnPlayer() {
  resetGame();
  restoreRun();
}

function restoreRun() {
  const r = save.run;
  if (!r || r.v !== 1) return;
  try {
    if (r.map && Array.isArray(r.map.cells) && MAP) {
      if (Number.isFinite(r.map.bossT)) MAP.bossT = Math.max(0, r.map.bossT);
      for (const previous of r.map.cells) {
        if (!previous || !Number.isInteger(previous.cx) || !Number.isInteger(previous.cy)) continue;
        const cell = cellAt(previous.cx, previous.cy);
        if (!cell) continue;
        cell.boss = previous.boss && Object.prototype.hasOwnProperty.call(BOSSES, previous.boss) ? previous.boss : null;
        cell.bossHp = Number.isFinite(previous.bossHp) ? Math.max(0, previous.bossHp) : null;
        cell.cleared = !!previous.cleared;
        cell.leftAt = Number.isFinite(previous.leftAt) ? previous.leftAt : -1e9;
        cell.visited = !!previous.visited;
        cell._savedLoot = Array.isArray(previous.loot) ? previous.loot.slice() : null;
      }
    }
    const p = r.p;
    for (const k of ["hunger", "thirst", "stamina", "food", "water", "med", "anti", "infect", "cur"]) if (typeof p[k] === "number") player[k] = p[k];
    if (p.foodQ) player.foodQ = Object.assign({ podre: 0, comum: 0, fresca: 0 }, p.foodQ);
    if (Array.isArray(p.slots)) player.slots = p.slots.map((it) => (it && validItem(it) ? it : null)).slice(0, SLOT_N);
    while (player.slots.length < SLOT_N) player.slots.push(null);
    if (Array.isArray(p.pack)) player.pack = p.pack.filter(validItem).slice(0, PACK_MAX);
    if (p.reserve) for (const t in AMMO) player.reserve[t] = Math.max(0, p.reserve[t] | 0);
    if (Array.isArray(p.bag)) player.bag = p.bag.map(cleanImplant).filter(Boolean).slice(0, BAG_MAX);
    recalcImplants();
    player.hp = Math.max(1, Math.min(player.maxHp, p.hp || player.maxHp));
    game.money = r.g.money | 0; game.clock = r.g.clock || game.clock; game.kills = r.g.kills | 0; game.best = r.g.best | 0; if (Number.isFinite(r.g.time)) game.time = Math.max(0, r.g.time);
    const c = cellAt(r.cx, r.cy);
    if (!r.respawn && c && !(c.tier === 8 && player.level < GRAY_LEVEL)) { game.restoring = true; gotoCell(c, { x: r.x, y: r.y }); game.restoring = false; }
    game.snapCam = true;
    toast(r.respawn ? "Você voltou ao Refúgio com seus equipamentos e itens." : "Progresso carregado do último checkpoint");
    if (r.respawn) checkpoint("renascimento");
  } catch (e) { save.run = null; game.restoring = false; }
}
function checkpointTick(dt) {
  if (!game || game.over) return;
  game.cpT = (game.cpT || 0) + dt;
  if (game.cpT >= CP_EVERY) checkpoint("1 minuto");
}
