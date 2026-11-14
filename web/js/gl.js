"use strict";
// =====================================================================
//  Motor gráfico WebGL: luz dinâmica, sombras dos prédios, brilho (bloom),
//  neblina, chuva, relâmpagos, onda de choque e pós-processamento.
//  A cidade continua sendo desenhada em Canvas 2D (numa tela escondida);
//  o WebGL pega essa imagem e aplica a luz e os efeitos por cima.
//  Se o WebGL não existir no PC, o jogo volta sozinho ao modo antigo.
// =====================================================================
const MAXL = 32;
const GFX = {
  on: false, gl: null, cv: null, scene: null, sctx: null, mask: null, mctx: null,
  P: {}, T: {}, lit: null, b1: null, b2: null, waves: [], flash: 0, tint: [1, 1, 1], failed: false,
  wx: { rain: 0, fog: 0, tRain: 0, tFog: 0, storm: false, kind: 0, timer: 150000, bolt: 6000 }, rs: null
};
const GFX_Q = ["Baixo (sem WebGL)", "Médio", "Alto"];
const WEATHER = [
  { name: "", rain: 0, fog: 0 },
  { name: "neblina", rain: 0, fog: 0.75, msg: "Uma neblina densa cobre a cidade" },
  { name: "chuva", rain: 0.8, fog: 0.15, msg: "Começou a chover" },
  { name: "tempestade", rain: 1, fog: 0.3, storm: true, msg: "Tempestade! Relâmpagos iluminam as ruas" }
];
// tom de cor por faixa de dificuldade: azul, verde, amarela, laranja, vermelha, vermelho-escura, preta, roxa, cinza
const REGION_TINT = [[0.97, 1, 1.04], [0.98, 1.02, 0.97], [1.02, 1.01, 0.94], [1.04, 0.98, 0.92], [1.06, 0.93, 0.9],
  [1.08, 0.9, 0.86], [0.92, 0.9, 0.92], [1.0, 0.9, 1.06], [0.9, 0.9, 0.9]];

// ---------- Shaders ----------
const VS = "attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }";
const FS_HEAD = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; } return v; }
`;
// 1) luz, sombra, neblina e chuva
const FS_LIT = FS_HEAD + `
#define MAXL ${MAXL}
uniform sampler2D uScene; uniform sampler2D uMask;
uniform vec2 uRes; uniform vec2 uMaskTexel; uniform vec2 uCam; uniform vec2 uPlayer;
uniform float uDark; uniform float uDayShadow; uniform float uTime; uniform float uFog; uniform float uRain; uniform float uFlash;
uniform int uN; uniform vec4 uL[MAXL]; uniform vec4 uC[MAXL]; uniform vec4 uK[MAXL];
float maskAt(vec2 uv){ vec2 t = uMaskTexel * 1.5;
  return (texture2D(uMask, uv).r * 2.0 + texture2D(uMask, uv + vec2(t.x, 0.0)).r + texture2D(uMask, uv - vec2(t.x, 0.0)).r
        + texture2D(uMask, uv + vec2(0.0, t.y)).r + texture2D(uMask, uv - vec2(0.0, t.y)).r) / 6.0; }
