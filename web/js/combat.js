"use strict";
// =====================================================================
//  Combate: armas, balas, zumbis (tipos, audição, visão, perseguição),
//  chefes, cuspe ácido e efeitos (sangue, faíscas, cápsulas).
// =====================================================================
function Zs() { return game.inside ? game.inside.zombies : zombies; }
function curCorpses() { return game.inside ? game.inside.corpses : world.corpses; }
function nearObs(x, y, r) { return game.inside ? game.inside.interior : world.obs.query(x - r, y - r, x + r, y + r); }
// Física restrita ao centro da base do poste; nunca ao desenho projetado.
function lampRadius(l) { return l.big ? 3.5 : 2.5; }
function pushOut(e, r) {
  for (const o of nearObs(e.x, e.y, r + 2)) {
    const cx = Math.max(o.x, Math.min(e.x, o.x + o.w)), cy = Math.max(o.y, Math.min(e.y, o.y + o.h));
    const dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
    if (d < r) {
      if (d > 0) {
        // Contato circular nas bordas do retângulo, com deslizamento.
        e.x += dx / d * (r - d); e.y += dy / d * (r - d);
      } else {
        // Centro do personagem DENTRO de um carro/parede: o código
        // antigo movia só r pixels, deixando o jogador preso ou
        // aparentemente atravessando a carroceria durante vários frames.
        // Agora sai diretamente pela borda mais próxima.
        const sides = [
          [e.x - o.x, 0],
          [o.x + o.w - e.x, 1],
          [e.y - o.y, 2],
          [o.y + o.h - e.y, 3]
        ];
        sides.sort((a, b) => a[0] - b[0]);
        const side = sides[0][1];
        if (side === 0) e.x = o.x - r - 0.01;
        else if (side === 1) e.x = o.x + o.w + r + 0.01;
        else if (side === 2) e.y = o.y - r - 0.01;
        else e.y = o.y + o.h + r + 0.01;
      }
    }
  }
  if (!game.inside && world && world.lamps) for (const l of world.lamps) {
    const dx = e.x - l.x, dy = e.y - l.y, dist = Math.hypot(dx, dy);
    const minD = r + lampRadius(l);
    if (dist < minD) {
      if (dist > 0) { e.x += dx / dist * (minD - dist); e.y += dy / dist * (minD - dist); }
      else e.y += minD;
    }
  }
}
function blocked(x, y) { return !!hitObstacle(x, y); }
// Tiros e cuspe passam por cima do que é mais baixo que o personagem (caçamba, caixote, barril, corpo,
// chafariz, cerca e postes decorativos). Param em casa, carro, árvore e objetos altos (contêiner, ruína, torre...).
const LOW_SOLIDS = new Set(["dumpster", "crate", "fountain", "body"]);
function stopsShots(o) { return !o.thin && !o.low && !LOW_SOLIDS.has(o.kind); }
// devolve o obstáculo atingido (ou true para paredes/borda), ou null
function hitObstacle(x, y) {
  if (game.inside) return x < 40 || x > IW() - 40 || y < 40 || y > IH() - 40 || game.inside.interior.some((o) => inRect(x, y, o)) || null;
  if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return true;
  const o = world.obs.at(x, y).find((o) => stopsShots(o) && inRect(x, y, o));
  if (o) return o;
  // Somente o miolo da base do poste bloqueia tiros.
  // Projeção e sombra não têm colisão.
  for (const l of world.lamps) if (Math.hypot(x - l.x, y - l.y) <= lampRadius(l)) return l;
  return null;
}

// ---------- Carros explosivos ----------
function carHit(c, dmg) {
  if (!c.explosive || c.burnt || game.inside) return;
  c.chp -= dmg;
  if (c.chp <= 0 && !(c.fuse > 0)) { c.fuse = 2000; game.fuses.push(c); toast("Esse carro vai explodir! Afaste-se"); }
}
function updateFuses(dt) {
  for (const c of game.fuses) {
    c.fuse -= dt;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    if (Math.random() < dt / 50) game.parts.push({ x: cx + rand(-14, 14), y: cy + rand(-14, 14), vx: rand(-0.3, 0.3), vy: rand(-1.4, -0.4), life: 500, max: 500, color: pick(["#ffb040", "#ff7020", "#555"]), size: rand(2, 5), fr: 0.96 });
    if (c.fuse <= 0) carExplode(c);
  }
  game.fuses = game.fuses.filter((c) => c.fuse > 0 && !c.burnt);
}
function carExplode(c) {
  if (c.burnt) return;
  c.burnt = true; c.fuse = 0; c.wreck = true; c.searchable = false; c.opened = true;
  c.c1 = shade(c.color, -0.7); c.c2 = shade(c.color, -0.6);
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2, r = 150, reg = diffOf(rowAt(cy));
  game.killSrc = "car";
  for (const z of Zs()) {
    const d = Math.hypot(z.x - cx, z.y - cy);
    if (z.hp <= 0 || d > r + z.r) continue;
    hurt(z, (260 + reg * 180) * (1 - d / (r * 1.4)), Math.atan2(z.y - cy, z.x - cx), true, { burn: 25 + reg * 15 });
    if (!z.boss) { const a = Math.atan2(z.y - cy, z.x - cx); z.x += Math.cos(a) * 30; z.y += Math.sin(a) * 30; }
  }
  game.killSrc = null;
  const pd = Math.hypot(player.x - cx, player.y - cy);
  if (pd < r) damagePlayer(20 + 70 * (1 - pd / r));
  for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, s = rand(1, 8); game.parts.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(300, 800), max: 800, color: pick(["#ffd96a", "#ff8a3a", "#e05a2a", "#3a3a3a"]), size: rand(2, 6), fr: 0.88 }); }
  game.flashes.push({ x: cx, y: cy, r: 300, t: 260 });
  game.hazards.push({ x: cx, y: cy, r: 55, t: 7000, max: 7000, dps: 12, kind: "fire", inside: null });
  game.smoke.push({ x: cx, y: cy, t: 14000 });
  embers(cx, cy, 30); scorch(cx, cy, 70);
  game.shake = 16; makeNoise(cx, cy, NOISE_R * 1.6, 1);
  sfx.shot({ cat: "shotguns" }); setTimeout(() => sfx.shot({ cat: "rifles" }), 80);
  stat("carsExploded");
  // reação em cadeia
  for (const o of world.obs.query(cx - 170, cy - 170, cx + 170, cy + 170)) if (o !== c && o.kind === "car") carHit(o, 999);
}

