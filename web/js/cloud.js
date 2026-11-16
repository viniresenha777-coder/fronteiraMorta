"use strict";
const fmCloud = (() => {
  const url = "https://kvqeewdtectoeqjmirla.supabase.co";
  const apiKey = "sb_publishable_1KZ1w_Mi-oDTJhKb5aR8yA_97uFMVwn";
  let session, expiresAt, revision, snapshot, pending = Promise.resolve();

  async function request(path, method, body, token, headers = {}) {
    const response = await fetch(url + path, {
      method, headers: {apikey: apiKey, "Content-Type": "application/json",
        ...(token ? {Authorization: "Bearer " + token} : {}), ...headers},
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      if (detail.code === "PGRST205") throw Error("O banco de partidas ainda precisa ser configurado pelo administrador.");
      if (detail.error_code === "email_not_confirmed") throw Error("Confirme seu e-mail antes de entrar.");
      if (detail.error_code === "invalid_credentials") throw Error("E-mail ou senha incorretos.");
      if (response.status === 409) throw Error("A partida foi alterada em outra sessão. Entre novamente.");
      throw Error(detail.msg || detail.message || "O serviço online não respondeu.");
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function setSession(data) {
    session = data;
    expiresAt = Date.now() + data.expires_in * 1000;
  }

  async function login(email, password, register) {
    const route = register ? "/auth/v1/signup?redirect_to=" + encodeURIComponent(location.origin + location.pathname) : "/auth/v1/token?grant_type=password";
    const data = await request(route, "POST", {email, password});
    if (!data.access_token) return null;
    setSession(data);
    const rows = await request("/rest/v1/fm_partidas?select=progresso,revisao&jogador=eq." + data.user.id, "GET", undefined, data.access_token);
    snapshot = rows.length ? JSON.stringify(rows[0].progresso) : null;
    revision = rows[0]?.revisao || null;
    return Object.freeze({id: data.user.id, cloud: true, owner: data.user.app_metadata?.fm_owner === true});
  }

  function write(str) {
    const operation = pending.then(async () => {
      if (expiresAt - Date.now() < 60000) {
        setSession(await request("/auth/v1/token?grant_type=refresh_token", "POST", {refresh_token: session.refresh_token}));
      }
      const next = crypto.randomUUID();
      const body = {progresso: JSON.parse(str), revisao: next};
      let route = "/rest/v1/fm_partidas";
      if (revision) route += "?jogador=eq." + session.user.id + "&revisao=eq." + revision;
      else body.jogador = session.user.id;
      const rows = await request(route + (revision ? "&" : "?") + "select=revisao", revision ? "PATCH" : "POST", body, session.access_token, {Prefer:"return=representation"});
      if (rows?.[0]?.revisao !== next) throw Error("Partida alterada em outra sessão. Entre novamente.");
      revision = next;
      snapshot = str;
    });
    pending = operation.catch(() => {});
    return operation;
  }
  return {login, write, read: () => snapshot};
})();
