"use strict";
// =====================================================================
//  FRONTEIRA MORTA · configuração
//  Armas, munição, coletes, zumbis, prédios, móveis, saques, implantes,
//  atributos e o layout da cidade (1 avenida principal + quadras).
// =====================================================================

const W = 960, H = 600;                       // resolução lógica da tela
const FONT = "'Trebuchet MS', 'Segoe UI', sans-serif";

// ---------- Cidade em grade de áreas ----------
// A cidade é uma grade de áreas separadas. Você anda para cima, para baixo e para
// os lados; ao sair pela borda de uma área a tela escurece e carrega a vizinha.
// Cada área tem 2 x 2 quadras com ruas em cruz no meio e ruas nas bordas.
// Ruas perimetrais mais largas (70 -> 110), sem alterar a avenida central (140).
const AREA_EDGE = 150, BLOCK_W = 620, BLOCK_H = 640, ST_W = 140;
const WORLD_W = 2 * AREA_EDGE + 2 * BLOCK_W + ST_W;   // 1680
const WORLD_H = 2 * AREA_EDGE + 2 * BLOCK_H + ST_W;   // 1720
const SIDEWALK = 26;
const MID_X = AREA_EDGE + BLOCK_W + ST_W / 2, MID_Y = AREA_EDGE + BLOCK_H + ST_W / 2;
// ruas: faixas [início, fim] na horizontal (y) e na vertical (x)
const H_STREETS = [[0, AREA_EDGE], [AREA_EDGE + BLOCK_H, AREA_EDGE + BLOCK_H + ST_W], [WORLD_H - AREA_EDGE, WORLD_H]];
const V_STREETS = [[0, AREA_EDGE], [AREA_EDGE + BLOCK_W, AREA_EDGE + BLOCK_W + ST_W], [WORLD_W - AREA_EDGE, WORLD_W]];

// Mapa da cidade (linha 0 = norte). Cada letra é uma área:
// B azul · G verde · Y amarelo · O laranja · R vermelho · D vermelho-escuro
// K preta (muito difícil) · P roxa (extrema) · X cinza (só a partir do nível 100) · . sem passagem
// O oeste é tranquilo; quanto mais ao leste, mais perigoso.
const MAP_GRID = [
  "BGGYYOOORRRKKX",
  "BGGYYOORRRRKKX",
  "BBGGYYOORRDDK.",
  "BBGGYOOORRDDD.",
  "BGGYYO.ORRDDPP",
  "BGYY.OORRDDDPP",
  "....XXX......."
];
const MAP_W = MAP_GRID[0].length, MAP_H = MAP_GRID.length;
const TIER_OF = { B: 0, G: 1, Y: 2, O: 3, R: 4, D: 5, K: 6, P: 7, X: 8 };
const GRAY_LEVEL = 100;
const HOODS = ["Vila Esquecida", "Jardim Seco", "Alto da Forca", "Vila dos Trilhos", "Baixada Fria", "Morro do Eco", "Vila Ferrugem",
  "Parque das Cinzas", "Bairro do Cais", "Vila Operária", "Setor Industrial", "Largo da Matriz", "Vila Nova", "Recanto Mudo",
  "Beco dos Corvos", "Vila do Quartel", "Jardim das Covas", "Alto do Moinho", "Vila Sem Nome", "Centro Velho", "Cidade Baixa",
  "Vila da Usina", "Distrito Norte", "Vila das Palmeiras", "Bairro da Ponte", "Bairro do Hospital", "Vila das Sombras", "Ladeira Torta",
  "Pátio dos Trens", "Vila Cemitério", "Setor Quarentena", "Zona do Fim", "Vale dos Ossos", "Vila Fumaça", "Bairro Queimado"];
function cellCode(cx, cy) { return `${String.fromCharCode(65 + cx)}${cy + 1}`; }

