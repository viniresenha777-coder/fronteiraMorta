"use strict";
// =====================================================================
//  Inventário e telas de itens: item encontrado (aceitar ou não),
//  mochila (B) com 3 armas equipadas, baú da base, loja, oficina
//  (criar armas especiais e melhorar Precisão/Dano/Recarga até 8) e pausa.
// =====================================================================

// ---------- Cliques do mouse nas telas ----------
function regClick(x, y, w, h, fn) { game.clicks.push({ x, y, w, h, fn }); }
function handleClick(x, y) {
  for (let i = game.clicks.length - 1; i >= 0; i--) {
    const c = game.clicks[i];
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) { c.fn(); return true; }
  }
  return false;
}
function btn(x, y, w, h, label, fn, primary, disabled) {
  const hov = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  ctx.fillStyle = disabled ? "rgba(40,40,36,0.8)" : primary ? (hov ? "#5a4a2a" : "#463a20") : hov ? "#34322a" : "#24231d";
  rr(x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = disabled ? "#3d3b30" : primary ? "#d4af37" : "#6d6a58"; ctx.lineWidth = 1.5; ctx.stroke();
  txt(label, x + w / 2, y + h / 2 + 5, 15, disabled ? "#6d6a58" : "#f2eedc", "center", true);
  if (!disabled) regClick(x, y, w, h, fn);
}
// linha de lista: 1º clique seleciona, 2º clique executa
function rowClick(x, y, w, h, isSel, select, act) { regClick(x, y, w, h, () => { if (isSel) act(); else select(); }); }

function inSafe() { return !!(game.inside && game.inside.safe); }

// ---------- Detalhes de uma arma (usado em várias telas) ----------
function weaponDetail(d, inst, x, y, w) {
  ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(x, y, w, 96, 8); ctx.fill();
  drawWeaponSide(d, x + w / 2, y + 48, Math.min(1.6, (w - 30) / 125));
  txt(inst ? instName(inst) : d.name, x, y + 122, 18, rarColor(d), "left", true, w);
  txt(`${RARITY[d.rar].name} · ${CAT_LABEL[d.cat]}${d.craftOnly ? " · feita na oficina" : ""}`, x, y + 141, 12, rarColor(d), "left", false, w);
  const st = wStat(inst || null), rows = [];
  if (!inst) { st.dmg = d.dmg; st.delay = d.delay; st.reload = (d.reload || 0) * (d.cat === "rifles" ? 1.15 : 1); st.range = d.range || 0; st.spread = d.spread || 0.03; }
  rows.push(["Dano", d.pellets ? `${Math.round(st.dmg)} x${d.pellets}` : `${Math.round(st.dmg)}`]);
  rows.push([d.melee ? "Golpes/s" : "Tiros/s", (1000 / st.delay).toFixed(1)]);
  if (d.melee) rows.push(["Alcance", `${Math.round(st.range)}`]);
  else if (d.infinite) { rows.push(["Munição", "infinita · pente de 600"]); rows.push(["Recarga", `${(st.reload / 1000).toFixed(2)} s`]); rows.push(["Crítico", "nunca"]); rows.push(["Precisão", `${Math.round(100 - st.spread * 250)}%`]); }
  else {
    rows.push(["Carregador", `${d.mag} · ${d.ammo}`]);
    rows.push(["Recarga", d.id === "caca"
      ? `${(st.reload / d.mag / 1000).toFixed(2)} s por munição`
      : `${(st.reload / 1000).toFixed(1)} s`]);
    rows.push(["Precisão", `${Math.round(100 - st.spread * 250)}%`]);
  }
  rows.push(["Ruído", d.sound === 0 ? "nenhum" : d.sound <= 0.1 ? "baixo" : d.sound < 1 ? "médio" : "alto"]);
  if (d.slow) rows.push(["Peso", `-${d.slow}% velocidade`]);
  if (d.lifesteal) rows.push(["Especial", `cura ${d.lifesteal * 100}% do dano`]);
  if (d.explode) rows.push(["Especial", d.grenade ? "granada explosiva" : "tiro explosivo"]);
  if (d.fire) rows.push(["Especial", "fogo atravessa zumbis"]);
  if (d.burn) rows.push(["Efeito", `queima (${d.burn} de dano/s)`]);
  if (d.bleed) rows.push(["Efeito", `${Math.round(d.bleed * 100)}% de sangramento`]);
  if (d.stun) rows.push(["Efeito", `${Math.round(d.stun * 100)}% de atordoar`]);
  if (d.crit) rows.push(["Efeito", `+${d.crit}% de crítico`]);
  if (d.knock) rows.push(["Efeito", "empurra os zumbis"]);
  const rh = rows.length > 9 ? 14 : 17;
  rows.forEach(([k, v], i) => { txt(k, x, y + 164 + i * rh, 12, "#a9a58f"); txt(v, x + w, y + 164 + i * rh, 12, k === "Efeito" || k === "Especial" ? "#ffb070" : "#e5e0c8", "right", true); });
  const ry = y + 168 + rows.length * rh;
  txt(`Exige: ${reqText(d)}`, x, ry, 12, canUse(d) ? "#6fae4f" : "#e05a4a", "left", true, w);
  if (inst) drawUpgradeValues(inst, x, ry + 14, w);
}
function drawUpgradeValues(inst, x, y, w) {
  UP_STATS.forEach((s, i) => txt(`${s.name} ${inst.up[s.id]}`, x, y + i * 20 + 11, 11, "#a9a58f", "left", false, w));
}

// =====================================================================
//  Item encontrado: aceitar ou não
// =====================================================================
function entryName(e) {
  switch (e.type) {
    case "cash": return `$${e.amt}`;
    case "food": return `${e.amt}x ${FOOD_Q[e.q || "comum"].name}`;
    case "anti": return `${e.amt} antibiótico${e.amt > 1 ? "s" : ""}`;
    case "water": return `${e.amt} garrafa${e.amt > 1 ? "s" : ""} de água`;
    case "med": return `${e.amt} kit${e.amt > 1 ? "s" : ""} médico${e.amt > 1 ? "s" : ""}`;
    case "ammo": return `${e.amt} balas ${e.ammo}`;
    case "weapon": return instName(e.inst);
    case "mat": return `${e.amt}x ${MATS[e.id].name}`;
    case "implant": return `implante ${implantName(e.im)}`;
    case "vest": return VESTS[e.idx].name;
    case "credit": return `${e.amt} crédito (sorte: 4 itens!)`;
  }
  return "?";
}
// coletes: guarda os que você tem e equipa o melhor automaticamente
function gainVest(idx, mcArmor = 0) {
  const had = save.vestsOwned[idx];
  if (!had) { save.vestUpgrades = save.vestUpgrades || {}; save.vestUpgrades[idx] = cleanVestUpgrade(null); }
  // Processador de Guerra: coletes Mastercraft encontrados já vêm com +6 de armadura.
  if (mcArmor > 0) {
    const up = save.vestUpgrades[idx] || cleanVestUpgrade(null);
    up.armor = Math.min(VEST_UP_MAX, (up.armor || 0) + mcArmor);
    save.vestUpgrades[idx] = up;
  }
  save.vestsOwned[idx] = true;
  if (save.vest < 0 || VESTS[idx].armor > VESTS[save.vest].armor) { save.vest = idx; recalcImplants(); toast(`${VESTS[idx].name} equipado`); }
  else toast(had ? `Você já tem ${VESTS[idx].name}` : `${VESTS[idx].name} guardado (troque na mochila com V)`);
  persist();
}
function cycleVest() {
  const owned = VESTS.map((v, i) => i).filter((i) => save.vestsOwned[i]);
  if (!owned.length) { toast("Você não tem coletes"); return; }
  const pos = owned.indexOf(save.vest);
  save.vest = pos < 0 ? owned[0] : pos + 1 < owned.length ? owned[pos + 1] : -1;
  recalcImplants(); persist();
  toast(save.vest >= 0 ? `Colete: ${VESTS[save.vest].name}` : "Sem colete");
}
function acceptFound() {
  const e = game.found[0];
  if (!e) return true;
  if (e.type === "cash") game.money += e.amt;
  else if (e.type === "food") addFood(e.q || "comum", e.amt);
  else if (e.type === "anti") player.anti += e.amt;
  else if (e.type === "water") player.water += e.amt;
  else if (e.type === "med") player.med += e.amt;
  else if (e.type === "ammo") {
    const got = addAmmo(e.ammo, e.amt);
    if (got < e.amt) { e.amt -= got; toast(got ? `Pegou ${got} balas · a mochila encheu (500 balas por espaço)` : "Mochila cheia: munição ocupa 1 espaço a cada 500 balas"); sfx.empty(); return false; }
  }
  else if (e.type === "weapon") {
    const r = addWeapon(e.inst);
    if (!r) { toast("Mochila cheia! Recuse o item ou abra espaço"); sfx.empty(); return false; }
    if (r === "slot" && !curInst()) player.cur = player.slots.indexOf(e.inst);
  } else if (e.type === "mat") {
    if (!addMat(e.id, e.amt)) { toast("Mochila cheia! Recuse o item ou abra espaço"); sfx.empty(); return false; }
  } else if (e.type === "implant") {
    if (player.bag.length >= BAG_MAX) { toast("Mochila de implantes cheia"); sfx.empty(); return false; }
    player.bag.push(e.im);
  } else if (e.type === "vest") gainVest(e.idx, e.mcArmor || 0);
  else if (e.type === "credit") { save.credits += e.amt; persist(); sfx.level(); }
  sfx.pickup();
  stat("itemsTaken");
  if (e.type === "weapon") { registerWeapon(e.inst.id); if (WDEF[e.inst.id].rar >= 4) stat("legendaries"); }
  game.found.shift();
  if (!game.found.length) finishFound();
  return true;
}
// comida, água, kit e antibiótico podem ser usados na hora (gasta 1; o resto continua oferecido)
function canUseFound(e) { return !!e && (e.type === "food" || e.type === "water" || e.type === "med" || e.type === "anti"); }
function useFound() {
  const e = game.found && game.found[0];
  if (!canUseFound(e)) return;
  if (e.type === "food") {
    if (player.hunger >= 100) { toast("Sem fome"); return; }
    const q = e.q || "comum";
    player.hunger = Math.min(100, player.hunger + FOOD_Q[q].hunger);
    if (q === "fresca") { player.hp = Math.min(player.maxHp, player.hp + 5); toast("Comida fresca! (+5 de vida)"); }
    else if (q === "podre") { if (Math.random() < 0.5) { addInfection(null, 2.5); toast("Estava estragada... a infecção subiu"); } else toast("Comida estragada (sacia pouco)"); }
    else toast("Você comeu");
    stat("foodEaten");
  } else if (e.type === "water") {
    if (player.thirst >= 100) { toast("Sem sede"); return; }
    player.thirst = Math.min(100, player.thirst + 40); toast("Você bebeu"); stat("foodEaten");
  } else if (e.type === "med") {
    if (player.hp >= player.maxHp) { toast("Vida cheia"); return; }
    player.hp = Math.min(player.maxHp, player.hp + 40 * (1 + profVal("med"))); toast("Você usou o kit médico");
  } else {
    if (!player.infect) { toast("Você não está infectado"); return; }
    player.infect = Math.max(0, player.infect - 60); player.infWarned = false; toast(`Antibiótico · infecção ${Math.round(player.infect)}%`);
  }
  sfx.pickup(); stat("itemsTaken");
  e.amt--;
  if (e.amt <= 0) { game.found.shift(); if (!game.found.length) finishFound(); }
}
// Loot recusado permanece como o mesmo item no chão por 10 segundos reais.
const GROUND_LOOT_LIFETIME = 10000;
function removeGroundDrop(drop) {
  if (!game.groundDrops) return;
  const i = game.groundDrops.indexOf(drop);
  if (i >= 0) game.groundDrops.splice(i, 1);
}
function finishFound() {
  if (game.foundDrop) removeGroundDrop(game.foundDrop);
  game.found = null; game.foundDrop = null; game.foundSpot = null;
}
function groundDropsTick(now = performance.now()) {
  if (!game.groundDrops) return;
  game.groundDrops = game.groundDrops.filter(d => d.expiresAt > now);
  if (game.foundDrop && game.foundDrop.expiresAt <= now) {
    game.found = null; game.foundDrop = null; game.foundSpot = null;
    if (game.menu === "pack") game.menu = null;
    toast("O item deixado no chão desapareceu.");
  }
}
function drawGroundDrops() {
  if (!game.groundDrops) return;
  const now = performance.now();
  for (const d of game.groundDrops) {
    if (d.expiresAt <= now ||
      d.inside !== (game.inside || null) ||
      (!d.inside && (d.cx !== world.cell.cx || d.cy !== world.cell.cy)) ||
      !inView(d.x - 40, d.y - 40, 80, 80)) continue;
    ctx.save();
    ctx.fillStyle = "rgba(20,19,11,0.82)";
    ctx.shadowColor = "#ffd334"; ctx.shadowBlur = 16;
    circle(d.x, d.y, 22);
    ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = "#ffd334";
    ctx.beginPath(); ctx.arc(d.x, d.y, 22, 0, Math.PI * 2); ctx.stroke();
    drawEntryIcon(d.entry, d.x, d.y - 4, 0.45);
    ctx.restore();
    hudT(Math.ceil((d.expiresAt - now) / 1000) + "s", d.x, d.y + 34, 12, "#ffe07e", "center", true);
  }
}
function declineFound() {
  if (!game.found || !game.found.length) return;
  const e = game.found.shift();
  // Se o jogador abriu o item recusado do chão, ele conserva o prazo original.
  if (!game.foundDrop) {
    const spot = game.foundSpot;
    const x = spot ? spot.x + spot.w / 2 : player.x;
    const y = spot ? spot.y + spot.h / 2 : player.y;
    if (!game.groundDrops) game.groundDrops = [];
    game.groundDrops.push({
      kind: "grounddrop", name: entryName(e), entry: e,
      x, y, w: 24, h: 24, inside: game.inside || null,
      cx: world.cell.cx, cy: world.cell.cy,
      expiresAt: performance.now() + GROUND_LOOT_LIFETIME
    });
    toast("Item recusado: 10 segundos para recolher no chão.");
  }
  if (!game.found.length) {
    game.found = null; game.foundDrop = null; game.foundSpot = null;
  }
}
function takeAllFound() { while (game.found && acceptFound()); }
function openPackFromFound() {
  if (!game.found) return;
  game.menu = "pack";
  mouse.down = false;
}
function foundKey(k) {
  if (k === "enter" || k === "e" || k === "y" || k === "s") acceptFound();
  else if (k === "c" && canUseFound(game.found[0])) useFound();
  else if (k === "n" || k === "escape" || k === "q") declineFound();
  else if (k === "t") takeAllFound();
  else if (k === "b" && game.found[0]) openPackFromFound();
}
function drawFound() {
  const e = game.found[0];
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, H);
  const x = 200, y = 95, w = 560, h = 400, wd = e.type === "weapon" ? WDEF[e.inst.id] : null;
  ctx.fillStyle = "rgba(62,22,18,0.94)"; rr(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = wd && wd.rar >= 2 ? rarColor(wd) : "#a04a3a"; ctx.lineWidth = wd && wd.rar >= 3 ? 3 : 2; ctx.stroke();
  if (wd && wd.rar >= 2) {
    const g = ctx.createRadialGradient(W / 2, y + 134, 10, W / 2, y + 134, 190);
    g.addColorStop(0, rarColor(wd) + "55"); g.addColorStop(1, rarColor(wd) + "00");
    ctx.fillStyle = g; ctx.fillRect(x + 120, y + 74, 320, 120);
  }
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x + 1, y + 1, w - 2, 30);
  txt("ITEM ENCONTRADO", W / 2, y + 21, 14, "#e8c0a0", "center", true);
  txt(`em: ${game.foundSrc}`, x + w - 14, y + 21, 11, "rgba(232,192,160,0.6)", "right");
  txt(`Você encontrou ${entryName(e)}. Quer pegar?`, W / 2, y + 58, 17, "#f2eedc", "center", true, w - 40);
  ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(x + 120, y + 74, 320, 120, 8); ctx.fill();
  const pulse = 1 + Math.sin(performance.now() / 300) * 0.03;
  if (e.type === "weapon") drawWeaponSide(WDEF[e.inst.id], W / 2, y + 134, 2.1 * pulse);
  else drawEntryIcon(e, W / 2, y + 134, 1.8 * pulse);
  if (e.type === "weapon") {
    const d = WDEF[e.inst.id];
    txt(RARITY[d.rar].name.toUpperCase(), x + 132, y + 92, 12, rarColor(d), "left", true);
    txt(`${CAT_LABEL[d.cat]} · dano ${d.dmg}${d.pellets ? ` x${d.pellets}` : ""} · ${d.melee ? "sem munição" : d.infinite ? "munição infinita" : `${d.mag} balas ${d.ammo}`}${d.burn ? " · fogo" : ""}${d.bleed ? " · sangramento" : ""}${d.stun ? " · choque" : ""}`, W / 2, y + 216, 13, "#d8c8b0", "center", false, w - 30);
    txt(`Exige: ${reqText(d)}`, W / 2, y + 234, 12, canUse(d) ? "#8fd08a" : "#ff8a6a", "center", true);
    if (upSum(e.inst)) txt(`Já vem melhorada: Precisão ${e.inst.up.acc} · Dano ${e.inst.up.dmg} · Recarga ${e.inst.up.rel}`, W / 2, y + 252, 12, "#ffd96a", "center");
  } else if (e.type === "mat") txt("Material usado na oficina dos postos para criar e melhorar armas", W / 2, y + 222, 12, "#d8c8b0", "center");
  else if (e.type === "implant") { txt(implantDesc(e.im), W / 2, y + 222, 12, "#d8c8b0", "center", false, w - 40); if (e.dead) txt("★ EXCLUSIVO DA ZONA MORTA", W / 2, y + 242, 12, "#ffd96a", "center", true); }
  else if (e.type === "food") txt(e.q === "fresca" ? "Comida fresca: sacia muito e recupera um pouco de vida" : e.q === "podre" ? "Comida estragada: sacia pouco e pode aumentar a infecção" : "Comida enlatada comum", W / 2, y + 222, 12, FOOD_Q[e.q || "comum"].color, "center", true);
  else if (e.type === "anti") txt("Antibiótico guardado para futura atualização de infecção", W / 2, y + 222, 12, "#8fd0ff", "center", true);
  else if (e.type === "ammo") txt(`A munição ocupa a mochila: 1 espaço a cada ${AMMO_STACK} balas de cada tipo`, W / 2, y + 222, 12, "#d8c8b0", "center");
  const usable = canUseFound(e);
  if (usable) {
    btn(x + 30, y + 266, 130, 42, "SIM", acceptFound, true);
    btn(x + 170, y + 266, 130, 42, "USAR AGORA", useFound, true);
    btn(x + 310, y + 266, 130, 42, "NÃO", declineFound);
  } else {
    btn(x + 110, y + 266, 150, 42, "SIM", acceptFound, true);
    btn(x + 300, y + 266, 150, 42, "NÃO", declineFound);
  }
  btn(x + 130, y + 318, 300, 36, "ABRIR MOCHILA (B)", openPackFromFound, true);
  const more = game.found.length - 1;
  txt(`Enter/E: pegar${usable ? " · C: usar" : ""} · N/Esc: recusar (10s) · B: mochila${more ? " · T: tudo" : ""}`,
    W / 2, y + h - 14, 12, "rgba(232,192,160,0.7)", "center");
  if (more) btn(x + w - 100, y + 274, 86, 28, "Tudo", takeAllFound);
  if (game.msgT > 0) txt(game.msg, W / 2, y + h + 26, 15, "#ffd96a", "center", true);
}

