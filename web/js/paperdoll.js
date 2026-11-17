"use strict";
// =====================================================================
//  Retrato do personagem (renderizado no Blender) e inventário de arrastar (tecla B)
//
//  Retrato: img/portrait.png (roupa em cinza) + portrait_mask.png (jaqueta/calça) pintados com a cor
//  da roupa, mais as camadas do que está equipado (colete, mochila e acessório da cabeça).
//  Inventário: boneco no meio com os slots em volta; implantes à esquerda, coletes à direita,
//  mochila embaixo. Arraste para equipar, trocar, guardar ou descartar.
// =====================================================================

// ---------------------------------------------------------------- retrato
const PORTRAIT = { base: null, mask: null, gear: {}, cache: null, key: "" };
function portraitImg(name) {
  const im = new Image();
  im.src = `img/${name}.png`;
  return im;
}
function portraitReady(im) { return im && im.complete && im.naturalWidth > 0; }
// a capa 3D já está no retrato? (então o desenho 2D antigo da capa não aparece)
function cape3d() {
  const id = CAPE_GEAR[save.cape | 0];
  return !!(id && PORTRAIT.cache && portraitReady(PORTRAIT.gear[id]));
}
function portraitGearImg(id) {
  if (!(id in PORTRAIT.gear)) PORTRAIT.gear[id] = portraitImg(`portrait_${id}`);
  return PORTRAIT.gear[id];
}
// pinta a roupa (cinza) com as cores do personagem usando a máscara (vermelho = jaqueta, verde = calça)
function tintWithMask(base, mask, skin) {
  const w = base.naturalWidth || base.width, h = base.naturalHeight || base.height;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(base, 0, 0);
  try {
    const t = document.createElement("canvas"); t.width = w; t.height = h;
    const tg = t.getContext("2d", { willReadFrequently: true });
    tg.drawImage(mask, 0, 0);
    const m = tg.getImageData(0, 0, w, h).data, img = g.getImageData(0, 0, w, h), d = img.data;
    const J = hexRgb(skin.jacket), P = hexRgb(skin.pants), K = 1.7 / 255;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const mj = m[i] / 255, mp = m[i + 1] / 255;
      if (mj + mp < 0.02) continue;
      for (let ch = 0; ch < 3; ch++) {
        const v = d[i + ch];
        d[i + ch] = v * (1 - mj - mp) + Math.min(255, v * J[ch] * K) * mj + Math.min(255, v * P[ch] * K) * mp;
      }
    }
    g.putImageData(img, 0, 0);
  } catch (e) { /* aberto direto do disco: fica sem pintar */ }
  return c;
}
// imagem pronta do retrato (cache por roupa + equipamento); null se ainda não carregou
function portraitCanvas() {
  if (!PORTRAIT.base) { PORTRAIT.base = portraitImg("portrait"); PORTRAIT.mask = portraitImg("portrait_mask"); }
  if (!portraitReady(PORTRAIT.base)) return null;
  const gear = playerGear();
  const imgs = gear.map(portraitGearImg);
  const key = `${save.skin}|${save.cape | 0}|${gear.join(",")}|${imgs.map(portraitReady).join("")}|${portraitReady(PORTRAIT.mask)}`;
  if (PORTRAIT.key === key && PORTRAIT.cache) return PORTRAIT.cache;
  const skin = SKINS[save.skin] || SKINS[0];
  const body = portraitReady(PORTRAIT.mask) ? tintWithMask(PORTRAIT.base, PORTRAIT.mask, skin) : PORTRAIT.base;
  const c = document.createElement("canvas"); c.width = PORTRAIT.base.naturalWidth; c.height = PORTRAIT.base.naturalHeight;
  const g = c.getContext("2d");
  // cada camada já vem com o corpo escondendo o que fica atrás dele: tudo vai por cima.
  // Quadro k = giro de -18° + 360°·k/n; de frente a mochila vai antes do colete, de lado/costas por último.
  g.drawImage(body, 0, 0);
  const n = Math.max(1, Math.round(c.width / PORTRAIT_FW)), fw = c.width / n;
  for (let k = 0; k < n; k++) {
    const yaw = ((-18 + 360 * k / n) % 360 + 360) % 360, front = yaw <= 80 || yaw >= 280;
    for (const id of gearOrder(gear, !front)) {
      const im = imgs[gear.indexOf(id)];
      if (!portraitReady(im)) continue;
      const tint = gearTint(id), src = tint ? tintedImg(im, "portrait_" + id, tint) : im;
      g.drawImage(src, k * fw, 0, fw, c.height, k * fw, 0, fw, c.height);
    }
  }
  // a imagem é uma tira de quadros (o boneco girando); recorte comum a todos os quadros,
  // para o tamanho não pular enquanto gira
  let box = { x: 0, y: 0, w: fw, h: c.height };
  try {
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = fw, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 8) {
        const fx = x % fw;
        if (fx < x0) x0 = fx; if (fx > x1) x1 = fx; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 > x0) box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  } catch (e) { /* sem servidor: usa o quadro inteiro */ }
  PORTRAIT.cache = c; PORTRAIT.box = box; PORTRAIT.key = key; PORTRAIT.n = n; PORTRAIT.fw = fw;
  return c;
}

