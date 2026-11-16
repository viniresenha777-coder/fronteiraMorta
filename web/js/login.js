"use strict";
let localPlayer;
const loginForm = document.getElementById("login");
const ownerLogin = { salt: "4c5a2300ca011aa66bf4aea3daf6358c", hash: "e21a844ea40e50a55349f16228596c47183f710b64b667a97201027bbbc1968a" };

async function passwordHash(password, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", iterations: 600000, salt: encoder.encode(salt)}, key, 256);
  return Array.from(new Uint8Array(bits), n => n.toString(16).padStart(2, "0")).join("");
}

async function authenticate(name, password, registering) {
  const owner = name === "marcos";
  const key = "fronteira-morta:login:" + name;
  const record = owner ? ownerLogin : JSON.parse(localStorage.getItem(key));
  if (registering) {
    if (record) throw new Error("Este usuário já existe. Use Entrar.");
    if (password.length < 8) throw new Error("Escolha uma senha com pelo menos 8 caracteres.");
    const salt = crypto.randomUUID();
    const hash = await passwordHash(password, salt);
    if (localStorage.getItem(key)) throw new Error("Este usuário já existe. Use Entrar.");
    localStorage.setItem(key, JSON.stringify({ salt, hash }));
  } else if (!record || await passwordHash(password, record.salt) !== record.hash) {
    throw new Error("Usuário ou senha incorretos.");
  }
  return Object.freeze({name, owner});
}

const fields = loginForm.elements;
function updateLoginMode() {
  const online = fields.mode.value === "cloud";
  fields.user.type = online ? "email" : "text";
  fields.user.maxLength = online ? 254 : 32;
  fields.user.pattern = online ? ".*" : "[a-zA-Z0-9_]{1,32}";
  document.getElementById("account-label").textContent = online ? "E-mail" : "Usuário";
  document.getElementById("migration").hidden = !online;
  document.getElementById("confirm-row").hidden = true;
  fields.confirmation.value = "";
  loginForm.querySelector("[role=status]").textContent = "";
}
fields.mode.addEventListener("change", updateLoginMode);
updateLoginMode();

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (loginForm.dataset.busy) return;
  loginForm.dataset.busy = "1";
  const status = loginForm.querySelector("[role=status]");
  const name = loginForm.elements.user.value.toLowerCase();
  const registering = event.submitter?.name === "register";
  status.textContent = "Verificando…";
  try {
    if (!crypto.subtle) throw new Error("Abra o jogo por HTTPS ou localhost para entrar.");
    if (fields.mode.value === "cloud") {
      if (registering && document.getElementById("confirm-row").hidden) {
        document.getElementById("confirm-row").hidden = false;
        fields.confirmation.focus();
        throw Error("Confirme a senha e clique novamente em Criar conta.");
      }
      if (registering && (fields.password.value.length < 8 || fields.password.value !== fields.confirmation.value))
        throw Error("Use pelo menos 8 caracteres e confirme a mesma senha.");
      localPlayer = await fmCloud.login(name.trim(), fields.password.value, registering);
      if (!localPlayer) throw Error("Confira seu e-mail para confirmar o cadastro. Depois use Entrar.");
      if (fields.legacy.value.trim()) {
        if (fmCloud.read() !== null) throw Error("Já existe uma partida online. Apague o campo Usuário local para continuar com ela.");
        const legacy = await authenticate(fields.legacy.value.trim().toLowerCase(), fields.legacyPassword.value, false);
        const old = localStorage.getItem(legacy.owner ? "fronteira-morta" : "fronteira-morta:save:" + legacy.name);
        if (!old) throw Error("Nenhuma partida local encontrada neste navegador.");
        await fmCloud.write(old);
      }
    } else {
      localPlayer = await authenticate(name, fields.password.value, registering);
    }
  } catch (error) {
    status.textContent = error instanceof DOMException || error instanceof SyntaxError ? "O armazenamento local está indisponível." : error.message;
    delete loginForm.dataset.busy;
    return;
  }
  fields.password.value = fields.confirmation.value = fields.legacyPassword.value = "";
  document.getElementById("admin-help").hidden = !localPlayer.owner;
  document.querySelector(".wrap").hidden = false;
  loginForm.hidden = true;
  for (const source of document.getElementById("scripts").content.querySelectorAll("script")) {
    const script = document.createElement("script");
    script.src = source.getAttribute("src");
    try {
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.body.append(script);
      });
    } catch {
      document.querySelector(".wrap").hidden = true;
      loginForm.hidden = false;
      status.textContent = "Falha ao carregar o jogo. Atualize a página para tentar de novo.";
      return;
    }
  }
});