// =====================================================================
//  Pausa (Esc)
// =====================================================================
// ---------- Configurações: áudio ambiente e exposição visual ----------
function pauseSettingSlider(label, field, x, y, w, min, max, suffix) {
  const val = Math.max(min, Math.min(max, Number(save[field]) || 0));
  const t = (val - min) / (max - min), line = y + 29;
  txt(label, x, y + 8, 19, "#eee0b9", "left", true);
  txt(suffix === "percent" ? `${Math.round(val * 100)}%` : String(Math.round(val)), x + w, y + 8, 17, "#ffd36c", "right", true);
  ctx.fillStyle = "rgba(19,19,18,.9)";rr(x, line - 5, w, 12, 5);ctx.fill();
  ctx.fillStyle = "#b99544";rr(x, line - 3, w * t, 8, 4);ctx.fill();
  ctx.fillStyle = "#fff4be";circle(x + w * t, line + 1, 9);
  ctx.strokeStyle = "#a68035";ctx.lineWidth = 2;
  ctx.beginPath();ctx.arc(x + w * t,line + 1,9,0,6.283);ctx.stroke();
  regClick(x - 12, line - 18, w + 24, 38, () => {
    game.settingsDrag = {field,x,w,min,max};
    pauseSettingsDrag(mouse.x);
  });
}
function pauseSettingsDrag(x) {
  const d = game.settingsDrag;
  if (!d || !game.settingsOpen) return;
  save[d.field] = Math.round((d.min + Math.max(0, Math.min(1, (x - d.x) / d.w)) * (d.max-d.min)) * 100) / 100;
  if (d.field === "ambientVolume") {
    fmAmbientSetVolume();
    // Permite reativar o ambiente após subir o volume de zero.
    if (save.ambientVolume > 0 && SND.ac) fmAmbientStart();
  }
  persist();
}
function drawPauseSettings() {
  ctx.fillStyle = "rgba(6,8,7,.96)";ctx.fillRect(0,0,W,H);
  txt("ÁUDIO E VÍDEO", W/2, 90, 41, "#e7d5a8", "center", true);
  txt("Configurações pessoais salvas automaticamente", W/2, 123, 13, "#9d9a8b", "center");
  const x=260, w=440;
  pauseSettingSlider("Volume do som ambiente", "ambientVolume", x, 180, w, 0, 1, "percent");
  txt("Trilha de fundo do arquivo Ambiente sond · independente da música", W/2, 245, 13, "#b1a99a", "center");
  pauseSettingSlider("Brilho da imagem", "brightness", x, 293, w, .55, 1.6, "percent");
  txt("Ajusta a luminosidade do cenário sem clarear o HUD ou os menus", W/2, 355, 13, "#b1a99a", "center");
  btn(225,403,240,38,`Efeitos sonoros: ${SND.muted?"desligados":"ligados"}`,()=>{sndMute(!SND.muted);save.muted=SND.muted;persist();});
  btn(500,403,240,38,`Música dinâmica: ${save.music?"ligada":"desligada"}`,()=>{save.music=!save.music;musicSetOn(save.music);persist();});
  btn(W/2-130,465,260,42,"Voltar (Esc)",()=>{game.settingsOpen=false;game.settingsDrag=null;},true);
  txt("Aperte o botão e arraste para regular cada opção",W/2,H-44,13,"#b1a99a","center");
}
function applyGameBrightness() {
  const value = Math.max(.55,Math.min(1.6,Number(save.brightness)||1));
  if (Math.abs(value-1)<.01) return;
  ctx.save();ctx.setTransform(DPR,0,0,DPR,0,0);
  if (value>1) {
    ctx.globalCompositeOperation="screen";
    ctx.fillStyle=`rgba(255,238,205,${Math.min(.35,(value-1)*.48)})`;
  } else {
    ctx.globalCompositeOperation="source-over";
    ctx.fillStyle=`rgba(6,7,10,${Math.min(.54,(1-value)*.86)})`;
  }
  ctx.fillRect(0,0,W,H);ctx.restore();
}
function togglePause() {
  game.paused = !game.paused;
  if (!game.paused) { game.settingsOpen = false; game.settingsDrag = null; }
  mouse.down = false;
}
function drawPause() {
  if (game.settingsOpen) { drawPauseSettings(); return; }
  ctx.fillStyle = "rgba(6,7,5,0.82)"; ctx.fillRect(0, 0, W, H);
  txt("PAUSADO", W / 2, 100, 46, "#f2eedc", "center", true);
  txt(`${playerName()}${prof() ? ` · ${prof().name}` : ""}`, W / 2, 124, 14, "#ffd96a", "center", true);
  btn(W / 2 - 280, 290, 160, 34, "Amigos (U)", openFriends);
  btn(W / 2 - 280, 334, 160, 34, "Mensagens (I)" + (inboxUnread() ? " · " + inboxUnread() : ""), openMessages);
  btn(W / 2 - 280, 170, 160, 42, "Salvar progresso", manualSave);
  txt("Boneco: novo", W / 2 - 200, 113, 16, "#e5e0c8", "center", true);
  const ago = game.lastSave ? Math.round((performance.now() - game.lastSave) / 1000) : null;
  txt(ago == null ? "ainda não salvou nesta sessão" : ago < 3 ? "salvo agora!" : `último checkpoint: há ${ago < 60 ? `${ago}s` : `${Math.floor(ago / 60)} min`}`, W / 2 - 200, 164, 10, ago != null && ago < 3 ? "#8fe08a" : "rgba(229,224,200,0.55)", "center");
  btn(W / 2 - 130, 518, 260, 42, NATIVE ? "Salvar e sair do jogo" : "Salvar e sair", saveAndQuit, true);
  txt(`${clockText()} · Área ${world.cell.code} (${REGIONS[world.cell.tier].name}) · $${econ().bounty} por abate · ${game.kills} abates`, W / 2, 140, 14, "#a9a58f", "center");
  btn(W / 2 - 110, 170, 220, 42, "Continuar (Esc)", togglePause, true);
  btn(W / 2 - 110, 220, 220, 38, `Som: ${SND.muted ? "desligado" : "ligado"}`, () => { sndMute(!SND.muted); save.muted = SND.muted; persist(); });
  btn(W / 2 - 110, 266, 220, 38, "Áudio, ambiente e brilho", () => { game.settingsOpen = true; game.settingsDrag = null; });
  btn(W / 2 + 120, 220, 150, 38, `Música: ${save.music ? "ligada" : "desligada"}`, () => { save.music = !save.music; musicSetOn(save.music); persist(); });
  btn(W / 2 + 120, 266, 150, 38, "Objetivos (O)", () => { game.paused = false; game.menu = "obj"; });
  btn(W / 2 + 120, 170, 150, 42, "Missões", () => { game.paused = false; game.menu = "missions"; game.cur = 0; game.atBase = inSafe(); }, true);
  // missões ativas direto na pausa
  const mx = 640, my = 330;
  txt(`MISSÕES ATIVAS (${save.missions.length}/3)`, mx, my, 12, "#ffd96a", "left", true);
  if (!save.missions.length) txt("Nenhuma. Pegue missões no quadro de um posto seguro.", mx, my + 22, 12, "#a9a58f", "left", false, 290);
  save.missions.forEach((m, i) => {
    const done = m.progress >= m.target, y = my + 14 + i * 50;
    ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(mx, y, 290, 44, 6); ctx.fill();
    if (done) { ctx.strokeStyle = "#6fae4f"; ctx.lineWidth = 1.5; ctx.stroke(); }
    txt(missionText(m), mx + 8, y + 18, 12, done ? "#6fae4f" : "#e5e0c8", "left", true, 274);
    const f = Math.min(1, m.progress / m.target);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(mx + 8, y + 28, 150, 6);
    ctx.fillStyle = done ? "#6fae4f" : "#ffd96a"; ctx.fillRect(mx + 8, y + 28, 150 * f, 6);
    txt(done ? "entregar no posto" : `${Math.min(m.progress, m.target)}/${m.target}`, mx + 282, y + 35, 10, done ? "#6fae4f" : "#a9a58f", "right", true);
  });
  btn(W / 2 - 280, 220, 160, 38, `Gráficos: ${(GFX_Q[save.gfx] || "").split(" ")[0]}`, () => gfxSetQuality(((save.gfx || 0) + 2) % 3));
  txt(GFX.on ? (save.gfx >= 2 ? "luz, sombras, brilho e clima" : "luz, sombras e clima, sem brilho") : GFX.failed ? "WebGL indisponível neste PC" : "modo antigo, mais leve", W / 2 - 200, 274, 11, "rgba(229,224,200,0.55)", "center");
  txt("Créditos: armas extras do pacote \"2D Guns\" de Kay Lousberg (OpenGameArt.org, CC0)", W / 2, H - 14, 11, "rgba(229,224,200,0.45)", "center");
  const ctl = [["WASD", "andar"], ["Shift", "correr"], ["Mouse", "mirar e atacar"], ["1 2 3 / roda", "trocar arma"], ["R", "recarregar"], ["E", "vasculhar, entrar, usar"],
    ["B", "mochila"], ["F G H", "comer, beber, kit"], ["C", "atributos e personagem"], ["M", "mapa do setor"], ["N", "mapa da cidade"], ["O", "objetivos"], ["Esc", "pausa e missões"], ["J", "música"], ["K", "som"], ["U", "amigos e jogadores"], ["I", "mensagens"]];
  ctl.forEach(([k, v], i) => {
    const cx = i < 8 ? 150 : 410, cy = 340 + (i % 8) * 22;
    txt(k, cx, cy, 13, "#ffd96a", "right", true); txt(v, cx + 12, cy, 13, "#c9c4ad");
  });
}