float rainLayer(vec2 p, float sc, float sp, float dens){
  p.x += p.y * 0.22;
  float col = floor(p.x / sc);
  float y = p.y / (sc * 16.0) - uTime * sp + hash(vec2(col, sc)) * 7.0;
  float f = fract(y);
  float on = step(hash(vec2(col, floor(y))), dens);
  float x = abs(fract(p.x / sc) - 0.5);
  return on * smoothstep(0.2, 0.0, x) * smoothstep(0.0, 0.25, f) * smoothstep(0.8, 0.5, f);
}
void main(){
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec3 col = texture2D(uScene, vUv).rgb;
  float m = maskAt(vUv);
  float base = 1.0 - uDark;
  vec3 light = vec3(base * mix(1.0 - uDayShadow, 1.0, m));
  for (int i = 0; i < MAXL; i++){
    if (i >= uN) break;
    vec4 L = uL[i]; vec2 d = p - L.xy; float dist = length(d);
    if (dist >= L.z) continue;
    float att = 1.0 - dist / L.z; att *= att;
    vec4 K = uK[i];
    if (K.z > -1.5) att *= smoothstep(K.z, K.z + K.w, dot(d / max(dist, 0.001), K.xy));
    vec4 C = uC[i];
    if (C.a > 0.5) att *= m;
    light += C.rgb * L.w * att;
  }
  light += vec3(0.75, 0.82, 1.0) * uFlash;
  vec3 lit = col * light + vec3(0.02, 0.035, 0.08) * uDark;
  if (uFog > 0.001){
    vec2 wp = p + uCam;
    float n = fbm(wp * 0.0035 + vec2(uTime * 0.03, uTime * 0.012));
    float n2 = fbm(wp * 0.009 - vec2(uTime * 0.05, 0.0));
    float far = smoothstep(80.0, 440.0, length(p - uPlayer));
    float a = uFog * clamp(n * 0.95 + n2 * 0.4 - 0.15, 0.0, 1.0) * (0.3 + 0.7 * far);
    float lum = clamp(dot(light, vec3(0.333)), 0.0, 1.2);
    vec3 fc = mix(vec3(0.03, 0.04, 0.06), vec3(0.6, 0.63, 0.6), clamp(base * 0.9 + lum * 0.25, 0.0, 1.0));
    lit = mix(lit, fc, clamp(a, 0.0, 0.85));
  }
  if (uRain > 0.001){
    float r = rainLayer(p, 5.0, 1.6, 0.07) + rainLayer(p + vec2(37.0, 11.0), 8.0, 2.3, 0.05) * 0.8;
    float lum = clamp(dot(light, vec3(0.333)), 0.2, 1.0);
    lit *= 1.0 - 0.14 * uRain;
    lit += vec3(0.65, 0.72, 0.82) * r * uRain * 0.33 * lum;
  }
  gl_FragColor = vec4(lit, 1.0);
}`;
// 2) parte clara da imagem (vira o brilho)
const FS_BRIGHT = FS_HEAD + `
uniform sampler2D uTex; uniform vec2 uTexel;
void main(){
  vec3 c = (texture2D(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(uTex, vUv + uTexel * vec2(1.0, -1.0)).rgb
          + texture2D(uTex, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(uTex, vUv + uTexel * vec2(1.0, 1.0)).rgb) * 0.25;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(0.6, 1.0, l), 1.0);
}`;
// 3) desfoque em duas passadas
const FS_BLUR = FS_HEAD + `
uniform sampler2D uTex; uniform vec2 uDir;
void main(){
  vec3 c = texture2D(uTex, vUv).rgb * 0.227;
  c += (texture2D(uTex, vUv + uDir * 1.385).rgb + texture2D(uTex, vUv - uDir * 1.385).rgb) * 0.316;
  c += (texture2D(uTex, vUv + uDir * 3.231).rgb + texture2D(uTex, vUv - uDir * 3.231).rgb) * 0.07;
  gl_FragColor = vec4(c, 1.0);
}`;
// 4) imagem final: onda de choque, aberração, brilho, cor, vinheta, sangue na borda e granulado
const FS_FINAL = FS_HEAD + `
uniform sampler2D uLit; uniform sampler2D uBloom;
uniform vec2 uRes; uniform float uBloomK; uniform float uAb; uniform float uHurt; uniform float uGrain; uniform float uTime; uniform float uDpr;
uniform vec3 uTint; uniform int uWN; uniform vec4 uW[4];
void main(){
  vec2 uv = vUv; vec2 p = vec2(uv.x, 1.0 - uv.y) * uRes;
  for (int i = 0; i < 4; i++){
    if (i >= uWN) break;
    vec2 d = p - uW[i].xy; float dist = length(d); float x = dist - uW[i].z;
    float s = uW[i].w * exp(-x * x / 600.0);
    vec2 dir = d / max(dist, 1.0);
    uv -= vec2(dir.x, -dir.y) * s / uRes;
  }
  vec2 c = uv - 0.5;
  float ab = uAb * (0.3 + dot(c, c) * 2.0);
  vec3 col = vec3(texture2D(uLit, uv + c * ab).r, texture2D(uLit, uv).g, texture2D(uLit, uv - c * ab).b);
  col += texture2D(uBloom, uv).rgb * uBloomK;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 0.84);
  col += vec3(-0.012, 0.006, 0.02) * (1.0 - l);
  col *= uTint;
  col = clamp(col, 0.0, 1.0);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);
  float v = smoothstep(0.82, 0.28, length(vec2(c.x, c.y * 0.85)));
  col *= mix(0.45, 1.0, v);
  col = mix(col, vec3(0.55, 0.02, 0.02), clamp(uHurt * (1.0 - v) * 1.5, 0.0, 0.75));
  col += (hash(floor(vUv * uRes * uDpr) + fract(uTime * 7.0) * 100.0) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------- Montagem ----------
function glCompile(gl, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "aPos"); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  return { p, u: (n) => (n in u ? u[n] : (u[n] = gl.getUniformLocation(p, n))) };
}
function glTex(gl) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function glTarget(gl, w, h, old) {
  if (old) { gl.deleteTexture(old.t); gl.deleteFramebuffer(old.f); }
  const t = glTex(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { t, f, w, h };
}

function gfxInit() {
  GFX.cv = document.getElementById("gl");
  GFX.scene = document.createElement("canvas"); GFX.sctx = GFX.scene.getContext("2d");
  GFX.mask = document.createElement("canvas"); GFX.mask.width = W / 2; GFX.mask.height = H / 2; GFX.mctx = GFX.mask.getContext("2d");
  if (save.gfx == null) save.gfx = 2;
  if (save.gfx > 0) gfxStart();
  else gfxStop();
}
function gfxStart() {
  if (GFX.failed) { gfxStop(); return false; }
  try {
    if (!GFX.gl) {
      const gl = GFX.cv.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: "high-performance" });
      if (!gl) throw new Error("sem WebGL");
      GFX.gl = gl;
      GFX.P.lit = glCompile(gl, FS_LIT); GFX.P.bright = glCompile(gl, FS_BRIGHT); GFX.P.blur = glCompile(gl, FS_BLUR); GFX.P.fin = glCompile(gl, FS_FINAL);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      GFX.T.scene = glTex(gl); GFX.T.mask = glTex(gl);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      GFX.cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); GFX.failed = true; gfxStop(); toast("O WebGL falhou: voltando aos gráficos simples"); });
    }
    GFX.on = true;
    GFX.cv.style.display = "block"; canvas.classList.add("overlay");
    gfxResize();
    return true;
  } catch (e) {
    console.warn("WebGL indisponível:", e);
    GFX.failed = true; gfxStop();
    return false;
  }
}
function gfxStop() {
  GFX.on = false;
  if (GFX.cv) GFX.cv.style.display = "none";
  canvas.classList.remove("overlay");
}
function gfxResize() {
  if (!GFX.scene) return;
  GFX.scene.width = W * DPR; GFX.scene.height = H * DPR;
  if (!GFX.on) return;
  const gl = GFX.gl, cw = W * DPR, ch = H * DPR;
  GFX.cv.width = cw; GFX.cv.height = ch;
  GFX.cv.style.width = canvas.style.width; GFX.cv.style.height = canvas.style.height;
  GFX.lit = glTarget(gl, cw, ch, GFX.lit);
  const bw = Math.max(1, Math.round(cw / 4)), bh = Math.max(1, Math.round(ch / 4));
  GFX.b1 = glTarget(gl, bw, bh, GFX.b1); GFX.b2 = glTarget(gl, bw, bh, GFX.b2);
}
function gfxSetQuality(q) {
  save.gfx = q; persist();
  if (q === 0) gfxStop();
  else if (!gfxStart()) { save.gfx = 0; toast("Este computador não tem WebGL: só o modo Baixo funciona"); }
}