// ---------- Poças e nuvens (veneno, ácido, gás, fogo) ----------
function addHazard(x, y, r, t, dps, kind) { game.hazards.push({ x, y, r, t, max: t, dps, kind, inside: game.inside || null }); if (game.hazards.length > 60) game.hazards.shift(); }
function updateHazards(dt) {
  const sec = dt / 1000, v = save.vest >= 0 ? VESTS[save.vest] : null, resist = 1 - ((v && v.acid) || 0) / 100;
  for (const h of game.hazards) {
    h.t -= dt;
    if (h.inside !== (game.inside || null)) continue;
    if (Math.hypot(player.x - h.x, player.y - h.y) < h.r) {
      if (!adm.god) player.hp -= h.dps * sec * (h.kind === "fire" ? 1 : resist) * (1 - armorRed() * 0.5);
      game.hurtT = Math.max(game.hurtT, 120);
    }
    if (h.kind === "fire") for (const z of Zs()) if (z.hp > 0 && Math.hypot(z.x - h.x, z.y - h.y) < h.r + z.r) { z.burn = 1500; z.burnDps = Math.max(z.burnDps || 0, 25); }
  }
  game.hazards = game.hazards.filter((h) => h.t > 0);
  game.smoke = game.smoke.filter((s) => (s.t -= dt) > 0);
}
function losClear(x0, y0, x1, y1) {
  if (game.inside) return true;
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 20);
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    for (const o of world.obs.at(x, y)) if (o.tall && inRect(x, y, o)) return false;
  }
  return true;
}

