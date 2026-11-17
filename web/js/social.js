"use strict";
// Fronteira Morta 2.0: presença online e amizades. Posição é apenas visual:
// combate, economia e saves continuam individuais (não há servidor de combate).
const fmSocial = (() => {
  let channel = null, timer = null, userId = null, peers = new Map();
  let connected = false, tracking = false;
  let sectorKey = "", sectorSince = Date.now(), lastStateSent = 0;
  let moveChannel = null, moveTopic = "", moveReady = false, sendingMove = false;
  let lastPresenceKey = "", lastPresenceAt = 0, lastMoveKey = "", lastMoveAt = 0;
  const MOVE_INTERVAL = 180; // ~5,5 atualizações por segundo apenas enquanto se move
  const BLEND_TIME = 175; // suavização curta, sem os 2 segundos de atraso anteriores
  let friends = [], profiles = new Map(), busy = false, connecting = null;
  const db = () => (typeof fmCloud !== "undefined" && fmCloud.socialClient ? fmCloud.socialClient() : null);
  const myself = () => (typeof fmCloud !== "undefined" && fmCloud.userId ? fmCloud.userId() : null);
  const textName = (s) => String(s || "").trim().replace(/\s+/g, " ").slice(0, 16);

  async function claimName(candidate) {
    const client = db(), uid = myself(), name = textName(candidate);
    if (!client || !uid) throw new Error("Faça login antes de criar o personagem.");
    if (name.length < 3) throw new Error("Use um nome com pelo menos três caracteres.");
    const existing = await client.from("fm_perfis").select("nome").eq("jogador", uid).maybeSingle();
    if (existing.error) throw new Error("Falha ao consultar o nome da conta: " + existing.error.message);
    if (existing.data) return existing.data.nome;
    const created = await client.from("fm_perfis").insert({ jogador: uid, nome: name }).select("nome").single();
    if (created.error) {
      if (created.error.code === "23505")
        throw new Error("Esse nome já está em uso. Escolha outro nome para o seu personagem.");
      throw new Error("Não foi possível registrar o nome: " + created.error.message);
    }
    return created.data.nome;
  }

  async function start() {
    const client = db(), uid = myself();
    if (!client || !uid || !save.name || channel || connecting) return connecting || Promise.resolve();
    connecting = (async () => {
      const registeredName = await claimName(save.name);
      if (save.name !== registeredName) {
        save.name = registeredName;
        persist(); // servidor é a fonte de verdade do nome definitivo
      }
      userId = uid;
      // Amigos não precisam bloquear a entrada no canal multiplayer.
      refreshFriends().catch((error) => console.warn("Amigos não carregados:", error));
      if (myself() !== uid) return;
      channel = client.channel("fm-world-online-v1", { config: { presence: { key: uid } } });
      channel.on("presence", { event: "sync" }, syncPresence);
      channel.subscribe((status) => {
        connected = status === "SUBSCRIBED";
        if (connected) {
          publish(true);
          const state = ownState();
          if (state) ensureMovementChannel(state);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Presença multiplayer temporariamente indisponível.");
        }
      });
      timer = setInterval(tickNetwork, MOVE_INTERVAL);
      window.addEventListener("pagehide", stop, { once: true });
    })().catch((err) => {
      console.warn("Multiplayer não iniciado:", err);
    }).finally(() => { connecting = null; });
    return connecting;
  }

  function location() {
    const h = game && game.inside;
    return h ? `house:${h.x}:${h.y}:${h.level | 0}` : "street";
  }
  function sameLocation(p) {
    return !!world && p.cx === world.cell.cx && p.cy === world.cell.cy && p.location === location();
  }
  function topicFor(state) { return `fm-area-v2:${state.cx}:${state.cy}:${state.location}`; }
  function ownState() {
    if (!game || !player || !world || !save.name) return null;
    const pos = player;
    const cellKey = world.cell.cx + ":" + world.cell.cy + ":" + location();
    if (cellKey !== sectorKey) {
      sectorKey = cellKey;
      sectorSince = typeof fmWorld !== "undefined" ? fmWorld.nowMs() : Date.now();
    }
    return {
      uid: userId, name: textName(save.name), cx: world.cell.cx, cy: world.cell.cy,
      x: Math.round(pos.x), y: Math.round(pos.y),
      angle: Number.isFinite(player.angle) ? player.angle : 0,
      skin: save.skin | 0, location: location(), inside: !!(game.inside || game.hub),
      moving: !!player.moving, active: !(game.paused || game.menu || game.shop || game.over || game.found || game.hub), since: sectorSince, sent: (lastStateSent = Math.max(Date.now(), lastStateSent + 1))
    };
  }
  function refreshLocation() {
    const state = ownState();
    if (state && topicFor(state) !== moveTopic) tickNetwork();
  }
  function tickNetwork() {
    if (!connected || !channel || !userId || myself() !== userId) return;
    const state = ownState();
    if (!state) return;
    ensureMovementChannel(state);
    publish(false, state);      // presença online: poucas atualizações
    sendMovement(false, state); // posição: Broadcast direto e rápido no setor atual
  }

  // Presence é só para entrada/saída, área atual e estado inicial.
  // track() frequente envia o estado inteiro para todos e causa atraso.
  async function publish(force, state = ownState()) {
    if (!connected || !channel || !userId || tracking || !state || myself() !== userId) return;
    const key = [state.cx, state.cy, state.location, state.inside, state.active, state.skin, state.name].join(":");
    const now = Date.now();
    if (!force && key === lastPresenceKey && now - lastPresenceAt < 10000) return;
    lastPresenceKey = key;
    lastPresenceAt = now;
    tracking = true;
    try {
      const status = await channel.track(state);
      if (status && status !== "ok") throw new Error(String(status));
    } catch (error) {
      // Nova tentativa em breve, sem fazer várias chamadas em paralelo.
      lastPresenceAt = Date.now() - 8000;
      console.warn("Presença online temporariamente indisponível:", error);
    } finally { tracking = false; }
  }

  // Um canal de movimento por setor impede enviar movimentos a toda a cidade.
  function ensureMovementChannel(state) {
    const topic = topicFor(state);
    if (moveTopic === topic && moveChannel) return;
    const previous = moveChannel, client = db();
    moveChannel = null;
    moveTopic = topic;
    moveReady = false;
    sendingMove = false;
    lastMoveKey = "";
    lastMoveAt = 0;
    if (previous && client) client.removeChannel(previous).catch(() => {});
    if (!client) return;
    const next = client.channel(topic, { config: { broadcast: { ack: false, self: false } } });
    moveChannel = next;
    next.on("broadcast", { event: "move" }, event => { if (moveChannel === next) receiveMovement(event); });
    if (typeof fmWorld !== "undefined") fmWorld.onChannel(next);
    next.subscribe((status) => {
      if (moveChannel !== next) return;
      moveReady = status === "SUBSCRIBED";
      if (moveReady) { sendMovement(true); if (typeof fmWorld !== "undefined") fmWorld.onChannelReady(next); }
    });
  }

  async function sendMovement(force, state = ownState()) {
    if (!moveReady || !moveChannel || !state || !userId || sendingMove ||
        myself() !== userId || !connected) return;
    const topic = topicFor(state);
    if (topic !== moveTopic) return;
    const now = Date.now();
    const key = [state.x, state.y, state.angle.toFixed(2), state.moving, state.location, state.inside, state.skin].join(":");
    // Parado: nenhuma transmissão contínua; só um pulso periódico para novos vizinhos.
    if (!force && key === lastMoveKey && now - lastMoveAt < 3000) return;
    const active = moveChannel;
    lastMoveKey = key;
    lastMoveAt = now;
    sendingMove = true;
    try {
      const status = await active.send({ type: "broadcast", event: "move", payload: state });
      if (status && status !== "ok") throw new Error(String(status));
    } catch (error) {
      lastMoveAt = Date.now() - 2600;
      // Reconexão é gerenciada automaticamente pelo cliente Supabase.
      console.warn("Movimento online temporariamente indisponível:", error);
    } finally { sendingMove = false; }
  }

  // Movimentos recebidos em baixa latência; Presence conserva o conjunto online.
  function receiveMovement(event) {
    const p = event && event.payload;
    if (!p || typeof p.uid !== "string" || p.uid === userId) return;
    const prev = peers.get(p.uid);
    if (!prev) return; // somente usuários conhecidos via Presence
    if (!Number.isInteger(p.cx) || !Number.isInteger(p.cy) ||
        !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.angle) ||
        !Number.isFinite(p.sent)) return;
    if (p.cx < 0 || p.cx >= MAP_W || p.cy < 0 || p.cy >= MAP_H ||
        p.x < 0 || p.x > Math.max(WORLD_W, W * 2) || p.y < 0 || p.y > Math.max(WORLD_H, H * 1.8)) return;
    if (p.sent < (prev.sent || 0)) return; // descarta pacotes antigos
    if (moveTopic !== topicFor(p)) return;
    const now = performance.now();
    const pos = interpolate(prev, now);
    const sameArea = p.cx === prev.cx && p.cy === prev.cy && p.location === prev.location;
    const teleport = !sameArea || Math.hypot(pos.x - p.x, pos.y - p.y) > 160;
    peers.set(p.uid, {
      ...prev,
      cx: p.cx, cy: p.cy, x: p.x, y: p.y,
      fromX: teleport ? p.x : pos.x, fromY: teleport ? p.y : pos.y,
      at: now, angle: p.angle,
      location: p.location, moving: !!p.moving, inside: !!p.inside, active: p.active !== false, since: Number(p.since) || 0,
      skin: clamp(p.skin | 0, 0, SKINS.length - 1),
      sent: p.sent
    });
  }

  function syncPresence() {
    if (!channel) return;
    const state = channel.presenceState(), next = new Map(), now = performance.now();
    for (const group of Object.values(state)) for (const p of group) {
      if (!p || typeof p.uid !== "string" || p.uid === userId || !p.name) continue;
      if (!Number.isInteger(p.cx) || !Number.isInteger(p.cy) ||
          !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.angle)) continue;
      if (p.cx < 0 || p.cx >= MAP_W || p.cy < 0 || p.cy >= MAP_H) continue;
      const prev = peers.get(p.uid);
      // Presence periódica não deve voltar a posição para trás quando já recebemos
      // um movimento mais novo pelo canal Broadcast.
      if (prev && (prev.sent || 0) >= (Number(p.sent) || 0)) {
        next.set(p.uid, prev);
        continue;
      }
      const x = clamp(p.x, 0, Math.max(WORLD_W, W * 2)), y = clamp(p.y, 0, Math.max(WORLD_H, H * 1.8));
      const pos = prev ? interpolate(prev, now) : { x, y };
      const snap = !prev || prev.cx !== p.cx || prev.cy !== p.cy || prev.location !== p.location ||
                   Math.hypot(pos.x - x, pos.y - y) > 160;
      next.set(p.uid, {
        uid: p.uid, name: textName(p.name), cx: p.cx, cy: p.cy,
        x, y, fromX: snap ? x : pos.x, fromY: snap ? y : pos.y,
        at: now, angle: p.angle, skin: clamp(p.skin | 0, 0, SKINS.length - 1),
        location: p.location, moving: !!p.moving, inside: !!p.inside, active: p.active !== false, since: Number(p.since) || 0, sent: Number(p.sent) || 0
      });
    }
    peers = next;
  }

  function interpolate(p, now) {
    const t = Math.min(1, Math.max(0, (now - p.at) / BLEND_TIME));
    return { x: p.fromX + (p.x - p.fromX) * t, y: p.fromY + (p.y - p.fromY) * t };
  }
  function online() { return Array.from(peers.values()); }
  function inSector() {
    if (!world) return [];
    const now = performance.now();
    return online().filter(p => sameLocation(p))
      .map(p => ({ ...p, ...interpolate(p, now) }));
  }
  function isFriend(uid) { return friends.some(f => f.status === "aceito" && (f.solicitante === uid || f.destinatario === uid)); }
  function friendList() {
    return friends.map(f => {
      const otherId = f.solicitante === userId ? f.destinatario : f.solicitante;
      return { ...f, otherId, name: profiles.get(otherId) || "Sobrevivente", online: peers.has(otherId), incoming: f.destinatario === userId };
    });
  }
  async function refreshFriends() {
    const client = db(), uid = myself();
    if (!client || !uid) return;
    const res = await client.from("fm_amizades")
      .select("id,solicitante,destinatario,status").order("criado_em", { ascending: false });
    if (res.error) throw new Error("Não foi possível carregar os amigos.");
    if (myself() !== uid) return;
    friends = res.data || [];
    const ids = [...new Set(friends.flatMap(f => [f.solicitante, f.destinatario]))];
    profiles = new Map();
    if (ids.length) {
      const res2 = await client.from("fm_perfis").select("jogador,nome").in("jogador", ids);
      if (!res2.error) for (const p of (res2.data || [])) profiles.set(p.jogador, p.nome);
    }
  }
  async function addFriend(name) {
    if (busy) return "Aguarde a solicitação atual.";
    busy = true;
    try {
      const candidate = textName(name);
      if (candidate.length < 3) throw new Error("Digite o nome do jogador.");
      const client = db(), uid = myself();
      if (!client || !uid) throw new Error("Você precisa estar conectado.");
      const res = await client.from("fm_perfis").select("jogador,nome").ilike("nome", candidate).limit(20);
      if (res.error) throw new Error("Não foi possível pesquisar jogadores.");
      const match = (res.data || []).find(p => p.nome.toLocaleLowerCase("pt-BR") === candidate.toLocaleLowerCase("pt-BR"));
      if (!match) throw new Error("Jogador não encontrado. Confira o nome exato.");
      if (match.jogador === uid) throw new Error("Você não pode adicionar a si mesmo.");
      await refreshFriends();
      if (friends.some(f => (f.solicitante === uid && f.destinatario === match.jogador) ||
                            (f.solicitante === match.jogador && f.destinatario === uid)))
        throw new Error("Já existe uma solicitação ou amizade com esse jogador.");
      const result = await client.from("fm_amizades").insert({ solicitante: uid, destinatario: match.jogador });
      if (result.error) throw new Error("Não foi possível enviar a solicitação: " + result.error.message);
      await refreshFriends();
      return "Solicitação enviada para " + match.nome + ".";
    } catch (err) { return err.message || "Não foi possível adicionar."; }
    finally { busy = false; }
  }
  async function acceptFriend(id) {
    const client = db(), uid = myself();
    if (!client || !uid || !friends.some(f => f.id === id && f.destinatario === uid && f.status === "pendente"))
      return "Solicitação não disponível.";
    const res = await client.from("fm_amizades").update({ status: "aceito" }).eq("id", id).eq("destinatario", uid);
    if (res.error) return "Erro ao aceitar: " + res.error.message;
    await refreshFriends();
    return "Amizade aceita!";
  }
  async function stop() {
    if (timer) clearInterval(timer);
    timer = null; connected = false; tracking = false; sendingMove = false;
    userId = null; peers.clear(); friends = []; profiles.clear(); sectorKey = "";
    lastPresenceKey = ""; lastPresenceAt = 0; lastMoveKey = ""; lastMoveAt = 0;
    const client = db(), oldPresence = channel, oldMovement = moveChannel;
    channel = null; moveChannel = null; moveTopic = ""; moveReady = false;
    try {
      if (oldPresence) {
        await oldPresence.untrack();
        if (client) await client.removeChannel(oldPresence);
      }
      if (oldMovement && client) await client.removeChannel(oldMovement);
    } catch (_) { /* perder a conexão nunca impede o jogador de sair */ }
  }
  return { start, stop, claimName, online, inSector, friendList, isFriend,
    refreshFriends, addFriend, acceptFriend, location, sameLocation, refreshLocation, mySectorSince: () => sectorSince };
})();

