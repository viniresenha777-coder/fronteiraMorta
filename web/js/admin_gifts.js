"use strict";
// Correio administrativo: o Supabase autoriza as ofertas; somente contas
// registradas em fm_administradores podem criar presentes (RLS no servidor).
const fmGifts = (() => {
  let timer = null, busy = false;
  const db = () => fmCloud.socialClient();
  const uid = () => fmCloud.userId();
  const normalize = v => String(v || "").trim();
  const types = new Set(["dinheiro", "vip", "arma", "material"]);

  async function send(name, type, amount, itemId) {
    if (!fmCloud.isActive() || !fmCloud.isAdmin()) throw new Error("Envio indisponível.");
    const targetName = normalize(name);
    if (targetName.length < 3 || targetName.length > 16) throw new Error("Digite o nome exato do jogador.");
    if (!types.has(type)) throw new Error("Tipo de presente inválido.");
    const n = type === "arma" ? 1 : Math.floor(Number(amount));
    if (type === "vip" && ![1, 6, 12].includes(n)) throw new Error("Escolha VIP por 1 mês, 6 meses ou 1 ano.");
    if (!Number.isInteger(n) || n < 1 || n > 10000000) throw new Error("Quantidade inválida.");
    if (type === "material" && n > 1000) throw new Error("Máximo: 1.000 materiais.");
    if (type === "arma" && (!WDEF[itemId] || WDEF[itemId].fists)) throw new Error("Arma inexistente. Use o ID da arma.");
    if (type === "material" && !Object.prototype.hasOwnProperty.call(MATS, itemId)) throw new Error("Material inexistente.");
    const { data: profiles, error: lookupError } = await db().from("fm_perfis")
      .select("jogador,nome").ilike("nome", targetName).limit(25);
    if (lookupError) throw new Error("Falha ao buscar jogador: " + lookupError.message);
    const target = (profiles || []).find(p => p.nome.toLocaleLowerCase("pt-BR") === targetName.toLocaleLowerCase("pt-BR"));
    if (!target) throw new Error("Jogador não encontrado: confira o nome exato.");
    if (target.jogador === uid()) throw new Error("O destinatário precisa ser outra conta.");
    const payload = {
      remetente: uid(), destinatario: target.jogador, tipo: type,
      quantidade: n, item_id: type === "arma" || type === "material" ? itemId : null
    };
    const { error } = await db().from("fm_presentes").insert(payload);
    if (error) throw new Error("Envio recusado pelo servidor: " + error.message);
    return "Presente enviado para " + target.nome + ".";
  }

  async function acknowledge(id) {
    const { error } = await db().from("fm_presentes")
      .update({ recebido_em: new Date().toISOString() })
      .eq("id", id).eq("destinatario", uid()).is("recebido_em", null);
    if (error) console.warn("Aviso: entrega já salva, confirmação pendente:", error);
  }
  function canReceive(g) {
    if (g.tipo === "arma") return !!WDEF[g.item_id] && !WDEF[g.item_id].fists &&
      (player.slots.includes(null) || packUsed() < PACK_MAX);
    if (g.tipo === "material") return !!MATS[g.item_id] &&
      (player.pack.some(it => it.kind === "mat" && it.id === g.item_id) || packUsed() < PACK_MAX);
    if (g.tipo === "vip") return [1, 6, 12].includes(g.quantidade);
    return g.tipo === "dinheiro" && Number.isInteger(g.quantidade) && g.quantidade > 0;
  }
  function apply(g) {
    if (g.tipo === "dinheiro") game.money += g.quantidade;
    else if (g.tipo === "vip") addVipMonths(g.quantidade);
    else if (g.tipo === "arma") return !!addWeapon(newInst(g.item_id));
    else if (g.tipo === "material") return !!addMat(g.item_id, g.quantidade);
    return true;
  }
  async function poll() {
    if (busy || !fmCloud.isActive() || !uid() || !save.name || !save.prof ||
        !world || game.over || game.savingExit || game.quitting) return;
    busy = true;
    try {
      const { data, error } = await db().from("fm_presentes")
        .select("id,tipo,quantidade,item_id,criado_em")
        .eq("destinatario", uid()).is("recebido_em", null)
        .order("criado_em", { ascending: true }).limit(30);
      if (error) throw error;
      if (!Array.isArray(save.receivedGifts)) save.receivedGifts = [];
      for (const g of data || []) {
        if (save.receivedGifts.includes(g.id)) { await acknowledge(g.id); continue; }
        if (!canReceive(g)) {
          if (!game.giftBagWarnAt || Date.now() - game.giftBagWarnAt > 30000) {
            game.giftBagWarnAt = Date.now();
            toast("Você tem um presente pendente. Abra espaço na mochila!");
          }
          continue;
        }
        // Snapshot de rollback para falhas de rede. Nunca confirma presente
        // antes de salvar o UUID de recebimento no progresso do destinatário.
        const old = {
          money: game.money, gm: save.gm, vipUntil: save.vipUntil, run: save.run,
          gifts: save.receivedGifts.slice(), inbox: (save.inbox || []).slice(),
          slots: player.slots.slice(), pack: player.pack.slice()
        };
        try {
          if (!apply(g)) throw new Error("Sem espaço para o presente.");
          save.receivedGifts.push(g.id);
          const description = g.tipo === "dinheiro" ? "$" + g.quantidade.toLocaleString("pt-BR") :
            g.tipo === "vip" ? "VIP de " + (g.quantidade === 12 ? "1 ano" : g.quantidade + (g.quantidade === 1 ? " mês" : " meses")) +
              " · válido até " + new Date(save.vipUntil).toLocaleDateString("pt-BR") :
            g.tipo === "arma" ? WDEF[g.item_id].name :
              g.quantidade + "x " + MATS[g.item_id].name;
          if (!Array.isArray(save.inbox)) save.inbox = [];
          save.inbox.push({ id: g.id, text: "Presente do administrador: " + description,
            createdAt: Date.now(), read: false });
          save.inbox = save.inbox.slice(-100);
          save.run = runSnapshot();
          await storeWrite(JSON.stringify(save));
        } catch (err) {
          game.money = old.money; save.gm = old.gm; save.vipUntil = old.vipUntil; save.run = old.run;
          save.receivedGifts = old.gifts; save.inbox = old.inbox;
          player.slots = old.slots; player.pack = old.pack;
          throw err;
        }
        await acknowledge(g.id);
        game.banner = { text: "VOCÊ RECEBEU UM PRESENTE!", sub: "Abra Mensagens (I) para ver os detalhes.",
          t: 4800, gold: true };
        toast("Novo presente do administrador! Veja em Mensagens (I).");
      }
    } catch (err) {
      console.warn("Correio de presentes:", err);
    } finally { busy = false; }
  }
  function start() {
    if (timer) return;
    poll();
    timer = setInterval(poll, 12000);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  return { send, start, stop, poll };
})();