// ---------- Clima ----------
function gfxWeatherName() { const n = WEATHER[GFX.wx.kind].name; return n ? ` · ${n}` : ""; }
function gfxTick(dt) {
  const w = GFX.wx, sec = dt / 1000;
  w.timer -= dt;
  if (w.timer <= 0) {
    const r = Math.random(), kind = r < 0.5 ? 0 : r < 0.7 ? 1 : r < 0.92 ? 2 : 3;
    w.timer = rand(150000, 320000);
    if (kind !== w.kind) { w.kind = kind; if (GFX.on && WEATHER[kind].msg) toast(WEATHER[kind].msg); else if (GFX.on && w.kind === 0) toast("O tempo abriu"); }
  }
  const def = WEATHER[w.kind], reg = game.inside ? 0 : regionOf(game.area);
  w.tRain = def.rain;
  w.tFog = Math.min(0.9, def.fog + (reg >= 6 ? 0.22 : reg >= 4 ? 0.08 : 0) + (isNight() ? 0.06 : 0));
  const ap = (a, b, s) => a + clamp(b - a, -s, s);
  w.rain = ap(w.rain, w.tRain, sec * 0.08); w.fog = ap(w.fog, w.tFog, sec * 0.05);
  // relâmpagos durante a tempestade
  GFX.flash = Math.max(0, GFX.flash - sec * 3.2);
  if (def.storm && w.rain > 0.6) {
    w.bolt -= dt;
    if (w.bolt <= 0) {
      w.bolt = rand(6000, 16000);
      GFX.flash = game.inside ? 0.25 : 1.1;
      setTimeout(() => { GFX.flash = Math.max(GFX.flash, game.inside ? 0.15 : 0.6); }, 120);
      setTimeout(() => { nz(2.4, 90, game.inside ? 0.5 : 0.9); nz(1.2, 260, 0.35); }, rand(350, 1600));
    }
  }
  // som da chuva
  if (SND.ac) {
    if (!GFX.rs && w.rain > 0.01) {
      const ac = SND.ac, src = ac.createBufferSource(); src.buffer = SND.noise; src.loop = true;
      const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6500;
      const g = ac.createGain(); g.gain.value = 0;
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(SND.master); src.start();
      GFX.rs = { g, lp };
    }
    if (GFX.rs) {
      const t = SND.ac.currentTime;
      GFX.rs.g.gain.setTargetAtTime(w.rain * (game.inside ? 0.05 : 0.13), t, 0.6);
      GFX.rs.lp.frequency.setTargetAtTime(game.inside ? 1400 : 6500, t, 0.3);
    }
  }
  // ondas de choque
  for (const v of GFX.waves) v.t += dt;
  GFX.waves = GFX.waves.filter((v) => v.t < 520);
}

