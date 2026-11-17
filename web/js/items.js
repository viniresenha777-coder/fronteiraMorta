"use strict";
// =====================================================================
//  Itens: arsenal, munição, materiais, receitas de craft, melhorias
//  e os ícones (desenhados em código) que aparecem nos menus.
// =====================================================================

// ---------- Munição ----------
// box = balas por caixa; price = preço da caixa na loja
const AMMO = {
  "9mm":         { box: 15, price: 12 },
  ".45":         { box: 12, price: 16 },
  ".50":         { box: 8,  price: 22 },
  "5.56":        { box: 30, price: 40 },
  "7.62":        { box: 20, price: 40 },
  "cartucho":    { box: 8,  price: 26 },
  "combustível": { box: 60, price: 45 },
  "virote":      { box: 6,  price: 30 },
  "granada":     { box: 4,  price: 120 }
};
// ---------- Raridade ----------
const RARITY = [
  { name: "Comum",    color: "#c9c4b4" },
  { name: "Incomum",  color: "#6fd06a" },
  { name: "Rara",     color: "#4aa3ff" },
  { name: "Épica",    color: "#b46bff" },
  { name: "Lendária", color: "#ffb030" }
];
// ruído padrão por categoria: [raio (1 = máximo), chance de ouvir]
const CAT_SOUND = { pistols: [0.35, 0.5], machinegun: [1, 1], shotguns: [1, 1], rifles: [0.7, 0.8], melee: [0, 0] };
const CAT_LABEL = { pistols: "Pistola", machinegun: "Metralhadora", shotguns: "Escopeta", rifles: "Rifle", melee: "Corpo a corpo" };

