/* VetroReport — dados partilhados na Supabase (Postgres + Storage + Realtime) */
VR.emptyData = () => ({
  definicoes: { normal_day_minutes: 480, break_minutes: 60, break_threshold_minutes: 360 },
  utilizadores: [], equipas: [], funcionarios: [], obras: [], feriados: [],
  registos: [], alocacoes: [], ocorrencias: [], notas: [], auditoria: [],
});

/* IDs: inteiros únicos gerados no dispositivo (ms × 1000 + contador). Cabem em Number com segurança. */
VR._idSeq = Math.floor(Math.random() * 1000);
VR._idUlt = 0;
VR.novoId = () => {
  let base = Date.now() * 1000;
  VR._idSeq = (VR._idSeq + 1) % 1000;
  let id = base + VR._idSeq;
  if (id <= VR._idUlt) id = VR._idUlt + 1;
  VR._idUlt = id;
  return id;
};
VR.nextId = () => VR.novoId();

VR.DOMINIO_LOGIN = "vetroreport.local";
VR.authEmail = (login) => {
  const l = String(login || "").trim().toLowerCase();
  return l.includes("@") ? l : `${l}@${VR.DOMINIO_LOGIN}`;
};

/* Autoria: preenchida pela base de dados (trigger), a partir da sessão. Nunca é enviada pelo cliente. */
VR.AUTORIA = ["criado_por","criado_em","alterado_por","alterado_em","origem"];
VR.TABELAS = {
  utilizadores: ["id","auth_id","email","nome","role","ativo"],
  equipas: ["id","nome","ordem"],
  funcionarios: ["id","nome","numero","equipa_id","ativo"],
  obras: ["id","cliente","nome","localidade","morada","ativa"],
  feriados: ["id","data","nome"],
  registos: ["id","funcionario_id","data","presenca","nota_presenca","entrada","saida","trabalho",
    "normal_day_minutes","break_minutes","break_threshold_minutes","gross_minutes","break_applied_minutes",
    "net_minutes","overtime_minutes"],
  alocacoes: ["id","registo_id","obra_id","minutos"],
  ocorrencias: ["id","registo_id","tipo","descricao","foto"],
  notas: ["id","data","texto","autor_id"],
  auditoria: ["id","utilizador_id","acao","modelo","objeto_id","resumo","detalhe","criado_em"],
};
for (const t of Object.keys(VR.TABELAS)) if (t !== "auditoria") VR.TABELAS[t].push(...VR.AUTORIA);
/* Linha para enviar à base de dados: sem as colunas de autoria */
VR.paraEnviar = (t, n) => { if (t !== "auditoria") for (const c of VR.AUTORIA) delete n[c]; return n; };
VR.ORDEM = ["utilizadores","equipas","funcionarios","obras","feriados","registos","alocacoes","ocorrencias","notas","auditoria"];
/* utilizadores só mudam pela função vr-auth; auditoria é só acrescentar */
VR.SO_LEITURA = new Set(["utilizadores"]);
VR.SO_ACRESCENTAR = new Set(["auditoria"]);
VR.DEFS_COLS = ["normal_day_minutes","break_minutes","break_threshold_minutes"];