// ---------- Luzes da cena ----------
function gfxLights(dark) {
  const L = [], ox = cam.x, oy = cam.y, t = game.time, glow = 0.35 + 0.65 * dark;
  const add = (x, y, r, I, c, sh, cone) => {
    if (L.length >= MAXL || I <= 0.01 || x + r < 0 || x - r > W || y + r < 0 || y - r > H) return;
    L.push([x, y, r, I, c, sh ? 1 : 0, cone]);
  };
  const fl = (seed, sp) => 0.82 + 0.18 * Math.sin(t / sp + seed) * Math.sin(t / (sp * 0.37) + seed * 3);
  if (!game.over) {
    const px = player.x - ox, py = player.y - oy, a = player.angle;
    add(px, py, game.inside ? 240 : 150, dark * 1.05, [1, 0.96, 0.9], true);
    if (dark > 0.12) add(px, py, 460, (dark - 0.08) * 1.7, [1, 0.86, 0.55], true, [Math.cos(a), Math.sin(a), Math.cos(0.5), 0.14]); // lanterna amarelada
    if (player.flashT > 0) add(px + Math.cos(a) * 30, py + Math.sin(a) * 30, 280, 1.1 * glow * (Math.min(1, player.flashT / 60) + 0.4), [1, 0.75, 0.38], true);
  }
  for (const f of game.flashes) {
    add(f.x - ox, f.y - oy, f.r * 1.7, 1.2 * Math.min(1, f.t / 220) * glow, [1, 0.58, 0.22], false);
    if (f.r >= 150 && !f._w && !game.inside) { f._w = true; GFX.waves.push({ x: f.x, y: f.y, t: 0, k: Math.min(1.4, f.r / 220) }); }
  }
  for (const c of game.inside ? [] : world.cars) if (c.fuse > 0) add(c.x + c.w / 2 - ox, c.y + c.h / 2 - oy, 130, (0.5 + 0.4 * Math.sin(t / 60)) * glow, [1, 0.45, 0.15], false);
  for (const h of game.hazards) {
    if (h.inside !== (game.inside || null)) continue;
    const k = Math.min(1, h.t / 800);
    if (h.kind === "fire") add(h.x - ox, h.y - oy, h.r * 2.4, 1.0 * k * glow * fl(h.x, 70), [1, 0.5, 0.16], false);
    else add(h.x - ox, h.y - oy, h.r * 1.6, (0.12 + 0.4 * dark) * k, h.kind === "gas" ? [0.9, 0.85, 0.3] : [0.45, 1, 0.25], false);
  }
  for (const z of Zs()) {
    if (z.hp <= 0) continue;
    if (z.burn > 0) add(z.x - ox, z.y - oy, 75, 0.75 * glow * fl(z.x, 60), [1, 0.5, 0.15], false);
    else if (z.boss) add(z.x - ox, z.y - oy, z.r * 4, 0.35 + 0.5 * dark, [0.9, 0.16, 0.1], false);
  }
  let nf = 0;
  for (const b of bullets) if (b.fire && (nf++ % 3 === 0)) add(b.x - ox, b.y - oy, 80, 0.55 * glow, [1, 0.55, 0.2], false);
  for (const s of game.spits) add(s.x - ox, s.y - oy, 55, 0.25 + 0.4 * dark, [0.5, 1, 0.3], false);
  if (!game.inside) {
    for (const a of game.airdrops || []) if (!a.opened) add(a.x + a.w / 2 - ox, a.y + a.h / 2 - oy, 170, (0.3 + 0.7 * dark) * fl(a.x, 40), [1, 0.22, 0.15], false);
    if (dark > 0.05) for (const l of world.lamps) {
      const flick = (Math.floor(l.x * 7 + l.y * 3) % 11) < 2;
      const I = dark * 1.15 * (flick ? (Math.sin(t / 47 + l.x) > 0.6 || Math.sin(t / 900 + l.y) > 0.85 ? 0.25 : 1) : fl(l.y, 400));
      add(l.x - ox, l.y - oy, l.big ? 270 : 180, I, [1, 0.78, 0.5], false);
    }
  } else if (game.inside.safe) add(W / 2, H / 2, 560, 0.5, [1, 0.9, 0.75], false);
  return L;
}

