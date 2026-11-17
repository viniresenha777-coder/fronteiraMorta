"use strict";
// =====================================================================
//  Desenho: texturas, cidade, interiores, personagens, luz e HUD
// =====================================================================
const PAT = {};
let lightC = null, lctx = null, vignetteC = null;

// ---------- Primitivas ----------
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
function ellipse(x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, 6.2832); ctx.fill(); }
function poly(pts, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill();
}
function txt(s, x, y, size, color, align, bold, maxW) {
  ctx.font = `${bold ? "bold " : ""}${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align || "left";
  if (maxW) ctx.fillText(s, x, y, maxW); else ctx.fillText(s, x, y);
}
function inView(x, y, w, h, m) { m = m || 0; return x + w > cam.x - m && x < cam.x + W + m && y + h > cam.y - m && y < cam.y + H + m; }
// marca de "dá para vasculhar": um (?) parado, sem piscar
// Colore somente pontos de saque disponíveis, preservando a textura original.
const LOOT_YELLOW_FILTER = "grayscale(1) sepia(1) saturate(10) hue-rotate(-7deg) brightness(1.7)";
function lootSpotActive(o) {
  return !!o && !o.opened && o.searchable !== false &&
    o.kind !== "door" && o.kind !== "exit" && o.kind !== "decor" &&
    o.kind !== "survivor" &&
    (typeof SAFE_KINDS === "undefined" || !SAFE_KINDS.includes(o.kind)) &&
    typeof spotHasRealLoot === "function" && spotHasRealLoot(o);
}
function drawLootQuestion(o, x, y) {
  if (!lootSpotActive(o)) return;
  ctx.save();
  ctx.shadowColor = "#ffdc36";
  ctx.shadowBlur = 9;
  sparkle(x, y);
  ctx.restore();
}
function sparkle(x, y) {
  ctx.fillStyle = "rgba(10,10,8,0.82)"; circle(x, y, 7.5);
  ctx.strokeStyle = "#ffd96a"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, 7.5, 0, Math.PI * 2); ctx.stroke();
  ctx.textBaseline = "middle";
  txt("?", x, y + 0.5, 11, "#ffd96a", "center", true);
  ctx.textBaseline = "alphabetic";
}

// ---------- Texturas ----------
// cerâmica azul: rejunte escuro, peças com tons diferentes, rachaduras e folhas secas
function blueTiles(step) {
  return (g, size) => {
    for (let y = 0; y < size; y += step) for (let x = 0; x < size; x += step) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${(Math.random() * 0.07).toFixed(3)})`; g.fillRect(x, y, step, step);
    }
    g.strokeStyle = "rgba(10,18,28,0.55)"; g.lineWidth = 2;
    for (let i = 0; i <= size; i += step) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, size); g.moveTo(0, i); g.lineTo(size, i); g.stroke(); }
    g.strokeStyle = "rgba(8,14,22,0.6)"; g.lineWidth = 1;
    for (let c = 0; c < 6; c++) {
      let x = Math.random() * size, y = Math.random() * size; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 22; y += (Math.random() - 0.5) * 22; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      g.fillStyle = ["rgba(150,80,40,0.75)", "rgba(120,60,30,0.7)", "rgba(170,110,50,0.65)"][i % 3];
      g.save(); g.translate(Math.random() * size, Math.random() * size); g.rotate(Math.random() * 6.28);
      g.beginPath(); g.ellipse(0, 0, 3.2, 1.6, 0, 0, 6.283); g.fill(); g.restore();
    }
  };
}
function tex(size, base, specks, extra) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (const [color, n, s0, s1] of specks) {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) { const s = s0 + Math.random() * (s1 - s0); g.fillRect(Math.random() * size, Math.random() * size, s, s); }
  }
  if (extra) extra(g, size);
  return c;
}
function gridLines(step, color) {
  return (g, s) => {
    g.strokeStyle = color; g.lineWidth = 1.5;
    for (let i = 0; i <= s; i += step) { g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, s); g.moveTo(0, i + 0.5); g.lineTo(s, i + 0.5); g.stroke(); }
  };
}
// Materiais do terreno feitos uma única vez, sem aumentar o custo de cada frame.
// Variações de terra, musgo, brita e fissuras substituem as cores chapadas.
function terrainTexture(kind) {
  const size = 256, c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const palette = {
    asphalt: [65, 67, 61], grass: [68, 80, 50], park: [58, 82, 49],
    dirt: [86, 78, 58], lot: [69, 70, 66], gravel: [80, 81, 73]
  };
  const base = palette[kind] || palette.asphalt;
  const vegetation = kind === "grass" || kind === "park";
  const street = kind === "asphalt";
  const hash = (x,y,k) => {
    let h = Math.imul(x + 391 * k, 374761393) ^ Math.imul(y + 127 * k, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  // Ruído contínuo periódico, para as bordas de cada padrão se encaixarem.
  const smooth = (x, y, grid, salt) => {
    const a = x / grid, b = y / grid, ix = Math.floor(a), iy = Math.floor(b);
    const fx = a - ix, fy = b - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const period = size / grid;
    const h = (xx, yy) => hash((xx + period) % period, (yy + period) % period, salt);
    const lo = h(ix,iy)*(1-u) + h(ix+1,iy)*u;
    const hi = h(ix,iy+1)*(1-u) + h(ix+1,iy+1)*u;
    return lo*(1-v)+hi*v;
  };
  const pixels = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const large = (smooth(x,y,64,3)-.5)*34;
    const medium = (smooth(x,y,16,7)-.5)*19;
    const fine = (hash(x,y,11)-.5)*27;
    const l = large + medium + fine;
    const o = (y*size+x)*4;
    const tint = vegetation ? (smooth(x,y,32,15)-.5)*18 : (smooth(x,y,32,17)-.5)*8;
    pixels.data[o] = Math.max(0,Math.min(255, base[0]+l+(vegetation ? tint : 0)));
    pixels.data[o+1] = Math.max(0,Math.min(255,base[1]+l+ (vegetation ? tint*1.9 : 0)));
    pixels.data[o+2] = Math.max(0,Math.min(255,base[2]+l-(vegetation ? tint*.5 : 0)));
    pixels.data[o+3] = 255;
  }
  g.putImageData(pixels,0,0);
  // Grânulos, folhas e pedrinhas não seguem uma grade artificial.
  let seed = kind.split("").reduce((a,c) => a*31+c.charCodeAt(0),13421) >>> 0;
  const rnd = () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const count = vegetation ? 880 : street ? 490 : 390;
  for (let i=0;i<count;i++) {
    const x=rnd()*size,y=rnd()*size,r=.3+rnd()*(vegetation?1.8:1.4);
    g.fillStyle = rnd() < .56 ? "rgba(22,24,18,.21)" : "rgba(205,185,151,.18)";
    g.beginPath();g.ellipse(x,y,r*(.6+rnd()),r*.5,rnd()*6.28,0,6.283);g.fill();
  }
  if (vegetation) {
    for (let i=0;i<850;i++) {
      const x=rnd()*size,y=rnd()*size;
      g.strokeStyle = rnd()<.5?"rgba(163,164,101,.18)":"rgba(17,42,23,.24)";
      g.lineWidth=.6+rnd()*.8;
      g.beginPath();g.moveTo(x,y);g.lineTo(x+(rnd()-.5)*4,y-1-rnd()*4);g.stroke();
    }
    // Pequenas ilhas de terra e desgaste, sem elementos grandes repetidos.
    for(let i=0;i<13;i++) {
      const x=rnd()*size,y=rnd()*size;
      g.fillStyle = "rgba(93,78,53,.10)";
      g.beginPath();g.ellipse(x,y,8+rnd()*12,3+rnd()*6,rnd()*6.28,0,6.283);g.fill();
    }
  } else {
    for(let i=0;i<(street?20:13);i++) {
      let x=rnd()*size, y=rnd()*size;
      g.strokeStyle=street?"rgba(14,17,17,.31)":"rgba(18,20,19,.23)";
      g.lineWidth=.55+rnd()*.85;g.beginPath();g.moveTo(x,y);
      for(let n=0;n<2+Math.floor(rnd()*3);n++){
        x+=(rnd()-.3)*8;y+=(rnd()-.5)*7;g.lineTo(x,y);
      }g.stroke();
    }
    if (street) for(let i=0;i<7;i++){
      const x=rnd()*size,y=rnd()*size;
      g.fillStyle="rgba(25,26,22,.09)";
      g.beginPath();g.ellipse(x,y,11+rnd()*18,3+rnd()*8,rnd()*6.283,0,6.283);g.fill();
    }
  }
  return c;
}
// Desgaste de concreto com juntas irregulares e tonalidade neutra.
function wornConcrete(step) {
  return (g,size)=>{
    g.strokeStyle="rgba(26,30,27,.35)";g.lineWidth=1.6;
    for(let n=0;n<=size;n+=step){
      g.beginPath();g.moveTo(n+.5,0);g.lineTo(n+.5,size);g.stroke();
      g.beginPath();g.moveTo(0,n+.5);g.lineTo(size,n+.5);g.stroke();
    }
    g.strokeStyle="rgba(196,196,172,.12)";g.lineWidth=1;
    for(let n=0;n<size;n+=step){
      g.beginPath();g.moveTo(n+2,0);g.lineTo(n+2,size);g.stroke();
    }
    for(let i=0;i<52;i++){
      const x=Math.random()*size,y=Math.random()*size;
      g.fillStyle=Math.random()<.5?"rgba(29,35,31,.12)":"rgba(185,179,149,.14)";
      g.fillRect(x,y,1+Math.random()*5,1+Math.random()*3);
    }
  };
}

function initRender() {
  const P = (c) => ctx.createPattern(c, "repeat");
  PAT.asphalt = P(terrainTexture("asphalt"));
  PAT.lot = P(terrainTexture("lot"));
  // calçada de cerâmica azul-acinzentada, rachada e com folhas secas
  PAT.sidewalk = P(tex(192, "#646961", [["rgba(0,0,0,0.1)", 380, 1, 2], ["rgba(180,192,160,0.09)", 250, 1, 2]], wornConcrete(48)));
  PAT.grass = P(terrainTexture("grass"));
  PAT.park = P(terrainTexture("park"));
  PAT.dirt = P(terrainTexture("dirt"));
  PAT.plaza = P(tex(192, "#657068", [["rgba(0,0,0,0.13)", 420, 1, 2], ["rgba(180,190,166,0.08)", 300, 1, 2]], wornConcrete(32)));
  PAT.gravel = P(terrainTexture("gravel"));
  PAT.wood = P(tex(128, "#5e4630", [["rgba(0,0,0,0.12)", 300, 1, 2]], (g, s) => {
    for (let y = 0; y < s; y += 16) {
      g.fillStyle = `rgba(0,0,0,${0.06 + ((y / 16) % 3) * 0.04})`; g.fillRect(0, y, s, 16);
      g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(0, y, s, 1.5);
      const off = ((y / 16) * 37) % s; g.fillRect(off, y, 1.5, 16); g.fillRect((off + 64) % s, y, 1.5, 16);
    }
  }));
  PAT.tile = P(tex(64, "#b2b1a7", [["rgba(0,0,0,0.06)", 120, 1, 2]], (g) => {
    g.fillStyle = "rgba(0,0,0,0.08)"; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
    g.strokeStyle = "rgba(0,0,0,0.22)"; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 32, 32); g.strokeRect(32.5, 32.5, 32, 32);
  }));
  PAT.carpet = P(tex(128, "#44495a", [["rgba(255,255,255,0.05)", 900, 1, 1], ["rgba(0,0,0,0.15)", 900, 1, 1]]));
  PAT.concrete = P(tex(256, "#55554f", [["rgba(0,0,0,0.15)", 700, 1, 3], ["rgba(255,255,255,0.05)", 400, 1, 2]], gridLines(128, "rgba(0,0,0,0.2)")));
  lightC = document.createElement("canvas"); lightC.width = W; lightC.height = H; lctx = lightC.getContext("2d");
  vignetteC = document.createElement("canvas"); vignetteC.width = W; vignetteC.height = H;
  const v = vignetteC.getContext("2d"), g = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.55)");
  v.fillStyle = g; v.fillRect(0, 0, W, H);
}

// =====================================================================
//  Cidade
// =====================================================================
function drawWorld() {
  const x0 = cam.x, y0 = cam.y;
  ctx.fillStyle = PAT.asphalt; ctx.fillRect(x0 - 20, y0 - 20, W + 40, H + 40);
  for (const b of world.blocks) if (inView(b.x, b.y, b.w, b.h, 10)) drawBlockGround(b);
  drawRoadMarks();
  ctx.fillStyle = PAT.sidewalk;
  for (const p of world.paths) if (inView(p.x, p.y, p.w, p.h)) ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.strokeStyle = "rgba(230,230,220,0.45)"; ctx.lineWidth = 2;
  for (const s of world.spaces) if (inView(s.x, s.y, s.w, s.h)) { ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + s.h); ctx.moveTo(s.x + s.w, s.y); ctx.lineTo(s.x + s.w, s.y + s.h); ctx.stroke(); }
  for (const d of world.decals) if (inView(d.x - 30, d.y - 30, 60, 60)) drawDecal(d);
  drawBloodList(world.blood);
  if (world.shells) {
    ctx.fillStyle = "#a8862e";
    for (const s of world.shells) if (inView(s.x - 4, s.y - 4, 8, 8)) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.globalAlpha = Math.min(1, s.t / 3000); ctx.fillRect(-2, -1, 4, 2); ctx.restore(); }
    ctx.globalAlpha = 1;
  }
  for (const p of world.props) if (inView(p.x - 60, p.y - 60, 120, 120)) drawProp(p);
  for (const f of world.fences) if (inView(f.x, f.y, f.w, f.h, 10)) drawFence(f);
  for (const l of world.lamps) if (inView(l.x - 10, l.y - 10, 20, 20)) drawLampPost(l);
  for (const o of world.loot.query(cam.x - 40, cam.y - 40, cam.x + W + 40, cam.y + H + 40)) if (o.kind !== "door" && o.kind !== "car" && !(o.kind === "dumpster" && modelOk("dumpster"))) drawLootObj(o);
  for (const c of world.corpses) if (inView(c.x, c.y, c.w, c.h, 20)) drawCorpse(c);
  for (const c of world.cars) if (inView(c.x, c.y, c.w, c.h, 20)) { carUnder(c); if (!carModel(c)) {
      if (lootSpotActive(c) && c.searchable) {
        ctx.save(); ctx.filter = LOOT_YELLOW_FILTER; drawCar(c); ctx.restore();
        drawLootQuestion(c, c.x + c.w / 2, c.y - 12);
      } else drawCar(c);
    } carOver(c); }  // furgões 3D: drawSortedScene
  for (const o of world.bodies) if (inView(o.x, o.y, o.w, o.h, 20)) drawBody(o);
  for (const b of world.buildings) if (inView(b.x, b.y, b.w, b.h, 20)) drawBuildingGround(b); // paredes e telhado: drawTall()
  drawAreaEdges();
}
// bordas da área: com passagem mostram a cor e o nome da vizinha; sem passagem, escombros
function drawAreaEdges() {
  const c = world.cell, t = game.time;
  for (const [dx, dy, arrow] of [[0, -1, "▲"], [0, 1, "▼"], [-1, 0, "◀"], [1, 0, "▶"]]) {
    const n = cellAt(c.cx + dx, c.cy + dy), horiz = dy !== 0;
    const ex = dx < 0 ? 0 : dx > 0 ? WORLD_W - 8 : 0, ey = dy < 0 ? 0 : dy > 0 ? WORLD_H - 8 : 0;
    const ew = horiz ? WORLD_W : 8, eh = horiz ? 8 : WORLD_H;
    if (!inView(ex, ey, ew, eh, 60)) continue;
    if (!n) {
      ctx.fillStyle = "#1c1c1a"; ctx.fillRect(ex, ey, ew, eh);
      for (let i = 0; i < (horiz ? WORLD_W : WORLD_H); i += 46) {
        const x = horiz ? i : ex + (dx > 0 ? -10 : 2), y = horiz ? ey + (dy > 0 ? -10 : 2) : i;
        ctx.fillStyle = "#5a5852"; ctx.fillRect(x, y, horiz ? 40 : 16, horiz ? 16 : 40);
        ctx.fillStyle = "#c9a23a"; ctx.fillRect(x + (horiz ? 6 : 2), y + (horiz ? 2 : 6), horiz ? 8 : 12, horiz ? 12 : 8);
      }
      continue;
    }
    const RG = REGIONS[n.tier], locked = n.tier === 8 && player.level < GRAY_LEVEL;
    const col = RG.color === "#2a2a2e" ? "#6a6a74" : RG.color;
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t / 400);
    ctx.fillStyle = locked ? "#c0392b" : col;
    // passagem só nas pontas das ruas
    for (const [a, b] of horiz ? V_STREETS : H_STREETS) { if (horiz) ctx.fillRect(a, ey, b - a, eh); else ctx.fillRect(ex, a, ew, b - a); }
    ctx.globalAlpha = 1;
    const lx = horiz ? MID_X : dx < 0 ? 44 : WORLD_W - 44, ly = horiz ? (dy < 0 ? 34 : WORLD_H - 30) : MID_Y;
    const label = `${arrow} ${n.code} · ${RG.name}${locked ? ` · nível ${GRAY_LEVEL}` : ""}${n.boss ? " · ☠" : ""}`;
    ctx.font = `bold 13px ${FONT}`; const tw = ctx.measureText(label).width + 18;
    const bx = clamp(lx - tw / 2, 4, WORLD_W - tw - 4);
    ctx.fillStyle = "rgba(10,10,8,0.8)"; rr(bx, ly - 15, tw, 22, 8); ctx.fill();
    ctx.strokeStyle = locked ? "#c0392b" : col; ctx.lineWidth = 1.5; ctx.stroke();
    txt(label, bx + tw / 2, ly + 1, 13, locked ? "#ff8a6a" : "#e5e0c8", "center", true);
  }
}