// Postos seguros (loja, banco, clínica, missões e viagem rápida)
const OUTPOSTS = [
  { id: 0, name: "Base 1 · Refúgio",   cx: 0,  cy: 3 },
  { id: 1, name: "Base 2 · Ferrovia",  cx: 2,  cy: 1 },
  { id: 2, name: "Base 3 · Forte",     cx: 4,  cy: 4 },
  { id: 3, name: "Base 4 · Bastião",   cx: 6,  cy: 2 },
  { id: 4, name: "Base 5 · Muralha",   cx: 9,  cy: 3 },
  { id: 5, name: "Base 6 · Sentinela", cx: 11, cy: 4 }
];
// Faixas de dificuldade (cores do mapa): hp/dmg = multiplicadores dos zumbis · loot = chance de cada raridade
const REGIONS = [
  { name: "Azul",           diff: "Muito fácil",   desc: "para quem está começando",                color: "#4a7ad8", hp: 1,   dmg: 0.9, spawn: 0.9,  loot: [75, 22, 3, 0, 0] },
  { name: "Verde",          diff: "Fácil",         desc: "corredores e os primeiros cães",          color: "#4fae4f", hp: 1.4, dmg: 1,   spawn: 1,    loot: [62, 29, 8, 1, 0] },
  { name: "Amarela",        diff: "Médio",         desc: "cuspidores, contaminados e infectados",   color: "#c8c048", hp: 2,   dmg: 1.15, spawn: 1.1,  loot: [46, 33, 16, 5, 0] },
  { name: "Laranja",        diff: "Médio+",        desc: "brutamontes · leve uma arma melhor",      color: "#e0902f", hp: 2.8, dmg: 1.35, spawn: 1.2,  loot: [30, 35, 24, 9, 2] },
  { name: "Vermelha",       diff: "Difícil",       desc: "tóxicos e mutantes · para experientes",   color: "#d8443a", hp: 3.8, dmg: 1.55, spawn: 1.3,  loot: [18, 32, 30, 16, 4] },
  { name: "Vermelho-escura", diff: "Difícil+",     desc: "demônios · precisa de implantes",         color: "#9a2424", hp: 4.8, dmg: 1.75, spawn: 1.35, loot: [10, 26, 34, 23, 7] },
  { name: "Preta",          diff: "Muito difícil", desc: "abominações · implantes e coletes bons",  color: "#2a2a2e", hp: 6,   dmg: 2,   spawn: 1.4,  loot: [5, 20, 35, 28, 12] },
  { name: "Roxa",           diff: "Extrema",       desc: "o pior da cidade · vá preparado",         color: "#7a3ac8", hp: 7.5, dmg: 2.25, spawn: 1.5,  loot: [2, 14, 34, 34, 16] },
  { name: "Cinza",          diff: "Zona Morta",    desc: `só a partir do nível ${GRAY_LEVEL}`,      color: "#8a8a8a", hp: 9,   dmg: 2.55, spawn: 1.55, loot: [0, 10, 30, 38, 22] }
];
const REGION_ROWS = 3;                       // cada faixa de cor tem 3 níveis de zona
const MAX_ZONE = REGIONS.length * REGION_ROWS - 1;
function regionOf(zone) { return Math.max(0, Math.min(REGIONS.length - 1, Math.floor(zone / REGION_ROWS))); }
// "peso" da dificuldade na escala antiga de 0 a ~4,4 (usado em fórmulas de dano e saque)
function diffOf(zone) { return regionOf(zone) * 0.55; }
// a zona (nível de perigo) de qualquer ponto é a da área atual
function rowAt() { return world && world.cell ? world.cell.zone : 0; }

// As armas, a munição e os materiais ficam em js/items.js
const NOISE_R = 700, SIGHT_R = 90;

// Coletes (ficam salvos, mesmo se você morrer)
// price = dinheiro na loja · credits = só com créditos · craft = só na oficina
// acid = % menos dano de ácido/veneno · stealth = % de chance extra de não ser visto · hp = vida extra
const VESTS = [
  { name: "Colete Militar",                 armor: 6,  price: 300,   color: "#4a5a3a", rar: 0 },
  { name: "Armadura Tática",                armor: 10, price: 900,   color: "#2a2c30", rar: 0 },
  { name: "Colete Reforçado",               armor: 14, price: 1800,  color: "#8a6a45", rar: 1, slow: 3 },
  { name: "Armadura de Assalto",            armor: 18, price: 3500,  color: "#8a2a2a", rar: 1 },
  { name: "Armadura de Combate Pesada",     armor: 24, price: 6000,  color: "#2f4a6a", rar: 2, slow: 8 },
  { name: "Armadura Tática do Deserto",     armor: 22, price: 9000,  color: "#a08458", rar: 2, acid: 40 },
  { name: "Armadura de Combate Urbano",     armor: 22, price: 12000, color: "#3a3a3e", rar: 2, stealth: 20 },
  { name: "Armadura de Segurança de Elite", armor: 30, credits: 500, color: "#2a2a2c", rar: 3, hp: 15 },
  { name: "Armadura Tática Avançada",       armor: 34, credits: 500, color: "#7a6a4a", rar: 3 },
  { name: "Armadura de Assalto Pesada",     armor: 45, craft: true,  color: "#3a4a32", rar: 4, slow: 6, hp: 25, acid: 25 }
];

