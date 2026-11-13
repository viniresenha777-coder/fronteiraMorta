"use strict";
// =====================================================================
//  Objetivos: história em capítulos, conquistas com 3 níveis, desafios
//  do dia, coleção de armas, estatísticas e eventos no mapa (hordas e
//  caixas de suprimentos que caem do céu). Tecla O abre o menu.
// =====================================================================
const STAT_IDS = ["kills", "dogs", "monsters", "bosses", "bossR5", "searches", "itemsTaken", "legendaries", "crafts", "upgrades", "nights",
  "dist", "foodEaten", "meleeKills", "rifleKills", "fireKills", "nightKills", "hordes", "airdrops", "travels", "deaths", "bestRarity"];
function S(id) { return (save.stats && save.stats[id]) || 0; }
function stat(id, n) { save.stats[id] = S(id) + (n == null ? 1 : n); game.objDirty = true; }
function statMax(id, v) { if (v > S(id)) { save.stats[id] = v; game.objDirty = true; } }
function registerWeapon(id) {
  const d = WDEF[id];
  if (!d || d.fists) return;
  if (!save.coll.includes(id)) { save.coll.push(id); game.objDirty = true; toast(`Nova arma na coleção: ${d.name} (${save.coll.length}/${COLL_TOTAL})`); }
  statMax("bestRarity", d.rar);
}
const COLL_TOTAL = WLIST.filter((d) => !d.fists).length;
function basesFound() { return save.outposts.filter(Boolean).length; }

// ---------- História ----------
const STORY = [
  { name: "Primeiro saque", text: "O rádio da base chia: 'Ninguém sobrevive de mãos vazias. Vasculhe o bairro.'", goal: "Vasculhe 5 lugares", val: () => S("searches"), n: 5, rw: { money: 100, food: 2 } },
  { name: "Mãos à obra", text: "Os errantes estão chegando perto do Refúgio. Afaste-os.", goal: "Elimine 15 zumbis", val: () => S("kills"), n: 15, rw: { money: 150, xp: 40 } },
  { name: "Arma de verdade", text: "Uma pistola não vai bastar lá fora. Ache algo melhor.", goal: "Consiga uma arma Incomum ou melhor", val: () => S("bestRarity"), n: 1, rw: { mats: { pecas: 2 } } },
  { name: "Catador", text: "Cada lata conta. Cada bala conta.", goal: "Pegue 30 itens", val: () => S("itemsTaken"), n: 30, rw: { money: 200, med: 1 } },
  { name: "A primeira noite", text: "Quando o sol some, eles ficam mais numerosos. Aguente até o amanhecer.", goal: "Sobreviva a uma noite", val: () => S("nights"), n: 1, rw: { money: 200, med: 1, xp: 80 } },
  { name: "Rumo ao leste", text: "Há sinal de rádio vindo da velha ferrovia. Talvez existam outros.", goal: "Descubra a Base 2", val: () => basesFound(), n: 2, rw: { money: 400, mats: { sucata: 3 } } },
  { name: "Matilha", text: "Os cães infectados caçam em grupo. Diminua a matilha.", goal: "Elimine 10 cães infectados", val: () => S("dogs"), n: 10, rw: { money: 400, xp: 150 } },
  { name: "Ferreiro", text: "A oficina dos postos transforma sucata em sobrevivência.", goal: "Melhore uma arma na oficina", val: () => S("upgrades"), n: 1, rw: { mats: { pecas: 4 } } },
  { name: "Maré morta", text: "O barulho atraiu uma horda inteira. Segure a linha.", goal: "Sobreviva a uma horda", val: () => S("hordes"), n: 1, rw: { money: 600, xp: 250 } },
  { name: "Presente do céu", text: "Um avião ainda voa. Ele joga caixas de suprimentos na cidade.", goal: "Abra uma caixa de suprimentos", val: () => S("airdrops"), n: 1, rw: { mats: { eletronicos: 2 } } },
  { name: "O Forte", text: "Dizem que o Forte resistiu ao primeiro inverno. Descubra se é verdade.", goal: "Descubra a Base 3", val: () => basesFound(), n: 3, rw: { money: 1000, xp: 400 } },
  { name: "Mestre artesão", text: "Com as peças certas, dá para criar armas que ninguém mais tem.", goal: "Crie uma arma especial", val: () => S("crafts"), n: 1, rw: { mats: { nucleo: 1 } } },
  { name: "Mata-gigantes", text: "Os chefes guardam núcleos raros. Cace-os.", goal: "Derrote 3 chefes", val: () => S("bosses"), n: 3, rw: { money: 1500, xp: 600 } },
  { name: "Bastião", text: "Além do Forte, a cidade fica mais escura. O Bastião é o último ponto conhecido.", goal: "Descubra a Base 4", val: () => basesFound(), n: 4, rw: { money: 2500, xp: 800 } },
  { name: "Carne que não morre", text: "Os mutantes investem sem aviso. Aprenda a desviar.", goal: "Elimine 15 mutantes ou abominações", val: () => S("monsters"), n: 15, rw: { mats: { nucleo: 2 } } },
  { name: "A Muralha", text: "Bem a leste, uma muralha de contêineres. Há gente viva lá?", goal: "Descubra a Base 5", val: () => basesFound(), n: 5, rw: { money: 5000, xp: 1500 } },
  { name: "Lenda", text: "Armas lendárias só aparecem onde quase ninguém volta.", goal: "Consiga uma arma Lendária", val: () => S("bestRarity"), n: 4, rw: { money: 5000 } },
  { name: "Fim do mundo", text: "O que comanda a horda está nas áreas pretas e roxas do leste. Acabe com isso.", goal: "Derrote um chefe de área preta, roxa ou cinza", val: () => S("bossR5"), n: 1, rw: { money: 10000, xp: 4000, mats: { nucleo: 3 } } }
];