// ---------- Arsenal ----------
// look = formato do desenho · req = [força, proficiência] · slow = % de velocidade perdida com a arma na mão
const WLIST = [
  // pistolas
  { id: "pistola",  name: "Pistola 9mm",   cat: "pistols", look: "pistol",   dmg: 20, delay: 300, mag: 12, reload: 1000, ammo: "9mm",  price: 0,    req: [0, 5],  len: 14, color: "#3b3a30", sound: [0.1, 0.15] },
  { id: "colt",     name: "Colt .45",      cat: "pistols", look: "pistol",   dmg: 32, delay: 330, mag: 8,  reload: 1100, ammo: ".45",  price: 300,  req: [10, 20], len: 15, color: "#6a6a66" },
  { id: "glock",    name: "Glock 18",      cat: "pistols", look: "pistol",   dmg: 15, delay: 110, mag: 20, reload: 1100, ammo: "9mm",  price: 350,  req: [10, 25], len: 15, color: "#2a2a2a", short: "Glock 18" },
  { id: "revolver", name: "Revólver Magnum", short: "Magnum", cat: "pistols", look: "revolver", dmg: 58, delay: 560, mag: 6, reload: 1900, ammo: ".50", price: 650, req: [15, 35], len: 17, color: "#8a8f96" },
  { id: "deagle",   name: "Desert Eagle",  short: "Desert", cat: "pistols", look: "pistol", dmg: 45, delay: 380, mag: 7, reload: 1400, ammo: ".50", price: 900, req: [20, 45], len: 18, color: "#9aa0a6" },
  // submetralhadoras
  { id: "uzi",      name: "Uzi",           cat: "machinegun", look: "smg",   dmg: 13, delay: 75,  mag: 32, reload: 1500, ammo: "9mm",  price: 500,  req: [10, 25], len: 18, color: "#3a3a3a", sound: [0.8, 0.9] },
  { id: "mp5",      name: "MP5",           cat: "machinegun", look: "smg",   dmg: 17, delay: 85,  mag: 30, reload: 1600, ammo: "9mm",  price: 800,  req: [15, 35], len: 20, color: "#2f3236", sound: [0.8, 0.9] },
  { id: "p90",      name: "P90",           cat: "machinegun", look: "smg",   dmg: 19, delay: 70,  mag: 50, reload: 2000, ammo: "5.56", price: 1700, req: [20, 60], len: 20, color: "#3d4436" },
  { id: "vector",   name: "Vector",        cat: "machinegun", look: "smg",   dmg: 24, delay: 60,  mag: 25, reload: 1500, ammo: ".45",  price: 2600, req: [25, 80], len: 20, color: "#22262a" },
  // fuzis de assalto
  { id: "ak47",     name: "AK-47",         cat: "machinegun", look: "ar",    dmg: 50, delay: 160, mag: 30, reload: 1800, ammo: "7.62", price: 1000, req: [30, 60], len: 30, color: "#5a3d22", wood: true },
  { id: "m4",       name: "M4A1",          cat: "machinegun", look: "ar",    dmg: 40, delay: 120, mag: 30, reload: 1600, ammo: "5.56", price: 1400, req: [25, 70], len: 30, color: "#2f3236" },
  { id: "fal",      name: "FAL",           cat: "machinegun", look: "ar",    dmg: 68, delay: 200, mag: 20, reload: 2000, ammo: "7.62", price: 2000, req: [35, 85], len: 32, color: "#4a3a28", wood: true },
  { id: "scar",     name: "SCAR-H",        cat: "machinegun", look: "ar",    dmg: 64, delay: 140, mag: 20, reload: 1900, ammo: "7.62", price: 3000, req: [40, 100], len: 31, color: "#8a7a5a" },
  // metralhadoras pesadas
  { id: "m249",     name: "M249",          cat: "machinegun", look: "lmg",   dmg: 38, delay: 90,  mag: 100, reload: 4000, ammo: "5.56", price: 4200, req: [55, 110], len: 34, color: "#2a2d30", slow: 6 },
  { id: "minigun",  name: "Minigun",       cat: "machinegun", look: "minigun", dmg: 30, delay: 45, mag: 250, reload: 6000, ammo: "5.56", price: 9000, req: [80, 120], len: 34, color: "#4a4d50", slow: 14 },
  // escopetas
  { id: "canoduplo", name: "Cano Duplo",   cat: "shotguns", look: "shotgun", dmg: 26, delay: 350, mag: 2,  reload: 1500, ammo: "cartucho", price: 450,  req: [15, 30], len: 26, color: "#6b4a2b", wood: true, pellets: 6, spread: 0.32, life: 360 },
  { id: "escopeta", name: "Escopeta",      cat: "shotguns", look: "shotgun", dmg: 22, delay: 800, mag: 6,  reload: 2200, ammo: "cartucho", price: 700,  req: [20, 40], len: 28, color: "#6b4a2b", wood: true, pellets: 5, spread: 0.28, life: 380 },
  { id: "spas",     name: "SPAS-12",       cat: "shotguns", look: "shotgun", dmg: 24, delay: 450, mag: 8,  reload: 2600, ammo: "cartucho", price: 1900, req: [30, 70], len: 28, color: "#2a2a2a", pellets: 6, spread: 0.26, life: 400 },
  { id: "aa12",     name: "AA-12",         cat: "shotguns", look: "shotgun", dmg: 20, delay: 220, mag: 20, reload: 3000, ammo: "cartucho", price: 4500, req: [50, 110], len: 28, color: "#3a3d40", pellets: 5, spread: 0.3, life: 380, drum: true },
  // rifles
  { id: "caca",     name: "Rifle de Caça", cat: "rifles", look: "rifle",   dmg: 90,  delay: 900,  mag: 5,  reload: 2200, ammo: "7.62", price: 900,  req: [15, 35],  len: 34, color: "#6b4a2b", pierce: true, speed: 17, life: 1200 },
  { id: "sniper",   name: "Rifle Básico",        cat: "rifles", look: "rifle",   dmg: 120, delay: 1100, mag: 5,  reload: 2400, ammo: "7.62", price: 1500, req: [25, 70],  len: 36, color: "#2f3b2a", pierce: true, speed: 18, life: 1300, sound: [0.1, 0.15] },
  { id: "barrett",  name: "Barrett .50",   cat: "rifles", look: "rifle",   dmg: 260, delay: 1400, mag: 10, reload: 3200, ammo: ".50",  price: 6500, req: [60, 120], len: 40, color: "#3a3d32", pierce: true, speed: 20, life: 1500, sound: [1, 1] },
  // corpo a corpo
  { id: "faca",     name: "Faca",          cat: "melee", look: "knife",   dmg: 18,  delay: 250,  range: 42, arc: 0.7,  price: 100,  req: [0, 5],  len: 16, color: "#c9ced2" },
  { id: "taco",     name: "Taco de beisebol", short: "Taco", cat: "melee", look: "bat", dmg: 30, delay: 480, range: 56, arc: 0.9, price: 150, req: [10, 15], len: 28, color: "#8a6a45" },
  { id: "facao",    name: "Facão",         cat: "melee", look: "machete", dmg: 42,  delay: 420,  range: 58, arc: 0.85, price: 400,  req: [15, 30], len: 28, color: "#b9bec2" },
  { id: "katana",   name: "Katana",        cat: "melee", look: "katana",  dmg: 35,  delay: 450,  range: 62, arc: 0.95, price: 600,  req: [10, 20], len: 34, color: "#d7dde0" },
  { id: "machado",  name: "Machado",       cat: "melee", look: "axe",     dmg: 80,  delay: 900,  range: 58, arc: 0.8,  price: 450,  req: [25, 45], len: 30, color: "#a9a58f" },
  { id: "marreta",  name: "Marreta",       cat: "melee", look: "hammer",  dmg: 130, delay: 1200, range: 62, arc: 0.9,  price: 1100, req: [50, 70], len: 34, color: "#6a6d70", knock: true },
  { id: "espada",   name: "Espada longa",  short: "Espada", cat: "melee", look: "sword", dmg: 70, delay: 600, range: 78, arc: 1.0, price: 1800, req: [40, 90], len: 40, color: "#d0d4d8" },
  // lendárias (só em saques de VIP)
  { id: "ak_ouro",  name: "AK-47 Dourada", short: "AK Ouro", cat: "machinegun", look: "ar", dmg: 70, delay: 120, mag: 40, reload: 1600, ammo: "7.62", price: 0, req: [60, 120], len: 32, color: "#d4af37", legendary: true },
  { id: "katana_dragao", name: "Katana do Dragão", short: "Katana Dr.", cat: "melee", look: "katana", dmg: 90, delay: 380, range: 72, arc: 1.1, price: 0, req: [70, 120], len: 38, color: "#e05a3a", legendary: true },
  // especiais (só criando na oficina)
  { id: "besta",    name: "Besta silenciosa", short: "Besta", cat: "rifles", look: "crossbow", dmg: 160, delay: 850, mag: 1, reload: 900, ammo: "virote", price: 0, req: [20, 50], len: 30, color: "#5a4a32", pierce: true, speed: 15, life: 1300, sound: [0, 0], special: true },
  { id: "serra",    name: "Serra elétrica", short: "Serra", cat: "melee", look: "chainsaw", dmg: 22, delay: 90, range: 52, arc: 0.55, price: 0, req: [30, 60], len: 34, color: "#d08a2a", sound: [0.6, 0.8], special: true },
  { id: "lancachamas", name: "Lança-chamas", short: "Lança-ch.", cat: "machinegun", look: "flamer", dmg: 9, delay: 60, mag: 120, reload: 2600, ammo: "combustível", price: 0, req: [35, 70], len: 30, color: "#a33b32", pellets: 3, spread: 0.22, life: 300, speed: 7, pierce: true, fire: true, sound: [0.5, 0.6], special: true },
  { id: "lamina",   name: "Lâmina Sombria", short: "Lâmina S.", cat: "melee", look: "katana", dmg: 110, delay: 420, range: 74, arc: 1.05, price: 0, req: [60, 120], len: 40, color: "#8a5ae0", lifesteal: 0.08, special: true },
  { id: "trovao",   name: "Rifle Trovão",  short: "Trovão", cat: "rifles", look: "rifle", dmg: 300, delay: 1300, mag: 4, reload: 2800, ammo: ".50", price: 0, req: [70, 120], len: 40, color: "#3a5a8a", pierce: true, explode: 90, speed: 18, life: 1400, sound: [1, 1], special: true },
  // novas armas com efeitos (bleed = chance de sangramento · burn = dano de fogo por segundo · stun = chance de atordoar · crit = +% de crítico)
  { id: "silenciada", name: "Pistola silenciada", short: "Silenciada", cat: "pistols", look: "pistol", dmg: 24, delay: 280, mag: 15, reload: 1100, ammo: "9mm", price: 550, req: [10, 30], len: 18, color: "#2a2a2a", sound: [0.02, 0.05] },
  { id: "revolver_orn", name: "Revólver Ornamentado", short: "Ornamentado", cat: "pistols", look: "revolver", dmg: 110, delay: 520, mag: 6, reload: 1700, ammo: ".50", price: 0, req: [30, 90], len: 18, color: "#b07a3a", crit: 25 },
  { id: "incendiaria", name: "Escopeta Incendiária", short: "Incendiária", cat: "shotguns", look: "shotgun", dmg: 26, delay: 600, mag: 8, reload: 2400, ammo: "cartucho", price: 0, req: [40, 100], len: 28, color: "#c0502a", wood: true, pellets: 6, spread: 0.3, life: 380, burn: 18 },
  { id: "choque",   name: "Rifle de Choque", short: "Choque", cat: "rifles", look: "rifle", dmg: 140, delay: 900, mag: 8, reload: 2200, ammo: "7.62", price: 0, req: [45, 110], len: 36, color: "#3a8ac0", pierce: true, speed: 19, life: 1300, stun: 0.6 },
  { id: "baioneta", name: "Fuzil Baioneta", short: "Baioneta", cat: "machinegun", look: "ar", dmg: 58, delay: 130, mag: 30, reload: 1700, ammo: "5.56", price: 0, req: [40, 100], len: 34, color: "#5a5d60", bleed: 0.3 },
  { id: "lancador", name: "Lançador Espinhoso", short: "Lançador", cat: "rifles", look: "rifle", dmg: 220, delay: 1100, mag: 6, reload: 3000, ammo: "granada", price: 0, req: [45, 110], len: 30, color: "#4a4a4a", explode: 120, speed: 8, life: 1100, sound: [1, 1], grenade: true },
  { id: "machado_fuzil", name: "Fuzil-Machado", short: "Fuzil-Mach.", cat: "machinegun", look: "lmg", dmg: 85, delay: 140, mag: 40, reload: 2600, ammo: "7.62", price: 0, req: [60, 120], len: 38, color: "#6a6d70", pierce: true, knock: true, slow: 8 },
  { id: "pistolalamina", name: "Pistola-Lâmina", short: "P.-Lâmina", cat: "shotguns", look: "shotgun", dmg: 60, delay: 420, mag: 6, reload: 1800, ammo: "cartucho", price: 0, req: [50, 120], len: 32, color: "#b08a4a", pellets: 4, spread: 0.18, life: 420, bleed: 0.5, lifesteal: 0.05 },
  { id: "espadaserra", name: "Espada-Serra", short: "Esp.-Serra", cat: "melee", look: "chainsaw", dmg: 60, delay: 160, range: 70, arc: 0.8, price: 0, req: [60, 120], len: 40, color: "#a33b32", bleed: 0.6, sound: [0.6, 0.8] },
  { id: "espadafogo", name: "Espada Flamejante", short: "Esp. Fogo", cat: "melee", look: "sword", dmg: 150, delay: 520, range: 82, arc: 1.05, price: 0, req: [70, 120], len: 42, color: "#ff8a3a", burn: 40 },
  // munição infinita, mas superaquece: segure o tiro com cuidado
  { id: "minigun_inf", name: "Minigun Infernal", short: "Infernal", cat: "machinegun", look: "minigun", dmg: 26, delay: 50, mag: 600, reload: 3250, ammo: "", price: 0, req: [100, 120], minLevel: 25, len: 36, color: "#8a6a4a", slow: 20, infinite: true, noCrit: true, spread: 0.2, sound: [1, 1] },
  // sem arma na mão
  { id: "punhos",   name: "Punhos",        cat: "melee", look: "fists",   dmg: 8,   delay: 400,  range: 34, arc: 0.7,  price: 0,    req: [0, 0],   len: 8,  color: "#d2b48c", fists: true }
];
// raridade de cada arma: 0 comum · 1 incomum · 2 rara · 3 épica · 4 lendária
const W_RAR = {
  pistola: 0, colt: 0, faca: 0, taco: 0, uzi: 0, canoduplo: 0,
  glock: 1, revolver: 1, mp5: 1, escopeta: 1, caca: 1, facao: 1, katana: 1, machado: 1, silenciada: 1,
  deagle: 2, p90: 2, ak47: 2, m4: 2, fal: 2, spas: 2, sniper: 2, marreta: 2, besta: 2, serra: 2,
  vector: 3, scar: 3, m249: 3, aa12: 3, barrett: 3, espada: 3, minigun: 3, lancachamas: 3, lamina: 3,
  revolver_orn: 3, incendiaria: 3, choque: 3, baioneta: 3, lancador: 3,
  ak_ouro: 4, katana_dragao: 4, trovao: 4, machado_fuzil: 4, pistolalamina: 4, espadaserra: 4, espadafogo: 4, minigun_inf: 4, punhos: 0
};
// arte das folhas em img/ usada por cada arma (tint = filtro de cor)
const W_SPR = {
  pistola: "pistol_sil", silenciada: "pistol_sil", revolver: "revolver", m4: "m4", ak47: "ak", fal: "ak", mp5: "smg", uzi: "smg",
  escopeta: "shotgun_pump", canoduplo: "shotgun_pump", sniper: "sniper", caca: "sniper", barrett: "sniper", besta: "crossbow",
  minigun: "minigun", machado: "axe", taco: "spikebat", facao: "machete", revolver_orn: "revolver_orn", baioneta: "bayonet",
  machado_fuzil: "axerifle", pistolalamina: "gunblade", lancador: "spiked", espadaserra: "chainsword", minigun_inf: "minigun_orn",
  espadafogo: "flamesword", ak_ouro: "ak", incendiaria: "shotgun_pump", choque: "o_sniper2", scar: "o_ar",
  // pacote CC0 "2D Guns" (OpenGameArt)
  colt: "o_pistol", glock: "o_pistol2", deagle: "o_pistol3", vector: "o_smg", p90: "o_smg2", spas: "o_shotgun2", aa12: "o_shotgun",
  caca: "o_sniper", barrett: "o_sniper2", fal: "o_ar2", m249: "o_ar2"
};
const W_TINT = { ak_ouro: "sepia(1) saturate(4) hue-rotate(-12deg) brightness(1.25)", incendiaria: "sepia(0.6) saturate(3) hue-rotate(-25deg)",
  choque: "hue-rotate(-20deg) saturate(2.2) brightness(1.1)", barrett: "grayscale(0.7) brightness(0.75)", uzi: "brightness(0.8)",
  canoduplo: "sepia(0.4) brightness(0.9)", scar: "sepia(0.8) saturate(1.4) brightness(1.05)", m249: "grayscale(0.8) brightness(0.65) contrast(1.3)",
  p90: "hue-rotate(60deg) saturate(0.8)", aa12: "grayscale(0.8) brightness(0.7)", glock: "grayscale(0.9) brightness(0.7)", deagle: "grayscale(0.6) brightness(1.15)" };