// ---------------------------------------------------------------- girar o boneco arrastando
const PORTRAIT_FW = 240;               // largura de um quadro em portrait*.png
const PSPIN = { angle: 0, hit: null, drag: null };   // angle em quadros (0 = quase de frente)
function portraitFrame() {
  const n = PORTRAIT.n || 1;
  return ((Math.round(PSPIN.angle) % n) + n) % n;
}
// "front", "back" ou "side": para a capa (desenho 2D) ir atrás ou na frente do boneco
function portraitView() {
  if (!PORTRAIT.cache) return "front";
  const a = (portraitFrame() / (PORTRAIT.n || 1)) * 360;
  if (a <= 60 || a >= 300) return "front";
  if (a >= 130 && a <= 230) return "back";
  return "side";
}
// desenha o retrato centrado na caixa; devolve false se a imagem não existe (usa o desenho antigo).
// Arrastar sobre ele gira o boneco; onClick (opcional) roda com um clique sem arrastar.
function drawPortrait(cx, cy, maxW, maxH, onClick) {
  const c = portraitCanvas();
  if (!c) return false;
  const b = PORTRAIT.box, k = Math.min(maxW / b.w, maxH / b.h), w = b.w * k, h = b.h * k;
  ctx.drawImage(c, portraitFrame() * PORTRAIT.fw + b.x, b.y, b.w, b.h, cx - w / 2, cy - h / 2, w, h);
  PSPIN.hit = { x: cx - maxW / 2, y: cy - h / 2, w: maxW, h, onClick, t: performance.now() };
  return true;
}
function portraitMouseDown(x, y) {
  const r = PSPIN.hit;
  if (!r || performance.now() - r.t > 250 || (PORTRAIT.n || 1) < 2) return false;
  if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) return false;
  PSPIN.drag = { x0: x, a0: PSPIN.angle, moved: false, onClick: r.onClick };
  return true;
}
function portraitMouseMove(x) {
  const d = PSPIN.drag;
  if (!d) return;
  if (Math.abs(x - d.x0) > 4) d.moved = true;
  if (d.moved) PSPIN.angle = d.a0 + (x - d.x0) / 14;   // ~14 px por quadro (16 quadros = volta inteira)
}
function portraitMouseUp() {
  const d = PSPIN.drag;
  PSPIN.drag = null;
  if (d && !d.moved && d.onClick) d.onClick();
}

// ---------------------------------------------------------------- inventário: zonas de arrastar
// cada quadro registra as zonas (onde soltar) e o que pode ser arrastado
const INV = { zones: [], drag: null, hover: null, confirm: null };

function invZone(z) { INV.zones.push(z); return z; }
function invZoneAt(x, y) {
  for (let i = INV.zones.length - 1; i >= 0; i--) {
    const z = INV.zones[i];
    if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z;
  }
  return null;
}
function invItemName(z) {
  if (!z || !z.item) return "";
  if (z.type === "weapon") return instName(z.item);
  if (z.type === "mat") return MATS[z.item.id].name;
  if (z.type === "vest") return VESTS[z.item.i].name;
  if (z.type === "implant") return implantName(z.item);
  return "";
}