// ---------- Conquistas (bronze, prata, ouro) ----------
const ACH = [
  { id: "kills", name: "Exterminador", desc: "Elimine zumbis", val: () => S("kills"), t: [100, 1000, 10000] },
  { id: "dogs", name: "Domador", desc: "Elimine cães infectados", val: () => S("dogs"), t: [25, 150, 600] },
  { id: "monsters", name: "Caçador de monstros", desc: "Elimine mutantes e abominações", val: () => S("monsters"), t: [10, 80, 300] },
  { id: "bosses", name: "Mata-chefes", desc: "Derrote chefes", val: () => S("bosses"), t: [1, 10, 40] },
  { id: "searches", name: "Saqueador", desc: "Vasculhe lugares", val: () => S("searches"), t: [50, 500, 3000] },
  { id: "coll", name: "Colecionador", desc: "Encontre armas diferentes", val: () => save.coll.length, t: [10, 25, COLL_TOTAL] },
  { id: "legend", name: "Lendário", desc: "Pegue armas lendárias", val: () => S("legendaries"), t: [1, 5, 15] },
  { id: "dist", name: "Andarilho", desc: "Ande pela cidade (km)", val: () => Math.floor(S("dist") / 10000), t: [5, 50, 250] },
  { id: "nights", name: "Insone", desc: "Sobreviva a noites", val: () => S("nights"), t: [3, 15, 50] },
  { id: "nightKills", name: "Caçador noturno", desc: "Elimine zumbis à noite", val: () => S("nightKills"), t: [100, 1000, 5000] },
  { id: "melee", name: "Lâmina fria", desc: "Elimine zumbis corpo a corpo", val: () => S("meleeKills"), t: [50, 500, 3000] },
  { id: "rifle", name: "Atirador de elite", desc: "Elimine zumbis com rifles", val: () => S("rifleKills"), t: [50, 500, 3000] },
  { id: "fire", name: "Incendiário", desc: "Elimine zumbis com armas de fogo e chamas", val: () => S("fireKills"), t: [50, 400, 2000] },
  { id: "crafts", name: "Artesão", desc: "Crie armas especiais", val: () => S("crafts"), t: [1, 3, 6] },
  { id: "upgrades", name: "Engenheiro", desc: "Melhore armas na oficina", val: () => S("upgrades"), t: [5, 40, 150] },
  { id: "hordes", name: "Muralha humana", desc: "Sobreviva a hordas", val: () => S("hordes"), t: [1, 10, 40] },
  { id: "airdrops", name: "Olhos no céu", desc: "Abra caixas de suprimentos", val: () => S("airdrops"), t: [1, 10, 40] },
  { id: "bank", name: "Banqueiro", desc: "Tenha dinheiro guardado no banco", val: () => save.bank, t: [5000, 50000, 500000] },
  { id: "bases", name: "Explorador", desc: "Descubra bases", val: () => basesFound(), t: [2, 4, 5] },
  { id: "food", name: "Estômago forte", desc: "Coma ou beba", val: () => S("foodEaten"), t: [10, 60, 250] },
  { id: "level", name: "Veterano", desc: "Alcance níveis", val: () => player.level, t: [10, 50, 150] },
  { id: "travels", name: "Passageiro", desc: "Use a viagem rápida", val: () => S("travels"), t: [1, 15, 60] },
  { id: "cars", name: "Pirotécnico", desc: "Exploda carros", val: () => S("carsExploded"), t: [3, 30, 150] }
];
const MEDAL = [{ name: "Bronze", color: "#c08a5a", money: 300, xp: 100 }, { name: "Prata", color: "#c8ccd0", money: 2000, xp: 600 }, { name: "Ouro", color: "#ffd25a", money: 8000, xp: 2500 }];