// ícone de cada munição
const AMMO_SPR = { "9mm": "o_mag", ".45": "o_mag2", "5.56": "o_mag3", "7.62": "o_bullet_l", ".50": "o_bullet_l", "granada": "o_grenade", "virote": "crossbow" };
const CRAFT_ONLY = ["besta", "serra", "lancachamas", "lamina", "trovao"];
const WDEF = {};
WLIST.forEach((d) => {
  WDEF[d.id] = d;
  d.melee = d.cat === "melee";
  const s = d.sound || CAT_SOUND[d.cat];
  d.sound = s[0]; d.hear = s[1];
  d.rar = W_RAR[d.id] != null ? W_RAR[d.id] : 0;
  d.spr = W_SPR[d.id]; d.tint = W_TINT[d.id];
  d.craftOnly = CRAFT_ONLY.includes(d.id);
  if (d.id === "taco") { d.name = "Taco com pregos"; d.bleed = 0.25; }
});
function rarColor(d) { return RARITY[d.rar].color; }
// IDs do jogo antigo (armas por número) para migrar saves
const OLD_IDS = ["pistola", "ak47", "deagle", "katana", "uzi", "escopeta", "sniper", "machado", "ak_ouro", "katana_dragao"];

// ---------- Materiais e receitas ----------
const MATS = {
  reset_stats: { name: "Cartão Reset de Stats", price: 5000 },
  trindade_eterna: { name: "Trindade · 100 anos", price: 20000000 },
  sucata:      { name: "Sucata de metal",          price: 40 },
  pecas:       { name: "Peças de arma",            price: 90 },
  eletronicos: { name: "Componentes eletrônicos",  price: 140 },
  nucleo:      { name: "Núcleo raro",              price: 0 },
  placa:       { name: "Placa de blindagem",       price: 0 },
  cofre10k:    { name: "Cofre 10.000", price: 1000, cashProtection: 10000 },
  cofre100k:   { name: "Cofre 100.000", price: 10000, cashProtection: 100000 },
  cofre500k:   { name: "Cofre 500.000", price: 50000, cashProtection: 500000 }
};
const SAFE_IDS = ["cofre10k", "cofre100k", "cofre500k"];
function cashProtection(pack = player.pack) {
  return pack.reduce((limit, it) => Math.max(limit,
    it && it.kind === "mat" && it.qty > 0 ? (MATS[it.id] && MATS[it.id].cashProtection) || 0 : 0), 0);
}
function safeDescription(id) { return `Protege até $${MATS[id].cashProtection.toLocaleString("pt-BR")} ao morrer.`; }
const RECIPES = [
  { id: "besta",       mats: { sucata: 4, pecas: 4 },                     money: 1200, level: 8 },
  { id: "serra",       mats: { sucata: 6, pecas: 3, eletronicos: 3 },     money: 1500, level: 10 },
  { id: "lancachamas", mats: { sucata: 8, pecas: 5, eletronicos: 3 },     money: 2500, level: 15 },
  { id: "lamina",      mats: { sucata: 10, pecas: 4, nucleo: 1 },         money: 4000, level: 25 },
  { id: "trovao",      mats: { pecas: 10, eletronicos: 6, nucleo: 2 },    money: 8000, level: 40 },
  { id: "minigun_inf", mats: { pecas: 14, eletronicos: 10, nucleo: 4 },   money: 15000, level: 60 },
  // colete nº 10: craft difícil (precisa ter o nº 9, que é consumido)
  { vest: 9, mats: { sucata: 40, pecas: 30, eletronicos: 20, nucleo: 8, placa: 3 }, money: 50000, level: 100, needVest: 8 }
];
// chance de achar material em cada lugar
const MAT_CHANCE = { airdrop: 1, corpse: 0.08, boss: 1, chest: 0.4, trash: 0.12, dumpster: 0.3, crate: 0.4, car: 0.35, "Bancada": 0.6, "Armário de armas": 0.3, "Vitrine": 0.2, "Mesa": 0.08, "Arquivo": 0.06 };