// ---------- Armas ----------
function selectWeapon(i) {
  if (player.cur === i) return;
  player.cur = i; player.reloading = 0;
  const it = player.slots[i];
  if (!it) toast(`Slot ${i + 1} vazio · abra a mochila (B) para equipar`);
  else if (!canUse(WDEF[it.id])) toast(`Requisitos: ${reqText(WDEF[it.id])}`);
}
function cycleWeapon(dir) {
  for (let s = 1; s <= SLOT_N; s++) {
    const i = (player.cur + dir * s + SLOT_N * 2) % SLOT_N;
    if (player.slots[i]) { player.cur = i; player.reloading = 0; return; }
  }
}
// Rifles recebem +15% no wStat(). Rifle de Caça usa o tempo total
// dividido pelos 5 cartuchos, para uma recarga progressiva e interruptível.
function startReload() {
  const w = curW(), it = curInst();
  if (game.over || w.melee || !it || player.reloading > 0 || it.ammo >= w.mag) return;
  if (!w.infinite && player.reserve[w.ammo] <= 0) { toast("Sem munição de reserva"); sfx.empty(); return; }
  const reloadTime = wStat(it).reload *
    (1 - Math.max(-0.5, Math.min(0.6, player.fx.reload / 100))) /
    (1 + (A("reload") - 10) * 0.012);
  player.reloadRound = w.id === "caca";
  player.reloadWeapon = it;
  player.reloadMax = player.reloading = player.reloadRound ? reloadTime / w.mag : reloadTime;
  if (player.reloadRound) sfx.reloadRound();
  else sfx.reload();
}
function finishReload() {
  const w = curW(), it = curInst();
  // Trocou de arma durante a recarga: não transfere cartuchos para outra arma.
  if (!it || it !== player.reloadWeapon || w.melee) {
    player.reloading = 0;
    player.reloadRound = false;
    player.reloadWeapon = null;
    return;
  }
  if (player.reloadRound) {
    if (it.ammo < w.mag && player.reserve[w.ammo] > 0) {
      it.ammo += 1;
      player.reserve[w.ammo] -= 1;
    }
    if (it.ammo < w.mag && player.reserve[w.ammo] > 0) {
      player.reloading = player.reloadMax;
      sfx.reloadRound();
    } else {
      player.reloading = 0;
      player.reloadRound = false;
      player.reloadWeapon = null;
    }
    return;
  }
  player.reloading = 0;
  player.reloadWeapon = null;
  if (w.infinite) { it.ammo = w.mag; return; }
  const take = Math.min(w.mag - it.ammo, player.reserve[w.ammo]);
  it.ammo += take; player.reserve[w.ammo] -= take;
}
function explode(x, y, r, dmg) {
  for (const z of Zs()) if (z.hp > 0 && Math.hypot(z.x - x, z.y - y) < r + z.r) hurt(z, dmg, Math.atan2(z.y - y, z.x - x), true);
  if (!game.inside) for (const o of world.obs.query(x - r, y - r, x + r, y + r)) if (o.kind === "car") carHit(o, dmg * 2);
  for (let i = 0; i < 22; i++) { const a = Math.random() * 6.283, s = rand(1, 6); game.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(250, 550), max: 550, color: pick(["#ffd96a", "#ff8a3a", "#e05a2a", "#8fb3ff"]), size: rand(2, 4.5), fr: 0.85 }); }
  game.flashes.push({ x, y, r: r * 2.2, t: 220 });
  embers(x, y, 14); scorch(x, y, r * 0.55);
  game.shake = Math.min(14, game.shake + 6);
  makeNoise(x, y, NOISE_R, 1);
  // Explosão espacial do pacote Military_Free; fallback ao som original.
  if (!fmPlaySample("explosion", {x,y,volume:.90})) sfx.shot({cat:"shotguns"});
}
function hurt(z, dmg, ang, quiet, fx) {
  z.lastMelee = !!(fx && fx.melee);   // o Rastejante só não explode quando morre no corpo a corpo
  let d = dmg * (1 + player.fx.firepower / 100) * adm.dmg * (trindadeActive() ? 1.35 : 1), crit = false;
  if (player.fx.rage && player.hp / player.maxHp < 0.4) d *= 1 + player.fx.rage / 100;
  if (!(fx && fx.noCrit) && Math.random() * 100 < Math.min(85, A("crit") * 0.5 + player.fx.crit + (fx && fx.crit ? fx.crit : 0))) { d *= 2 + player.fx.critDmg / 100; crit = true; }
  // o Capataz bloqueia de frente: atire pelas costas ou pelos lados
  if (z.bossId === "capataz" && ang != null && Math.cos(angDiff(z.angle, ang + Math.PI)) > 0.35) {
    d *= 0.25;
    if (!quiet && Math.random() < 0.3) game.floats.push({ x: z.x, y: z.y - z.r - 10, text: "BLOQUEADO", t: 600 });
  }
  if (z.bossId === "ceifador" && z.phase > 0) d *= 0.2; // sumindo: quase imune
  // Em um setor compartilhado, só o líder altera a vida dos zumbis.
  // Os tiros de outros jogadores são encaminhados ao líder via Broadcast.
  if (typeof fmWorld !== "undefined" && fmWorld.isFollower()) {
    fmWorld.reportHit(z, d, ang);
    z.flash = 90;
    if (!quiet) {
      game.floats.push({ x: z.x, y: z.y - z.r, text: Math.round(d).toString(), t: 700 });
      sfx.hit();
    }
    return d;
  }
  z.hp -= d; z.flash = 90;
  if (player.fx.leech) player.hp = Math.min(player.maxHp, player.hp + Math.min(player.maxHp * 0.05, d * player.fx.leech / 100));
  if (fx && z.hp > 0) {
    if (fx.burn) { z.burn = 3000; z.burnDps = fx.burn * (1 + player.fx.firepower / 100); }
    if (fx.bleed && Math.random() < fx.bleed) { z.bleed = 4000; z.bleedDps = Math.max(z.bleedDps || 0, d * 0.15); }
    if (fx.stun && Math.random() < fx.stun) z.stun = z.boss ? 300 : 900;
  }
  if (!quiet) {
    bloodSpray(z.x, z.y, ang == null ? Math.random() * 6.283 : ang, crit ? 10 : 5);
    game.floats.push({ x: z.x + rand(-6, 6), y: z.y - z.r, text: crit ? `${Math.round(d)}!` : `${Math.round(d)}`, t: 700, crit });
    sfx.hit();
  }
  if (z.hp <= 0) { if (!z.dead) killZombie(z); } else alertZombie(z);
  return d;
}
function attack() {
  const w = curW(), it = curInst(), st = wStat(it);
  player.cooldown = st.delay * (w.infinite ? 1 + 2 * (1 - player.spin) : 1) / Math.max(0.3, 1 + player.fx.atkSpeed / 100);
  if (w.melee) {
    game.slash = player.angle; game.slashT = 200; game.slashR = st.range; game.slashA = w.arc;
    sfx.shot(w);
    if (w.sound > 0) makeNoise(player.x, player.y, NOISE_R * w.sound * 0.6, w.hear);
    for (const z of Zs()) {
      if (z.hp <= 0) continue;
      if (Math.hypot(z.x - player.x, z.y - player.y) > st.range + z.r) continue;
      const zc = zCenter(z); // mira no meio do corpo desenhado
      if (Math.abs(angDiff(Math.atan2(zc.y - player.y, zc.x - player.x), player.angle)) > w.arc && Math.abs(angDiff(Math.atan2(z.y - player.y, z.x - player.x), player.angle)) > w.arc) continue;
      const d = hurt(z, st.dmg * dmgMult(w), player.angle, false, w);
      if (w.lifesteal) player.hp = Math.min(player.maxHp, player.hp + d * w.lifesteal);
      const push = w.knock ? 34 : 8;
      if (!z.boss && z.hp > 0) { z.x += Math.cos(player.angle) * push; z.y += Math.sin(player.angle) * push; }
    }
    return;
  }
  // Direção do projétil = direção estável do corpo/arma, NUNCA
  // vetor da ponta do cano até o mouse (que inverte perto do corpo).
  const aim = player.angle;
  let mx = player.x + Math.cos(aim) * (w.len + 12);
  let my = player.y + Math.sin(aim) * (w.len + 12);
  const mz = muzzlePoint();
  if (mz) { mx = mz.x; my = mz.y; }
  player.shotAng = aim;
  const n = w.pellets || 1;
  for (let i = 0; i < n; i++) {
    const a = aim + (Math.random() - 0.5) * 2 * st.spread * Math.max(0.15, 10 / A("acc")) * (1 - Math.min(0.6, player.fx.accImp / 100));
    const sp = (w.speed || 12) * (w.fire ? rand(0.8, 1.2) : 1);
    bullets.push({ x: mx, y: my, px: mx, py: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: w.life || 900, max: w.life || 900,
      dmg: st.dmg * dmgMult(w), pierce: !!w.pierce, hit: [], big: w.cat === "rifles" || w.rar >= 3, fire: !!w.fire, explode: w.explode || 0, bolt: w.look === "crossbow",
      grenade: !!w.grenade, fx: w, knock: !!w.knock, color: w.rar >= 3 ? RARITY[w.rar].color : null });
  }
  if (!w.fire) {
    player.flashT = 60;
    casing(player.x + Math.cos(player.angle) * 10, player.y + Math.sin(player.angle) * 10, player.angle);
  }
  game.shake = Math.min(10, game.shake + (w.cat === "shotguns" ? 5 : w.cat === "rifles" ? 4 : w.fire ? 0.4 : 1.2));
  if (!w.fire || Math.random() < 0.3) sfx.shot(w);
  if (w.sound > 0) makeNoise(player.x, player.y, NOISE_R * w.sound * (1 - Math.min(0.9, player.fx.silence / 100)), w.hear);
  // munição infinita: o pente de 600 só precisa ser recarregado
  if (w.infinite) { if (!adm.infAmmo) it.ammo--; }
  else if (!adm.infAmmo && Math.random() * 100 >= player.fx.saver) it.ammo--;
  if (it.ammo <= 0) { it.ammo = 0; startReload(); }
}