function drawBlockGround(b) {
  // Marcas de poeira e terra nas bordas das ruas, sem bloquear o asfalto.
  // O desgaste desaparece suavemente no chão e não cria colisões.
  const edge = 22;
  if (inView(b.x - edge,b.y - edge,b.w + 2*edge,b.h + 2*edge)) {
    ctx.save();
    let grad = ctx.createLinearGradient(b.x-edge,0,b.x,0);
    grad.addColorStop(0,"rgba(28,29,24,0)");
    grad.addColorStop(1,"rgba(31,34,25,.25)");
    ctx.fillStyle=grad;ctx.fillRect(b.x-edge,b.y,edge,b.h);
    grad=ctx.createLinearGradient(b.x+b.w,0,b.x+b.w+edge,0);
    grad.addColorStop(0,"rgba(31,34,25,.25)");
    grad.addColorStop(1,"rgba(28,29,24,0)");
    ctx.fillStyle=grad;ctx.fillRect(b.x+b.w,b.y,edge,b.h);
    grad=ctx.createLinearGradient(0,b.y-edge,0,b.y);
    grad.addColorStop(0,"rgba(28,29,24,0)");
    grad.addColorStop(1,"rgba(31,34,25,.25)");
    ctx.fillStyle=grad;ctx.fillRect(b.x,b.y-edge,b.w,edge);
    grad=ctx.createLinearGradient(0,b.y+b.h,0,b.y+b.h+edge);
    grad.addColorStop(0,"rgba(31,34,25,.25)");
    grad.addColorStop(1,"rgba(28,29,24,0)");
    ctx.fillStyle=grad;ctx.fillRect(b.x,b.y+b.h,b.w,edge);
    ctx.restore();
  }
  ctx.fillStyle = PAT.sidewalk; ctx.fillRect(b.x, b.y, b.w, b.h);
  // Guia da calçada em relevo, com desgaste de borda.
  ctx.strokeStyle = "rgba(23,27,23,.74)";ctx.lineWidth=4;
  ctx.strokeRect(b.x+1,b.y+1,b.w-2,b.h-2);
  ctx.strokeStyle = "rgba(182,185,160,.50)";ctx.lineWidth=1.5;
  ctx.strokeRect(b.x+3,b.y+3,b.w-6,b.h-6);
  ctx.fillStyle = PAT[b.ground]; ctx.fillRect(b.x + SIDEWALK, b.y + SIDEWALK, b.w - 2 * SIDEWALK, b.h - 2 * SIDEWALK);
  ctx.strokeStyle = "rgba(0,0,0,0.34)"; ctx.lineWidth = 2;
  ctx.strokeRect(b.x + SIDEWALK, b.y + SIDEWALK, b.w - 2 * SIDEWALK, b.h - 2 * SIDEWALK);
}

function drawRoadMarks() {
  const [hy0, hy1] = H_STREETS[1], [vx0, vx1] = V_STREETS[1];
  // faixa amarela das ruas do meio (cortada no cruzamento)
  ctx.fillStyle = "rgba(214,190,100,0.7)";
  for (let x = 10; x < WORLD_W; x += 70) if (x + 36 < vx0 - 34 || x > vx1 + 34) ctx.fillRect(x, MID_Y - 2, 36, 4);
  for (let y = 10; y < WORLD_H; y += 70) if (y + 36 < hy0 - 34 || y > hy1 + 34) ctx.fillRect(MID_X - 2, y, 4, 36);
  // faixas de pedestre no cruzamento
  ctx.fillStyle = "rgba(225,225,215,0.5)";
  for (let x = vx0 + 8; x < vx1 - 12; x += 20) { ctx.fillRect(x, hy0 - 30, 11, 24); ctx.fillRect(x, hy1 + 6, 11, 24); }
  for (let y = hy0 + 10; y < hy1 - 12; y += 20) { ctx.fillRect(vx0 - 30, y, 24, 11); ctx.fillRect(vx1 + 6, y, 24, 11); }
  // linha branca nas ruas da borda
  ctx.fillStyle = "rgba(230,230,220,0.3)";
  for (let x = 10; x < WORLD_W; x += 64) { ctx.fillRect(x, AREA_EDGE / 2 - 1, 30, 2); ctx.fillRect(x, WORLD_H - AREA_EDGE / 2 - 1, 30, 2); }
  for (let y = 10; y < WORLD_H; y += 64) { ctx.fillRect(AREA_EDGE / 2 - 1, y, 2, 30); ctx.fillRect(WORLD_W - AREA_EDGE / 2 - 1, y, 2, 30); }
}