// ---------- Desafios do dia ----------
const DAILY_POOL = [
  { stat: "kills", n: 60, txt: "Elimine 60 zumbis" }, { stat: "searches", n: 25, txt: "Vasculhe 25 lugares" },
  { stat: "dogs", n: 12, txt: "Elimine 12 cães infectados" }, { stat: "meleeKills", n: 30, txt: "Elimine 30 zumbis corpo a corpo" },
  { stat: "nightKills", n: 40, txt: "Elimine 40 zumbis à noite" }, { stat: "airdrops", n: 1, txt: "Abra uma caixa de suprimentos" },
  { stat: "hordes", n: 1, txt: "Sobreviva a uma horda" }, { stat: "upgrades", n: 2, txt: "Faça 2 melhorias na oficina" },
  { stat: "bosses", n: 1, txt: "Derrote um chefe" }, { stat: "dist", n: 30000, txt: "Ande 3 km" },
  { stat: "itemsTaken", n: 40, txt: "Pegue 40 itens" }, { stat: "rifleKills", n: 25, txt: "Elimine 25 zumbis com rifles" },
  { stat: "fireKills", n: 25, txt: "Elimine 25 zumbis com armas de fogo e chamas" }, { stat: "monsters", n: 3, txt: "Elimine 3 mutantes ou abominações" },
  { stat: "carKills", n: 10, txt: "Elimine 10 zumbis com explosão de carro" }
];
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function ensureDaily() {
  const key = todayKey();
  if (save.daily && save.daily.date === key) return;
  const R = mulberry(parseInt(key.replace(/-/g, ""), 10)), pool = DAILY_POOL.slice(), list = [];
  for (let i = 0; i < 3; i++) list.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
  save.daily = { date: key, base: Object.assign({}, save.stats), list: list.map((d) => ({ stat: d.stat, n: d.n, txt: d.txt, done: false })) };
  persist();
}
function dailyVal(d) { return S(d.stat) - ((save.daily.base && save.daily.base[d.stat]) || 0); }