// ---------- Zumbis ----------
// from = zona a partir da qual aparecem · pack = aparecem em grupo
const ZTYPES = {
  // comuns
  walker:  { name: "Errante",     plural: "errantes",    hp: 1,   spd: 1,    dmg: 1,   r: 13, from: 0,  weight: 10, xp: 1, group: "Comum" },
  runner:  { name: "Corredor",    plural: "corredores",  hp: 0.6, spd: 1.85, dmg: 0.8, r: 12, from: 2,  weight: 3,  xp: 1.2, group: "Comum" },
  // especiais
  dog:     { name: "Cão infectado", plural: "cães infectados", hp: 0.55, spd: 2.5, dmg: 0.7, r: 11, from: 3, weight: 2, xp: 1.4, pack: [2, 4], hitDelay: 1000, group: "Especial" },
  spitter: { name: "Cuspidor",    plural: "cuspidores",  hp: 0.8, spd: 0.8,  dmg: 0.7, r: 13, from: 6,  weight: 2,  xp: 1.5, ranged: true, group: "Especial" },
  creeper: { name: "Rastejante",  plural: "rastejantes", hp: 1.2, spd: 0.6, dmg: 1.1, r: 14, from: 5, weight: 1.5, xp: 2, blastDeath: true, group: "Especial" },
  hazmat:  { name: "Contaminado", plural: "contaminados", hp: 1.4, spd: 0.85, dmg: 0.9, r: 14, from: 7, weight: 1.5, xp: 1.8, gas: true, group: "Especial" },
  infected: { name: "Infectado",  plural: "infectados",  hp: 1.1, spd: 1.35, dmg: 1.1, r: 13, from: 8, weight: 2, xp: 1.6, pack: [2, 3], dodge: true, group: "Infectado" },
  brute:   { name: "Brutamontes", plural: "brutamontes", hp: 3,   spd: 0.62, dmg: 1.9, r: 19, from: 9, weight: 2,  xp: 3, group: "Especial" },
  // tóxicos
  toxic:   { name: "Tóxico",      plural: "tóxicos",     hp: 1.6, spd: 0.9,  dmg: 1.2, r: 14, from: 12, weight: 1.5, xp: 2.2, puddle: true, acidDeath: true, group: "Tóxico" },
  // mutantes
  mutant:  { name: "Mutante",     plural: "mutantes",    hp: 5,   spd: 1.05, dmg: 2.4, r: 22, from: 13, weight: 1.5, xp: 5, charge: true, group: "Mutante" },
  // demônios
  demon:   { name: "Demônio",     plural: "demônios",    hp: 3.2, spd: 1.6,  dmg: 2.2, r: 17, from: 15, weight: 1.2, xp: 5, leap: true, group: "Demônio" },
  abomination: { name: "Abominação", plural: "abominações", hp: 9, spd: 0.75, dmg: 3.4, r: 27, from: 18, weight: 1, xp: 9, slam: true, group: "Mutante" }
};
// Chefes: aparecem em áreas sorteadas. tiers = em quais cores de área cada um pode surgir
const BOSSES = {
  acougueiro: { name: "O Açougueiro", tiers: [0, 1, 2],    hp: 1,    spd: 1,    r: 28, skin: "#c08a7a", cloth: "#d8d0c0", drop: "Arma rara + colete" },
  matriarca:  { name: "A Matriarca",  tiers: [2, 3],       hp: 1.35, spd: 0.65, r: 33, skin: "#b07a6a", cloth: "#6a3a3a", drop: "Implante + colete" },
  capataz:    { name: "O Capataz",    tiers: [2, 3, 4],    hp: 1.2,  spd: 0.85, r: 27, skin: "#8a8a8a", cloth: "#2a2c30", drop: "Equipamento de alto nível" },
  pestilento: { name: "O Pestilento", tiers: [4, 5],       hp: 1.2,  spd: 0.9,  r: 28, skin: "#8a4a3a", cloth: "#4a2a20", drop: "Itens especiais" },
  carrasco:   { name: "O Carrasco",   tiers: [4, 5],       hp: 1.3,  spd: 0.95, r: 28, skin: "#a07060", cloth: "#1a1a1a", drop: "Arma única" },
  necromante: { name: "O Necromante", tiers: [5, 6],       hp: 1,    spd: 0.9,  r: 24, skin: "#5a6a4a", cloth: "#1e2a1e", drop: "Implantes raros" },
  alfa:       { name: "O Alfa",       tiers: [6, 7],       hp: 1.2,  spd: 2.1,  r: 26, skin: "#7a4a3a", cloth: "#4a2a20", drop: "Equipamento premium" },
  ceifador:   { name: "O Ceifador",   tiers: [7, 8],       hp: 1.7,  spd: 1.2,  r: 26, skin: "#3a3a3a", cloth: "#121214", drop: "Itens lendários" }
};
const BOSS_SPEED = 1.2; // todos os chefes andam 20% mais rápido
function bossesOfRegion(tier) { return Object.keys(BOSSES).filter((k) => BOSSES[k].tiers.includes(tier)); }
const ZCLOTHES = ["#5b4b3a", "#3f4f5f", "#6a3b3b", "#4d5a3e", "#777060", "#3a3a44", "#6b5a7a", "#7a6a3a"];
const ZSKIN = ["#7a9c55", "#8aa06a", "#93a07a", "#6f8a5a", "#9aa58a", "#88957a"];