function drawDecal(d) {
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.scale(d.s, d.s);
  if (d.type === "crack") {
    ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0);
    for (const [x, y] of d.pts) ctx.lineTo(x, y);
    ctx.stroke();
  } else if (d.type === "oil") { ctx.fillStyle = "rgba(0,0,0,0.3)"; ellipse(0, 0, 16, 9); ellipse(9, 4, 8, 5); }
  else if (d.type === "manhole") {
    ctx.fillStyle = "#262729"; circle(0, 0, 13); ctx.strokeStyle = "#45464a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
  } else if (d.type === "debris") { ctx.fillStyle = "#5a5852"; ctx.fillRect(-6, -3, 7, 5); ctx.fillRect(3, 2, 5, 4); ctx.fillStyle = "#3e3c37"; ctx.fillRect(-2, 4, 4, 3); }
  else { ctx.fillStyle = "rgba(220,215,200,0.55)"; ctx.fillRect(-5, -4, 10, 8); }
  ctx.restore();
}
function drawBloodList(list) {
  for (const b of list) {
    if (!game.inside && !inView(b.x - 20, b.y - 20, 40, 40)) continue;
    ctx.fillStyle = `rgba(${b.c || "95,8,8"},${b.a})`;
    for (const [dx, dy, r] of b.pts) circle(b.x + dx, b.y + dy, r);
  }
}
function drawLampPost(l) {
  // Base exata do poste, sem sombra deslocada pelo chão.
  ctx.fillStyle = "#26292b"; circle(l.x, l.y, l.big ? 4 : 3);
  ctx.fillStyle = "#666a6b"; circle(l.x, l.y, l.big ? 2 : 1.5);
}
function drawFence(f) {
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(f.x + 3, f.y + 3, f.w, f.h);
  ctx.fillStyle = "#4d5a50"; ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.strokeStyle = "rgba(170,190,170,0.35)"; ctx.lineWidth = 1;
  const horiz = f.w > f.h;
  for (let i = 0; i < (horiz ? f.w : f.h); i += 6) {
    ctx.beginPath();
    if (horiz) { ctx.moveTo(f.x + i, f.y); ctx.lineTo(f.x + i + 4, f.y + f.h); } else { ctx.moveTo(f.x, f.y + i); ctx.lineTo(f.x + f.w, f.y + i + 4); }
    ctx.stroke();
  }
  ctx.fillStyle = "#2a2f2b";
  for (let i = 0; i <= (horiz ? f.w : f.h); i += 60) { if (horiz) ctx.fillRect(f.x + i - 2, f.y - 2, 5, f.h + 4); else ctx.fillRect(f.x - 2, f.y + i - 2, f.w + 4, 5); }
}
function drawProp(p) {
  if (p.hidden) return;                 // virou ruína 3D
  if (p.type === "fountain") {
    ctx.fillStyle = "rgba(0,0,0,0.35)"; circle(p.x + 5, p.y + 5, p.r);
    ctx.fillStyle = "#8a877c"; circle(p.x, p.y, p.r);
    ctx.fillStyle = "#2f5468"; circle(p.x, p.y, p.r - 7);
    ctx.strokeStyle = `rgba(160,210,230,${0.25 + 0.15 * Math.sin(game.time / 400)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 12 + ((game.time / 60) % 22), 0, 6.283); ctx.stroke();
    ctx.fillStyle = "#9a978c"; circle(p.x, p.y, 9);
  } else if (p.type === "bench") {
    const w = p.v ? 12 : 44, h = p.v ? 44 : 12;
    if (drawModel(p.v ? "bench_90" : "bench", p.x + w / 2, p.y + h / 2, 26)) return;   // banco 3D
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(p.x + 3, p.y + 3, w, h);
    ctx.fillStyle = "#6b4a2b"; ctx.fillRect(p.x, p.y, w, h);
    ctx.fillStyle = "#4a3220";
    for (let i = 3; i < (p.v ? h : w); i += 8) { if (p.v) ctx.fillRect(p.x, p.y + i, w, 2); else ctx.fillRect(p.x + i, p.y, 2, h); }
  } else if (p.type === "rubble") {
    const R = mulberry(p.seed);
    for (let i = 0; i < 12; i++) {
      const x = p.x + (R() - 0.5) * 70 * p.s, y = p.y + (R() - 0.5) * 50 * p.s, s = 4 + R() * 10;
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x + 2, y + 2, s, s * 0.7);
      ctx.fillStyle = pick(["#6a675e", "#57544c", "#7a5a45"], R); ctx.fillRect(x, y, s, s * 0.7);
    }
  } else if (p.type === "sandbags") {
    for (let i = 0; i < p.w; i += 12) { ctx.fillStyle = "rgba(0,0,0,0.3)"; ellipse(p.x + i + 7, p.y + 9, 7, 5); ctx.fillStyle = "#a8996a"; ellipse(p.x + i + 6, p.y + 7, 7, 5); }
  } else if (p.type === "flag") {
    ctx.fillStyle = "#222"; circle(p.x, p.y, 3);
    const wv = Math.sin(game.time / 300) * 3;
    poly([[p.x, p.y], [p.x + 26, p.y - 6 + wv], [p.x + 24, p.y + 10 + wv], [p.x, p.y + 12]], "#3f8a5a");
  } else if (p.type === "crates") {
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(p.x + 3, p.y + 3, 22, 22);
    ctx.fillStyle = "#7a5a35"; ctx.fillRect(p.x, p.y, 22, 22);
    ctx.strokeStyle = "#4a3220"; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, 22, 22);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 22, p.y + 22); ctx.stroke();
  }
}

function drawLootObj(o) {
  const active = lootSpotActive(o);
  if (active) { ctx.save(); ctx.filter = LOOT_YELLOW_FILTER; }
  drawLootObjBase(o);
  if (active) {
    ctx.restore();
    drawLootQuestion(o, o.x + o.w / 2, o.y - 12);
  }
}
function drawLootObjBase(o) {
  const op = o.opened;
  if (o.kind === "trash") {
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(o.x + 2, o.y + 3, o.w, o.h);
    ctx.fillStyle = op ? "#2d3a2d" : "#3d6a4a"; rr(o.x, o.y, o.w, o.h, 3); ctx.fill();
    ctx.fillStyle = op ? "#5d6560" : "#9aa5a0"; ctx.fillRect(o.x - 1, o.y - 2, o.w + 2, 4);
  } else if (o.kind === "dumpster") {
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(o.x + 4, o.y + 4, o.w, o.h);
    ctx.fillStyle = op ? "#2a3d33" : "#2f6a4a"; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(o.x, o.y + o.h / 2 - 1, o.w, 2);
    ctx.strokeStyle = "#1a2a20"; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
  } else if (o.kind === "crate") {
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(o.x + 3, o.y + 3, o.w, o.h);
    ctx.fillStyle = op ? "#5a4530" : "#8a6a40"; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#4a3220"; ctx.lineWidth = 2; ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
    ctx.beginPath(); ctx.moveTo(o.x + 2, o.y + 2); ctx.lineTo(o.x + o.w - 2, o.y + o.h - 2); ctx.moveTo(o.x + o.w - 2, o.y + 2); ctx.lineTo(o.x + 2, o.y + o.h - 2); ctx.stroke();
  } else if (o.kind === "chest") drawChest(o);
}
function drawChest(c) {
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(c.x + 3, c.y + 3, c.w, c.h);
  ctx.fillStyle = c.opened ? "#4a3524" : "#8a5a2b"; ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.fillStyle = c.opened ? "#3a2818" : "#a06a35"; ctx.fillRect(c.x, c.y, c.w, 7);
  ctx.strokeStyle = "#2b1a0e"; ctx.lineWidth = 2; ctx.strokeRect(c.x, c.y, c.w, c.h);
  ctx.beginPath(); ctx.moveTo(c.x, c.y + 7); ctx.lineTo(c.x + c.w, c.y + 7); ctx.stroke();
  if (!c.opened) { ctx.fillStyle = "#d4af37"; ctx.fillRect(c.x + c.w / 2 - 3, c.y + 4, 6, 7); }
}
function drawCorpse(c) {
  const active = lootSpotActive(c);
  if (active) { ctx.save(); ctx.filter = LOOT_YELLOW_FILTER; }
  drawCorpseBase(c);
  if (active) {
    ctx.restore();
    drawLootQuestion(c, c.x + c.w / 2, c.y - 12);
  }
}
function drawCorpseBase(c) {
  if (c.dsheet && typeof drawZombieDeath === "function" && drawZombieDeath(c)) return;
  ctx.save(); ctx.translate(c.x + c.w / 2, c.y + c.h / 2); ctx.rotate(c.ang);
  const s = c.w / 26;
  ctx.fillStyle = "rgba(80,6,6,0.5)"; ellipse(2, 2, 19 * s, 13 * s);
  ctx.strokeStyle = c.skin || "#7a9c55"; ctx.lineWidth = 4 * s; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, -6 * s); ctx.lineTo(-10 * s, -14 * s); ctx.moveTo(0, 6 * s); ctx.lineTo(8 * s, 13 * s); ctx.stroke();
  ctx.fillStyle = c.opened ? shade(c.cloth || "#4a5e38", -0.4) : c.cloth || "#4a5e38"; ellipse(0, 0, 12 * s, 8 * s);
  ctx.fillStyle = c.skin || "#7a9c55"; circle(13 * s, 1 * s, 6 * s);
  ctx.restore();
}

function drawCar(c) {
  const L = Math.max(c.w, c.h), S = Math.min(c.w, c.h);
  ctx.save(); ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
  ctx.rotate((c.vert ? 0 : Math.PI / 2) + c.rot + (c.dir ? Math.PI : 0));
  ctx.fillStyle = "rgba(0,0,0,0.4)"; rr(-S / 2 + 4, -L / 2 + 6, S, L, 8); ctx.fill();
  ctx.fillStyle = "#111";
  for (const wy of [-L / 2 + 10, L / 2 - 24]) { ctx.fillRect(-S / 2 - 3, wy, 5, 14); ctx.fillRect(S / 2 - 2, wy, 5, 14); }
  ctx.fillStyle = c.c1; rr(-S / 2, -L / 2, S, L, 8); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.1)"; rr(-S / 2 + 2, -L / 2 + 3, S / 2 - 2, L - 6, 6); ctx.fill();
  ctx.fillStyle = c.wreck ? "#141414" : "#1f2d38"; rr(-S / 2 + 4, -L / 2 + 14, S - 8, 15, 3); ctx.fill();
  ctx.fillStyle = c.c2; rr(-S / 2 + 5, -L / 2 + 31, S - 10, L - 60, 4); ctx.fill();
  ctx.fillStyle = c.wreck ? "#141414" : "#1f2d38"; rr(-S / 2 + 5, L / 2 - 27, S - 10, 11, 3); ctx.fill();
  ctx.fillStyle = "rgba(160,200,230,0.18)"; ctx.fillRect(-S / 2 + 6, -L / 2 + 16, 6, 11);
  ctx.fillStyle = c.wreck ? "#555" : "#f0e29a"; ctx.fillRect(-S / 2 + 3, -L / 2 + 1, 7, 3); ctx.fillRect(S / 2 - 10, -L / 2 + 1, 7, 3);
  ctx.fillStyle = "#8a1a1a"; ctx.fillRect(-S / 2 + 3, L / 2 - 4, 7, 3); ctx.fillRect(S / 2 - 10, L / 2 - 4, 7, 3);
  if (c.wreck) {
    ctx.strokeStyle = "rgba(220,220,220,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4, -L / 2 + 16); ctx.lineTo(4, -L / 2 + 26); ctx.moveTo(0, -L / 2 + 15); ctx.lineTo(-6, -L / 2 + 27); ctx.stroke();
    ctx.fillStyle = "rgba(120,60,20,0.5)"; circle(4, 6, 5); circle(-6, -10, 3);
  }
  ctx.restore();
}

function drawBuilding(b) {
  ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(b.x + 10, b.y + 10, b.w, b.h);
  ctx.fillStyle = shade(b.color, -0.5); ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
  if (b.roof === "pitched") drawPitched(b); else drawFlat(b);
  drawDoor(b);
}
// Padrão de telhas feito uma única vez e reaproveitado em todas as casas.
// Sem imagens externas: combina com a iluminação dinâmica, sem downloads.
let HOUSE_ROOF_TEX = null;
function houseRoofPattern() {
  if (HOUSE_ROOF_TEX) return HOUSE_ROOF_TEX;
  const tile = document.createElement("canvas");
  tile.width = 72; tile.height = 48;
  const g = tile.getContext("2d");
  for (let row = 0; row < 6; row++) {
    const y = row * 8, offset = (row % 2) * 12;
    g.strokeStyle = "rgba(29,17,15,0.33)"; g.lineWidth = 1.25;
    g.beginPath(); g.moveTo(0, y + 7.5); g.lineTo(72, y + 7.5); g.stroke();
    g.strokeStyle = "rgba(246,195,146,0.15)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, y + 1); g.lineTo(72, y + 1); g.stroke();
    for (let x = -24 + offset; x <= 72; x += 24) {
      g.strokeStyle = "rgba(24,14,13,0.31)";
      g.beginPath(); g.moveTo(x, y + 1); g.lineTo(x, y + 7); g.stroke();
      const n = (row * 31 + x * 19 + 931) >>> 0;
      if (n % 5 === 0) {
        g.fillStyle = "rgba(248,210,174,0.12)";
        g.fillRect(x + 3, y + 2, 13, 1);
      }
      if (n % 7 === 0) {
        g.fillStyle = "rgba(17,22,18,0.16)";
        g.fillRect(x + 5, y + 4, 11, 2);
      }
    }
  }
  // Manchas e riscos de desgaste, sem granulação excessiva.
  let seed = 3243185;
  for (let i = 0; i < 65; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = seed % 72;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const y = seed % 48;
    g.fillStyle = i % 3 ? "rgba(39,27,20,0.18)" : "rgba(238,202,166,0.19)";
    g.fillRect(x, y, 1 + (i % 3), 1);
  }
  HOUSE_ROOF_TEX = ctx.createPattern(tile, "repeat");
  return HOUSE_ROOF_TEX;
}
function drawPitched(b) {
  const horiz = b.w >= b.h, L = horiz ? b.w : b.h, S = horiz ? b.h : b.w;
  const rc = typeof roofColor === "function" ? roofColor(b) : b.color;
  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  if (!horiz) ctx.rotate(Math.PI / 2);
  const hl = L / 2, hs = S / 2, inset = Math.min(hs * 0.82, hl * 0.67);
  // Beiral de madeira/zinco escuro avançando além das paredes.
  ctx.fillStyle = "rgba(14,13,12,0.72)"; ctx.fillRect(-hl - 4, -hs - 4, L + 8, S + 8);
  ctx.fillStyle = shade(rc, -0.58); ctx.fillRect(-hl - 2, -hs - 2, L + 4, S + 4);
  const facets = [
    { p: [[-hl,-hs],[hl,-hs],[hl-inset,0],[-hl+inset,0]], c: shade(rc, 0.13), a: 0.78 },
    { p: [[-hl,hs],[hl,hs],[hl-inset,0],[-hl+inset,0]], c: shade(rc,-0.27), a: 0.56 },
    { p: [[-hl,-hs],[-hl+inset,0],[-hl,hs]], c: shade(rc,-0.11), a: 0.61 },
    { p: [[hl,-hs],[hl-inset,0],[hl,hs]], c: shade(rc,-0.07), a: 0.63 }
  ];
  const pattern = houseRoofPattern();
  for (const facet of facets) {
    poly(facet.p, facet.c);
    if (pattern) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(facet.p[0][0], facet.p[0][1]);
      for (let i = 1; i < facet.p.length; i++) ctx.lineTo(facet.p[i][0], facet.p[i][1]);
      ctx.closePath(); ctx.clip();
      ctx.globalAlpha = facet.a;
      ctx.fillStyle = pattern;
      ctx.fillRect(-hl, -hs, L, S);
      ctx.restore();
    }
  }
  // Cantoneiras, beirais e cumeeira realçados, sem contornos chapados.
  ctx.strokeStyle = "rgba(12,10,10,0.68)"; ctx.lineWidth = 4.2;
  ctx.strokeRect(-hl, -hs, L, S);
  ctx.strokeStyle = "rgba(235,180,122,0.28)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-hl + 2, -hs + 2); ctx.lineTo(hl - 2, -hs + 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-hl + 2, hs - 2); ctx.lineTo(hl - 2, hs - 2); ctx.stroke();
  ctx.strokeStyle = shade(rc, -0.56); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-hl + inset, 0); ctx.lineTo(hl - inset, 0); ctx.stroke();
  ctx.strokeStyle = "rgba(218,163,118,0.5)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-hl + inset, -1.3); ctx.lineTo(hl - inset, -1.3); ctx.stroke();
  for (let x = -hl + inset + 4; x < hl - inset - 3; x += 10) {
    ctx.strokeStyle = "rgba(40,25,20,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, -2.6); ctx.lineTo(x + 2, 1.5); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(37,22,20,0.5)"; ctx.lineWidth = 2.8;
  for (const x of [-hl, hl]) {
    const toward = x < 0 ? -hl + inset : hl - inset;
    ctx.beginPath(); ctx.moveTo(x, -hs); ctx.lineTo(toward, 0); ctx.lineTo(x, hs); ctx.stroke();
  }
  // Lodo e pequenos remendos envelhecidos, determinísticos por residência.
  ctx.save(); ctx.beginPath(); ctx.rect(-hl, -hs, L, S); ctx.clip();
  for (let i = 0; i < 13; i++) {
    const rx = -hl + 8 + (L - 16) * bHash(b, 300 + i);
    const ry = -hs + 5 + (S - 10) * bHash(b, 350 + i);
    const rad = 2 + bHash(b, 395 + i) * 6;
    ctx.fillStyle = i % 3 === 0 ? "rgba(32,45,29,0.22)" : "rgba(29,23,21,0.16)";
    ctx.beginPath(); ctx.ellipse(rx, ry, rad * 1.6, rad * 0.65, 0.18, 0, Math.PI * 2); ctx.fill();
  }
  // Alguns telhados têm uma manta de remendo de piche/metal.
  if (bHash(b, 450) < 0.33) {
    const px = (bHash(b, 451) - 0.5) * L * 0.42, py = hs * (0.23 + bHash(b, 452) * 0.24);
    ctx.fillStyle = "rgba(35,36,34,0.68)"; ctx.fillRect(px - 13, py - 6, 26, 12);
    ctx.strokeStyle = "rgba(146,151,146,0.4)"; ctx.lineWidth = 1; ctx.strokeRect(px - 12, py - 5, 24, 10);
  }
  ctx.restore();
  // Antena enferrujada em algumas casas; fica só no telhado.
  if (bHash(b, 471) < 0.31 && L > 100) {
    const ax = hl * 0.55, ay = -hs * 0.45;
    ctx.strokeStyle = "rgba(23,24,23,0.65)"; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(ax, ay + 2); ctx.lineTo(ax, ay - 22); ctx.stroke();
    ctx.strokeStyle = "rgba(155,155,149,0.85)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(ax - 11, ay - 16); ctx.lineTo(ax + 11, ay - 16);
    ctx.moveTo(ax - 6, ay - 9); ctx.lineTo(ax + 6, ay - 9); ctx.stroke();
    ctx.fillStyle = "#514b47"; ctx.beginPath(); ctx.arc(ax, ay - 22, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Chaminé curta com profundidade, sujeira e abertura de fumaça.
  const d = b.details && b.details[0];
  if (d) {
    const x = b.x + d.x, y = b.y + d.y;
    ctx.fillStyle = "rgba(5,4,4,0.38)"; ctx.fillRect(x + 5, y + 6, 14, 13);
    ctx.fillStyle = "#493c37"; ctx.fillRect(x + 1, y + 1, 13, 13);
    ctx.fillStyle = "#876858"; ctx.fillRect(x, y - 3, 13, 11);
    ctx.fillStyle = "#40312c"; ctx.fillRect(x - 2, y - 4, 17, 4);
    ctx.fillStyle = "#161615"; ctx.fillRect(x + 2, y - 3, 9, 4);
    ctx.strokeStyle = "rgba(211,177,149,0.25)"; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x + 2, y + 4); ctx.lineTo(x + 11, y + 4);
    ctx.moveTo(x + 2, y + 8); ctx.lineTo(x + 11, y + 8); ctx.stroke();
  }
}
function drawFlat(b) {
  ctx.fillStyle = shade(b.color, -0.08); ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.globalAlpha = 0.35; ctx.fillStyle = PAT.gravel; ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12); ctx.globalAlpha = 1;
  ctx.strokeStyle = shade(b.color, 0.2); ctx.lineWidth = 5; ctx.strokeRect(b.x + 2.5, b.y + 2.5, b.w - 5, b.h - 5);
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 2; ctx.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
  ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
  if (!b.safe) for (const d of b.details) {
    if (d.x + d.s > b.w - 8 || d.y + d.s > b.h - 8) continue;
    const x = b.x + d.x, y = b.y + d.y, s = d.s;
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x + 4, y + 4, s, s);
    ctx.fillStyle = "#8a8d90"; ctx.fillRect(x, y, s, s);
    ctx.fillStyle = "#3a3c3e"; circle(x + s / 2, y + s / 2, s * 0.36);
    ctx.strokeStyle = "#6a6d70"; ctx.lineWidth = 1.5; ctx.beginPath();
    const a = game.time / 120;
    for (let i = 0; i < 3; i++) { const t = a + (i * 2.094); ctx.moveTo(x + s / 2, y + s / 2); ctx.lineTo(x + s / 2 + Math.cos(t) * s * 0.33, y + s / 2 + Math.sin(t) * s * 0.33); }
    ctx.stroke();
  }
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  if (b.def.cross) {
    const s = Math.min(b.w, b.h) * 0.16;
    ctx.fillStyle = "#f0f0ea"; circle(cx, cy, s * 1.9);
    ctx.fillStyle = b.def.cross; ctx.fillRect(cx - s * 0.4, cy - s * 1.3, s * 0.8, s * 2.6); ctx.fillRect(cx - s * 1.3, cy - s * 0.4, s * 2.6, s * 0.8);
  }
  if (b.def.sign) {
    const sy = b.facing === "up" ? b.y + 20 : b.y + b.h - 20;
    ctx.font = `bold 13px ${FONT}`; const tw = ctx.measureText(b.def.sign).width + 16;
    ctx.fillStyle = "rgba(10,10,10,0.75)"; rr(cx - tw / 2, sy - 11, tw, 20, 4); ctx.fill();
    txt(b.def.sign, cx, sy + 4, 13, b.def.signColor, "center", true);
  }
  if (b.safe) {
    ctx.strokeStyle = "rgba(240,240,220,0.5)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 52, 0, 6.283); ctx.stroke();
    txt("H", cx, cy + 16, 46, "rgba(240,240,220,0.5)", "center", true);
    ctx.font = `bold 16px ${FONT}`; const tw = ctx.measureText(b.name).width + 20;
    ctx.fillStyle = "rgba(10,30,15,0.85)"; rr(cx - tw / 2, b.y + b.h - 34, tw, 24, 5); ctx.fill();
    txt(b.name.toUpperCase(), cx, b.y + b.h - 17, 16, "#8fe0a8", "center", true);
  }
}
function drawDoor(b) {
  if (b.noDoor) return;
  const d = b.door, up = b.facing === "up";
  if (b.type === "casa") {
    // Varanda/soleira de entrada com dois degraus gastos.
    const py = up ? d.y - 15 : d.y + d.h + 2;
    ctx.fillStyle = "rgba(7,7,6,0.32)"; ctx.fillRect(d.x - 11 + 3, py + 3, d.w + 22, 14);
    ctx.fillStyle = "#77746b"; ctx.fillRect(d.x - 11, py, d.w + 22, 11);
    ctx.fillStyle = "#99978d"; ctx.fillRect(d.x - 8, py + 2, d.w + 16, 3);
    ctx.fillStyle = "#555750"; ctx.fillRect(d.x - 14, up ? py - 4 : py + 10, d.w + 28, 4);
    if (isNight() && bHash(b, 513) < 0.36) {
      const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
      const light = ctx.createRadialGradient(cx, cy, 1, cx, cy, 27);
      light.addColorStop(0, "rgba(255,216,140,0.28)");
      light.addColorStop(1, "rgba(255,205,126,0)");
      ctx.fillStyle = light; ctx.beginPath(); ctx.arc(cx, cy, 27, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(d.x - 3, d.y - 1, d.w + 6, d.h + 2);
  if (b.enter) {
    const searched = b.interior && !b.safe && b.interior.every((f) => f.opened || f.searchable === false || f.kind !== "furniture");
    ctx.fillStyle = b.safe ? "#2f6a46" : searched ? "#3a3a36" : "#5a3a1e"; ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = "#d4af37"; ctx.fillRect(d.x + d.w - 8, d.y + d.h / 2 - 1.5, 3, 3);
    ctx.fillStyle = "rgba(200,200,190,0.35)"; ctx.fillRect(d.x - 4, up ? d.y - 5 : d.y + d.h + 1, d.w + 8, 4);
  } else {
    ctx.fillStyle = "#3a2a1a"; ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = "#8a6a45"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.w, d.y + d.h); ctx.moveTo(d.x + d.w, d.y); ctx.lineTo(d.x, d.y + d.h); ctx.stroke();
  }
}
function drawCanopies() {
  for (const t of world.trees) {
    if (!inView(t.x - t.r * 1.5, t.y - t.r * 1.5, t.r * 3, t.r * 3)) continue;
    const under = Math.hypot(player.x - t.x, player.y - t.y) < t.r * 1.1;
    ctx.globalAlpha = under ? 0.4 : 0.95;
    ctx.fillStyle = "rgba(0,0,0,0.3)"; circle(t.x + 10, t.y + 10, t.r);
    const base = t.tone < 0.5 ? "#26401f" : "#2e4524";
    ctx.fillStyle = base; circle(t.x, t.y, t.r * 0.9);
    ctx.fillStyle = shade(base, 0.12);
    for (const l of t.lobes) circle(t.x + l.dx, t.y + l.dy, l.r);
    ctx.fillStyle = shade(base, 0.3);
    for (const l of t.lobes) circle(t.x + l.dx - l.r * 0.25, t.y + l.dy - l.r * 0.25, l.r * 0.45);
  }
  ctx.globalAlpha = 1;
}

// =====================================================================
//  Interior
// =====================================================================
function drawInterior() {
  const h = game.inside, IWd = h.iw || W, IHd = h.ih || H, lvl = h.level | 0;
  ctx.fillStyle = PAT[h.safe ? "concrete" : h.def.floor]; ctx.fillRect(0, 0, IWd, IHd);
  if (h.rug) {
    ctx.fillStyle = h.rug.c; ctx.globalAlpha = 0.75; ctx.fillRect(h.rug.x, h.rug.y, h.rug.w, h.rug.h);
    ctx.strokeStyle = "rgba(230,200,140,0.35)"; ctx.lineWidth = 3; ctx.strokeRect(h.rug.x + 8, h.rug.y + 8, h.rug.w - 16, h.rug.h - 16); ctx.globalAlpha = 1;
  }
  if (h.safe) {
    ctx.fillStyle = "rgba(60,120,80,0.12)"; ctx.fillRect(40, 40, IWd - 80, IHd - 80);
    txt(h.name.toUpperCase(), IWd / 2, IHd / 2 + 10, 40, "rgba(200,230,200,0.08)", "center", true);
  } else if (h.levels && (h.levels.length > 1 || buildingFloors(h) > 1)) {
    txt(floorName(h, lvl).toUpperCase(), IWd / 2, IHd / 2 + 14, 46, "rgba(255,255,255,0.05)", "center", true);
  }
  drawBloodList(h.decals);
  const wc = h.safe ? "#2c332e" : shade(h.color, -0.55);
  ctx.fillStyle = wc;
  ctx.fillRect(0, 0, IWd, 40); ctx.fillRect(0, IHd - 40, IWd, 40); ctx.fillRect(0, 0, 40, IHd); ctx.fillRect(IWd - 40, 0, 40, IHd);
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(40, 40, IWd - 80, 10); ctx.fillRect(40, 40, 10, IHd - 80);
  ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 2; ctx.strokeRect(40, 40, IWd - 80, IHd - 80);
  // janelas (o bunker é subterrâneo: sem janelas nos subsolos)
  if (!(h.def.under && lvl > 0)) {
    const sky = isNight() ? "#1c2a3a" : "#8fb3c9";
    for (let x = 150; x < IWd - 200; x += 270) {
      if (x + 120 > IWd - 220 && lvl < buildingFloors(h) - 1) break;
      ctx.fillStyle = "#2a2a2a"; ctx.fillRect(x - 3, 9, 126, 22);
      ctx.fillStyle = sky; ctx.fillRect(x, 12, 120, 16);
      ctx.fillStyle = "#2a2a2a"; ctx.fillRect(x + 58, 12, 4, 16);
    }
  }
  if (lvl === 0) {
    ctx.fillStyle = "#5a3a1e"; ctx.fillRect(IWd / 2 - 50, IHd - 40, 100, 40);
    ctx.fillStyle = "#3a2410"; ctx.fillRect(IWd / 2 - 1, IHd - 40, 2, 40);
    txt("SAIR", IWd / 2, IHd - 14, 13, "rgba(255,230,180,0.6)", "center", true);
  }
  for (const f of h.interior) drawFurniture(f);
  for (const c of h.corpses) drawCorpse(c);
}
function drawStairs(f) {
  const { x, y, w, h } = f, up = f.dir > 0;
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(x + 4, y + 4, w, h);
  ctx.fillStyle = "#3a3630"; ctx.fillRect(x, y, w, h);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = up ? i / n : 1 - (i + 1) / n;
    ctx.fillStyle = shade("#8a8274", -0.5 + t * 0.6); ctx.fillRect(x + 4 + i * ((w - 8) / n), y + 4, (w - 8) / n - 2, h - 8);
  }
  ctx.strokeStyle = "#c9a040"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  const ax = x + w / 2, ay = y + h / 2;
  poly(up ? [[ax + 12, ay], [ax - 6, ay - 10], [ax - 6, ay + 10]] : [[ax - 12, ay], [ax + 6, ay - 10], [ax + 6, ay + 10]], "#ffd96a");
}

function drawFurniture(f) {
  const active = lootSpotActive(f) && (f.kind === "furniture" || f.kind === "chest");
  if (active) { ctx.save(); ctx.filter = LOOT_YELLOW_FILTER; }
  drawFurnitureBase(f);
  if (active) {
    ctx.restore();
    drawLootQuestion(f, f.x + f.w / 2, f.y - 13);
  }
}
function drawFurnitureBase(f) {
  const { x, y, w, h } = f;
  ctx.globalAlpha = f.opened ? 0.6 : 1;
  const n = f.name;
  // móveis com modelo 3D (models.js): ocupam o mesmo lugar no chão
  const mid = typeof FURN_MODEL !== "undefined" && FURN_MODEL[n];
  if (mid && modelOk(mid)) {
    const active = lootSpotActive(f) && (f.kind === "furniture" || f.kind === "chest");   // mesmo destaque amarelo de drawFurniture
    const d = PROP_SPR[mid], k = Math.min(w / d.fw, h / d.fd) * 1.05;
    if (drawModel(mid, x + w / 2, y + h / 2, k, active ? LOOT_YELLOW_FILTER : f.opened ? "brightness(0.7)" : null)) { ctx.globalAlpha = 1; return; }
  }
  ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.fillRect(x + 5, y + 5, w, h);
  if (f.kind === "decor") { drawDecor(f); ctx.globalAlpha = 1; return; }
  if (f.kind === "survivor") { ctx.globalAlpha = 1; drawSurvivor(x + w / 2, y + h / 2, Math.atan2(player.y - y - h / 2, player.x - x - w / 2), 0, false); hudT("SOS", x + w / 2, y - 18, 12, "#6fff9a", "center", true); return; }
  if (f.kind === "stairs") {
    ctx.globalAlpha = 1; drawStairs(f);
    if (Math.hypot(player.x - (x + w / 2), player.y - (y + h / 2)) < 170) txt(f.label[0].toUpperCase() + f.label.slice(1), x + w / 2, y + h + 16, 11, "#ffd96a", "center", true);
    return;
  }
  if (n === "Cela") {
    ctx.fillStyle = "#4a4a46"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#5e5a52"; ctx.fillRect(x + 6, y + 6, 26, h - 12); ctx.fillStyle = "#cfcabb"; ctx.fillRect(x + 8, y + 8, 22, 12);
    ctx.fillStyle = "#3a3a36"; ctx.fillRect(x + w - 26, y + h - 24, 18, 16);
    ctx.strokeStyle = "#9a9a92"; ctx.lineWidth = 2.5;
    for (let i = 6; i < w; i += 9) { ctx.beginPath(); ctx.moveTo(x + i, y + h - 3); ctx.lineTo(x + i, y + h + 3); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke();
  } else if (n === "Caixa militar") {
    ctx.fillStyle = f.color; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#2a3018"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = "#3a4420"; ctx.fillRect(x + 8, y, 6, h); ctx.fillRect(x + w - 14, y, 6, h);
    txt("MIL", x + w / 2, y + h / 2 + 4, 11, "#e0d8a0", "center", true);
  } else if (n === "Beliche") {
    ctx.fillStyle = "#3a3a36"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = f.color; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = "#d8d4c8"; ctx.fillRect(x + 6, y + 6, w - 12, 14);
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  } else
  if (n === "Cama") {
    ctx.fillStyle = "#4a3220"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#e8e4da"; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.fillStyle = "#f6f3ea"; rr(x + 8, y + 7, 22, h - 14, 4); ctx.fill();
    ctx.fillStyle = f.color; ctx.fillRect(x + 36, y + 4, w - 40, h - 8);
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x + 36, y + 4, w - 40, 8);
  } else if (n === "Geladeira" || n === "Freezer" || n === "Armário médico") {
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, shade(f.color, 0.15)); g.addColorStop(1, shade(f.color, -0.15));
    ctx.fillStyle = g; rr(x, y, w, h, 4); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1.5; ctx.stroke();
    if (n === "Freezer") { ctx.strokeStyle = "rgba(120,170,200,0.6)"; ctx.strokeRect(x + 5, y + 5, w - 10, h - 10); ctx.beginPath(); ctx.moveTo(x + w / 2, y + 5); ctx.lineTo(x + w / 2, y + h - 5); ctx.stroke(); }
    else if (n === "Armário médico") { ctx.fillStyle = "#d04040"; ctx.fillRect(x + w / 2 - 3, y + h / 2 - 9, 6, 18); ctx.fillRect(x + w / 2 - 9, y + h / 2 - 3, 18, 6); }
    else { ctx.fillStyle = "#7a8085"; ctx.fillRect(x + w - 8, y + 8, 3, h - 16); ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(x, y + h * 0.35, w, 2); }
  } else if (n.startsWith("Prateleira") || n === "Estante" || n === "Vitrine" || n === "Estoque" || n === "Estoque de suprimentos") {
    ctx.fillStyle = n === "Vitrine" ? "rgba(170,200,210,0.85)" : shade(f.color, -0.2); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = f.color; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    for (const it of f.items) {
      ctx.fillStyle = n === "Vitrine" ? "#2a2a2a" : n === "Prateleira de remédios" ? pick(["#e8e8e8", "#d04040", "#4aa3df"], () => it.u) : it.c;
      if (n === "Vitrine") ctx.fillRect(x + 6 + it.u * (w - 30), y + 8 + it.v * (h - 18), 22, 4);
      else ctx.fillRect(x + 4 + it.u * (w - 14), y + 4 + it.v * (h - 12), 8, 7);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
  } else if (n === "Mesa" || n === "Bancada" || n === "Balcão") {
    ctx.fillStyle = shade(f.color, 0.1); rr(x, y, w, h, 3); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(x + 3, y + 3, w - 6, 6);
    if (n === "Mesa") { ctx.fillStyle = "#e8e4da"; ctx.fillRect(x + w * 0.2, y + h * 0.3, 18, 13); ctx.fillRect(x + w * 0.55, y + h * 0.4, 14, 11); ctx.fillStyle = "#3a2a1a"; circle(x + w / 2, y + h + 12, 8); }
    if (n === "Bancada") { ctx.fillStyle = "#9aa0a6"; ctx.fillRect(x + 12, y + 12, 26, 5); ctx.fillRect(x + 50, y + 18, 18, 8); ctx.fillStyle = "#c0392b"; ctx.fillRect(x + 80, y + 10, 14, 14); }
    if (n === "Balcão") { ctx.fillStyle = "#3b3f44"; ctx.fillRect(x + w - 34, y + 8, 22, 18); ctx.fillStyle = "#6fae4f"; ctx.fillRect(x + w - 30, y + 11, 14, 6); }
  } else if (n === "Sofá") {
    ctx.fillStyle = shade(f.color, -0.25); rr(x, y, w, h, 8); ctx.fill();
    ctx.fillStyle = f.color;
    for (let i = 0; i < 3; i++) { rr(x + 8 + i * ((w - 16) / 3), y + 12, (w - 16) / 3 - 4, h - 18, 5); ctx.fill(); }
  } else if (n === "Caixa registradora") {
    ctx.fillStyle = "#5a4a3a"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#2a2d31"; rr(x + 8, y + 6, w - 16, h - 12, 3); ctx.fill();
    ctx.fillStyle = "#6fd08a"; ctx.fillRect(x + 14, y + 10, w - 28, 7);
  } else if (n === "Armário de armas" || n === "Armário de evidências" || n === "Arquivo" || n === "Guarda-roupa" || n === "Armário de cozinha" || n === "Armário de suprimentos" || n === "Criado-mudo") {
    ctx.fillStyle = f.color; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1.5;
    const hz = n === "Arquivo" || n === "Criado-mudo", k = hz ? 3 : n === "Armário de armas" ? 4 : 2;
    for (let i = 1; i < k; i++) { ctx.beginPath(); if (hz) { ctx.moveTo(x, y + (h / k) * i); ctx.lineTo(x + w, y + (h / k) * i); } else { ctx.moveTo(x + (w / k) * i, y); ctx.lineTo(x + (w / k) * i, y + h); } ctx.stroke(); }
    ctx.strokeRect(x, y, w, h);
  } else if (n === "Caixa de munição") {
    ctx.fillStyle = f.color; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#2a3018"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    txt("MUN", x + w / 2, y + h / 2 + 4, 11, "#e0d8a0", "center", true);
  } else if (n === "Maca") {
    ctx.fillStyle = "#8a9090"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = f.color; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = "#f6f3ea"; ctx.fillRect(x + 8, y + 6, w - 16, 16);
    ctx.fillStyle = "#222"; for (const [a, b] of [[0, 0], [w, 0], [0, h], [w, h]]) circle(x + a, y + b, 3);
  } else if (f.kind === "chest") {
    drawChest(f);
  } else if (f.kind === "furniture") {
    ctx.fillStyle = f.color; rr(x, y, w, h, 3); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(x + 3, y + 3, w - 6, 5);
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#d4af37"; ctx.fillRect(x + w / 2 - 6, y + h / 2, 3, 3); ctx.fillRect(x + w / 2 + 3, y + h / 2, 3, 3);
  } else {
    drawStation(f);
  }
  ctx.globalAlpha = 1;
  const near = Math.hypot(player.x - (x + w / 2), player.y - (y + h / 2)) < 140;
  if (SAFE_KINDS.includes(f.kind) || near) txt(n, x + w / 2, y + h + 16, 12, SAFE_KINDS.includes(f.kind) ? "#e5e0c8" : "rgba(229,224,200,0.8)", "center", true);
}
function drawDecor(f) {
  const { x, y, w, h } = f, n = f.name;
  if (n === "Planta") {
    ctx.fillStyle = "#7a4a2a"; circle(x + w / 2, y + h / 2, 9);
    ctx.fillStyle = f.color; for (const [a, b] of [[-6, -5], [6, -4], [0, 6], [-5, 5], [5, 6], [0, -8]]) circle(x + w / 2 + a, y + h / 2 + b, 6);
    ctx.fillStyle = "rgba(255,255,255,0.12)"; circle(x + w / 2 - 3, y + h / 2 - 4, 3);
  } else if (n === "Poltrona") {
    ctx.fillStyle = shade(f.color, -0.25); rr(x, y, w, h, 8); ctx.fill();
    ctx.fillStyle = f.color; rr(x + 7, y + 10, w - 14, h - 14, 5); ctx.fill();
  } else if (n === "TV") {
    ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x - 6, y + 4, w + 12, h);
    ctx.fillStyle = f.color; ctx.fillRect(x, y, w, h - 6);
    ctx.fillStyle = "rgba(120,160,200,0.25)"; ctx.fillRect(x + 3, y + 2, w - 6, h - 11);
  } else if (n === "Cadeira") {
    ctx.fillStyle = f.color; rr(x + 3, y + 6, w - 6, h - 8, 3); ctx.fill();
    ctx.fillStyle = shade(f.color, -0.25); ctx.fillRect(x + 3, y, w - 6, 6);
  } else if (n === "Caixas") {
    ctx.fillStyle = f.color; ctx.fillRect(x, y + 8, w * 0.6, h - 8);
    ctx.fillStyle = shade(f.color, 0.12); ctx.fillRect(x + w * 0.4, y, w * 0.6, h * 0.6);
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.2; ctx.strokeRect(x, y + 8, w * 0.6, h - 8); ctx.strokeRect(x + w * 0.4, y, w * 0.6, h * 0.6);
    ctx.fillStyle = "rgba(210,190,140,0.6)"; ctx.fillRect(x + w * 0.4, y + h * 0.27, w * 0.6, 3);
  } else if (n === "Carrinho") {
    ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w - 8, h - 6);
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + (w - 8) * i / 4, y); ctx.lineTo(x + (w - 8) * i / 4, y + h - 6); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x + w - 8, y + 2); ctx.lineTo(x + w, y - 2); ctx.stroke();
    ctx.fillStyle = "#222"; circle(x + 4, y + h - 3, 3); circle(x + w - 12, y + h - 3, 3);
  } else if (n === "Bebedouro") {
    ctx.fillStyle = "#e8ecec"; rr(x, y, w, h, 4); ctx.fill();
    ctx.fillStyle = f.color; circle(x + w / 2, y + h / 2, 8);
    ctx.fillStyle = "rgba(80,150,210,0.6)"; circle(x + w / 2, y + h / 2, 5);
  } else { ctx.fillStyle = f.color; rr(x, y, w, h, 3); ctx.fill(); }
}
function drawStation(f) {
  const { x, y, w, h } = f;
  ctx.fillStyle = shade(f.color, -0.2); rr(x, y, w, h, 6); ctx.fill();
  ctx.fillStyle = f.color; rr(x + 3, y + 3, w - 6, h - 6, 5); ctx.fill();
  ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 1.5; rr(x, y, w, h, 6); ctx.stroke();
  const cx = x + w / 2, cy = y + h / 2;
  if (f.kind === "stash") { ctx.fillStyle = "#d4af37"; ctx.fillRect(cx - 5, cy - 8, 10, 12); ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x, y + 14, w, 2); }
  else if (f.kind === "board") { ctx.fillStyle = "#b08a5a"; ctx.fillRect(x + 6, y + 6, w - 12, h - 12); for (let i = 0; i < 5; i++) { ctx.fillStyle = ["#f0e6a0", "#e8e8e8", "#f0b0a0"][i % 3]; ctx.fillRect(x + 12 + i * 18, y + 12 + (i % 2) * 12, 14, 14); } }
  else if (f.kind === "clinic") { ctx.fillStyle = "#e8f0ea"; circle(cx, cy, 15); ctx.fillStyle = "#3fae6a"; ctx.fillRect(cx - 3, cy - 10, 6, 20); ctx.fillRect(cx - 10, cy - 3, 20, 6); }
  else if (f.kind === "bank") { ctx.fillStyle = "#8a96a0"; circle(cx, cy, 16); ctx.fillStyle = "#4b5b6a"; circle(cx, cy, 10); ctx.strokeStyle = "#d4d8dc"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 8, cy - 6); ctx.stroke(); }
  else if (f.kind === "shopc") { for (let i = 0; i < 6; i++) { ctx.fillStyle = ["#c0392b", "#e0b040", "#4aa3df"][i % 3]; ctx.fillRect(x + 10 + i * 19, y + 12, 12, 12); } ctx.fillStyle = "#2a2a2a"; ctx.fillRect(x + 14, y + 32, w - 28, 8); }
  else if (f.kind === "craft") { ctx.fillStyle = "#9aa0a6"; ctx.fillRect(x + 14, y + 14, 36, 6); ctx.fillRect(x + 60, y + 20, 26, 10); ctx.fillStyle = "#c0392b"; ctx.fillRect(x + 100, y + 12, 18, 18); ctx.fillStyle = "#e0b040"; circle(x + 135, y + 24, 7); ctx.fillStyle = "#3a3a3a"; circle(x + 135, y + 24, 3); }
  else if (f.kind === "travel") { ctx.fillStyle = "#2a2a2a"; ctx.fillRect(x + 14, y + 14, 46, 28); ctx.fillStyle = "#6fd08a"; ctx.fillRect(x + 18, y + 18, 24, 8); ctx.strokeStyle = "#aaa"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 80, y + 40); ctx.lineTo(x + 92, y + 4); ctx.stroke(); if (Math.sin(game.time / 200) > 0) { ctx.fillStyle = "#e04a4a"; circle(x + 92, y + 4, 3); } }
}

// =====================================================================
//  Personagens
// =====================================================================
// arma vista de cima, apontando para +x
function drawWeaponShape(w, swing) {
  const L = w.len, c = w.color, dk = shade(c, -0.4);
  if (w.melee) {
    ctx.save(); ctx.rotate(swing);
    switch (w.look) {
      case "fists": break;
      case "katana": case "sword": case "knife": case "machete":
        ctx.fillStyle = "#2a1a1a"; ctx.fillRect(8, 4, 10, 4);
        ctx.fillStyle = w.look === "sword" ? "#8a8f96" : "#c9a23a"; ctx.fillRect(17, w.look === "sword" ? 0 : 2, 3, w.look === "sword" ? 12 : 8);
        if (w.legendary || w.special) { ctx.shadowColor = c; ctx.shadowBlur = 12; }
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(20, 4); ctx.lineTo(20 + L, 5); ctx.lineTo(20 + L - 6, w.look === "machete" ? 10 : 8); ctx.lineTo(20, 8); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; break;
      case "bat": poly([[8, 4], [8 + L, 2], [8 + L, 10], [8, 8]], c); break;
      case "hammer": ctx.fillStyle = "#5a3d22"; ctx.fillRect(8, 4, L, 4); ctx.fillStyle = c; ctx.fillRect(4 + L, -4, 12, 20); break;
      case "chainsaw":
        ctx.fillStyle = c; ctx.fillRect(4, 0, 16, 14); ctx.fillStyle = "#9aa0a6"; ctx.fillRect(20, 3, L, 8);
        ctx.fillStyle = "#2a2a2a"; for (let i = 0; i < L; i += 5) { ctx.fillRect(20 + i + ((game.time / 20) % 5), 1, 2, 2); ctx.fillRect(20 + i + ((game.time / 20) % 5), 11, 2, 2); } break;
      default: // machado
        ctx.fillStyle = "#6b4a2b"; ctx.fillRect(8, 4, L, 4);
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(8 + L - 10, 2); ctx.lineTo(8 + L + 2, -6); ctx.lineTo(8 + L + 6, 6); ctx.lineTo(8 + L - 10, 8); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    return;
  }
  switch (w.look) {
    case "pistol": case "revolver":
      ctx.fillStyle = dk; ctx.fillRect(10, -3, L - 2, 6); ctx.fillStyle = c; ctx.fillRect(12, -2.5, L - 5, 3);
      if (w.look === "revolver") { ctx.fillStyle = dk; circle(14, 0, 4.5); } break;
    case "shotgun":
      ctx.fillStyle = w.wood ? "#5a3a1e" : dk; ctx.fillRect(2, -3, 10, 6);
      ctx.fillStyle = "#2a2a2a"; ctx.fillRect(10, -2.5, L, 5); ctx.fillStyle = w.wood ? "#6b4a2b" : c; ctx.fillRect(18, -3.5, 10, 7);
      if (w.drum) { ctx.fillStyle = dk; circle(16, 4, 5); } break;
    case "rifle":
      ctx.fillStyle = c; ctx.fillRect(0, -3, 14, 6); ctx.fillStyle = "#1e1e1e"; ctx.fillRect(12, -2, L, 4);
      ctx.fillStyle = "#111"; ctx.fillRect(16, -6, 14, 3); circle(17, -4.5, 2.5); circle(29, -4.5, 2.5);
      if (w.explode) { ctx.fillStyle = "#8fb3ff"; ctx.fillRect(12 + L - 6, -2, 6, 4); } break;
    case "crossbow":
      ctx.fillStyle = "#5a4a32"; ctx.fillRect(2, -2.5, L, 5);
      ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(L - 4, -12); ctx.quadraticCurveTo(L + 6, 0, L - 4, 12); ctx.stroke();
      ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L - 4, -12); ctx.lineTo(12, 0); ctx.lineTo(L - 4, 12); ctx.stroke(); break;
    case "flamer":
      ctx.fillStyle = c; ctx.fillRect(-6, -9, 10, 18); ctx.fillStyle = "#2a2a2a"; ctx.fillRect(6, -2.5, L, 5);
      ctx.fillStyle = "#e0b040"; ctx.fillRect(6 + L, -3, 4, 6);
      ctx.fillStyle = `rgba(255,150,60,${0.6 + 0.4 * Math.sin(game.time / 60)})`; circle(12 + L, 0, 2.5); break;
    case "minigun": case "lmg":
      ctx.fillStyle = c; ctx.fillRect(0, -6, 18, 12);
      ctx.fillStyle = "#1e1e1e";
      if (w.look === "minigun") for (let i = -1; i <= 1; i++) ctx.fillRect(16, i * 3 - 1, L, 2.2); else ctx.fillRect(16, -2, L, 4);
      ctx.fillStyle = "#3d4436"; ctx.fillRect(4, 6, 12, 7); break;
    case "smg":
      ctx.fillStyle = c; ctx.fillRect(6, -3, L - 4, 6); ctx.fillStyle = "#1a1a1a"; ctx.fillRect(4 + L, -1.5, 6, 3);
      ctx.fillStyle = dk; ctx.fillRect(12, 3, 4, 8); break;
    default: // fuzil de assalto
      ctx.fillStyle = w.wood || w.legendary ? (w.legendary ? c : "#5a3d22") : dk; ctx.fillRect(2, -3, 10, 6);
      ctx.fillStyle = w.legendary ? shade(c, -0.2) : w.wood ? "#222" : c; ctx.fillRect(10, -3, L - 4, 6);
      ctx.fillStyle = "#1a1a1a"; ctx.fillRect(10 + L - 6, -1.5, 8, 3);
      ctx.fillStyle = w.legendary ? shade(c, -0.35) : "#333"; ctx.save(); ctx.translate(18, 3); ctx.rotate(0.3); ctx.fillRect(0, 0, 5, 9); ctx.restore();
  }
}
// braço em dois pedaços (ombro → cotovelo → mão), dobrando para fora do corpo
function limb(sx, sy, hx, hy, out, col, w1, w2) {
  const mx = (sx + hx) / 2, my = (sy + hy) / 2, dx = hx - sx, dy = hy - sy, L = Math.hypot(dx, dy) || 1;
  const bend = Math.max(0, 15 - L) * 0.55 * out;
  const ex = mx - (dy / L) * bend, ey = my + (dx / L) * bend;
  ctx.strokeStyle = col; ctx.lineCap = "round";
  ctx.lineWidth = w1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = shade(col, -0.12); ctx.lineWidth = w2; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
}
// capa presa nos ombros, balança com o vento e estica para trás quando anda
function drawCape(cp, p) {
  const t = game.time / 170, run = p.moving ? (p.sprinting ? 1.5 : 1) : 0.35;
  const len = 20 + run * 7, sw = Math.sin(t + p.x * 0.01) * (2 + run * 2.5), sw2 = Math.sin(t * 1.3 + 1) * (2 + run * 2);
  ctx.fillStyle = shade(cp.color, -0.2);
  ctx.beginPath(); ctx.moveTo(-1, -11);
  ctx.quadraticCurveTo(-len * 0.55, -15 + sw2, -len, -12 + sw);
  ctx.lineTo(-len - 2, 12 + sw);
  ctx.quadraticCurveTo(-len * 0.55, 15 + sw2, -1, 11); ctx.closePath(); ctx.fill();
  ctx.fillStyle = cp.color;
  ctx.beginPath(); ctx.moveTo(-2, -10);
  ctx.quadraticCurveTo(-len * 0.5, -12 + sw2, -len + 3, -9 + sw);
  ctx.lineTo(-len + 2, 9 + sw);
  ctx.quadraticCurveTo(-len * 0.5, 12 + sw2, -2, 10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
  for (const k of [-4, 4]) { ctx.beginPath(); ctx.moveTo(-4, k); ctx.quadraticCurveTo(-len * 0.5, k * 1.4 + sw2 * 0.6, -len + 2, k * 1.6 + sw); ctx.stroke(); }
  if (cp.trim) { ctx.strokeStyle = cp.trim; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-len + 3, -9 + sw); ctx.lineTo(-len + 2, 9 + sw); ctx.stroke(); }
}
function drawPlayer() {
  const w = curW(), p = player, pal = SKINS[save.skin] || SKINS[0];
  const skinC = pal.mask || pal.helmet || pal.skin === "#141414" ? "#2e2e2e" : pal.skin;
  const glove = pal.mask || pal.helmet || pal.hood ? "#2a2826" : skinC;
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ellipse(p.x + 4, p.y + 6, 17, 13);
  // ---- pernas: seguem a direção em que você anda, passada alternada ----
  const ma = p.moving && p.moveAng != null ? p.moveAng : p.angle;
  const ph = Math.sin(p.walk), stride = ph * (p.sprinting ? 15 : 12) * (p.walkBlend != null ? p.walkBlend : (p.moving ? 1 : 0));
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ma);
  for (const [side, st] of [[-1, stride], [1, -stride]]) {
    ctx.strokeStyle = pal.pants; ctx.lineWidth = 6.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, side * 4.5); ctx.lineTo(st, side * 5.5); ctx.stroke();
    ctx.fillStyle = "#1e1a16"; ellipse(st + 2.5 * Math.sign(st || 1), side * 5.5, 4.6, 3.4);
  }
  ctx.restore();
  // ---- tronco, capa, braços e arma: seguem a mira ----
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
  const cp = CAPES[save.cape | 0];
  if (cp && cp.color) drawCape(cp, p);
  const breathe = p.moving ? Math.sin(p.walk * 2) * 0.6 : Math.sin(game.time / 600) * 0.4;
  // mochila nas costas
  ctx.fillStyle = "#4a3c28"; rr(-15, -7, 8, 14, 3); ctx.fill(); ctx.fillStyle = "#5e4c32"; ctx.fillRect(-14, -5, 6, 3);
  // ombros e peito
  ctx.fillStyle = shade(pal.jacket, -0.18); ellipse(-0.5, 0, 9 + breathe * 0.3, 14.5);
  ctx.fillStyle = pal.jacket; ellipse(0.5, 0, 8, 13.2);
  ctx.fillStyle = "rgba(255,255,255,0.07)"; ellipse(2.5, -4, 4, 6);
  if (pal.accent) { ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(5, 10); ctx.stroke(); }
  if (save.vest >= 0) { ctx.fillStyle = VESTS[save.vest].color; ellipse(0.5, 0, 6.5, 10.5); ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(-1, -8, 2, 16); ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(2, -7, 3, 14); }
  // onde ficam as mãos com cada tipo de arma
  const SL = { x: 1, y: -11 }, SR = { x: 1, y: 11 };
  let HL, HR, swing = 0;
  const armSwing = p.moving ? -ph * 5 : 0;
  if (w.fists) {
    const jab = game.slashT > 0 ? Math.sin((game.slashT / 200) * Math.PI) * 9 : 0;
    HL = { x: 12, y: -6 }; HR = { x: 12 + jab, y: 6 };
  } else if (w.melee) {
    swing = game.slashT > 0 ? -game.slashA + (1 - game.slashT / 200) * game.slashA * 2 : -0.5;
    HR = { x: Math.cos(swing) * 9 - Math.sin(swing) * 6, y: Math.sin(swing) * 9 + Math.cos(swing) * 6 };
    HL = { x: 3 + armSwing, y: -13 };
  } else {
    // pegada de cada tipo de arma (mão de trás no gatilho, mão da frente no guarda-mão)
    const L = w.len, kick = p.flashT > 0 ? -2 : 0;
    const G = {
      pistol: [[12, 2], [10.5, -1.5]], revolver: [[12, 2], [10.5, -1.5]],
      shotgun: [[11, 2.5], [23, 0.5]], rifle: [[12, 2.5], [12 + L * 0.55, 0.5]],
      smg: [[9, 2.5], [6 + L * 0.62, 0.5]], minigun: [[8, 6], [20 + L * 0.25, -6]], lmg: [[8, 5], [16 + L * 0.45, 0.5]],
      flamer: [[8, 2.5], [6 + L * 0.5, 0.5]], crossbow: [[8, 2.5], [2 + L * 0.55, 0.5]]
    }[w.look] || [[11, 2.5], [10 + L * 0.55, 0.5]];
    HR = { x: G[0][0] + kick, y: G[0][1] }; HL = { x: G[1][0] + kick, y: G[1][1] };
  }
  // arma (por baixo das mãos)
  ctx.save();
  if (p.flashT > 0 && !w.melee) ctx.translate(-2, 0);
  // na mão a arma é desenhada vista de cima (as imagens laterais ficam nos menus)
  if (!w.fists) {
    ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 2; ctx.shadowOffsetX = 1.5; ctx.shadowOffsetY = 1.5;
    drawWeaponShape(w, swing);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    if (!w.melee && w.rar >= 3) { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = RARITY[w.rar].color + "33"; ellipse(8 + w.len / 2, 0, w.len / 2 + 4, 5); ctx.globalCompositeOperation = "source-over"; }
  }
  ctx.restore();
  // braços e mãos por cima da arma: a arma fica "na mão"
  limb(SL.x, SL.y, HL.x, HL.y, -1, pal.jacket, 5, 4.2);
  limb(SR.x, SR.y, HR.x, HR.y, 1, pal.jacket, 5, 4.2);
  ctx.fillStyle = shade(pal.jacket, 0.08); circle(SL.x, SL.y, 3.6); circle(SR.x, SR.y, 3.6);
  ctx.fillStyle = glove; circle(HL.x, HL.y, 3.1); circle(HR.x, HR.y, 3.1);
  ctx.fillStyle = "rgba(0,0,0,0.2)"; circle(HL.x - 0.8, HL.y + 0.8, 1.4); circle(HR.x - 0.8, HR.y + 0.8, 1.4);
  // cabeça (muda com o personagem)
  ctx.fillStyle = "rgba(0,0,0,0.25)"; circle(1, 1.5, 8);
  if (pal.hood || pal.helmet) {
    ctx.fillStyle = pal.hood || pal.helmet; circle(1, 0, 8.2);
    ctx.fillStyle = pal.skin; ellipse(5, 0, 3, 5);
    if (pal.helmet) { ctx.fillStyle = pal.accent || "#888"; ctx.fillRect(4, -4, 4, 8); }
  } else if (pal.mask) {
    ctx.fillStyle = pal.mask; circle(1, 0, 7.8);
    ctx.fillStyle = "#1a1a1a"; circle(6, -3, 2.2); circle(6, 3, 2.2); ctx.fillStyle = "#555"; circle(8, 0, 2.5);
  } else {
    ctx.fillStyle = pal.skin; circle(2, 0, 7.5);
    ctx.fillStyle = shade(pal.skin, -0.2); ellipse(8.5, 0, 1.6, 2); // nariz
    ctx.fillStyle = pal.hair; ctx.beginPath(); ctx.arc(0, 0, 7.8, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
    if (pal.cap) { ctx.fillStyle = pal.cap; ctx.beginPath(); ctx.arc(0, 0, 7.6, Math.PI * 0.6, Math.PI * 1.4); ctx.fill(); ellipse(6, 0, 4, 6); }
    if (pal.band) { ctx.strokeStyle = pal.band; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(1, 0, 7, -1.3, 1.3); ctx.stroke(); }
    if (pal.glasses) { ctx.fillStyle = "#111"; ctx.fillRect(6, -4, 2, 8); }
  }
  ctx.fillStyle = "rgba(255,255,255,0.1)"; circle(3, -3, 3);
  ctx.restore();
  if (p.flashT > 0 && !w.melee) {
    const tx = p.x + Math.cos(p.angle) * (w.len + 14), ty = p.y + Math.sin(p.angle) * (w.len + 14);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.translate(tx, ty); ctx.rotate(p.angle);
    ctx.fillStyle = "rgba(255,220,120,0.9)"; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(16, 0); ctx.lineTo(0, 6); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,220,0.9)"; circle(2, 0, 4);
    ctx.restore();
  }
  if (game.slashT > 0) {
    ctx.strokeStyle = `rgba(230,240,245,${(game.slashT / 200) * 0.7})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(p.x, p.y, game.slashR, game.slash - game.slashA, game.slash + game.slashA); ctx.stroke();
  }
}
function drawZombieFx(z) {
  if (z.burn > 0) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const a = game.time / 90 + i * 2.1;
      ctx.fillStyle = `rgba(255,${120 + i * 40},40,0.45)`; circle(z.x + Math.cos(a) * z.r * 0.5, z.y + Math.sin(a) * z.r * 0.5 - 4, z.r * 0.45);
    }
    ctx.globalCompositeOperation = "source-over";
  }
  if (z.stun > 0) for (let i = 0; i < 3; i++) { const a = game.time / 150 + i * 2.1; txt("✦", z.x + Math.cos(a) * z.r, z.y - z.r - 4 + Math.sin(a) * 4, 11, "#ffe66a", "center", true); }
  if (z.windT > 0) { ctx.strokeStyle = "rgba(255,60,40,0.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x + Math.cos(z.chargeAng) * 120, z.y + Math.sin(z.chargeAng) * 120); ctx.stroke(); }
  if (z.slamT > 0) { ctx.strokeStyle = `rgba(255,80,40,${0.3 + 0.5 * (1 - z.slamT / 500)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(z.x, z.y, 115 * (1 - z.slamT / 500), 0, 6.283); ctx.stroke(); }
}
function drawDog(z) {
  const s = z.r / 11;
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ellipse(z.x + 3, z.y + 5, z.r * 1.4, z.r * 0.7, z.angle);
  ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(z.angle);
  const leg = Math.sin(z.anim * 2) * 5 * s;
  ctx.fillStyle = "#3a2e26";
  ellipse(8 * s + leg, -6 * s, 3 * s, 2 * s); ellipse(8 * s - leg, 6 * s, 3 * s, 2 * s); ellipse(-9 * s - leg, -6 * s, 3 * s, 2 * s); ellipse(-9 * s + leg, 6 * s, 3 * s, 2 * s);
  ctx.strokeStyle = "#4a3a2e"; ctx.lineWidth = 3 * s; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-13 * s, 0); ctx.lineTo(-20 * s, Math.sin(z.anim * 3) * 4 * s); ctx.stroke();
  ctx.fillStyle = "#5a4636"; ellipse(0, 0, 14 * s, 6.5 * s);
  ctx.fillStyle = "rgba(120,20,20,0.6)"; circle(-3 * s, 2 * s, 2.5 * s); ctx.fillStyle = "#c9b8a8"; ellipse(-2 * s, -3 * s, 4 * s, 1.2 * s);
  ctx.fillStyle = "#4a3a2e"; ellipse(15 * s, 0, 6 * s, 5 * s); ellipse(21 * s, 0, 3.5 * s, 2.8 * s);
  ctx.fillStyle = "#2a1e18"; poly([[12 * s, -4 * s], [9 * s, -8 * s], [15 * s, -5 * s]], "#2a1e18"); poly([[12 * s, 4 * s], [9 * s, 8 * s], [15 * s, 5 * s]], "#2a1e18");
  ctx.fillStyle = z.state === "chase" ? "#ff3b2f" : "#1a1a14"; circle(17 * s, -2 * s, 1.3 * s); circle(17 * s, 2 * s, 1.3 * s);
  if (z.flash > 0) { ctx.globalAlpha = 0.6; ctx.fillStyle = "#fff"; ellipse(0, 0, 15 * s, 7 * s); ctx.globalAlpha = 1; }
  ctx.restore();
}
function drawMonster(z) {
  const s = z.r / 22, abom = z.type === "abomination", t = game.time;
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ellipse(z.x + 5, z.y + 7, z.r * 1.2, z.r * 0.95);
  ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(z.angle);
  const body = abom ? "#6a4a5a" : "#5a6a52", dark = shade(body, -0.35), sway = Math.sin(z.anim) * 4 * s;
  ctx.fillStyle = dark; ellipse(sway - 4 * s, -10 * s, 8 * s, 6 * s); ellipse(-sway - 4 * s, 10 * s, 8 * s, 6 * s);
  // braços enormes
  ctx.strokeStyle = body; ctx.lineWidth = (abom ? 13 : 10) * s; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, -16 * s); ctx.lineTo(22 * s + sway, -20 * s); ctx.moveTo(0, 16 * s); ctx.lineTo(22 * s - sway, 20 * s); ctx.stroke();
  ctx.fillStyle = "#e8dcc8"; for (const yy of [-20, 20]) { poly([[24 * s, (yy - 4) * s], [33 * s, yy * s], [24 * s, (yy + 4) * s]], "#e8dcc8"); }
  ctx.fillStyle = body; ellipse(0, 0, 17 * s, 22 * s);
  ctx.fillStyle = dark; for (let i = -2; i <= 2; i++) poly([[-12 * s, (i * 7 - 3) * s], [-24 * s, i * 7 * s], [-12 * s, (i * 7 + 3) * s]], dark);
  ctx.fillStyle = abom ? "rgba(200,80,120,0.5)" : "rgba(140,200,90,0.45)";
  for (let i = 0; i < 4; i++) circle(Math.cos(i * 1.7) * 9 * s, Math.sin(i * 2.3) * 13 * s, (3 + (i % 2) * 2) * s * (1 + 0.15 * Math.sin(t / 200 + i)));
  ctx.fillStyle = shade(body, 0.1); circle(8 * s, 0, 9 * s);
  ctx.fillStyle = "#1a0a0a"; ellipse(15 * s, 0, 3 * s, 5 * s);
  ctx.fillStyle = z.state === "chase" ? "#ff3b2f" : "#3a1a1a"; circle(11 * s, -4 * s, 2 * s); circle(11 * s, 4 * s, 2 * s);
  if (abom) { ctx.fillStyle = "#ff3b2f"; circle(5 * s, -7 * s, 1.6 * s); circle(5 * s, 7 * s, 1.6 * s); }
  if (z.flash > 0) { ctx.globalAlpha = 0.55; ctx.fillStyle = "#fff"; ellipse(0, 0, 17 * s, 22 * s); ctx.globalAlpha = 1; }
  ctx.restore();
}
function drawZombie(z) {
  if (z.hp <= 0) return;
  if (z.boss && z.bossId) { drawBoss(z); return; }
  if (!z.boss && z.type === "dog") { drawZombieFx(z); if (drawZombieSprite(z)) return; }  // cão 3D (spritesheet)
  if (!z.boss && (z.type === "dog" || z.type === "mutant" || z.type === "abomination" || z.type === "demon")) {
    if (z.type === "dog") drawDog(z); else if (z.type === "demon") drawDemon(z); else drawMonster(z);
    drawZombieFx(z);
    if (z.alertT > 0) txt("!", z.x, z.y - z.r - 8, 20, "#e03a2f", "center", true);
    if (z.hp < z.maxHp) {
      ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(z.x - z.r, z.y - z.r - 9, z.r * 2, 4);
      ctx.fillStyle = "#c0392b"; ctx.fillRect(z.x - z.r, z.y - z.r - 9, z.r * 2 * Math.max(0, z.hp / z.maxHp), 4);
    }
    return;
  }
  drawZombieFx(z);
  if (drawZombieSprite(z)) return; // zumbi humanoide com spritesheet (câmera inclinada)
  const s = z.r / 13, t = z.type;
  if (z.boss) {
    const g = ctx.createRadialGradient(z.x, z.y, z.r * 0.5, z.x, z.y, z.r * 2.2);
    g.addColorStop(0, "rgba(200,40,30,0.35)"); g.addColorStop(1, "rgba(200,40,30,0)");
    ctx.fillStyle = g; circle(z.x, z.y, z.r * 2.2);
  }
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ellipse(z.x + 4, z.y + 6, z.r * 1.1, z.r * 0.85);
  ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(z.angle);
  const sway = Math.sin(z.anim) * 4 * s, lunge = z.lunge > 0 ? 6 * s : 0;
  // pernas: passada alternada (o comum arrasta uma perna, o corredor dá passos longos)
  const ph = Math.sin(z.anim), big = t === "brute" || z.boss;
  const amp = (t === "runner" ? 11 : 7.5) * s, pants = shade(z.cloth, -0.4);
  for (const [side, k] of [[-1, 1], [1, -1]]) {
    const limp = t === "walker" && side > 0 ? 0.45 : 1, st = ph * amp * k * limp;
    ctx.strokeStyle = pants; ctx.lineWidth = (big ? 8 : 6) * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, side * 4.5 * s); ctx.lineTo(st, side * 5.5 * s); ctx.stroke();
    ctx.fillStyle = "#1c1a16"; ellipse(st + 2 * s, side * 5.5 * s, 4.2 * s, 3.2 * s);
  }
  // braços com cotovelo: esticados para frente (o corredor balança os braços)
  const skinD = shade(z.skin, -0.15), aw = (big ? 6 : 4.4) * s;
  let HL, HR;
  if (t === "runner") { HL = { x: (-3 - ph * 6) * s, y: -13 * s }; HR = { x: (-3 + ph * 6) * s, y: 13 * s }; }
  else {
    const reach = 17 * s + lunge, wob = Math.sin(z.anim * 0.5 + 1) * 2 * s;
    HL = { x: reach + sway * 0.5, y: -7 * s + wob }; HR = { x: reach - sway * 0.5, y: 7 * s - wob };
  }
  limb(1 * s, -10 * s, HL.x, HL.y, -1, z.skin, aw, aw * 0.85);
  limb(1 * s, 10 * s, HR.x, HR.y, 1, z.skin, aw, aw * 0.85);
  ctx.fillStyle = skinD; circle(HL.x, HL.y, aw * 0.62); circle(HR.x, HR.y, aw * 0.62);
  ctx.fillStyle = z.cloth; ellipse(0, 0, (t === "runner" ? 7 : 8.5) * s, 13 * s);
  ctx.fillStyle = "rgba(110,10,10,0.6)"; circle((z.stains[0] - 0.5) * 8 * s, (z.stains[1] - 0.5) * 18 * s, 3 * s); circle((z.stains[2] - 0.5) * 6 * s, (z.stains[0] - 0.5) * 14 * s, 2 * s);
  if (t === "spitter" && !z.boss) {
    const pulse = 0.8 + 0.2 * Math.sin(game.time / 150);
    ctx.fillStyle = `rgba(143,209,79,${0.8 * pulse})`; circle(-7 * s, 0, 6 * s * pulse);
    ctx.fillStyle = "rgba(220,255,160,0.5)"; circle(-8 * s, -2 * s, 2 * s);
  }
  if (z.boss) { ctx.fillStyle = "#2a1a14"; for (const yy of [-8, 0, 8]) poly([[-6 * s, (yy - 3) * s], [-15 * s, yy * s], [-6 * s, (yy + 3) * s]], "#3a2018"); }
  ctx.fillStyle = z.skin; circle(2 * s, 0, 7 * s);
  ctx.fillStyle = "rgba(0,0,0,0.18)"; circle(0, 2 * s, 4 * s);
  const chase = z.state === "chase";
  ctx.fillStyle = chase ? "#ff3b2f" : "#1a2214";
  circle(7 * s, -2.6 * s, 1.8 * s); circle(7 * s, 2.6 * s, 1.8 * s);
  if (z.flash > 0) { ctx.globalAlpha = 0.6; ctx.fillStyle = "#fff"; circle(0, 0, z.r); ctx.globalAlpha = 1; }
  ctx.restore();
  if (z.alertT > 0) txt("!", z.x, z.y - z.r - 8, 20, "#e03a2f", "center", true);
  if (!z.boss && z.hp < z.maxHp) {
    ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(z.x - 13, z.y - z.r - 9, 26, 4);
    ctx.fillStyle = "#c0392b"; ctx.fillRect(z.x - 13, z.y - z.r - 9, 26 * Math.max(0, z.hp / z.maxHp), 4);
  }
}
function drawProjectiles() {
  for (const b of bullets) {
    if (b.fire) {
      const age = 1 - b.life / b.max, r = 5 + age * 16;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,${Math.round(180 - age * 140)},40,${0.55 * (1 - age)})`; circle(b.x, b.y, r);
      ctx.fillStyle = `rgba(255,240,180,${0.5 * (1 - age)})`; circle(b.x, b.y, r * 0.4);
      ctx.globalCompositeOperation = "source-over";
      continue;
    }
    if (b.grenade) {
      ctx.fillStyle = "#2a2a2a"; circle(b.x, b.y, 5); ctx.fillStyle = "#c0392b"; circle(b.x, b.y, 2);
      ctx.fillStyle = "rgba(180,180,180,0.25)"; circle(b.px - b.vx * 2, b.py - b.vy * 2, 4);
      continue;
    }
    if (b.bolt) {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a); ctx.fillStyle = "#8a6a45"; ctx.fillRect(-16, -1, 16, 2); poly([[0, -3], [5, 0], [0, 3]], "#c9ced2"); ctx.restore();
      continue;
    }
    ctx.strokeStyle = b.explode ? "rgba(150,190,255,0.95)" : b.color || (b.big ? "rgba(255,240,180,0.95)" : "rgba(255,225,140,0.85)"); ctx.lineWidth = b.big ? 2.5 : 1.8;
    ctx.beginPath(); ctx.moveTo(b.px - b.vx * 0.6, b.py - b.vy * 0.6); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const f of game.flashes) {
    const k = f.t / 220;
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
    g.addColorStop(0, `rgba(255,230,160,${0.8 * k})`); g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g; circle(f.x, f.y, f.r);
    ctx.globalCompositeOperation = "source-over";
  }
  for (const s of game.spits) {
    ctx.fillStyle = "rgba(143,209,79,0.35)"; circle(s.x, s.y, 9);
    ctx.fillStyle = "#a6e05a"; circle(s.x, s.y, 5);
  }
  for (const p of game.parts) {
    ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.5));
    ctx.fillStyle = p.color;
    if (p.shell) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-2, -1, 4, 2); ctx.restore(); }
    else circle(p.x, p.y, p.size);
  }
  ctx.globalAlpha = 1;
}

