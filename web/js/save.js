"use strict";
// =====================================================================
//  Progresso que não se perde ao morrer: banco, baú da base (armas e
//  materiais), implantes instalados, personagem, missões, colete e postos.
// =====================================================================
const SAVE_KEY = "fronteira-morta";
const save = {
  bank: 0, vault: [], installed: [], credits: 0, gm: false, vipUntil: 0, trindadeUntil: 0, missions: [], receivedGifts: [], inbox: [],
  vest: -1, outposts: OUTPOSTS.map((o, i) => i === 0), muted: false, hud: 0, skin: 0, cape: 0, prof: null, name: "", classicChar: false, vestDur: {}, vestUpgrades: {}, music: true, gfx: 2, ambientVolume: 0.55, brightness: 1.0,
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
    { const seen = {}; save.installed = (s.installed || []).map(cleanImplant).filter((im) => im && !seen[im.id] && (seen[im.id] = true)).slice(0, IMPL_SLOTS); }
    save.credits = s.credits || 0; save.gm = !!s.gm;
    save.vipUntil = Number.isFinite(s.vipUntil) && s.vipUntil > 0 ? Math.floor(s.vipUntil) : 0;
    save.trindadeUntil = Number.isFinite(s.trindadeUntil) && s.trindadeUntil > 0 ? Math.floor(s.trindadeUntil) : 0;
    save.inbox = Array.isArray(s.inbox)
      ? s.inbox.filter(x => x && typeof x.id === "string" && typeof x.text === "string")
        .slice(-100).map(x => ({ id: x.id.slice(0,50), text: x.text.slice(0,200),
          createdAt: Number(x.createdAt) || Date.now(), read: !!x.read })) : [];
    save.receivedGifts = Array.isArray(s.receivedGifts) ? s.receivedGifts.filter(id => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(-2000) : [];
    save.missions = (s.missions || []).filter((m) => m && m.type && m.target).slice(0, 3);
    save.vest = typeof s.vest === "number" ? s.vest : -1;
    if (s.vestVer !== 2 && save.vest >= 0) save.vest = [0, 2, 4][save.vest] != null ? [0, 2, 4][save.vest] : 0; // coletes do save antigo
    save.vest = clamp(save.vest, -1, VESTS.length - 1);
    save.vestsOwned = VESTS.map((v, i) => !!(s.vestsOwned && s.vestsOwned[i]) || i === save.vest);
    save.vestUpgrades = {};
    for (let i = 0; i < VESTS.length; i++) if (save.vestsOwned[i])
      save.vestUpgrades[i] = cleanVestUpgrade(s.vestUpgrades && s.vestUpgrades[i]);
    save.outposts = OUTPOSTS.map((o, i) => i === 0 || !!(s.outposts && s.outposts[i]));
    save.muted = !!s.muted; save.hud = s.hud === 1 ? 1 : 0; save.skin = clamp(s.skin | 0, 0, SKINS.length - 1); save.cape = clamp(s.cape | 0, 0, CAPES.length - 1); save.prof = typeof s.prof === "string" ? s.prof : null; save.name = typeof s.name === "string" ? s.name.slice(0, 16) : ""; save.classicChar = false; // Somente o novo boneco está disponível.
    save.vestDur = s.vestDur && typeof s.vestDur === "object" ? s.vestDur : {};
    save.music = s.music !== false;
    // sliders do menu: dados antigos recebem padrões seguros
    save.ambientVolume = Number.isFinite(s.ambientVolume) ? clamp(s.ambientVolume, 0, 1) : 0.55;
    save.brightness = Number.isFinite(s.brightness) ? clamp(s.brightness, 0.55, 1.6) : 1;
    save.gfx = s.gfx === 0 || s.gfx === 1 ? s.gfx : 2;
    save.stats = s.stats && typeof s.stats === "object" ? s.stats : {};
    save.story = s.story | 0; save.ach = s.ach && typeof s.ach === "object" ? s.ach : {};
    save.daily = s.daily && s.daily.list ? s.daily : null;
    save.coll = Array.isArray(s.coll) ? s.coll.filter((id) => WDEF[id]) : [];
    if (s.char) {
      const c = s.char;
      save.char.level = Math.min(MAX_LEVEL, Math.max(1, c.level || 1));
      save.char.xp = c.xp || 0; save.char.points = c.points || 0; save.char.wpoints = c.wpoints || 0;
      // Migração: valores de versões antigas acima dos novos limites voltam
      // para a reserva de pontos correspondente, sem apagar investimento.
      ATTRS.forEach((d) => {
        const raw = c.attrs && Number(c.attrs[d.id]);
        const previous = Number.isFinite(raw) ? Math.max(d.start, Math.floor(raw)) : d.start;
        const cap = weaponSkillCap(d.id);
        save.char.attrs[d.id] = Math.min(cap, previous);
        const excess = Math.max(0, previous - cap);
        if (excess) {
          if (WEAPON_SKILL_IDS.includes(d.id)) save.char.wpoints += excess;
          else save.char.points += excess;
        }
      });
    }
  } catch (e) { /* sem armazenamento: o progresso vale só nesta sessão */ }
}
// no .exe o arquivo só é gravado nos checkpoints (troca de área e a cada 1 minuto)
// VIP adquirido no jogo antigo permanece válido como benefício legado.
// Presentes novos são temporários: duração em meses de calendário UTC.
function vipActive() { return !!save.gm || (save.vipUntil || 0) > Date.now(); }
function addVipMonths(months) {
  if (![1, 6, 12].includes(months)) throw new Error("Prazo de VIP não permitido.");
  const start = new Date(Math.max(Date.now(), Number(save.vipUntil) || 0));
  const targetMonth = start.getUTCMonth() + months;
  const d = start.getUTCDate(), next = new Date(start.valueOf());
  next.setUTCDate(1); next.setUTCMonth(targetMonth);
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth()+1, 0)).getUTCDate();
  next.setUTCDate(Math.min(d, last));
  save.vipUntil = next.getTime();
  return save.vipUntil;
}
function vipStatus() {
  if (save.gm) return "VIP legado (sem vencimento)";
  if ((save.vipUntil || 0) <= Date.now()) return "inativo";
  return "ativo até " + new Date(save.vipUntil).toLocaleDateString("pt-BR");
}
function inboxUnread() { return (save.inbox || []).filter(m => !m.read).length; }
function markInboxRead() { if (!save.inbox) return; save.inbox.forEach(x => { x.read = true; }); persist(); }

function persist() {
  if (NATIVE) return;
  storeWrite(JSON.stringify(save)).catch((error) => {
    console.error("Falha ao sincronizar progresso:", error);
    if (typeof game !== "undefined" && game && !game.savingExit)
      toast("Falha na sincronização online. Use Salvar progresso para tentar novamente.");
  });
}