// ---------- Melhorias (até 8 em cada) ----------
const UP_MAX = 8;
const UP_STATS = [
  { id: "acc", name: "Precisão" },
  { id: "dmg", name: "Dano" },
  { id: "rel", name: "Velocidade de recarga" }
];
function upEffect(d, stat, lv) {
  if (stat === "dmg") return `+${Math.round(lv * 6)}% de dano`;
  if (stat === "acc") return d.melee ? `+${lv * 4}% de alcance` : `-${lv * 9}% de dispersão`;
  return d.melee ? `-${lv * 4}% de tempo entre golpes` : `-${lv * 6}% no tempo de recarga`;
}
// Each roll replaces every stat, including when the old roll was stronger.
function rollUpgrades(stats, max, random = Math.random) {
  return Object.fromEntries(stats.map(s => [s.id, 1 + Math.floor(random() * max)]));
}
function upgradeCost(inst) {
  const d = WDEF[inst.id];
  return { money: Math.round(240 + (d.special || d.legendary ? 3000 : d.price) * 0.24), mats: { sucata: 2 } };
}
const VEST_UP_MAX = 24;
const VEST_UP_STATS = [{ id: "armor", name: "Armadura" }, { id: "speed", name: "Velocidade" }];
function cleanVestUpgrade(up) {
  const out = {};
  for (const s of VEST_UP_STATS) {
    const n = Number(up && up[s.id]);
    out[s.id] = Number.isFinite(n) ? clamp(Math.floor(n), 0, VEST_UP_MAX) : 0;
  }
  return out;
}
function vestUpgrade(i = save.vest) {
  return cleanVestUpgrade(i >= 0 && save.vestUpgrades ? save.vestUpgrades[i] : null);
}
function vestUpgradeCost(i) {
  return { money: Math.round(240 + VESTS[i].price * 0.24), mats: { sucata: 2 } };
}
function vestSpeedBonus() { return vestUpgrade().speed; }

