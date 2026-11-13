"use strict";
// =====================================================================
//  Utilidades: números aleatórios, geometria, cores e grade espacial
// =====================================================================

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr, r) { return arr[Math.floor((r || Math.random)() * arr.length)]; }

// gerador com semente (a cidade é sempre a mesma)
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hits(rects, x, y, w, h, m) {
  return rects.some((o) => x < o.x + o.w + m && x + w > o.x - m && y < o.y + o.h + m && y + h > o.y - m);
}
function rectDist(px, py, o) {
  const cx = Math.max(o.x, Math.min(px, o.x + o.w)), cy = Math.max(o.y, Math.min(py, o.y + o.h));
  return Math.hypot(px - cx, py - cy);
}
function inRect(x, y, o) { return x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h; }
function angDiff(a, b) { const d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); }

// clareia (f > 0) ou escurece (f < 0) uma cor "#rrggbb"
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  const h = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
  return "#" + h(r) + h(g) + h(b);
}

// Grade espacial: acha rápido os objetos perto de um ponto
const EMPTY = [];
class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); this.stamp = 0; this.sym = Symbol("grid"); }
  key(cx, cy) { return cx * 4096 + cy; }
  add(o) {
    const c = this.cell;
    for (let cx = Math.floor(o.x / c); cx <= Math.floor((o.x + o.w) / c); cx++)
      for (let cy = Math.floor(o.y / c); cy <= Math.floor((o.y + o.h) / c); cy++) {
        const k = this.key(cx, cy);
        let l = this.map.get(k);
        if (!l) { l = []; this.map.set(k, l); }
        l.push(o);
      }
  }
  remove(o) {
    const c = this.cell;
    for (let cx = Math.floor(o.x / c); cx <= Math.floor((o.x + o.w) / c); cx++)
      for (let cy = Math.floor(o.y / c); cy <= Math.floor((o.y + o.h) / c); cy++) {
        const l = this.map.get(this.key(cx, cy));
        if (l) { const i = l.indexOf(o); if (i >= 0) l.splice(i, 1); }
      }
  }
  query(x0, y0, x1, y1) {
    const c = this.cell, s = ++this.stamp, out = [], sym = this.sym;
    for (let cx = Math.floor(x0 / c); cx <= Math.floor(x1 / c); cx++)
      for (let cy = Math.floor(y0 / c); cy <= Math.floor(y1 / c); cy++) {
        const l = this.map.get(this.key(cx, cy));
        if (!l) continue;
        for (const o of l) if (o[sym] !== s) { o[sym] = s; out.push(o); }
      }
    return out;
  }
  at(x, y) { return this.map.get(this.key(Math.floor(x / this.cell), Math.floor(y / this.cell))) || EMPTY; }
}
