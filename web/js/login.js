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
    localPlayer = await authenticate(name, loginForm.elements.password.value, registering);
  } catch (error) {
    status.textContent = error instanceof DOMException || error instanceof SyntaxError ? "O armazenamento local está indisponível." : error.message;
    delete loginForm.dataset.busy;
    return;
  }
  loginForm.elements.password.value = "";
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
