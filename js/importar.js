/* VetroReport v3.0 — importação do ficheiro vetroreport.json da versão 2.x (só administração) */
VR.Importar = {
  _chave: (s) => String(s ?? "").trim().toLowerCase(),

  async _upsert(t, linhas, progresso, rotulo, opcoes = { onConflict: "id" }) {
    for (let i = 0; i < linhas.length; i += 500) {
      const lote = linhas.slice(i, i + 500);
      const { error } = await App.sb.from(t).upsert(lote, opcoes);
      if (error) throw new Error(`${rotulo}: ${VR.erroSupabase(error).message}`);
      progresso(`${rotulo}: ${Math.min(i + 500, linhas.length)} de ${linhas.length}…`);
    }
  },

  async v23(json, { fotos = [], progresso = () => {} } = {}) {
    if (!App.user || App.user.role !== "admin") throw new Error("Só a administração pode importar.");
    if (!json || !Array.isArray(json.funcionarios) || !Array.isArray(json.registos))
      throw new Error("Este ficheiro não parece um vetroreport.json da versão 2.x.");
    const st = App.store;
    const K = VR.Importar._chave;
    progresso("A ler os dados atuais…");
    await st.carregar({ admin: true });
    const D = st.data;
    const agora = new Date().toISOString();
    const N = (v, d = 0) => (v == null || v === "" || !Number.isFinite(Number(v))) ? d : Math.trunc(Number(v));
    const T = (v) => v == null ? "" : String(v);
    const hora = (v) => v ? String(v).slice(0, 5) : null;
    const novoSe = (lista, idOrig, ehOMesmo) => {
      // mantém o id original se estiver livre (ou se já for o mesmo registo), senão gera outro
      const id = Number(idOrig);
      if (!Number.isSafeInteger(id) || id <= 0) return VR.novoId();
      const ocupado = lista.find(x => x.id === id);
      return (!ocupado || ehOMesmo(ocupado)) ? id : VR.novoId();
    };

    // 1) Utilizadores (contas) — pela função com service role
    progresso("A importar utilizadores…");
    const us = (json.utilizadores || []).filter(u => u && u.email);
    const ru = await App.funcao({
      acao: "importar_utilizadores",
      utilizadores: us.map(u => ({ id: u.id, email: u.email, nome: u.nome, role: u.role, ativo: u.ativo !== false, password: u.password })),
    });
    const mapU = (id) => (id == null ? null : (ru.mapa[String(id)] ?? null));

    // 2) Definições
    if (json.definicoes) {
      const d = json.definicoes;
      const { error } = await App.sb.from("definicoes").update({
        normal_day_minutes: N(d.normal_day_minutes, 480), break_minutes: N(d.break_minutes, 60),
        break_threshold_minutes: N(d.break_threshold_minutes, 360),
      }).eq("id", 1);
      if (error) throw new Error("Definições: " + VR.erroSupabase(error).message);
    }
    const defs = json.definicoes || D.definicoes;

    // 3) Equipas (por nome)
    const mapE = {}, equipas = [];
    for (const e of json.equipas || []) {
      const ex = D.equipas.find(x => K(x.nome) === K(e.nome));
      const id = ex ? ex.id : novoSe(D.equipas, e.id, () => false);
      mapE[e.id] = id;
      equipas.push({ id, nome: T(e.nome).trim() || "Equipa", ordem: N(e.ordem) });
    }
    await VR.Importar._upsert("equipas", equipas, progresso, "Equipas");

    // 4) Funcionários (por número)
    const mapF = {}, funcs = [];
    for (const f of json.funcionarios) {
      const numero = T(f.numero).trim() || `sem-numero-${f.id}`;
      const ex = D.funcionarios.find(x => x.numero === numero);
      const id = ex ? ex.id : novoSe(D.funcionarios, f.id, () => false);
      mapF[f.id] = id;
      funcs.push({ id, nome: T(f.nome).trim() || numero, numero, equipa_id: f.equipa_id != null ? (mapE[f.equipa_id] ?? null) : null, ativo: f.ativo !== false });
    }
    await VR.Importar._upsert("funcionarios", funcs, progresso, "Funcionários");

    // 5) Obras (por cliente + obra + localidade)
    const mapO = {}, obras = [];
    const ko = (o) => `${K(o.cliente)}|${K(o.nome)}|${K(o.localidade)}`;
    for (const o of json.obras || []) {
      const ex = D.obras.find(x => ko(x) === ko(o));
      const id = ex ? ex.id : novoSe(D.obras, o.id, () => false);
      mapO[o.id] = id;
      obras.push({ id, cliente: T(o.cliente), nome: T(o.nome).trim() || "Obra", localidade: T(o.localidade), morada: T(o.morada), ativa: o.ativa !== false });
    }
    await VR.Importar._upsert("obras", obras, progresso, "Obras");

    // 6) Feriados (por data)
    const fers = [];
    const vistosFer = new Set();
    for (const f of json.feriados || []) {
      const data = T(f.data).slice(0, 10);
      if (!data || vistosFer.has(data)) continue;
      vistosFer.add(data);
      const ex = D.feriados.find(x => x.data === data);
      fers.push({ id: ex ? ex.id : novoSe(D.feriados, f.id, () => false), data, nome: T(f.nome) || "Feriado" });
    }
    await VR.Importar._upsert("feriados", fers, progresso, "Feriados");

    // 7) Registos do dia (por funcionário + data)
    const mapR = {}, regs = [], jaExistiam = [];
    const vistosReg = new Set();
    for (const r of json.registos) {
      const fid = mapF[r.funcionario_id];
      const data = T(r.data).slice(0, 10);
      if (!fid || !data || vistosReg.has(`${fid}|${data}`)) continue;
      vistosReg.add(`${fid}|${data}`);
      const ex = D.registos.find(x => x.funcionario_id === fid && x.data === data);
      const id = ex ? ex.id : novoSe(D.registos, r.id, () => false);
      if (ex) jaExistiam.push(id);
      mapR[r.id] = id;
      const presenca = VR.LABEL_PRESENCA[r.presenca] ? r.presenca : "outro";
      regs.push({
        id, funcionario_id: fid, data, presenca,
        nota_presenca: T(r.nota_presenca).slice(0, 500) || (presenca === "outro" && !VR.LABEL_PRESENCA[r.presenca] ? T(r.presenca) : ""),
        entrada: hora(r.entrada), saida: hora(r.saida), trabalho: T(r.trabalho).slice(0, 2000),
        normal_day_minutes: N(r.normal_day_minutes, N(defs.normal_day_minutes, 480)),
        break_minutes: N(r.break_minutes, N(defs.break_minutes, 60)),
        break_threshold_minutes: N(r.break_threshold_minutes, N(defs.break_threshold_minutes, 360)),
        gross_minutes: N(r.gross_minutes), break_applied_minutes: N(r.break_applied_minutes),
        net_minutes: N(r.net_minutes), overtime_minutes: N(r.overtime_minutes),
        criado_por_id: mapU(r.criado_por_id), atualizado_por_id: mapU(r.atualizado_por_id) ?? App.user.id,
        criado_em: r.criado_em || agora, atualizado_em: r.atualizado_em || r.criado_em || agora,
      });
    }
    await VR.Importar._upsert("registos", regs, progresso, "Registos");

    // 8) Alocações por obra — substitui as dos registos que já existiam
    if (jaExistiam.length) {
      for (let i = 0; i < jaExistiam.length; i += 200) {
        const { error } = await App.sb.from("alocacoes").delete().in("registo_id", jaExistiam.slice(i, i + 200));
        if (error) throw new Error("Alocações: " + VR.erroSupabase(error).message);
      }
    }
    const alocs = [];
    const idsAloc = new Set();
    for (const a of json.alocacoes || []) {
      const rid = mapR[a.registo_id], oid = mapO[a.obra_id];
      if (!rid || !oid) continue;
      let id = Number(a.id);
      const ocupado = D.alocacoes.find(x => x.id === id && x.registo_id !== rid);
      if (!Number.isSafeInteger(id) || id <= 0 || ocupado || idsAloc.has(id)) id = VR.novoId();
      idsAloc.add(id);
      alocs.push({ id, registo_id: rid, obra_id: oid, minutos: Math.max(0, N(a.minutos)) });
    }
    await VR.Importar._upsert("alocacoes", alocs, progresso, "Horas por obra");

    // 9) Ocorrências
    const ocs = [];
    for (const o of json.ocorrencias || []) {
      const rid = mapR[o.registo_id];
      if (!rid) continue;
      const ex = D.ocorrencias.find(x => x.id === Number(o.id));
      const id = (ex && ex.registo_id !== rid) ? VR.novoId() : novoSe(D.ocorrencias, o.id, (x) => x.registo_id === rid);
      ocs.push({
        id, registo_id: rid, tipo: VR.LABEL_OCORRENCIA[o.tipo] ? o.tipo : "outro",
        descricao: T(o.descricao).slice(0, 2000), foto: T(o.foto).replace(/^\/+/, "").replace(/^fotos\//, ""),
        criado_por_id: mapU(o.criado_por_id), criado_em: o.criado_em || agora, atualizado_em: o.atualizado_em || o.criado_em || agora,
      });
    }
    await VR.Importar._upsert("ocorrencias", ocs, progresso, "Ocorrências");

    // 10) Notas do mural
    const notas = [];
    for (const n of json.notas || []) {
      if (!n.texto || !n.data) continue;
      notas.push({
        id: novoSe(D.notas, n.id, (x) => x.data === T(n.data).slice(0, 10) && x.texto === T(n.texto)),
        data: T(n.data).slice(0, 10), texto: T(n.texto).slice(0, 2000), autor_id: mapU(n.autor_id),
        criado_em: n.criado_em || agora, atualizado_em: n.atualizado_em || n.criado_em || agora,
      });
    }
    await VR.Importar._upsert("notas", notas, progresso, "Notas");

    // 11) Auditoria (histórico) — não substitui o que já existe
    const aud = (json.auditoria || []).filter(a => a && a.id != null).map(a => ({
      id: Number(a.id), utilizador_id: mapU(a.utilizador_id), acao: T(a.acao) || "importar", modelo: T(a.modelo) || "?",
      objeto_id: T(a.objeto_id), resumo: T(a.resumo).slice(0, 240), detalhe: (a.detalhe && typeof a.detalhe === "object") ? a.detalhe : {},
      criado_em: a.criado_em || agora,
    })).filter(a => Number.isSafeInteger(a.id));
    await VR.Importar._upsert("auditoria", aud, progresso, "Auditoria", { onConflict: "id", ignoreDuplicates: true });

    // 12) Fotografias (opcional)
    let enviadas = 0, emFalta = 0;
    const comFoto = ocs.filter(o => o.foto);
    if (comFoto.length && fotos.length) {
      const porCaminho = new Map();
      for (const f of fotos) {
        const rel = (f.webkitRelativePath || f.name).replace(/\\/g, "/");
        porCaminho.set(rel, f);
      }
      const procurar = (chave) => {
        for (const [rel, f] of porCaminho) if (rel === chave || rel.endsWith("/" + chave)) return f;
        const nome = chave.split("/").pop();
        for (const [rel, f] of porCaminho) if (rel.split("/").pop() === nome) return f;
        return null;
      };
      let i = 0;
      for (const o of comFoto) {
        i++;
        progresso(`Fotografias: ${i} de ${comFoto.length}…`);
        const f = procurar(o.foto);
        if (!f) { emFalta++; continue; }
        const { error } = await App.sb.storage.from("fotos").upload(o.foto, f, { upsert: true, contentType: f.type || "image/jpeg" });
        if (error) { console.warn("foto", o.foto, error); emFalta++; } else enviadas++;
      }
    } else emFalta = comFoto.length;

    // registo da importação na auditoria
    await App.sb.from("auditoria").insert({
      id: VR.novoId(), utilizador_id: App.user.id, acao: "importar", modelo: "Importacao", objeto_id: "v2",
      resumo: `Importou ${funcs.length} funcionários e ${regs.length} registos da versão 2.x`, detalhe: { ficheiro: "vetroreport.json" },
    });

    const partes = [
      `${ru.criados} utilizador${ru.criados === 1 ? "" : "es"} novo${ru.criados === 1 ? "" : "s"}`,
      `${funcs.length} funcionários`, `${obras.length} obras`, `${regs.length} registos`,
      `${ocs.length} ocorrências`, `${notas.length} notas`,
    ];
    let mensagem = "Importação concluída: " + partes.join(", ") + ".";
    if (comFoto.length) mensagem += ` Fotografias: ${enviadas} enviadas${emFalta ? `, ${emFalta} não encontradas (pode repetir a importação escolhendo a pasta dados\\fotos)` : ""}.`;
    return { mensagem, enviadas, emFalta, registos: regs.length, funcionarios: funcs.length, utilizadores: ru };
  },
};