// ---------- Som, audição e comportamento dos zumbis ----------
function alertZombie(z) {
  if (z.state !== "chase") { z.state = "chase"; z.alertT = 700; }
  z.lose = 0;
}
function makeNoise(x, y, radius, chance) {
  game.pings.push({ x, y, r: radius, t: 350 });
  for (const z of Zs()) {
    if (z.hp <= 0 || z.state === "chase") continue;
    if (Math.hypot(z.x - x, z.y - y) <= radius && Math.random() < chance) alertZombie(z);
  }
}
function idleProps(x, y) {
  return { state: "idle", tx: x, ty: y, wt: 0, rest: 0, wspeed: 0.3 + Math.random() * 0.15, lose: 0, alertT: 0, seen: false, blind: 0 };
}
function moveZ(z, ang, step) { z.x += Math.cos(ang) * step; z.y += Math.sin(ang) * step; }
function wander(z, k, dt) {
  z.wt -= dt;
  if (z.wt <= 0 || Math.hypot(z.tx - z.x, z.ty - z.y) < 8) {
    if (game.inside) { z.tx = rand(80, IW() - 80); z.ty = rand(80, IH() - 160); }
    else {
      z.tx = clamp(z.x + rand(-260, 260), 30, WORLD_W - 30);
      z.ty = clamp(z.y + rand(-200, 200), 30, WORLD_H - 30);
    }
    z.wt = 3000 + Math.random() * 5000;
    z.rest = Math.random() < 0.45 ? 1200 + Math.random() * 2500 : 0;
  }
  if (z.rest > 0) { z.rest -= dt; return 0; }
  z.angle = Math.atan2(z.ty - z.y, z.tx - z.x);
  moveZ(z, z.angle, z.wspeed * k);
  return z.wspeed * k;
}

