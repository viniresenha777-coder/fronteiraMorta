"use strict";
// =====================================================================
//  Música ambiente de fim de mundo, composta na hora pelo próprio jogo
//  (Web Audio): vento, zumbido grave, acordes menores, notas soltas com
//  eco, batidas metálicas distantes e um coração acelerado no perigo.
// =====================================================================
const MUSIC = { on: true, started: false, nodes: null, next: 0, chord: 0, nextChord: 0, nextPluck: 0, nextClang: 0, nextBeat: 0, danger: 0 };
// progressão em lá menor: Am, F, Dm, Em (frequências da fundamental)
const CHORDS = [[110, 130.81, 164.81], [87.31, 110, 130.81], [73.42, 87.31, 110], [82.41, 98, 123.47]];
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33]; // pentatônica menor

function musicStart() {
  const ac = SND.ac;
  if (!ac || MUSIC.started) return;
  MUSIC.started = true;
  const out = ac.createGain(); out.gain.value = MUSIC.on ? 0.55 : 0; out.connect(SND.master);
  // eco
  const delay = ac.createDelay(2); delay.delayTime.value = 0.46;
  const fb = ac.createGain(); fb.gain.value = 0.42;
  const dl = ac.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 1800;
  delay.connect(dl); dl.connect(fb); fb.connect(delay); delay.connect(out);
  // vento
  const wind = ac.createBufferSource(); wind.buffer = SND.noise; wind.loop = true;
  const wf = ac.createBiquadFilter(); wf.type = "bandpass"; wf.frequency.value = 400; wf.Q.value = 0.7;
  const wg = ac.createGain(); wg.gain.value = 0.05;
  wind.connect(wf); wf.connect(wg); wg.connect(out); wind.start();
  // zumbido grave (drone)
  const dg = ac.createGain(); dg.gain.value = 0.07;
  const dlp = ac.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 260; dlp.Q.value = 3;
  dlp.connect(dg); dg.connect(out);
  const d1 = ac.createOscillator(), d2 = ac.createOscillator();
  d1.type = "sawtooth"; d2.type = "sawtooth"; d1.frequency.value = 55; d2.frequency.value = 55.4;
  d1.connect(dlp); d2.connect(dlp); d1.start(); d2.start();
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.05; lg.gain.value = 120;
  lfo.connect(lg); lg.connect(dlp.frequency); lfo.start();
  // pad de acordes
  const pg = ac.createGain(); pg.gain.value = 0.022;
  const plp = ac.createBiquadFilter(); plp.type = "lowpass"; plp.frequency.value = 900;
  plp.connect(pg); pg.connect(out); pg.connect(delay);
  const pads = [0, 1, 2].map(() => { const o = ac.createOscillator(); o.type = "triangle"; o.connect(plp); o.start(); return o; });
  MUSIC.nodes = { out, delay, wind, wf, wg, d1, d2, dlp, pads, pg };
  MUSIC.next = ac.currentTime;
  setInterval(musicTick, 250);
}
function musicSetOn(on) {
  MUSIC.on = on;
  if (MUSIC.nodes) MUSIC.nodes.out.gain.setTargetAtTime(on ? 0.55 : 0, SND.ac.currentTime, 0.5);
}
function pluck(freq, t, vol) {
  const ac = SND.ac, o = ac.createOscillator(), g = ac.createGain();
  o.type = "sine"; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
  o.connect(g); g.connect(MUSIC.nodes.out); g.connect(MUSIC.nodes.delay);
  o.start(t); o.stop(t + 3);
  const o2 = ac.createOscillator(), g2 = ac.createGain(); // harmônico
  o2.type = "sine"; o2.frequency.value = freq * 2.01;
  g2.gain.setValueAtTime(vol * 0.25, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  o2.connect(g2); g2.connect(MUSIC.nodes.out); o2.start(t); o2.stop(t + 1.3);
}
function clang(t) {
  const ac = SND.ac, src = ac.createBufferSource(); src.buffer = SND.noise;
  const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = rand(500, 1400); f.Q.value = 25;
  const g = ac.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
  src.connect(f); f.connect(g); g.connect(MUSIC.nodes.out); g.connect(MUSIC.nodes.delay);
  src.start(t, Math.random() * 0.5); src.stop(t + 3.6);
}
function heartbeat(t, vol) {
  const ac = SND.ac;
  for (const dt of [0, 0.22]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(70, t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.18);
    g.gain.setValueAtTime(vol * (dt ? 0.7 : 1), t + dt); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.25);
    o.connect(g); g.connect(MUSIC.nodes.out); o.start(t + dt); o.stop(t + dt + 0.3);
  }
}
function musicTick() {
  const ac = SND.ac, n = MUSIC.nodes;
  if (!ac || !n || !MUSIC.on || ac.state !== "running") return;
  const t = ac.currentTime, night = typeof game !== "undefined" && game && isNight();
  // perigo: zumbis te perseguindo perto
  let chasing = 0;
  if (typeof game !== "undefined" && game && !game.inside && !game.over)
    for (const z of zombies) if (z.state === "chase" && Math.hypot(z.x - player.x, z.y - player.y) < 450) chasing++;
  MUSIC.danger += ((Math.min(1, chasing / 6)) - MUSIC.danger) * 0.15;
  // troca de acorde a cada 12 s
  if (t >= MUSIC.nextChord) {
    MUSIC.chord = (MUSIC.chord + 1) % CHORDS.length;
    const c = CHORDS[MUSIC.chord];
    n.pads.forEach((o, i) => o.frequency.setTargetAtTime(c[i] * 2, t, 1.5));
    n.d1.frequency.setTargetAtTime(c[0] / 2, t, 2); n.d2.frequency.setTargetAtTime(c[0] / 2 * 1.007, t, 2);
    MUSIC.nextChord = t + 12;
  }
  // vento sobe e desce; mais forte à noite
  n.wf.frequency.setTargetAtTime(250 + Math.random() * 600, t, 2.5);
  n.wg.gain.setTargetAtTime((night ? 0.08 : 0.045) + Math.random() * 0.03, t, 2);
  n.dlp.frequency.setTargetAtTime(240 + MUSIC.danger * 500, t, 0.8);
  // notas soltas
  if (t >= MUSIC.nextPluck) {
    const base = CHORDS[MUSIC.chord][0] * 2, pool = SCALE.filter((f) => f >= base * 0.99);
    pluck(pick(pool.length ? pool : SCALE) * (Math.random() < 0.25 ? 2 : 1), t + 0.05, night ? 0.05 : 0.07);
    MUSIC.nextPluck = t + rand(night ? 3 : 1.6, night ? 7 : 4.5);
  }
  // metal batendo ao longe
  if (t >= MUSIC.nextClang) { if (MUSIC.nextClang) clang(t + 0.05); MUSIC.nextClang = t + rand(18, 40); }
  // coração no perigo
  if (MUSIC.danger > 0.25 && t >= MUSIC.nextBeat) { heartbeat(t + 0.05, 0.25 * MUSIC.danger); MUSIC.nextBeat = t + 1.05 - MUSIC.danger * 0.4; }
}