// ---------- Prédios ----------
// enter = chance de dar para entrar · zchance = chance de ter zumbis lá dentro
const BTYPES = {
  casa:       { name: "Casa", enter: 0.6, roof: "pitched", floor: "wood", zchance: 0.35, n: [3, 6],
                colors: ["#7b5e57", "#5f6f7a", "#8a7a52", "#6a5a6e", "#6b7f5e", "#8b6a4f", "#7a6a5a"],
                furn: ["Armário", "Geladeira", "Cama", "Estante", "Cômoda", "Sofá", "Mesa", "Prateleira de parede", "Armário de cozinha", "Criado-mudo", "Guarda-roupa"],
                decor: ["Planta", "Poltrona", "TV", "Cadeira", "Cadeira", "Caixas"] },
  mercado:    { name: "Mercado", enter: 0.9, roof: "flat", floor: "tile", zchance: 0.6, n: [4, 7], colors: ["#7d8576", "#848a7c"],
                sign: "MERCADO", signColor: "#e0b040", furn: ["Prateleira", "Prateleira", "Prateleira", "Freezer", "Caixa registradora", "Estoque", "Prateleira de parede"],
                decor: ["Caixas", "Caixas", "Carrinho", "Planta"] },
  farmacia:   { name: "Farmácia", enter: 0.9, roof: "flat", floor: "tile", zchance: 0.5, n: [3, 6], colors: ["#6f8a82"],
                sign: "FARMÁCIA", signColor: "#5fd08a", cross: "#5fd08a", furn: ["Prateleira de remédios", "Prateleira de remédios", "Balcão", "Armário médico", "Armário de suprimentos"],
                decor: ["Planta", "Cadeira", "Caixas"] },
  escritorio: { name: "Escritório", enter: 0.8, roof: "flat", floor: "carpet", zchance: 0.45, n: [3, 6], colors: ["#5f6670", "#686c74"],
                furn: ["Mesa", "Mesa", "Arquivo", "Estante", "Arquivo", "Prateleira de parede"],
                decor: ["Cadeira", "Cadeira", "Planta", "Caixas", "Bebedouro"] },
  armaria:    { name: "Armaria", enter: 0.95, roof: "flat", floor: "concrete", zchance: 0.65, n: [3, 6], colors: ["#5a5045"],
                sign: "ARMAS", signColor: "#e06a3a", furn: ["Vitrine", "Caixa de munição", "Caixa de munição", "Balcão", "Armário de armas", "Prateleira de ferramentas"],
                decor: ["Caixas", "Caixas", "Cadeira"] },
  posto:      { name: "Posto de gasolina", enter: 0.9, roof: "flat", floor: "tile", zchance: 0.5, n: [3, 5], colors: ["#7a6f5c"],
                sign: "POSTO", signColor: "#e0d040", furn: ["Prateleira", "Freezer", "Caixa registradora", "Bancada", "Estoque", "Prateleira de ferramentas"],
                decor: ["Caixas", "Carrinho", "Planta"] },
  delegacia:  { name: "Delegacia", enter: 0.95, roof: "flat", floor: "tile", zchance: 0.75, n: [4, 7], colors: ["#4b5872"],
                sign: "POLÍCIA", signColor: "#6aa8ff", furn: ["Armário de armas", "Armário de armas", "Arquivo", "Mesa", "Caixa de munição", "Prateleira de ferramentas"],
                decor: ["Cadeira", "Cadeira", "Bebedouro", "Caixas"] },
  // ---- pontos especiais (1 por região, ver LANDMARKS): grandes, com vários andares e o melhor saque ----
  hospital:   { name: "Hospital", enter: 1, roof: "flat", floor: "tile", zchance: 1, n: [5, 7], colors: ["#b3b6ae"], landmark: true, floors: [3, 4], scale: [1.9, 1.7],
                sign: "HOSPITAL", signColor: "#e04a4a", cross: "#e04a4a", furn: ["Maca", "Maca", "Armário médico", "Armário médico", "Prateleira de remédios", "Mesa", "Armário de suprimentos", "Estoque de suprimentos"],
                decor: ["Cadeira", "Planta", "Carrinho", "Bebedouro"] },
  prisao:     { name: "Prisão", enter: 1, roof: "flat", floor: "concrete", zchance: 1, n: [5, 7], colors: ["#5a5a55"], landmark: true, floors: [2, 3], scale: [2, 1.8],
                sign: "PRISÃO", signColor: "#e0a040", furn: ["Cela", "Cela", "Cela", "Armário de evidências", "Armário de armas", "Caixa de munição", "Arquivo", "Mesa", "Armário"],
                decor: ["Cadeira", "Caixas", "Bebedouro"] },
  bunker:     { name: "Bunker", enter: 1, roof: "flat", floor: "concrete", zchance: 1, n: [4, 6], colors: ["#4a4f45"], landmark: true, floors: [2, 4], scale: [1.7, 1.6], under: true,
                sign: "BUNKER", signColor: "#9ad06a", furn: ["Caixa militar", "Caixa militar", "Armário de armas", "Caixa de munição", "Estoque de suprimentos", "Armário médico", "Bancada", "Beliche"],
                decor: ["Caixas", "Caixas", "Cadeira"] },
  guarita:    { name: "Guarita", enter: 0, roof: "flat", floor: "concrete", zchance: 0, n: [0, 0], colors: ["#6a6a62"], furn: [] },
  seguro:     { name: "Posto seguro", enter: 1, roof: "flat", floor: "concrete", zchance: 0, n: [0, 0], colors: ["#3d5a46"], furn: [] }
};

// Móveis (tamanho e cor). O nome também é a chave da tabela de saque.
const FURN = {
  "Armário": { w: 70, h: 40, color: "#6b4a2b" },        "Geladeira": { w: 46, h: 50, color: "#c9d1d3" },
  "Cama": { w: 90, h: 60, color: "#4b5f86" },           "Estante": { w: 80, h: 36, color: "#7a5a35" },
  "Cômoda": { w: 64, h: 40, color: "#8a6a45" },         "Sofá": { w: 100, h: 44, color: "#6a4a4a" },
  "Prateleira": { w: 130, h: 30, color: "#8b8f94" },    "Freezer": { w: 90, h: 46, color: "#d6e2e6" },
  "Caixa registradora": { w: 60, h: 40, color: "#3b3f44" }, "Prateleira de remédios": { w: 120, h: 30, color: "#e0e4e2" },
  "Balcão": { w: 140, h: 36, color: "#7a5a35" },        "Armário de armas": { w: 80, h: 40, color: "#3e4a3a" },
  "Arquivo": { w: 46, h: 40, color: "#707a80" },        "Mesa": { w: 90, h: 50, color: "#6b4a2b" },
  "Vitrine": { w: 110, h: 40, color: "#9fb3bb" },       "Caixa de munição": { w: 50, h: 34, color: "#4e5a2e" },
  "Maca": { w: 50, h: 90, color: "#c8d0d0" },           "Armário médico": { w: 70, h: 40, color: "#e8ecec" },
  "Bancada": { w: 120, h: 40, color: "#5e4a36" },
  // novos móveis com saque (saque fraco: equilibra a quantidade maior de lugares)
  "Prateleira de parede": { w: 110, h: 22, color: "#7a5a35" }, "Armário de cozinha": { w: 90, h: 34, color: "#8a6a45" },
  "Criado-mudo": { w: 36, h: 30, color: "#6b4a2b" },    "Guarda-roupa": { w: 84, h: 38, color: "#5e4028" },
  "Estoque": { w: 100, h: 40, color: "#8b8f94" },       "Prateleira de ferramentas": { w: 110, h: 28, color: "#6a6f74" },
  "Armário de suprimentos": { w: 80, h: 36, color: "#cfd6d6" },
  // decoração: só enfeita e bloqueia passagem, não dá saque
  "Planta": { w: 26, h: 26, color: "#4f7a3a" },          "Poltrona": { w: 44, h: 40, color: "#6a4a4a" },
  "TV": { w: 60, h: 18, color: "#24272b" },             "Cadeira": { w: 26, h: 26, color: "#5a4a3a" },
  "Caixas": { w: 40, h: 34, color: "#9a7a4a" },         "Carrinho": { w: 46, h: 30, color: "#9aa0a6" },
  "Bebedouro": { w: 26, h: 26, color: "#cfe0ea" },
  // pontos especiais
  "Cela": { w: 110, h: 70, color: "#6a6a66" },          "Armário de evidências": { w: 80, h: 40, color: "#4a5060" },
  "Caixa militar": { w: 70, h: 40, color: "#4e5a2e" },   "Estoque de suprimentos": { w: 110, h: 40, color: "#6a6f5a" },
  "Beliche": { w: 50, h: 90, color: "#4a5a3a" }
};

