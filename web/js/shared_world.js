"use strict";
// Fronteira Morta 2.2 - relógio/clima global e zumbis compartilhados por setor.
// Enquanto há jogadores no setor, o navegador eleito simula os zumbis e envia
// snapshots aos demais. Isso NÃO é um servidor autoritativo antitrapaça.
const fmWorld = (() => {
  const BASE_EPOCH = Date.UTC(2026, 10, 16, 0, 0, 0);
  const WEATHER_PERIOD_MS = 240000; // O clima muda globalmente a cada 4 minutos reais.
  const SNAPSHOT_MS = 360;
  let epoch = BASE_EPOCH, offsetMs = 0, timeReady = false, loading = false;
  let lastClockFetch = 0, channel = null, channelReady = false;
  let lastSnapshot = 0, lastReceived = 0, lastLeader = "", seq = 0;
  let channelLocation = "", stream = "", lastStream = "";
  let started = false, snapshotBusy = false;
  const id = () => typeof fmCloud !== "undefined" && fmCloud.userId ? fmCloud.userId() : null;
  const db = () => typeof fmCloud !== "undefined" && fmCloud.socialClient ? fmCloud.socialClient() : null;
  const nowMs = () => Date.now() + offsetMs;

  async function syncClock() {
    if (loading || !db() || !id()) return;
    loading = true;
    const t0 = Date.now();
    try {
      const { data, error } = await db().rpc("fm_hora_global");
      const t1 = Date.now();
      if (error || !Array.isArray(data) || !data[0]) throw error || new Error("Relógio indisponível");
      const start = Number(data[0].inicio_ms), server = Number(data[0].agora_ms);
      if (!Number.isFinite(start) || !Number.isFinite(server)) throw new Error("Resposta inválida do relógio");
      epoch = start;
      offsetMs = server - (t0 + t1) / 2;
      timeReady = true;
    } catch (err) {
      console.warn("Sem relógio do servidor; usando horário UTC aproximado.", err);
    } finally {
      loading = false;
      lastClockFetch = Date.now();
    }
  }
  function start() {
    if (started) return;
    started = true;
    syncClock();
  }
  function timeOfWorld() {
    return timeReady ? Math.max(0, nowMs() - epoch) : 0; // aguarda a hora oficial do servidor
  }
  // Mantém o número do dia e o horário já alcançados, sem voltar o relógio
  // na atualização. Antes: um dia a cada 8 min; a partir desta versão:
  // 1440 min virtuais a cada 600000 ms reais, exatamente 10 min por dia.
  // O marco UTC é comum a todos, preservando a sincronização multiplayer.
  const DAY_CYCLE_CHANGE_UTC = Date.UTC(2026, 10, 16, 23, 45, 0);
  const MINUTES_PER_REAL_MS = 1440 / (10 * 60 * 1000);
  function clock() {
    const elapsed = timeOfWorld();
    const oldElapsed = Math.min(elapsed, Math.max(0, DAY_CYCLE_CHANGE_UTC - epoch));
    return 480 + oldElapsed * 0.003 + (elapsed - oldElapsed) * MINUTES_PER_REAL_MS;
  }
  function weatherKind() {
    const phase = Math.floor(timeOfWorld() / WEATHER_PERIOD_MS) >>> 0;
    // Hash determinístico, igual para todos, independentemente do aparelho.
    let h = Math.imul(phase ^ 0x5f3759df, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    const r = (h >>> 0) / 4294967296;
    return r < 0.5 ? 0 : r < 0.7 ? 1 : r < 0.92 ? 2 : 3;
  }
  function worldClockTick() {
    if (typeof game !== "undefined" && game) game.clock = clock();
    if (started && Date.now() - lastClockFetch > 180000) syncClock();
  }

  function sectorKey() {
    return world && world.cell ? world.cell.cx + ":" + world.cell.cy + ":" + fmSocial.location() : "";
  }
  function leader() {
    const mine = id();
    if (!mine || !world || !game || game.hub) return null;
    const mineActive = !(game.paused || game.menu || game.shop || game.over || game.found);
    const players = mineActive ? [{ uid: mine, since: typeof fmSocial !== "undefined" ? fmSocial.mySectorSince() : 0 }] : [];
    // O jogador que entrou primeiro na rua coordena o setor.
    if (typeof fmSocial !== "undefined") for (const p of fmSocial.online()) {
      if (fmSocial.sameLocation(p) && p.active !== false && p.uid)
        players.push({ uid: p.uid, since: p.since || 0 });
    }
    players.sort((a, b) => (a.since || Infinity) - (b.since || Infinity) || a.uid.localeCompare(b.uid));
    return players[0] ? players[0].uid : mine;
  }
  function isAuthority() {
    if (!channelReady || !channel || channelLocation !== sectorKey() || !world || game.hub) return true;
    return leader() === id();
  }
  function isFollower() {
    return !!(channelReady && channel && channelLocation === sectorKey() && game && !game.hub && leader() && leader() !== id());
  }

  function onChannel(next) {
    channel = next;
    channelLocation = sectorKey();
    stream = crypto.randomUUID();
    lastStream = "";
    channelReady = false;
    lastReceived = 0;
    lastLeader = "";
    seq = 0;
    next.on("broadcast", { event: "zombies" }, event => { if (channel === next) receiveZombies(event); });
    next.on("broadcast", { event: "zombie-hit" }, event => { if (channel === next) receiveHit(event); });
    next.on("broadcast", { event: "zombie-sync" }, event => { if (channel === next) receiveRequest(event); });
  }
  function onChannelReady(next) {
    if (channel !== next) return;
    channelReady = true;
    lastSnapshot = 0;
    requestSync();
  }
  function requestSync() {
    if (!channel || !channelReady || !isFollower()) return;
    channel.send({ type: "broadcast", event: "zombie-sync",
      payload: { cx: world.cell.cx, cy: world.cell.cy, location: fmSocial.location(), from: id() } }).catch(() => {});
  }
  function receiveRequest(event) {
    const p = event && event.payload;
    if (!p || !channelReady || !isAuthority() || !world ||
        !fmSocial.sameLocation(p)) return;
    sendSnapshot(true);
  }
  function packedZombie(z) {
    if (!z.netId) z.netId = crypto.randomUUID();
    return {
      netId: z.netId, type: z.type, zone: z.zone, x: Math.round(z.x * 10) / 10,
      y: Math.round(z.y * 10) / 10, hp: Math.round(z.hp), maxHp: z.maxHp,
      r: z.r, angle: z.angle, state: z.state, anim: z.anim,
      boss: !!z.boss, bossId: z.bossId || null, bossName: z.bossName || null,
      speed: z.speed, dmg: z.dmg, hitDelay: z.hitDelay,
      skin: z.skin, cloth: z.cloth, stains: z.stains, flash: z.flash,
      burn: z.burn, burnDps: z.burnDps, bleed: z.bleed, bleedDps: z.bleedDps,
      stun: z.stun, alertT: z.alertT, chargeT: z.chargeT, windT: z.windT,
      phase: z.phase, abil: z.abil, abilT: z.abilT, slamT: z.slamT,
      half: z.half, horde: z.horde, wave1: z.wave1
    };
  }
  function sendSnapshot(force) {
    if (!channelReady || !channel || channelLocation !== sectorKey() || !isAuthority() || !world || game.trans || snapshotBusy) return;
    // Sem outro jogador nesta rua, não consuma a cota gratuita de Realtime.
    if (!force && typeof fmSocial !== "undefined" && !fmSocial.online().some(p =>
      fmSocial.sameLocation(p))) return;
    const now = performance.now();
    if (!force && now - lastSnapshot < SNAPSHOT_MS) return;
    lastSnapshot = now;
    const data = {
      cx: world.cell.cx, cy: world.cell.cy, location: fmSocial.location(), host: id(), stream, seq: ++seq,
      ts: Date.now(), zombies: Zs().filter(z => z.hp > 0).slice(0, 100).map(packedZombie),
      boss: world.cell.boss || null, bossHp: world.cell.bossHp || null
    };
    snapshotBusy = true;
    Promise.resolve(channel.send({ type: "broadcast", event: "zombies", payload: data }))
      .catch(err => console.warn("Falha ao compartilhar zumbis:", err))
      .finally(() => { snapshotBusy = false; });
  }
  function receiveZombies(event) {
    const data = event && event.payload;
    if (!data || !isFollower() || !world || !Array.isArray(data.zombies) ||
        !fmSocial.sameLocation(data) || data.host !== leader()) return;
    if (data.zombies.length > 100) return;
    if (data.host === lastLeader && data.stream === lastStream && data.seq <= lastReceived) return;
    if (data.host !== lastLeader) { lastReceived = 0; lastLeader = data.host; }
    lastReceived = data.seq;
    lastStream = data.stream;
    const previous = new Map(Zs().filter(z => z.netId).map(z => [z.netId, z]));
    const now = performance.now(), next = [];
    for (const d of data.zombies) {
      if (!d || typeof d.netId !== "string" || !ZTYPES[d.type] ||
          !Number.isFinite(d.x) || !Number.isFinite(d.y) ||
          d.x < 0 || d.y < 0 || d.x > IW() || d.y > IH() ||
          !Number.isFinite(d.hp) || d.hp <= 0 || !Number.isFinite(d.maxHp)) continue;
      let z = previous.get(d.netId);
      const wasNew = !z;
      if (!z) z = makeZombie(d.x, d.y, d.type, world.cell.zone);
      const fromX = z.x, fromY = z.y;
      Object.assign(z, d);
      const skipLerp = wasNew || Math.hypot(fromX - d.x, fromY - d.y) > 140;
      z.netFromX = skipLerp ? d.x : fromX;
      z.netFromY = skipLerp ? d.y : fromY;
      z.netToX = d.x;
      z.netToY = d.y;
      z.netAt = now;
      next.push(z);
    }
    if (game.inside) game.inside.zombies = next;
    else zombies = next;
    if (!game.inside) world.pop = true; // evita recriar zumbis locais diferentes após entrar na área
    if (!game.inside && (typeof data.boss === "string" || data.boss === null)) {
      world.cell.boss = data.boss;
      world.cell.bossHp = Number.isFinite(data.bossHp) ? data.bossHp : null;
    }
  }
  // A interpolação é apenas visual. Nunca simula IA separadamente em seguidores.
  function smoothZombies() {
    if (!isFollower()) return;
    const now = performance.now();
    for (const z of Zs()) {
      if (!Number.isFinite(z.netAt)) continue;
      const t = Math.min(1, (now - z.netAt) / SNAPSHOT_MS);
      z.x = z.netFromX + (z.netToX - z.netFromX) * t;
      z.y = z.netFromY + (z.netToY - z.netFromY) * t;
    }
  }
  function reportHit(zombie, damage, angle) {
    if (!isFollower() || !channelReady || !channel || !zombie.netId) return false;
    const uid = id();
    if (!uid) return false;
    const payload = {
      cx: world.cell.cx, cy: world.cell.cy, location: fmSocial.location(), uid, netId: zombie.netId,
      damage: Math.max(0, Math.min(2000, Math.round(damage))),
      angle: Number.isFinite(angle) ? angle : 0,
      at: Date.now()
    };
    channel.send({ type: "broadcast", event: "zombie-hit", payload }).catch(() => {});
    zombie.flash = 120;
    return true;
  }
  function receiveHit(event) {
    const p = event && event.payload;
    if (!p || !isAuthority() || !world || !Number.isFinite(p.damage) ||
        p.damage <= 0 || p.damage > 2000 || !fmSocial.sameLocation(p) || typeof p.netId !== "string") return;
    // Somente um jogador presente no setor pode atingir inimigos nesse setor.
    const shooter = fmSocial.online().find(o => o.uid === p.uid && fmSocial.sameLocation(o));
    if (!shooter) return;
    const z = Zs().find(x => x.netId === p.netId && x.hp > 0);
    if (!z || Math.hypot(shooter.x - z.x, shooter.y - z.y) > 1000) return;
    z.hp -= p.damage;
    z.flash = 110;
    if (z.hp <= 0 && !z.dead) killZombie(z);
    else alertZombie(z);
    sendSnapshot(true);
  }

  // O jogador que não é líder ainda pode sofrer dano ao encostar nos
  // zumbis compartilhados. A IA e as posições não são recalculadas localmente.
  function localZombieThreats(dt) {
    if (!isFollower() || game.trans || game.paused || game.menu) return;
    for (const z of Zs()) {
      if (z.hp <= 0) continue;
      z.netHitCd = Math.max(0, (z.netHitCd || 0) - dt);
      if (z.netHitCd > 0 || Math.hypot(player.x - z.x, player.y - z.y) >= z.r + player.r + 3) continue;
      damagePlayer(z.dmg);
      addInfection(z);
      z.netHitCd = Math.max(700, z.hitDelay || 900);
    }
  }

  function tick() {
    if (typeof fmSocial !== "undefined") fmSocial.refreshLocation();
    worldClockTick();
    if (!started || !game || !world || !channelReady) return;
    const host = leader();
    if (host !== lastLeader && isFollower()) {
      lastLeader = host;
      lastReceived = 0;
      requestSync();
    }
    if (isAuthority() && !game.hub && !game.trans) sendSnapshot(false);
    else if (isFollower()) smoothZombies();
  }
  return {
    start, tick, nowMs, clock, weatherKind, isAuthority, isFollower,
    onChannel, onChannelReady, reportHit, requestSync, localZombieThreats,
    publishZombiesNow: () => sendSnapshot(true)
  };
})();