// =====================================================================
//  Mochila (B): 3 armas equipadas + 20 espaços
// =====================================================================
const PACK_COLS = 5;
function packSel() { game.inv = game.inv || { sel: 0 }; return game.inv; }
function selItem(s) { return s < SLOT_N ? player.slots[s] : player.pack[s - SLOT_N]; }
function packMove(dx, dy) {
  const inv = packSel(); let s = inv.sel;
  if (s < SLOT_N) {
    if (dx) s = clamp(s + dx, 0, SLOT_N - 1);
    if (dy > 0) s = SLOT_N + Math.min(PACK_COLS - 1, Math.round(s * 2));
  } else {
    const i = s - SLOT_N, col = i % PACK_COLS, row = Math.floor(i / PACK_COLS);
    if (dx) s = SLOT_N + row * PACK_COLS + clamp(col + dx, 0, PACK_COLS - 1);
    if (dy < 0) s = row === 0 ? Math.min(SLOT_N - 1, Math.round(col / 2)) : s - PACK_COLS;
    if (dy > 0 && row < PACK_MAX / PACK_COLS - 1) s += PACK_COLS;
  }
  inv.sel = s;
}
function equipTo(slot) {
  const inv = packSel(), it = selItem(inv.sel);
  if (!it || it.kind !== "weapon") return;
  if (inv.sel < SLOT_N) { // troca a ordem dos slots
    const t = player.slots[slot]; player.slots[slot] = it; player.slots[inv.sel] = t; inv.sel = slot;
  } else {
    const pi = inv.sel - SLOT_N, old = player.slots[slot];
    player.slots[slot] = it;
    if (old) player.pack[pi] = old; else player.pack.splice(pi, 1);
    toast(`${instName(it)} equipada no slot ${slot + 1}`);
  }
  player.reloading = 0;
}
function packAct() {
  const inv = packSel(), it = selItem(inv.sel);
  if (!it) return;
  if (inv.sel < SLOT_N) {
    if (packUsed() >= PACK_MAX) { toast("Mochila cheia"); return; }
    player.pack.push(it); player.slots[inv.sel] = null; player.reloading = 0;
    toast(`${instName(it)} guardada na mochila`);
  } else if (it.kind === "weapon") {
    const e = player.slots.indexOf(null);
    equipTo(e >= 0 ? e : player.cur);
  } else if (it.id === "trindade_eterna") INV.confirm = { trindade: true, name: "Trindade · 100 anos" };
  else if (it.id === "reset_stats") toast("Arraste o cartão até o personagem para resetar os atributos.");
  else toast(MATS[it.id].cashProtection ? safeDescription(it.id) + " Basta carregar na mochila." : "Materiais ficam na mochila até você usar na oficina");
}
function packDiscard() {
  const inv = packSel(), it = selItem(inv.sel);
  if (!it) return;
  if (inv.sel < SLOT_N) player.slots[inv.sel] = null; else player.pack.splice(inv.sel - SLOT_N, 1);
  player.reloading = 0;
  toast(`Descartou ${it.kind === "weapon" ? instName(it) : `${it.qty}x ${MATS[it.id].name}`}`);
}
function packKey(k) {
  if (k === "a" || k === "arrowleft") packMove(-1, 0);
  else if (k === "d" || k === "arrowright") packMove(1, 0);
  else if (k === "w" || k === "arrowup") packMove(0, -1);
  else if (k === "s" || k === "arrowdown") packMove(0, 1);
  else if (k === "enter") packAct();
  else if (k === "x" || k === "delete") packDiscard();
  else if (k === "v") cycleVest();
  else if (k === "1" || k === "2" || k === "3") equipTo(parseInt(k, 10) - 1);
}
function drawItemCell(it, x, y, w, h, sel, label) {
  ctx.fillStyle = sel ? "#2f2d24" : "rgba(26,26,21,0.95)"; rr(x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = sel ? "#ffd96a" : "#3d3b30"; ctx.lineWidth = sel ? 2 : 1; ctx.stroke();
  if (label) txt(label, x + 6, y + 13, 10, "#a9a58f", "left", true);
  if (!it) return;
  if (it.kind === "weapon") {
    const d = WDEF[it.id];
    if (d.rar >= 1) { ctx.strokeStyle = rarColor(d); ctx.globalAlpha = sel ? 1 : 0.55; ctx.lineWidth = 1.5; rr(x + 2, y + 2, w - 4, h - 4, 5); ctx.stroke(); ctx.globalAlpha = 1; }
    drawWeaponSide(d, x + w / 2, y + h / 2 - 4, Math.min(0.55, (w - 12) / 125));
    txt(d.short || d.name, x + w / 2, y + h - 8, 10, !canUse(d) ? "#e07b5a" : rarColor(d), "center", true, w - 8);
    const s = upSum(it);
    if (s) txt(`+${s}`, x + w - 6, y + 13, 10, "#ffd96a", "right", true);
  } else {
    drawMatIcon(it.id, x + w / 2, y + h / 2 - 6, 0.6);
    txt(`${it.qty}x`, x + w - 6, y + 13, 10, "#ffd96a", "right", true);
    txt(MATS[it.id].name, x + w / 2, y + h - 8, 9, "#e5e0c8", "center", false, w - 8);
  }
}
function drawAmmoCell(st, x, y, w, h) {
  ctx.fillStyle = "#1e1d16"; rr(x, y, w, h, 5); ctx.fill();
  ctx.strokeStyle = "#5a4a2a"; ctx.lineWidth = 1; ctx.stroke();
  drawEntryIcon({ type: "ammo", ammo: st.t }, x + w / 2, y + 26, 0.55);
  txt(`${st.n} balas`, x + w / 2, y + h - 6, 11, "#e0d8a0", "center", true);
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x + 6, y + h - 22, w - 12, 3);
  ctx.fillStyle = "#c9a040"; ctx.fillRect(x + 6, y + h - 22, (w - 12) * (st.n / AMMO_STACK), 3);
}
function drawPack() {
  const inv = packSel();
  menuFrame("Mochila", `Armas equipadas: ${player.slots.filter(Boolean).length}/${SLOT_N}  ·  Mochila: ${packUsed()}/${PACK_MAX}  ·  $${game.money}`);
  for (let i = 0; i < SLOT_N; i++) {
    const x = 40 + i * 182, y = 92;
    drawItemCell(player.slots[i], x, y, 174, 92, inv.sel === i, `SLOT ${i + 1}${player.cur === i ? " · NA MÃO" : ""}`);
    rowClick(x, y, 174, 92, inv.sel === i, () => { inv.sel = i; }, packAct);
  }
  txt("Mochila", 40, 204, 13, "#e5e0c8", "left", true);
  txt(`munição: 1 espaço a cada ${AMMO_STACK} balas`, 580, 204, 10, "#a9a58f", "right");
  const stacks = [];
  for (const t of Object.keys(AMMO)) { let r = player.reserve[t] || 0; while (r > 0) { stacks.push({ t, n: Math.min(AMMO_STACK, r) }); r -= AMMO_STACK; } }
  for (let i = 0; i < PACK_MAX; i++) {
    const x = 40 + (i % PACK_COLS) * 108, y = 212 + Math.floor(i / PACK_COLS) * 72, s = SLOT_N + i;
    if (i >= player.pack.length && i < player.pack.length + stacks.length) { drawAmmoCell(stacks[i - player.pack.length], x, y, 104, 68); continue; }
    drawItemCell(player.pack[i], x, y, 104, 68, inv.sel === s);
    rowClick(x, y, 104, 68, inv.sel === s, () => { inv.sel = s; }, packAct);
  }
  const it = selItem(inv.sel), px = 600, pw = 320;
  ctx.fillStyle = "rgba(0,0,0,0.25)"; rr(px - 10, 92, pw + 20, 410, 8); ctx.fill();
  if (it && it.kind === "weapon") weaponDetail(WDEF[it.id], it, px, 100, pw);
  else if (it) {
    drawMatIcon(it.id, px + pw / 2, 160, 1.6);
    txt(MATS[it.id].name, px, 250, 18, "#f2eedc", "left", true);
    txt(`Quantidade: ${it.qty}`, px, 274, 13, "#c9c4ad");
    txt(MATS[it.id].cashProtection ? safeDescription(it.id) : "Usado na oficina dos postos para criar", px, 300, 12, "#a9a58f", "left", false, pw);
    txt(MATS[it.id].cashProtection ? "Na mochila; vale o maior cofre. Reutilizável." : "armas especiais e melhorar as suas.", px, 316, 12, "#a9a58f", "left", false, pw);
  } else txt("Espaço vazio", px + pw / 2, 280, 15, "#6d6a58", "center");
  const ammoTxt = Object.keys(AMMO).filter((t) => player.reserve[t] > 0).map((t) => `${t}: ${player.reserve[t]}`).join(" · ") || "sem munição de reserva";
  const Q = player.foodQ;
  txt(`Comida ${player.food} (fresca ${Q.fresca} · comum ${Q.comum} · estragada ${Q.podre}) · Água ${player.water} · Kit ${player.med} · Antibiótico ${player.anti} · Implantes ${player.bag.length}/${BAG_MAX}`, 40, 518, 12, "#c9c4ad", "left", true, 540);
  // colete equipado (V troca entre os que você tem)
  const nv = save.vestsOwned.filter(Boolean).length;
  ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(590, 508, 340, 42, 6); ctx.fill();
  if (save.vest >= 0) { drawVestIcon(save.vest, 614, 529, 0.62); txt(`${VESTS[save.vest].name} · ${Math.round(vestDur())}%`, 640, 525, 13, vestDur() <= 25 ? "#e05a4a" : RARITY[VESTS[save.vest].rar].color, "left", true, 220); txt(vestText(VESTS[save.vest]), 640, 542, 10, "#a9a58f", "left", false, 280); }
  else txt("Sem colete", 604, 534, 13, "#6d6a58", "left", true);
  txt(`V: trocar (${nv})`, 922, 524, 10, "#ffd96a", "right", true);
  regClick(590, 508, 340, 42, cycleVest);
  txt(`Munição: ${ammoTxt}`, 40, 538, 12, "#a9a58f", "left", false, 880);
  hint("Setas/WASD escolhem · Enter equipa ou guarda · 1 2 3 põe no slot · X descarta · V troca colete · B ou Esc fecha");
}

