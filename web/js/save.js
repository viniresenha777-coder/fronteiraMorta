"use strict";
// =====================================================================
//  Progresso que não se perde ao morrer: banco, baú da base (armas e
//  materiais), implantes instalados, personagem, missões, colete e postos.
// =====================================================================
const SAVE_KEY = "fronteira-morta";
const save = {
  bank: 0, vault: [], installed: [], credits: 0, gm: false, missions: [],
  vest: -1, outposts: OUTPOSTS.map((o, i) => i === 0), muted: false, hud: 0, skin: 0, cape: 0, prof: null, name: "", classicChar: false, vestDur: {}, music: true, gfx: 2,
  stats: {}, story: 0, ach: {}, daily: null, coll: [], vestsOwned: VESTS.map(() => false), vestVer: 2,
  char: { level: 1, xp: 0, points: 0, wpoints: 0, attrs: defaultAttrs() }
};

function validItem(it) {
  if (!it) return false;
  if (it.kind === "weapon") {
    if (!WDEF[it.id] || WDEF[it.id].fists) return false;
    it.up = it.up || {};
    for (const s of UP_STATS) it.up[s.id] = clamp(Math.floor(it.up[s.id] || 0), 0, UP_MAX);
    it.ammo = clamp(it.ammo || 0, 0, WDEF[it.id].mag || 0);
    return true;
  }
  return it.kind === "mat" && !!MATS[it.id] && it.qty > 0;
}
function loadSave() {
  try {
    const s = JSON.parse(storeGet());
    if (!s) return;
    save.bank = s.bank || 0;
    save.run = s.run && s.run.v === 1 ? s.run : null; // checkpoint da partida
    if (Array.isArray(s.vault)) save.vault = s.vault.filter(validItem).slice(0, VAULT_MAX);
    else if (Array.isArray(s.stash)) save.vault = s.stash.map((v, i) => (v && OLD_IDS[i] ? newInst(OLD_IDS[i]) : null)).filter(Boolean); // save antigo
    save.installed = (s.installed || []).filter((im) => IMP[im.id] && im.tier >= 1 && im.tier <= 3).slice(0, IMPL_SLOTS);
    save.credits = s.credits || 0; save.gm = !!s.gm;
    save.missions = (s.missions || []).filter((m) => m && m.type && m.target).slice(0, 3);
    save.vest = typeof s.vest === "number" ? s.vest : -1;
    if (s.vestVer !== 2 && save.vest >= 0) save.vest = [0, 2, 4][save.vest] != null ? [0, 2, 4][save.vest] : 0; // coletes do save antigo
    save.vest = clamp(save.vest, -1, VESTS.length - 1);
    save.vestsOwned = VESTS.map((v, i) => !!(s.vestsOwned && s.vestsOwned[i]) || i === save.vest);
    save.outposts = OUTPOSTS.map((o, i) => i === 0 || !!(s.outposts && s.outposts[i]));
    save.muted = !!s.muted; save.hud = s.hud === 1 ? 1 : 0; save.skin = clamp(s.skin | 0, 0, SKINS.length - 1); save.cape = clamp(s.cape | 0, 0, CAPES.length - 1); save.prof = typeof s.prof === "string" ? s.prof : null; save.name = typeof s.name === "string" ? s.name.slice(0, 16) : ""; save.classicChar = !!s.classicChar; save.vestDur = s.vestDur && typeof s.vestDur === "object" ? s.vestDur : {};
    save.music = s.music !== false;
    save.gfx = s.gfx === 0 || s.gfx === 1 ? s.gfx : 2;
    save.stats = s.stats && typeof s.stats === "object" ? s.stats : {};
    save.story = s.story | 0; save.ach = s.ach && typeof s.ach === "object" ? s.ach : {};
    save.daily = s.daily && s.daily.list ? s.daily : null;
    save.coll = Array.isArray(s.coll) ? s.coll.filter((id) => WDEF[id]) : [];
    if (s.char) {
      const c = s.char;
      save.char.level = Math.min(MAX_LEVEL, Math.max(1, c.level || 1));
      save.char.xp = c.xp || 0; save.char.points = c.points || 0; save.char.wpoints = c.wpoints || 0;
      ATTRS.forEach((d) => { save.char.attrs[d.id] = Math.min(ATTR_MAX, Math.max(d.start, (c.attrs && c.attrs[d.id]) || d.start)); });
    }
  } catch (e) { /* sem armazenamento: o progresso vale só nesta sessão */ }
}
// no .exe o arquivo só é gravado nos checkpoints (troca de área e a cada 1 minuto)
function persist() { if (NATIVE) return; storeWrite(JSON.stringify(save)); }
