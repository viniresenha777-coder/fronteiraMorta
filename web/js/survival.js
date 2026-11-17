"use strict";
// =====================================================================
//  Sobrevivência: infecção, comida com qualidade, munição na mochila,
//  profissões, durabilidade dos coletes, missões de resgate, sirene da
//  horda e implantes exclusivos da Zona Morta.
// =====================================================================

// ---------- Profissões (escolhidas ao criar o personagem) ----------
const PROFS = [
  { id: "atleta",    name: "Atleta",    buff: ["+10% de velocidade de corrida"], debuff: [], sprint: 0.10 },
  { id: "militar",   name: "Militar",   buff: ["+20 pontos em Machinegun", "+10 pontos em Precisão de mira"], debuff: ["+15% de energia gasta ao correr"], attrs: { machinegun: 20, acc: 10 }, stamina: 0.15 },
  { id: "medico",    name: "Médico",    buff: ["Kits médicos curam 50% a mais", "Proteção contra infecção (quando ativada)"], debuff: [], med: 0.5, infect: -0.3 },
  { id: "atirador",  name: "Atirador",  buff: ["+15 pontos em Rifles", "+5 pontos em Precisão de mira"], debuff: ["-5% de velocidade"], attrs: { rifles: 15, acc: 5 }, fx: { agility: -5 } },
  { id: "lutador",   name: "Lutador",   buff: ["+20 pontos em Melee", "+10 pontos em Força"], debuff: [], attrs: { melee: 20, str: 10 } },
  { id: "catador",   name: "Catador",   buff: ["+15% de chance de munição e suprimentos"], debuff: ["-10 de vida máxima"], fx: { scavenger: 15, vigor: -10 } },
  { id: "mecanico",  name: "Mecânico",  buff: ["Coletes gastam 40% mais devagar", "Conserto de colete pela metade do preço"], debuff: [], vestWear: -0.4, repair: 0.5 },
  { id: "batedor",   name: "Batedor",   buff: ["+10 pontos em Furtividade", "+10 pontos em Silêncio ao andar"], debuff: ["-10 de vida máxima"], attrs: { stealth: 10, silence: 10 }, fx: { vigor: -10 } }
];
function prof() { return PROFS.find((p) => p.id === save.prof) || null; }
function profVal(k) { const p = prof(); return p && p[k] ? p[k] : 0; }
function chooseProf(i) {
  const p = PROFS[i];
  if (!p || save.prof) return;
  save.prof = p.id;
  if (p.attrs) for (const k in p.attrs) player.attrs[k] = Math.min(ATTR_MAX, player.attrs[k] + p.attrs[k]);
  syncChar(); recalcImplants(); player.hp = player.maxHp; persist();
  game.menu = null; sfx.level();
  game.banner = { text: `Você é ${p.name}`, sub: p.buff.join(" · "), t: 3200, gold: true };
  checkpoint("personagem criado");
}
function profKey(k) {
  game.pcur = game.pcur | 0;
  if (k === "w" || k === "arrowup") game.pcur = (game.pcur + PROFS.length - 2) % PROFS.length;
  else if (k === "s" || k === "arrowdown") game.pcur = (game.pcur + 2) % PROFS.length;
  else if (k === "a" || k === "arrowleft" || k === "d" || k === "arrowright") game.pcur ^= 1;
  else if (k === "enter") chooseProf(game.pcur);
}
function drawProf() {
  ctx.fillStyle = "rgba(8,9,7,0.96)"; ctx.fillRect(0, 0, W, H);
  txt("Escolha a sua profissão", W / 2, 46, 28, "#e5e0c8", "center", true);
  txt("Ela vale para este personagem e não muda depois. Algumas têm só vantagem, outras têm vantagem e desvantagem.", W / 2, 72, 13, "#a9a58f", "center");
  game.pcur = game.pcur | 0;
  PROFS.forEach((p, i) => {
    const x = 60 + (i % 2) * 430, y = 92 + Math.floor(i / 2) * 112, w = 410, h = 102, sel = game.pcur === i;
    const hov = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
    ctx.fillStyle = sel ? "#2b2a22" : hov ? "#22211b" : "#1a1a15"; rr(x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = sel ? "#ffd96a" : "#3d3b30"; ctx.lineWidth = sel ? 2 : 1; ctx.stroke();
    txt(p.name, x + 16, y + 28, 19, sel ? "#ffd96a" : "#f2eedc", "left", true);
    let ly = y + 50;
    for (const b of p.buff) { txt(`+ ${b}`, x + 16, ly, 13, "#6fd06a", "left", true, w - 30); ly += 17; }
    for (const b of p.debuff) { txt(`– ${b}`, x + 16, ly, 13, "#e07b5a", "left", true, w - 30); ly += 17; }
    regClick(x, y, w, h, () => { if (game.pcur === i) chooseProf(i); else game.pcur = i; });
  });
  txt("Clique para escolher e clique de novo para confirmar · ou setas + Enter", W / 2, H - 22, 13, "#a9a58f", "center");
}

// ---------- Infecção (desativada temporariamente, reversível por uma flag) ----------
const INFECTION_ENABLED = false;
function addInfection(z, mult) {
  if (!INFECTION_ENABLED) { player.infect = 0; return; }
  if (adm.god) return;
  const base = (3 + regionOf(z ? z.zone : game.area) * 0.6) * (mult || 1);
  player.infect = Math.min(100, (player.infect || 0) + base * (1 + profVal("infect")));
  if (player.infect >= 100 && !player.infWarned) { player.infWarned = true; toast("Infecção grave! Use um antibiótico (I)"); }
}
function infectTick(sec) {
  if (!INFECTION_ENABLED) { player.infect = 0; player.infWarned = false; return; }
  if (adm.god) { player.infect = 0; return; }
  if ((player.infect || 0) >= 100) player.hp -= 1.2 * sec; // infecção cheia: perde vida aos poucos
}
function useAnti() {
  if (!INFECTION_ENABLED) return;
  if (!player.anti) { toast("Você não tem antibiótico"); return; }
  if (!player.infect) { toast("Você não está infectado"); return; }
  player.anti--; player.infect = Math.max(0, player.infect - 60); player.infWarned = false;
  toast(`Você tomou um antibiótico · infecção ${Math.round(player.infect)}%`); sfx.pickup();
}

// ---------- Comida com qualidade ----------
const FOOD_Q = {
  podre:  { name: "comida estragada", hunger: 18, color: "#9a8a4a" },
  comum:  { name: "lata de comida",   hunger: 40, color: "#c9c4ad" },
  fresca: { name: "comida fresca",    hunger: 65, color: "#6fd06a" }
};
function rollFoodQ(zone) {
  const r = regionOf(zone), x = Math.random();
  const fresh = 0.06 + r * 0.05, rotten = Math.max(0.06, 0.4 - r * 0.05);
  return x < fresh ? "fresca" : x < fresh + rotten ? "podre" : "comum";
}
function addFood(q, n) { player.foodQ[q] = (player.foodQ[q] || 0) + n; player.food += n; }
function eat() {
  if (player.food <= 0) { toast("Você não tem comida"); return; }
  if (player.hunger >= 100) { toast("Sem fome"); return; }
  const Q = player.foodQ, need = 100 - player.hunger;
  // escolhe a comida que aproveita melhor a fome; a estragada fica por último
  let q = need >= 55 && Q.fresca ? "fresca" : Q.comum ? "comum" : Q.fresca ? "fresca" : "podre";
  Q[q]--; player.food--;
  player.hunger = Math.min(100, player.hunger + FOOD_Q[q].hunger);
  if (q === "fresca") { player.hp = Math.min(player.maxHp, player.hp + 5); toast("Comida fresca! (+5 de vida)"); }
  else if (q === "podre") {
    if (INFECTION_ENABLED && Math.random() < 0.5) { addInfection(null, 2.5); toast("Estava estragada... a infecção subiu"); }
    else toast("Comida estragada (sacia pouco)");
  } else toast("Você comeu");
  sfx.pickup(); stat("foodEaten");
}

// ---------- Munição ocupa a mochila: até 500 por espaço, por tipo ----------
const AMMO_STACK = 500;
function ammoSlots() { let n = 0; for (const t in player.reserve) n += Math.ceil(Math.max(0, player.reserve[t]) / AMMO_STACK); return n; }
function packUsed() { return player.pack.length + ammoSlots(); }
function ammoRoom(t) {
  const r = player.reserve[t] || 0, partial = Math.ceil(r / AMMO_STACK) * AMMO_STACK - r;
  return partial + Math.max(0, PACK_MAX - packUsed()) * AMMO_STACK;
}
function addAmmo(t, n) { const take = Math.max(0, Math.min(n, ammoRoom(t))); player.reserve[t] = (player.reserve[t] || 0) + take; return take; }

// ---------- Durabilidade dos coletes ----------
function vestDur(i) { i = i == null ? save.vest : i; if (i < 0) return 0; const d = save.vestDur && save.vestDur[i]; return d == null ? 100 : d; }
function vestEff() { const d = vestDur(); return d >= 50 ? 1 : d / 50; } // abaixo de 50% protege menos; quebrado não protege
function wearVest(dmg) {
  if (save.vest < 0 || adm.god) return;
  save.vestDur = save.vestDur || {};
  const before = vestDur();
  const after = Math.max(0, before - dmg * 0.12 * (1 + profVal("vestWear")));
  save.vestDur[save.vest] = after;
  if (before > 25 && after <= 25) toast(`${VESTS[save.vest].name} está quebrando (${Math.round(after)}%) · conserte na oficina`);
  if (before > 0 && after <= 0) { toast(`${VESTS[save.vest].name} quebrou! Não protege mais`); recalcImplants(); }
}
function repairCost() { if (save.vest < 0) return 0; return Math.round((100 - vestDur()) / 100 * VESTS[save.vest].price * 0.5 * (1 - profVal("repair")) + 0.4); }
function repairVest() {
  if (save.vest < 0) { toast("Você não está usando colete"); return; }
  if (vestDur() >= 100) { toast("O colete já está inteiro"); return; }
  const c = Math.max(1, repairCost());
  if (game.money < c) { toast(`O conserto custa $${c} (dinheiro da mochila)`); return; }
  game.money -= c; save.vestDur[save.vest] = 100; persist(); recalcImplants(); sfx.buy();
  toast(`${VESTS[save.vest].name} consertado por $${c}`);
}

// ---------- Missões de resgate ----------
function rescueMission() { return save.missions.find((m) => m.type === "rescue" && m.progress < m.target) || null; }
function rescueOffer(mk) {
  const here = world.cell, top = Math.max(0, Math.min(7, regionOf(game.best)));
  const opts = allCells().filter((c) => c.op == null && c.tier <= top && c !== here && !(c.tier === 8));
  if (!opts.length) return;
  opts.sort((a, b) => (Math.abs(a.cx - here.cx) + Math.abs(a.cy - here.cy)) - (Math.abs(b.cx - here.cx) + Math.abs(b.cy - here.cy)));
  const c = pick(opts.slice(0, Math.min(6, opts.length)));
  mk("rescue", 1, 1.8 + c.tier * 0.25, { cx: c.cx, cy: c.cy, code: c.code });
}
// o prédio onde o sobrevivente está (sempre o mesmo para aquela área)
function rescueBuilding() {
  const m = rescueMission();
  if (!m || game.escort || world.cell.cx !== m.cx || world.cell.cy !== m.cy) return null;
  return world.buildings.find((b) => b.enter && !b.safe && !b.landmark && !b.noDoor && b.type !== "guarita") || null;
}
function placeSurvivor(h) {
  if (h !== rescueBuilding() || !h.levels || !h.levels[0]) return;
  const L = h.levels[0];
  if (L.interior.some((f) => f.kind === "survivor")) return;
  const p = interiorSpot(L.interior, L.iw, L.ih);
  L.interior.push({ x: p.x - 14, y: p.y - 14, w: 28, h: 28, kind: "survivor", name: "Sobrevivente", opened: false, items: [] });
}
function pickupSurvivor(s) {
  const h = game.inside; h.interior.splice(h.interior.indexOf(s), 1);
  game.escort = { x: s.x + 14, y: s.y + 14, walk: 0, moving: false, ang: 0 };
  sfx.pickup();
  game.banner = { text: "Sobrevivente encontrado!", sub: "Ele vai te seguir · leve-o até um posto seguro", t: 3000, gold: true };
}
function escortTick(dt, k) {
  const e = game.escort;
  if (!e) return;
  const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy);
  if (d > 320) { e.x = player.x - Math.cos(player.angle) * 30; e.y = player.y - Math.sin(player.angle) * 30; return; }
  e.moving = d > 44;
  if (e.moving) {
    const sp = Math.min(d - 40, 4.6 * k);
    e.x += (dx / d) * sp; e.y += (dy / d) * sp; e.walk += sp * 0.16; e.ang = Math.atan2(dy, dx);
    pushOut(e, 12);
  }
}
function deliverSurvivor() {
  const m = save.missions.find((mm) => mm.type === "rescue" && mm.progress < mm.target);
  game.escort = null;
  if (m) { m.progress = m.target; persist(); }
  game.banner = { text: "Sobrevivente resgatado!", sub: "Entregue a missão no quadro de missões", t: 3200, gold: true };
  sfx.level();
}
function drawSurvivor(x, y, ang, walk, moving) {
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ellipse(x + 3, y + 5, 14, 10);
  const ph = Math.sin(walk), st = moving ? ph * 10 : 0;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  for (const [side, s] of [[-1, st], [1, -st]]) {
    ctx.strokeStyle = "#3a4a5a"; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, side * 4); ctx.lineTo(s, side * 5); ctx.stroke();
    ctx.fillStyle = "#1e1a16"; ellipse(s + 2, side * 5, 4, 3);
  }
  ctx.fillStyle = "#7a8a5a"; ellipse(0, 0, 7.5, 12.5);
  limb(1, -10, 4 - st * 0.4, -13, -1, "#7a8a5a", 4.5, 4);
  limb(1, 10, 4 + st * 0.4, 13, 1, "#7a8a5a", 4.5, 4);
  ctx.fillStyle = "#d8b08a"; circle(2, 0, 6.8);
  ctx.fillStyle = "#5a3a20"; ctx.beginPath(); ctx.arc(0, 0, 7, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
  ctx.restore();
  hudT("SOBREVIVENTE", x, y - 22, 9, "#8fe0a8", "center", true);
}

