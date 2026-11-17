"use strict";
// =====================================================================
//  Principal: estado, controles, atualização e laço do jogo
// =====================================================================
const canvas = document.getElementById("game");
const mainCtx = canvas.getContext("2d");
let ctx = mainCtx; // troca para a tela escondida da cena quando o WebGL está ligado
let DPR = 1;
const keys = {};
const mouse = { x: W / 2, y: H / 2, down: false };
const cam = { x: 0, y: 0 };
let player, bullets, zombies, game;

function fitCanvas() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * DPR; canvas.height = H * DPR;
  const s = Math.max(0.3, Math.min((window.innerWidth - 36) / W, (window.innerHeight - 70) / H));
  canvas.style.width = Math.floor(W * s) + "px";
  canvas.style.height = Math.floor(H * s) + "px";
  if (typeof gfxResize === "function") gfxResize();
}

function toast(text) {
  game.msg = text; game.msgT = 2800;
  // também vai para o registro de mensagens (canto de baixo à direita)
  game.log = game.log || [];
  const last = game.log[game.log.length - 1];
  if (last && last.text === text && performance.now() - last.real < 1500) { last.real = performance.now(); return; }
  game.log.push({ text, real: performance.now(), at: game.time });
  if (game.log.length > 12) game.log.shift();
}

function resetGame() {
  player = {
    x: 0, y: 0, r: 14, speed: 1.95, walk: 0, moving: false, flashT: 0, reloadMax: 1,
    hp: 100, maxHp: 100, angle: -Math.PI / 2, level: save.char.level, xp: save.char.xp, points: save.char.points, wpoints: save.char.wpoints,
    attrs: save.char.attrs, bag: [], fx: {},
    stamina: 100, exhausted: false, hunger: 100, thirst: 100, food: 1, foodQ: { podre: 0, comum: 1, fresca: 0 }, water: 1, med: 0, infect: 0, anti: 0,
    slots: [newInst("pistola"), newInst("faca"), null], pack: [],
    reserve: Object.fromEntries(Object.keys(AMMO).map((t) => [t, t === "9mm" ? 30 : 0])),
    cur: 0, reloading: 0, cooldown: 0, heat: 0, spin: 0, overheat: 0
  };
  recalcImplants(); player.hp = player.maxHp;
  bullets = []; zombies = [];
  game = {
    over: false, shop: false, menu: null, input: null, tab: 0, cur: 0, board: [], atBase: false, floats: [], parts: [], spits: [],
    stock: makeStock(), pings: [], lost: 0, inside: null, exitPos: null, area: 0, best: 0, score: 0, money: 0, kills: 0,
    spawnTimer: 5000, rowTimer: 0, msg: "", msgT: 0, slash: 0, slashT: 0, slashR: 60, slashA: 0.9,
    time: 0, clock: 8 * 60, shake: 0, hurtT: 0, banner: null, at: 0, ac: 0, snapCam: true,
    flashes: [], clicks: [], found: null, foundSrc: "", paused: false, inv: { sel: 0 },
    shopTab: 0, shopCur: 0, vside: 0, vcur: 0, ctab: 0, ccur: 0, cstat: 0,
    airdrops: [], horde: null, evAir: 150000, evHorde: 240000, objT: 0, lastHour: null, otab: 0, oscroll: 0, objDirty: false,
    search: null, hub: false, escort: null, pcur: 0, hazards: [], smoke: [], fuses: [], killSrc: null, trans: null, edgeT: 0, mapSel: null
  };
  world = makeWorld(20261113);
  const f = doorFront(world.outposts[0]);
  player.x = f.x; player.y = f.y;
  game.exitPos = { x: f.x, y: f.y };
  game.board = makeOffers();
  manageRows();
  if (!save.name) openNameScreen(false); // personagem novo: primeiro o nome, depois a profissão
  else if (!save.prof) game.menu = "prof";
  game.banner = { text: "Fronteira Morta", sub: "Refúgio · entre (E) para oficina, banco, clínica e missões · I abre Mensagens", t: 4200, gold: true };
}