// ---------- O que cada lugar pode conter ----------
// [chance, mínimo, máximo]; ammo = caixas de munição; weapon = chance de achar uma arma que você ainda não tem
const TABLES = {
  corpse:      { cash: [0.5, 5, 18], food: [0.06, 1, 1], water: [0.06, 1, 1], med: [0.04, 1, 1], ammo: [0.25, 1, 1], weapon: 0.01 },
  body:        { cash: [0.6, 3, 12], food: [0.35, 1, 1], water: [0.35, 1, 1], med: [0.15, 1, 1], ammo: [0.45, 1, 1], weapon: 0.02 },
  airdrop:     { cash: [1, 80, 220], food: [0.7, 1, 3], water: [0.7, 1, 3], med: [0.8, 1, 2], anti: [0.4, 1, 2], ammo: [1, 2, 4], weapon: 0.9 },
  boss:        { cash: [1, 60, 140], food: [0.6, 1, 2], water: [0.6, 1, 2], med: [0.8, 1, 2], ammo: [1, 2, 3], weapon: 0.35 },
  chest:       { cash: [0.7, 15, 40], food: [0.35, 1, 1], water: [0.35, 1, 1], med: [0.15, 1, 1], anti: [0.08, 1, 1], ammo: [0.5, 1, 2], weapon: 0.04 },
  trash:       { cash: [0.25, 3, 10], food: [0.1, 1, 1], water: [0.08, 1, 1], med: [0.02, 1, 1], ammo: [0.12, 1, 1] },
  dumpster:    { cash: [0.35, 5, 20], food: [0.18, 1, 1], water: [0.14, 1, 1], med: [0.04, 1, 1], ammo: [0.16, 1, 1] },
  crate:       { cash: [0.3, 5, 20], food: [0.2, 1, 1], water: [0.15, 1, 1], ammo: [0.45, 1, 2], weapon: 0.02 },
  car:         { cash: [0.4, 10, 35], food: [0.12, 1, 1], water: [0.15, 1, 1], med: [0.1, 1, 1], ammo: [0.35, 1, 1], weapon: 0.03 },
  "Armário":   { cash: [0.2, 5, 20], food: [0.25, 1, 1], water: [0.15, 1, 1], med: [0.08, 1, 1], ammo: [0.15, 1, 1] },
  "Geladeira": { food: [0.5, 1, 1], water: [0.45, 1, 2] },
  "Cama":      { cash: [0.25, 5, 20], med: [0.12, 1, 1], ammo: [0.1, 1, 1], weapon: 0.02 },
  "Estante":   { cash: [0.3, 10, 30], ammo: [0.2, 1, 1], weapon: 0.03 },
  "Cômoda":    { cash: [0.3, 5, 20], med: [0.1, 1, 1], food: [0.1, 1, 1], ammo: [0.15, 1, 1] },
  "Sofá":      { cash: [0.35, 2, 14], food: [0.05, 1, 1] },
  "Prateleira": { food: [0.55, 1, 2], water: [0.45, 1, 2] },
  "Freezer":   { food: [0.4, 1, 1], water: [0.6, 1, 2] },
  "Caixa registradora": { cash: [0.9, 15, 60] },
  "Prateleira de remédios": { med: [0.55, 1, 2], water: [0.1, 1, 1], anti: [0.2, 1, 1] },
  "Balcão":    { cash: [0.5, 10, 30], med: [0.15, 1, 1], ammo: [0.1, 1, 1] },
  "Armário de armas": { cash: [0.15, 5, 20], ammo: [0.7, 1, 3], weapon: 0.06 },
  "Arquivo":   { cash: [0.45, 10, 40] },
  "Mesa":      { cash: [0.35, 5, 25], food: [0.1, 1, 1], ammo: [0.08, 1, 1] },
  "Vitrine":   { ammo: [0.4, 1, 2], weapon: 0.1 },
  "Caixa de munição": { ammo: [0.85, 1, 3] },
  "Maca":      { med: [0.35, 1, 1], anti: [0.1, 1, 1] },
  "Armário médico": { med: [0.6, 1, 2], anti: [0.25, 1, 1] },
  "Bancada":   { cash: [0.3, 5, 25], ammo: [0.2, 1, 1], weapon: 0.03 },
  // novos: chances iguais ou menores que as dos móveis antigos parecidos, sem arma
  "Prateleira de parede": { cash: [0.15, 3, 12], food: [0.2, 1, 1], water: [0.15, 1, 1], med: [0.05, 1, 1] },
  "Armário de cozinha": { food: [0.35, 1, 1], water: [0.3, 1, 1] },
  "Criado-mudo": { cash: [0.25, 3, 12], med: [0.08, 1, 1], ammo: [0.08, 1, 1] },
  "Guarda-roupa": { cash: [0.2, 4, 15], med: [0.05, 1, 1], ammo: [0.08, 1, 1] },
  "Estoque":   { food: [0.4, 1, 1], water: [0.35, 1, 1] },
  "Prateleira de ferramentas": { cash: [0.15, 3, 12], ammo: [0.25, 1, 1] },
  "Armário de suprimentos": { med: [0.35, 1, 1], water: [0.15, 1, 1], anti: [0.2, 1, 1] },
  // pontos especiais: melhores que os móveis comuns (a raridade das armas segue a cor da região)
  "Cela":      { cash: [0.25, 3, 15], food: [0.2, 1, 1], med: [0.08, 1, 1], ammo: [0.2, 1, 1], weapon: 0.03 },
  "Armário de evidências": { cash: [0.4, 15, 50], ammo: [0.5, 1, 2], weapon: 0.08 },
  "Caixa militar": { ammo: [0.8, 2, 3], med: [0.3, 1, 2], anti: [0.1, 1, 1], weapon: 0.1 },
  "Estoque de suprimentos": { food: [0.6, 1, 2], water: [0.6, 1, 2], med: [0.3, 1, 1], anti: [0.1, 1, 1] },
  "Beliche":   { cash: [0.3, 5, 20], med: [0.15, 1, 1], ammo: [0.25, 1, 1], weapon: 0.04 }
};
// quais pontos especiais existem em cada região (índice em REGIONS) — 1 de cada
const LANDMARKS = { 0: ["hospital"], 3: ["bunker"], 4: ["hospital", "bunker"], 5: ["prisao", "bunker"], 6: ["prisao", "bunker", "hospital"], 7: ["bunker"] };
// chance de o lugar não ter NADA (o resto continua igual quando tem algo)
const EMPTY_CHANCE = { trash: 0.45, dumpster: 0.35, body: 0.25, corpse: 0.3, car: 0.3, crate: 0.25, chest: 0.1, airdrop: 0, boss: 0, furniture: 0.35 };
const IMPLANT_CHANCE = { airdrop: 0.25, corpse: 0.02, boss: 1, chest: 0.06, trash: 0.01, dumpster: 0.015, crate: 0.03, car: 0.05,
  "Armário": 0.02, "Cama": 0.02, "Estante": 0.03, "Cômoda": 0.02, "Mesa": 0.02, "Arquivo": 0.03, "Armário médico": 0.04,
  "Armário de armas": 0.04, "Vitrine": 0.04, "Bancada": 0.03,
  "Cela": 0.02, "Armário de evidências": 0.04, "Caixa militar": 0.05, "Beliche": 0.03, "Estoque de suprimentos": 0.01 };