// ---------- Criação de zumbis e chefes ----------
function pickZType(zone) {
  const list = Object.keys(ZTYPES).filter((k) => ZTYPES[k].from <= zone);
  const wt = (k) => ZTYPES[k].weight * (k === "walker" ? 1 : 1 + zone * 0.08);
  let r = Math.random() * list.reduce((s, k) => s + wt(k), 0);
  for (const k of list) { r -= wt(k); if (r <= 0) return k; }
  return "walker";
}
function makeZombie(x, y, type, zone) {
  const t = ZTYPES[type], R = REGIONS[regionOf(zone)], reg = diffOf(zone), sub = zone % REGION_ROWS;
  const hp = Math.round((120 + sub * 12) * t.hp * R.hp);
  const LOOK = {
    hazmat:   { skin: "#8aa06a", cloth: "#c9a820" },
    infected: { skin: pick(["#c9a07a", "#b08a6a", "#d8b08a"]), cloth: pick(ZCLOTHES) },
    toxic:    { skin: "#7ad04a", cloth: "#3a5a2a" },
    demon:    { skin: "#9a2a22", cloth: "#2a0a0a" }
  }[type];
  const z = Object.assign({
    netId: crypto.randomUUID(), x, y, r: t.r, type, zone, row: zone, hp, maxHp: hp, dmg: (8 + sub) * t.dmg * R.dmg, hitDelay: t.hitDelay || 750,
    speed: Math.min(2.9, (0.7 + Math.random() * 0.35 + reg * 0.1 + sub * 0.02) * t.spd) * (type === "dog" ? 0.8 : 1), hitCd: 0, angle: Math.random() * 6.283,
    burn: 0, bleed: 0, stun: 0, chargeCd: 2000 + Math.random() * 2000, chargeT: 0, windT: 0, slamCd: 1500, slamT: 0,
    skin: pick(ZSKIN), cloth: pick(ZCLOTHES), anim: Math.random() * 10, flash: 0, spitCd: 1500 + Math.random() * 1500,
    stuckT: 0, detourT: 0, detourDir: 1, stains: [Math.random(), Math.random(), Math.random()], lunge: 0
  }, idleProps(x, y));
  if (LOOK) Object.assign(z, LOOK);
  return z;
}
function spawnZombie(x, y, type, zone, list) { (list || zombies).push(makeZombie(x, y, type, zone)); }
// cães vêm em matilha
function spawnGroup(x, y, type, zone, list) {
  const t = ZTYPES[type], n = t.pack ? t.pack[0] + Math.floor(Math.random() * (t.pack[1] - t.pack[0] + 1)) : 1;
  for (let i = 0; i < n; i++) spawnZombie(x + (i ? rand(-30, 30) : 0), y + (i ? rand(-30, 30) : 0), type, zone, list);
}
function spawnBoss(x, y, zone, forceId) {
  const R = REGIONS[regionOf(zone)], reg = diffOf(zone), cell = world.cell;
  const id = forceId || cell.boss || pick(bossesOfRegion(regionOf(zone))), B = BOSSES[id];
  const maxHp = Math.round((1600 + (zone % REGION_ROWS) * 200) * R.hp * B.hp);
  const z = makeZombie(x, y, "brute", zone);
  const saved = cell.boss === id && cell.bossHp != null ? Math.min(maxHp, cell.bossHp) : maxHp;
  Object.assign(z, { r: B.r, boss: true, bossId: id, bossName: B.name, hp: saved, maxHp,
    dmg: (22 + zone) * R.dmg * 0.6, hitDelay: 900, speed: (0.95 + Math.min(0.5, reg * 0.1)) * B.spd * BOSS_SPEED, skin: B.skin, cloth: B.cloth,
    abil: 2500 + Math.random() * 1500, abilT: 0, phase: 0, minions: 0, announced: false });
  zombies.push(z);
  return z;
}
function killZombie(z) {
  z.dead = true; z.hp = Math.min(z.hp, 0);
  game.kills++;
  killBounty(z); // dinheiro por abate, conforme a região
  const kw = curW();
  stat("kills");
  if (z.type === "dog") stat("dogs");
  if (z.type === "mutant" || z.type === "abomination") stat("monsters");
  if (kw.melee) stat("meleeKills");
  if (kw.cat === "rifles") stat("rifleKills");
  if (kw.burn || kw.fire || z.burn > 0) stat("fireKills");
  if (isNight()) stat("nightKills");
  if (z.horde && game.horde) game.horde.killed++;
  if (z.boss) { stat("bosses"); if (regionOf(z.zone) >= 6) stat("bossR5"); }
  if (game.killSrc === "car") stat("carKills");
  if (player.fx.killHeal) player.hp = Math.min(player.maxHp, player.hp + player.fx.killHeal);
  const zt0 = ZTYPES[z.type];
  if (zt0.gas && !z.boss) { addHazard(z.x, z.y, 70, 4500, 6 + diffOf(z.zone) * 3, "gas"); }
  if (zt0.blastDeath && !z.boss && !z.lastMelee) creeperBlast(z);
  if (zt0.acidDeath && !z.boss) { addHazard(z.x, z.y, 60, 5000, 8 + diffOf(z.zone) * 4, "acid"); acidSplash(z.x, z.y); if (Math.hypot(player.x - z.x, player.y - z.y) < 70) damagePlayer(z.dmg * 0.8); }
  if (z.bossId === "matriarca" || z.bossId === "pestilento") addHazard(z.x, z.y, 120, 8000, 15 + diffOf(z.zone) * 5, "acid");
  missionProgress("kill", 1); missionProgress("killcat", 1, curW().cat); missionProgress("killtype", 1, z.type);
  sfx.kill(z); // morte com distância, panorâmica e abafamento
  bloodSpray(z.x, z.y, Math.random() * 6.283, 14);
  addBlood(z.x, z.y, z.r * 1.4);
  const corpses = curCorpses(), zx = ZTYPES[z.type].xp;
  if (z.boss) {
    missionProgress("boss", 1);
    if (!game.inside && world.cell.boss === z.bossId) { world.cell.boss = null; world.cell.bossHp = null; }
    game.score += 150; gainXp(80 + 25 * z.zone);
    corpses.push({ x: z.x - 22, y: z.y - 22, w: 44, h: 44, kind: "corpse", table: "boss", bossId: z.bossId, name: z.bossName || "Chefe", opened: false, life: Infinity,
      ang: Math.random() * 3, skin: z.skin, cloth: z.cloth });
    game.banner = { text: `${z.bossName || "Chefe"} derrotado!`, sub: "Vasculhe o corpo (E): arma, colete ou implante", t: 3000, gold: true };
    return;
  }
  game.score += Math.round(10 * zx);
  gainXp((8 + 1.5 * z.zone) * zx);
  // zumbi morto não deixa saque: o corpo fica um pouco e some
  if (Math.random() < 0.5) {
    const s = z.r * 2;
    corpses.push({ x: z.x - s / 2, y: z.y - s / 2, w: s, h: s, kind: "corpse", table: "corpse", name: "Corpo", opened: true,
      life: 15000, ang: Math.random() * 3, skin: z.skin, cloth: z.cloth });
    if (corpses.length > 30) { const i = corpses.findIndex((c) => c.table !== "boss"); if (i >= 0) corpses.splice(i, 1); }
  }
}
// Rastejante abatido a distância: explode (fere quem estiver perto, inclusive outros zumbis e o jogador)
const CREEPER_BLAST_R = 78;
function creeperBlast(z) {
  const reg = diffOf(z.zone);
  explode(z.x, z.y, CREEPER_BLAST_R, 70 + reg * 45);
  const d = Math.hypot(player.x - z.x, player.y - z.y);
  if (d < CREEPER_BLAST_R + 12) damagePlayer(z.dmg * 2.2 * (1 - 0.6 * d / (CREEPER_BLAST_R + 12)));
  for (let i = 0; i < 16; i++) {               // fumaça escura da criatura
    const a = Math.random() * 6.283, s = rand(0.6, 2.4);
    game.parts.push({ x: z.x, y: z.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.4, life: rand(500, 900), max: 900, color: pick(["#1a1418", "#2a2028", "#3a1a22"]), size: rand(4, 8), fr: 0.92 });
  }
}
function damagePlayer(dmg) {
  if (adm.god || performance.now() < (player.defyUntil || 0)) return;
  // Teto por ataque evita morte instantânea mesmo na Zona Morta.
  const d = Math.min(dmg * (1 - armorRed()), Math.max(6, player.maxHp * 0.28));
  player.hp -= d;
  wearVest(d);
  game.hurtT = 350; game.shake = Math.min(12, game.shake + 3 + d * 0.15);
  sfx.hurt();
  bloodSpray(player.x, player.y, Math.random() * 6.283, 4);
}