function useResetStatsCard() {
  const it = player.pack.find(x => x && x.kind === "mat" && x.id === "reset_stats" && x.qty > 0);
  if (!it) { toast("Você não possui um cartão de reset."); return; }
  let normal = 0, weapons = 0;
  ATTRS.forEach(a => {
    const invested = Math.max(0, Math.round((player.attrs[a.id] || a.start) - a.start));
    if (WEAPON_SKILL_IDS.includes(a.id)) weapons += invested;
    else normal += invested;
    player.attrs[a.id] = a.start;
  });
  player.points += normal;
  player.wpoints += weapons;
  it.qty--;
  if (!it.qty) player.pack.splice(player.pack.indexOf(it), 1);
  recalcImplants();
  player.hp = Math.min(player.hp, player.maxHp);
  syncChar();
  checkpoint("uso do cartão de reset de stats");
  game.menu = "stats"; game.stab = 0; game.cur = 0;
  toast("Atributos resetados! Redistribua seus pontos.");
}

// Consumo da Trindade: 100 anos de calendário desde a ativação.
function useTrindadeItem() {
  const it = player.pack.find(x => x && x.kind === "mat" && x.id === "trindade_eterna" && x.qty > 0);
  if (!it) { toast("Você não possui uma Trindade."); return; }
  const exp = new Date(Math.max(Date.now(), Number(save.trindadeUntil) || 0));
  exp.setUTCFullYear(exp.getUTCFullYear() + 100);
  if (!Number.isFinite(exp.getTime())) { toast("Erro ao calcular validade."); return; }
  it.qty--;
  if (!it.qty) player.pack.splice(player.pack.indexOf(it), 1);
  save.trindadeUntil = exp.getTime();
  checkpoint("uso da Trindade");
  toast("Trindade ativada: +35% de dano, corrida e armadura por 100 anos!");
}
// ---------- Controles ----------
function audioStart() {
  sndInit();
  if (SND.ac) {
    musicSetOn(save.music);
    musicStart();
    fmAudioAssetsStart(); // efeitos sonoros militares e zumbis, carregados sob demanda
    fmAmbientStart(); // trilha do ZIP Ambiente sond, só após gesto do jogador
  }
}
window.addEventListener("keydown", (e) => {
  audioStart();
  const k = e.key.toLowerCase();
  if (game) game.rawKey = e.key;
  keys[k] = true;
  if (["tab", " ", "arrowup", "arrowdown", "arrowleft", "arrowright", "backspace", "f2"].includes(k)) e.preventDefault();
  if (e.repeat && !game.menu) return;
  if (k === "f2") { toggleAdmin(); return; }
  if (game.over) { if (k === "enter") respawnPlayer(); return; }
  if (game.quitting) return;
  if (game.menu === "pack" && game.found) { menuKey(k); return; } // mochila sobre loot: preserva a oferta
  if (game.found) { foundKey(k); return; }
  if (k === "u" && !e.repeat && !game.shop && !game.over && !game.menu) {
    openFriends();
    return;
  }
  if (game.menu) { menuKey(k); return; }
  if (game.shop) { shopKey(k); return; }
  if (game.hub && (k === "escape" || k === "e")) { leaveHouse(); return; }
  if (game.hub && (k === "r" || k === "f" || k === "p" || k === "l")) { if (k === "f") eat(); return; }
  if (game.paused) {
    if ((k === "escape" || k === "p") && game.settingsOpen) {
      game.settingsOpen = false; game.settingsDrag = null;
    } else if (k === "escape" || k === "p") togglePause();
    return;
  }
  if (k === "escape" && game.sectorMap) { game.sectorMap = false; return; }
  if (k === "escape" || k === "p") { togglePause(); return; }
  if (k === "b") { game.menu = "pack"; mouse.down = false; return; }
  // A tecla L não abre mais a loja. O painel visual continua no refúgio.
  if (k === "k") { sndMute(!SND.muted); save.muted = SND.muted; persist(); toast(SND.muted ? "Som desligado" : "Som ligado"); return; }
  if (k === "n") { game.menu = "map"; game.mapSel = { cx: world.cell.cx, cy: world.cell.cy }; return; }
  if (k === "o") { game.menu = "obj"; game.oscroll = 0; return; }
  if (k === "j") { save.music = !save.music; musicSetOn(save.music); persist(); toast(save.music ? "Música ligada" : "Música desligada"); return; }
  if (k === "tab") { save.hud = save.hud === 1 ? 0 : 1; persist(); toast(save.hud ? "HUD compacto (Tab volta ao completo)" : "HUD completo"); return; }
  const n = k === "0" ? 10 : parseInt(k, 10);
  if (k === "r") startReload();
  else if (k === "e") interact();
  else if (k === "f") eat();
  else if (k === "g") drink();
  else if (k === "h") heal();
  else if (k === "i") openMessages();
  else if (k === "c") { game.menu = "stats"; game.cur = 0; }
  else if (k === "m") { game.sectorMap = !game.sectorMap; }
  else if (n >= 1 && n <= SLOT_N) selectWeapon(n - 1);
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; mouse.down = false; });
canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width);
  mouse.y = (e.clientY - r.top) * (H / r.height);
  if (game.menu === "pack") invMouseMove(mouse.x, mouse.y);
  if (game.paused && game.settingsOpen && game.settingsDrag) pauseSettingsDrag(mouse.x);
  portraitMouseMove(mouse.x);
});
canvas.addEventListener("mousedown", (e) => {
  audioStart();
  if (e.button !== 0) return;
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width); mouse.y = (e.clientY - r.top) * (H / r.height);
  // boneco 3D (inventário ou painel da base): arrastar gira; clique simples resolvido ao soltar
  const spinOk = (game.menu === "pack" && !INV.confirm && !allocOpen()) ||
    (game.hub && !game.menu && !game.shop && !game.found && !game.paused && !game.over && !game.quitting);
  if (spinOk && portraitMouseDown(mouse.x, mouse.y)) return;
  // inventário: começa a arrastar um item (o clique simples é resolvido ao soltar)
  if (game.menu === "pack" && !INV.confirm && !allocOpen() && invMouseDown(mouse.x, mouse.y)) return;
  if (game.found || game.menu || game.shop || game.paused || game.over || game.hub || game.quitting) { handleClick(mouse.x, mouse.y); return; }
  mouse.down = true;
});
window.addEventListener("mouseup", () => {
  mouse.down = false;
  game.settingsDrag = null;
  portraitMouseUp();
  if (INV.drag) { if (game.menu === "pack") invMouseUp(mouse.x, mouse.y); else INV.drag = null; }
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (game.menu || game.shop || game.over || game.found || game.paused || game.hub) return;
  cycleWeapon(e.deltaY > 0 ? 1 : -1);
}, { passive: false });
window.addEventListener("resize", fitCanvas);

