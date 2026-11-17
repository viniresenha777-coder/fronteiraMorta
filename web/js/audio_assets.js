"use strict";
// Arquivos fornecidos pelo criador: sons de armas, criatura e impacto.
// O áudio tem atenuação por distância, pan estéreo e filtro passa-baixas
// para dar profundidade às mortes, groans e tiros no mundo compartilhado.
const FM_AUDIO = { buffer: null, loading: false, failed: false, voices: 0,
  amb: null, ambNode: null, ambGain: null, lastGroan: 0, lastKill: 0 };
const FM_AUDIO_CUES = {"pistol":[0.0,0.5571],"pistol_silenced":[0.6371,0.3871],"rifle":[1.1042,0.3271],"rifle_burst":[1.5113,0.4971],"shotgun":[2.0884,0.3871],"sniper":[2.5556,0.1271],"reload_pistol":[2.7627,1.465],"reload_rifle":[4.3077,1.125],"pump":[5.5127,0.3421],"hit_metal":[5.9347,0.3171],"hit_concrete":[6.3318,0.5071],"ricochet":[6.919,1.3003],"knife":[8.2993,0.3821],"explosion":[8.7614,1.74],"zombie_groan1":[10.5814,1.3],"zombie_groan2":[11.9614,1.35],"zombie_die1":[13.3913,1.4],"zombie_die2":[14.8713,1.3],"zombie_die3":[16.2513,1.2],"gore1":[17.5313,0.4286],"gore2":[18.0399,0.8571],"walther":[18.977,0.9896]};
// Arquivo .mp3 enviado pelo criador: clique mecânico curto a cada cartucho.
function fmLoadRifleRound() {
  if (!SND.ac || FM_AUDIO.rifleRoundBuffer || FM_AUDIO.rifleRoundLoading || FM_AUDIO.rifleRoundFailed) return;
  FM_AUDIO.rifleRoundLoading = true;
  fetch("audio/rifle_reload_round.mp3?v=20261117-rifle-reload1")
    .then(r => { if (!r.ok) throw new Error("Som de recarga não disponível"); return r.arrayBuffer(); })
    .then(buf => SND.ac.decodeAudioData(buf))
    .then(buf => { FM_AUDIO.rifleRoundBuffer = buf; })
    .catch(err => { FM_AUDIO.rifleRoundFailed = true; console.warn("Som individual de recarga indisponível", err); })
    .finally(() => { FM_AUDIO.rifleRoundLoading = false; });
}
function fmAudioAssetsStart() {
  fmLoadRifleRound();
  if (!SND.ac || FM_AUDIO.loading || FM_AUDIO.buffer || FM_AUDIO.failed) return;
  FM_AUDIO.loading = true;
  fetch("audio/fm_sfx_pack.ogg?v=20261117-1")
    .then(r => { if (!r.ok) throw new Error("Pacote de sons não disponível"); return r.arrayBuffer(); })
    .then(buf => SND.ac.decodeAudioData(buf))
    .then(buf => { FM_AUDIO.buffer = buf; })
    .catch(err => { FM_AUDIO.failed = true; console.warn("Sons externos indisponíveis; usando efeitos originais", err); })
    .finally(() => { FM_AUDIO.loading = false; });
}
function fmAmbientVolume() {
  const v = typeof save !== "undefined" ? Number(save.ambientVolume) : 0.45;
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.45;
}
function fmAmbientSetVolume() {
  if (!FM_AUDIO.ambGain || !SND.ac) return;
  FM_AUDIO.ambGain.gain.setTargetAtTime(fmAmbientVolume() * 0.44, SND.ac.currentTime, 0.14);
}
function fmAmbientStart() {
  if (!SND.ac || !SND.master) return;
  if (!FM_AUDIO.amb) {
    const media = new Audio("audio/fm_ambient_lost.ogg?v=20261117-1");
    media.loop = true; media.preload = "auto";
    const node = SND.ac.createMediaElementSource(media), gain = SND.ac.createGain();
    node.connect(gain); gain.connect(SND.master);
    FM_AUDIO.amb = media; FM_AUDIO.ambNode = node; FM_AUDIO.ambGain = gain;
  }
  fmAmbientSetVolume();
  if (FM_AUDIO.amb.paused && fmAmbientVolume() > 0) FM_AUDIO.amb.play().catch(() => {});
}
function fmPlaySample(key, opt) {
  const ac = SND.ac, spec = FM_AUDIO_CUES[key];
  if (!ac || SND.muted || !FM_AUDIO.buffer || !spec || FM_AUDIO.voices > 22) return false;
  opt = opt || {};
  let volume = Number.isFinite(opt.volume) ? opt.volume : 1;
  let pan = 0, distance = 0;
  if (Number.isFinite(opt.x) && Number.isFinite(opt.y) && player) {
    const dx = opt.x - player.x, dy = opt.y - player.y;
    distance = Math.hypot(dx,dy);
    // Sem corte abrupto: 200 unidades ainda soam próximas; 700 ficam abafadas.
    if (distance > 1350) return true;
    volume *= 1 / (1 + Math.pow(distance / 270, 1.75));
    pan = Math.max(-0.88, Math.min(0.88, dx / 360));
  }
  if (volume < 0.018) return true;
  const source = ac.createBufferSource(); source.buffer = FM_AUDIO.buffer;
  const gain = ac.createGain(); gain.gain.value = Math.min(1.4, volume);
  let target = gain;
  if (distance > 220) {
    const low = ac.createBiquadFilter();low.type = "lowpass";
    low.frequency.value = Math.max(1100, 7500 - distance * 6.2);
    gain.connect(low); target = low;
  }
  if (ac.createStereoPanner) {
    const stereo = ac.createStereoPanner();stereo.pan.value = pan;
    target.connect(stereo);target = stereo;
  }
  target.connect(SND.master);source.connect(gain);
  FM_AUDIO.voices++;
  source.onended = () => { FM_AUDIO.voices = Math.max(0, FM_AUDIO.voices - 1);source.disconnect();gain.disconnect(); };
  source.start(0, spec[0], Math.max(0.01, spec[1] - .008));
  return true;
}
function fmSoundFromWeapon(w) {
  if (!w || w.melee || w.fists) return "knife";
  if (w.cat === "shotguns") return "shotgun";
  if (w.cat === "rifles") return w.mag && w.mag <= 8 ? "sniper" : "rifle";
  if (w.silenced || w.sound === 0) return "pistol_silenced";
  return w.cat === "pistols" ? "pistol" : "rifle";
}
function fmInstallAudioSamples() {
  if (FM_AUDIO.installed) return;
  FM_AUDIO.installed = true;
  const prev = {
    shot:sfx.shot, reload:sfx.reload, hit:sfx.hit, kill:sfx.kill, groan:sfx.groan,
    empty:sfx.empty, spit:sfx.spit
  };
  sfx.shot = function(w) {
    if (!fmPlaySample(fmSoundFromWeapon(w), {volume:w&&w.melee?.48:.72})) prev.shot(w);
  };
  sfx.reload = function() {
    const w = typeof curW === "function" ? curW() : {};
    const key = w.cat === "rifles" ? "reload_rifle" : "reload_pistol";
    if (!fmPlaySample(key,{volume:.55})) prev.reload();
  };
  // Som único do Rifle de Caça: tocar no R e em cada próxima inserção.
  sfx.reloadRound = function() {
    const ac = SND.ac;
    if (!ac || SND.muted) return;
    if (!FM_AUDIO.rifleRoundBuffer) {
      fmLoadRifleRound();
      if (!fmPlaySample("pump", {volume:.28})) prev.reload();
      return;
    }
    const src = ac.createBufferSource(), gain = ac.createGain();
    src.buffer = FM_AUDIO.rifleRoundBuffer;
    // 0,648s originais, acelerados para acompanhar o cartucho (~0,5s).
    src.playbackRate.value = 1.30;
    gain.gain.value = .62;
    src.connect(gain);gain.connect(SND.master);
    src.start();
  };
  sfx.hit = function() { if (!fmPlaySample("gore1",{volume:.30})) prev.hit(); };
  sfx.kill = function(z) {
    const keys=["zombie_die1","zombie_die2","zombie_die3"];
    const id=z?((Math.floor(z.x*17)+Math.floor(z.y*23))>>>0)%3:Math.floor(Math.random()*3);
    if (!fmPlaySample(keys[id],{x:z&&z.x,y:z&&z.y,volume:z&&z.boss?1:.80})) prev.kill();
    if (z && Math.random()<.32) fmPlaySample("gore2",{x:z.x,y:z.y,volume:.42});
  };
  sfx.groan = function(vol,z) {
    const now=performance.now();
    if(now-FM_AUDIO.lastGroan<900)return;
    FM_AUDIO.lastGroan=now;
    const id=z?((Math.floor(z.x*13)+Math.floor(z.y*7))&1):Math.floor(Math.random()*2);
    if (!fmPlaySample(id?"zombie_groan2":"zombie_groan1",{x:z&&z.x,y:z&&z.y,volume:vol*.67})) prev.groan(vol);
  };
  sfx.empty = function() {if(!fmPlaySample("walther",{volume:.2}))prev.empty();};
}
fmInstallAudioSamples();