// =====================================================================
//  Baú da base: guarda armas e materiais para sempre
// =====================================================================
function myList() {
  const out = [];
  player.slots.forEach((it, i) => { if (it) out.push({ it, where: "slot", i }); });
  player.pack.forEach((it, i) => out.push({ it, where: "pack", i }));
  return out;
}
function vaultMove() {
  if (game.vside === 0) {
    const e = myList()[game.vcur];
    if (!e) return;
    if (e.it.kind === "mat") { if (!addMat(e.it.id, e.it.qty, save.vault, VAULT_MAX)) { toast("Baú cheio"); return; } }
    else { if (save.vault.length >= VAULT_MAX) { toast("Baú cheio"); return; } save.vault.push(e.it); }
    if (e.where === "slot") player.slots[e.i] = null; else player.pack.splice(e.i, 1);
    player.reloading = 0;
    toast(`Guardou no baú: ${e.it.kind === "weapon" ? instName(e.it) : MATS[e.it.id].name}`);
    game.vcur = Math.max(0, Math.min(game.vcur, myList().length - 1));
  } else {
    const it = save.vault[game.vcur];
    if (!it) return;
    if (it.kind === "weapon") { if (!addWeapon(it)) { toast("Mochila cheia"); return; } }
    else if (!addMat(it.id, it.qty)) { toast("Mochila cheia"); return; }
    save.vault.splice(game.vcur, 1);
    toast(`Pegou do baú: ${it.kind === "weapon" ? instName(it) : MATS[it.id].name}`);
    game.vcur = Math.max(0, Math.min(game.vcur, save.vault.length - 1));
  }
  save.run = runSnapshot();
  persist();
}
function stashKey(k) {
  const len = game.vside === 0 ? myList().length : save.vault.length;
  if (k === "tab" || k === "a" || k === "d" || k === "arrowleft" || k === "arrowright") { game.vside ^= 1; game.vcur = 0; }
  else if (k === "w" || k === "arrowup") game.vcur = Math.max(0, game.vcur - 1);
  else if (k === "s" || k === "arrowdown") game.vcur = Math.max(0, Math.min(len - 1, game.vcur + 1));
  else if (k === "enter") vaultMove();
}
function drawListItem(it, x, y, w, sel, sub) {
  rowBox(x, y, w, 34, sel);
  if (it.kind === "weapon") { drawWeaponSide(WDEF[it.id], x + 34, y + 17, 0.22); txt(instName(it), x + 70, y + 22, 13, canUse(WDEF[it.id]) ? rarColor(WDEF[it.id]) : "#e07b5a", "left", true, w - 160); }
  else { drawMatIcon(it.id, x + 34, y + 17, 0.4); txt(`${it.qty}x ${MATS[it.id].name}`, x + 70, y + 22, 13, "#e5e0c8", "left", true, w - 160); }
  if (sub) txt(sub, x + w - 10, y + 22, 11, "#a9a58f", "right");
}
function drawStash() {
  game.vside = game.vside || 0; game.vcur = game.vcur || 0;
  menuFrame("Baú da base", "Armas e itens são preservados ao morrer. Cofres só protegem dinheiro quando estão na mochila.");
  const mine = myList(), cols = [[mine.map((e) => ({ it: e.it, sub: e.where === "slot" ? `slot ${e.i + 1}` : "mochila" })), `Com você (${packUsed()}/${PACK_MAX} na mochila)`],
    [save.vault.map((it) => ({ it, sub: "" })), `Baú (${save.vault.length}/${VAULT_MAX})`]];
  cols.forEach(([list, title], side) => {
    const x = side === 0 ? 40 : 490, w = 430, act = game.vside === side;
    txt(title, x, 100, 14, act ? "#ffd96a" : "#a9a58f", "left", true);
    const vis = 11, off = act ? Math.max(0, Math.min(list.length - vis, game.vcur - 5)) : 0;
    list.slice(off, off + vis).forEach((e, j) => {
      const i = off + j, y = 110 + j * 38, sel = act && game.vcur === i;
      drawListItem(e.it, x, y, w, sel, e.sub);
      rowClick(x, y, w, 34, sel, () => { game.vside = side; game.vcur = i; }, vaultMove);
    });
    if (!list.length) txt("vazio", x + w / 2, 140, 14, "#6d6a58", "center");
  });
  hint("W/S escolhe · A/D ou Tab troca de lado · Enter move o item · clique 2x para mover · E ou Esc fecha");
}