// ---------- Instâncias de armas ----------
const SLOT_N = 3, PACK_MAX = 20, VAULT_MAX = 40;
function newInst(id, up) { return { kind: "weapon", id, up: Object.assign({ acc: 0, dmg: 0, rel: 0 }, up || {}), ammo: WDEF[id].mag || 0 }; }
function wStat(inst) {
  const d = WDEF[inst ? inst.id : "punhos"], u = inst ? inst.up : { acc: 0, dmg: 0, rel: 0 };
  return {
    dmg: d.dmg * (1 + 0.06 * u.dmg),
    spread: (d.spread || 0.03) * (1 - 0.09 * u.acc),
    // Rifles: recarga 15% mais lenta, mantendo upgrades e atributos ativos.
    reload: (d.reload || 0) * (1 - 0.06 * u.rel) * (d.cat === "rifles" ? 1.15 : 1),
    delay: d.melee ? d.delay * (1 - 0.04 * u.rel) : d.delay,
    range: d.melee ? d.range * (1 + 0.04 * u.acc) : 0
  };
}
function curInst() { return player.slots[player.cur]; }
function curW() { const i = curInst(); return WDEF[i ? i.id : "punhos"]; }
function upSum(inst) { return inst.up.acc + inst.up.dmg + inst.up.rel; }
function instName(inst) { const s = upSum(inst); return WDEF[inst.id].name + (inst.gc && inst.up.acc === 8 && inst.up.dmg === 8 && inst.up.rel === 8 ? " (GC)" : (s ? ` +${s}` : "")); }
function canUse(d) { if (adm.noReq || d.fists) return true; return A("str") >= d.req[0] && A(d.cat) >= d.req[1] && (!d.minLevel || player.level >= d.minLevel); }
function reqText(d) { return `${d.minLevel ? `Nível ${d.minLevel}+ · ` : ""}Força ${d.req[0]} · ${CATNAME[d.cat]} ${d.req[1]}`; }
function dmgMult(d) {
  const m = 1 + (A(d.cat) - 10) * 0.005;
  return m * (d.melee ? 1 + (A("str") - 10) * 0.01 : 1 + (A("acc") - 10) * 0.003);
}
// coloca a arma num slot vazio; senão na mochila
function addWeapon(inst) {
  const e = player.slots.indexOf(null);
  if (e >= 0) { player.slots[e] = inst; return "slot"; }
  if (packUsed() < PACK_MAX) { player.pack.push(inst); return "pack"; }
  return null;
}
function addMat(id, n, list, max) {
  list = list || player.pack; max = max || PACK_MAX;
  const st = list.find((it) => it.kind === "mat" && it.id === id);
  if (st) { st.qty += n; return true; }
  if ((list === player.pack ? packUsed() : list.length) >= max) return false;
  list.push({ kind: "mat", id, qty: n });
  return true;
}
// materiais da mochila contam sempre; os do baú contam quando você está num posto
function matCount(id) {
  let n = 0;
  for (const it of player.pack) if (it.kind === "mat" && it.id === id) n += it.qty;
  if (inSafe()) for (const it of save.vault) if (it.kind === "mat" && it.id === id) n += it.qty;
  return n;
}
function takeMat(id, n) {
  for (const list of [player.pack, save.vault]) {
    for (const it of list) if (n > 0 && it.kind === "mat" && it.id === id) { const t = Math.min(n, it.qty); it.qty -= t; n -= t; }
    for (let i = list.length - 1; i >= 0; i--) if (list[i].kind === "mat" && list[i].qty <= 0) list.splice(i, 1);
  }
}
function hasMats(mats) { return Object.keys(mats).every((k) => matCount(k) >= mats[k]); }
function allMyWeapons() { return [...player.slots.filter(Boolean), ...player.pack.filter((it) => it.kind === "weapon")]; }
function usedAmmoTypes() {
  const set = new Set();
  for (const it of allMyWeapons()) { const d = WDEF[it.id]; if (!d.melee && d.ammo) set.add(d.ammo); }
  return [...set];
}
// sorteia a raridade pela região (VIP puxa para raridades maiores) e depois uma arma dessa raridade
function rollRarity(zone, boost) {
  let w = REGIONS[regionOf(zone)].loot.slice();
  if (player && player.fx && Math.random() * 100 < player.fx.luck) boost++;
  for (let b = 0; b < boost; b++) w = w.map((v, i) => v * 0.65 + (i > 0 ? w[i - 1] * 0.35 : 0));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
}
function randomWeaponDrop(zone, boost) {
  let rar = rollRarity(zone, boost || 0);
  for (; rar >= 0; rar--) {
    const list = WLIST.filter((d) => d.rar === rar && !d.craftOnly && !d.fists && d.id !== "pistola");
    if (list.length) return pick(list).id;
  }
  return "colt";
}
const FOOD_SPR = ["beans", "tuna", "soup", "cereal", "chocobar", "meat", "fishcan", "potatoes"];
const MED_SPR = ["medkit", "pills", "bandage", "syringes"];