VR.Store = class Store {
  constructor(sb) {
    this.sb = sb;
    this.data = VR.emptyData();
    this.snap = {};            // tabela -> Map(id -> {k: json, u: updated_at})
    this.defsSnap = null;
    this.leitura = false;      // true quando sem ligação
    this.offline = false;
    this.avisos = [];
    this.carregadoEm = 0;
    this.ocupado = false;
    this._fila = [];
    this.onRemoto = null;
    this.canal = null;
  }

  _norm(t, row) {
    const o = {};
    for (const c of VR.TABELAS[t]) {
      let v = row[c];
      if (v === undefined) v = null;
      if ((c === "entrada" || c === "saida") && v) v = String(v).slice(0,5);
      if (c === "data" && v) v = String(v).slice(0,10);
      o[c] = v;
    }
    return o;
  }
  _chave(t, row) {
    const n = this._norm(t, row);
    // autoria e datas não contam para "alterado" (são da base de dados)
    delete n.criado_em;
    if (t !== "auditoria") for (const c of VR.AUTORIA) delete n[c];
    return JSON.stringify(n);
  }
  _snapSet(t, row) {
    if (!this.snap[t]) this.snap[t] = new Map();
    this.snap[t].set(row.id, { k: this._chave(t, row), u: row.updated_at || null });
  }

  async _todos(t, { ordem = "id", asc = true, limite = null } = {}) {
    const out = [];
    const passo = 1000;
    for (let de = 0; ; de += passo) {
      let q = this.sb.from(t).select("*").order(ordem, { ascending: asc });
      const ate = limite ? Math.min(de + passo, limite) - 1 : de + passo - 1;
      q = q.range(de, ate);
      const { data, error } = await q;
      if (error) throw VR.erroSupabase(error);
      out.push(...data);
      if (data.length < passo || (limite && out.length >= limite)) break;
    }
    return out;
  }

  async carregar({ admin = false } = {}) {
    const tabelas = VR.ORDEM.filter(t => t !== "auditoria");
    const [defs, ...listas] = await Promise.all([
      this.sb.from("definicoes").select("*").eq("id", 1).maybeSingle(),
      ...tabelas.map(t => this._todos(t)),
    ]);
    if (defs.error) throw VR.erroSupabase(defs.error);
    let audit = [];
    if (admin) audit = await this._todos("auditoria", { ordem: "criado_em", asc: false, limite: 300 });
    const data = VR.emptyData();
    if (defs.data) {
      for (const c of [...VR.DEFS_COLS, ...VR.AUTORIA]) data.definicoes[c] = defs.data[c];
      this.defsSnap = { k: JSON.stringify(VR.DEFS_COLS.map(c => defs.data[c])), u: defs.data.updated_at };
    }
    this.snap = {};
    tabelas.forEach((t, i) => {
      data[t] = listas[i].map(r => ({ ...this._norm(t, r), updated_at: r.updated_at }));
      data[t].forEach(r => this._snapSet(t, r));
    });
    data.auditoria = audit.map(r => ({ ...this._norm("auditoria", r) }));
    data.auditoria.forEach(r => this._snapSet("auditoria", r));
    this.data = data;
    this.carregadoEm = Date.now();
    this.offline = false; this.leitura = false;
    VR.Cache.guardar(data).catch(() => {});
    return data;
  }

  async carregarCache() {
    const d = await VR.Cache.ler();
    if (!d) return false;
    this.data = { ...VR.emptyData(), ...d };
    this.snap = {};
    for (const t of VR.ORDEM) (this.data[t] || []).forEach(r => this._snapSet(t, r));
    this.offline = true; this.leitura = true;
    return true;
  }

  /* Calcula as diferenças em relação ao último estado do servidor e grava-as. */
  async guardar() {
    if (this.offline || !navigator.onLine) {
      const e = new Error("Sem ligação à internet. A alteração não foi gravada; tente de novo quando tiver rede.");
      e.offline = true;
      await this.recarregarSilencioso();
      throw e;
    }
    this.ocupado = true;
    try {
      const plano = [];
      for (const t of VR.ORDEM) {
        if (VR.SO_LEITURA.has(t)) continue;
        const snap = this.snap[t] || new Map();
        const atuais = this.data[t] || [];
        const ids = new Set();
        const ins = [], upd = [];
        for (const r of atuais) {
          ids.add(r.id);
          const s = snap.get(r.id);
          if (!s) ins.push(r);
          else if (!VR.SO_ACRESCENTAR.has(t) && s.k !== this._chave(t, r)) upd.push([r, s.u]);
        }
        const del = VR.SO_ACRESCENTAR.has(t) ? [] : [...snap.keys()].filter(id => !ids.has(id));
        plano.push({ t, ins, upd, del });
      }
      // definições
      const d = this.data.definicoes;
      const kDefs = JSON.stringify(VR.DEFS_COLS.map(c => Number(d[c])));
      if (this.defsSnap && kDefs !== this.defsSnap.k) {
        const { data: r, error } = await this.sb.from("definicoes")
          .update(Object.fromEntries(VR.DEFS_COLS.map(c => [c, Number(d[c])])))
          .eq("id", 1).eq("updated_at", this.defsSnap.u).select();
        if (error) throw VR.erroSupabase(error);
        if (!r.length) throw VR.conflito();
        this.defsSnap = { k: kDefs, u: r[0].updated_at };
        for (const c of VR.AUTORIA) d[c] = r[0][c];
      }
      // inserções e alterações (pais antes de filhos)
      for (const { t, ins, upd } of plano) {
        if (ins.length) {
          const linhas = ins.map(r => {
            const n = this._norm(t, r);
            if (t === "auditoria") { if (!n.criado_em) n.criado_em = new Date().toISOString(); return n; }
            return VR.paraEnviar(t, n);
          });
          for (let i = 0; i < linhas.length; i += 500) {
            const lote = linhas.slice(i, i + 500);
            if (VR.SO_ACRESCENTAR.has(t)) {
              const { error } = await this.sb.from(t).insert(lote);
              if (error) throw VR.erroSupabase(error);
              lote.forEach(r => this._snapSet(t, r));
            } else {
              const { data: rs, error } = await this.sb.from(t).insert(lote).select();
              if (error) throw VR.erroSupabase(error);
              for (const r of rs) this._aplicarLocal(t, r);
            }
          }
        }
        for (const [r, u] of upd) {
          const n = VR.paraEnviar(t, this._norm(t, r)); delete n.id;
          const { data: rs, error } = await this.sb.from(t).update(n).eq("id", r.id).eq("updated_at", u).select();
          if (error) throw VR.erroSupabase(error);
          if (!rs.length) throw VR.conflito();
          this._aplicarLocal(t, rs[0]);
        }
      }
      // remoções (filhos antes de pais)
      for (const { t, del } of [...plano].reverse()) {
        if (!del.length) continue;
        for (let i = 0; i < del.length; i += 200) {
          const lote = del.slice(i, i + 200);
          const { error } = await this.sb.from(t).delete().in("id", lote);
          if (error) throw VR.erroSupabase(error);
          lote.forEach(id => this.snap[t].delete(id));
        }
      }
      VR.Cache.guardar(this.data).catch(() => {});
    } catch (e) {
      // Volta a sincronizar com o servidor para não ficar num estado meio gravado
      await this.recarregarSilencioso();
      throw e;
    } finally {
      this.ocupado = false;
      this._processarFila();
    }
  }

  async recarregarSilencioso() {
    try { await this.carregar({ admin: App.user && App.user.role === "admin" }); } catch (e) { console.warn("recarregar", e); }
  }

  _aplicarLocal(t, row) {
    const n = { ...this._norm(t, row), updated_at: row.updated_at };
    const lista = this.data[t];
    const i = lista.findIndex(x => x.id === n.id);
    if (i >= 0) lista[i] = n; else lista.push(n);
    this._snapSet(t, n);
  }

  /* ---- Realtime ---- */
  ligarRealtime() {
    if (this.canal) return;
    this.canal = this.sb.channel("vetroreport-dados")
      .on("postgres_changes", { event: "*", schema: "public" }, (p) => {
        if (this.ocupado) this._fila.push(p); else this._remoto(p);
      })
      .subscribe((estado) => { this.estadoRealtime = estado; });
  }
  async desligarRealtime() {
    if (this.canal) { try { await this.sb.removeChannel(this.canal); } catch {} this.canal = null; }
  }
  _processarFila() {
    const f = this._fila; this._fila = [];
    f.forEach(p => this._remoto(p));
  }
  _remoto(p) {
    const t = p.table;
    let mudou = false;
    if (t === "definicoes") {
      if (p.new && p.new.id === 1) {
        if (!this.defsSnap || this.defsSnap.u !== p.new.updated_at) {
          for (const c of [...VR.DEFS_COLS, ...VR.AUTORIA]) this.data.definicoes[c] = p.new[c];
          this.defsSnap = { k: JSON.stringify(VR.DEFS_COLS.map(c => p.new[c])), u: p.new.updated_at };
          mudou = true;
        }
      }
    } else if (VR.TABELAS[t]) {
      if (p.eventType === "DELETE") {
        const id = p.old && p.old.id;
        if (id != null && this.snap[t] && this.snap[t].has(id)) {
          this.data[t] = this.data[t].filter(x => x.id !== id);
          this.snap[t].delete(id);
          mudou = true;
        }
      } else if (p.new && p.new.id != null) {
        const s = this.snap[t] && this.snap[t].get(p.new.id);
        if (!s || s.u !== p.new.updated_at) { this._aplicarLocal(t, p.new); mudou = true; }
      }
    }
    if (mudou && this.onRemoto) this.onRemoto(t);
  }

  /* ---- Fotografias (bucket privado "fotos") ---- */
  async guardarFoto(blob) {
    const caminho = `${VR.hojeISO().slice(0,7)}/${VR.uid()}.jpg`;
    const { error } = await this.sb.storage.from("fotos").upload(caminho, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error("Não foi possível enviar a fotografia: " + error.message);
    return caminho;
  }
  async lerFotoUrl(caminho) {
    if (!caminho) return null;
    const { data, error } = await this.sb.storage.from("fotos").createSignedUrl(caminho.replace(/^fotos\//, ""), 3600);
    if (error) return null;
    return data.signedUrl;
  }
  async removerFoto(caminho) {
    if (!caminho) return;
    try { await this.sb.storage.from("fotos").remove([caminho.replace(/^fotos\//, "")]); } catch {}
  }
};

VR.conflito = () => { const e = new Error("CONFLITO"); e.conflito = true; return e; };
VR.erroSupabase = (error) => {
  const code = error && error.code;
  if (code === "23505") return VR.conflito();
  let msg = (error && error.message) || String(error);
  if (code === "42501" || /row-level security/i.test(msg)) msg = "Sem permissão para esta alteração.";
  else if (code === "23503") msg = "Este registo está a ser usado noutro sítio e não pode ser apagado/alterado.";
  else if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) msg = "Sem ligação ao servidor. Verifique a internet e tente de novo.";
  const e = new Error(msg); e.code = code; return e;
};

/* ---- Cache local (IndexedDB) para abrir sem rede em modo de consulta ---- */
VR.Cache = {
  _db: null,
  abrir() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const r = indexedDB.open("vetroreport-v3", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => { this._db = r.result; res(r.result); };
      r.onerror = () => rej(r.error);
    });
  },
  async guardar(data) {
    const db = await this.abrir();
    const copia = { ...data, auditoria: [] };
    return new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put({ data: copia, em: Date.now() }, "dados");
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  },
  async ler() {
    const db = await this.abrir();
    return new Promise((res) => {
      const r = db.transaction("kv").objectStore("kv").get("dados");
      r.onsuccess = () => res(r.result ? r.result.data : null);
      r.onerror = () => res(null);
    });
  },
  async limpar() {
    const db = await this.abrir();
    return new Promise((res) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").delete("dados");
      tx.oncomplete = () => res(); tx.onerror = () => res();
    });
  },
};
