/* VetroReport — interface (SPA hash-router) */
const App = {
  store: null,
  user: null,
  msg: null,
  dataISO: VR.hojeISO(),
  fotoUrls: new Map(),
  sb: null,
  remotoPendente: false,
  formSujo: false,
};

App.toast = (texto, tipo="ok") => { App.msg = { texto, tipo }; };
App.clearMsg = () => { App.msg = null; };

App.route = () => {
  const h = (location.hash || "#/hoje").replace(/^#/, "") || "/hoje";
  const [path, qs] = h.split("?");
  const params = Object.fromEntries(new URLSearchParams(qs||""));
  if (params.data) App.dataISO = params.data;
  return { path, params };
};

App.go = (path, params={}) => {
  const q = new URLSearchParams(params).toString();
  const next = "#" + path + (q ? "?"+q : "");
  if (location.hash === next) return false;
  location.hash = next;
  return true; // o hashchange chama App.render
};

App.requireAuth = () => {
  if (!App.user) { App.go("/entrar"); return false; }
  return true;
};
App.requireAdmin = () => App.user && App.user.role === "admin";

App.render = async () => {
  const root = document.getElementById("app");
  const { path, params } = App.route();
  let html;
  try {
    if (path === "/entrar") html = App.views.login();
    else if (path === "/primeira") html = App.views.primeira();
    else if (!App.user || !App.store) { if (!App.go("/entrar")) { root.innerHTML = App.views.login(); App.bind(); } return; }
    else if (path === "/importar") html = App.views.importar();
    else if (path === "/hoje" || path === "/" || path === "") html = await App.views.hoje();
    else if (path === "/registar") html = App.views.registar(params);
    else if (path.startsWith("/ficha/")) html = await App.views.ficha(Number(path.split("/")[2]), params);
    else if (path === "/mural") html = await App.views.mural();
    else if (path === "/relatorios") html = App.views.relatorios(params);
    else if (path === "/mais") html = App.views.mais();
    else if (path === "/funcionarios") html = App.views.funcionarios();
    else if (path === "/funcionario/novo" || path.startsWith("/funcionario/editar/")) html = App.views.funcionarioForm(path);
    else if (path.startsWith("/funcionario/")) html = App.views.fichaFuncionario(Number(path.split("/")[2]));
    else if (path === "/obras") html = App.views.obras();
    else if (path === "/obra/nova" || path.startsWith("/obra/editar/")) html = App.views.obraForm(path);
    else if (path === "/equipas") html = App.views.equipas();
    else if (path === "/equipa/nova" || path.startsWith("/equipa/editar/")) html = App.views.equipaForm(path);
    else if (path === "/responsaveis") html = App.views.responsaveis();
    else if (path === "/responsavel/novo" || path.startsWith("/responsavel/editar/")) html = App.views.responsavelForm(path);
    else if (path === "/definicoes") html = App.views.definicoes();
    else if (path === "/auditoria") html = App.views.auditoria();
    else if (path === "/historico") html = App.views.historico();
    else html = `<main class="app-main"><p class="empty">Página não encontrada.</p></main>`;
  } catch (e) {
    console.error(e);
    html = `<main class="app-main"><div class="banner banner-bad">${VR.esc(e.message||e)}</div></main>`;
  }
  root.innerHTML = html;
  App.formSujo = false;
  App.remotoPendente = false;
  App.bind();
};

App.shell = (content, active) => {
  const avisos = (App.store && App.store.avisos) || [];
  let banners = "";
  if (App.store && App.store.offline) {
    banners += `<div class="desktop-banner bad" data-offline>Sem ligação à internet. Está a ver os últimos dados guardados neste dispositivo; não é possível gravar.</div>`;
  }
  banners += `<div class="desktop-banner info" id="remoto-banner" hidden>Há alterações de outro utilizador. <button type="button" class="link-btn" data-action="atualizar-dados">Atualizar</button></div>`;
  for (const a of avisos) banners += `<div class="desktop-banner bad">${VR.esc(a)}</div>`;
  if (App.msg) { banners += `<ul class="messages"><li class="message ${App.msg.tipo==="erro"?"error":""}">${VR.esc(App.msg.texto)}</li></ul>`; App.msgMostrada = { msg: App.msg, em: Date.now() }; }
  App.clearMsg();
  return `<a class="skip" href="#conteudo">Saltar para o conteúdo</a>
<div class="app">
${App.nav(active)}
<main class="app-main" id="conteudo">${banners}${content}</main>
</div>`;
};

App.nav = (active) => {
  const item = (href, nome, svg, keys) => {
    const on = keys.includes(active);
    return `<a href="#${href}" class="${on?"is-active":""}" ${on?'aria-current="page"':""}>${svg}<span>${nome}</span></a>`;
  };
  return `<nav class="bottom-nav" aria-label="Principal">
  <p class="nav-brand">Vetro<span>Report</span></p>
  ${item("/hoje","Hoje",`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"></path></svg>`,["hoje"])}
  ${item("/registar","Registar",`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.5h8a2 2 0 0 1 2 2V20l-6-3-6 3V5.5a2 2 0 0 1 2-2z"></path><path d="M9 8.5h6M9 12h6"></path></svg>`,["registar","ficha"])}
  ${item("/mural","Mural",`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5h14M5 12h14M5 17.5h9"></path></svg>`,["mural"])}
  ${item("/relatorios","Relatórios",`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V10M10 19V5M15 19v-6M20 19V8"></path></svg>`,["relatorios"])}
  ${item("/mais","Mais",`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.4"></circle><circle cx="12" cy="12" r="1.4"></circle><circle cx="18" cy="12" r="1.4"></circle></svg>`,["mais","funcionarios","obras","equipas","responsaveis","definicoes","auditoria","importar","historico"])}
</nav>`;
};

App.dateNav = (basePath) => {
  const iso = App.dataISO;
  const ant = VR.addDays(iso,-1), prox = VR.addDays(iso,1);
  const q = (d) => `${basePath}?data=${d}`;
  const label = iso.split("-").reverse().join("/");
  return `<div class="date-nav">
  <a class="nav-arrow" href="#${q(ant)}" aria-label="Dia anterior"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></a>
  <form class="date-form" data-date-nav="${basePath}">
    <label class="date-face"><span>${VR.esc(label)}</span>
      <input type="date" name="data" value="${iso}" aria-label="Escolher data">
    </label>
  </form>
  <a class="nav-arrow" href="#${q(prox)}" aria-label="Dia seguinte"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></a>
  ${iso!==VR.hojeISO()?`<a class="today-link" href="#${q(VR.hojeISO())}">Hoje</a>`:""}
</div>`;
};

App.avatar = (f, lg=false) => {
  const eq = VR.Services.equipaPorId(App.store.data, f.equipa_id);
  const cor = VR.corEquipa(eq?eq.nome:"");
  return `<span class="avatar ${lg?"lg":""}" style="background:${cor}">${VR.esc(VR.iniciais(f.nome))}</span>`;
};

App.horarioHtml = (reg, minutosSec) => {
  const pares = VR.horarioTextos(reg);
  if (pares.length) {
    return pares.map(p=>`<b class="num horario-destaque">${VR.esc(p)}</b>`).join("") +
      (minutosSec!=null ? `<small class="num horas-sec">${VR.esc(VR.fmtHm(minutosSec))}</small>` : "");
  }
  return minutosSec!=null ? `<b class="num">${VR.esc(VR.fmtHm(minutosSec))}</b>` : "";
};

/* «Criado por X em dd/mm/aaaa HH:MM · Alterado por Y em …» (dados da base de dados, 24h) */
App.nomeAutor = (id, origem) => {
  if (id != null) { const u = VR.Services.userPorId(App.store.data, id); if (u) return u.nome; return "utilizador removido"; }
  return origem === "importado" ? "importado" : "sistema";
};
App.autoria = (row) => {
  if (!row || !row.criado_em) return "";
  const partes = [`Criado por <b>${VR.esc(App.nomeAutor(row.criado_por, row.origem))}</b> em ${VR.esc(VR.fmtDataHora24(row.criado_em))}`];
  if (row.origem === "importado" && row.criado_por != null) partes[0] += " (importado da v2.3)";
  const alterado = row.alterado_em && Math.abs(new Date(row.alterado_em) - new Date(row.criado_em)) > 1000;
  if (alterado) partes.push(`Alterado por <b>${VR.esc(App.nomeAutor(row.alterado_por, row.origem))}</b> em ${VR.esc(VR.fmtDataHora24(row.alterado_em))}`);
  return `<p class="autoria" data-autoria>${partes.join(" · ")}</p>`;
};

App.views = {};

App.marca = () => `<img class="login-logo" src="icons/icon-192.png" alt="" width="84" height="84">`;

App.views.login = () => {
  const aviso = App.msg
    ? `<div class="banner ${App.msg.tipo==="erro"?"banner-bad":""}" role="alert">${VR.esc(App.msg.texto)}</div>`
    : "";
  App.clearMsg();
  return `<div class="login-body"><section class="login-card">
  ${App.marca()}
  <p class="eyebrow">Vetrometal</p>
  <h1>VetroReport</h1>
  <p class="lede">Registo diário das equipas, no telemóvel, para o processamento de salários.</p>
  ${aviso}
  <form data-action="login">
    <label class="field"><span>Utilizador ou email</span><input class="input" name="login" required autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"></label>
    <label class="field"><span>Palavra-passe</span><input class="input" name="password" type="password" required autocomplete="current-password"></label>
    <button class="btn" type="submit">Entrar</button>
  </form>
  ${App.installPrompt?`<button class="btn ghost" type="button" data-action="instalar" style="margin-top:.6rem;width:100%">Instalar a aplicação</button>`:""}
  <p class="fine"><a href="#/primeira">Primeira utilização: criar administrador</a></p>
  <p class="fine versao" data-versao-app>VetroReport versão ${VR.esc(VR.VERSAO)}</p>
</section></div>`;
};

App.views.primeira = () => {
  const aviso = App.msg ? `<div class="banner banner-bad" role="alert">${VR.esc(App.msg.texto)}</div>` : "";
  App.clearMsg();
  return `<div class="login-body"><section class="login-card">
  ${App.marca()}
  <p class="eyebrow">Primeira utilização</p>
  <h1>Criar administrador</h1>
  <p class="lede">Só funciona se ainda não existir nenhum administrador. Esta conta gere funcionários, obras, equipas e responsáveis.</p>
  ${aviso}
  <form data-action="primeira">
    <label class="field"><span>Nome</span><input class="input" name="nome" required></label>
    <label class="field"><span>Utilizador ou email</span><input class="input" name="login" required autocapitalize="none" autocorrect="off" spellcheck="false"></label>
    <label class="field"><span>Palavra-passe</span><input class="input" name="password" type="password" required minlength="8"></label>
    <label class="field"><span>Confirmar</span><input class="input" name="password2" type="password" required></label>
    <button class="btn" type="submit">Criar e entrar</button>
  </form>
  <p class="fine"><a href="#/entrar">Voltar à entrada</a></p>
</section></div>`;
};

App.views.importar = () => {
  if (!App.requireAdmin()) return App.shell(`<p class="empty">Sem permissão.</p>`,"importar");
  const prog = App.importProgresso ? `<p class="banner" id="import-progresso">${VR.esc(App.importProgresso)}</p>` : `<p class="banner" id="import-progresso" hidden></p>`;
  return App.shell(`<header class="page-head">
  <a class="back" href="#/mais">Voltar</a>
  <p class="eyebrow">Migração</p>
  <h1>Importar da versão 2.3</h1>
  <p class="lede">Escolha o ficheiro <code>vetroreport.json</code> da pasta <code>dados</code> no OneDrive. Os dados passam para a base de dados partilhada. Pode repetir: o que já existe é atualizado, não duplicado.</p>
</header>
${prog}
<form data-action="importar" class="card">
  <label class="field"><span>Ficheiro vetroreport.json</span><input class="input" type="file" name="json" accept=".json,application/json" required></label>
  <label class="field"><span>Pasta fotos, opcional</span><input class="input" type="file" name="fotos" webkitdirectory multiple></label>
  <p class="hint">No computador, escolha a pasta <code>dados\\fotos</code> para enviar também as fotografias das ocorrências. Os responsáveis com palavra-passe da versão 2.3 entram com o mesmo email e a mesma palavra-passe.</p>
  <button class="btn" type="submit">Importar</button>
</form>`, "importar");
};

App.views.hoje = async () => {
  const iso = App.dataISO;
  const r = VR.Services.resumoHoje(App.store.data, iso);
  let obrasHtml = r.obras.map(g => {
    const eyebrow = g.sem_obra
      ? `<p class="eyebrow">Presentes</p>`
      : `<p class="eyebrow">${VR.esc(g.obra.localidade)} · ${VR.esc(g.obra.cliente)}</p>`;
    return `<article class="site${g.sem_obra?" site-sem-obra":""}">
    <header>${eyebrow}<h3>${VR.esc(g.obra.nome)}</h3></header>
    <ul>${g.pessoas.map(p => {
      const f = VR.Services.funcionarioPorId(App.store.data, p.registo.funcionario_id);
      const eq = VR.Services.equipaPorId(App.store.data, f.equipa_id);
      const mins = p.alocacao && p.alocacao.minutos != null ? p.alocacao.minutos : (p.registo.net_minutes||0);
      return `<li><a href="#/ficha/${f.id}?data=${iso}">
        ${App.avatar(f)}
        <span class="pessoa-info"><strong>${VR.esc(f.nome)}</strong><small>${VR.esc(eq?eq.nome:"")}</small></span>
        <span class="pessoa-horas">${App.horarioHtml(p.registo, mins)}</span>
      </a></li>`;
    }).join("")}</ul></article>`;
  }).join("") || `<p class="empty">Ainda não há pessoas em obra neste dia.</p>`;

  const aus = r.ausencias.map(reg => {
    const f = VR.Services.funcionarioPorId(App.store.data, reg.funcionario_id);
    const eq = VR.Services.equipaPorId(App.store.data, f.equipa_id);
    return `<li><a class="row-link" href="#/ficha/${f.id}?data=${iso}">
      ${App.avatar(f)}<span><strong>${VR.esc(f.nome)}</strong><small>${VR.esc(reg.nota_presenca||(eq?eq.nome:""))}</small></span>
      <span class="tag tag-${reg.presenca}">${VR.esc(VR.LABEL_PRESENCA[reg.presenca])}</span></a></li>`;
  }).join("");

  const ocs = r.ocorrencias.map(oc => {
    const reg = App.store.data.registos.find(x=>x.id===oc.registo_id);
    const f = VR.Services.funcionarioPorId(App.store.data, reg.funcionario_id);
    return `<li><a class="row-link" href="#/ficha/${f.id}?data=${iso}">
      <span class="tag tag-${oc.tipo}">${VR.esc(VR.LABEL_OCORRENCIA[oc.tipo])}</span>
      <span><strong>${VR.esc(f.nome)}</strong><small>${VR.esc(oc.descricao)}</small></span></a></li>`;
  }).join("");

  const por = r.por_registar.map(f => {
    const eq = VR.Services.equipaPorId(App.store.data, f.equipa_id);
    return `<li><a class="row-link" href="#/ficha/${f.id}?data=${iso}">
      ${App.avatar(f)}<span><strong>${VR.esc(f.nome)}</strong><small>${VR.esc(eq?eq.nome:"")} · ${VR.esc(f.numero)}</small></span>
      <span class="tag tag-por">Por registar</span></a></li>`;
  }).join("");

  return App.shell(`<header class="page-head">
  <p class="eyebrow">${VR.esc(VR.diaSemana(iso))} · ${VR.parseISO(iso).getFullYear()}</p>
  <h1>${VR.esc(VR.dataCurta(iso))}</h1>
  <p class="lede">${VR.esc(App.user.nome)}, a equipa de hoje.</p>
</header>
${App.dateNav("/hoje")}
${r.feriado?`<p class="banner">Feriado nacional · ${VR.esc(r.feriado.nome)}. Este dia não entra como falta.</p>`:""}
${r.fim_de_semana?`<p class="banner">Fim de semana. Só aparece quem foi chamado a obra.</p>`:""}
${r.ultima_demo?`<p class="banner">Não há registos neste dia. O último dia com registos é <a href="#/hoje?data=${r.ultima_demo}">${VR.esc(VR.dataLonga(r.ultima_demo))}</a>.</p>`:""}
<section class="stats" aria-label="Resumo do dia">
  <article class="stat stat-good"><strong class="num">${r.presentes.length}</strong><span>Presentes</span></article>
  <article class="stat stat-bad"><strong class="num">${r.ausencias.length}</strong><span>Ausências</span></article>
  <article class="stat stat-wait"><strong class="num">${r.por_registar.length}</strong><span>Por registar</span></article>
  <article class="stat stat-alert"><strong class="num">${r.ocorrencias.length}</strong><span>Ocorrências</span></article>
</section>
<section class="block"><div class="block-head"><h2>Onde está a equipa</h2><a href="#/registar?data=${iso}">Registar</a></div>${obrasHtml}</section>
${aus?`<section class="block"><h2>Ausências</h2><ul class="stack">${aus}</ul></section>`:""}
${ocs?`<section class="block"><h2>Ocorrências</h2><ul class="stack">${ocs}</ul></section>`:""}
${por?`<section class="block"><h2>Ainda por registar</h2><ul class="stack">${por}</ul></section>`:""}`, "hoje");
};

App.views.registar = (params) => {
  const iso = App.dataISO;
  const equipaAtual = params.equipa || "";
  const equipas = [...App.store.data.equipas].sort((a,b)=>a.ordem-b.ordem||a.nome.localeCompare(b.nome,"pt"));
  let funcs = App.store.data.funcionarios.filter(f=>f.ativo).sort((a,b)=>a.nome.localeCompare(b.nome,"pt"));
  if (equipaAtual) funcs = funcs.filter(f => String(f.equipa_id)===String(equipaAtual));
  const chips = `<div class="chips" role="tablist" aria-label="Equipa">
    <a class="chip ${!equipaAtual?"is-on":""}" href="#/registar?data=${iso}">Todas</a>
    ${equipas.map(e=>`<a class="chip ${String(equipaAtual)===String(e.id)?"is-on":""}" href="#/registar?data=${iso}&equipa=${e.id}">${VR.esc(e.nome)}</a>`).join("")}
  </div>`;
  const linhas = funcs.map(f => {
    const reg = VR.Services.registoDoDia(App.store.data, f.id, iso);
    const eq = VR.Services.equipaPorId(App.store.data, f.equipa_id);
    let direito = `<span class="tag tag-por">Por registar</span>`;
    let obras = "";
    if (reg) {
      if (reg.presenca==="presente") {
        const al = VR.Services.alocacoesDe(App.store.data, reg.id);
        obras = al.map(a=>{ const o=VR.Services.obraPorId(App.store.data,a.obra_id); return o?o.nome:""; }).filter(Boolean).join(", ");
        direito = `<span class="pessoa-horas">${App.horarioHtml(reg, reg.net_minutes)}${reg.overtime_minutes?"":""}</span>`;
        // show extra in horas-sec if present - rebuild
        const pares = VR.horarioTextos(reg);
        direito = `<span class="pessoa-horas">${pares.map(p=>`<b class="num horario-destaque">${VR.esc(p)}</b>`).join("")}<small class="num horas-sec">${VR.esc(VR.fmtHm(reg.net_minutes))}${reg.overtime_minutes?` · extra ${VR.esc(VR.fmtHm(reg.overtime_minutes))}`:""}</small></span>`;
      } else direito = `<span class="tag tag-${reg.presenca}">${VR.esc(VR.LABEL_PRESENCA[reg.presenca])}</span>`;
    }
    return `<li data-pessoa="${VR.esc((f.nome+" "+f.numero).toLowerCase())}"><a href="#/ficha/${f.id}?data=${iso}">
      ${App.avatar(f)}
      <span class="pessoa-info"><strong>${VR.esc(f.nome)}</strong><small>${VR.esc(eq?eq.nome:"")} · ${VR.esc(f.numero)}${obras?` · ${VR.esc(obras)}`:""}</small></span>
      ${direito}</a></li>`;
  }).join("") || `<li class="empty">Ninguém nesta equipa.</li>`;

  const feriado = VR.Services.feriadoEm(App.store.data, iso);
  return App.shell(`<header class="page-head">
  <p class="eyebrow">${VR.esc(VR.diaSemana(iso))}</p>
  <h1>Registar ${VR.esc(VR.dataCurta(iso))}</h1>
  <p class="lede">Toque num nome para o dia. Para a equipa toda, preencha a partir da última obra e horário e depois ajuste as exceções.</p>
</header>
${App.dateNav("/registar")}
${feriado?`<p class="banner">Feriado · ${VR.esc(feriado.nome)}.</p>`:""}
${chips}
<form data-action="preencher" class="fill-form" data-confirm="Cria o registo de quem ainda não tem, com a última presença, horário e obras. Quem já está registado não é alterado.">
  <input type="hidden" name="data" value="${iso}">
  ${equipaAtual?`<input type="hidden" name="equipa" value="${VR.esc(equipaAtual)}">`:""}
  <button class="btn" type="submit" ${App.store.leitura?"disabled":""}>${equipaAtual?"Preencher esta equipa":"Preencher quem falta"}</button>
</form>
<label class="field filter-field"><span>Procurar</span><input class="input" type="search" data-filtro placeholder="Nome ou número" autocomplete="off"></label>
<ul class="people">${linhas}</ul>`, "registar");
};

App.views.ficha = async (fid, params) => {
  const iso = App.dataISO;
  const f = VR.Services.funcionarioPorId(App.store.data, fid);
  if (!f) return App.shell(`<p class="empty">Funcionário não encontrado.</p>`,"ficha");
  const eq = VR.Services.equipaPorId(App.store.data, f.equipa_id);
  const reg = VR.Services.registoDoDia(App.store.data, f.id, iso);
  const defs = VR.Services.getDefinicoes(App.store.data);
  const regras = reg ? { normal: reg.normal_day_minutes, pausa: reg.break_minutes, limiar: reg.break_threshold_minutes } : { normal: defs.normal_day_minutes, pausa: defs.break_minutes, limiar: defs.break_threshold_minutes };
  const obras = App.store.data.obras.filter(o=>o.ativa).sort((a,b)=>a.localidade.localeCompare(b.localidade)||a.cliente.localeCompare(b.cliente)||a.nome.localeCompare(b.nome));
  let linhasObra = [{ obra_id:"", horas:"" }];
  if (reg && reg.presenca==="presente") {
    const al = VR.Services.alocacoesDe(App.store.data, reg.id);
    if (al.length) linhasObra = al.map(a => ({ obra_id:String(a.obra_id), horas: al.length===1?"":VR.minutosParaInput(a.minutos) }));
  }
  const opts = (sel) => `<option value="">Escolher</option>` + obras.map(o=>`<option value="${o.id}" ${String(sel)===String(o.id)?"selected":""}>${VR.esc(o.nome)} · ${VR.esc(o.localidade)}</option>`).join("");
  const obraRows = linhasObra.map(l => `<div class="obra-row">
    <label><span>Obra</span><select name="obra" class="input">${opts(l.obra_id)}</select></label>
    <label><span>Horas</span><input class="input" name="obra_horas" inputmode="decimal" placeholder="8 ou 4,5" value="${VR.esc(l.horas)}"></label>
    <button type="button" class="icon-btn" data-remove-obra aria-label="Remover obra">×</button>
  </div>`).join("");

  let ocsHtml = `<p class="empty">Guarde o registo do dia antes de acrescentar uma ocorrência.</p>`;
  if (reg) {
    const ocs = VR.Services.ocorrenciasDe(App.store.data, reg.id);
    const lista = [];
    for (const oc of ocs) {
      let img = "";
      if (oc.foto) {
        let url = App.fotoUrls.get(oc.foto);
        if (!url) { url = await App.store.lerFotoUrl(oc.foto); if (url) App.fotoUrls.set(oc.foto, url); }
        if (url) img = `<img class="shot" src="${url}" alt="Fotografia da ocorrência">`;
      }
      const autor = VR.Services.userPorId(App.store.data, oc.criado_por);
      lista.push(`<li class="card"><div class="card-top"><span class="tag tag-${oc.tipo}">${VR.esc(VR.LABEL_OCORRENCIA[oc.tipo])}</span>
        <small>${oc.criado_em?VR.fmtHora24(oc.criado_em):""}${autor?` · ${VR.esc(autor.nome)}`:""}</small></div>
        <p>${VR.esc(oc.descricao)}</p>${img}
        ${App.autoria(oc)}
        <form data-action="apagar-ocorrencia" data-confirm="Apagar esta ocorrência?">
          <input type="hidden" name="ocorrencia_id" value="${oc.id}">
          <button class="btn ghost danger" type="submit" ${App.store.leitura?"disabled":""}>Apagar</button>
        </form></li>`);
    }
    ocsHtml = `<ul class="stack">${lista.join("")||`<li class="empty">Sem ocorrências neste dia.</li>`}</ul>
    <form data-action="ocorrencia" class="subform">
      <h3>Nova ocorrência</h3>
      <label class="field"><span>Tipo</span><select class="input" name="tipo">${VR.OCORRENCIAS.map(([k,v])=>`<option value="${k}">${v}</option>`).join("")}</select></label>
      <label class="field"><span>Descrição</span><textarea class="input" name="descricao" required></textarea></label>
      <label class="field"><span>Fotografia, opcional</span><input class="input" type="file" name="foto" accept="image/jpeg,image/png,image/webp"></label>
      <p class="hint">A fotografia é reduzida automaticamente. JPG ou PNG.</p>
      <button class="btn" type="submit" ${App.store.leitura?"disabled":""}>Registar ocorrência</button>
    </form>`;
  }

  const pres = reg ? reg.presenca : "presente";
  return App.shell(`<header class="page-head compact">
  <a class="back" href="#/registar?data=${iso}&equipa=${f.equipa_id}">Voltar à lista</a>
  <div class="who">${App.avatar(f,true)}<div>
    <p class="eyebrow">${VR.esc(eq?eq.nome:"")} · ${VR.esc(f.numero)}</p>
    <h1>${VR.esc(f.nome)}</h1>
  </div></div>
  <a class="text-link" href="#/funcionario/${f.id}">Ficha do funcionário</a>
</header>
${App.dateNav(`/ficha/${f.id}`)}
${!f.ativo?`<p class="banner">Este funcionário está inativo. O histórico mantém-se.</p>`:""}
<form data-action="guardar-registo" id="ficha-form" class="ficha" data-versao="${VR.esc(reg?(reg.updated_at||""):"novo")}" data-fid="${f.id}" data-normal="${regras.normal}" data-break="${regras.pausa}" data-threshold="${regras.limiar}">
  <input type="hidden" name="data" value="${iso}">
  <fieldset class="choices"><legend>Presença</legend><div class="choice-grid">
    ${VR.PRESENCAS.map(([k,v])=>`<label class="choice choice-${k}"><input type="radio" name="presenca" value="${k}" ${pres===k?"checked":""}><span>${v}</span></label>`).join("")}
  </div></fieldset>
  <div class="somente-ausencia"><label class="field"><span>Nota</span><textarea class="input" name="nota_presenca">${VR.esc(reg?reg.nota_presenca:"")}</textarea></label></div>
  <div class="somente-presente">
    <div class="time-grid">
      <label class="field"><span>Entrada</span><input class="input input-hora" name="entrada" inputmode="numeric" autocomplete="off" placeholder="08:00" maxlength="5" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" title="Hora em 24h, por exemplo 08:00" value="${reg&&reg.entrada?reg.entrada.slice(0,5):""}" data-hora></label>
      <label class="field"><span>Saída</span><input class="input input-hora" name="saida" inputmode="numeric" autocomplete="off" placeholder="17:00" maxlength="5" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" title="Hora em 24h, por exemplo 17:00" value="${reg&&reg.saida?reg.saida.slice(0,5):""}" data-hora></label>
    </div>
    <p class="hint">Horas em formato 24h (ex.: 08:00 e 17:00). Dia normal ${VR.fmtHm(regras.normal)}; pausa ${VR.fmtHm(regras.pausa)} a partir de ${VR.fmtHm(regras.limiar)}.</p>
    <p class="resumo-horas" id="resumo-horas">${reg&&reg.presenca==="presente"?`${VR.fmtHm(reg.net_minutes)} trabalhadas · ${VR.fmtHm(reg.overtime_minutes)} extra · pausa ${VR.fmtHm(reg.break_applied_minutes)}`:"As horas aparecem quando a entrada e a saída estão preenchidas."}</p>
    <h3 class="field-heading">Obras (opcional)</h3>
    <div class="obra-list" data-obra-list>${obraRows}</div>
    <button type="button" class="btn ghost" data-add-obra>Adicionar obra</button>
    <p class="hint">Pode gravar sem obra. Com uma só obra, deixe as horas em branco para usar o turno todo. Com várias, a soma tem de fechar com as horas líquidas.</p>
    <label class="field"><span>Trabalho realizado, opcional</span><textarea class="input" name="trabalho">${VR.esc(reg?reg.trabalho:"")}</textarea></label>
  </div>
  ${App.autoria(reg)}
  <div class="sticky-actions"><button class="btn" type="submit" ${App.store.leitura?"disabled":""}>Guardar registo</button></div>
</form>
<template id="obra-row-template"><div class="obra-row">
  <label><span>Obra</span><select name="obra" class="input">${opts("")}</select></label>
  <label><span>Horas</span><input class="input" name="obra_horas" inputmode="decimal" placeholder="8 ou 4,5" value=""></label>
  <button type="button" class="icon-btn" data-remove-obra aria-label="Remover obra">×</button>
</div></template>
<section class="block"><h2>Ocorrências</h2>${ocsHtml}</section>
${reg?`<section class="block"><form data-action="apagar-registo" data-confirm="Apagar o registo deste dia?"><button class="btn ghost danger" type="submit" ${App.store.leitura?"disabled":""}>Apagar registo do dia</button></form></section>`:""}`, "ficha");
};

App.views.mural = async () => {
  const iso = App.dataISO;
  const eventos = VR.Services.eventosMural(App.store.data, iso);
  const items = [];
  for (const ev of eventos) {
    const autor = VR.Services.userPorId(App.store.data, ev.autor_id);
    const hora = ev.quando ? VR.fmtHora24(ev.quando) : "";
    if (ev.tipo === "registo" || ev.tipo === "edicao") {
      const f = VR.Services.funcionarioPorId(App.store.data, ev.registo.funcionario_id);
      const al = VR.Services.alocacoesDe(App.store.data, ev.registo.id);
      const obras = al.map(a => { const o=VR.Services.obraPorId(App.store.data,a.obra_id); return o?o.nome:""; }).filter(Boolean).join(" · ");
      items.push(`<li class="event event-${ev.tipo}"><time datetime="${VR.esc(ev.quando||"")}">${hora}</time><article>
        <p class="event-kicker">${VR.esc(autor?autor.nome:"Alguém")} ${ev.tipo==="registo"?"registou":"atualizou"}</p>
        <h2><a href="#/ficha/${f.id}?data=${iso}">${VR.esc(f.nome)}</a></h2>
        <p><span class="tag tag-${ev.registo.presenca}">${VR.esc(VR.LABEL_PRESENCA[ev.registo.presenca])}</span>
          ${ev.registo.presenca==="presente"?App.horarioHtml(ev.registo, ev.registo.net_minutes):""}</p>
        ${ev.registo.presenca==="presente"?`${obras?`<p class="obras-line">${VR.esc(obras)}</p>`:""}${ev.registo.trabalho?`<p>${VR.esc(ev.registo.trabalho)}</p>`:""}`:
          (ev.registo.nota_presenca?`<p>${VR.esc(ev.registo.nota_presenca)}</p>`:"")}
      </article></li>`);
    } else if (ev.tipo === "ocorrencia") {
      const f = VR.Services.funcionarioPorId(App.store.data, ev.registo.funcionario_id);
      let img="";
      if (ev.ocorrencia.foto) {
        let url = App.fotoUrls.get(ev.ocorrencia.foto);
        if (!url) { url = await App.store.lerFotoUrl(ev.ocorrencia.foto); if (url) App.fotoUrls.set(ev.ocorrencia.foto,url); }
        if (url) img = `<img class="shot" src="${url}" alt="Fotografia da ocorrência">`;
      }
      items.push(`<li class="event event-ocorrencia"><time>${hora}</time><article>
        <p class="event-kicker">${VR.esc(autor?autor.nome:"Alguém")} · ocorrência</p>
        <h2>${VR.esc(f.nome)}</h2>
        <p><span class="tag tag-${ev.ocorrencia.tipo}">${VR.esc(VR.LABEL_OCORRENCIA[ev.ocorrencia.tipo])}</span></p>
        <p>${VR.esc(ev.ocorrencia.descricao)}</p>${img}
      </article></li>`);
    } else {
      const pode = App.user.id === ev.nota.autor_id || App.user.role==="admin";
      items.push(`<li class="event event-nota"><time>${hora}</time><article>
        <p class="event-kicker">Nota de ${VR.esc(autor?autor.nome:"?")}</p>
        <p>${VR.esc(ev.nota.texto)}</p>
        ${App.autoria(ev.nota)}
        ${pode?`<form data-action="apagar-nota" data-confirm="Apagar esta nota?"><input type="hidden" name="nota_id" value="${ev.nota.id}"><button class="btn ghost danger" type="submit" ${App.store.leitura?"disabled":""}>Apagar nota</button></form>`:""}
      </article></li>`);
    }
  }
  return App.shell(`<header class="page-head">
  <p class="eyebrow">${VR.esc(VR.diaSemana(iso))}</p>
  <h1>Mural de ${VR.esc(VR.dataCurta(iso))}</h1>
  <p class="lede">Registos, ocorrências e notas, pela ordem em que aconteceram.</p>
</header>
${App.dateNav("/mural")}
<form data-action="nota" class="subform">
  <label class="field"><span>Nota para a equipa</span><textarea class="input" name="texto" required></textarea></label>
  <button class="btn" type="submit" ${App.store.leitura?"disabled":""}>Publicar nota</button>
</form>
<ol class="timeline">${items.join("")||`<li class="empty">Ainda não há movimentos neste dia.</li>`}</ol>`, "mural");
};

App.views.relatorios = (params) => {
  const agora = new Date();
  const ano = Number(params.ano || agora.getFullYear());
  const mes = Number(params.mes || (agora.getMonth()+1));
  const rel = VR.Services.construirRelatorio(App.store.data, ano, mes);
  const anos = [];
  for (let y = agora.getFullYear()-2; y <= agora.getFullYear()+1; y++) anos.push(y);
  const rows = rel.linhas.map(l => {
    const eq = VR.Services.equipaPorId(App.store.data, l.funcionario.equipa_id);
    return `<tr>
      <th><a href="#/funcionario/${l.funcionario.id}">${VR.esc(l.funcionario.nome)}</a><small>${VR.esc(l.funcionario.numero)} · ${VR.esc(eq?eq.nome:"")}</small></th>
      <td class="num">${l.dias}</td>
      <td class="num">${VR.esc(VR.fmtHm(l.minutos))}</td>
      <td class="num">${VR.esc(VR.fmtHm(l.extra))}</td>
      <td class="num">${l.faltas.falta_justificada+l.faltas.falta_injustificada+l.faltas.baixa_medica+l.faltas.ferias+l.faltas.outro}</td>
      <td class="num">${l.ocorrencias}</td>
    </tr>`;
  }).join("");
  return App.shell(`<header class="page-head">
  <p class="eyebrow">Salários</p>
  <h1>${VR.esc(VR.mesAno(ano, mes))}</h1>
  <p class="lede">Resumo mensal por funcionário, com exportação para a folha de salários.</p>
</header>
<form data-action="mes-relatorio" class="date-form" style="margin-bottom:1rem">
  <label class="field" style="flex:1"><span>Mês</span>
    <select class="input" name="mes">${[1,2,3,4,5,6,7,8,9,10,11,12].map(m=>`<option value="${m}" ${m===mes?"selected":""}>${VR.MESES[m-1]}</option>`).join("")}</select>
  </label>
  <label class="field" style="flex:1"><span>Ano</span>
    <select class="input" name="ano">${anos.map(y=>`<option value="${y}" ${y===ano?"selected":""}>${y}</option>`).join("")}</select>
  </label>
  <button class="btn ghost" type="submit">Ver</button>
</form>
<div class="export-row">
  <button class="btn" type="button" data-action="export-csv" data-ano="${ano}" data-mes="${mes}">CSV</button>
  <button class="btn" type="button" data-action="export-xlsx" data-ano="${ano}" data-mes="${mes}">Excel</button>
</div>
<div class="table-wrap"><table class="sheet">
  <thead><tr><th>Funcionário</th><th>Dias</th><th>Horas</th><th>Extra</th><th>Ausências</th><th>Ocorr.</th></tr></thead>
  <tbody>${rows||`<tr><td colspan="6" class="empty">Sem dados neste mês.</td></tr>`}</tbody>
</table></div>`, "relatorios");
};

App.views.mais = () => {
  const admin = App.requireAdmin();
  return App.shell(`<header class="page-head">
  <p class="eyebrow">${App.user.role==="admin"?"Administrador":"Responsável"}</p>
  <h1>${VR.esc(App.user.nome)}</h1>
  <p class="lede">${VR.esc(App.user.email)}</p>
</header>
${admin?`<nav class="menu" aria-label="Gestão">
  <a href="#/funcionarios">Funcionários <small>Nome, número, equipa, ativo</small></a>
  <a href="#/equipas">Equipas <small>Montagem, serralharia e as que criar</small></a>
  <a href="#/obras">Clientes e obras <small>OT, localidade e cliente</small></a>
  <a href="#/responsaveis">Responsáveis <small>Quem entra e com que função</small></a>
  <a href="#/definicoes">Definições de horas <small>Dia normal, pausa e feriados</small></a>
  <a href="#/auditoria">Auditoria <small>Quem criou e quem editou</small></a>
  <a href="#/importar">Importar da versão 2.3 <small>Ficheiro vetroreport.json do OneDrive e fotografias</small></a>
</nav>`:`<p class="empty">Partilha os registos com os outros responsáveis. Funcionários, obras e salários são tratados pela administração.</p>`}
<nav class="menu" aria-label="Aplicação">
  <a href="#/historico">Histórico de atualizações <small>O que mudou em cada versão · versão atual ${VR.esc(VR.VERSAO)}</small></a>
  <a href="#" data-action="atualizar-dados">Atualizar dados <small>Últimos dados de todos os utilizadores${App.store&&App.store.carregadoEm?` · ${VR.esc(VR.fmtDataHora24(App.store.carregadoEm))}`:""}</small></a>
  ${App.installPrompt?`<a href="#" data-action="instalar">Instalar a aplicação <small>Ícone no ecrã principal ou no ambiente de trabalho</small></a>`:""}
</nav>
<button class="btn ghost danger logout" type="button" data-action="logout">Terminar sessão</button>
<p class="fine versao" data-versao-app>VetroReport versão ${VR.esc(VR.VERSAO)} · dados na nuvem (Supabase)</p>`, "mais");
};

App.views.historico = () => {
  const fmt = (d) => d ? d.split("-").reverse().join("/") : "data não registada";
  const lista = VR.CHANGELOG.map((v, i) => `<li class="card" data-versao="${VR.esc(v.versao)}">
    <h2><span class="v-num ${v.versao===VR.VERSAO?"v-atual":""}">${VR.esc(v.versao)}</span> ${VR.esc(v.titulo)} <span class="v-data">${VR.esc(fmt(v.data))}${v.versao===VR.VERSAO?" · versão atual":""}</span></h2>
    <ul>${v.alteracoes.map(a => `<li>${VR.esc(a)}</li>`).join("")}</ul></li>`).join("");
  return App.shell(`<header class="page-head"><a class="back" href="#/mais">Voltar</a>
  <p class="eyebrow">VetroReport versão ${VR.esc(VR.VERSAO)}</p>
  <h1>Histórico de atualizações</h1>
  <p class="lede">O que mudou em cada versão, da mais recente para a mais antiga.</p></header>
  <ol class="changelog">${lista}</ol>`, "historico");
};

App.views.funcionarios = () => {
  if (!App.requireAdmin()) return App.shell(`<p class="empty">Sem permissão.</p>`,"funcionarios");
  const lista = [...App.store.data.funcionarios].sort((a,b)=>a.nome.localeCompare(b.nome,"pt")).map(f => {
    const eq = VR.Services.equipaPorId(App.store.data, f.equipa_id);
    return `<li><a class="row-link" href="#/funcionario/${f.id}">
      ${App.avatar(f)}<span><strong>${VR.esc(f.nome)}</strong><small>${VR.esc(f.numero)} · ${VR.esc(eq?eq.nome:"")}${f.ativo?"":" · inativo"}</small></span></a></li>`;
  }).join("");
  return App.shell(`<header class="page-head"><a class="back" href="#/mais">Voltar</a>
  <h1>Funcionários</h1></header>
  <p><a class="btn" href="#/funcionario/novo">Novo funcionário</a></p>
  <ul class="stack">${lista||`<li class="empty">Ainda sem funcionários.</li>`}</ul>`, "funcionarios");
};

App.views.funcionarioForm = (path) => {
  if (!App.requireAdmin()) return App.shell(`<p class="empty">Sem permissão.</p>`,"funcionarios");
  const id = path.includes("editar") ? Number(path.split("/").pop()) : null;
  const f = id ? VR.Services.funcionarioPorId(App.store.data, id) : { nome:"", numero:"", equipa_id:"", ativo:true };
  const equipas = [...App.store.data.equipas].sort((a,b)=>a.ordem-b.ordem||a.nome.localeCompare(b.nome,"pt"));
  return App.shell(`<header class="page-head"><a class="back" href="#/funcionarios">Voltar</a>
  <h1>${id?"Editar":"Novo"} funcionário</h1></header>
  <form data-action="guardar-funcionario" class="sheet-form">
    <input type="hidden" name="id" value="${id||""}">
    <label class="field"><span>Nome</span><input class="input" name="nome" required value="${VR.esc(f.nome)}"></label>
    <label class="field"><span>Número</span><input class="input" name="numero" required value="${VR.esc(f.numero)}"></label>
    <label class="field"><span>Equipa</span><select class="input" name="equipa_id" required>
      <option value="">Escolher</option>
      ${equipas.map(e=>`<option value="${e.id}" ${f.equipa_id===e.id?"selected":""}>${VR.esc(e.nome)}</option>`).join("")}
    </select></label>
    <label class="field check-line"><input type="checkbox" name="ativo" ${f.ativo?"checked":""}> <span>Ativo</span></label>
    ${id?App.autoria(f):""}
    <button class="btn" type="submit">Guardar</button>
  </form>`, "funcionarios");
};

App.views.fichaFuncionario = (id) => {
  const f = VR.Services.funcionarioPorId(App.store.data, id);
  if (!f) return App.shell(`<p class="empty">Não encontrado.</p>`,"funcionarios");
  const eq = VR.Services.equipaPorId(App.store.data, f.equipa_id);
  const regs = App.store.data.registos.filter(r=>r.funcionario_id===id).sort((a,b)=>b.data.localeCompare(a.data)).slice(0,60);
  const lista = regs.map(r => `<li><a class="row-link" href="#/ficha/${id}?data=${r.data}">
    <span><strong>${VR.esc(VR.dataCurta(r.data))} · ${VR.parseISO(r.data).getFullYear()}</strong>
    <small>${VR.esc(VR.LABEL_PRESENCA[r.presenca])}${r.presenca==="presente"?` · ${VR.esc(VR.fmtHm(r.net_minutes))}`:""}</small></span>
    ${r.presenca==="presente"?`<span class="pessoa-horas">${App.horarioHtml(r,r.net_minutes)}</span>`:`<span class="tag tag-${r.presenca}">${VR.esc(VR.LABEL_PRESENCA[r.presenca])}</span>`}
  </a></li>`).join("");
  return App.shell(`<header class="page-head compact">
  <a class="back" href="#/funcionarios">Voltar</a>
  <div class="who">${App.avatar(f,true)}<div>
    <p class="eyebrow">${VR.esc(eq?eq.nome:"")} · ${VR.esc(f.numero)}</p>
    <h1>${VR.esc(f.nome)}</h1>
  </div></div>
  ${App.requireAdmin()?`<a class="text-link" href="#/funcionario/editar/${id}">Editar</a>`:""}
  ${App.autoria(f)}
</header>
<section class="block"><h2>Últimos registos</h2><ul class="stack">${lista||`<li class="empty">Sem registos.</li>`}</ul></section>`, "funcionarios");
};

App.views.equipas = () => {
  if (!App.requireAdmin()) return App.shell(`<p class="empty">Sem permissão.</p>`,"equipas");
  const lista = [...App.store.data.equipas].sort((a,b)=>a.ordem-b.ordem||a.nome.localeCompare(b.nome,"pt")).map(e => {
    const n = App.store.data.funcionarios.filter(f=>f.equipa_id===e.id && f.ativo).length;
    return `<li><a class="row-link" href="#/equipa/editar/${e.id}">
      <span class="avatar" style="background:${VR.corEquipa(e.nome)}">${VR.esc(VR.iniciais(e.nome))}</span>
      <span><strong>${VR.esc(e.nome)}</strong><small>${n} ativo${n===1?"":"s"} · ordem ${e.ordem}</small></span></a></li>`;
  }).join("");
  return App.shell(`<header class="page-head"><a class="back" href="#/mais">Voltar</a><h1>Equipas</h1></header>
  <p><a class="btn" href="#/equipa/nova">Nova equipa</a></p>
  <ul class="stack">${lista||`<li class="empty">Ainda sem equipas.</li>`}</ul>`, "equipas");
};

App.views.equipaForm = (path) => {
  if (!App.requireAdmin()) return App.shell(`<p class="empty">Sem permissão.</p>`,"equipas");
  const id = path.includes("editar") ? Number(path.split("/").pop()) : null;
  const e = id ? VR.Services.equipaPorId(App.store.data, id) : { nome:"", ordem:0 };
  return App.shell(`<header class="page-head"><a class="back" href="#/equipas">Voltar</a><h1>${id?"Editar":"Nova"} equipa</h1></header>
  <form data-action="guardar-equipa" class="sheet-form">
    <input type="hidden" name="id" value="${id||""}">
    <label class="field"><span>Nome</span><input class="input" name="nome" required value="${VR.esc(e.nome)}"></label>
    <label class="field"><span>Ordem</span><input class="input" name="ordem" type="number" min="0" value="${e.ordem||0}"></label>
    ${id?App.autoria(e):""}
    <button class="btn" type="submit">Guardar</button>
  </form>`, "equipas");
};

App.views.obras = () => {
  if (!App.requireAdmin()) return App.shell(`<p class="empty">Sem permissão.</p>`,"obras");
  const lista = [...App.store.data.obras].sort((a,b)=>a.localidade.localeCompare(b.localidade)||a.cliente.localeCompare(b.cliente)||a.nome.localeCompare(b.nome)).map(o =>
    `<li><a class="row-link" href="#/obra/editar/${o.id}">
      <span><strong>${VR.esc(o.nome)}</strong><small>${VR.esc(o.cliente)} · ${VR.esc(o.localidade)}${o.ativa?"":" · inativa"}</small></span></a></li>`
  ).join("");
  return App.shell(`<header class="page-head"><a class="back" href="#/mais">Voltar</a><h1>Clientes e obras</h1></header>
  <p><a class="btn" href="#/obra/nova">Nova obra</a></p>
  <ul class="stack">${lista||`<li class="empty">Ainda sem obras.</li>`}</ul>`, "obras");
};

App.views.obraForm = (path) => {
  if (!App.requireAdmin()) return App.shell(`<p class="empty">Sem permissão.</p>`,"obras");
  const id = path.includes("editar") ? Number(path.split("/").pop()) : null;
  const o = id ? VR.Services.obraPorId(App.store.data, id) : { cliente:"", nome:"", localidade:"", morada:"", ativa:true };
  return App.shell(`<header class="page-head"><a class="back" href="#/obras">Voltar</a><h1>${id?"Editar":"Nova"} obra</h1></header>
  <form data-action="guardar-obra" class="sheet-form">
    <input type="hidden" name="id" value="${id||""}">
    <label class="field"><span>Cliente</span><input class="input" name="cliente" required value="${VR.esc(o.cliente)}"></label>
    <label class="field"><span>Obra (OT)</span><input class="input" name="nome" required value="${VR.esc(o.nome)}"></label>
    <label class="field"><span>Localidade</span><input class="input" name="localidade" required value="${VR.esc(o.localidade)}"></label>
    <label class="field"><span>Morada</span><input class="input" name="morada" value="${VR.esc(o.morada||"")}"></label>
    <label class="field check-line"><input type="checkbox" name="ativa" ${o.ativa?"checked":""}> <span>Ativa</span></label>
    ${id?App.autoria(o):""}
    <button class="btn" type="submit">Guardar</button>
  </form>`, "obras");
};

App.views.responsaveis = () => {
  if (!App.requireAdmin()) return App.shell(`<p class="empty">Sem permissão.</p>`,"responsaveis");
  const lista = [...App.store.data.utilizadores].sort((a,b)=>a.nome.localeCompare(b.nome,"pt")).map(u =>
    `<li><a class="row-link" href="#/responsavel/editar/${u.id}">
      <span><strong>${VR.esc(u.nome)}</strong><small>${VR.esc(u.email)} · ${u.role==="admin"?"Administrador":"Responsável"}${u.ativo===false?" · inativo":""}${!u.auth_id?" · ainda não entrou":""}</small></span></a></li>`
  ).join("");
  return App.shell(`<header class="page-head"><a class="back" href="#/mais">Voltar</a><h1>Responsáveis</h1></header>
  <p><a class="btn" href="#/responsavel/novo">Novo responsável</a></p>
  <ul class="stack">${lista}</ul>`, "responsaveis");
};

App.views.responsavelForm = (path) => {
  if (!App.requireAdmin()) return App.shell(`<p class="empty">Sem permissão.</p>`,"responsaveis");
  const id = path.includes("editar") ? Number(path.split("/").pop()) : null;
  const u = id ? VR.Services.userPorId(App.store.data, id) : { nome:"", email:"", role:"responsavel", ativo:true };
  return App.shell(`<header class="page-head"><a class="back" href="#/responsaveis">Voltar</a><h1>${id?"Editar":"Novo"} responsável</h1></header>
  <form data-action="guardar-responsavel" class="sheet-form">
    <input type="hidden" name="id" value="${id||""}">
    <label class="field"><span>Nome</span><input class="input" name="nome" required value="${VR.esc(u.nome)}"></label>
    <label class="field"><span>Utilizador ou email</span><input class="input" name="login" required autocapitalize="none" autocorrect="off" spellcheck="false" value="${VR.esc(u.email)}"></label>
    <p class="hint">Pode ser um nome simples (ex.: <code>joao.silva</code>, sem espaços nem acentos) ou um email. É o que a pessoa escreve para entrar.</p>
    <label class="field"><span>Função</span><select class="input" name="role">
      <option value="responsavel" ${u.role==="responsavel"?"selected":""}>Responsável</option>
      <option value="admin" ${u.role==="admin"?"selected":""}>Administrador</option>
    </select></label>
    <label class="field"><span>Nova palavra-passe ${id?"(deixar em branco para manter)":""}</span><input class="input" name="password" type="password" ${id?"":"required minlength=8"}></label>
    <label class="field check-line"><input type="checkbox" name="ativo" ${u.ativo!==false?"checked":""}> <span>Ativo</span></label>
    ${id?App.autoria(u):""}
    <button class="btn" type="submit">Guardar</button>
  </form>`, "responsaveis");
};

App.views.definicoes = () => {
  if (!App.requireAdmin()) return App.shell(`<p class="empty">Sem permissão.</p>`,"definicoes");
  const d = VR.Services.getDefinicoes(App.store.data);
  const feriados = [...App.store.data.feriados].sort((a,b)=>a.data.localeCompare(b.data)).map(f =>
    `<li class="row-link static"><span><strong>${VR.esc(f.data.split("-").reverse().join("/"))}</strong><small>${VR.esc(f.nome)}</small></span>
      <form data-action="apagar-feriado" data-confirm="Apagar este feriado?"><input type="hidden" name="id" value="${f.id}"><button class="btn ghost danger" type="submit">Apagar</button></form></li>`
  ).join("");
  return App.shell(`<header class="page-head"><a class="back" href="#/mais">Voltar</a><h1>Definições de horas</h1></header>
  <form data-action="guardar-definicoes" class="sheet-form">
    <label class="field"><span>Dia normal (minutos)</span><input class="input" type="number" name="normal_day_minutes" value="${d.normal_day_minutes}" required></label>
    <label class="field"><span>Pausa (minutos)</span><input class="input" type="number" name="break_minutes" value="${d.break_minutes}" required></label>
    <label class="field"><span>Limiar da pausa (minutos)</span><input class="input" type="number" name="break_threshold_minutes" value="${d.break_threshold_minutes}" required></label>
    <button class="btn" type="submit">Guardar</button>
  </form>
  <section class="block"><h2>Feriados</h2>
  <form data-action="novo-feriado" class="subform">
    <label class="field"><span>Data</span><input class="input" type="date" name="data" required></label>
    <label class="field"><span>Nome</span><input class="input" name="nome" required></label>
    <button class="btn" type="submit">Acrescentar</button>
  </form>
  ${App.autoria(App.store.data.definicoes)}
  <ul class="stack">${feriados||`<li class="empty">Sem feriados.</li>`}</ul></section>`, "definicoes");
};

App.views.auditoria = () => {
  if (!App.requireAdmin()) return App.shell(`<p class="empty">Sem permissão.</p>`,"auditoria");
  const lista = App.store.data.auditoria.slice(0,200).map(a => {
    const u = VR.Services.userPorId(App.store.data, a.utilizador_id);
    const quando = a.criado_em ? VR.fmtDataHora24(a.criado_em) : "";
    return `<li><strong>${VR.esc(a.resumo)}</strong><small>${VR.esc(u?u.nome:"Alguém")} · ${VR.esc(quando)}</small></li>`;
  }).join("");
  return App.shell(`<header class="page-head"><a class="back" href="#/mais">Voltar</a><h1>Auditoria</h1></header>
  <ul class="audit-list">${lista||`<li class="empty">Sem eventos.</li>`}</ul>`, "auditoria");
};

App.bind = () => {
  // login body class
  document.body.className = (location.hash||"").includes("/entrar") || (location.hash||"").includes("/primeira") || !App.user ? "login-body" : "";
  document.querySelectorAll("main form").forEach(f => f.addEventListener("input", () => { App.formSujo = true; }));
  const rb = document.getElementById("remoto-banner");
  if (rb && App.remotoPendente) rb.hidden = false;

  document.querySelectorAll("form[data-confirm]").forEach(form => {
    form.addEventListener("submit", (ev) => {
      if (!confirm(form.getAttribute("data-confirm"))) ev.preventDefault();
    });
  });

  document.querySelectorAll("form[data-date-nav]").forEach(form => {
    const input = form.querySelector('input[type="date"]');
    if (input) input.addEventListener("change", () => {
      App.go(form.getAttribute("data-date-nav"), { data: input.value });
    });
  });


  document.querySelectorAll("[data-hora]").forEach((input) => {
    const aplicar = () => {
      try {
        const n = VR.normalizarHora(input.value);
        input.value = n || "";
        input.setCustomValidity("");
      } catch (e) {
        input.setCustomValidity(e.message);
      }
    };
    input.addEventListener("blur", () => { aplicar(); input.reportValidity(); });
    input.addEventListener("change", aplicar);
    // ao escrever 4 dígitos, formata já
    input.addEventListener("input", () => {
      const dig = input.value.replace(/\D/g, "");
      if (dig.length === 4 && !input.value.includes(":")) {
        input.value = dig.slice(0,2) + ":" + dig.slice(2);
      }
    });
  });

  const filtro = document.querySelector("[data-filtro]");
  if (filtro) filtro.addEventListener("input", () => {
    const q = filtro.value.trim().toLowerCase();
    document.querySelectorAll("[data-pessoa]").forEach(el => {
      el.hidden = Boolean(q) && !el.getAttribute("data-pessoa").includes(q);
    });
  });

  const ficha = document.getElementById("ficha-form");
  if (ficha) {
    const atualizar = () => {
      const caixa = document.getElementById("resumo-horas");
      if (!caixa) return;
      const presente = ficha.querySelector('input[name="presenca"][value="presente"]');
      if (!presente || !presente.checked) return;
      try {
        const calc = VR.calcularTurno(
          ficha.querySelector('[name="entrada"]').value,
          ficha.querySelector('[name="saida"]').value,
          Number(ficha.dataset.normal), Number(ficha.dataset.break), Number(ficha.dataset.threshold)
        );
        caixa.textContent = `${VR.fmtHm(calc.net_minutes)} trabalhadas · ${VR.fmtHm(calc.overtime_minutes)} extra · pausa ${VR.fmtHm(calc.break_applied_minutes)}`;
      } catch (e) {
        caixa.textContent = e.message.includes("depois") ? e.message : "As horas aparecem quando a entrada e a saída estão preenchidas.";
      }
    };
    ficha.addEventListener("input", atualizar);
    ficha.addEventListener("change", atualizar);
    const lista = document.querySelector("[data-obra-list]");
    const modelo = document.getElementById("obra-row-template");
    const add = document.querySelector("[data-add-obra]");
    if (add && lista && modelo) {
      add.addEventListener("click", () => lista.appendChild(modelo.content.cloneNode(true)));
      lista.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-remove-obra]");
        if (!btn) return;
        btn.closest(".obra-row").remove();
      });
    }
  }

  document.querySelectorAll("[data-action]").forEach(el => {
    const action = el.getAttribute("data-action");
    if (el.tagName === "FORM") {
      el.addEventListener("submit", (ev) => { ev.preventDefault(); App.actions[action]?.(el); });
    } else {
      el.addEventListener("click", (ev) => { ev.preventDefault(); App.actions[action]?.(el); });
    }
  });
};

App.saveOrConflict = async () => {
  try {
    await App.store.guardar();
  } catch (e) {
    if (e.conflito || e.message === "CONFLITO") {
      alert("Outra pessoa alterou estes dados entretanto. A página vai mostrar a versão mais recente. As suas alterações desta ação não foram gravadas; reveja e grave de novo.");
      await App.render();
      const c = new Error("CONFLITO"); c.conflito = true; throw c;
    }
    throw e;
  }
};

/* Executa uma ação que grava, mostrando erros como mensagem. */
App.gravar = async (fn, okMsg, depois) => {
  try {
    await fn();
    await App.saveOrConflict();
    if (okMsg) App.toast(okMsg);
    if (depois) { if (!depois()) await App.render(); } else await App.render();
  } catch (e) {
    if (e.conflito) return;
    console.error(e);
    App.toast(e.message || String(e), "erro");
    await App.render();
  }
};

App.actions = {
  async login(form) {
    const fd = new FormData(form);
    const login = String(fd.get("login")||"").trim().toLowerCase();
    const password = String(fd.get("password")||"");
    const btn = form.querySelector("button[type=submit]"); if (btn) { btn.disabled = true; btn.textContent = "A entrar…"; }
    try {
      await App.entrar(login, password);
      App.toast(`Olá, ${App.user.nome}.`);
      if (!App.go("/hoje")) await App.render();
    } catch (e) {
      App.toast(e.message || "Não foi possível entrar.", "erro");
      await App.render();
    }
  },
  async primeira(form) {
    const fd = new FormData(form);
    const nome = String(fd.get("nome")||"").trim();
    const login = String(fd.get("login")||"").trim().toLowerCase();
    const password = String(fd.get("password")||"");
    const password2 = String(fd.get("password2")||"");
    if (password !== password2) { App.toast("As palavras-passe não coincidem.", "erro"); await App.render(); return; }
    if (password.length < 8) { App.toast("A palavra-passe deve ter pelo menos 8 caracteres.", "erro"); await App.render(); return; }
    try {
      await App.funcao({ acao: "bootstrap", nome, login, password });
      await App.entrar(login, password);
      App.toast("Conta de administrador criada.");
      if (!App.go("/hoje")) await App.render();
    } catch (e) {
      App.toast(e.message, "erro"); await App.render();
    }
  },
  async importar(form) {
    const file = form.json.files[0];
    if (!file) return;
    const fotos = form.fotos ? [...form.fotos.files] : [];
    const btn = form.querySelector("button[type=submit]"); if (btn) { btn.disabled = true; btn.textContent = "A importar…"; }
    App.importando = true;
    const prog = (t) => { App.importProgresso = t; const el = document.getElementById("import-progresso"); if (el) { el.hidden = false; el.textContent = t; } };
    try {
      const texto = await file.text();
      const resumo = await VR.Importar.v23(JSON.parse(texto), { fotos, progresso: prog });
      App.importProgresso = null;
      App.toast(resumo.mensagem);
    } catch (e) {
      console.error(e);
      App.importProgresso = null;
      App.toast("Falha na importação: " + (e.message||e), "erro");
    }
    await App.store.recarregarSilencioso();
    App.importando = false;
    await App.render();
  },
  async logout() {
    await App.sair();
    if (!App.go("/entrar")) await App.render();
  },
  async "atualizar-dados"() {
    try {
      await App.store.carregar({ admin: App.user.role === "admin" });
      App.toast("Dados atualizados.");
    } catch (e) { App.toast(e.message, "erro"); }
    await App.render();
  },
  async instalar() {
    const p = App.installPrompt;
    if (!p) { alert("Use o menu do navegador: «Adicionar ao ecrã principal» ou «Instalar aplicação»."); return; }
    p.prompt();
    try { await p.userChoice; } catch {}
    App.installPrompt = null;
    await App.render();
  },
  async "guardar-registo"(form) {
    const fd = new FormData(form);
    const fid = Number(form.dataset.fid);
    const f = VR.Services.funcionarioPorId(App.store.data, fid);
    const iso = String(fd.get("data"));
    const presenca = String(fd.get("presenca"));
    const atual = VR.Services.registoDoDia(App.store.data, fid, iso);
    const versaoAgora = atual ? (atual.updated_at || "") : "novo";
    if ((form.dataset.versao || "") !== versaoAgora) {
      const quem = atual ? VR.Services.userPorId(App.store.data, atual.alterado_por) : null;
      const ok = confirm(`Este registo foi ${form.dataset.versao==="novo"?"criado":"alterado"} por ${quem?quem.nome:"outra pessoa"} enquanto o estava a editar.\n\nOK = gravar a sua versão por cima.\nCancelar = ver a versão mais recente.`);
      if (!ok) { App.formSujo = false; await App.render(); return; }
    }
    const obras = fd.getAll("obra");
    const horas = fd.getAll("obra_horas");
    const alocacoes = [];
    for (let i=0;i<obras.length;i++) {
      if (!String(obras[i]).trim()) continue;
      let minutos = null;
      if (String(horas[i]||"").trim()) {
        try { minutos = VR.parseHoras(horas[i]); }
        catch { App.toast("Horas inválidas numa obra. Use um número, por exemplo 4 ou 4,5.", "erro"); await App.render(); return; }
        if (minutos <= 0) { App.toast("As horas em cada obra têm de ser superiores a zero.", "erro"); await App.render(); return; }
      }
      alocacoes.push({ obra_id: Number(obras[i]), minutos });
    }
    try {
      VR.Services.guardarRegisto(App.store.data, {
        funcionario: f, iso, presenca,
        nota_presenca: fd.get("nota_presenca"),
        entrada: (() => { const v = String(fd.get("entrada")||"").trim(); if (!v) return null; return VR.normalizarHora(v); })(),
        saida: (() => { const v = String(fd.get("saida")||"").trim(); if (!v) return null; return VR.normalizarHora(v); })(),
        trabalho: fd.get("trabalho"),
        alocacoes, utilizador: App.user,
      });
      await App.saveOrConflict();
      App.toast("Registo guardado.");
      if (!App.go(`/ficha/${fid}`, { data: iso })) await App.render();
    } catch (e) {
      if (e.message === "CONFLITO") return;
      App.toast(e.message, "erro");
      await App.render();
    }
  },
  async "apagar-registo"(form) {
    const { path } = App.route();
    const fid = Number(path.split("/")[2]);
    const reg = VR.Services.registoDoDia(App.store.data, fid, App.dataISO);
    if (!reg) return;
    const ocs = VR.Services.apagarRegisto(App.store.data, reg, App.user);
    try { await App.saveOrConflict(); } catch (e) { if (!e.conflito) { App.toast(e.message, "erro"); await App.render(); } return; }
    for (const oc of ocs) if (oc.foto) await App.store.removerFoto(oc.foto);
    App.toast("Registo apagado.");
    if (!App.go("/registar", { data: App.dataISO })) await App.render();
  },
  async ocorrencia(form) {
    const fd = new FormData(form);
    const { path } = App.route();
    const fid = Number(path.split("/")[2]);
    let reg = VR.Services.registoDoDia(App.store.data, fid, App.dataISO);
    if (!reg) { App.toast("Guarde o registo primeiro.", "erro"); await App.render(); return; }
    let foto_path = "";
    const file = form.foto?.files?.[0];
    if (file) {
      try {
        const blob = await VR.comprimirJpeg(file);
        foto_path = await App.store.guardarFoto(blob);
      } catch (e) { App.toast(e.message, "erro"); await App.render(); return; }
    }
    try {
      VR.Services.adicionarOcorrencia(App.store.data, {
        registo: reg, tipo: fd.get("tipo"), descricao: fd.get("descricao"),
        foto_path, utilizador: App.user,
      });
      await App.saveOrConflict();
      App.toast("Ocorrência registada.");
      await App.render();
    } catch (e) {
      if (e.message==="CONFLITO") return;
      App.toast(e.message, "erro"); await App.render();
    }
  },
  async "apagar-ocorrencia"(form) {
    const id = Number(new FormData(form).get("ocorrencia_id"));
    const oc = App.store.data.ocorrencias.find(o => o.id === id);
    if (!oc) return;
    VR.Services.apagarOcorrencia(App.store.data, oc, App.user);
    try { await App.saveOrConflict(); } catch (e) { if (!e.conflito) { App.toast(e.message, "erro"); await App.render(); } return; }
    if (oc.foto) await App.store.removerFoto(oc.foto);
    App.toast("Ocorrência apagada.");
    await App.render();
  },
  async preencher(form) {
    const fd = new FormData(form);
    const res = VR.Services.preencherEquipa(App.store.data, {
      iso: fd.get("data") || App.dataISO,
      equipaId: fd.get("equipa") || null,
      utilizador: App.user,
    });
    try { await App.saveOrConflict(); } catch (e) { if (!e.conflito) { App.toast(e.message, "erro"); await App.render(); } return; }
    App.toast(res.mensagem);
    await App.render();
  },
  async nota(form) {
    try {
      VR.Services.guardarNota(App.store.data, { iso: App.dataISO, texto: new FormData(form).get("texto"), autor: App.user });
      await App.saveOrConflict();
      App.toast("Nota publicada no mural.");
      await App.render();
    } catch (e) {
      if (e.message==="CONFLITO") return;
      App.toast(e.message, "erro"); await App.render();
    }
  },
  async "apagar-nota"(form) {
    const id = Number(new FormData(form).get("nota_id"));
    const nota = App.store.data.notas.find(n => n.id === id);
    if (!nota) return;
    try {
      VR.Services.apagarNota(App.store.data, nota, App.user);
      await App.saveOrConflict();
      App.toast("Nota apagada.");
      await App.render();
    } catch (e) {
      if (e.conflito) return;
      App.toast(e.message, "erro"); await App.render();
    }
  },
  async "export-csv"(btn) {
    const rel = VR.Services.construirRelatorio(App.store.data, Number(btn.dataset.ano), Number(btn.dataset.mes));
    const blob = VR.Export.csv(rel);
    VR.downloadBlob(blob, `vetroreport-${btn.dataset.ano}-${btn.dataset.mes}.csv`);
  },
  async "export-xlsx"(btn) {
    const rel = VR.Services.construirRelatorio(App.store.data, Number(btn.dataset.ano), Number(btn.dataset.mes));
    const blob = await VR.Export.xlsx(rel);
    VR.downloadBlob(blob, `vetroreport-${btn.dataset.ano}-${btn.dataset.mes}.xlsx`);
  },
  "mes-relatorio"(form) {
    const fd = new FormData(form);
    App.go("/relatorios", { ano: fd.get("ano"), mes: fd.get("mes") });
  },
  async "guardar-funcionario"(form) {
    const fd = new FormData(form);
    const id = fd.get("id") ? Number(fd.get("id")) : null;
    const numero = String(fd.get("numero")).trim();
    if (App.store.data.funcionarios.some(f => f.numero === numero && f.id !== id)) {
      App.toast("Já existe um funcionário com este número.", "erro"); await App.render(); return;
    }
    if (id) {
      const f = VR.Services.funcionarioPorId(App.store.data, id);
      Object.assign(f, { nome: fd.get("nome"), numero, equipa_id: Number(fd.get("equipa_id")), ativo: fd.get("ativo")==="on" });
    } else {
      App.store.data.funcionarios.push({
        id: VR.nextId(App.store.data,"funcionarios"),
        nome: String(fd.get("nome")).trim(), numero,
        equipa_id: Number(fd.get("equipa_id")), ativo: fd.get("ativo")==="on",
      });
    }
    try { await App.saveOrConflict(); } catch (e) { if (!e.conflito) { App.toast(e.message, "erro"); await App.render(); } return; }
    App.toast("Funcionário guardado.");
    if (!App.go("/funcionarios")) await App.render();
  },
  async "guardar-equipa"(form) {
    const fd = new FormData(form);
    const id = fd.get("id") ? Number(fd.get("id")) : null;
    const nome = String(fd.get("nome")).trim();
    if (App.store.data.equipas.some(e => e.nome.toLowerCase()===nome.toLowerCase() && e.id !== id)) {
      App.toast("Já existe uma equipa com este nome.", "erro"); await App.render(); return;
    }
    if (id) {
      const e = VR.Services.equipaPorId(App.store.data, id);
      Object.assign(e, { nome, ordem: Number(fd.get("ordem")||0) });
    } else {
      App.store.data.equipas.push({ id: VR.nextId(App.store.data,"equipas"), nome, ordem: Number(fd.get("ordem")||0) });
    }
    try { await App.saveOrConflict(); } catch (e) { if (!e.conflito) { App.toast(e.message, "erro"); await App.render(); } return; }
    App.toast("Equipa guardada.");
    if (!App.go("/equipas")) await App.render();
  },
  async "guardar-obra"(form) {
    const fd = new FormData(form);
    const id = fd.get("id") ? Number(fd.get("id")) : null;
    const campos = {
      cliente: String(fd.get("cliente")).trim(),
      nome: String(fd.get("nome")).trim(),
      localidade: String(fd.get("localidade")).trim(),
      morada: String(fd.get("morada")||"").trim(),
      ativa: fd.get("ativa")==="on",
    };
    if (id) Object.assign(VR.Services.obraPorId(App.store.data, id), campos);
    else App.store.data.obras.push({ id: VR.nextId(App.store.data,"obras"), ...campos });
    try { await App.saveOrConflict(); } catch (e) { if (!e.conflito) { App.toast(e.message, "erro"); await App.render(); } return; }
    App.toast("Obra guardada.");
    if (!App.go("/obras")) await App.render();
  },
  async "guardar-responsavel"(form) {
    const fd = new FormData(form);
    const id = fd.get("id") ? Number(fd.get("id")) : null;
    const login = String(fd.get("login")||"").trim().toLowerCase();
    if (App.store.data.utilizadores.some(u => u.email.toLowerCase()===login && u.id !== id)) {
      App.toast("Já existe um utilizador com este login.", "erro"); await App.render(); return;
    }
    const password = String(fd.get("password")||"");
    if (!id && password.length < 8) { App.toast("A palavra-passe deve ter pelo menos 8 caracteres.", "erro"); await App.render(); return; }
    try {
      const r = await App.funcao({
        acao: id ? "atualizar" : "criar", id, login, password,
        nome: String(fd.get("nome")||"").trim(), role: fd.get("role"), ativo: fd.get("ativo")==="on",
      });
      if (r.utilizador) App.store._aplicarLocal("utilizadores", r.utilizador);
      App.toast("Responsável guardado.");
      if (!App.go("/responsaveis")) await App.render();
    } catch (e) {
      App.toast(e.message, "erro"); await App.render();
    }
  },
  async "guardar-definicoes"(form) {
    const fd = new FormData(form);
    App.store.data.definicoes = {
      normal_day_minutes: Number(fd.get("normal_day_minutes")),
      break_minutes: Number(fd.get("break_minutes")),
      break_threshold_minutes: Number(fd.get("break_threshold_minutes")),
    };
    try { await App.saveOrConflict(); } catch (e) { if (!e.conflito) { App.toast(e.message, "erro"); await App.render(); } return; }
    App.toast("Definições guardadas.");
    await App.render();
  },
  async "novo-feriado"(form) {
    const fd = new FormData(form);
    const data = String(fd.get("data"));
    if (App.store.data.feriados.some(f => f.data === data)) {
      App.toast("Já existe feriado nesta data.", "erro"); await App.render(); return;
    }
    App.store.data.feriados.push({ id: VR.nextId(App.store.data,"feriados"), data, nome: String(fd.get("nome")).trim() });
    try { await App.saveOrConflict(); } catch (e) { if (!e.conflito) { App.toast(e.message, "erro"); await App.render(); } return; }
    App.toast("Feriado acrescentado.");
    await App.render();
  },
  async "apagar-feriado"(form) {
    const id = Number(new FormData(form).get("id"));
    App.store.data.feriados = App.store.data.feriados.filter(f => f.id !== id);
    try { await App.saveOrConflict(); } catch (e) { if (!e.conflito) { App.toast(e.message, "erro"); await App.render(); } return; }
    App.toast("Feriado apagado.");
    await App.render();
  },
};
