"use strict";
// =====================================================================
//  Sprites: recorta as artes das folhas em img/ (feitas pelo autor do
//  jogo) e tira o fundo escuro. Se as imagens não carregarem, o jogo
//  usa os desenhos feitos em código.
// =====================================================================
const SHEETS = { s1: "img/sheet1.webp", s2: "img/sheet2.webp" };
// [folha, x, y, largura, altura] em pixels da imagem original (1536x1024)
const SPR_RECTS = {
  // armas
  m4: ["s1", 722, 506, 352, 104], shotgun_pump: ["s1", 1122, 512, 392, 80], sniper: ["s1", 732, 612, 492, 100],
  smg: ["s1", 1246, 606, 268, 102], machete: ["s1", 712, 728, 336, 70], revolver: ["s1", 1078, 728, 86, 76],
  pistol_sil: ["s1", 1262, 728, 252, 76], ak: ["s1", 712, 818, 406, 86], crossbow: ["s1", 1142, 816, 372, 82],
  minigun: ["s1", 742, 900, 358, 90], axe: ["s1", 1178, 924, 70, 84], spikebat: ["s1", 1240, 926, 266, 64],
  revolver_orn: ["s2", 126, 30, 202, 112], bayonet: ["s2", 376, 16, 418, 162], axerifle: ["s2", 832, 20, 568, 172],
  gunblade: ["s2", 876, 230, 604, 98], spiked: ["s2", 886, 350, 438, 162], chainsword: ["s2", 882, 520, 598, 102],
  minigun_orn: ["s2", 836, 626, 644, 164], flamesword: ["s2", 842, 826, 668, 124],
  // itens
  medkit: ["s1", 812, 150, 100, 96], pills: ["s1", 928, 150, 100, 96], bandage: ["s1", 1043, 150, 106, 96],
  beans: ["s1", 1160, 150, 104, 96], crate: ["s1", 1274, 150, 104, 96], flashlight: ["s1", 1390, 150, 104, 96],
  tuna: ["s1", 812, 260, 100, 98], chocobar: ["s1", 928, 260, 104, 98], soda: ["s1", 1043, 260, 104, 98],
  meat: ["s1", 1160, 260, 104, 98], fishcan: ["s1", 1274, 260, 104, 98], cloth: ["s1", 1390, 260, 104, 98],
  cereal: ["s1", 812, 366, 100, 104], potatoes: ["s1", 928, 366, 104, 104], soup: ["s1", 1043, 366, 104, 104],
  cigs: ["s1", 1160, 366, 104, 104], bullets: ["s1", 1274, 366, 104, 104], syringes: ["s1", 1390, 366, 104, 104],
  // personagens
  p1: ["s1", 128, 92, 204, 426], p2: ["s1", 328, 88, 164, 430], p3: ["s1", 478, 88, 166, 430], p4: ["s1", 642, 88, 156, 430],
  p5: ["s1", 158, 532, 166, 456], p6: ["s1", 332, 532, 156, 456], p7: ["s1", 502, 532, 158, 456],
  p8: ["s2", 86, 160, 362, 850], p9: ["s2", 456, 160, 348, 850]
};
const SPR = {};          // nome -> canvas recortado (com fundo removido quando possível)
let sprReady = false;
// Imagens avulsas com fundo transparente: pacote "2D Guns" de Kay Lousberg (OpenGameArt.org, licença CC0)
const SPR_FILES = {
  o_pistol: "pistol", o_pistol2: "pistol2", o_pistol3: "pistol3", o_revolver2: "revolver2",
  o_shotgun: "shotgun", o_shotgun2: "shotgun2", o_sniper: "sniper", o_sniper2: "sniper2",
  o_smg: "smg", o_smg2: "smg2", o_ar: "assaultrifle", o_ar2: "assaultrifle2",
  o_grenade: "grenade", o_ammobox: "ammobox", o_mag: "magazine", o_mag2: "magazine2", o_mag3: "magazine3",
  o_bullet_l: "large_bullet", o_bullet_m: "medium_bullet"
};
// deixa a arte colorida do pacote mais suja e escura, no clima de fim de mundo
const OGA_STYLE = "saturate(0.45) brightness(0.82) contrast(1.15) sepia(0.15)";
function loadFileSprites() {
  for (const name in SPR_FILES) {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
      const g = c.getContext("2d");
      g.filter = OGA_STYLE; g.drawImage(im, 0, 0); g.filter = "none";
      SPR[name] = c;
    };
    im.src = `img/oga/${SPR_FILES[name]}.png`;
  }
}

function loadSprites(done) {
  loadFileSprites();
  const imgs = {}, keys = Object.keys(SHEETS);
  let left = keys.length;
  keys.forEach((k) => {
    const im = new Image();
    im.onload = () => { imgs[k] = im; if (--left === 0) build(); };
    im.onerror = () => { if (--left === 0) build(); };
    im.src = SHEETS[k];
  });
  function build() {
    for (const name in SPR_RECTS) {
      const [sh, x, y, w, h] = SPR_RECTS[name], im = imgs[sh];
      if (!im) continue;
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d");
      g.drawImage(im, x, y, w, h, 0, 0, w, h);
      try { cutBackground(g, w, h, name.length === 2 && name[0] === "p" ? 34 : 40); } catch (e) { /* arquivo local: mantém o fundo */ }
      SPR[name] = c;
    }
    sprReady = Object.keys(SPR).length > 0;
    if (done) done();
  }
}
// apaga o fundo escuro que encosta nas bordas do recorte (preenchimento a partir das bordas)
function cutBackground(g, w, h, tol) {
  const d = g.getImageData(0, 0, w, h), p = d.data, seen = new Uint8Array(w * h), stack = [];
  const isBg = (i) => {
    const r = p[i * 4], gg = p[i * 4 + 1], b = p[i * 4 + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    return mx < tol + 14 && mx - mn < 26 + (r > gg + 12 ? 18 : 0);
  };
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (seen[i]) continue;
    seen[i] = 1;
    if (!isBg(i)) continue;
    p[i * 4 + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
  }
  // suaviza a borda: pixels vizinhos ao fundo apagado ficam meio transparentes
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (p[i * 4 + 3] === 0) continue;
    if (p[(i - 1) * 4 + 3] === 0 || p[(i + 1) * 4 + 3] === 0 || p[(i - w) * 4 + 3] === 0 || p[(i + w) * 4 + 3] === 0) p[i * 4 + 3] = 150;
  }
  g.putImageData(d, 0, 0);
}
// desenha um sprite centralizado cabendo em (maxW x maxH); devolve false se não existir
function drawSpr(name, cx, cy, maxW, maxH, flipY) {
  const c = SPR[name];
  if (!c) return false;
  const s = Math.min(maxW / c.width, maxH / c.height), w = c.width * s, h = c.height * s;
  if (flipY) { ctx.save(); ctx.translate(cx, cy); ctx.scale(1, -1); ctx.drawImage(c, -w / 2, -h / 2, w, h); ctx.restore(); }
  else ctx.drawImage(c, cx - w / 2, cy - h / 2, w, h);
  return true;
}
