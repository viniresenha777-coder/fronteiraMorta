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
    if (typeof window.fmSave !== "function") return Promise.reject(new Error("Gravador nativo indisponível"));
    return Promise.resolve().then(() => window.fmSave(str)).then(() => {
      window.__FM_SAVE__ = str;
    });
  }
  try {
    localStorage.setItem(SAVE_KEY, str);
    if (localStorage.getItem(SAVE_KEY) !== str) throw new Error("O navegador não confirmou a gravação");
    return Promise.resolve();
  } catch (e) {
    return Promise.reject(e);
  }
}

function runSnapshot() {
  const pos = game.inside ? game.exitPos : { x: player.x, y: player.y };
  const p = player;
  return {
    v: 1, cx: world.cell.cx, cy: world.cell.cy, x: Math.round(pos.x), y: Math.round(pos.y),
    p: { hp: p.hp, hunger: p.hunger, thirst: p.thirst, stamina: p.stamina, food: p.food, foodQ: p.foodQ, water: p.water, med: p.med,
         anti: p.anti, infect: p.infect || 0, slots: p.slots, pack: p.pack, reserve: p.reserve, bag: p.bag, cur: p.cur },
    g: { money: game.money, clock: game.clock, kills: game.kills, best: game.best, time: game.time },
    map: MAP ? {
      bossT: MAP.bossT,
      cells: allCells().map((cell) => ({
        cx: cell.cx, cy: cell.cy, boss: cell.boss, bossHp: cell.bossHp,
        cleared: !!cell.cleared, leftAt: cell.leftAt, visited: !!cell.visited,
        loot: cell.w ? cell.w.lootList.map((item) => !!item.opened) : null
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
  } catch (e) {
    console.error("Falha ao preparar checkpoint:", e);
    toast("ERRO: não foi possível preparar o salvamento.");
    return Promise.resolve(false);
  }
  return storeWrite(payload).then(() => {
    game.cpT = 0;
    game.lastSave = performance.now();
    toast(`Checkpoint: progresso salvo (${reason})`);
    return true;
  }).catch((e) => {
    console.error("Falha ao salvar checkpoint:", e);
    toast("ERRO: não foi possível salvar. Seu progresso não foi confirmado.");
    return false;
  });
}
// Botões da pausa (Esc): mantém o estado de pausa enquanto grava.
function manualSave() {
  if (!game) return;
  checkpoint("manual");
}
function saveAndQuit() {
  if (!game || game.quitting) return;
  const wasPaused = game.paused;
  checkpoint("saindo do jogo").then((ok) => {
    if (!ok) {
      game.paused = wasPaused;
      return;
    }
    game.paused = false;
    game.quitting = true;
    if (NATIVE && typeof window.fmQuit === "function") setTimeout(() => window.fmQuit(), 150);
  });
}
function drawQuitScreen() {
  ctx.fillStyle = "rgba(6,7,5,0.94)"; ctx.fillRect(0, 0, W, H);
  txt("Progresso salvo", W / 2, H / 2 - 40, 40, "#f2eedc", "center", true);
  txt(NATIVE ? "Fechando o jogo..." : "Você já pode fechar esta aba com segurança.", W / 2, H / 2, 16, "#a9a58f", "center");
  if (!NATIVE) btn(W / 2 - 110, H / 2 + 34, 220, 42, "Voltar ao jogo", () => { game.quitting = false; }, true);
}
// morreu: apaga o checkpoint da partida (o que não se perde ao morrer continua salvo)
function clearRun() {
  save.run = null;
  storeWrite(JSON.stringify(save)).catch((e) => {
    console.error("Falha ao limpar checkpoint:", e);
    toast("Não foi possível atualizar o salvamento após a morte.");
  });
}

function restoreRun() {
  const r = save.run;
  if (!r || r.v !== 1) return;
  try {
    // Restaura o estado persistente das áreas antes de entrar na área salva.
    if (r.map && Array.isArray(r.map.cells) && MAP) {
      if (Number.isFinite(r.map.bossT)) MAP.bossT = Math.max(0, r.map.bossT);
      for (const savedCell of r.map.cells) {
        if (!savedCell || !Number.isInteger(savedCell.cx) || !Number.isInteger(savedCell.cy)) continue;
        const cell = cellAt(savedCell.cx, savedCell.cy);
        if (!cell) continue;
        cell.boss = savedCell.boss && Object.prototype.hasOwnProperty.call(BOSSES, savedCell.boss) ? savedCell.boss : null;
        cell.bossHp = Number.isFinite(savedCell.bossHp) ? Math.max(0, savedCell.bossHp) : null;
        cell.cleared = !!savedCell.cleared;
        cell.leftAt = Number.isFinite(savedCell.leftAt) ? savedCell.leftAt : -1e9;
        cell.visited = !!savedCell.visited;
        cell._savedLoot = Array.isArray(savedCell.loot) ? savedCell.loot.slice() : null;
      }
    }
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
    if (Number.isFinite(r.g.time)) game.time = Math.max(0, r.g.time);
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