// ---------- Implantes ----------
// Novo catálogo: 29 implantes; o sistema antigo de slots, saque e clínica é preservado.
// fx = efeitos fixos (%). alloc = pontos que o jogador distribui (arrastando o implante para o boneco).
// flag = efeito único (não é copiado pelo Mímico). mimic = copia o implante do slot à esquerda.
const IMPL_SLOTS = 6, BAG_MAX = 8;
const IMPLANT_RARITY = 0.1;      // multiplica a chance de achar implante no saque (valem muito)
const BOSS_IMPLANT = 0.15;       // chefes que davam implante garantido: agora só às vezes
const STAT_KEYS = ["exp", "hunter", "scavenger", "crit", "reload", "endurance", "metabolism", "vigor", "regen", "silence", "firepower", "thick", "greed", "agility", "saver", "implantLoot",
  "rage", "killHeal", "lootSense", "luck", "accImp", "stealthImp", "craftDisc", "critDmg", "leech", "adren",
  "armorFind", "ammoLoot", "searchSpeed", "miscFind", "lootSpots", "atkSpeed", "deathDefy", "bossRare", "mcChance", "pvpPoints"];
const FX_LABEL = {
  exp: "experiência", firepower: "dano causado", agility: "velocidade", thick: "redução do dano recebido",
  hunter: "chance de achar armas", armorFind: "chance de achar coletes", ammoLoot: "munição achada", greed: "dinheiro achado",
  searchSpeed: "velocidade de busca", miscFind: "chance de achar materiais", luck: "chance de itens raros",
  lootSpots: "lugares com saque", scavenger: "chance de achar suprimentos", deathDefy: "chance de sobreviver a um golpe fatal",
  bossRare: "chance de itens raros nos chefes", implantLoot: "chance de achar implantes",
  mcChance: "chance de arma com melhorias", atkSpeed: "velocidade de ataque", pvpPoints: "pontos PvP"
};
const IMP = {
  "implante_01": {"name":"Urso de Ferro","price":1000,"scrap":29000,"kind":0,"fx":{"thick":10},"flag":"jugger","text":"Força Imparável: imune a atordoamento, agarrões e lentidão; massa +500%; derruba infectados comuns ao correr; redução total limitada a 80%."},
  "implante_02": {"name":"Macaco Cibernético","price":3000,"scrap":29000,"kind":2,"mimic":true},
  "implante_03": {"name":"Lobo Fantasma","price":1000,"scrap":29000,"kind":0,"fx":{"firepower":5,"agility":7}},
  "implante_04": {"name":"Aracnídeo Mortal","price":750,"scrap":29000,"kind":0,"fx":{"implantLoot":200},"flag":"hook","text":"Acesso remoto à configuração dos implantes seguindo regras de instalação e remoção."},
  "implante_05": {"name":"Águia Sombria","price":1000,"scrap":29000,"kind":0,"fx":{"firepower":8,"hunter":25,"searchSpeed":15}},
  "implante_06": {"name":"Cobra Venenosa","price":1000,"scrap":29000,"kind":0,"fx":{"firepower":5,"agility":5,"atkSpeed":5}},
  "implante_07": {"name":"Colmeia Mecânica","price":3000,"scrap":29000,"kind":2,"fx":{},"alloc":{"points":20,"opts":[{"key":"hunter","per":5},{"key":"armorFind","per":5},{"key":"ammoLoot","per":5},{"key":"greed","per":5},{"key":"searchSpeed","per":2},{"key":"miscFind","per":2}]}},
  "implante_08": {"name":"Cérebro Supremo","price":1000,"scrap":29000,"kind":0,"fx":{"exp":14}},
  "implante_09": {"name":"Olho do Predador","price":1000,"scrap":29000,"kind":0,"fx":{"firepower":5,"ammoLoot":30,"greed":30,"armorFind":20,"searchSpeed":15}},
  "implante_10": {"name":"Coluna de Titânio","price":1000,"scrap":29000,"kind":0,"fx":{"exp":5,"firepower":7,"agility":4}},
  "implante_11": {"name":"Coração de Ferro","price":800,"scrap":29000,"kind":0,"fx":{"exp":5,"pvpPoints":5,"agility":5,"deathDefy":25},"flag":"lastStand","text":"Última Resistência: ao atingir vida crítica, ignora penalidades de atributos do implante. Bônus PvP reservado para o sistema PvP."},
  "implante_12": {"name":"Garras do Carniceiro","price":1100,"scrap":29000,"kind":2,"fx":{"bossRare":50,"searchSpeed":10},"alloc":{"points":10,"opts":[{"key":"firepower","per":1},{"key":"agility","per":1}]}},
  "implante_13": {"name":"DNA Mutante","price":3000,"scrap":29000,"kind":2,"fx":{},"alloc":{"points":20,"opts":[{"key":"exp","per":1},{"key":"firepower","per":1},{"key":"agility","per":1},{"key":"thick","per":1}]}},
  "implante_14": {"name":"Radar Fantasma","price":1000,"scrap":29000,"kind":0,"fx":{"luck":25,"lootSpots":7,"searchSpeed":7,"scavenger":7}},
  "implante_15": {"name":"Processador de Guerra","price":1000,"scrap":29000,"kind":0,"fx":{"mcChance":100},"flag":"mc","text":"Obra-Prima: chance-base de armas melhoradas ×2; +2 melhorias nas armas e +6 em coletes Mastercraft, incluindo chefes."},
  "implante_16": {"name":"Costelas de Aço","price":1000,"scrap":29000,"kind":0,"fx":{"exp":11,"firepower":1,"thick":1,"agility":1}},
  "implante_17": {"name":"Fungo Parasita","price":1000,"scrap":29000,"kind":1,"fx":{"thick":-5,"atkSpeed":15}},
  "implante_18": {"name":"Núcleo Tóxico","price":1000,"scrap":29000,"kind":0,"fx":{"firepower":11}},
  "implante_19": {"name":"Bobina de Tesla","price":2000,"scrap":29000,"kind":1,"fx":{"firepower":30,"agility":-20}},
  "implante_20": {"name":"Garras Infernais","price":1000,"scrap":62612,"kind":0,"fx":{"pvpPoints":20,"firepower":10},"text":"Bônus PvP reservado para o sistema PvP."},
  "implante_21": {"name":"Abóbora Maldita","price":1000,"scrap":29000,"kind":0,"fx":{"exp":9,"firepower":6},"event":true},
  "implante_22": {"name":"Caveira Vampírica","price":1000,"scrap":29000,"kind":0,"fx":{"exp":5,"thick":5,"agility":6},"event":true},
  "implante_23": {"name":"Máscara da Folia","price":1000,"scrap":29000,"kind":0,"fx":{"exp":4,"firepower":4,"agility":4,"ammoLoot":12,"greed":12,"armorFind":12,"hunter":12},"event":true},
  "implante_24": {"name":"Tambor do Caos","price":1000,"scrap":29000,"kind":0,"fx":{"agility":11},"event":true},
  "implante_25": {"name":"Sinos do Apocalipse","price":2000,"scrap":29000,"kind":1,"fx":{"firepower":-20,"ammoLoot":100,"greed":100,"armorFind":100,"hunter":100},"event":true},
  "implante_26": {"name":"Bengala Congelante","price":2000,"scrap":29000,"kind":1,"fx":{"exp":-20,"agility":30},"event":true},
  "implante_27": {"name":"Ovo Radioativo","price":2000,"scrap":29000,"kind":1,"fx":{"exp":30,"thick":-25},"event":true},
  "implante_28": {"name":"Coelho Mutante","price":1000,"scrap":29000,"kind":0,"fx":{"ammoLoot":27,"greed":33,"armorFind":27,"hunter":33},"event":true},
  "implante_29": {"name":"Trindade Suprema","price":1000,"scrap":29000,"kind":0,"fx":{"exp":4,"firepower":6,"agility":5},"event":true},
};
const IMP_IDS = Object.keys(IMP);
const IMP_COLOR = ["#d4af37", "#e07b5a", "#c58bff"];     // comum · com penalidade · especial

