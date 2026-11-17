"use strict";
// O jogo só é carregado depois da autenticação e da leitura do save online.
const loginForm = document.getElementById("login");
const statusEl = document.getElementById("login-status");
const emailEl = document.getElementById("login-email");
const passwordEl = document.getElementById("login-password");
const confirmRow = document.getElementById("confirm-row");
const confirmEl = document.getElementById("login-confirm");
const importRow = document.getElementById("import-row");
const importEl = document.getElementById("import-save");
let starting = false;
let loaded = false;

function loginStatus(message, bad = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", bad);
}
function loginBusy(busy) {
  starting = busy;
  for (const button of loginForm.querySelectorAll("button")) button.disabled = busy;
}
async function startGame() {
  if (loaded) return;
  loaded = true;
  loginForm.hidden = true;
  const stage = document.querySelector(".wrap");
  stage.hidden = false;
  // Um erro de JavaScript durante a inicialização não pode deixar só a tela preta.
  let scriptError = null;
  const onScriptError = (event) => {
    if (!scriptError) scriptError = event.error || new Error(event.message || "Falha no jogo");
  };
  window.addEventListener("error", onScriptError);
  try {
    for (const scriptTag of document.getElementById("game-scripts").content.querySelectorAll("script")) {
      const script = document.createElement("script");
      script.src = scriptTag.getAttribute("src");
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => reject(new Error("Erro ao carregar " + script.src));
        document.body.appendChild(script);
      });
      if (scriptError) throw scriptError;
    }
    passwordEl.value = "";
    confirmEl.value = "";
  } catch (error) {
    stage.hidden = true;
    loginForm.hidden = false;
    loginStatus("Erro ao abrir o jogo: " + (error.message || String(error)) +
      ". Atualize a página com Ctrl+Shift+R. Seu progresso foi preservado.", true);
    throw error;
  } finally {
    window.removeEventListener("error", onScriptError);
  }
}
async function enterAccount(registering) {
  const email = emailEl.value.trim();
  const password = passwordEl.value;
  if (registering && (password.length < 8 || confirmEl.value !== password))
    throw new Error("Para criar a conta, use pelo menos 8 caracteres e confirme a mesma senha.");
  const loggedIn = await fmCloud.login(email, password, registering);
  if (!loggedIn) {
    confirmRow.hidden = true;
    confirmEl.value = "";
    loginStatus("Se este e-mail ainda não tiver uma conta, você receberá uma mensagem de confirmação. Se já estiver cadastrado, use Entrar com sua senha. Não é necessário criar outra conta.");
    return;
  }
  if (importEl.checked && !fmCloud.hasOnlineSave()) {
    const oldData = localStorage.getItem("fronteira-morta");
    if (oldData) {
      JSON.parse(oldData);
      await fmCloud.write(oldData);
    }
  }
  loginStatus("Partida carregada. Iniciando...");
  await startGame();
}
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (starting || loaded) return;
  const registering = event.submitter && event.submitter.value === "register";
  if (registering && confirmRow.hidden) {
    confirmRow.hidden = false;
    confirmEl.focus();
    loginStatus("Confirme a senha e clique novamente em Criar conta.");
    return;
  }
  loginBusy(true);
  loginStatus(registering ? "Criando conta..." : "Entrando...");
  try {
    await enterAccount(registering);
  } catch (error) {
    loginStatus(displayAuthError(error), true);
  } finally {
    loginBusy(false);
  }
});
function displayAuthError(error) {
  const detail = String(error && error.message || error || "");
  if (/failed to fetch|networkerror|load failed/i.test(detail))
    return "Não foi possível conectar ao Supabase. Atualize a página e use Testar conexão; verifique extensões, VPN ou bloqueios de rede.";
  return detail || "Não foi possível concluir a solicitação.";
}
document.getElementById("test-connection").addEventListener("click", async () => {
  if (starting) return;
  loginBusy(true);
  loginStatus("Testando conexão com o Supabase...");
  try {
    const host = await fmCloud.ping();
    loginStatus("Servidor acessível: " + host + ". Agora tente entrar ou criar a conta.");
  } catch (error) {
    loginStatus(displayAuthError(error), true);
  } finally {
    loginBusy(false);
  }
});

// Recuperação de senha não solicita a senha atual e não expõe se o e-mail existe.
const forgotForm = document.getElementById("forgot-form");
const forgotEmail = document.getElementById("forgot-email");
const forgotStatus = document.getElementById("forgot-status");
let forgotBusy = false;
document.getElementById("forgot-password").addEventListener("click", () => {
  if (starting || loaded) return;
  forgotEmail.value = emailEl.value.trim();
  forgotStatus.textContent = "";
  forgotStatus.classList.remove("error");
  loginForm.hidden = true;
  forgotForm.hidden = false;
  forgotEmail.focus();
});
document.getElementById("forgot-back").addEventListener("click", () => {
  if (forgotBusy) return;
  emailEl.value = forgotEmail.value.trim();
  forgotForm.hidden = true;
  loginForm.hidden = false;
  loginStatus("Entre com sua conta ou solicite um novo link de recuperação.");
  emailEl.focus();
});
forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (forgotBusy) return;
  if (!forgotEmail.reportValidity()) return;
  forgotBusy = true;
  for (const button of forgotForm.querySelectorAll("button")) button.disabled = true;
  forgotStatus.textContent = "Solicitando link de recuperação...";
  forgotStatus.classList.remove("error");
  try {
    await fmCloud.sendPasswordRecovery(forgotEmail.value);
    forgotStatus.textContent = "Se este e-mail estiver cadastrado, enviaremos um link de recuperação. Abra o link no e-mail para confirmar que a conta é sua e definir uma nova senha. Confira também o spam.";
  } catch (error) {
    forgotStatus.classList.add("error");
    forgotStatus.textContent = displayAuthError(error);
  } finally {
    forgotBusy = false;
    for (const button of forgotForm.querySelectorAll("button")) button.disabled = false;
  }
});

document.getElementById("resend-confirmation").addEventListener("click", async () => {
  if (starting) return;
  if (!emailEl.reportValidity()) return;
  loginBusy(true);
  loginStatus("Reenviando confirmação...");
  try {
    await fmCloud.resend(emailEl.value);
    loginStatus("Se a confirmação estiver pendente, confira o e-mail de confirmação mais recente.");
  } catch (error) {
    loginStatus(displayAuthError(error), true);
  } finally {
    loginBusy(false);
  }
});

(async () => {
  try {
    if (localStorage.getItem("fronteira-morta")) importRow.hidden = false;
  } catch (_) { /* navegação privada sem acesso ao armazenamento */ }
  const urlError = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (urlError.get("error")) {
    const expired = urlError.get("error_code") === "otp_expired";
    loginStatus(expired ? "O link de confirmação expirou. Informe seu e-mail e clique em Reenviar confirmação."
      : (urlError.get("error_description") || "Não foi possível confirmar o e-mail."), true);
    history.replaceState(null, "", location.pathname + location.search);
    return;
  }
  loginStatus("Verificando sessão...");
  try {
    if (await fmCloud.resume()) {
      loginStatus("Sessão restaurada. Carregando seu jogo...");
      await startGame();
    } else {
      loginStatus("Entre ou crie sua conta para continuar o jogo.");
    }
  } catch (error) {
    loginStatus(displayAuthError(error), true);
  }
})();