// chamado pelo main.js no clique / soltar do mouse com o inventário aberto
function invMouseDown(x, y) {
  const z = invZoneAt(x, y);
  if (z && z.item && z.drag !== false) { INV.drag = { z, x0: x, y0: y, moved: false }; return true; }
  return false;
}
function invMouseMove(x, y) {
  const d = INV.drag;
  if (d && !d.moved && Math.hypot(x - d.x0, y - d.y0) > 5) d.moved = true;
}
function invMouseUp(x, y) {
  const d = INV.drag;
  INV.drag = null;
  if (!d) return;
  if (!d.moved) { invClick(d.z); return; }
  const t = invZoneAt(x, y);
  invDrop(d.z, t);
}

// clique simples: seleciona; clicar de novo no selecionado faz a ação rápida (equipar/guardar/instalar)
function invClick(z) {
  const inv = packSel();
  if (z.sel != null) {
    if (inv.sel === z.sel) packAct(); else inv.sel = z.sel;
    return;
  }
  if (z.type === "vest") { if (z.area === "vestslot") unequipVest(); else equipVest(z.item.i); return; }
  if (z.type === "implant") { if (z.area === "installed") moveImplant(z.item, "bag"); else moveImplant(z.item, "installed"); }
}

function equipVest(i) {
  if (!save.vestsOwned[i]) return;
  save.vest = i; recalcImplants(); persist(); toast(`${VESTS[i].name} equipado`);
}
function unequipVest() {
  if (save.vest < 0) return;
  toast(`${VESTS[save.vest].name} guardado`);
  save.vest = -1; recalcImplants(); persist();
}
function moveImplant(im, to) {
  if (!canSwapImplants()) { toast("Implantes só se instalam ou removem na base (ou com o implante Gancho)"); sfx.empty(); return; }
  if (to === "installed") {
    if (save.installed.includes(im)) return;
    const why = installBlock(im);
    if (why) { toast(why); return; }
    player.bag.splice(player.bag.indexOf(im), 1); save.installed.push(im);
    toast(`Instalou ${implantName(im)}`);
  } else {
    if (player.bag.includes(im)) return;
    if (player.bag.length >= BAG_MAX) { toast("Mochila de implantes cheia"); return; }
    save.installed.splice(save.installed.indexOf(im), 1); player.bag.push(im);
    toast(`Removeu ${implantName(im)}`);
  }
  persist(); recalcImplants();
}

function invDrop(src, dst) {
  if (!dst || dst === src) return;
  const inv = packSel();
  // descartar (pede confirmação)
  if (dst.area === "discard") {
    if (src.sel == null) { toast("Isso não dá para descartar aqui"); return; }
    inv.sel = src.sel; INV.confirm = { name: invItemName(src) }; return;
  }
  if (src.type === "mat" && src.item.id === "trindade_eterna" && dst.area === "doll") { INV.confirm = { trindade: true, name: "Trindade · 100 anos" }; return; }
  if (src.type === "mat" && src.item.id === "reset_stats" && dst.area === "doll") {
    INV.confirm = { resetStats: true, name: "Cartão Reset de Stats" };
    return;
  }
  if (src.type === "vest") {
    if (src.area === "vests" && dst.area === "vestslot") equipVest(src.item.i);
    else if (src.area === "vestslot" && (dst.area === "vests" || dst.area === "pack")) unequipVest();
    return;
  }
  if (src.type === "implant") {
    if (dst.area === "doll") openAlloc(src.item);                    // soltar no boneco: distribuir os pontos
    else if (src.area === "bag" && dst.area === "installed") moveImplant(src.item, "installed");
    else if (src.area === "installed" && dst.area === "bag") moveImplant(src.item, "bag");
    else if (src.area === "installed" && dst.area === "installed" && dst.i !== src.i) {   // muda a ordem (o Mímico copia o da esquerda)
      if (!canSwapImplants()) { toast("A ordem dos implantes só muda na base (ou com o implante Gancho)"); return; }
      const b = Math.min(dst.i, save.installed.length - 1), t = save.installed[src.i];
      save.installed.splice(src.i, 1); save.installed.splice(b, 0, t);
      persist(); recalcImplants();
    }
    return;
  }
  // armas e materiais
  if (dst.area === "wslot") {
    if (src.type !== "weapon") { toast("Só armas vão nos slots de arma"); return; }
    inv.sel = src.sel; equipTo(dst.i); return;
  }
  if (dst.area === "pack") {
    if (src.area === "wslot") {
      if (packUsed() >= PACK_MAX) { toast("Mochila cheia"); return; }
      player.pack.push(src.item); player.slots[src.i] = null; player.reloading = 0;
      toast(`${instName(src.item)} guardada na mochila`); inv.sel = SLOT_N + player.pack.length - 1; return;
    }
    if (src.area === "pack") {               // reorganiza a mochila
      const a = src.i, b = Math.min(dst.i, player.pack.length - 1);
      const t = player.pack[a]; player.pack[a] = player.pack[b]; player.pack[b] = t; inv.sel = SLOT_N + b;
    }
  }
}