// Jogadores remotos visíveis nas ruas. Personagens desenhados com a aparência
// básica e a paleta escolhida, sem afetar o combate local.
// Renderização dos outros jogadores com a MESMA spritesheet nova do jogador local.
// Usa cache separado para que trocar cores no multiplayer não reprocessa a sua roupa.
const REMOTE_PLAYER_SHEETS = new Map();
function remotePlayerSheet(skin, pose) {
  if (!PSHEET.ok || !PSHEET.sheets[pose]) return null;
  const key = skin + ":" + pose;
  if (REMOTE_PLAYER_SHEETS.has(key)) return REMOTE_PLAYER_SHEETS.get(key);
  const base = PSHEET.sheets[pose], mask = PSHEET.masks[pose];
  const img = mask && mask.naturalWidth ? tintWithMask(base, mask, SKINS[skin] || SKINS[0]) : base;
  REMOTE_PLAYER_SHEETS.set(key, img);
  return img;
}
function drawOnlinePlayer(p) {
  const S = PSHEET.size, cell = PSHEET.cell, pose = "punhos";
  const skin = clamp(p.skin | 0, 0, SKINS.length - 1);
  const sprite = remotePlayerSheet(skin, pose);
  if (sprite) {
    const row = sheetRow(Math.cos(p.angle || 0), Math.sin(p.angle || 0));
    const col = p.moving ? (Math.floor(performance.now() / 110 + p.x * 0.05) % 8) : 1;
    const x = p.x - S / 2, y = p.y + 6 - S * PSHEET.footY;
    ctx.drawImage(sprite, col * cell, row * cell, cell, cell, x, y, S, S);
    // Mochila e acessórios do boneco novo (sem copiar o equipamento da nossa conta).
    for (const id of gearOrder(["pack", ...(SKIN_GEAR[skin] || [])], row !== 3 && row !== 4 && row !== 5)) {
      const layer = gearImg(id, pose);
      if (layer) ctx.drawImage(layer, col * cell, row * cell, cell, cell, x, y, S, S);
    }
  } else {
    // Enquanto a spritesheet carrega, nunca desenha o antigo personagem 2D.
    ctx.save(); ctx.fillStyle = "#73ceff"; circle(p.x, p.y, 7); ctx.restore();
  }
  hudT(p.name, p.x, p.y - 43, 11, fmSocial.isFriend(p.uid) ? "#8fe0a8" : "#73ceff", "center", true, 170);
}

