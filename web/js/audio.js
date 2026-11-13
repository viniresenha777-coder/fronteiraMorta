"use strict";
// =====================================================================
//  Som sintetizado (Web Audio) — nenhum arquivo de áudio é necessário.
//  O som só liga depois do primeiro clique ou tecla (regra dos navegadores).
// =====================================================================
const SND = { ac: null, master: null, noise: null, muted: false, lastGroan: 0 };

function sndInit() {
  if (SND.ac) { if (SND.ac.state === "suspended") SND.ac.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    SND.ac = new AC();
    SND.master = SND.ac.createGain();
    SND.master.gain.value = SND.muted ? 0 : 0.4;
    SND.master.connect(SND.ac.destination);
    const len = SND.ac.sampleRate, buf = SND.ac.createBuffer(1, len, SND.ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    SND.noise = buf;
  } catch (e) { SND.ac = null; }
}
function sndMute(m) { SND.muted = m; if (SND.master) SND.master.gain.value = m ? 0 : 0.4; }

// ruído filtrado
function nz(dur, freq, vol, type, q) {
  const ac = SND.ac;
  if (!ac || SND.muted) return;
  const t = ac.currentTime, src = ac.createBufferSource();
  src.buffer = SND.noise;
  const f = ac.createBiquadFilter(); f.type = type || "lowpass"; f.frequency.value = freq; f.Q.value = q || 0.8;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(SND.master);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
// tom simples
function tn(freq, dur, vol, type, to) {
  const ac = SND.ac;
  if (!ac || SND.muted) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(SND.master); o.start(t); o.stop(t + dur + 0.02);
}

const sfx = {
  shot(w) {
    if (w.melee) { nz(0.14, 1800, 0.22, "bandpass", 1.5); return; }
    const big = w.cat === "shotguns" || w.cat === "rifles";
    nz(big ? 0.35 : 0.15, big ? 900 : 1700, big ? 0.85 : 0.55);
    tn(big ? 90 : 170, big ? 0.25 : 0.1, 0.3, "square", 40);
  },
  hit() { nz(0.06, 700, 0.22); },
  kill() { tn(110, 0.3, 0.16, "sawtooth", 50); nz(0.2, 400, 0.22); },
  hurt() { tn(230, 0.18, 0.28, "sawtooth", 90); },
  pickup() { tn(660, 0.08, 0.18, "triangle"); setTimeout(() => tn(990, 0.1, 0.16, "triangle"), 70); },
  empty() { tn(1200, 0.04, 0.12, "square"); },
  reload() { nz(0.05, 3000, 0.22, "highpass"); setTimeout(() => nz(0.06, 2500, 0.26, "highpass"), 180); },
  door() { nz(0.25, 300, 0.35); tn(140, 0.2, 0.08, "triangle", 90); },
  spit() { nz(0.2, 600, 0.28, "bandpass", 3); },
  buy() { tn(880, 0.07, 0.15, "square"); setTimeout(() => tn(1320, 0.09, 0.12, "square"), 60); },
  level() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tn(f, 0.18, 0.18, "triangle"), i * 90)); },
  groan(vol) {
    const now = performance.now();
    if (vol <= 0.05 || now - SND.lastGroan < 1400) return;
    SND.lastGroan = now;
    tn(rand(70, 110), 0.7, 0.12 * vol, "sawtooth", rand(50, 70));
    nz(0.6, 300, 0.08 * vol, "bandpass", 4);
  }
};