// ---------------------------------------------------------------- desenho
function invCell(x, y, w, h, opt) {
  const hov = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  const drop = INV.drag && INV.drag.moved && hov;
  ctx.fillStyle = opt.sel ? "#2f2d24" : "rgba(22,22,18,0.95)"; rr(x, y, w, h, 5); ctx.fill();
  ctx.strokeStyle = drop ? "#6fd06a" : opt.sel ? "#ffd96a" : hov ? "#8a7a4a" : "#3d3b30";
  ctx.lineWidth = drop || opt.sel ? 2 : 1; ctx.stroke();
  if (opt.label) txt(opt.label, x + w / 2, y + h + 13, 11, "#c9c4ad", "center", true);
  return hov;
}
function invAmmoCell(st, x, y, w, h) {
  ctx.fillStyle = "#1e1d16"; rr(x, y, w, h, 5); ctx.fill();
  ctx.strokeStyle = "#5a4a2a"; ctx.lineWidth = 1; ctx.stroke();
  drawEntryIcon({ type: "ammo", ammo: "" }, x + 22, y + h / 2 + 2, 0.42);
  txt(st.t, x + w - 6, y + 17, 10, "#e0d8a0", "right", true, w - 40);
  txt(`${st.n}`, x + w - 6, y + 33, 11, "#ffd96a", "right", true);
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x + 6, y + h - 6, w - 12, 3);
  ctx.fillStyle = "#c9a040"; ctx.fillRect(x + 6, y + h - 6, (w - 12) * (st.n / AMMO_STACK), 3);
}
function invIcon(z, x, y, w, h) {
  if (!z.item) return;
  if (z.type === "weapon" || z.type === "mat") { drawItemCell(z.item, x, y, w, h, false); return; }
  if (z.type === "vest") {
    const v = VESTS[z.item.i];
    drawVestIcon(z.item.i, x + w / 2, y + h / 2 - 2, Math.min(w, h) / 70);
    if (v.rar) { ctx.strokeStyle = RARITY[v.rar].color; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; rr(x + 2, y + 2, w - 4, h - 4, 4); ctx.stroke(); ctx.globalAlpha = 1; }
    return;
  }
  if (z.type === "implant") {
    drawEntryIcon({ type: "implant", im: z.item }, x + w / 2, y + h / 2, Math.min(w, h) / 62);
    const d = IMP[z.item.id];
    if (d.alloc) txt(`${allocUsed(z.item)}/${d.alloc.points}`, x + w - 4, y + 11, 9, allocUsed(z.item) < d.alloc.points ? "#ffd96a" : "#8fd08a", "right", true);
    else if (d.mimic) txt("←", x + w - 4, y + 12, 11, "#c58bff", "right", true);
    txt(d.name.replace("Implante ", "").replace(/^d[ao] /, ""), x + w / 2, y + h - 4, 8, impColor(z.item), "center", true, w - 4);
  }
}
function slotBox(x, y, w, h, label, z) {
  if (z) { z.x = x; z.y = y; z.w = w; z.h = h; invZone(z); }
  const inv = packSel();
  const hov = invCell(x, y, w, h, { sel: z && z.sel != null && inv.sel === z.sel, label });
  if (z && z.item && !(INV.drag && INV.drag.moved && INV.drag.z.area === z.area && INV.drag.z.i === z.i)) invIcon(z, x, y, w, h);
  if (hov && z) INV.hover = z;
  return hov;
}
// peças que vêm com a roupa (chapéu, máscara, jaqueta, calça): clique abre a troca de roupa
function outfitSlot(x, y, w, h, label, piece) {
  const hov = invCell(x, y, w, h, { label });
  const s = SKINS[save.skin] || SKINS[0];
  ctx.save(); ctx.translate(x + w / 2, y + h / 2);
  if (piece === "jacket") { ctx.fillStyle = s.jacket; rr(-15, -16, 30, 30, 5); ctx.fill(); ctx.fillRect(-22, -14, 8, 22); ctx.fillRect(14, -14, 8, 22); }
  else if (piece === "pants") { ctx.fillStyle = s.pants; rr(-13, -18, 12, 34, 3); ctx.fill(); rr(1, -18, 12, 34, 3); ctx.fill(); ctx.fillRect(-13, -18, 26, 8); }
  else if (piece) { ctx.fillStyle = piece.color; ctx.beginPath(); ctx.ellipse(0, 2, 16, 13, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillRect(-18, 1, 36, 4); }
  else { ctx.strokeStyle = "#3d3b30"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke(); }
  ctx.restore();
  regClick(x, y, w, h, () => { game.menu = "stats"; game.stab = 1; game.cur = 0; });
  if (hov) INV.hover = { type: "outfit", label, piece };
}
function headPieces() {
  const s = SKINS[save.skin] || SKINS[0], ids = SKIN_GEAR[save.skin] || [];
  const NAMES = { headset: "Fone", shemagh: "Shemagh", helmet: "Capacete", helmet2: "Capacete leve", balaclava: "Balaclava", gasmask: "Máscara de gás", ballistic: "Máscara balística" };
  const hat = ids.find((i) => ["headset", "helmet", "helmet2", "balaclava"].includes(i)) || (s.cap ? "cap" : s.hood ? "hood" : null);
  const mask = ids.find((i) => ["gasmask", "ballistic", "shemagh"].includes(i)) || (s.glasses ? "glasses" : null);
  const nm = (i) => NAMES[i] || { cap: "Boné", hood: "Capuz", glasses: "Óculos" }[i];
  return {
    hat: hat && { name: nm(hat), color: s.cap || s.hood || s.helmet || "#4a4a4a" },
    mask: mask && { name: nm(mask), color: s.mask || "#3a3d40" },
  };
}

function drawInventory() {
  const inv = packSel();
  INV.zones = []; INV.hover = null;
  menuFrame("Inventário", `$${game.money}  ·  Mochila ${packUsed()}/${PACK_MAX}  ·  ${playerName()} · nível ${player.level}`);

  // ---- implantes (esquerda)
  txt("Implantes", 40, 100, 14, "#e5e0c8", "left", true);
  txt(`${save.installed.length}/${IMPL_SLOTS}`, 234, 100, 12, "#ffd96a", "right", true);
  for (let i = 0; i < IMPL_SLOTS; i++) {
    const x = 40 + (i % 3) * 66, y = 110 + Math.floor(i / 3) * 66;
    slotBox(x, y, 60, 60, null, { area: "installed", i, type: "implant", item: save.installed[i] || null });
  }
  txt("Na mochila", 40, 262, 12, "#c9c4ad", "left", true);
  txt(`${player.bag.length}/${BAG_MAX}`, 234, 262, 11, "#a9a58f", "right");
  for (let i = 0; i < BAG_MAX; i++) {
    const x = 40 + (i % 4) * 49, y = 270 + Math.floor(i / 4) * 49;
    slotBox(x, y, 45, 45, null, { area: "bag", i, type: "implant", item: player.bag[i] || null });
  }
  txt(canSwapImplants() ? "Arraste para instalar, remover ou mudar a ordem" : "Instalar/remover: só na base", 40, 382, 10, canSwapImplants() ? "#6fae4f" : "#a9a58f");
  txt("Solte no boneco para distribuir os pontos", 40, 393, 10, "#a9a58f");
  const Q = player.foodQ;
  [`Comida ${player.food} (fresca ${Q.fresca})`, `Água ${player.water}`, `Kit médico ${player.med} · Antibiótico ${player.anti}`]
    .forEach((s, i) => txt(s, 40, 408 + i * 12, 10, "#a9a58f"));

  // ---- boneco e slots (meio)
  ctx.fillStyle = "rgba(0,0,0,0.3)"; rr(262, 88, 436, 342, 8); ctx.fill();
  invZone({ area: "doll", x: 372, y: 92, w: 216, h: 270 });           // soltar um implante aqui abre a distribuição de pontos
  const cp = CAPES[save.cape | 0];
  const cape = () => { if (cp && cp.color && !cape3d()) { ctx.fillStyle = shade(cp.color, -0.2); ctx.beginPath(); ctx.moveTo(452, 140); ctx.lineTo(508, 140); ctx.lineTo(530, 330); ctx.lineTo(430, 330); ctx.closePath(); ctx.fill(); } };
  if (portraitView() === "front") cape();
  if (!drawPortrait(480, 222, 200, 268)) drawHero(480, 230, 1.15);
  else txt("⟲ arraste para girar", 480, 361, 9, "#7d7a68", "center");
  if (portraitView() === "back") cape();
  const hp = headPieces();
  outfitSlot(296, 104, 58, 58, hp.hat ? hp.hat.name : "Chapéu", hp.hat);
  outfitSlot(296, 186, 58, 58, "Jaqueta", "jacket");
  outfitSlot(296, 268, 58, 58, "Calça", "pants");
  outfitSlot(606, 104, 58, 58, hp.mask ? hp.mask.name : "Máscara", hp.mask);
  slotBox(606, 186, 58, 58, "Colete", { area: "vestslot", type: "vest", item: save.vest >= 0 ? { i: save.vest } : null });
  const bpH = invCell(606, 268, 58, 58, { label: "Mochila" });
  ctx.fillStyle = "#4e5a2e"; rr(621, 278, 28, 36, 6); ctx.fill(); ctx.fillStyle = "#3a4422"; ctx.fillRect(625, 298, 20, 10);
  txt(`${packUsed()}/${PACK_MAX}`, 635, 323, 9, "#ffd96a", "center", true);
  if (bpH) INV.hover = { type: "outfit", label: "Mochila militar", piece: null };
  for (let i = 0; i < SLOT_N; i++) {
    const x = 300 + i * 124, y = 370;
    slotBox(x, y, 112, 52, null, { area: "wslot", i, sel: i, type: "weapon", item: player.slots[i] || null });
    txt(player.cur === i ? `Arma ${i + 1} · na mão` : `Arma ${i + 1}`, x + 56, y - 4, 10, player.cur === i ? "#ffd96a" : "#a9a58f", "center", true);
  }

  // ---- coletes (direita)
  txt("Coletes", 716, 100, 14, "#e5e0c8", "left", true);
  const owned = VESTS.map((v, i) => i).filter((i) => save.vestsOwned[i]);
  for (let k = 0; k < 12; k++) {
    const x = 716 + (k % 4) * 54, y = 110 + Math.floor(k / 4) * 54, i = owned[k];
    slotBox(x, y, 50, 50, null, { area: "vests", i: k, type: "vest", item: i != null && i !== save.vest ? { i } : null });
  }
  // detalhes do item sob o mouse (ou selecionado)
  const hz = INV.hover && INV.hover.item ? INV.hover : null;
  const selIt = selItem(inv.sel);
  const info = hz || (selIt ? { type: selIt.kind === "weapon" ? "weapon" : "mat", item: selIt } : null);
  ctx.fillStyle = "rgba(0,0,0,0.3)"; rr(712, 276, 220, 98, 6); ctx.fill();
  if (INV.hover && INV.hover.type === "outfit") {
    txt(INV.hover.label, 722, 296, 13, "#f2eedc", "left", true, 200);
    txt(INV.hover.label === "Mochila militar" ? `${PACK_MAX} espaços` : `Vem com a roupa "${(SKINS[save.skin] || SKINS[0]).name}"`, 722, 314, 10, "#a9a58f", "left", false, 200);
    if (INV.hover.label !== "Mochila militar") txt("Clique para trocar de roupa", 722, 330, 10, "#ffd96a");
  } else if (info) {
    const nm = invItemName(info);
    txt(nm, 722, 296, 13, info.type === "weapon" ? rarColor(WDEF[info.item.id]) : "#f2eedc", "left", true, 200);
    if (info.type === "weapon") {
      const d = WDEF[info.item.id], st = wStat(info.item);
      txt(`${CAT_LABEL[d.cat]} · dano ${Math.round(st.dmg)}${d.pellets ? ` x${d.pellets}` : ""} · ${(1000 / st.delay).toFixed(1)}/s`, 722, 314, 10, "#c9c4ad", "left", false, 200);
      txt(d.melee ? "corpo a corpo" : d.infinite ? "munição infinita" : `${d.ammo} · reserva ${player.reserve[d.ammo] || 0}`, 722, 330, 10, "#a9a58f", "left", false, 200);
      txt(`Exige: ${reqText(d)}`, 722, 346, 10, canUse(d) ? "#6fae4f" : "#e05a4a", "left", true, 200);
    } else if (info.type === "mat") {
      txt(`Quantidade: ${info.item.qty}`, 722, 314, 10, "#c9c4ad");
      txt(MATS[info.item.id].cashProtection ? safeDescription(info.item.id) : "Material para a oficina", 722, 330, 10, "#a9a58f", "left", false, 200);
    } else if (info.type === "vest") {
      const v = VESTS[info.item.i];
      txt(vestText(v), 722, 314, 10, "#c9c4ad", "left", false, 200);
      if (info.item.i === save.vest) txt(`Durabilidade ${Math.round(vestDur())}%`, 722, 330, 10, "#a9a58f");
    } else if (info.type === "implant") {
      txtWrap(implantDesc(info.item), 722, 311, 10, "#c9c4ad", 200, 11, 6);
    }
  } else txt("Passe o mouse num item", 822, 330, 11, "#6d6a58", "center");

  // lixeira
  const dz = invZone({ area: "discard", x: 712, y: 380, w: 220, h: 42 });
  const dh = invCell(dz.x, dz.y, dz.w, dz.h, {});
  txt("Descartar (arraste aqui)", dz.x + dz.w / 2, dz.y + 26, 12, dh && INV.drag ? "#e05a4a" : "#8a6a5a", "center", true);

  // ---- mochila (embaixo)
  txt("Mochila", 40, 446, 13, "#e5e0c8", "left", true);
  txt(`munição: 1 espaço a cada ${AMMO_STACK} balas`, 926, 446, 10, "#a9a58f", "right");
  const stacks = [];
  for (const t of Object.keys(AMMO)) { let r = player.reserve[t] || 0; while (r > 0) { stacks.push({ t, n: Math.min(AMMO_STACK, r) }); r -= AMMO_STACK; } }
  for (let i = 0; i < PACK_MAX; i++) {
    const x = 40 + (i % 10) * 89, y = 452 + Math.floor(i / 10) * 50;
    if (i >= player.pack.length && i < player.pack.length + stacks.length) { invAmmoCell(stacks[i - player.pack.length], x, y, 85, 46); continue; }
    const it = player.pack[i] || null;
    slotBox(x, y, 85, 46, null, { area: "pack", i, sel: it ? SLOT_N + i : null, type: it ? (it.kind === "weapon" ? "weapon" : "mat") : null, item: it });
  }

  // item sendo arrastado acompanha o mouse
  if (INV.drag && INV.drag.moved) {
    const z = INV.drag.z, w = z.w, h = z.h;
    ctx.globalAlpha = 0.85; invIcon(z, mouse.x - w / 2, mouse.y - h / 2, w, h); ctx.globalAlpha = 1;
  }
  // confirmação de descarte
  if (INV.confirm) {
    ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1a1913"; rr(W / 2 - 200, H / 2 - 60, 400, 120, 10); ctx.fill(); ctx.strokeStyle = "#e05a4a"; ctx.lineWidth = 2; ctx.stroke();
    txt(INV.confirm.trindade ? "Consumir Trindade por 100 anos?" : INV.confirm.resetStats ? "Resetar atributos e proficiências?" : `Descartar ${INV.confirm.name}?`, W / 2, H / 2 - 22, 16, "#f2eedc", "center", true, 370);
    txt(INV.confirm.trindade ? "+35% dano, corrida e armadura. Consome 1 item." : INV.confirm.resetStats ? "Todos os pontos investidos voltam. O cartão será consumido." : "Some para sempre.", W / 2, H / 2, 12, "#a9a58f", "center");
    btn(W / 2 - 150, H / 2 + 16, 140, 30, INV.confirm.trindade ? "Consumir" : INV.confirm.resetStats ? "Resetar" : "Descartar", () => { const reset = INV.confirm.resetStats, trindade = INV.confirm.trindade; INV.confirm = null; if (trindade) useTrindadeItem(); else if (reset) useResetStatsCard(); else packDiscard(); }, true);
    btn(W / 2 + 10, H / 2 + 16, 140, 30, "Cancelar", () => { INV.confirm = null; });
  }
  drawAllocPanel();
  hint("Arraste o cartão no personagem para resetar stats · arraste armas para equipar · B ou Esc fecha");
}

// ---------------------------------------------------------------- texto em várias linhas
function txtWrap(s, x, y, size, color, maxW, lineH, maxLines) {
  ctx.font = `${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = "left";
  const words = String(s).split(" "), lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  if (maxLines && lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,3}$/, "…"); }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  return lines.length;
}

// ---------------------------------------------------------------- pontos dos implantes (Mutante, Fortuna, Matador)
const ALLOC = { im: null, t: 0 };
function allocOpen() { return !!ALLOC.im && performance.now() - ALLOC.t < 400; }
function openAlloc(im) {
  if (!IMP[im.id].alloc) { toast(`${implantName(im)} não tem pontos para distribuir`); return; }
  ALLOC.im = im; ALLOC.t = performance.now();
}
function allocAdd(im, key, n) {
  const d = IMP[im.id].alloc, cur = (im.alloc && im.alloc[key]) || 0;
  const v = Math.max(0, Math.min(cur + n, cur + d.points - allocUsed(im)));
  im.alloc = im.alloc || {};
  if (v) im.alloc[key] = v; else delete im.alloc[key];
  persist(); recalcImplants();
}
function drawAllocPanel() {
  const im = ALLOC.im;
  if (!im) return;
  if (!save.installed.includes(im) && !player.bag.includes(im)) { ALLOC.im = null; return; }
  if (performance.now() - ALLOC.t > 400) { ALLOC.im = null; return; }       // o menu foi fechado e aberto de novo
  ALLOC.t = performance.now();
  const d = IMP[im.id].alloc, n = d.opts.length, pw = 520, ph = 128 + n * 36, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
  const free = d.points - allocUsed(im);
  ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(0, 0, W, H);
  regClick(0, 0, W, H, () => {});                                            // nada atrás do painel recebe clique
  ctx.fillStyle = "#1a1913"; rr(px, py, pw, ph, 10); ctx.fill(); ctx.strokeStyle = impColor(im); ctx.lineWidth = 2; ctx.stroke();
  txt(implantName(im), W / 2, py + 30, 18, impColor(im), "center", true);
  txt(`Pontos livres: ${free} de ${d.points}`, W / 2, py + 52, 13, free ? "#ffd96a" : "#8fd08a", "center", true);
  d.opts.forEach((o, i) => {
    const y = py + 66 + i * 36, v = (im.alloc && im.alloc[o.key]) || 0;
    ctx.fillStyle = "rgba(255,255,255,0.04)"; rr(px + 16, y, pw - 32, 30, 5); ctx.fill();
    txt(`+${o.per}% ${FX_LABEL[o.key]} por ponto`, px + 28, y + 20, 13, "#d8d2ba");
    txt(`${v} pts`, px + pw - 208, y + 20, 13, "#f2eedc", "right", true);
    txt(v ? `+${v * o.per}%` : "—", px + pw - 150, y + 20, 13, v ? "#8fd08a" : "#6d6a58", "right", true);
    btn(px + pw - 138, y + 2, 26, 26, "−", () => allocAdd(im, o.key, -1), false, !v);
    btn(px + pw - 108, y + 2, 26, 26, "+", () => allocAdd(im, o.key, 1), false, !free);
    btn(px + pw - 76, y + 2, 52, 26, "+5", () => allocAdd(im, o.key, 5), false, !free);
  });
  btn(px + 16, py + ph - 46, 150, 32, "Zerar", () => { im.alloc = {}; persist(); recalcImplants(); });
  btn(px + pw - 166, py + ph - 46, 150, 32, "Pronto", () => { ALLOC.im = null; }, true);
}