// ---------- Recompensas ----------
function giveReward(rw, title, sub) {
  const parts = [];
  if (rw.money) { save.bank += rw.money; parts.push(`$${rw.money} no banco`); }
  if (rw.xp) { gainXp(rw.xp); parts.push(`${rw.xp} XP`); }
  if (rw.food) { player.food += rw.food; parts.push(`${rw.food} comida`); }
  if (rw.med) { player.med += rw.med; parts.push(`${rw.med} kit médico`); }
  for (const m in rw.mats || {}) { if (!addMat(m, rw.mats[m], save.vault, VAULT_MAX)) addMat(m, rw.mats[m]); parts.push(`${rw.mats[m]} ${MATS[m].name.toLowerCase()} (baú)`); }
  game.banner = { text: title, sub: sub || parts.join(" · "), t: 3600, gold: true };
  sfx.level(); persist();
}

// ---------- Checagem periódica ----------
function objectivesTick() {
  ensureDaily();
  const h = Math.floor(game.clock / 60) % 24;
  if (game.lastHour != null && game.lastHour < 6 && h >= 6 && game.time > 60000) stat("nights");
  game.lastHour = h;
  const st = STORY[save.story];
  if (st && st.val() >= st.n) { save.story++; giveReward(st.rw, `Capítulo concluído: ${st.name}`); return; }
  for (const a of ACH) {
    const got = save.ach[a.id] || 0;
    if (got < 3 && a.val() >= a.t[got]) {
      save.ach[a.id] = got + 1;
      const m = MEDAL[got];
      giveReward({ money: m.money, xp: m.xp }, `Conquista ${m.name}: ${a.name}`);
      return;
    }
  }
  for (const d of save.daily.list) {
    if (!d.done && dailyVal(d) >= d.n) { d.done = true; giveReward({ money: 800, xp: 300, mats: { pecas: 2, eletronicos: 1 } }, "Desafio do dia concluído!", d.txt); return; }
  }
  if (game.objDirty) { game.objDirty = false; persist(); }
}

