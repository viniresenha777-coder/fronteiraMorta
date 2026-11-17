"use strict";
// Correio de notificações: apenas recebimentos enviados pelo administrador.
// Não é chat entre jogadores. Mensagens ficam guardadas no save da conta.
function openMessages() {
  if (!game || game.over) return;
  game.paused = false;
  game.menu = "messages";
  game.messagesPage = 0;
  if (inboxUnread()) markInboxRead();
}
function messagesKey(k) {
  if (k === "escape" || k === "i") { game.menu = null; return; }
  const max = Math.max(0, Math.ceil((save.inbox || []).length / 8) - 1);
  if (k === "a" || k === "arrowleft" || k === "w" || k === "arrowup")
    game.messagesPage = Math.max(0, (game.messagesPage || 0) - 1);
  else if (k === "d" || k === "arrowright" || k === "s" || k === "arrowdown")
    game.messagesPage = Math.min(max, (game.messagesPage || 0) + 1);
}
function drawMessages() {
  menuFrame("Mensagens", "Notificações de presentes do administrador");
  const list = (save.inbox || []).slice().reverse();
  const max = Math.max(0, Math.ceil(list.length / 8) - 1);
  game.messagesPage = Math.min(max, Math.max(0, game.messagesPage || 0));
  if (!list.length) {
    txt("Sua caixa está vazia.", W/2, 255, 24, "#e5e0c8", "center", true);
    txt("Você só receberá mensagens aqui quando ganhar dinheiro, arma, material ou VIP.", W/2, 300, 14, "#a9a58f", "center",false,840);
  } else {
    list.slice(game.messagesPage * 8, game.messagesPage * 8 + 8).forEach((m,i)=>{
      const y=115+i*50;
      ctx.fillStyle = "rgba(32,33,27,0.92)";
      rr(62,y,836,43,7);ctx.fill();
      ctx.strokeStyle = "#4c4430";ctx.lineWidth=1;ctx.stroke();
      txt("PRESENTE RECEBIDO",80,y+16,11,"#ffd96a","left",true);
      txt(m.text,80,y+34,13,"#e5e0c8","left",false,760);
      txt(new Date(m.createdAt).toLocaleDateString("pt-BR"),875,y+16,11,"#a9a58f","right");
    });
  }
  if (max) {
    btn(285,530,160,30,"◀ Anteriores",()=>{game.messagesPage=Math.max(0,game.messagesPage-1)},false,game.messagesPage===0);
    txt("Página "+(game.messagesPage+1)+"/"+(max+1),W/2,550,12,"#a9a58f","center");
    btn(515,530,160,30,"Próximas ▶",()=>{game.messagesPage=Math.min(max,game.messagesPage+1)},false,game.messagesPage===max);
  }
  btn(725,530,160,34,"Fechar (Esc)",()=>{game.menu=null;});
  hint("Somente notificações recebidas · I ou Esc fecha");
}
