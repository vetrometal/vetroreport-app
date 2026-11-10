/* VetroReport — arranque */
/* Versão nova do service worker à espera: mostra o aviso fixo «Nova versão disponível — atualizar» */
App.novaVersao = (worker) => {
  App.swEspera = worker;
  let el = document.getElementById("nova-versao");
  if (!el) {
    el = document.createElement("div");
    el.id = "nova-versao"; el.className = "update-toast"; el.setAttribute("role", "status");
    el.innerHTML = `<span>Nova versão disponível —</span><button type="button" class="btn" data-atualizar-app>atualizar</button>`;
    document.body.appendChild(el);
    el.querySelector("button").addEventListener("click", () => App.aplicarAtualizacao());
  }
};
App.aplicarAtualizacao = () => {
  if (App.formSujo && !confirm("Tem alterações por gravar. Atualizar a aplicação agora e perdê-las?")) return;
  App.atualizarPedido = true;
  if (App.swEspera) App.swEspera.postMessage("ATUALIZAR"); else location.reload();
  setTimeout(() => location.reload(), 4000);
};

App.boot = async () => {
  window.addEventListener("hashchange", () => App.render());
  const cfg = window.VR_CONFIG;
  App.sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "vetroreport-sessao" },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  window.__VR__ = { App, VR };

  // Instalação (Android / Chrome / Edge)
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    App.installPrompt = e;
    const { path } = App.route();
    if (path === "/entrar" || path === "/mais") App.render();
  });
  window.addEventListener("appinstalled", () => { App.installPrompt = null; });

  // Voltar à app / voltar a ter rede => dados frescos
  const refrescar = async () => {
    if (!App.user || !App.store || App.store.ocupado) return;
    const velho = Date.now() - (App.store.carregadoEm || 0) > 30000;
    if (!velho && !App.store.offline) return;
    try {
      await App.store.carregar({ admin: App.user.role === "admin" });
      App.store.ligarRealtime();
      App.aoMudarRemoto();
    } catch (e) { console.warn("refrescar", e); }
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refrescar(); });
  window.addEventListener("online", refrescar);
  window.addEventListener("offline", () => { if (App.store) { App.store.offline = true; App.store.leitura = true; App.aoMudarRemoto(); } });

  App.sb.auth.onAuthStateChange((ev) => {
    if (ev === "SIGNED_OUT" && App.user) {
      App.user = null; App.store = null;
      App.toast("A sessão terminou. Entre de novo.", "erro");
      if (!App.go("/entrar")) App.render();
    }
  });

  // Sessão guardada?
  try {
    const { data } = await App.sb.auth.getSession();
    if (data && data.session) {
      // Sem rede: abre com os últimos dados guardados (só consulta)
      const semRede = async () => {
        const u = JSON.parse(localStorage.getItem("vr_user") || "null");
        const st = new VR.Store(App.sb);
        if (u && await st.carregarCache()) { App.user = u; App.store = st; st.onRemoto = App.aoMudarRemoto; }
        else App.toast("Sem ligação ao servidor.", "erro");
      };
      if (!navigator.onLine) await semRede();
      else {
        try {
          await App.iniciarSessao();
        } catch (e) {
          if (/ligação|fetch|network/i.test(e.message || "")) await semRede();
          else App.toast(e.message, "erro");
        }
      }
    }
  } catch (e) { console.warn(e); }

  const { path } = App.route();
  if (App.user && (path === "/entrar" || path === "/primeira" || !location.hash)) { if (!App.go("/hoje")) await App.render(); }
  else if (!App.user && path !== "/primeira" && path !== "/entrar") { if (!App.go("/entrar")) await App.render(); }
  else await App.render();

  // Service worker (app instalável + funciona sem rede + avisa quando há versão nova)
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    let recarregou = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!App.atualizarPedido || recarregou) return;
      recarregou = true;
      location.reload();
    });
    const vigiar = (reg) => {
      App.swReg = reg;
      const novo = () => { if (reg.waiting && navigator.serviceWorker.controller) App.novaVersao(reg.waiting); };
      novo();
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        if (w) w.addEventListener("statechange", () => { if (w.state === "installed") novo(); });
      });
    };
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(vigiar).catch(e => console.warn("SW", e));
    // Procura atualizações quando a app volta ao primeiro plano e de hora a hora
    const procurar = () => { if (App.swReg && navigator.onLine) App.swReg.update().catch(() => {}); };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") procurar(); });
    setInterval(procurar, 60 * 60 * 1000);
  }
};

document.addEventListener("DOMContentLoaded", () => App.boot());