// =====================================================================
//  Eventos: caixa de suprimentos e horda
// =====================================================================
function eventsTick(dt) {
  if (game.inside || game.over) return;
  game.evAir -= dt; game.evHorde -= dt;
  if (game.evAir <= 0) { spawnAirdrop(); game.evAir = rand(300000, 480000); }
  if (game.evHorde <= 0 && game.area >= 1) { startHorde(); game.evHorde = rand(360000, 600000); }
  for (const a of game.airdrops) {
    if (a.fall > 0) {
      a.fall -= dt;
      if (a.fall <= 0) { makeNoise(a.x + a.w / 2, a.y + a.h / 2, 900, 0.7); game.flashes.push({ x: a.x + a.w / 2, y: a.y + a.h / 2, r: 90, t: 220 }); toast("A caixa de suprimentos caiu! Zumbis ouviram o barulho"); }
    }
    a.expire -= dt;
  }
  for (const a of game.airdrops.filter((o) => o.expire <= 0 || o.opened)) { world.loot.remove(a); }
  game.airdrops = game.airdrops.filter((o) => o.expire > 0 && !o.opened);
  const hd = game.horde;
  if (hd) {
    hd.timer -= dt;
    while (hd.spawned < hd.total && hd.timer <= 0) {
      hd.timer += 350;
      const perp = hd.dir + Math.PI / 2, off = rand(-320, 320);
      for (let t = 0; t < 8; t++) {
        const x = player.x + Math.cos(hd.dir) * rand(680, 820) + Math.cos(perp) * off, y = player.y + Math.sin(hd.dir) * rand(680, 820) + Math.sin(perp) * off;
        if (x < 20 || y < 20 || x > WORLD_W - 20 || y > WORLD_H - 20 || !walkable(x, y, 16)) continue;
        const r = rowAt(y), z = makeZombie(x, y, pickZType(r), r);
        z.horde = true; alertZombie(z); zombies.push(z); break;
      }
      hd.spawned++;
    }
    const alive = zombies.filter((z) => z.horde && z.hp > 0).length;
    hd.left = alive + (hd.total - hd.spawned);
    if (hd.spawned >= hd.total && alive === 0) {
      if (hd.killed >= hd.total * 0.6) { stat("hordes"); giveReward({ money: Math.round(300 * econ().reward + game.area * 40), xp: 200 + game.area * 40, mats: { sucata: 3, pecas: 2 } }, "Horda derrotada!"); }
      else game.banner = { text: "A horda se dispersou", sub: "Você se afastou demais", t: 2600 };
      game.horde = null;
    }
  }
}
function spawnAirdrop() {
  for (let t = 0; t < 40; t++) {
    const a = Math.random() * 6.283, d = rand(700, 1300), x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d;
    if (x < 40 || y < 40 || x > WORLD_W - 40 || y > WORLD_H - 40 || !walkable(x, y, 30)) continue;
    const o = { x: x - 17, y: y - 15, w: 34, h: 30, kind: "airdrop", table: "airdrop", name: "Caixa de suprimentos", opened: false, fall: 5000, expire: 240000 };
    o.world = world; world.loot.add(o); game.airdrops.push(o);
    game.banner = { text: "Suprimentos caindo!", sub: "Siga a seta amarela até a caixa (some em 4 minutos)", t: 3200, gold: true };
    sfx.level();
    return;
  }
}
function startHorde() {
  const reg = diffOf(game.area), total = Math.round((10 + reg * 5 + (game.area % REGION_ROWS) * 2) * (isNight() ? 1.3 : 1));
  const dir = Math.random() * 6.283;
  game.horde = { total, spawned: 0, killed: 0, timer: 0, dir, left: total };
  const names = ["leste", "nordeste", "norte", "noroeste", "oeste", "sudoeste", "sul", "sudeste"];
  const idx = Math.round(((-dir + 6.283) % 6.283) / (Math.PI / 4)) % 8;
  game.banner = { text: "Uma horda se aproxima!", sub: `Vem do ${names[idx]} · ${total} zumbis · derrube a maioria para ganhar a recompensa`, t: 3600, color: "#e05a4a" };
  game.shake = 6;
  siren(); // sirene avisando a horda
}

