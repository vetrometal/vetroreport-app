/* VetroReport — sessão (Supabase Auth) e função vr-auth */
App.funcao = async (body) => {
  const cfg = window.VR_CONFIG;
  const headers = { "Content-Type": "application/json", apikey: cfg.SUPABASE_KEY };
  try {
    const { data } = await App.sb.auth.getSession();
    if (data && data.session) headers.Authorization = "Bearer " + data.session.access_token;
  } catch {}
  let r;
  try {
    r = await fetch(cfg.SUPABASE_URL + "/functions/v1/vr-auth", { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    throw new Error("Sem ligação ao servidor. Verifique a internet e tente de novo.");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.erro) throw new Error(j.erro || `Erro ${r.status}`);
  return j;
};

App.entrar = async (login, password) => {
  if (!login || !password) throw new Error("Indique o utilizador e a palavra-passe.");
  const email = VR.authEmail(login);
  let { error } = await App.sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (/fetch|network/i.test(error.message || "")) throw new Error("Sem ligação ao servidor. Verifique a internet e tente de novo.");
    // Conta importada da versão 2.3? Valida a palavra-passe antiga e ativa-a.
    try { await App.funcao({ acao: "legacy_login", login, password }); }
    catch (e2) {
      if (/ligação/.test(e2.message)) throw e2;
      throw new Error("Utilizador ou palavra-passe incorretos.");
    }
    ({ error } = await App.sb.auth.signInWithPassword({ email, password }));
    if (error) throw new Error("Utilizador ou palavra-passe incorretos.");
  }
  await App.iniciarSessao();
};

App.iniciarSessao = async () => {
  const { data: s } = await App.sb.auth.getSession();
  const authUser = s && s.session && s.session.user;
  if (!authUser) throw new Error("Sessão terminada. Entre de novo.");
  const { data: u, error } = await App.sb.from("utilizadores").select("*").eq("auth_id", authUser.id).maybeSingle();
  if (error) throw VR.erroSupabase(error);
  if (!u || u.ativo === false) {
    await App.sb.auth.signOut();
    throw new Error("Esta conta não tem acesso ou está inativa. Fale com a administração.");
  }
  App.user = u;
  localStorage.setItem("vr_user", JSON.stringify(u));
  App.store = new VR.Store(App.sb);
  App.store.onRemoto = App.aoMudarRemoto;
  await App.store.carregar({ admin: u.role === "admin" });
  App.store.ligarRealtime();
  if (u.role === "admin") App.registarVersao().catch(e => console.warn("versoes_app", e));
};

/* Regista a versão atual na tabela versoes_app (histórico na base de dados), uma vez por versão */
App.registarVersao = async () => {
  const v = (VR.CHANGELOG || []).find(x => x.versao === VR.VERSAO);
  if (!v) return;
  const { data } = await App.sb.from("versoes_app").select("versao").eq("versao", v.versao).maybeSingle();
  if (data) return;
  await App.sb.from("versoes_app").insert({ versao: v.versao, data: v.data, resumo: v.titulo, alteracoes: v.alteracoes, registada_por: App.user.id });
};

App.sair = async () => {
  try { if (App.store) await App.store.desligarRealtime(); } catch {}
  try { await App.sb.auth.signOut(); } catch {}
  try { await VR.Cache.limpar(); } catch {}
  localStorage.removeItem("vr_user");
  App.user = null; App.store = null;
  App.fotoUrls.clear();
};

/* Alterações de outros utilizadores (Realtime) */
App._remotoTimer = null;
App.aoMudarRemoto = () => {
  clearTimeout(App._remotoTimer);
  App._remotoTimer = setTimeout(() => {
    const ae = document.activeElement;
    const aEscrever = ae && ae.closest && ae.closest("form") && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
    if (App.importando) return;
    if (App.formSujo || aEscrever) {
      App.remotoPendente = true;
      const rb = document.getElementById("remoto-banner");
      if (rb) rb.hidden = false;
    } else {
      const y = window.scrollY;
      if (!App.msg && App.msgMostrada && Date.now() - App.msgMostrada.em < 8000) App.msg = App.msgMostrada.msg;
      App.render().then(() => window.scrollTo(0, y));
    }
  }, 350);
};
