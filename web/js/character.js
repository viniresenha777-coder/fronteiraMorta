"use strict";
// =====================================================================
//  Personagem: implantes, atributos, experiência, fome, sede e cura
// =====================================================================

// ---------- Implantes ----------
function newImplant(id) { return { id, alloc: {} }; }
function randomImplant() { return newImplant(pick(IMP_IDS)); }
function impColor(im) { return IMP_COLOR[IMP[im.id].kind || 0]; }
function implantName(im) { return IMP[im.id].name; }
function allocUsed(im) { let n = 0; for (const k in im.alloc || {}) n += im.alloc[k]; return n; }
// save antigo ou mexido: só entra implante que existe, com os pontos dentro do limite
function cleanImplant(im) {
  if (!im || !IMP[im.id]) return null;
  const d = IMP[im.id], out = newImplant(im.id);
  if (d.alloc && im.alloc) {
    let left = d.alloc.points;
    for (const o of d.alloc.opts) { const n = Math.max(0, Math.min(left, im.alloc[o.key] | 0)); if (n) { out.alloc[o.key] = n; left -= n; } }
  }
  return out;
}
// efeitos de um implante (fixos + pontos distribuídos). O Mímico copia o da esquerda, com os negativos em dobro.
function implantFx(im, i, list) {
  const d = IMP[im.id], fx = {};
  if (d.mimic) {
    const left = list && i > 0 ? list[i - 1] : null;
    if (!left || IMP[left.id].mimic) return fx;
    const src = implantFx(left, i - 1, list);
    for (const k in src) fx[k] = src[k] < 0 ? src[k] * 2 : src[k];
    return fx;
  }
  for (const k in d.fx) fx[k] = d.fx[k];
  if (d.alloc) for (const o of d.alloc.opts) { const n = (im.alloc && im.alloc[o.key]) || 0; if (n) fx[o.key] = (fx[o.key] || 0) + n * o.per; }
  return fx;
}
function fxText(fx) { return Object.keys(fx).filter((k) => fx[k]).map((k) => `${sgn(fx[k])}% ${FX_LABEL[k] || k}`).join(" · "); }
function implantDesc(im) {
  const d = IMP[im.id], i = save.installed.indexOf(im), parts = [];
  if (d.mimic) {
    const left = i > 0 ? save.installed[i - 1] : null;
    if (left && !IMP[left.id].mimic) parts.push(`Copiando ${implantName(left)}: ${fxText(implantFx(im, i, save.installed)) || "nada"}`);
  } else {
    const t = fxText(d.fx || {});
    if (t) parts.push(t);
    if (d.alloc) {
      const a = {}; for (const o of d.alloc.opts) if (im.alloc && im.alloc[o.key]) a[o.key] = im.alloc[o.key] * o.per;
      parts.push(`Pontos ${allocUsed(im)}/${d.alloc.points}${allocUsed(im) ? ": " + fxText(a) : " (arraste para o boneco para distribuir)"}`);
    }
  }
  if (d.text) parts.push(d.text);
  return parts.join(" · ");
}
// por que este implante não pode ser instalado agora (ou null se pode)
function installBlock(im) {
  if (save.installed.some((x) => x.id === im.id)) return `Você já tem ${implantName(im)} instalado (só um de cada)`;
  if (save.installed.length >= IMPL_SLOTS) return "Sem espaço: remova um implante primeiro";
  return null;
}
function canSwapImplants() { return inSafe() || !!(player.flags && player.flags.hook); }
function recalcImplants() {
  const all = {}, safe = {}, flags = {};
  STAT_KEYS.forEach((k) => { all[k] = 0; safe[k] = 0; });
  save.installed.forEach((im, i) => {
    const fx = implantFx(im, i, save.installed);
    for (const k in fx) { all[k] = (all[k] || 0) + fx[k]; if (fx[k] > 0) safe[k] = (safe[k] || 0) + fx[k]; }
    if (IMP[im.id].flag) flags[IMP[im.id].flag] = true;
  });
  const pf = prof(); // bônus e penalidades da profissão
  if (pf && pf.fx) for (const k in pf.fx) { all[k] = (all[k] || 0) + pf.fx[k]; safe[k] = (safe[k] || 0) + pf.fx[k]; }
  player.fxAll = all; player.fxSafe = safe; player.flags = flags; player.fx = all;
  const vest = save.vest >= 0 ? VESTS[save.vest] : null;
  // Endurance vale a mesma quantidade em HP. Colete e implantes acrescentam
  // pontos de vida até o limite absoluto de 200, sem bônus automático por nível.
  const baseHp = Number.isFinite(player.attrs.endurance) ? player.attrs.endurance : 25;
  const implantBonus = Math.max(-20, Math.min(35, all.vigor || 0));
  const vestBonus = Math.max(0, Math.min(25, vest && vest.hp ? vest.hp : 0));
  player.maxHp = Math.max(1, Math.min(PLAYER_HP_CAP, baseHp + implantBonus + vestBonus));
  player.hp = Math.min(player.hp, player.maxHp);
  lastStandTick();
}
// Último Suspiro (Desafia-Morte): com a vida crítica, as penalidades dos implantes deixam de valer
function lastStandTick() {
  if (!player.fxAll) return;
  player.fx = player.flags.lastStand && player.hp / player.maxHp < 0.25 ? player.fxSafe : player.fxAll;
}
function makeStock() { return IMP_IDS.map((id) => ({ id, price: IMP[id].price })); }