// ---------- Personagem: nível (1 a 200) e atributos ----------
const MAX_LEVEL = 200, ATTR_MAX = 100, PLAYER_HP_CAP = 200;
// Limites de distribuição: stats gerais até 100, Força até 100,
// e as cinco proficiências de armas até 120 cada (700 pontos no total).
const WEAPON_SKILL_IDS = ["str", "melee", "pistols", "rifles", "shotguns", "machinegun"];
function weaponSkillCap(id) {
  if (id === "str") return 100;
  return WEAPON_SKILL_IDS.includes(id) ? 120 : ATTR_MAX;
}
// 199 níveis ganhos = 665 pontos. Início: Força 25 + Melee 5 + Pistols 5 = 35.
// Orçamento de arma até o nível 200: 35 + 665 = 700, antes de bônus da profissão.
function weaponPointsAtLevel(level) {
  const l = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  return Math.max(0, Math.min(l, 23) - 1) * 8 +
    Math.max(0, Math.min(l, 50) - 23) * 7 +
    Math.max(0, Math.min(l, 100) - 50) * 3 +
    Math.max(0, Math.min(l, 150) - 100) * 2 +
    Math.max(0, l - 150);
}
function weaponPointsForLevel(level) {
  return weaponPointsAtLevel(level) - weaponPointsAtLevel(level - 1);
}
// Pontos de sobrevivência são uma reserva SEPARADA dos 700 de armas.
function survivalPointsForLevel(level) {
  return level <= 50 ? 3 : level <= 100 ? 2 : 1;
}
const ATTRS = [
  { id: "endurance", name: "Endurance (vida)", start: 25 },
  { id: "str",        name: "Força",                 start: 25 },
  { id: "armor",      name: "Armadura",              start: 0 },
  { id: "agi",        name: "Agilidade",             start: 25 },
  { id: "acc",        name: "Precisão de mira",      start: 25 },
  { id: "crit",       name: "Chance de crítico",     start: 25 },
  { id: "reload",     name: "Velocidade de recarga", start: 25 },
  { id: "silence",    name: "Silêncio ao andar",     start: 0 },
  { id: "stealth",    name: "Furtividade",           start: 0 },
  { id: "melee",      name: "Melee",                 start: 5 },
  { id: "pistols",    name: "Pistols",               start: 5 },
  { id: "rifles",     name: "Rifles",                start: 0 },
  { id: "shotguns",   name: "Shotguns",              start: 0 },
  { id: "machinegun", name: "Machinegun",            start: 0 }
];
const CATNAME = { melee: "Melee", pistols: "Pistols", rifles: "Rifles", shotguns: "Shotguns", machinegun: "Machinegun" };
function defaultAttrs() { const a = {}; ATTRS.forEach((d) => { a[d.id] = d.start; }); return a; }