// ---------- Atualização: balas, cuspe e zumbis ----------
function updateBullets(dt, k) {
  const list = Zs();
  for (const b of bullets) {
    b.px = b.x; b.py = b.y;
    for (let s = 0; s < 2 && b.life > 0; s++) {
      b.x += (b.vx * k) / 2; b.y += (b.vy * k) / 2;
      const ob = hitObstacle(b.x, b.y);
      if (ob) {
        b.life = 0;
        if (ob.kind === "car") carHit(ob, b.dmg);
        if (!b.fire && Math.random() < 0.32)
          fmPlaySample(ob.kind === "car" || ob.kind === "fence" ? "hit_metal" : "hit_concrete",
            { x:b.x, y:b.y, volume:.26 });
        if (b.explode) explode(b.x, b.y, b.explode, b.dmg * (b.grenade ? 1 : 0.5)); else if (!b.fire) sparks(b.x, b.y);
        break;
      }
      for (const z of list) {
        if (z.hp <= 0 || b.hit.includes(z) || zDist(z, b.x, b.y) >= z.r + (b.fire ? 8 : 3)) continue; // corpo inteiro, não só os pés
        if (b.grenade) { b.life = 0; explode(b.x, b.y, b.explode, b.dmg); break; }
        if (!z.boss && !b.fire) { const kb = b.knock ? 1.2 : 0.3; z.x += b.vx * kb; z.y += b.vy * kb; }
        if (b.fire) { b.hit.push(z); hurt(z, b.dmg, null, Math.random() < 0.7, b.fx); continue; }
        hurt(z, b.dmg, Math.atan2(b.vy, b.vx), false, b.fx);
        if (b.explode) { b.life = 0; explode(b.x, b.y, b.explode, b.dmg * 0.5); break; }
        if (b.pierce) { b.hit.push(z); b.dmg *= 0.8; } else { b.life = 0; break; }
      }
    }
    b.life -= dt;
  }
  bullets = bullets.filter((b) => b.life > 0);
}
function spit(z) {
  const a = Math.atan2(player.y - z.y, player.x - z.x);
  game.spits.push({ x: z.x + Math.cos(a) * 14, y: z.y + Math.sin(a) * 14, vx: Math.cos(a) * 5.5, vy: Math.sin(a) * 5.5, life: 1400, dmg: z.dmg * 1.1 });
  sfx.spit();
}
function updateSpits(dt, k) {
  for (const s of game.spits) {
    s.x += s.vx * k; s.y += s.vy * k; s.life -= dt;
    if (blocked(s.x, s.y)) { s.life = 0; acidSplash(s.x, s.y); continue; }
    if (Math.hypot(s.x - player.x, s.y - player.y) < player.r + 5) { s.life = 0; damagePlayer(s.dmg); addInfection(null, 0.6); acidSplash(s.x, s.y); }
  }
  game.spits = game.spits.filter((s) => s.life > 0);
}
// ---------- Ataques especiais dos chefes ----------
// devolve true quando o chefe está ocupado com o ataque (não anda normal neste quadro)
function bossAbility(z, d, dt, k) {
  const id = z.bossId, reg = diffOf(z.zone);
  z.abil -= dt;
  const minions = () => zombies.filter((m) => m.mother === z && m.hp > 0).length;
  const summon = (type, n) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283; const m = makeZombie(z.x + Math.cos(a) * (z.r + 20), z.y + Math.sin(a) * (z.r + 20), type, z.zone); m.mother = z; alertZombie(m); zombies.push(m); } };
  if (z.abilT > 0) {
    z.abilT -= dt;
    if (id === "carrasco") { // giro com a serra
      z.angle += 0.5 * k; moveZ(z, Math.atan2(player.y - z.y, player.x - z.x), z.speed * 1.2 * k); pushOut(z, z.r);
      z.spinTick = (z.spinTick || 0) - dt;
      if (z.spinTick <= 0) { z.spinTick = 250; if (d < 100) damagePlayer(z.dmg * 0.45); }
      return true;
    }
    if (z.abilT <= 0) {
      if (id === "acougueiro" && d < 105 && Math.abs(angDiff(z.angle, Math.atan2(player.y - z.y, player.x - z.x))) < 1.1) { damagePlayer(z.dmg * 1.5); game.shake = 10; }
      if (id === "capataz") { game.flashes.push({ x: z.x, y: z.y, r: 120, t: 200 }); if (d < 110) damagePlayer(z.dmg); game.shake = 8; }
      if (id === "ceifador") {
        if (z.phase > 0) { // reaparece atrás de você e golpeia
          const a = player.angle + Math.PI;
          z.x = player.x + Math.cos(a) * 70; z.y = player.y + Math.sin(a) * 70; pushOut(z, z.r);
          z.phase = 0; z.abilT = 320; z.angle = Math.atan2(player.y - z.y, player.x - z.x);
          return true;
        }
        if (Math.hypot(player.x - z.x, player.y - z.y) < 115) { damagePlayer(z.dmg * 1.6); game.shake = 10; }
      }
    }
    return true;
  }
  if (z.abil > 0) return false;
  switch (id) {
    case "acougueiro": if (d < 90) { z.abilT = 450; z.abil = 2400; z.angle = Math.atan2(player.y - z.y, player.x - z.x); return true; } break;
    case "matriarca": if (minions() < 8) { summon("walker", 2); z.abil = 6000; } break;
    case "capataz": if (d < 100) { z.abilT = 600; z.abil = 4500; return true; } break;
    case "pestilento": addHazard(z.x, z.y, 34, 6000, 8 + reg * 4, "poison"); z.abil = 900; break;
    case "carrasco": if (d < 150) { z.abilT = 1400; z.abil = 5500; return true; } break;
    case "necromante": if (minions() < 9) { summon(reg >= 3.3 ? "infected" : "walker", 3); game.flashes.push({ x: z.x, y: z.y, r: 90, t: 200 }); z.abil = 7000; } break;
    case "alfa": if (minions() < 6) { summon("dog", 3); z.abil = 10000; toast("O Alfa uivou: cães a caminho!"); } break;
    case "ceifador": if (d < 500) { z.phase = 1; z.abilT = 600; z.abil = 5000; return true; } break;
  }
  return false;
}
function updateZombies(dt, k) {
  const list = Zs();
  for (const z of list) {
    if (z.hp <= 0) continue;
    if (z.flash > 0) z.flash -= dt;
    if (z.lunge > 0) z.lunge -= dt;
    // fogo e sangramento
    if (z.burn > 0) {
      z.burn -= dt; z.hp -= z.burnDps * dt / 1000;
      if (Math.random() < dt / 60) game.parts.push({ x: z.x + rand(-z.r, z.r), y: z.y + rand(-z.r, z.r), vx: rand(-0.3, 0.3), vy: rand(-1.2, -0.4), life: 350, max: 350, color: pick(["#ffb040", "#ff7020", "#ffd060"]), size: rand(2, 4), fr: 0.95 });
    }
    if (z.bleed > 0) {
      z.bleed -= dt; z.hp -= z.bleedDps * dt / 1000;
      if (Math.random() < dt / 300) addBlood(z.x + rand(-6, 6), z.y + rand(-6, 6), rand(2, 4));
    }
    if (z.hp <= 0) { if (!z.dead) killZombie(z); continue; }
    if (z.stun > 0) { z.stun -= dt; continue; }
    const dx = player.x - z.x, dy = player.y - z.y, d = Math.hypot(dx, dy) || 1;
    if (adm.freeze) continue;
    const zt = ZTYPES[z.type];
    // pancada no chão da abominação (área)
    if (zt.slam && z.state === "chase") {
      z.slamCd -= dt;
      if (z.slamT > 0) {
        z.slamT -= dt;
        if (z.slamT <= 0) {
          game.flashes.push({ x: z.x, y: z.y, r: 130, t: 220 }); game.shake = Math.min(14, game.shake + 7);
          for (let i = 0; i < 14; i++) { const a = Math.random() * 6.283; game.parts.push({ x: z.x + Math.cos(a) * 30, y: z.y + Math.sin(a) * 30, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, life: 400, max: 400, color: "#6a5a4a", size: 4, fr: 0.85 }); }
          if (d < 115) damagePlayer(z.dmg * 1.2);
        }
        continue;
      }
      if (d < 95 && z.slamCd <= 0) { z.slamT = 500; z.slamCd = 3200; continue; }
    }
    // chefe anuncia quando te vê
    if (z.boss && z.state === "chase" && !z.announced) {
      z.announced = true;
      game.banner = { text: z.bossName || "Chefe", sub: `apareceu! · deixa: ${BOSSES[z.bossId] ? BOSSES[z.bossId].drop : "saque raro"}`, t: 3200, color: "#e05a4a" };
    }
    if (z.boss && z.state === "chase" && bossAbility(z, d, dt, k)) continue;
    // investida (mutante, chefes) e salto (demônio, Alfa)
    const chg = !z.boss
      ? (zt.charge ? { w: 380, t: 650, m: 3.4, cd: 3800, min: 70, max: 300 } : zt.leap ? { w: 220, t: 330, m: 4.4, cd: 2600, min: 90, max: 240 } : null)
      : z.bossId === "alfa" ? { w: 250, t: 380, m: 4.2, cd: 2400, min: 80, max: 300 }
      : (z.bossId === "acougueiro" || z.bossId === "carrasco") ? { w: 500, t: 600, m: 3, cd: 5000, min: 110, max: 320 } : null;
    if (chg && z.state === "chase") {
      z.chargeCd -= dt;
      if (z.windT > 0) { z.windT -= dt; if (z.windT <= 0) z.chargeT = chg.t; continue; }
      if (z.chargeT > 0) {
        z.chargeT -= dt;
        moveZ(z, z.chargeAng, z.speed * chg.m * k); pushOut(z, z.r);
        if (d < z.r + player.r + 4 && z.hitCd <= 0) { damagePlayer(z.dmg * 1.3); addInfection(z, 1.3); z.hitCd = z.hitDelay; z.chargeT = 0; game.shake = Math.min(14, game.shake + 5); }
        z.hitCd -= dt;
        continue;
      }
      if (d < chg.max && d > chg.min && z.chargeCd <= 0 && losClear(z.x, z.y, player.x, player.y)) {
        z.windT = chg.w; z.chargeAng = Math.atan2(dy, dx); z.angle = z.chargeAng; z.chargeCd = chg.cd + Math.random() * 1500;
        continue;
      }
    }
    // tóxico deixa rastro de veneno
    if (zt.puddle && z.state === "chase") {
      z.puddleCd = (z.puddleCd || 0) - dt;
      if (z.puddleCd <= 0) { addHazard(z.x, z.y, 24, 4000, 4 + diffOf(z.zone) * 2, "poison"); z.puddleCd = 1400; }
    }
    if (!game.inside && d > 1400) continue; // longe demais: parado
    if (z.alertT > 0) z.alertT -= dt;
    const ox = z.x, oy = z.y;
    if (z.state === "idle") {
      let sight = (z.boss ? 130 : SIGHT_R) * (player.sprinting ? 2 : 1) * (1 - Math.min(0.9, player.fx.silence / 100)) / (1 + (A("silence") - 10) * 0.015);
      if (game.inside) sight *= 2.2;
      if (d < sight && losClear(z.x, z.y, player.x, player.y)) {
        if (!z.seen) { z.seen = true; z.blind = Math.random() * 100 < Math.min(75, A("stealth") + player.fx.stealthImp + ((save.vest >= 0 && VESTS[save.vest].stealth) || 0)) ? 4000 : 0; }
        if (z.blind > 0) z.blind -= dt; else alertZombie(z);
      } else z.seen = false;
    }
    let step = 0;
    if (z.state === "chase") {
      let ang = Math.atan2(dy, dx);
      if (z.detourT > 0) { z.detourT -= dt; ang += z.detourDir * 1.2; }
      step = z.speed * k;
      // cão recua depois de morder
      if (z.recoilT > 0) { z.recoilT -= dt; ang += Math.PI; step = z.speed * 0.6 * k; }
      // infectado desvia quando você mira nele
      if (zt.dodge) {
        z.dodgeCd = (z.dodgeCd || 0) - dt;
        if (z.dodgeT > 0) { z.dodgeT -= dt; ang += z.dodgeDir * 1.5; step *= 1.8; }
        else if (mouse.down && d < 420 && z.dodgeCd <= 0 && Math.abs(angDiff(player.angle, Math.atan2(z.y - player.y, z.x - player.x))) < 0.15) {
          z.dodgeT = 260; z.dodgeDir = Math.random() < 0.5 ? -1 : 1; z.dodgeCd = 1800 + Math.random() * 800;
        }
      }
      if ((ZTYPES[z.type].ranged && !z.boss) || z.bossId === "necromante") {
        z.spitCd -= dt;
        if (d < 330 && losClear(z.x, z.y, player.x, player.y)) {
          if (d < 170) step = -z.speed * 0.6 * k; else if (d < 290) step = 0;
          if (z.spitCd <= 0) { spit(z); z.spitCd = z.boss ? 900 : 2200 + Math.random() * 1200; }
        }
      }
      if (step !== 0) moveZ(z, ang, step);
      z.angle = Math.atan2(dy, dx);
      z.lose = d > 560 ? z.lose + dt : 0;
      if (z.lose > 6000) { z.state = "idle"; z.wt = 0; }
      if (Math.random() < dt / 5000) sfx.groan(clamp(1 - d / 700, 0, 1), z);
    } else step = wander(z, k, dt);
    pushOut(z, z.r);
    if (game.inside) { z.x = clamp(z.x, 56, IW() - 56); z.y = clamp(z.y, 56, IH() - 56); }
    else { z.x = clamp(z.x, z.r, WORLD_W - z.r); z.y = clamp(z.y, z.r, WORLD_H - z.r); }
    // preso atrás de uma parede? tenta contornar
    if (z.state === "chase" && step > 0) {
      if (Math.hypot(z.x - ox, z.y - oy) < step * 0.35) {
        z.stuckT += dt;
        if (z.stuckT > 250 && z.detourT <= 0) { z.detourT = 700 + Math.random() * 500; z.detourDir = Math.random() < 0.5 ? -1 : 1; z.stuckT = 0; }
      } else z.stuckT = 0;
    }
    z.anim += Math.abs(step) * 0.12;
    z.hitCd -= dt;
    // Colosso: você empurra os infectados comuns; correndo, derruba (e corta o cuspe)
    if (player.flags.jugger && !z.boss && d < z.r + player.r + 4) {
      z.x -= (dx / d) * 3; z.y -= (dy / d) * 3;
      if (player.sprinting) { z.stun = 700; z.spitCd = Math.max(z.spitCd || 0, 1500); z.hitCd = Math.max(z.hitCd, 400); continue; }
    }
    if (d < z.r + player.r + 2 && z.hitCd <= 0) { alertZombie(z); damagePlayer(z.dmg); addInfection(z); z.hitCd = z.hitDelay; z.lunge = 160; if (z.type === "dog") z.recoilT = 400; }
  }
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, min = a.r + b.r;
    if (d < min) {
      const p = (min - d) / 2, nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
      a.x += nx * p; a.y += ny * p; b.x -= nx * p; b.y -= ny * p;
    }
  }
}

