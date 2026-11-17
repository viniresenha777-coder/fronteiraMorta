"use strict";
// Sentinelas fixas nos quatro cantos do perímetro de cada base.
// Somente o líder do setor modifica a vida dos zumbis em multiplayer.
const GUARD_LINES = [
  "Se correr, é zumbi. Se não correr, desconfie!",
  "Fim do mundo e nem folga deram...",
  "Zumbi não paga aluguel. Nem entra!",
  "Tô de olho nesses mordedores!",
  "Se eu virar zumbi, sem selfie!",
  "Aqui é base, não buffet de cérebro!",
  "Munição é cara. Mira direito!",
  "Mais um morto querendo entrar!",
  "O apocalipse não tem hora extra?",
  "Silêncio! Ouvi um morto reclamando!"
];
const GUARD_GUNS = [
  { name: "Pistola", damage: 18, interval: 1250, range: 235 },
  { name: "SMG", damage: 23, interval: 950, range: 255 },
  { name: "Rifle", damage: 30, interval: 850, range: 275 },
  { name: "Fuzil", damage: 38, interval: 720, range: 295 },
  { name: "Fuzil pesado", damage: 49, interval: 660, range: 315 },
  { name: "Metralhadora", damage: 60, interval: 560, range: 340 }
];
function installBaseGuards(wd, op, f) {
  const gun = GUARD_GUNS[Math.min(op.id, GUARD_GUNS.length - 1)];
  // Pequeno recuo dos cantos para não sobrepor o muro.
  wd.guards = [
    [f.x + 25, f.y + 25], [f.x + f.w - 25, f.y + 25],
    [f.x + 25, f.y + f.h - 25], [f.x + f.w - 25, f.y + f.h - 25]
  ].map(([x, y], i) => ({
    x, y, angle: i % 2 ? 0 : Math.PI, gun,
    cooldown: i * 180, speech: "", speechT: 0,
    chatDelay: 2500 + i * 1400, shotT: 0
  }));
}
function tickBaseGuards(dt) {
  if (game.inside || !world || !world.guards || !world.guards.length) return;
  const authoritative = typeof fmWorld === "undefined" || !fmWorld.isFollower();
  for (const g of world.guards) {
    g.cooldown -= dt;
    g.chatDelay -= dt;
    g.speechT = Math.max(0, g.speechT - dt);
    g.shotT = Math.max(0, g.shotT - dt);
    let target = null, minD = g.gun.range;
    for (const z of zombies) {
      if (!z || z.dead || z.hp <= 0) continue;
      const d = Math.hypot(z.x - g.x, z.y - g.y);
      if (d < minD) { minD = d; target = z; }
    }
    if (target) g.angle = Math.atan2(target.y - g.y, target.x - g.x);
    if (g.chatDelay <= 0) {
      g.speech = GUARD_LINES[Math.floor(Math.random() * GUARD_LINES.length)];
      g.speechT = 2800;
      g.chatDelay = 11000 + Math.random() * 12500;
    }
    if (!target || !authoritative || g.cooldown > 0) continue;
    g.cooldown = g.gun.interval;
    g.shotT = 110;
    if (Math.random() < 0.12) {
      g.speech = "Alvo à vista!"; g.speechT = 1600;
    }
    // Sem recompensas de abate do jogador e sem gastar munição do inventário.
    const damage = g.gun.damage;
    target.hp -= damage;
    target.flash = 90;
    if (target.hp <= 0) {
      target.hp = 0;
      target.dead = true;
      if (typeof addBlood === "function") addBlood(target.x, target.y, Math.max(10, target.r));
    }
  }
}
function drawBaseGuard(g) {
  if (!inView(g.x - 28, g.y - 55, 56, 100)) return;
  const x = g.x, y = g.y;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.ellipse(x + 3, y + 9, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, y); ctx.rotate(g.angle);
  // Silhueta militar: botas, colete balístico, capacete, braços e arma.
  ctx.fillStyle = "#232b22"; ctx.fillRect(-13, -10, 25, 8); ctx.fillRect(-13, 2, 25, 8);
  ctx.fillStyle = "#344536"; ctx.fillRect(-10, -12, 20, 24);
  ctx.fillStyle = "#171f18"; ctx.fillRect(-6, -10, 12, 20);
  ctx.strokeStyle = "#536552"; ctx.lineWidth = 2;
  ctx.strokeRect(-7, -11, 14, 22);
  ctx.fillStyle = "#4e5b43";
  ctx.beginPath(); ctx.arc(-5, 0, 8.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#252c25"; ctx.fillRect(4, -9, 11, 5); ctx.fillRect(4, 4, 11, 5);
  ctx.fillStyle = "#131716"; ctx.fillRect(10, -3, g.gun.range > 290 ? 29 : 23, 6);
  ctx.fillRect(22, -5, 7, 10);
  if (g.shotT > 0) {
    ctx.fillStyle = "#ffd67a"; ctx.beginPath();
    ctx.moveTo(40, 0); ctx.lineTo(50, -5); ctx.lineTo(47, 0); ctx.lineTo(50, 5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (g.speechT > 0 && g.speech) {
    const label = g.speech, ww = Math.min(270, Math.max(136, label.length * 6.4 + 20));
    const bx = Math.max(8, Math.min(WORLD_W - ww - 8, x - ww / 2)), by = y - 64;
    ctx.save();
    ctx.globalAlpha = Math.min(1, g.speechT / 400);
    ctx.fillStyle = "rgba(21,24,18,.94)"; rr(bx, by - 22, ww, 29, 6); ctx.fill();
    ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 1; ctx.stroke();
    txt(label, bx + ww / 2, by - 4, 11, "#f3e9c4", "center", true, ww - 12);
    ctx.restore();
  }
}