// ---------- Atualização ----------
function update(dt) {
  if (game.quitting) return;
  if (game.over || game.shop || game.menu || game.found || game.paused) return;
  if (game.trans) { transTick(dt); return; } // trocando de área (tela escura)
  const k = dt / 16.67, sec = dt / 1000;
  game.time += dt;
  // Horário da cidade sincronizado pelo servidor em fmWorld.tick().

  const meta = 1 - Math.min(0.8, player.fx.metabolism / 100);
  player.hunger = Math.max(0, player.hunger - 0.084 * sec * meta);
  player.thirst = Math.max(0, player.thirst - 0.119 * sec * meta);
  if (adm.noHunger) { player.hunger = 100; player.thirst = 100; }
  const fed = player.hunger > 0 && player.thirst > 0;
  if (fed && player.fx.regen > 0) player.hp = Math.min(player.maxHp, player.hp + player.fx.regen * sec);
  if (inSafe() && fed) player.hp = Math.min(player.maxHp, player.hp + 1.5 * sec); // descanso no posto
  infectTick(sec);
  if (game.hub) { player.stamina = Math.min(100, player.stamina + 22 * sec); return; } // na tela da base o mundo espera

  // movimento
  let dx = 0, dy = 0;
  if (keys.w || keys.arrowup) dy--;
  if (keys.s || keys.arrowdown) dy++;
  if (keys.a || keys.arrowleft) dx--;
  if (keys.d || keys.arrowright) dx++;
  const moving = dx || dy;
  const sprinting = moving && keys.shift && player.stamina > 0 && !player.exhausted;
  player.sprinting = !!sprinting; player.moving = !!moving;
  if (adm.infStamina) { player.stamina = 100; player.exhausted = false; }
  game.objT -= dt;
  if (game.objT <= 0) { game.objT = 1000; objectivesTick(); }
  if (!fmWorld.isFollower()) eventsTick(dt);
  gfxTick(dt);
  // Aceleração/desaceleração curta, baseada em dt: elimina o aspecto de
  // deslocamento aos solavancos sem alterar a velocidade máxima do personagem.
  let goalVX = 0, goalVY = 0;
  if (moving) {
    const slow = (player.flags.jugger ? 0 : (save.vest >= 0 ? VESTS[save.vest].slow || 0 : 0) + (curW().slow || 0)) - (player.fx.adren && player.hp / player.maxHp < 0.5 ? player.fx.adren : 0);
    const len = Math.hypot(dx, dy);
    const sp = (sprinting ? 3.38 * (1 + profVal("sprint")) : player.speed) *
      (1 + (player.fx.agility + vestSpeedBonus()) / 100) *
      (1 + (A("agi") - 10) * 0.004) * (1 - slow / 100) *
      (sprinting && trindadeActive() ? 1.35 : 1);
    goalVX = dx / len * sp; goalVY = dy / len * sp;
  }
  const motionLerp = 1 - Math.exp(-dt / 55);
  player.moveVX = (player.moveVX || 0) + (goalVX - (player.moveVX || 0)) * motionLerp;
  player.moveVY = (player.moveVY || 0) + (goalVY - (player.moveVY || 0)) * motionLerp;
  const actualSpeed = Math.hypot(player.moveVX, player.moveVY);
  player.walkBlend = (player.walkBlend || 0) + ((moving ? 1 : 0) - (player.walkBlend || 0)) * (1 - Math.exp(-dt / 100));
  player.moving = actualSpeed > 0.08;
  if (actualSpeed > 0.01) {
    player.moveAng = Math.atan2(player.moveVY, player.moveVX);
    // Movimento em passos curtos e por eixo: impede cruzar a hitbox
    // de carros, paredes e contêineres em corridas rápidas ou lag.
    // Ao encostar, o corpo desliza pelo obstáculo em vez de atravessá-lo.
    const mvX = player.moveVX * k, mvY = player.moveVY * k;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(mvX), Math.abs(mvY)) / 7));
    for (let step = 0; step < steps; step++) {
      player.x += mvX / steps;
      pushOut(player, player.r);
      player.y += mvY / steps;
      pushOut(player, player.r);
    }
    player.animT = (player.animT || 0) + dt;
    player.lastSp = actualSpeed;
    if (!game.inside) save.stats.dist = S("dist") + actualSpeed * k;
    player.walk += actualSpeed * k * 0.16;
    if (sprinting && Math.random() < dt / 70) dust(player.x - player.moveVX / actualSpeed * 8, player.y - player.moveVY / actualSpeed * 8);
  }
  if (sprinting) {
    player.stamina -= 24 * sec * (1 - Math.min(0.8, player.fx.endurance / 100)) * (1 + profVal("stamina"));
    if (player.stamina <= 0) { player.stamina = 0; player.exhausted = true; }
  } else if (fed) {
    player.stamina = Math.min(100, player.stamina + (moving ? 12 : 22) * sec);
    if (player.exhausted && player.stamina >= 20) player.exhausted = false;
  }
  if (game.inside) {
    player.x = clamp(player.x, 56, IW() - 56); player.y = clamp(player.y, 56, IH() - 56);
  } else {
    player.x = clamp(player.x, player.r, WORLD_W - player.r); player.y = clamp(player.y, player.r, WORLD_H - player.r);
  }
  pushOut(player, player.r);
  if (!game.inside && moving) edgeCheck(dx, dy);
  // Atualiza a câmera ANTES de calcular o ângulo e disparar; isso elimina
  // o frame de atraso entre ponteiro, cano da arma e projétil.
  updateCam(dt);
  const ox = cam.x, oy = cam.y;
  // Zona morta da mira em torno do tronco: quando o mouse encosta no
  // personagem, mantém a última direção válida. O pivô visual fica
  // acima dos pés, onde o corpo realmente está desenhado.
  const aimDX = mouse.x + ox - player.x;
  const aimDY = mouse.y + oy - (player.y - 14);
  if (Math.hypot(aimDX, aimDY) > 34) {
    player.angle = Math.atan2(aimDY, aimDX);
  }
  spriteTick(dt);
  updateWeaponAim(); // arma, clarão e projétil seguem a mesma direção

  // tiro e recarga
  const w = curW(), inst = curInst();
  player.cooldown -= dt;
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) finishReload();
  }
  // minigun de munição infinita: gira para acelerar (sem superaquecer)
  const firingInf = w.infinite && mouse.down && player.reloading === 0;
  player.spin = firingInf ? Math.min(1, player.spin + sec * 1.3) : Math.max(0, player.spin - sec * 2);
  if (mouse.down && player.cooldown <= 0 && player.reloading === 0) {
    if (!canUse(w)) { toast(`Requisitos: ${reqText(w)}`); player.cooldown = 600; }
    else if (w.melee || inst.ammo > 0) attack();
    else if (w.infinite) startReload();
    else if (player.reserve[w.ammo] > 0) startReload();
    else { toast("Sem munição"); sfx.empty(); player.cooldown = 500; }
  }

  searchTick(dt);
  escortTick(dt, k);
  updateBullets(dt, k);
  tickBaseGuards(dt);
  updateSpits(dt, k);
  updateHazards(dt);
  updateFuses(dt);
  updateParts(dt, k);

  if (!fmWorld.isFollower()) mapTick(dt);
  if (game.trans) return;
  if (!game.inside) {
    manageRows();
    const pr = world.cell.zone;
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) { if (!fmWorld.isFollower()) trickleSpawn(); game.spawnTimer = Math.max(2500, 6500 - pr * 250) * (isNight() ? 0.7 : 1); }
    world.corpses = world.corpses.filter((c) => (c.life -= dt) > 0);
  }

  if (!fmWorld.isFollower()) updateZombies(dt, k);
  else fmWorld.localZombieThreats(dt);
  zombies = zombies.filter((z) => z.hp > 0);
  if (game.inside) game.inside.zombies = game.inside.zombies.filter((z) => z.hp > 0);
  if (adm.god) player.hp = player.maxHp;
  if (player.hp <= 0 && Math.random() * 100 < player.fx.deathDefy) {       // Desafia-Morte
    player.hp = Math.max(1, player.maxHp * 0.1); player.defyUntil = performance.now() + 1200;
    game.banner = { text: "Golpe fatal evitado!", sub: "O implante Desafia-Morte te segurou em pé", t: 1800, gold: true };
  }
  lastStandTick();
  if (player.hp <= 0) recordDeath();
}