// ---------- Efeitos ----------
function bloodSpray(x, y, ang, n) {
  for (let i = 0; i < n; i++) {
    const a = ang + rand(-0.7, 0.7), s = rand(1, 4.5);
    game.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(250, 500), max: 500, color: pick(["#7a0f0f", "#9b1b1b", "#5e0a0a"]), size: rand(1.5, 3.5), fr: 0.86 });
  }
  if (Math.random() < 0.6) addBlood(x + Math.cos(ang) * rand(6, 20), y + Math.sin(ang) * rand(6, 20), rand(3, 8));
}
function addBlood(x, y, r) {
  const list = game.inside ? game.inside.decals : world.blood, pts = [];
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) pts.push([rand(-r, r) * 0.8, rand(-r, r) * 0.8, r * rand(0.4, 0.9)]);
  list.push({ x, y, r, a: rand(0.45, 0.8), pts });
  if (list.length > 280) list.shift();
}
// marca de queimado no chão
function scorch(x, y, r) {
  const list = game.inside ? game.inside.decals : world.blood, pts = [];
  for (let i = 0; i < 6; i++) pts.push([rand(-r, r) * 0.5, rand(-r, r) * 0.5, r * rand(0.35, 0.7)]);
  list.push({ x, y, r, a: 0.45, pts, c: "18,16,14" });
  if (list.length > 280) list.shift();
}
function sparks(x, y) {
  for (let i = 0; i < 4; i++) { const a = Math.random() * 6.283, s = rand(1, 3); game.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 160, max: 160, color: "#ffd96a", size: 1.6, fr: 0.8 }); }
}
function acidSplash(x, y) {
  for (let i = 0; i < 8; i++) { const a = Math.random() * 6.283, s = rand(0.5, 2.5); game.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 420, max: 420, color: "#8fd14f", size: rand(2, 4), fr: 0.85 }); }
}
function casing(x, y, ang) {
  const a = ang + Math.PI / 2 + rand(-0.4, 0.4), s = rand(1.5, 3);
  game.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1400, max: 1400, color: "#c9a23a", size: 2, fr: 0.88, shell: true, rot: Math.random() * 6, rotv: rand(-0.4, 0.4) });
  // fumaça saindo do cano
  const mx = x + Math.cos(ang) * 22, my = y + Math.sin(ang) * 22;
  for (let i = 0; i < 2; i++) game.parts.push({ x: mx, y: my, vx: Math.cos(ang) * rand(0.3, 0.9) + rand(-0.2, 0.2), vy: Math.sin(ang) * rand(0.3, 0.9) + rand(-0.2, 0.2), life: 600, max: 600, color: "rgba(200,200,195,0.22)", size: rand(2, 4), grow: 0.12, fr: 0.93 });
}
// poeira dos passos ao correr
function dust(x, y) { game.parts.push({ x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-0.2, 0.2), vy: rand(-0.2, 0.2), life: 500, max: 500, color: "rgba(150,140,120,0.25)", size: rand(2, 3.5), grow: 0.08, fr: 0.9 }); }
// faíscas e brasas de explosão (brilham com o WebGL)
function embers(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = rand(2, 7);
    game.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(400, 900), max: 900, color: pick(["#ffd060", "#ffb040", "#ff7020", "#fff0b0"]), size: rand(1.2, 2.6), fr: 0.9 });
  }
}
function updateParts(dt, k) {
  for (const p of game.parts) {
    p.x += p.vx * k; p.y += p.vy * k; p.vx *= p.fr; p.vy *= p.fr; p.life -= dt;
    if (p.rotv) { p.rot += p.rotv * k; p.rotv *= 0.9; }
    if (p.grow) p.size += p.grow * k;
    // cápsulas ficam no chão por um tempo
    if (p.shell && p.life <= 0 && !game.inside) {
      world.shells = world.shells || [];
      world.shells.push({ x: p.x, y: p.y, rot: p.rot, t: 40000 });
      if (world.shells.length > 160) world.shells.shift();
    }
  }
  if (world.shells) world.shells = world.shells.filter((s) => (s.t -= dt) > 0);
  game.parts = game.parts.filter((p) => p.life > 0);
  if (game.parts.length > 400) game.parts.splice(0, game.parts.length - 400);
}