// =====================================================================
//  Loja dos postos
// =====================================================================
const SHOP_TABS = ["Munição"];
const AMMO_PACK_SIZE = 999, AMMO_PACK_PRICE = 14000;
const CAT_ORDER = { pistols: 0, machinegun: 1, shotguns: 2, rifles: 3, melee: 4 };
const SHOP_WEAPONS = WLIST.filter((d) => d.rar <= 3 && !d.craftOnly && !d.fists && d.price > 0).sort((a, b) => CAT_ORDER[a.cat] - CAT_ORDER[b.cat] || a.price - b.price);
function shopList() { return Object.keys(AMMO); }
function openShop() {
  if (!inSafe() && !adm.shopAnywhere) { toast("A loja de munições fica na base."); return; }
  game.shop = true; game.shopTab = 0; game.shopCur = 0;
}
function shopBuy() {
  const type = shopList()[game.shopCur | 0];
  if (!type) return;
  if (game.money < AMMO_PACK_PRICE) { toast("Você precisa de $14.000 para comprar munições."); return; }
  if (ammoRoom(type) < AMMO_PACK_SIZE) { toast("Espaço insuficiente para 999 munições na mochila."); return; }
  game.money -= AMMO_PACK_PRICE;
  player.reserve[type] = (player.reserve[type] || 0) + AMMO_PACK_SIZE;
  sfx.buy();
  checkpoint("compra de pacote de munição");
  toast("Comprou 999 munições " + type + " por $14.000");
}
function vestText(v) {
  const up = vestUpgrade(VESTS.indexOf(v));
  return `-${v.armor + up.armor}% dano${up.speed ? ` · +${up.speed}% velocidade` : ""}${v.slow ? ` · -${v.slow}% velocidade` : ""}${v.hp ? ` · +${v.hp} vida` : ""}${v.acid ? ` · -${v.acid}% ácido` : ""}${v.stealth ? ` · +${v.stealth}% furtividade` : ""}`;
}
function buyVest(i) {
  const v = VESTS[i];
  if (save.vestsOwned[i]) { save.vest = i; recalcImplants(); persist(); toast(`${v.name} equipado`); return; }
  if (v.craft) { toast("Esse colete só pode ser criado na oficina"); return; }
  if (v.credits) {
    if (save.credits < v.credits) { toast(`Precisa de ${v.credits} créditos (compre no banco)`); return; }
    save.credits -= v.credits;
  } else {
    if (game.money < v.price) { toast("Dinheiro insuficiente"); return; }
    game.money -= v.price;
  }
  sfx.buy(); gainVest(i); save.vest = i; recalcImplants(); persist();
}
function shopKey(k) {
  if (k === "b" || k === "escape" || k === "e") { game.shop = false; return; }
  const len = shopList().length;
  if (k === "w" || k === "arrowup") game.shopCur = Math.max(0, game.shopCur - 1);
  else if (k === "s" || k === "arrowdown") game.shopCur = Math.min(len - 1, game.shopCur + 1);
  else if (k === "enter") shopBuy();
}
function drawShop() {
  menuFrame("Loja de Munições", "Dinheiro: $" + game.money.toLocaleString("pt-BR") + " · Cada pacote: 999 munições por $14.000");
  const list = shopList();
  const selected = Math.min(list.length - 1, Math.max(0, game.shopCur | 0));
  game.shopCur = selected;
  list.forEach((type, i) => {
    const y = 110 + i * 42;
    if (y > 480) return;
    rowBox(40, y, 520, 38, selected === i);
    drawEntryIcon({ type: "ammo", ammo: type }, 76, y + 20, 0.5);
    txt(type + " · 999 unidades", 124, y + 18, 15, "#f2eedc", "left", true);
    txt("Você tem: " + (player.reserve[type] || 0), 124, y + 33, 11, "#a9a58f");
    txt("$14.000", 544, y + 25, 14, game.money >= AMMO_PACK_PRICE ? "#6fae4f" : "#e05a4a", "right", true);
    rowClick(40, y, 520, 38, selected === i, () => { game.shopCur = i; }, shopBuy);
  });
  const type = list[selected], px = 600;
  ctx.fillStyle = "rgba(0,0,0,.35)"; rr(px - 10, 100, 326, 380, 8); ctx.fill();
  if (type) {
    drawEntryIcon({ type: "ammo", ammo: type }, 760, 188, 1.6);
    txt("Munição " + type, px, 286, 20, "#f2eedc", "left", true);
    txt("Pacote com 999 unidades", px, 316, 15, "#ffd96a");
    txt("Preço: $14.000", px, 344, 15, "#6fae4f", "left", true);
    txt("Espaço necessário na mochila", px, 369, 12, "#a9a58f");
    btn(px + 60, 422, 200, 42, "Comprar (Enter)", shopBuy, true);
  }
  hint("W/S escolhe calibre · Enter compra · B, E ou Esc fecha");
  menuToast();
}

