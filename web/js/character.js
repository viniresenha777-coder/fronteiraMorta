"use strict";
// =====================================================================
//  Personagem: implantes, atributos, experiência, fome, sede e cura
// =====================================================================

// ---------- Implantes ----------
function randomNeg(tier) {
  const key = ["agility", "thick", "vigor", "reload"][Math.floor(Math.random() * 4)];
  return { key, val: key === "vigor" ? -6 * tier : -2 * tier };
}
function randomImplant(boss) {
  if (boss) {
    const r0 = Math.random();
    if (r0 < 0.05) return { id: "rabbit", tier: 1, neg: null };
    if (r0 < 0.25) return { id: pick(["berserker", "phantom", "hoarder"]), tier: 1, neg: null };
  }
  const ids = Object.keys(IMP).filter((i) => !IMP[i].combo), id = pick(ids), r = Math.random();
  const tier = boss ? (r < 0.15 ? 3 : r < 0.6 ? 2 : 1) : (r < 0.12 ? 2 : 1);
  return { id, tier, neg: null };
}
function implantName(im) {
  const d = IMP[im.id];
  return d.combo ? d.name : `${d.name} T${im.tier}${im.neg ? " (Erro)" : ""}`;
}
function implantDesc(im) {
  const d = IMP[im.id];
  if (d.combo) return d.text;
  let t = d.text.replace("{v}", d.vals[im.tier - 1]);
  if (im.neg) t += ` · Erro: ${NEGTXT[im.neg.key].replace("{v}", Math.abs(im.neg.val))}`;
  return t;
}
function recalcImplants() {
  const fx = {};
  STAT_KEYS.forEach((k) => { fx[k] = 0; });
  for (const im of save.installed) {
    const d = IMP[im.id];
    for (const k in d.fx) fx[k] += d.fx[k][Math.min(im.tier, d.fx[k].length) - 1];
    if (im.neg) fx[im.neg.key] += im.neg.val;
  }
  const pf = prof(); // bônus e penalidades da profissão
  if (pf && pf.fx) for (const k in pf.fx) fx[k] += pf.fx[k];
  player.fx = fx;
  const vest = save.vest >= 0 ? VESTS[save.vest] : null;
  player.maxHp = Math.max(30, 100 + 3 * (player.level - 1) + fx.vigor + (vest && vest.hp ? vest.hp : 0));
  player.hp = Math.min(player.hp, player.maxHp);
}
function makeStock() {
  const singles = Object.keys(IMP).filter((i) => !IMP[i].combo).sort(() => Math.random() - 0.5).slice(0, 5);
  const stock = singles.map((id) => ({ id, price: 180, sold: false }));
  stock.push({ id: pick(["berserker", "phantom", "hoarder"]), price: 2500, sold: false });
  if (new Date().getMonth() === 11) stock.push({ id: "rabbit", price: 5000, sold: false }); // evento de Natal
  return stock;
}

// ---------- Atributos ----------
function xpNeed(l) { return Math.round(30 + 6 * l + 0.12 * l * l); }
function A(id) { return player.attrs[id]; }
function armorRed() {
  const a = A("armor") / (A("armor") + 150), v = save.vest >= 0 ? (VESTS[save.vest].armor / 100) * vestEff() : 0;
  return 1 - (1 - a) * (1 - v);
}
function moneyMult() { return (1 + player.fx.greed / 100) * (save.gm ? 2 : 1); }
function xpMult() { return (1 + player.fx.exp / 100) * (save.gm ? 2 : 1); }
function attrEffect(id, v) {
  switch (id) {
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
  save.char.level = player.level; save.char.xp = player.xp; save.char.points = player.points; save.char.wpoints = player.wpoints;
  persist();
}
function gainXp(n) {
  if (player.level >= MAX_LEVEL) return;
  player.xp += n * xpMult();
  let up = 0;
  while (player.level < MAX_LEVEL && player.xp >= xpNeed(player.level)) {
    player.xp -= xpNeed(player.level); player.level++;
    const pts = player.level <= 50 ? 5 : 2; player.points += pts; player.wpoints += pts; up++;
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