function updateCam(dt) {
  // dentro de prédios grandes a câmera também segue o personagem
  const tx = clamp(player.x - W / 2 + (mouse.x - W / 2) * 0.18, 0, Math.max(0, IW() - W));
  const ty = clamp(player.y - H / 2 + (mouse.y - H / 2) * 0.18, 0, Math.max(0, IH() - H));
  if (game.snapCam) { cam.x = tx; cam.y = ty; game.snapCam = false; return; }
  const f = Math.min(1, dt / 90);
  cam.x += (tx - cam.x) * f; cam.y += (ty - cam.y) * f;
}

// ---------- Desenho ----------
function draw() {
  game.clicks = [];
  if (game.hub && !game.over) {
    ctx = mainCtx; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawHub();
    if (game.shop || game.menu || game.found) game.clicks = [];   // com um menu aberto, a base atrás não recebe clique
    if (game.shop) drawShop();
    if (game.menu) drawMenu();
    if (game.found && game.menu !== "pack") drawFound();
    if (game.banner && !game.menu && !game.shop) { const a = Math.min(1, game.banner.t / 500); ctx.globalAlpha = a; ctx.fillStyle = "rgba(8,9,7,0.82)"; rr(566 - 190, 57, 380, 28, 6); ctx.fill(); txt(game.banner.text, 566, 77, 18, game.banner.gold ? "#ffd96a" : "#e5e0c8", "center", true); ctx.globalAlpha = 1; }
    if (game.msgT > 0 && !game.menu && !game.shop) { ctx.globalAlpha = Math.min(1, game.msgT / 300); txt(game.msg, 566, H - 30, 14, "#ffd96a", "center", true, 560); ctx.globalAlpha = 1; }
    drawTransition();
    return;
  }
  // cena: com WebGL vai para uma tela escondida; sem WebGL, direto na tela do jogo
  ctx = GFX.on ? GFX.sctx : mainCtx;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = "#0d0e0c"; ctx.fillRect(0, 0, W, H);
  const sh = game.shake > 0.3 ? game.shake : 0;
  const shx = (Math.random() - 0.5) * sh, shy = (Math.random() - 0.5) * sh;
  ctx.save();
  ctx.translate(-Math.round(cam.x) + shx, -Math.round(cam.y) + shy);
  if (game.inside) drawInterior(); else { drawWorld(); drawAirdrops(); }
  drawGroundDrops(); // itens recusados continuam visíveis por 10s reais
  drawHazards();
  for (const p of game.pings) {
    const f = 1 - p.t / 350;
    ctx.strokeStyle = `rgba(255,255,255,${0.3 * (1 - f)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.r * f), 0, Math.PI * 2); ctx.stroke();
  }
  if (game.inside) {
    for (const z of Zs()) { drawZombie(z); drawZombieExtra(z); }
    for (const online of fmSocial.inSector()) drawOnlinePlayer(online);
    drawProjectiles();
    if (game.escort && !game.over) drawSurvivor(game.escort.x, game.escort.y, game.escort.ang, game.escort.walk, game.escort.moving);
    if (!game.over && !drawPlayerSprite()) drawPlayer();
  } else {
    drawSortedScene(); // câmera inclinada: prédios, postes, zumbis e você ordenados pela profundidade (pés)
    drawProjectiles(); drawCanopiesP(); drawSmoke();
  }
  ctx.restore();
  if (GFX.on) {
    // luz, sombras, clima e efeitos no WebGL; o HUD vai na tela de cima (transparente)
    ctx = mainCtx;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    gfxRender();
  } else {
    drawLighting();
    drawScreenFx();
  }
  drawAtmosphere(); // cone da lanterna, neblina azulada e vinheta
  applyGameBrightness(); // ajuste do jogador, sem modificar brilho dos menus/HUD
  // números de dano ficam acima da luz, sempre legíveis
  ctx.save();
  ctx.translate(-Math.round(cam.x) + shx, -Math.round(cam.y) + shy);
  for (const f of game.floats) {
    ctx.globalAlpha = Math.min(1, f.t / 300);
    txt(f.text, f.x, f.y - (700 - f.t) / 20, f.crit ? 16 : 12, f.money ? "#8fe08a" : f.crit ? "#ffd96a" : "#ffb0a0", "center", true);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawHUD();
  drawBonusPanel();
  drawObjTracker();
  drawEventHud();
  if (game.sectorMap && !game.over && !game.menu && !game.shop && !game.found && !game.paused) drawSectorOverlay();
  if (game.shop && !game.over) drawShop();
  if (game.menu && !game.over) drawMenu();
  if (game.found && !game.over && game.menu !== "pack") drawFound();
  if (game.paused && !game.over && !game.menu && !game.shop) drawPause();
  if (game.over) drawGameOver();
  if (game.quitting) drawQuitScreen();
  drawTransition();
}

// ---------- Laço principal ----------
loadSave();
SND.muted = save.muted;
fitCanvas();
gfxInit();
initRender();
resetGame();
loadSprites();
ensureDaily();
restoreRun(); // volta do último checkpoint, se houver
fmGifts.start(); // correio: entrega presentes do ADM quando o jogo está pronto
fmWorld.start(); // consulta relógio oficial do servidor Supabase
if (save.name) fmSocial.start(); // publica posição somente após autenticação e nome definitivo
// rodando pelo servidor local instalado: avisa que o jogo está aberto (o servidor fecha sozinho quando você sai)
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  setInterval(() => { fetch("/__ping", { cache: "no-store" }).catch(() => {}); }, 15000);
}
let last = performance.now();
function loop(now) {
  const dt = Math.max(0, Math.min(now - last, 50));
  last = now;
  if (game.msgT > 0) game.msgT -= dt;
  if (game.slashT > 0) game.slashT -= dt;
  if (game.banner && (game.banner.t -= dt) <= 0) game.banner = null;
  game.shake = Math.max(0, game.shake - dt * 0.03);
  game.hurtT = Math.max(0, game.hurtT - dt);
  player.flashT = Math.max(0, player.flashT - dt);
  game.pings = game.pings.filter((p) => (p.t -= dt) > 0);
  game.flashes = game.flashes.filter((f) => (f.t -= dt) > 0);
  game.floats = game.floats.filter((f) => (f.t -= dt) > 0);
  fmWorld.tick(); // relógio global e snapshots dos zumbis, inclusive durante pausas
  floorPursuitTick(now); // perseguidores atravessam a escada após 2 segundos
  groundDropsTick(now); // o prazo dos itens continua correndo mesmo com menus abertos
  update(dt);
  checkpointTick(dt);
  draw();
  

requestAnimationFrame(loop);
}
// O VIP aparece apenas no rodapé HTML, nunca dentro do canvas.
function refreshVipFooter() {
  const el = document.getElementById("vip-footer");
  if (!el) return;
  let label, inactive = false;
  if (save.gm) label = "★ VIP ATIVO · Sem vencimento";
  else if (Number(save.vipUntil) > Date.now()) {
    label = "★ VIP ATIVO · Expira em " + new Date(save.vipUntil).toLocaleDateString("pt-BR");
  } else {
    inactive = true;
    label = Number(save.vipUntil) > 0 ? "VIP EXPIRADO" : "VIP INATIVO";
  }
  if (el.textContent !== label) el.textContent = label;
  el.classList.toggle("inactive", inactive);
}
refreshVipFooter();
setInterval(refreshVipFooter, 1000);
// Somente os três bônus da Trindade ficam visíveis fora da área do jogo.
function refreshTrindadeFooter() {
  const el = document.getElementById("trindade-footer");
  if (!el) return;
  const active = trindadeActive();
  el.hidden = !active;
  if (active) el.textContent = "TRINDADE ATIVA · Dano +35% · Corrida +35% · Armadura +35%";
}
refreshTrindadeFooter();
setInterval(refreshTrindadeFooter, 1000);
requestAnimationFrame(loop);