// ---------- Sirene da horda ----------
function siren() {
  const ac = SND.ac;
  if (!ac || SND.muted) return;
  const t = ac.currentTime, o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
  o.type = "sawtooth"; o2.type = "sine";
  for (let i = 0; i < 4; i++) {
    o.frequency.setValueAtTime(380, t + i * 1.6); o.frequency.linearRampToValueAtTime(820, t + i * 1.6 + 0.8); o.frequency.linearRampToValueAtTime(380, t + i * 1.6 + 1.6);
    o2.frequency.setValueAtTime(190, t + i * 1.6); o2.frequency.linearRampToValueAtTime(410, t + i * 1.6 + 0.8); o2.frequency.linearRampToValueAtTime(190, t + i * 1.6 + 1.6);
  }
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + 0.4); g.gain.setValueAtTime(0.11, t + 5.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 6.4);
  o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(SND.master);
  o.start(t); o2.start(t); o.stop(t + 6.5); o2.stop(t + 6.5);
}

// ---------- Zona Morta: implantes de alto nível, 1% fixo por lugar vasculhado ----------
const DEAD_IMPLANTS = ["mimic", "mutant", "fortune", "annihilation", "oblivion", "prophecy", "sage"];
const DEAD_CHANCE = 0.01;
function deadZoneDrop(zone) {
  if (regionOf(zone) !== 8 || Math.random() >= DEAD_CHANCE) return null;
  const d = pick(DEAD_IMPLANTS.filter((x) => IMP[x]));
  return d ? { type: "implant", im: newImplant(d), dead: true } : null;
}