function friendsKey(k) {
  if (k === "escape") { game.menu = null; return; }
  if (game.friendBusy) return;
  if (k === "enter") { friendsAdd(); return; }
  let s = game.friendDraft || "";
  if (k === "backspace") s = s.slice(0, -1);
  else if (game.rawKey && game.rawKey.length === 1 && /[\p{L}\p{N} _\-.]/u.test(game.rawKey) && s.length < 16)
    s += game.rawKey;
  game.friendDraft = s.replace(/^\s+/, "");
}
async function friendsAdd() {
  if (game.friendBusy) return;
  game.friendBusy = true;
  game.friendStatus = "Procurando jogador...";
  try { game.friendStatus = await fmSocial.addFriend(game.friendDraft || ""); }
  finally { game.friendBusy = false; }
}
async function friendsAccept(id) {
  game.friendStatus = await fmSocial.acceptFriend(id);
}
function openFriends() {
  game.paused = false;
  game.menu = "friends"; game.friendDraft = ""; game.friendStatus = "";
  fmSocial.refreshFriends().catch(() => { game.friendStatus = "Não foi possível atualizar a lista."; });
}
function drawFriends() {
  menuFrame("Jogadores e amigos", "Adicione sobreviventes pelo nome usado dentro do jogo");
  const mx = 60, names = fmSocial.friendList(), online = fmSocial.online();
  txt("JOGADORES ONLINE: " + (online.length + 1), mx, 113, 16, "#8fe0a8", "left", true);
  btn(752, 94, 130, 30, "Atualizar", () => {
    fmSocial.refreshFriends()
      .then(() => { game.friendStatus = "Lista atualizada."; })
      .catch(() => { game.friendStatus = "Não foi possível atualizar."; });
  });
  txt("Adicionar amigo pelo nome exato:", mx, 158, 15, "#e5e0c8", "left");
  ctx.fillStyle = "#161813"; rr(mx, 174, 560, 48, 8); ctx.fill();
  ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 1.5; ctx.stroke();
  txt((game.friendDraft || "") + (Math.floor(performance.now() / 550) % 2 ? "|" : ""), mx + 14, 205, 20, "#ffd96a", "left", true, 530);
  btn(632, 174, 250, 48, game.friendBusy ? "Enviando..." : "Adicionar (Enter)", friendsAdd, true, !!game.friendBusy);
  if (game.friendStatus) txt(game.friendStatus, mx, 247, 13, "#ffd96a", "left", false, 820);
  txt("AMIGOS E SOLICITAÇÕES", mx, 291, 15, "#e5e0c8", "left", true);
  if (!names.length) txt("Você ainda não tem amigos. Digite um nome acima para enviar convite.", mx, 322, 13, "#a9a58f");
  names.slice(0, 7).forEach((f, i) => {
    const y = 304 + i * 32;
    ctx.fillStyle = i % 2 ? "#191b17" : "#25251f"; rr(mx, y, 824, 29, 4); ctx.fill();
    txt(f.name, mx + 10, y + 20, 13, f.online ? "#8fe0a8" : "#e5e0c8", "left", true, 280);
    const status = f.status === "aceito" ? (f.online ? "ONLINE · amigo" : "OFFLINE · amigo") : f.incoming ? "Pedido recebido" : "Convite enviado";
    txt(status, mx + 320, y + 20, 12, "#c9c4ad");
    if (f.status === "pendente" && f.incoming) btn(mx + 674, y + 1, 140, 26, "Aceitar", () => friendsAccept(f.id), true);
  });
  const onlineNames = online.slice(0, 5).map(p => p.name).join(" · ");
  txt("Conectados: " + (onlineNames || "nenhum outro jogador online"), mx, 547, 12, "#73ceff", "left", false, 835);
  hint("Digite o nome e pressione Enter · Esc fecha");
}