// ---------- Sombras dos prédios (a partir do jogador) ----------
function gfxMask(lx, ly) {
  const m = GFX.mctx;
  m.setTransform(0.5, 0, 0, 0.5, 0, 0); m.fillStyle = "#fff"; m.fillRect(0, 0, W, H);
  if (game.inside || game.over) return;
  m.fillStyle = "#000";
  const rects = [], far = 2400;
  for (const b of world.buildings) {
    if (!inView(b.x, b.y, b.w, b.h, 260)) continue;
    const x = b.x - cam.x, y = b.y - cam.y;
    if (lx > x - 2 && lx < x + b.w + 2 && ly > y - 2 && ly < y + b.h + 2) continue;
    rects.push([x, y, b.w, b.h, b]);
    const P = [[x, y], [x + b.w, y], [x + b.w, y + b.h], [x, y + b.h]];
    for (let i = 0; i < 4; i++) {
      const a = P[i], c = P[(i + 1) % 4];
      const da = Math.hypot(a[0] - lx, a[1] - ly) || 1, dc = Math.hypot(c[0] - lx, c[1] - ly) || 1;
      m.beginPath(); m.moveTo(a[0], a[1]); m.lineTo(c[0], c[1]);
      m.lineTo(c[0] + ((c[0] - lx) / dc) * far, c[1] + ((c[1] - ly) / dc) * far);
      m.lineTo(a[0] + ((a[0] - lx) / da) * far, a[1] + ((a[1] - ly) / da) * far);
      m.closePath(); m.fill();
    }
  }
  m.fillStyle = "#fff";
  for (const r of rects) {
    m.fillRect(r[0], r[1], r[2], r[3]);
    // câmera em perspectiva: o telhado e as paredes do prédio ficam claros (fora da sombra)
    if (typeof bHeight === "function") {
      const b = r[4], ex = W / 2, ey = H / 2, k = CAM_H / (CAM_H - bHeight(b));
      const P = [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0] + r[2], r[1] + r[3]], [r[0], r[1] + r[3]]];
      const hb = bHeight(b), T = P.map(([px, py]) => [ex + (px - ex) * k, ey + (py - ey) * k - hb * LEAN]);
      for (let i = 0; i < 4; i++) {
        const a = P[i], c = P[(i + 1) % 4], ta = T[i], tc = T[(i + 1) % 4];
        m.beginPath(); m.moveTo(a[0], a[1]); m.lineTo(c[0], c[1]); m.lineTo(tc[0], tc[1]); m.lineTo(ta[0], ta[1]); m.closePath(); m.fill();
      }
      m.beginPath(); m.moveTo(T[0][0], T[0][1]); for (let i = 1; i < 4; i++) m.lineTo(T[i][0], T[i][1]); m.closePath(); m.fill();
    }
  }
}