// ---------- Atributos ----------
function xpNeed(l) { return Math.round(30 + 6 * l + 0.12 * l * l); }
function A(id) { return player.attrs[id]; }
// Vest and implant protection stack additively; attribute armor remains a separate layer.
function equipmentProtection() {
  const vest = save.vest >= 0 ? (VESTS[save.vest].armor + vestUpgrade().armor) * vestEff() : 0;
  return Math.max(-50, Math.min(95, vest + (player.fx.thick || 0)));
}
function trindadeActive() { return (save.trindadeUntil || 0) > Date.now(); }
function armorRed() {
  const a = A("armor") / (A("armor") + 150);
  const baseline = Math.min(0.78, 1 - (1 - a) * (1 - equipmentProtection() / 100));
  const boosted = baseline * (trindadeActive() ? 1.35 : 1);
  // Urso de Ferro tem teto próprio de 80% de redução total.
  return Math.min(player.flags.jugger ? 0.8 : 0.95, boosted);
}
function moneyMult() { return (1 + player.fx.greed / 100) * (vipActive() ? 2 : 1); }
function xpMult() { return (1 + player.fx.exp / 100) * (vipActive() ? 2 : 1); }
function attrEffect(id, v) {
  switch (id) {
    case "endurance": return `${Math.round(v)} de vida-base (melhorias até 200 HP)`;
    case "str": return `+${v - 10}% de dano melee · exigência das armas`;
    case "armor": return `-${Math.round((v / (v + 150)) * 100)}% de dano recebido`;
    case "agi": return `+${Math.round((v - 10) * 0.4)}% de velocidade`;
    case "acc": return `dispersão em ${Math.round(100 * Math.max(0.15, 10 / v))}% · +${Math.round((v - 10) * 0.3)}% de dano à distância`;
    case "crit": return `${Math.min(75, v * 0.5).toFixed(1)}% de chance de crítico`;
    case "reload": return `recarrega em ${Math.round(100 / (1 + (v - 10) * 0.012))}% do tempo`;
    case "silence": return `zumbis te veem de ${Math.round(100 / (1 + (v - 10) * 0.015))}% da distância`;
    case "stealth": return `${Math.min(60, v)}% de chance de o zumbi não te ver`;
    default: return `+${Math.round((v - 10) * 0.5)}% de dano com ${CATNAME[id]}`;
  }
}
function syncChar() {
  save.char.level = player.level; save.char.xp = player.xp; save.char.points = player.points; save.char.wpoints = player.wpoints; save.char.skillCurve = 2;
  persist();
}
function gainXp(n) {
  if (player.level >= MAX_LEVEL) return;
  player.xp += n * xpMult();
  let up = 0;
  while (player.level < MAX_LEVEL && player.xp >= xpNeed(player.level)) {
    player.xp -= xpNeed(player.level); player.level++;
    player.wpoints += weaponPointsForLevel(player.level);
    player.points += survivalPointsForLevel(player.level);
    up++;
  }
  if (player.level >= MAX_LEVEL) player.xp = 0;
  if (up) {
    recalcImplants(); player.hp = Math.min(player.maxHp, player.hp + 10 * up);
    sfx.level();
    game.banner = { text: `Nível ${player.level}!`, sub: "Aperte C para distribuir seus pontos", t: 2600, gold: true };
  }
  syncChar();
}

// ---------- Fome, sede, kit médico ----------
function drink() {
  if (player.water <= 0) { toast("Você não tem água"); return; }
  if (player.thirst >= 100) { toast("Sem sede"); return; }
  player.water--; player.thirst = Math.min(100, player.thirst + 40); toast("Você bebeu"); sfx.pickup(); stat("foodEaten");
}
function heal() {
  if (player.med <= 0) { toast("Você não tem kit médico"); return; }
  if (player.hp >= player.maxHp) { toast("Vida cheia"); return; }
  player.med--; player.hp = Math.min(player.maxHp, player.hp + 40 * (1 + profVal("med"))); toast("Você usou um kit médico"); sfx.pickup();
}