// =====================================================================
//  Luz (dia e noite, lanterna, postes) e efeitos de tela
// =====================================================================
function holeTo(c, x, y, r, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
}
function hole(x, y, r, a) { holeTo(lctx, x, y, r, a); }
function drawLighting() {
  // Noite ainda é perigosa, porém 25% mais legível do que a versão anterior.
  const baseDark = game.inside ? (game.inside.safe ? 0.12 : 0.26 + darkness() * 0.3) : darkness();
  const dark = Math.min(0.78, baseDark * 0.75);
  if (dark < 0.03) return;
  lctx.globalCompositeOperation = "source-over"; lctx.clearRect(0, 0, W, H);
  lctx.fillStyle = `rgba(6,10,24,${dark})`; lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = "destination-out";
  const chest = typeof chestPoint === "function" ? chestPoint() : player;
  const px = chest.x - cam.x, py = chest.y - cam.y;
  if (!game.over && flashlightActive()) {
    // Recorta a luz do jogador ANTES de abrir a escuridão. Assim nem
    // o halo próximo nem o feixe atravessam casas, telhados ou postes.
    flashCutCanvas();
    const beam = FLASH_BLOCK.cutCtx;
    beam.setTransform(1, 0, 0, 1, 0, 0);
    beam.clearRect(0, 0, W, H);
    beam.globalCompositeOperation = "source-over";
    holeTo(beam, px, py, 153, 0.91);
    if (dark > 0.3) {
      const len = 435, half = 0.50, g = beam.createRadialGradient(px, py, 10, px, py, len);
      g.addColorStop(0, "rgba(0,0,0,0.95)"); g.addColorStop(0.6, "rgba(0,0,0,0.65)"); g.addColorStop(1, "rgba(0,0,0,0)");
      beam.fillStyle = g;
      beam.beginPath(); beam.moveTo(px, py);
      beam.arc(px, py, len, player.angle - half, player.angle + half);
      beam.closePath(); beam.fill();
    }
    beam.globalCompositeOperation = "destination-out";
    beam.drawImage(flashlightBlocks(), 0, 0, W, H);
    beam.globalCompositeOperation = "source-over";
    lctx.globalCompositeOperation = "destination-out";
    lctx.drawImage(FLASH_BLOCK.cut, 0, 0);
    if (player.flashT > 0) hole(px + Math.cos(player.angle) * 40, py + Math.sin(player.angle) * 40, 230, 0.85);
  }
  const lamps = game.inside ? [] : world.lamps.filter((l) => inView(l.x - 220, l.y - 220, 440, 440));
  for (const l of lamps) hole(l.x - cam.x, l.y - (l.big ? 53 : 40) - cam.y, l.big ? 230 : 145, 0.9);
  if (!game.inside) for (const m of world.models || []) if (m.id === "worklight" &&
      inView(m.x - 160, m.y - 170, 320, 300)) {
    hole(m.x - cam.x, m.y - 29 * (m.k || MODEL_K) / MODEL_K - cam.y, 145, 0.86);
  }
  if (game.inside && game.inside.safe) hole(W / 2, H / 2, 500, 0.5);
  for (const s of game.spits) hole(s.x - cam.x, s.y - cam.y, 40, 0.6);
  for (const b of bullets) if (b.fire && Math.random() < 0.5) hole(b.x - cam.x, b.y - cam.y, 60, 0.5);
  for (const f of game.flashes) hole(f.x - cam.x, f.y - cam.y, f.r * 1.5, f.t / 220);
  ctx.drawImage(lightC, 0, 0, W, H);
  if (!game.inside && dark > 0.3) {
    ctx.globalCompositeOperation = "lighter";
    for (const l of lamps) {
      const x = l.x - cam.x, y = l.y - (l.big ? 53 : 40) - cam.y, r = l.big ? 200 : 125;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,190,110,${0.16 * dark})`); g.addColorStop(1, "rgba(255,190,110,0)");
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }
}
function drawScreenFx() {
  ctx.drawImage(vignetteC, 0, 0, W, H);
  const low = player.hp / player.maxHp;
  const a = (game.hurtT / 350) * 0.4 + (low < 0.3 ? (0.3 - low) * (0.8 + 0.4 * Math.sin(performance.now() / 180)) : 0);
  if (a > 0.01) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, "rgba(160,0,0,0)"); g.addColorStop(1, `rgba(160,0,0,${Math.min(0.7, a)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}

// =====================================================================
//  HUD
// =====================================================================
function panel(x, y, w, h) {
  ctx.fillStyle = "rgba(10,12,10,0.62)"; rr(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = "rgba(229,224,200,0.12)"; ctx.lineWidth = 1; ctx.stroke();
}
function hbar(x, y, w, h, v, color, label) {
  ctx.fillStyle = "rgba(0,0,0,0.6)"; rr(x, y, w, h, 3); ctx.fill();
  if (v > 0) {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(color, 0.25)); g.addColorStop(1, shade(color, -0.2));
    ctx.fillStyle = g; rr(x, y, Math.max(4, w * clamp(v, 0, 1)), h, 3); ctx.fill();
  }
  if (label) txt(label, x + 6, y + h - 3, h >= 14 ? 11 : 10, "#f2eedc", "left", true);
}
function clockText() {
  const m = Math.floor(game.clock) % 1440, d = Math.floor(game.clock / 1440) + 1;
  return `Dia ${d} · ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}${isNight() ? " · noite" : ""}${GFX.on ? gfxWeatherName() : ""}`;
}
// dentro de um prédio: planta só do andar atual (paredes, móveis, escadas, saída, zumbis e você)
function drawInteriorMinimap(x, y, w, h) {
  const b = game.inside, iw = b.iw || W, ih = b.ih || H, lvl = b.level | 0;
  const k = Math.min((w - 12) / iw, (h - 22) / ih), ox = x + (w - iw * k) / 2, oy = y + 4 + (h - 18 - ih * k) / 2;
  ctx.save(); rr(x, y, w, h, 8); ctx.clip();
  ctx.fillStyle = "#121411"; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = b.safe ? "#2c3a30" : shade(b.color || "#5a5a55", -0.35); ctx.fillRect(ox, oy, iw * k, ih * k);
  ctx.fillStyle = "#3a3d38"; ctx.fillRect(ox + 40 * k, oy + 40 * k, (iw - 80) * k, (ih - 80) * k);
  for (const f of b.interior) {
    let c;
    if (f.kind === "stairs") c = "#ffd96a";
    else if (f.kind === "decor") c = "#4e524a";
    else if (SAFE_KINDS.includes(f.kind)) c = "#6fae4f";
    else c = f.opened || f.searchable === false ? "#5a5a52" : "#c9a040";
    ctx.fillStyle = c; ctx.fillRect(ox + f.x * k, oy + f.y * k, Math.max(2, f.w * k), Math.max(2, f.h * k));
    if (f.kind === "stairs") txt(f.dir > 0 ? (b.def.under ? "▼" : "▲") : b.def.under ? "▲" : "▼", ox + (f.x + f.w / 2) * k, oy + (f.y + f.h / 2) * k + 4, 10, "#141410", "center", true);
  }
  if (lvl === 0) { ctx.fillStyle = "#8a5a2e"; ctx.fillRect(ox + (iw / 2 - 50) * k, oy + (ih - 40) * k, 100 * k, 40 * k); }
  for (const z of b.zombies) {
    if (z.hp <= 0) continue;
    ctx.fillStyle = z.state === "chase" ? "#ff5a4a" : "rgba(200,70,60,0.85)";
    ctx.fillRect(ox + z.x * k - 2, oy + z.y * k - 2, 4, 4);
  }
  for (const online of fmSocial.inSector()) {
    ctx.fillStyle = fmSocial.isFriend(online.uid) ? "#8fe0a8" : "#73ceff";
    ctx.fillRect(ox + online.x * k - 2, oy + online.y * k - 2, 4, 4);
  }
  // área visível na tela
  ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1;
  if (iw > W || ih > H) ctx.strokeRect(ox + cam.x * k, oy + cam.y * k, Math.min(W, iw) * k, Math.min(H, ih) * k);
  ctx.save(); ctx.translate(ox + player.x * k, oy + player.y * k); ctx.rotate(player.angle);
  poly([[7, 0], [-5, -5], [-2, 0], [-5, 5]], "#ffd96a"); ctx.restore();
  const fl = buildingFloors(b);
  txt(fl > 1 ? `${floorName(b, lvl)} · ${lvl + 1}/${fl}` : b.safe ? "Base" : "Térreo", x + w / 2, y + h - 5, 10, "#e5e0c8", "center", true);
  ctx.restore();
}
function drawMinimap(x, y, w, h) {
  if (game.inside) { drawInteriorMinimap(x, y, w, h); return; }
  const pp = game.inside ? game.exitPos : player;
  let sw = Math.min(1800 * MS, world.mini.width), sh = sw * (h / w);
  if (sh > world.mini.height) { sh = world.mini.height; sw = sh * (w / h); }
  const sx = clamp(pp.x * MS - sw / 2, 0, world.mini.width - sw), sy = clamp(pp.y * MS - sh / 2, 0, world.mini.height - sh);
  const k = w / sw;
  ctx.save(); rr(x, y, w, h, 8); ctx.clip();
  ctx.drawImage(world.mini, sx, sy, sw, sh, x, y, w, h);
  if (!game.inside) for (const z of zombies) {
    if (Math.hypot(z.x - player.x, z.y - player.y) > 650) continue;
    ctx.fillStyle = z.boss ? "#ff3b2f" : z.state === "chase" ? "#e05a4a" : "rgba(160,60,50,0.8)";
    ctx.fillRect(x + (z.x * MS - sx) * k - (z.boss ? 3 : 1.5), y + (z.y * MS - sy) * k - (z.boss ? 3 : 1.5), z.boss ? 6 : 3, z.boss ? 6 : 3);
  }
  // Marcadores dos outros sobreviventes conectados nesta área.
  for (const online of fmSocial.inSector()) {
    const pxOnline = x + (online.x * MS - sx) * k, pyOnline = y + (online.y * MS - sy) * k;
    if (pxOnline < x || pxOnline > x + w || pyOnline < y || pyOnline > y + h) continue;
    ctx.fillStyle = fmSocial.isFriend(online.uid) ? "#8fe0a8" : "#73ceff";
    circle(pxOnline, pyOnline, 4.5);
    ctx.strokeStyle = "#0b1415"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(pxOnline, pyOnline, 4.5, 0, 6.283); ctx.stroke();
  }
  // implante Faro: mostra lugares com saque por perto
  if (player.fx.lootSense > 0 && !game.inside) {
    const R = player.fx.lootSense;
    for (const o of world.loot.query(player.x - R, player.y - R, player.x + R, player.y + R)) {
      if (o.opened || o.kind === "door" || Math.hypot(o.x - player.x, o.y - player.y) > R) continue;
      ctx.fillStyle = "#ffd96a"; ctx.fillRect(x + ((o.x + o.w / 2) * MS - sx) * k - 1.5, y + ((o.y + o.h / 2) * MS - sy) * k - 1.5, 3, 3);
    }
  }
  for (const o of OUTPOSTS) {
    const b = world.outposts[o.id];
    if (!b) continue;
    const bx = x + ((b.x + b.w / 2) * MS - sx) * k, by = y + ((b.y + b.h / 2) * MS - sy) * k;
    if (bx > x && bx < x + w && by > y && by < y + h) txt("⌂", bx, by + 5, 14, save.outposts[o.id] ? "#8fe0a8" : "#5a6a5a", "center", true);
  }
  const px = x + (pp.x * MS - sx) * k, py = y + (pp.y * MS - sy) * k;
  ctx.save(); ctx.translate(px, py); ctx.rotate(player.angle);
  poly([[7, 0], [-5, -5], [-2, 0], [-5, 5]], "#ffd96a"); ctx.restore();
  ctx.restore();
  ctx.strokeStyle = "rgba(229,224,200,0.3)"; ctx.lineWidth = 1.5; rr(x, y, w, h, 8); ctx.stroke();
  txt("N", x + w / 2, y + 12, 10, "rgba(229,224,200,0.6)", "center", true);
}
// Painel fica quase transparente quando algo importante está embaixo dele
function hudFade(key, x, y, w, h) {
  const m = 24, over = (px, py) => px > x - m && px < x + w + m && py > y - m && py < y + h + m;
  let hit = !game.over && (over(player.x - cam.x, player.y - cam.y) || (key !== "bn" && over(mouse.x, mouse.y)));
  if (!hit) for (const z of Zs()) if (z.hp > 0 && over(z.x - cam.x, z.y - cam.y)) { hit = true; break; }
  if (!hit && key !== "mm") { // o minimapa só some pelo personagem, zumbis ou mouse
    const objs = game.inside ? game.inside.interior : world.loot.query(cam.x + x - m, cam.y + y - m, cam.x + x + w + m, cam.y + y + h + m);
    for (const o of objs) if (o.x - cam.x < x + w && o.x + o.w - cam.x > x && o.y - cam.y < y + h && o.y + o.h - cam.y > y) { hit = true; break; }
  }
  game.hudA = game.hudA || {};
  const cur = game.hudA[key] == null ? 1 : game.hudA[key];
  game.hudA[key] = cur + ((hit ? 0.18 : 1) - cur) * 0.18;
  return game.hudA[key];
}
// ---------- HUD: barras no topo, lista de armas embaixo, mensagens no canto ----------
function hudT(s, x, y, size, color, align, bold, maxW) {
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 3; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
  txt(s, x, y, size, color, align, bold, maxW); ctx.restore();
}
function hudIcon(kind, x, y, col) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.55)"; circle(0, 0, 13);
  ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = col; ctx.strokeStyle = col;
  if (kind === "vida") { ctx.beginPath(); ctx.moveTo(0, 7); ctx.bezierCurveTo(-11, -1, -6, -10, 0, -4); ctx.bezierCurveTo(6, -10, 11, -1, 0, 7); ctx.fill(); }
  else if (kind === "fome") { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(-4, 7); ctx.moveTo(-7, -7); ctx.lineTo(-7, -2); ctx.moveTo(-1, -7); ctx.lineTo(-1, -2); ctx.moveTo(-7, -2); ctx.lineTo(-1, -2); ctx.stroke(); ellipse(5, -2, 3, 5); ctx.fillRect(4, 2, 2, 6); }
  else if (kind === "sede") { ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(7, 1, 6, 3); ctx.arc(0, 3, 6, 0, Math.PI); ctx.quadraticCurveTo(-7, 1, 0, -8); ctx.fill(); }
  else if (kind === "infec") { circle(0, -4, 3.4); circle(-4.5, 3, 3.4); circle(4.5, 3, 3.4); ctx.fillStyle = "rgba(0,0,0,0.6)"; circle(0, 0, 2); }
  else { rr(-6, -6, 12, 13, 3); ctx.fill(); ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(-4, 0, 8, 3); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -6, 3.5, Math.PI, 0); ctx.stroke(); }
  ctx.restore();
}
function hudStat(i, kind, label, v, max, col) {
  const x = 10 + i * 128, y = 8, pct = Math.round((100 * v) / max);
  hudIcon(kind, x + 13, y + 15, col);
  hudT(label, x + 32, y + 10, 11, col, "left", true);
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x + 32, y + 14, 88, 5);
  ctx.fillStyle = col; ctx.fillRect(x + 32, y + 14, 88 * clamp(v / max, 0, 1), 5);
  hudT(`${Math.ceil(v)} / ${max} (${pct}%)`, x + 32, y + 31, 10, "#c9c4ad", "left");
}
function hudLevel(p, lo, mid, words) { return p > mid ? [words[0], "#6fd06a"] : p > lo ? [words[1], "#e0c341"] : [words[2], "#e05a4a"]; }
function drawHUD() {
  const compact = save.hud === 1;
  ctx.globalAlpha = 1;
  // nome em cima do personagem
  if (!game.over) hudT(playerName(), player.x - cam.x, player.y - cam.y - (useSpriteChar() ? 54 : 28), 10, "#8fe08a", "center", true);
  // prédio do resgate: "SOS" piscando em cima do telhado (por cima da luz)
  const rb = !game.inside && rescueBuilding();
  if (rb) {
    const p = 0.55 + 0.45 * Math.sin(game.time / 200), sx = rb.x + rb.w / 2 - cam.x, sy = rb.y + rb.h / 2 - cam.y;
    ctx.globalAlpha = p; ctx.fillStyle = "rgba(0,40,10,0.6)"; rr(sx - 30, sy - 16, 60, 26, 8); ctx.fill();
    hudT("SOS", sx, sy + 4, 18, "#6fff9a", "center", true); ctx.globalAlpha = 1;
  }
  // ---- topo esquerdo: vida, fome, sede e mochila ----
  const hpP = player.hp / player.maxHp;
  let [l, c] = hudLevel(hpP, 0.35, 0.7, ["SAUDÁVEL", "FERIDO", "CRÍTICO"]);
  hudStat(0, "vida", l, player.hp, player.maxHp, c);
  [l, c] = hudLevel(player.hunger / 100, 0.25, 0.6, ["SATISFEITO", "COM FOME", "FAMINTO"]);
  hudStat(1, "fome", l, player.hunger, 100, c);
  [l, c] = hudLevel(player.thirst / 100, 0.25, 0.6, ["HIDRATADO", "COM SEDE", "DESIDRATADO"]);
  hudStat(2, "sede", l, player.thirst, 100, c);
  const used = packUsed();
  [l, c] = hudLevel(1 - used / PACK_MAX, 0, 0.5, ["ESPAÇOSA", "QUASE CHEIA", "CHEIA"]);
  hudStat(3, "mochila", l, used, PACK_MAX, c);
  const inf = player.infect || 0;
  [l, c] = inf < 30 ? ["LIMPO", "#6fd06a"] : inf < 70 ? ["INFECTADO", "#e0c341"] : inf < 100 ? ["GRAVE", "#e05a4a"] : ["TERMINAL", "#ff3b2f"];
  hudStat(4, "infec", l, inf, 100, c);
  // ---- linhas de texto embaixo das barras ----
  let ny = 64;
  hudT(playerName().toUpperCase(), 12, ny, 12, "#ffd96a", "left", true); ny += 15;
  const xpTxt = player.level >= MAX_LEVEL ? "MÁXIMO" : `${Math.floor(player.xp)} / ${xpNeed(player.level)} (${Math.floor((100 * player.xp) / xpNeed(player.level))}%)`;
  hudT(`NÍV ${player.level}: ${xpTxt}`, 12, ny, 11, "#e5e0c8", "left", true); ny += 15;
  hudT(`ENERGIA: ${Math.round(player.stamina)}%${player.exhausted ? " · EXAUSTO" : ""}`, 12, ny, 11, player.exhausted ? "#e05a4a" : "#e5e0c8", "left", true); ny += 15;
  if (!compact) {
    if (save.vest >= 0) { const vd = Math.round(vestDur()); hudT(`COLETE: ${VESTS[save.vest].name.toUpperCase()} ${vd}%${vd <= 0 ? " · QUEBRADO" : ""}`, 12, ny, 10, vd <= 25 ? "#e05a4a" : "#c9c4ad", "left", true); ny += 14; }
    ny += 6;
    const RG = REGIONS[world.cell.tier], rc = RG.color === "#2a2a2e" ? "#9a9aa0" : RG.color;
    if (inSafe()) hudT("ÁREA SEGURA", 12, ny, 11, "#6fd06a", "left", true);
    else hudT(`PERIGO: ${RG.diff.toUpperCase()}`, 12, ny, 11, rc, "left", true);
    ny += 15;
    if (player.points + player.wpoints > 0) { hudT(`${player.points + player.wpoints} PONTOS PARA GASTAR (C)`, 12, ny, 10, "#ffd96a", "left", true); ny += 14; }
    if (player.hunger <= 0 || player.thirst <= 0) { hudT("COM FOME OU SEDE A ENERGIA NÃO VOLTA", 12, ny, 10, "#e07b5a", "left", true); ny += 14; }
    if (inf >= 100) { hudT("INFECÇÃO TERMINAL: VOCÊ PERDE VIDA · ANTIBIÓTICO (I)", 12, ny, 10, "#ff3b2f", "left", true); ny += 14; }
    const rm = rescueMission();
    if (rm) { hudT(game.escort ? "RESGATE: LEVE O SOBREVIVENTE A UM POSTO" : `RESGATE: SOBREVIVENTE EM ${rm.code}`, 12, ny, 10, "#8fe0a8", "left", true); ny += 14; }
  }
  game.hudBonusY = ny + 14;

  // ---- topo direito: nome da área, minimapa e hora ----
  const pp = game.inside ? game.exitPos : player;
  const RG = REGIONS[world.cell.tier], rc = RG.color === "#2a2a2e" ? "#9a9aa0" : RG.color;
  const mw = compact ? 120 : 172, mh = compact ? 104 : 150, mx = W - mw - 10, my = 22;
  // um pouco transparente sempre; quase some quando o personagem, um zumbi ou o mouse passa por baixo
  ctx.globalAlpha = 0.8 * hudFade("mm", mx - 34, 0, mw + 34, mh + 40);
  hudT((game.inside ? game.inside.name : locationName(pp.x, pp.y)).toUpperCase(), mx + mw / 2, 15, 10, "#e5e0c8", "center", true, mw + 20);
  drawMinimap(mx, my, mw, mh);
  ctx.strokeStyle = "rgba(160,60,50,0.7)"; ctx.lineWidth = 1.5; ctx.strokeRect(mx, my, mw, mh);
  hudT(`${world.cell.code} · ${RG.name}`, mx + mw / 2, my + mh + 13, 10, rc, "center", true, mw);
  // sol / lua e hora ao lado do minimapa
  const night = isNight();
  ctx.save(); ctx.translate(mx - 16, my + 12);
  if (night) { ctx.fillStyle = "#cfd8ff"; circle(0, 0, 7); ctx.fillStyle = "#0e1220"; circle(3, -2, 6); }
  else { ctx.fillStyle = "#ffe9a0"; circle(0, 0, 5); ctx.strokeStyle = "#ffe9a0"; ctx.lineWidth = 1.6; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7.5, Math.sin(a) * 7.5); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.stroke(); } }
  ctx.restore();
  hudT(clockText(), mx - 6, my + 36, 10, night ? "#8fb3ff" : "#e5e0c8", "right", true);
  ctx.globalAlpha = 1;

  // ---- baixo esquerdo: lista das armas + arma em uso e munição ----
  const w = curW(), inst = curInst();
  const ly = H - 92;
  for (let i = 0; i < SLOT_N; i++) {
    const it = player.slots[i], sel = i === player.cur;
    const name = it ? instName(it).toUpperCase() : "—";
    const col = sel ? "#ff6a4a" : it && !canUse(WDEF[it.id]) ? "#8a6a5a" : "#e5e0c8";
    hudT(`${i + 1}. ${name}`, 12, ly + i * 15, 12, col, "left", sel);
  }
  if (inst) {
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 4;
    drawWeaponSide(w, 62, H - 26, 0.5);
    ctx.restore();
  }
  let ammoTxt, ammoCol = "#e5e0c8";
  if (w.melee) ammoTxt = "∞";
  else if (w.infinite) ammoTxt = `${inst.ammo} / ∞`;
  else { ammoTxt = `${inst.ammo} / ${player.reserve[w.ammo]}`; if (inst.ammo === 0) ammoCol = "#e05a4a"; }
  hudT(ammoTxt, 122, H - 20, 18, ammoCol, "left", true);
  if (player.reloading > 0) {
    const oneByOne = w.id === "caca" && player.reloadRound;
    hudT(oneByOne ? `RECARREGANDO ${inst.ammo}/${w.mag}` : "RECARREGANDO",
      122, H - 42, 10, "#ffd96a", "left", true);
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(122, H - 38, 90, 4);
    const progress = oneByOne
      ? (inst.ammo + (1 - player.reloading / (player.reloadMax || 1))) / w.mag
      : (1 - player.reloading / (player.reloadMax || 1));
    ctx.fillStyle = "#ffd96a"; ctx.fillRect(122, H - 38, 90 * Math.max(0, Math.min(1, progress)), 4);
  } else if (w.infinite && player.spin > 0) { ctx.fillStyle = "#e0c341"; ctx.fillRect(122, H - 38, 90 * player.spin, 4); }

  // ---- baixo esquerdo (acima das armas): últimas mensagens ----
  const log = (game.log || []).filter((m) => game.time - m.at < 7000 || performance.now() - m.real < 7000).slice(-5);
  log.forEach((m, i) => {
    const age = performance.now() - m.real;
    ctx.globalAlpha = clamp((7000 - age) / 800, 0, 1);
    hudT(m.text, 12, H - 108 - (log.length - 1 - i) * 15, 11, "#e8c84a", "left", true, 420);
  });
  ctx.globalAlpha = 1;

  // chefe por perto
  const boss = Zs().find((z) => z.boss && z.hp > 0 && Math.hypot(z.x - player.x, z.y - player.y) < 900);
  if (boss) {
    hbar(W / 2 - 120, 60, 360, 14, boss.hp / boss.maxHp, "#b03a2e");
    ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 1.5; rr(W / 2 - 120, 60, 360, 14, 3); ctx.stroke();
    txt(`${boss.bossName || "Chefe"} · ${Math.ceil(Math.max(0, boss.hp))}/${boss.maxHp}${boss.half ? "" : " · chama a horda com 50%"}`, W / 2 + 60, 90, 13, "#e5e0c8", "center", true);
  } else drawBossCompass();

  // faixa de aviso (zona, nível, chefe)
  if (game.banner) {
    const a = Math.min(1, game.banner.t / 500);
    ctx.globalAlpha = a;
    txt(game.banner.text, W / 2, 140, 30, game.banner.color || (game.banner.gold ? "#ffd96a" : "#e5e0c8"), "center", true);
    if (game.banner.sub) txt(game.banner.sub, W / 2, 164, 15, "#c9c4ad", "center");
    ctx.globalAlpha = 1;
  }

  // o que dá para fazer aqui: texto no centro de baixo
  const s = nearSpot();
  if (s && !game.over) {
    const label = spotPrompt(s).toUpperCase().replace("SEGURE E: ", "SEGURE E PARA ").replace(/^E: /, "E PARA ");
    hudT(label, W / 2, H - 30, 12, "#e5e0c8", "center", true);
    const sr = game.search;
    if (sr && sr.spot === s) {
      const bw = 180, bx = W / 2 - bw / 2, by = H - 22, f = Math.min(1, sr.t / sr.dur);
      ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(bx, by, bw, 6);
      ctx.fillStyle = "#ffd96a"; ctx.fillRect(bx + 1, by + 1, (bw - 2) * f, 4);
    }
  }
}
function drawGameOver() {
  ctx.fillStyle = "rgba(20,0,0,0.75)"; ctx.fillRect(0, 0, W, H);
  txt("Você morreu", W / 2, H / 2 - 40, 52, "#e5e0c8", "center", true);
  txt(`Área mais perigosa: ${REGIONS[regionOf(game.best)].name} · ${game.kills} abates · ${game.score} pontos · ${clockText()}`, W / 2, H / 2 + 6, 18, "#c9c4ad", "center");
  txt(`Dinheiro perdido: $${game.lost} · Protegido pelo cofre: $${game.money} · Banco: $${save.bank}`, W / 2, H / 2 + 36, 15, "#c9c4ad", "center", false, W - 60);
  txt("Armas, itens e créditos preservados. Enter para voltar ao Refúgio", W / 2, H / 2 + 76, 17, "#ffd96a", "center", true);
}