// ---------- Quadro final ----------
function gfxPass(prog, target) {
  const gl = GFX.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
  gl.viewport(0, 0, target ? target.w : GFX.cv.width, target ? target.h : GFX.cv.height);
  gl.useProgram(prog.p);
}
function gfxBind(prog, name, unit, tex) {
  const gl = GFX.gl;
  gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.u(name), unit);
}
function gfxDraw() { GFX.gl.drawArrays(GFX.gl.TRIANGLES, 0, 3); }

function gfxRender() {
  const gl = GFX.gl, high = save.gfx >= 2;
  if (gl.isContextLost()) return;
  const dark = game.inside ? (game.inside.safe ? 0.12 : 0.26 + darkness() * 0.3) : darkness();
  const px = player.x - cam.x, py = player.y - cam.y;
  gfxMask(px, py);
  const lights = gfxLights(dark);
  // envia a cena e a máscara de sombra
  gl.bindTexture(gl.TEXTURE_2D, GFX.T.scene); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, GFX.scene);
  gl.bindTexture(gl.TEXTURE_2D, GFX.T.mask); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, GFX.mask);
  const tm = (performance.now() / 1000) % 1000;

  // 1) luz
  let P = GFX.P.lit; gfxPass(P, GFX.lit);
  gfxBind(P, "uScene", 0, GFX.T.scene); gfxBind(P, "uMask", 1, GFX.T.mask);
  gl.uniform2f(P.u("uRes"), W, H); gl.uniform2f(P.u("uMaskTexel"), 2 / W, 2 / H);
  gl.uniform2f(P.u("uCam"), cam.x, cam.y); gl.uniform2f(P.u("uPlayer"), px, py);
  gl.uniform1f(P.u("uDark"), dark); gl.uniform1f(P.u("uDayShadow"), game.inside ? 0 : 0.42);
  gl.uniform1f(P.u("uTime"), tm);
  gl.uniform1f(P.u("uFog"), game.inside ? 0 : GFX.wx.fog); gl.uniform1f(P.u("uRain"), game.inside ? 0 : GFX.wx.rain);
  gl.uniform1f(P.u("uFlash"), GFX.flash * (game.inside ? 0.3 : 0.55));
  const aL = new Float32Array(MAXL * 4), aC = new Float32Array(MAXL * 4), aK = new Float32Array(MAXL * 4);
  lights.forEach((l, i) => {
    aL.set([l[0], l[1], l[2], l[3]], i * 4);
    aC.set([l[4][0], l[4][1], l[4][2], l[5]], i * 4);
    aK.set(l[6] || [0, 0, -2, 0], i * 4);
  });
  gl.uniform1i(P.u("uN"), lights.length);
  gl.uniform4fv(P.u("uL"), aL); gl.uniform4fv(P.u("uC"), aC); gl.uniform4fv(P.u("uK"), aK);
  gfxDraw();

  // 2) brilho
  if (high) {
    P = GFX.P.bright; gfxPass(P, GFX.b1);
    gfxBind(P, "uTex", 0, GFX.lit.t); gl.uniform2f(P.u("uTexel"), 1 / GFX.lit.w, 1 / GFX.lit.h); gfxDraw();
    P = GFX.P.blur;
    for (let i = 0; i < 2; i++) {
      gfxPass(P, GFX.b2); gfxBind(P, "uTex", 0, GFX.b1.t); gl.uniform2f(P.u("uDir"), (1.5 + i) / GFX.b1.w, 0); gfxDraw();
      gfxPass(P, GFX.b1); gfxBind(P, "uTex", 0, GFX.b2.t); gl.uniform2f(P.u("uDir"), 0, (1.5 + i) / GFX.b1.h); gfxDraw();
    }
  }

  // 3) imagem final
  P = GFX.P.fin; gfxPass(P, null);
  gfxBind(P, "uLit", 0, GFX.lit.t); gfxBind(P, "uBloom", 1, high ? GFX.b1.t : GFX.lit.t);
  gl.uniform2f(P.u("uRes"), W, H); gl.uniform1f(P.u("uBloomK"), high ? 0.85 : 0);
  const low = player.hp / player.maxHp;
  const hurt = Math.min(1, game.hurtT / 350) * 0.45 + (low < 0.3 && !game.over ? (0.3 - low) * (0.8 + 0.4 * Math.sin(performance.now() / 180)) : 0);
  gl.uniform1f(P.u("uAb"), high ? 0.006 + Math.min(0.03, hurt * 0.04) : 0);
  gl.uniform1f(P.u("uHurt"), Math.min(0.8, hurt));
  gl.uniform1f(P.u("uGrain"), high ? 0.045 : 0.03); gl.uniform1f(P.u("uTime"), tm); gl.uniform1f(P.u("uDpr"), DPR);
  const tt = game.inside ? [1, 1, 1] : REGION_TINT[regionOf(game.area)] || [1, 1, 1];
  for (let i = 0; i < 3; i++) GFX.tint[i] += (tt[i] - GFX.tint[i]) * 0.02;
  gl.uniform3f(P.u("uTint"), GFX.tint[0], GFX.tint[1], GFX.tint[2]);
  const aW = new Float32Array(16); let wn = 0;
  for (const v of GFX.waves) {
    if (wn >= 4 || game.inside) break;
    const f = v.t / 520;
    aW.set([v.x - cam.x, v.y - cam.y, 30 + f * 380, 16 * v.k * (1 - f)], wn * 4); wn++;
  }
  gl.uniform1i(P.u("uWN"), wn); gl.uniform4fv(P.u("uW"), aW);
  gfxDraw();
}