// =====================================================================
//  Ícones dos itens (vista lateral), desenhados em código
// =====================================================================
function R_(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function RR_(x, y, w, h, ang, c) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = c; ctx.fillRect(0, 0, w, h); ctx.restore(); }
function drawWeaponSide(d, cx, cy, s) {
  const ic = weaponIcon(d);                     // arma com modelo 3D: usa a foto do próprio modelo
  if (ic) {
    const f = WEAPON_3D[d.id].f;
    if (f) ctx.filter = f;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(ic, cx - 64 * s, cy - 32 * s, 128 * s, 64 * s);
    ctx.filter = "none";
    return;
  }
  if (d.spr && SPR[d.spr]) {
    if (d.tint) ctx.filter = d.tint;
    drawSpr(d.spr, cx, cy, 128 * s, 62 * s);
    ctx.filter = "none";
    return;
  }
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  const c = d.color, dk = shade(c, -0.45), lt = shade(c, 0.3), metal = "#2b2d30", wood = "#6b4a2b";
  ctx.lineCap = "round";
  switch (d.look) {
    case "pistol":
      RR_(-20, 1, 12, 22, 0.25, dk); R_(-24, -12, 48, 11, c); R_(-24, -12, 48, 3, lt); R_(-22, -2, 38, 6, dk); R_(24, -9, 3, 5, metal);
      ctx.strokeStyle = metal; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-3, 6, 5, 0, Math.PI); ctx.stroke(); break;
    case "revolver":
      RR_(-24, 0, 12, 22, 0.35, wood); R_(-22, -9, 12, 11, c); R_(-12, -13, 16, 15, dk);
      for (let i = 0; i < 3; i++) R_(-11 + i * 5, -12, 1.5, 13, "rgba(0,0,0,0.4)");
      R_(4, -11, 30, 7, c); R_(4, -11, 30, 2, lt); R_(-18, -17, 5, 5, metal); break;
    case "smg":
      R_(-46, -8, 20, 3, metal); R_(-46, -8, 3, 12, metal); RR_(-20, 4, 9, 16, 0.2, dk); RR_(-2, 4, 8, 22, 0.1, dk);
      R_(-26, -10, 44, 14, c); R_(-26, -10, 44, 3, lt); R_(18, -6, 16, 5, metal); break;
    case "ar":
      R_(-60, -8, 24, 12, d.wood ? wood : dk); RR_(-6, 3, 10, 24, 0.25, dk); RR_(-28, 3, 9, 16, 0.25, dk);
      R_(-36, -11, 44, 14, c); R_(-36, -11, 44, 3, lt); R_(8, -9, 26, 10, d.wood ? wood : shade(c, -0.2));
      R_(34, -6, 26, 4, metal); R_(52, -12, 3, 6, metal); R_(-30, -15, 6, 4, metal); break;
    case "lmg":
      R_(-60, -9, 22, 14, dk); R_(-14, 5, 22, 18, "#3d4436"); R_(-38, -13, 52, 18, c); R_(-38, -13, 52, 3, lt);
      R_(14, -7, 46, 5, metal); R_(-20, -19, 22, 4, metal);
      ctx.strokeStyle = metal; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(40, -2); ctx.lineTo(34, 20); ctx.moveTo(40, -2); ctx.lineTo(46, 20); ctx.stroke(); break;
    case "minigun":
      for (let i = 0; i < 5; i++) R_(0, -12 + i * 5, 58, 3.5, metal);
      R_(10, -14, 4, 26, dk); R_(42, -14, 4, 26, dk); R_(-44, -4, 12, 16, dk);
      R_(-34, -15, 36, 28, c); R_(-34, -15, 36, 4, lt); R_(-22, -24, 18, 5, metal);
      ctx.fillStyle = "#c9a23a"; for (let i = 0; i < 6; i++) circle(-30 + i * 6, 18, 2.5); break;
    case "shotgun":
      R_(-60, -6, 26, 12, d.wood ? wood : dk); R_(-36, -9, 26, 12, c); R_(-36, -9, 26, 3, lt); R_(-10, -8, 64, 5, metal); R_(-10, -2, 48, 4, dk);
      R_(6, -3, 22, 8, d.wood ? wood : dk); RR_(-30, 3, 8, 14, 0.25, dk);
      if (d.drum) { ctx.fillStyle = dk; circle(-18, 12, 9); } break;
    case "rifle":
      R_(-60, -6, 30, 13, d.color === "#3a5a8a" ? dk : wood); RR_(-26, 4, 8, 14, 0.3, dk); R_(-32, -8, 30, 11, c); R_(-32, -8, 30, 3, lt);
      R_(-2, -6, 62, 4, metal); R_(-26, -19, 32, 7, metal); ctx.fillStyle = "#6fa8d0"; circle(-26, -15.5, 3); circle(6, -15.5, 3); R_(-12, -11, 4, 6, lt);
      if (d.explode) { ctx.fillStyle = "#8fb3ff"; for (let i = 0; i < 3; i++) R_(10 + i * 14, -9, 6, 2, "#8fb3ff"); } break;
    case "crossbow":
      R_(-50, -5, 70, 9, wood); ctx.strokeStyle = c === "#5a4a32" ? "#3a3a3a" : c; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(14, -26); ctx.quadraticCurveTo(30, 0, 14, 26); ctx.stroke();
      ctx.strokeStyle = "#ddd"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(14, -26); ctx.lineTo(-10, 0); ctx.lineTo(14, 26); ctx.stroke();
      R_(-10, -1.5, 46, 3, "#8a6a45"); poly([[36, -4], [44, 0], [36, 4]], "#9aa0a6"); break;
    case "flamer":
      ctx.fillStyle = c; rr(-46, -6, 30, 22, 6); ctx.fill(); R_(-46, -6, 30, 4, lt); R_(-18, -6, 26, 5, metal);
      R_(8, -10, 40, 10, dk); R_(48, -8, 8, 6, "#e0b040"); ctx.fillStyle = "#ff9a3a"; circle(60, -5, 3); break;
    case "knife":
      R_(-30, -4, 22, 8, "#2a2a2a"); R_(-9, -7, 3, 14, "#8a8f96"); poly([[-6, -5], [36, -1], [40, 2], [-6, 5]], c); break;
    case "machete":
      R_(-38, -4, 22, 8, "#3a2a1a"); poly([[-16, -6], [42, -8], [48, 0], [40, 6], [-16, 5]], c); R_(-14, -5, 50, 2, lt); break;
    case "katana":
      R_(-52, -3.5, 26, 7, "#2a1a1a");
      ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-50 + i * 5, -3); ctx.lineTo(-47 + i * 5, 3); ctx.stroke(); }
      ctx.fillStyle = "#c9a23a"; ellipse(-24, 0, 3, 9);
      poly([[-21, -3], [52, -4], [60, 0], [52, 3], [-21, 3]], c); R_(-20, -2.5, 70, 1.2, lt);
      if (d.legendary || d.special) { ctx.shadowColor = c; ctx.shadowBlur = 12; R_(-20, -1, 70, 2, lt); ctx.shadowBlur = 0; } break;
    case "sword":
      R_(-48, -3, 22, 6, "#4a3220"); R_(-27, -12, 5, 24, "#8a8f96"); poly([[-22, -4], [54, -3], [60, 0], [54, 3], [-22, 4]], c); R_(-20, -0.5, 66, 1, dk); break;
    case "bat":
      poly([[-50, -3], [30, -8], [46, -7], [46, 7], [30, 8], [-50, 3]], c); ctx.fillStyle = shade(c, -0.3); circle(-52, 0, 5); R_(-46, -4, 14, 8, "#2a2a2a"); break;
    case "axe":
      R_(-50, -3, 90, 6, "#6b4a2b"); poly([[28, -6], [44, -22], [54, -20], [54, 18], [44, 20], [28, 6]], c); R_(51, -19, 3, 36, lt); break;
    case "hammer":
      R_(-50, -3, 82, 6, "#5a3d22"); R_(28, -16, 22, 32, c); R_(28, -16, 22, 4, lt); R_(28, 12, 22, 4, dk); break;
    case "chainsaw":
      ctx.fillStyle = c; rr(-46, -14, 42, 26, 6); ctx.fill(); R_(-46, -14, 42, 4, lt);
      ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-26, -16, 10, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = "#9aa0a6"; rr(-6, -6, 64, 12, 6); ctx.fill();
      ctx.fillStyle = "#2a2a2a"; for (let i = 0; i < 9; i++) { poly([[-2 + i * 7, -6], [1 + i * 7, -10], [4 + i * 7, -6]], "#2a2a2a"); poly([[-2 + i * 7, 6], [1 + i * 7, 10], [4 + i * 7, 6]], "#2a2a2a"); } break;
    default: // punhos
      ctx.fillStyle = c; rr(-16, -14, 32, 28, 8); ctx.fill();
      ctx.strokeStyle = shade(c, -0.35); ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 8, -14); ctx.lineTo(-6 + i * 8, 2); ctx.stroke(); }
  }
  ctx.restore();
}
// Ícone oficial da Trindade (três seringas), carregado uma única vez.
const RESET_CARD_ART = new Image();
RESET_CARD_ART.src = "img/fm_reset_card.webp?v=20261116-reset-final";
const TRINDADE_ICON = new Image();
TRINDADE_ICON.src = "img/trindade_icon.webp?v=20261116-highres1";
function drawMatIcon(id, cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  if (id === "reset_stats" && RESET_CARD_ART.complete && RESET_CARD_ART.naturalWidth) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(RESET_CARD_ART, -31, -23, 62, 46);
  } else if (id === "trindade_eterna") {
    if (TRINDADE_ICON.complete && TRINDADE_ICON.naturalWidth > 0) {
      // Mantém a proporção e a transparência nas células da mochila e na loja.
      ctx.drawImage(TRINDADE_ICON, -30, -30, 60, 60);
    } else {
      // Ícone reserva somente enquanto a imagem original está carregando.
      ctx.fillStyle = "#20212b"; rr(-28, -23, 56, 46, 5); ctx.fill();
      ctx.strokeStyle = "#ebce79"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#ebce79";
      for (let j = 0; j < 3; j++) {
        const a = -Math.PI / 2 + j * Math.PI * 2 / 3;
        circle(Math.cos(a) * 13, Math.sin(a) * 13, 6);
      }
      txt("III", 0, 17, 13, "#fff1bd", "center", true);
    }
  } else if (MATS[id] && MATS[id].cashProtection) {
    ctx.fillStyle = "#59646b"; rr(-28, -24, 56, 48, 5); ctx.fill();
    ctx.fillStyle = "#2d373d"; rr(-21, -18, 42, 36, 3); ctx.fill();
    ctx.strokeStyle = "#b7c3ca"; ctx.lineWidth = 3; ctx.strokeRect(-21, -18, 42, 36);
    ctx.fillStyle = id === "cofre500k" ? "#e0c341" : id === "cofre100k" ? "#73ceff" : "#b7c3ca";
    circle(2, 0, 9); ctx.fillStyle = "#2d373d"; circle(2, 0, 3);
    ctx.fillStyle = "#b7c3ca"; ctx.fillRect(-19, -10, 4, 20);
  } else if (id === "sucata") {
    poly([[-30, 10], [-10, -14], [4, 2], [-8, 16]], "#7a7d80"); poly([[0, -10], [26, -16], [30, 4], [8, 8]], "#5a5d60"); poly([[-6, 6], [20, 4], [24, 20], [-2, 22]], "#8a6a4a");
  } else if (id === "pecas") {
    ctx.fillStyle = "#8a8f96"; circle(-10, 0, 16); ctx.fillStyle = "#3a3c3e"; circle(-10, 0, 6);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; RR_(-10 + Math.cos(a) * 15, Math.sin(a) * 15, 7, 7, a, "#8a8f96"); }
    ctx.strokeStyle = "#c9a23a"; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(14 + (i % 2) * 10, -16 + i * 6); ctx.stroke();
  } else if (id === "eletronicos") {
    ctx.fillStyle = "#2f6a3a"; rr(-28, -18, 56, 36, 4); ctx.fill();
    R_(-18, -8, 14, 14, "#1a1a1a"); R_(4, -12, 18, 10, "#1a1a1a"); R_(6, 4, 8, 8, "#c9a23a");
    ctx.strokeStyle = "#c9a23a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(4, -2); ctx.moveTo(-11, 6); ctx.lineTo(-11, 14); ctx.lineTo(10, 14); ctx.stroke();
  } else if (id === "placa") {
    ctx.fillStyle = "#5a5f64"; rr(-26, -20, 52, 40, 6); ctx.fill();
    ctx.fillStyle = "#7a8086"; rr(-22, -16, 44, 14, 4); ctx.fill();
    ctx.fillStyle = "#3a3e42"; for (const [x, y] of [[-18, -14], [18, -14], [-18, 14], [18, 14]]) circle(x, y, 2.5);
    ctx.strokeStyle = "#c9a23a"; ctx.lineWidth = 2; ctx.strokeRect(-26, -20, 52, 40);
  } else {
    ctx.shadowColor = "#b07aff"; ctx.shadowBlur = 18;
    poly([[0, -26], [18, -12], [18, 12], [0, 26], [-18, 12], [-18, -12]], "#8a5ae0");
    ctx.shadowBlur = 0; poly([[0, -18], [10, -8], [0, 6], [-10, -8]], "#d8c0ff");
  }
  ctx.restore();
}
// arte de cada colete (img/vests/vest<i>.png, foto do modelo 3D sem o corpo). Sem o arquivo, usa o desenho em código.
const VEST_ART = [];
function vestArt(i) {
  let im = VEST_ART[i];
  if (!im) { im = VEST_ART[i] = new Image(); im.onerror = () => { im.bad = true; }; im.src = `img/vests/vest${i}.png`; }
  return im.bad || !im.complete || !im.naturalWidth ? null : im;
}
function drawVestIcon(i, cx, cy, s) {
  const art = vestArt(i);
  if (art) { const d = 84 * s; ctx.imageSmoothingQuality = "high"; ctx.drawImage(art, cx - d / 2, cy - d / 2, d, d); return; }
  const v = VESTS[i], c = v.color, dk = shade(c, -0.4), lt = shade(c, 0.25);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  poly([[-22, -26], [-10, -26], [-6, -18], [6, -18], [10, -26], [22, -26], [26, -14], [24, 26], [-24, 26], [-26, -14]], c);
  poly([[-6, -18], [6, -18], [4, -8], [-4, -8]], dk);
  ctx.fillStyle = lt; ctx.fillRect(-24, -14, 48, 3);
  ctx.fillStyle = dk;
  for (let k = 0; k < 3; k++) { rr(-20 + k * 14, 4, 11, 14, 2); ctx.fill(); }
  if (v.rar >= 2) { ctx.fillStyle = lt; rr(-18, -10, 36, 10, 3); ctx.fill(); }
  if (v.rar >= 3) { ctx.fillStyle = "#c9a23a"; ctx.fillRect(-3, -6, 6, 6); }
  if (v.rar >= 4) { ctx.strokeStyle = "#ffb030"; ctx.lineWidth = 2; ctx.strokeRect(-24, -14, 48, 40); }
  ctx.fillStyle = "#1a1a1a"; ctx.fillRect(-25, 22, 50, 4);
  ctx.restore();
}
function drawCreditIcon(cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.shadowColor = "#ffd25a"; ctx.shadowBlur = 14;
  ctx.fillStyle = "#c9a23a"; circle(0, 0, 22); ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffd96a"; circle(0, 0, 17);
  txt("C", 0, 8, 22, "#7a5a1a", "center", true);
  ctx.restore();
}
// Arte oficial dos 29 implantes, atlas 6 colunas × 5 linhas (160 px por célula).
const NEW_IMPLANTS_ATLAS = new Image();
NEW_IMPLANTS_ATLAS.src = "img/implantes_29_atlas.webp?v=20261116-atlas6x5";
// ícone de qualquer coisa encontrada ou guardada
function drawEntryIcon(e, cx, cy, s) {
  const t = e.type || e.kind;
  if (t === "implant" && e.im && IMP[e.im.id] && NEW_IMPLANTS_ATLAS.complete && NEW_IMPLANTS_ATLAS.naturalWidth) {
    const idx = IMP_IDS.indexOf(e.im.id);
    if (idx >= 0) {
      const tile = 160, col = idx % 6, row = Math.floor(idx / 6), size = 64 * s;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(NEW_IMPLANTS_ATLAS, col * tile, row * tile, tile, tile, cx - size / 2, cy - size / 2, size, size);
      ctx.restore();
      return;
    }
  }
  if (t === "vest") { drawVestIcon(e.idx, cx, cy, s); return; }
  if (t === "credit") { drawCreditIcon(cx, cy, s); return; }
  if (e.spr && drawSpr(e.spr, cx, cy, 70 * s, 56 * s)) return;
  if (t === "ammo" && (SPR[AMMO_SPR[e.ammo]] || SPR.bullets)) {
    if (!drawSpr(AMMO_SPR[e.ammo], cx, cy - 6 * s, 64 * s, 46 * s)) drawSpr("bullets", cx, cy - 6 * s, 64 * s, 46 * s);
    txt(e.ammo || "", cx, cy + 26 * s, Math.max(10, 11 * s), "#e0d8a0", "center", true);
    return;
  }
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  if (t === "weapon") { ctx.restore(); drawWeaponSide(WDEF[(e.inst || e).id], cx, cy, s); return; }
  if (t === "mat") { ctx.restore(); drawMatIcon(e.id, cx, cy, s); return; }
  if (t === "cash") {
    for (let i = 2; i >= 0; i--) { ctx.fillStyle = shade("#3f7a3a", -i * 0.12); rr(-34 + i * 5, -16 - i * 5, 64, 32, 3); ctx.fill(); }
    ctx.strokeStyle = "#9fd08a"; ctx.lineWidth = 2; rr(-30, -12, 56, 24, 2); ctx.stroke();
    ctx.fillStyle = "#d4af37"; ctx.fillRect(-6, -16, 10, 32);
    txt("$", -2, 7, 20, "#e8ffd8", "center", true);
  } else if (t === "food") {
    ctx.fillStyle = "#9aa0a6"; rr(-18, -22, 36, 44, 4); ctx.fill(); ctx.fillStyle = "#b03a2e"; ctx.fillRect(-18, -10, 36, 22);
    ctx.fillStyle = "#c9ced2"; ellipse(0, -22, 18, 5); txt("FEIJÃO", 0, 5, 8, "#f6e8c8", "center", true);
  } else if (t === "water") {
    ctx.fillStyle = "rgba(110,170,220,0.75)"; rr(-12, -18, 24, 42, 6); ctx.fill(); ctx.fillStyle = "#2f6ab0"; ctx.fillRect(-6, -26, 12, 9);
    ctx.fillStyle = "#e8f0f8"; ctx.fillRect(-12, -2, 24, 12); ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(-8, -14, 4, 32);
  } else if (t === "med") {
    ctx.fillStyle = "#eef0ee"; rr(-26, -18, 52, 38, 5); ctx.fill(); ctx.fillStyle = "#7a7d80"; ctx.fillRect(-8, -24, 16, 7);
    ctx.fillStyle = "#d03a3a"; ctx.fillRect(-4, -12, 8, 26); ctx.fillRect(-13, -3, 26, 8);
  } else if (t === "ammo") {
    ctx.fillStyle = "#4e5a2e"; rr(-28, -6, 56, 28, 3); ctx.fill();
    for (let i = 0; i < 5; i++) { ctx.fillStyle = "#c9a23a"; rr(-22 + i * 10, -22, 7, 18, 3); ctx.fill(); ctx.fillStyle = "#8a6a2a"; ctx.fillRect(-22 + i * 10, -8, 7, 3); }
    txt(e.ammo || "", 0, 13, 10, "#e0d8a0", "center", true);
  } else if (t === "implant") {
    ctx.fillStyle = "#2a2d30"; rr(-20, -20, 40, 40, 4); ctx.fill();
    ctx.fillStyle = "#9aa0a6"; for (let i = 0; i < 4; i++) { ctx.fillRect(-16 + i * 10, -26, 3, 6); ctx.fillRect(-16 + i * 10, 20, 3, 6); }
    ctx.fillStyle = e.im ? impColor(e.im) : "#4aa3df"; rr(-10, -10, 20, 20, 3); ctx.fill();
  }
  ctx.restore();
}