// =====================================================================
//  Desenho: caixa no mapa, setas, rastreador e menu de objetivos
// =====================================================================
function drawAirdrops() {
  for (const a of game.airdrops) {
    if (!inView(a.x - 80, a.y - 200, a.w + 160, a.h + 260)) continue;
    const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
    if (a.fall > 0) {
      const k = a.fall / 5000, sy = cy - k * 160, sc = 1 + k * 0.6;
      ctx.fillStyle = `rgba(0,0,0,${0.35 * (1 - k)})`; ellipse(cx + 4, cy + 4, 20 * (1 - k * 0.5), 12 * (1 - k * 0.5));
      ctx.save(); ctx.translate(cx, sy); ctx.scale(sc, sc);
      ctx.fillStyle = "#d8d0b8"; ctx.beginPath(); ctx.arc(0, -34, 26, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "#8a8070"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-26, -34); ctx.lineTo(-10, -6); ctx.moveTo(26, -34); ctx.lineTo(10, -6); ctx.moveTo(0, -60); ctx.lineTo(0, -6); ctx.stroke();
      ctx.fillStyle = "#4a5a3a"; ctx.fillRect(-14, -8, 28, 22); ctx.restore();
      continue;
    }
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(a.x + 4, a.y + 4, a.w, a.h);
    ctx.fillStyle = "#4a5a3a"; ctx.fillRect(a.x, a.y, a.w, a.h);
    ctx.strokeStyle = "#2a3220"; ctx.lineWidth = 2; ctx.strokeRect(a.x + 1, a.y + 1, a.w - 2, a.h - 2);
    ctx.fillStyle = "#e8e0c0"; ctx.fillRect(a.x + a.w / 2 - 2, a.y, 4, a.h);
    const p = 0.5 + 0.5 * Math.sin(game.time / 200);
    ctx.fillStyle = `rgba(255,80,60,${0.5 + 0.5 * p})`; circle(a.x + a.w - 4, a.y + 4, 3);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(255,120,60,${0.15 * p})`; circle(cx, cy, 40); ctx.globalCompositeOperation = "source-over";
  }
}
function drawEventHud() {
  if (game.inside) return;
  for (const a of game.airdrops) {
    const cx = a.x + a.w / 2 - cam.x, cy = a.y + a.h / 2 - cam.y;
    if (cx > 20 && cx < W - 20 && cy > 20 && cy < H - 20) continue;
    const ang = Math.atan2(cy - H / 2, cx - W / 2), r = Math.min(W / 2 - 40, H / 2 - 40) / Math.max(Math.abs(Math.cos(ang)) * (H / W) * 1.6, Math.abs(Math.sin(ang))) * 0.62;
    const ax = clamp(W / 2 + Math.cos(ang) * r * 1.6, 40, W - 40), ay = clamp(H / 2 + Math.sin(ang) * r, 40, H - 40);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); poly([[16, 0], [-8, -10], [-3, 0], [-8, 10]], "#ffd96a"); ctx.restore();
    txt(`${Math.round(Math.hypot(a.x - player.x, a.y - player.y) / 10)} m`, ax, ay + 24, 11, "#ffd96a", "center", true);
  }
  if (game.horde) {
    const hd = game.horde;
    ctx.fillStyle = "rgba(60,10,10,0.75)"; rr(W / 2 - 90, 58, 180, 24, 12); ctx.fill();
    txt(`HORDA · ${hd.left} restantes`, W / 2, 75, 13, "#ff8a6a", "center", true);
  }
}
function drawObjTracker() {
  const st = STORY[save.story];
  if (!st || save.hud === 1) return;
  const x = W - 182, y = 200, v = Math.min(st.val(), st.n);
  ctx.globalAlpha = hudFade("ob", x, y, 172, 40);
  panel(x, y, 172, 40);
  txt(`★ ${st.name}`, x + 8, y + 15, 11, "#ffd96a", "left", true, 156);
  txt(st.goal, x + 8, y + 28, 9, "#c9c4ad", "left", false, 120);
  txt(`${v}/${st.n}`, x + 164, y + 28, 10, "#e5e0c8", "right", true);
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x + 8, y + 33, 156, 3);
  ctx.fillStyle = "#ffd96a"; ctx.fillRect(x + 8, y + 33, 156 * (v / st.n), 3);
  ctx.globalAlpha = 1;
}

const OBJ_TABS = ["História", "Conquistas", "Desafios do dia", "Coleção", "Estatísticas"];
function objKey(k) {
  if (k === "tab" || k === "d" || k === "arrowright") { game.otab = (game.otab + 1) % OBJ_TABS.length; game.oscroll = 0; }
  else if (k === "a" || k === "arrowleft") { game.otab = (game.otab + OBJ_TABS.length - 1) % OBJ_TABS.length; game.oscroll = 0; }
  else if (k === "w" || k === "arrowup") game.oscroll = Math.max(0, game.oscroll - 1);
  else if (k === "s" || k === "arrowdown") game.oscroll++;
}
function progressBar(x, y, w, v, n, color) {
  ctx.fillStyle = "rgba(0,0,0,0.5)"; rr(x, y, w, 8, 3); ctx.fill();
  ctx.fillStyle = color; rr(x, y, Math.max(3, w * clamp(v / n, 0, 1)), 8, 3); ctx.fill();
}
function drawObjectives() {
  game.otab = game.otab || 0; game.oscroll = game.oscroll || 0;
  ensureDaily();
  menuFrame("Objetivos");
  OBJ_TABS.forEach((t, i) => {
    const x = 70 + i * 170, sel = game.otab === i;
    txt(t, x + 70, 82, 14, sel ? "#ffd96a" : "#6d6a58", "center", true);
    if (sel) { ctx.fillStyle = "#ffd96a"; ctx.fillRect(x + 20, 88, 100, 2); }
    regClick(x, 66, 140, 26, () => { game.otab = i; game.oscroll = 0; });
  });
  const tab = game.otab;
  if (tab === 0) {
    const vis = 7, off = clamp(game.oscroll, 0, Math.max(0, STORY.length - vis));
    game.oscroll = off;
    STORY.slice(off, off + vis).forEach((st, j) => {
      const i = off + j, y = 100 + j * 62, done = i < save.story, cur = i === save.story;
      rowBox(40, y, 880, 56, cur, done ? "#6fae4f" : null);
      txt(`Capítulo ${i + 1}`, 54, y + 18, 11, done ? "#6fae4f" : cur ? "#ffd96a" : "#6d6a58", "left", true);
      if (i > save.story) { txt("???", 160, y + 34, 15, "#55534a", "left", true); return; }
      txt(st.name, 160, y + 20, 15, done ? "#8fbf8a" : "#f2eedc", "left", true);
      txt(cur ? st.text : st.goal, 160, y + 40, 12, cur ? "#c9c4ad" : "#7a7868", "left", false, 560);
      if (done) txt("✔ concluído", 906, y + 32, 13, "#6fae4f", "right", true);
      else { const v = Math.min(st.val(), st.n); txt(`${st.goal} · ${v}/${st.n}`, 906, y + 22, 12, "#ffd96a", "right", true, 240); progressBar(726, y + 34, 180, v, st.n, "#ffd96a"); }
    });
    if (save.story >= STORY.length) txt("Você concluiu a história! Continue com conquistas e desafios.", W / 2, 548, 15, "#6fae4f", "center", true);
  } else if (tab === 1) {
    const vis = 9, off = clamp(game.oscroll, 0, Math.max(0, Math.ceil(ACH.length / 2) - vis));
    game.oscroll = off;
    ACH.slice(off * 2, off * 2 + vis * 2).forEach((a, j) => {
      const x = 40 + (j % 2) * 445, y = 100 + Math.floor(j / 2) * 50, got = save.ach[a.id] || 0, v = a.val();
      rowBox(x, y, 435, 44, false, got ? MEDAL[got - 1].color : null);
      for (let m = 0; m < 3; m++) { ctx.fillStyle = m < got ? MEDAL[m].color : "rgba(255,255,255,0.08)"; circle(x + 18 + m * 16, y + 22, 6); }
      txt(a.name, x + 70, y + 18, 13, got ? MEDAL[got - 1].color : "#e5e0c8", "left", true);
      txt(a.desc, x + 70, y + 34, 11, "#a9a58f", "left", false, 190);
      if (got < 3) { txt(`${Math.min(v, a.t[got])}/${a.t[got]} · ${MEDAL[got].name}`, x + 425, y + 18, 11, "#c9c4ad", "right", true); progressBar(x + 265, y + 26, 160, v, a.t[got], MEDAL[got].color); }
      else txt("COMPLETA", x + 425, y + 28, 12, MEDAL[2].color, "right", true);
    });
    const total = ACH.reduce((s, a) => s + (save.ach[a.id] || 0), 0);
    txt(`Medalhas: ${total}/${ACH.length * 3} · recompensas vão para o banco`, W / 2, 560, 12, "#a9a58f", "center");
  } else if (tab === 2) {
    const d = new Date(), left = 24 * 60 - (d.getHours() * 60 + d.getMinutes());
    txt(`Novos desafios em ${Math.floor(left / 60)}h ${left % 60}min · cada um dá $800 + 300 XP + materiais`, W / 2, 116, 13, "#a9a58f", "center");
    save.daily.list.forEach((c, i) => {
      const x = 60 + i * 285, y = 140, v = Math.min(dailyVal(c), c.n);
      rowBox(x, y, 270, 220, false, c.done ? "#6fae4f" : "#d4af37");
      txt(`Desafio ${i + 1}`, x + 135, y + 30, 13, "#d4af37", "center", true);
      txt(c.txt, x + 135, y + 80, 15, "#f2eedc", "center", true, 250);
      const show = c.stat === "dist" ? `${(v / 10000).toFixed(1)}/${c.n / 10000} km` : `${v}/${c.n}`;
      txt(show, x + 135, y + 130, 22, c.done ? "#6fae4f" : "#ffd96a", "center", true);
      progressBar(x + 30, y + 150, 210, v, c.n, c.done ? "#6fae4f" : "#ffd96a");
      txt(c.done ? "✔ concluído" : "em andamento", x + 135, y + 195, 12, c.done ? "#6fae4f" : "#a9a58f", "center", true);
    });
  } else if (tab === 3) {
    const list = WLIST.filter((d) => !d.fists);
    txt(`${save.coll.length}/${list.length} armas encontradas · a cor mostra a raridade`, W / 2, 112, 13, "#a9a58f", "center");
    list.forEach((d, i) => {
      const x = 40 + (i % 8) * 110, y = 124 + Math.floor(i / 8) * 70, has = save.coll.includes(d.id);
      ctx.fillStyle = "rgba(26,26,21,0.95)"; rr(x, y, 104, 64, 5); ctx.fill();
      ctx.strokeStyle = has ? rarColor(d) : "#2e2d26"; ctx.lineWidth = 1; ctx.stroke();
      if (!has) { ctx.globalAlpha = 0.35; ctx.filter = "brightness(0)"; }
      drawWeaponSide(d, x + 52, y + 26, 0.5);
      ctx.filter = "none"; ctx.globalAlpha = 1;
      txt(has ? d.short || d.name : "???", x + 52, y + 57, 10, has ? rarColor(d) : "#55534a", "center", true, 98);
    });
  } else {
    const rows = [["Zumbis eliminados", S("kills")], ["Cães infectados", S("dogs")], ["Mutantes e abominações", S("monsters")], ["Chefes derrotados", S("bosses")],
      ["Eliminações à noite", S("nightKills")], ["Corpo a corpo", S("meleeKills")], ["Com rifles", S("rifleKills")], ["Com fogo e chamas", S("fireKills")],
      ["Lugares vasculhados", S("searches")], ["Itens pegos", S("itemsTaken")], ["Armas lendárias pegas", S("legendaries")], ["Armas criadas", S("crafts")],
      ["Melhorias feitas", S("upgrades")], ["Noites sobrevividas", S("nights")], ["Distância andada", `${(S("dist") / 10000).toFixed(1)} km`], ["Hordas vencidas", S("hordes")],
      ["Caixas de suprimentos", S("airdrops")], ["Viagens rápidas", S("travels")], ["Comida e bebida", S("foodEaten")], ["Mortes", S("deaths")],
      ["Carros explodidos", S("carsExploded")], ["Bases descobertas", `${basesFound()}/${OUTPOSTS.length}`], ["Coleção de armas", `${save.coll.length}/${COLL_TOTAL}`], ["Capítulos da história", `${Math.min(save.story, STORY.length)}/${STORY.length}`], ["Nível", player.level]];
    rows.forEach(([k, v], i) => {
      const x = 60 + (i % 2) * 430, y = 116 + Math.floor(i / 2) * 34;
      rowBox(x, y, 410, 28, false);
      txt(k, x + 12, y + 19, 13, "#c9c4ad"); txt(String(v), x + 398, y + 19, 13, "#ffd96a", "right", true);
    });
  }
  hint("A/D ou Tab trocam de aba · W/S rolam · O, E ou Esc fecha");
}
