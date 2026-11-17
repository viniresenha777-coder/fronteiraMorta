"use strict";
// =====================================================================
//  Economia: quanto mais perigosa a região, mais dinheiro ela paga.
//  Uma tabela por cor de região (índice de REGIONS) controla:
//   cash   = multiplicador do dinheiro achado no saque
//   bounty = dinheiro por zumbi abatido (chefe vale 40x)
//   reward = multiplicador de missões e hordas
//   travel = custo base da viagem rápida até um posto daquela região
//  E também guarda o nome do jogador (tela de criação).
// =====================================================================
const ECON = [
  { cash: 1,    bounty: 1,  reward: 1,    travel: 30 },   // Azul
  { cash: 1.35, bounty: 2,  reward: 1.3,  travel: 45 },   // Verde
  { cash: 1.8,  bounty: 3,  reward: 1.7,  travel: 65 },   // Amarela
  { cash: 2.4,  bounty: 5,  reward: 2.2,  travel: 90 },   // Laranja
  { cash: 3.2,  bounty: 8,  reward: 2.9,  travel: 130 },  // Vermelha
  { cash: 4.2,  bounty: 12, reward: 3.7,  travel: 180 },  // Vermelho-escura
  { cash: 5.4,  bounty: 17, reward: 4.7,  travel: 240 },  // Preta
  { cash: 7,    bounty: 24, reward: 6,    travel: 320 },  // Roxa
  { cash: 9,    bounty: 32, reward: 7.5,  travel: 420 }   // Cinza (Zona Morta)
];
function econ(zone) { return ECON[regionOf(zone == null ? game.area : zone)] || ECON[0]; }
// dinheiro achado no saque, já com a região, o implante Ganância e o VIP
function lootCash(base, zone) { return Math.max(1, Math.round(base * econ(zone).cash * moneyMult())); }
// recompensa por abate
function killBounty(z) {
  const b = Math.round(econ(z.zone).bounty * (z.boss ? 40 : 1) * moneyMult());
  if (b <= 0) return;
  game.money += b;
  game.floats.push({ x: z.x + 10, y: z.y - z.r - 18, text: `+$${b}`, t: 900, money: true });
}

// ---------- Nome do jogador ----------
const NAME_MIN = 3, NAME_MAX = 16;
function openNameScreen(rename) {
  // O nome é definido somente na criação do personagem; não existe renomear.
  if (rename && save.name) return;
  game.menu = "name"; game.nameDraft = ""; game.nameRename = false; game.nameBusy = false;
}
function nameKey(k) {
  if (game.nameBusy) return;
  const raw = game.rawKey || "";
  let d = game.nameDraft || "";
  if (k === "backspace") d = d.slice(0, -1);
  else if (k === "enter") { confirmName(); return; }
  else if (raw.length === 1 && /[\p{L}\p{N} _.-]/u.test(raw) && d.length < NAME_MAX) d += raw;
  game.nameDraft = d.replace(/^\s+/, "");
}
async function confirmName() {
  if (game.nameBusy) return;
  const n = (game.nameDraft || "").trim().replace(/\s+/g, " ");
  if (n.length < NAME_MIN) { toast(`O nome precisa ter pelo menos ${NAME_MIN} letras`); return; }
  game.nameBusy = true;
  try {
    // Registra um nome único no Supabase ANTES de gravá-lo no save.
    const registered = await fmSocial.claimName(n);
    save.name = registered; persist();
    game.menu = save.prof ? null : "prof";
    toast(`Bem-vindo, ${registered}!`);
    fmSocial.start().catch(console.warn);
  } catch (err) {
    toast(err.message || "Não foi possível registrar esse nome.");
  } finally { game.nameBusy = false; }
}
function drawNameScreen() {
  ctx.fillStyle = "rgba(8,9,7,0.97)"; ctx.fillRect(0, 0, W, H);
  txt("Crie o seu sobrevivente", W / 2, 120, 32, "#e5e0c8", "center", true);
  txt("Escolha o nome que vai aparecer em cima do seu personagem", W / 2, 152, 14, "#a9a58f", "center");
  const bx = W / 2 - 220, by = 200, bw = 440, bh = 60, d = game.nameDraft || "";
  ctx.fillStyle = "#14130f"; rr(bx, by, bw, bh, 10); ctx.fill();
  ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 2; ctx.stroke();
  const caret = Math.floor(performance.now() / 500) % 2 ? "|" : " ";
  txt(d ? d + caret : caret, bx + 20, by + 40, 26, d ? "#ffd96a" : "#6d6a58", "left", true, bw - 40);
  if (!d) txt("digite o nome...", bx + 34, by + 39, 18, "#55534a", "left");
  txt(`${d.length}/${NAME_MAX} · letras, números, espaço, _ - .`, W / 2, by + bh + 22, 12, d.length && d.trim().length < NAME_MIN ? "#e07b5a" : "#8a8672", "center");
  btn(W / 2 - 110, by + 110, 220, 46, game.nameBusy ? "Registrando..." : "Confirmar (Enter)", confirmName, true, d.trim().length < NAME_MIN || game.nameBusy);
  txt("Depois você escolhe a profissão · o nome será definitivo", W / 2, by + 190, 12, "#8a8672", "center");
  if (game.msgT > 0) txt(game.msg, W / 2, H - 60, 15, "#ffd96a", "center", true);
}
function playerName() { return save.name || "Sobrevivente"; }