// ---------- Personagens (retratos em img/, cores do boneco visto de cima) ----------
const SKINS = [
  { spr: "p1", name: "Sobrevivente",   lvl: 1,  jacket: "#4a4a32", pants: "#3a3226", hair: "#2a1e14", skin: "#c9a07a" },
  { spr: "p4", name: "Batedora",       lvl: 1,  jacket: "#c9c4b4", pants: "#4a4a2e", hair: "#1e1610", skin: "#d8b08a", cap: "#e8e8e8" },
  { spr: "p5", name: "Bandana",        lvl: 5,  jacket: "#d8d4c8", pants: "#4a4a32", hair: "#2a1e14", skin: "#b8875e", band: "#8a7a52" },
  { spr: "p6", name: "Motoqueira",     lvl: 10, jacket: "#2a2420", pants: "#2e3a4a", hair: "#2a1e14", skin: "#d8b08a", cap: "#3a3d48" },
  { spr: "p3", name: "Sobretudo",      lvl: 15, jacket: "#3a2a22", pants: "#2a2a2a", hair: "#141414", skin: "#c9a07a", glasses: true },
  { spr: "p7", name: "Encapuzado",     lvl: 25, jacket: "#2a2826", pants: "#2a2826", hood: "#2a2826", skin: "#141414" },
  { spr: "p2", name: "Máscara de gás", lvl: 35, jacket: "#26282c", pants: "#26282c", mask: "#3a3d40", skin: "#3a3d40" },
  { spr: "p8", name: "Blindado",       lvl: 50, jacket: "#3a3632", pants: "#3a3632", helmet: "#4a4a4a", accent: "#b08a4a", skin: "#4a4a4a" },
  { spr: "p9", name: "Sentinela",      lvl: 80, jacket: "#2a2a2c", pants: "#2a2a2c", hood: "#1e1e20", accent: "#c8c8c8", skin: "#141414" }
];

// ---------- Capas (só aparência; aparecem nas costas do boneco) ----------
const CAPES = [
  { name: "Sem capa", lvl: 1 },
  { name: "Capa de lona", lvl: 1, color: "#6b5a3a" },
  { name: "Capa vermelha", lvl: 8, color: "#8a2a24" },
  { name: "Capa de couro", lvl: 15, color: "#3e2c20", trim: "#8a6a45" },
  { name: "Manto da noite", lvl: 30, color: "#1e2230", trim: "#6a7aa0" },
  { name: "Capa de guerra", lvl: 50, color: "#5a1a1a", trim: "#c9a040" },
  { name: "Manto do sentinela", lvl: 80, color: "#d8d4c8", trim: "#4a4a4a" },
  { name: "Capa preta", lvl: 5, color: "#1c1c1f" },
  { name: "Capa verde-escura", lvl: 10, color: "#25381f" },
  { name: "Capa azul", lvl: 20, color: "#26457a" },
  { name: "Capa branca", lvl: 25, color: "#c9c7bf" }
];

// ---------- Créditos e VIP ----------
const CREDIT_PRICE = 500, GM_COST = 200;