// =====================================================================
//  Personagem (aba do menu C): escolher a aparência
// =====================================================================
function pickSkin(i) {
  const s = SKINS[i];
  if (player.level < s.lvl && !adm.noReq) { toast(`${s.name} libera no nível ${s.lvl}`); return; }
  save.skin = i; persist(); toast(`Agora você é: ${s.name}`);
}
function skinsKey(k) {
  game.skc = game.skc == null ? save.skin : game.skc;
  if (k === "a" || k === "arrowleft") game.skc = (game.skc + SKINS.length - 1) % SKINS.length;
  else if (k === "d" || k === "arrowright") game.skc = (game.skc + 1) % SKINS.length;
  else if (k === "enter") pickSkin(game.skc);
}
function drawSkins() {
  game.skc = game.skc == null ? save.skin : game.skc;
  SKINS.forEach((s, i) => {
    const x = 40 + i * 98, y = 100, w = 92, h = 200, sel = game.skc === i, lock = player.level < s.lvl && !adm.noReq;
    rowBox(x, y, w, h, sel, save.skin === i ? "#6fae4f" : null);
    rowClick(x, y, w, h, sel, () => { game.skc = i; }, () => pickSkin(i));
    if (lock) ctx.globalAlpha = 0.35;
    if (!drawSpr(s.spr, x + w / 2, y + 92, w - 10, 170)) txt("?", x + w / 2, y + 100, 30, "#6d6a58", "center", true);
    ctx.globalAlpha = 1;
    txt(s.name, x + w / 2, y + h - 10, 11, sel ? "#ffd96a" : "#e5e0c8", "center", true, w - 6);
    if (lock) txt(`nível ${s.lvl}`, x + w / 2, y + 100, 13, "#e05a4a", "center", true);
    if (save.skin === i) txt("✔", x + w - 10, y + 16, 14, "#6fae4f", "right", true);
  });
  const s = SKINS[game.skc];
  ctx.fillStyle = "rgba(0,0,0,0.3)"; rr(40, 320, 880, 190, 8); ctx.fill();
  drawSpr(s.spr, 140, 415, 160, 180);
  txt(s.name, 250, 360, 24, "#f2eedc", "left", true);
  txt(player.level >= s.lvl ? "Disponível" : `Libera no nível ${s.lvl}`, 250, 386, 14, player.level >= s.lvl ? "#6fae4f" : "#e05a4a", "left", true);
  txt("A aparência muda o boneco no mapa e o retrato. Não muda atributos.", 250, 408, 13, "#a9a58f");
  // capas: clique para vestir (aparecem nas costas do boneco)
  txt("CAPA", 250, 432, 11, "#c9c4ad", "left", true);
  CAPES.forEach((c, i) => {
    const bx = 250 + i * 46, by = 440, bw = 42, bh = 56, lock = player.level < c.lvl && !adm.noReq, on = (save.cape | 0) === i;
    const hov = mouse.x >= bx && mouse.x <= bx + bw && mouse.y >= by && mouse.y <= by + bh;
    ctx.fillStyle = hov ? "rgba(60,52,30,0.8)" : "rgba(0,0,0,0.35)"; rr(bx, by, bw, bh, 6); ctx.fill();
    ctx.strokeStyle = on ? "#6fae4f" : hov ? "#ffd96a" : "rgba(229,224,200,0.2)"; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
    if (lock) ctx.globalAlpha = 0.35;
    if (c.color) {
      ctx.fillStyle = c.color; ctx.beginPath(); ctx.moveTo(bx + 20, by + 8); ctx.lineTo(bx + 38, by + 8); ctx.lineTo(bx + 46, by + 36); ctx.lineTo(bx + 12, by + 36); ctx.closePath(); ctx.fill();
      if (c.trim) { ctx.fillStyle = c.trim; ctx.fillRect(bx + 12, by + 34, 34, 3); }
    } else txt("—", bx + bw / 2, by + 28, 16, "#6d6a58", "center", true);
    ctx.globalAlpha = 1;
    txt(lock ? `nível ${c.lvl}` : c.name.replace("Capa ", "").replace("Manto ", ""), bx + bw / 2, by + 50, 9, lock ? "#e05a4a" : on ? "#6fae4f" : "#e5e0c8", "center", true, bw - 4);
    regClick(bx, by, bw, bh, () => {
      if (lock) { toast(`${c.name} libera no nível ${c.lvl}`); return; }
      save.cape = i; persist(); toast(i ? `Vestiu: ${c.name}` : "Sem capa");
    });
  });
  // prévia de cima
  ctx.save(); ctx.translate(800, 420); ctx.scale(2.6, 2.6);
  const keep = save.skin, px = player.x, py = player.y, pa = player.angle; save.skin = game.skc;
  player.x = 0; player.y = 0; player.angle = -0.4; drawPlayer();
  save.skin = keep; player.x = px; player.y = py; player.angle = pa;
  ctx.restore();
  txt("visto de cima", 800, 500, 11, "#a9a58f", "center");
}

// =====================================================================
//  Oficina: criar armas especiais e melhorar armas (até 8)
// =====================================================================
function craftWeapons() { return allMyWeapons().filter((it) => !WDEF[it.id].fists); }
function craftVests() { return VESTS.map((v, i) => i).filter(i => save.vestsOwned[i]); }
function craftKey(k) {
  if (k === "tab") { game.ctab = ((game.ctab || 0) + 1) % 3; game.ccur = 0; game.cstat = 0; return; }
  const len = game.ctab === 0 ? RECIPES.length : game.ctab === 1 ? craftWeapons().length : craftVests().length;
  if (k === "w" || k === "arrowup") game.ccur = Math.max(0, game.ccur - 1);
  else if (k === "s" || k === "arrowdown") game.ccur = Math.max(0, Math.min(len - 1, game.ccur + 1));
  else if (k === "enter") { if (game.ctab === 0) craftRecipe(); else if (game.ctab === 1) upgradeWeapon(); else upgradeVest(); }
  else if (k === "g" && game.ctab === 1) craftPerfect();
  else if (k === "v") repairVest();
}
// o implante Artesão dá desconto no dinheiro da oficina
function craftMoney(m) { return Math.round(m * (1 - Math.min(0.5, player.fx.craftDisc / 100))); }
function recipeName(r) { return r.vest != null ? VESTS[r.vest].name : WDEF[r.id].name; }
function craftRecipe() {
  const r = RECIPES[game.ccur], cost = craftMoney(r.money);
  if (player.level < r.level) { toast(`Precisa do nível ${r.level}`); return; }
  if (r.needVest != null && !save.vestsOwned[r.needVest]) { toast(`Precisa ter a ${VESTS[r.needVest].name} (ela é usada como base)`); return; }
  if (r.vest != null && save.vestsOwned[r.vest]) { toast("Você já tem esse colete"); return; }
  if (game.money < cost) { toast(`Precisa de $${cost} na mochila`); return; }
  if (!hasMats(r.mats)) { toast("Faltam materiais"); return; }
  if (r.vest == null && player.slots.indexOf(null) < 0 && packUsed() >= PACK_MAX) { toast("Mochila cheia"); return; }
  for (const m in r.mats) takeMat(m, r.mats[m]);
  game.money -= cost; stat("crafts");
  if (r.vest != null) {
    save.vestsOwned[r.needVest] = false;
    if (save.vestUpgrades) delete save.vestUpgrades[r.needVest];
    if (save.vest === r.needVest) save.vest = -1;
    gainVest(r.vest); save.vest = r.vest; recalcImplants();
  } else { addWeapon(newInst(r.id)); registerWeapon(r.id); }
  persist(); sfx.level();
  game.banner = { text: `${recipeName(r)} criado!`, sub: r.vest != null ? "Colete equipado" : "Abra a mochila (B) para equipar", t: 2600, gold: true };
}
function payUpgrade(c) {
  const cost = craftMoney(c.money);
  if (game.money < cost) { toast(`Precisa de $${cost} na mochila`); return false; }
  if (!hasMats(c.mats)) { toast("Faltam materiais"); return false; }
  for (const m in c.mats) takeMat(m, c.mats[m]);
  game.money -= cost;
  return true;
}
function finishUpgrade(message) {
  stat("upgrades");
  // Weapon instances in slots/pack belong to the current run checkpoint.
  save.run = runSnapshot();
  persist(); sfx.buy(); toast(message);
}
const CRAFT_PERFEITO_PRECO = 100000;
function craftPerfect() {
  if (game.ctab !== 1) return;
  const it = craftWeapons()[game.ccur];
  if (!it) return;
  if (it.gc && it.up.acc === 8 && it.up.dmg === 8 && it.up.rel === 8) {
    toast("Esta arma já tem Craft Perfeito (GC)."); return;
  }
  if (game.money < CRAFT_PERFEITO_PRECO) {
    toast("Craft Perfeito exige $100.000."); return;
  }
  game.money -= CRAFT_PERFEITO_PRECO;
  it.up = { acc: 8, dmg: 8, rel: 8 };
  it.gc = true;
  finishUpgrade(instName(it) + " · Craft Perfeito 8/8/8!");
  game.banner = { text: instName(it), sub: "CRAFT PERFEITO · Precisão 8 · Dano 8 · Recarga 8", t: 3300, gold: true };
}
function upgradeWeapon() {
  const it = craftWeapons()[game.ccur];
  if (it && it.gc) { toast("Arma GC já está no máximo. Não é possível sortear novamente."); return; }
  if (!it || !payUpgrade(upgradeCost(it))) return;
  it.up = rollUpgrades(UP_STATS, UP_MAX);
  finishUpgrade(`${WDEF[it.id].name}: Precisão ${it.up.acc} · Dano ${it.up.dmg} · Recarga ${it.up.rel}`);
}
function upgradeVest() {
  const i = craftVests()[game.ccur];
  if (i == null || !payUpgrade(vestUpgradeCost(i))) return;
  save.vestUpgrades = save.vestUpgrades || {};
  const up = save.vestUpgrades[i] = rollUpgrades(VEST_UP_STATS, VEST_UP_MAX);
  recalcImplants();
  finishUpgrade(`${VESTS[i].name}: Armadura ${up.armor} · Velocidade ${up.speed}`);
}
function matsLine(mats, x, y) {
  let xx = x;
  for (const m in mats) {
    if (!mats[m]) continue;
    const have = matCount(m), ok = have >= mats[m];
    drawMatIcon(m, xx + 10, y - 4, 0.28);
    const t = `${have}/${mats[m]}`;
    txt(t, xx + 24, y, 13, ok ? "#6fae4f" : "#e05a4a", "left", true);
    ctx.font = `bold 13px ${FONT}`; xx += 34 + ctx.measureText(t).width;
  }
}
function drawCraft() {
  game.ctab = game.ctab || 0; game.ccur = game.ccur || 0; game.cstat = game.cstat || 0;
  menuFrame("Oficina", `Dinheiro: $${game.money}  ·  Nível ${player.level}  ·  materiais da mochila e do baú contam aqui`);
  if (save.vest >= 0) {
    const vd = Math.round(vestDur()), c = repairCost();
    btn(W - 270, 20, 230, 30, vd >= 100 ? `Colete ${vd}% (inteiro)` : `V: consertar colete ${vd}% · $${Math.max(1, c)}`, repairVest, vd < 100, vd >= 100);
  }
  ["Criar equipamentos", "Melhorar armas", "Melhorar coletes"].forEach((t, i) => {
    const x = 60 + i * 290, sel = game.ctab === i;
    txt(t, x + 100, 104, 15, sel ? "#ffd96a" : "#6d6a58", "center", true);
    if (sel) { ctx.fillStyle = "#ffd96a"; ctx.fillRect(x + 30, 110, 140, 2); }
    regClick(x, 88, 200, 26, () => { game.ctab = i; game.ccur = 0; game.cstat = 0; });
  });
  const px = 600, pw = 320;
  ctx.fillStyle = "rgba(0,0,0,0.25)"; rr(px - 10, 122, pw + 20, 400, 8); ctx.fill();
  if (game.ctab === 0) {
    RECIPES.forEach((r, i) => {
      const y = 120 + i * 56, sel = game.ccur === i, cost = craftMoney(r.money);
      const ok = player.level >= r.level && game.money >= cost && hasMats(r.mats) && (r.needVest == null || save.vestsOwned[r.needVest]);
      rowBox(40, y, 520, 52, sel, ok ? "#6fae4f" : null);
      rowClick(40, y, 520, 52, sel, () => { game.ccur = i; }, craftRecipe);
      if (r.vest != null) drawVestIcon(r.vest, 96, y + 26, 0.7); else drawWeaponSide(WDEF[r.id], 96, y + 26, 0.36);
      txt(recipeName(r), 160, y + 19, 14, r.vest != null ? RARITY[VESTS[r.vest].rar].color : rarColor(WDEF[r.id]), "left", true, 280);
      matsLine(r.mats, 160, y + 41);
      txt(`$${cost}`, 548, y + 19, 13, game.money >= cost ? "#6fae4f" : "#e05a4a", "right", true);
      txt(`nível ${r.level}`, 548, y + 40, 11, player.level >= r.level ? "#6fae4f" : "#e05a4a", "right", true);
    });
    const r = RECIPES[game.ccur];
    if (r.vest != null) {
      const v = VESTS[r.vest];
      drawVestIcon(r.vest, px + pw / 2, 200, 2.2);
      txt(v.name, px, 290, 17, RARITY[v.rar].color, "left", true, pw);
      txt(vestText(v), px, 312, 12, "#c9c4ad", "left", false, pw);
      txt(`Precisa ter: ${VESTS[r.needVest].name}`, px, 340, 12, save.vestsOwned[r.needVest] ? "#6fae4f" : "#e05a4a", "left", true, pw);
      txt("(ela é consumida no craft)", px, 356, 11, "#a9a58f");
      txt("Placa de blindagem: só cai dos chefes de áreas pretas, roxas e cinzas", px, 382, 11, "#ffd96a", "left", false, pw);
    } else weaponDetail(WDEF[r.id], null, px, 130, pw);
    btn(px + 70, 470, 180, 40, "Criar (Enter)", craftRecipe, true);
    hint("W/S escolhe · Enter cria · Tab troca de aba · clique 2x para criar · E ou Esc fecha");
  } else {
    const isVest = game.ctab === 2, list = isVest ? craftVests() : craftWeapons();
    if (!list.length) txt(`Você não tem ${isVest ? "coletes" : "armas"} para melhorar.`, 300, 160, 15, "#6d6a58", "center");
    const vis = 9, off = Math.max(0, Math.min(list.length - vis, game.ccur - 4));
    list.slice(off, off + vis).forEach((it, j) => {
      const i = off + j, y = 124 + j * 42, sel = game.ccur === i;
      if (isVest) {
        const up = vestUpgrade(it);
        rowBox(40, y, 520, 34, sel);
        txt(VESTS[it].name, 52, y + 22, 13, "#e5e0c8", "left", true, 330);
        txt(`A${up.armor} V${up.speed}`, 548, y + 22, 12, "#ffd96a", "right");
      } else drawListItem(it, 40, y, 520, sel, `P${it.up.acc} D${it.up.dmg} R${it.up.rel}`);
      rowClick(40, y, 520, 34, sel, () => { game.ccur = i; }, () => {});
    });
    const it = list[game.ccur];
    if (it != null) {
      const d = isVest ? VESTS[it] : WDEF[it.id], up = isVest ? vestUpgrade(it) : it.up;
      ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(px, 130, pw, 90, 8); ctx.fill();
      if (isVest) drawVestIcon(it, px + pw / 2, 175, 1);
      else drawWeaponSide(d, px + pw / 2, 175, Math.min(1.6, (pw - 30) / 125));
      txt(isVest ? d.name : instName(it), px, 244, 17, "#f2eedc", "left", true, pw);
      (isVest ? VEST_UP_STATS : UP_STATS).forEach((s, i) => {
        const y = 262 + i * 48, lv = up[s.id];
        rowBox(px, y, pw, 44, false);
        txt(`${s.name} ${lv}`, px + 10, y + 17, 13, "#e5e0c8", "left", true);
        const effect = isVest ? (s.id === "armor" ? `+${lv}% de proteção` : `+${lv}% de velocidade`) : upEffect(d, s.id, lv);
        txt(effect, px + 10, y + 35, 11, "#a9a58f");
      });
      txt(`Sorteia todos: 1 a ${isVest ? VEST_UP_MAX : UP_MAX} por atributo.`, px, 422, 11, "#ffd96a", "left", false, pw);
      txt("Substitui os valores atuais; pode diminuir.", px, 438, 11, "#a9a58f", "left", false, pw);
      const c = isVest ? vestUpgradeCost(it) : upgradeCost(it), cost = craftMoney(c.money);
      txt(`Sorteio: $${cost}`, px, 459, 13, game.money >= cost ? "#6fae4f" : "#e05a4a", "left", true);
      matsLine(c.mats, px + 180, 459);
      btn(px + 70, 474, 180, 36, "Melhorar (Enter)", isVest ? upgradeVest : upgradeWeapon, true, !isVest && !!it.gc);
      if (!isVest) {
        const isGC = !!it.gc && it.up.acc === 8 && it.up.dmg === 8 && it.up.rel === 8;
        btn(px + 28, 515, 264, 35,
          isGC ? "CRAFT PERFEITO (GC)" : "Craft Perfeito 8/8/8 · $100.000",
          craftPerfect, true, isGC || game.money < CRAFT_PERFEITO_PRECO);
      }
    }
    hint(game.ctab === 1 ? "W/S escolhe · Enter melhora · G: Craft Perfeito 8/8/8 ($100.000) · Esc fecha" : "W/S escolhe · Enter melhora · Tab troca de aba · E ou Esc fecha");
  }
  menuToast();
}
