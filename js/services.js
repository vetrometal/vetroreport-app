/* VetroReport — regras de negócio e consultas */
VR.Services = {
  getDefinicoes(data) {
    return data.definicoes || { normal_day_minutes: 480, break_minutes: 60, break_threshold_minutes: 360 };
  },
  equipaPorId(data, id) { return data.equipas.find(e => e.id === id); },
  funcionarioPorId(data, id) { return data.funcionarios.find(f => f.id === id); },
  obraPorId(data, id) { return data.obras.find(o => o.id === id); },
  userPorId(data, id) { return data.utilizadores.find(u => u.id === id); },
  feriadoEm(data, iso) { return data.feriados.find(f => f.data === iso) || null; },

  registoDoDia(data, funcionarioId, iso) {
    return data.registos.find(r => r.funcionario_id === funcionarioId && r.data === iso) || null;
  },
  alocacoesDe(data, registoId) {
    return data.alocacoes.filter(a => a.registo_id === registoId);
  },
  ocorrenciasDe(data, registoId) {
    return data.ocorrencias.filter(o => o.registo_id === registoId);
  },

  auditoria(data, { utilizador, acao, modelo, objeto_id, resumo, detalhe }) {
    const id = VR.nextId(data, "auditoria");
    data.auditoria.unshift({
      id, utilizador_id: utilizador ? utilizador.id : null,
      acao, modelo, objeto_id: String(objeto_id), resumo: String(resumo).slice(0,240),
      detalhe: detalhe || {}, criado_em: VR.agoraISO(),
    });
    if (data.auditoria.length > 2000) data.auditoria.length = 2000;
  },

  guardarRegisto(data, { funcionario, iso, presenca, nota_presenca, entrada, saida, trabalho, alocacoes, utilizador }) {
    nota_presenca = (nota_presenca||"").trim();
    trabalho = (trabalho||"").trim();
    if (!VR.LABEL_PRESENCA[presenca]) throw new Error("Presença inválida.");
    if (nota_presenca.length > 500) throw new Error("A nota pode ter no máximo 500 caracteres.");
    if (trabalho.length > 2000) throw new Error("O trabalho realizado pode ter no máximo 2000 caracteres.");
    if (presenca === "outro" && !nota_presenca) throw new Error("Descreva o motivo na nota.");

    let reg = VR.Services.registoDoDia(data, funcionario.id, iso);
    const defs = VR.Services.getDefinicoes(data);
    const dia_normal = reg ? reg.normal_day_minutes : defs.normal_day_minutes;
    const pausa = reg ? reg.break_minutes : defs.break_minutes;
    const limiar = reg ? reg.break_threshold_minutes : defs.break_threshold_minutes;

    let campos = { entrada:null, saida:null, gross_minutes:0, break_applied_minutes:0, net_minutes:0, overtime_minutes:0 };
    let pares = [];
    if (presenca === "presente") {
      const calc = VR.calcularTurno(entrada, saida, dia_normal, pausa, limiar);
      if (calc.net_minutes <= 0) throw new Error("O turno fica sem horas depois da pausa. Revise o horário.");
      pares = VR.Services._normalizarAlocacoes(data, alocacoes, calc.net_minutes);
      campos = { entrada, saida, ...calc };
    }
    const criado = !reg;
    if (criado) {
      reg = {
        id: VR.nextId(data, "registos"),
        funcionario_id: funcionario.id,
        data: iso,
        normal_day_minutes: dia_normal,
        break_minutes: pausa,
        break_threshold_minutes: limiar,
        criado_por_id: utilizador.id,
        criado_em: VR.agoraISO(),
      };
      data.registos.push(reg);
    }
    Object.assign(reg, {
      presenca, nota_presenca, trabalho,
      atualizado_por_id: utilizador.id,
      atualizado_em: VR.agoraISO(),
      ...campos,
    });
    data.alocacoes = data.alocacoes.filter(a => a.registo_id !== reg.id);
    for (const [obra, minutos] of pares) {
      data.alocacoes.push({ id: VR.nextId(data,"alocacoes"), registo_id: reg.id, obra_id: obra.id, minutos });
    }
    VR.Services.auditoria(data, {
      utilizador, acao: criado ? "criar" : "editar", modelo: "RegistoDiario", objeto_id: reg.id,
      resumo: `${criado?"Criou":"Editou"} o registo de ${funcionario.nome} em ${iso.split("-").reverse().join("/")}`,
      detalhe: { presenca, entrada: campos.entrada, saida: campos.saida, net_minutes: reg.net_minutes },
    });
    return reg;
  },

  _normalizarAlocacoes(data, alocacoes, liquido) {
    // alocacoes: [{obra_id, minutos|null}] — lista vazia é permitida (obra opcional).
    const pares = [];
    for (const a of alocacoes || []) {
      if (a.obra_id == null || String(a.obra_id).trim() === "") {
        if (a.minutos != null) throw new Error("Escolha a obra correspondente às horas indicadas.");
        continue;
      }
      const obra = VR.Services.obraPorId(data, Number(a.obra_id));
      if (!obra) throw new Error("Escolha uma obra da lista.");
      pares.push([obra, a.minutos]);
    }
    if (!pares.length) return [];
    if (pares.length === 1 && pares[0][1] == null) return [[pares[0][0], liquido]];
    if (pares.some(([,m]) => m == null)) throw new Error("Indique as horas em cada obra. Se for só uma, pode deixar o campo vazio.");
    const total = pares.reduce((s,[,m])=>s+m,0);
    if (total !== liquido) throw new Error(`As horas nas obras (${VR.fmtHm(total)}) não coincidem com as horas do turno (${VR.fmtHm(liquido)}).`);
    return pares;
  },

  apagarRegisto(data, reg, utilizador) {
    const f = VR.Services.funcionarioPorId(data, reg.funcionario_id);
    VR.Services.auditoria(data, {
      utilizador, acao:"apagar", modelo:"RegistoDiario", objeto_id:reg.id,
      resumo: `Apagou o registo de ${f?f.nome:"?"} em ${reg.data}`,
    });
    const ocs = data.ocorrencias.filter(o => o.registo_id === reg.id);
    data.ocorrencias = data.ocorrencias.filter(o => o.registo_id !== reg.id);
    data.alocacoes = data.alocacoes.filter(a => a.registo_id !== reg.id);
    data.registos = data.registos.filter(r => r.id !== reg.id);
    return ocs; // para apagar fotos
  },

  adicionarOcorrencia(data, { registo, tipo, descricao, foto_path, utilizador }) {
    descricao = (descricao||"").trim();
    if (!VR.LABEL_OCORRENCIA[tipo]) throw new Error("Tipo de ocorrência inválido.");
    if (descricao.length < 3) throw new Error("Descreva a ocorrência.");
    if (descricao.length > 2000) throw new Error("A descrição pode ter no máximo 2000 caracteres.");
    const oc = {
      id: VR.nextId(data,"ocorrencias"),
      registo_id: registo.id, tipo, descricao, foto: foto_path || "",
      criado_por_id: utilizador.id, criado_em: VR.agoraISO(), atualizado_em: VR.agoraISO(),
    };
    data.ocorrencias.push(oc);
    const f = VR.Services.funcionarioPorId(data, registo.funcionario_id);
    VR.Services.auditoria(data, {
      utilizador, acao:"criar", modelo:"Ocorrencia", objeto_id:oc.id,
      resumo: `Registou ${VR.LABEL_OCORRENCIA[tipo].toLowerCase()} de ${f?f.nome:"?"} em ${registo.data}`,
    });
    return oc;
  },

  apagarOcorrencia(data, oc, utilizador) {
    const reg = data.registos.find(r => r.id === oc.registo_id);
    const f = reg && VR.Services.funcionarioPorId(data, reg.funcionario_id);
    VR.Services.auditoria(data, {
      utilizador, acao:"apagar", modelo:"Ocorrencia", objeto_id:oc.id,
      resumo: `Apagou a ocorrência de ${f?f.nome:"?"} em ${reg?reg.data:""}`,
    });
    data.ocorrencias = data.ocorrencias.filter(o => o.id !== oc.id);
  },

  guardarNota(data, { iso, texto, autor }) {
    texto = (texto||"").trim();
    if (texto.length < 2) throw new Error("Escreva a nota antes de publicar.");
    if (texto.length > 2000) throw new Error("A nota pode ter no máximo 2000 caracteres.");
    const nota = {
      id: VR.nextId(data,"notas"), data: iso, texto,
      autor_id: autor.id, criado_em: VR.agoraISO(), atualizado_em: VR.agoraISO(),
    };
    data.notas.push(nota);
    VR.Services.auditoria(data, {
      utilizador: autor, acao:"criar", modelo:"NotaMural", objeto_id:nota.id,
      resumo: `Publicou uma nota no mural de ${iso}`,
    });
    return nota;
  },

  apagarNota(data, nota, utilizador) {
    if (utilizador.id !== nota.autor_id && utilizador.role !== "admin")
      throw new Error("Só o autor ou a administração pode apagar esta nota.");
    VR.Services.auditoria(data, {
      utilizador, acao:"apagar", modelo:"NotaMural", objeto_id:nota.id,
      resumo: `Apagou uma nota do mural de ${nota.data}`,
    });
    data.notas = data.notas.filter(n => n.id !== nota.id);
  },

  preencherEquipa(data, { iso, equipaId, utilizador }) {
    let funcs = data.funcionarios.filter(f => f.ativo);
    if (equipaId) funcs = funcs.filter(f => f.equipa_id === Number(equipaId));
    let criados=0, existentes=0, sem=0;
    const defs = VR.Services.getDefinicoes(data);
    for (const f of funcs) {
      if (VR.Services.registoDoDia(data, f.id, iso)) { existentes++; continue; }
      const anteriores = data.registos
        .filter(r => r.funcionario_id === f.id && r.presenca === "presente" && r.data < iso && r.entrada && r.saida)
        .sort((a,b) => b.data.localeCompare(a.data) || b.id - a.id);
      const ant = anteriores[0];
      if (!ant) { sem++; continue; }
      const alocs = VR.Services.alocacoesDe(data, ant.id);
      try {
        const calc = VR.calcularTurno(ant.entrada, ant.saida, defs.normal_day_minutes, defs.break_minutes, defs.break_threshold_minutes);
        let alocacoes = [];
        if (alocs.length) {
          const pares = VR.escalarMinutos(
            alocs.map(a => [VR.Services.obraPorId(data, a.obra_id), a.minutos]).filter(([o]) => o),
            calc.net_minutes
          );
          alocacoes = pares.map(([obra, minutos]) => ({ obra_id: obra.id, minutos }));
        }
        VR.Services.guardarRegisto(data, {
          funcionario: f, iso, presenca:"presente", nota_presenca:"",
          entrada: ant.entrada, saida: ant.saida, trabalho: ant.trabalho||"",
          alocacoes,
          utilizador,
        });
        criados++;
      } catch { sem++; }
    }
    const msg = `Preenchimento concluído: ${criados} registo${criados===1?"":"s"} novo${criados===1?"":"s"}, ${existentes} já existia${existentes===1?"":"m"}, ${sem} sem presença anterior.`;
    return { criados, existentes, sem, mensagem: msg };
  },

  eventosMural(data, iso) {
    const eventos = [];
    for (const reg of data.registos.filter(r => r.data === iso)) {
      eventos.push({ tipo:"registo", quando: reg.criado_em, autor_id: reg.criado_por_id, registo: reg });
      if (reg.atualizado_por_id && reg.atualizado_em && reg.criado_em) {
        const diff = (new Date(reg.atualizado_em) - new Date(reg.criado_em)) / 1000;
        if (diff > 60) eventos.push({ tipo:"edicao", quando: reg.atualizado_em, autor_id: reg.atualizado_por_id, registo: reg });
      }
    }
    for (const oc of data.ocorrencias) {
      const reg = data.registos.find(r => r.id === oc.registo_id);
      if (reg && reg.data === iso) eventos.push({ tipo:"ocorrencia", quando: oc.criado_em, autor_id: oc.criado_por_id, ocorrencia: oc, registo: reg });
    }
    for (const nota of data.notas.filter(n => n.data === iso)) {
      eventos.push({ tipo:"nota", quando: nota.criado_em, autor_id: nota.autor_id, nota });
    }
    eventos.sort((a,b) => (a.quando||"").localeCompare(b.quando||""));
    return eventos;
  },

  resumoHoje(data, iso) {
    const registos = data.registos.filter(r => r.data === iso);
    const ativos = data.funcionarios.filter(f => f.ativo);
    const porFunc = new Map(registos.map(r => [r.funcionario_id, r]));
    const presentes = registos.filter(r => r.presenca === "presente");
    const ausencias = registos.filter(r => r.presenca !== "presente");
    const ocorrencias = [];
    for (const r of registos) for (const o of VR.Services.ocorrenciasDe(data, r.id)) ocorrencias.push(o);
    const feriado = VR.Services.feriadoEm(data, iso);
    const fds = VR.fimDeSemana(iso);
    let por_registar = [];
    if (!feriado && !fds) por_registar = ativos.filter(f => !porFunc.has(f.id)).sort((a,b)=>a.nome.localeCompare(b.nome,"pt"));
    const obrasMap = new Map();
    const semObra = [];
    for (const reg of presentes) {
      const als = VR.Services.alocacoesDe(data, reg.id);
      if (!als.length) {
        semObra.push({ registo: reg, alocacao: { minutos: reg.net_minutes || 0 } });
        continue;
      }
      for (const al of als) {
        if (!obrasMap.has(al.obra_id)) obrasMap.set(al.obra_id, { obra: VR.Services.obraPorId(data, al.obra_id), pessoas: [] });
        obrasMap.get(al.obra_id).pessoas.push({ registo: reg, alocacao: al });
      }
    }
    const obras = [...obrasMap.values()].filter(g => g.obra)
      .sort((a,b) => b.pessoas.length - a.pessoas.length || a.obra.localidade.localeCompare(b.obra.localidade) || a.obra.nome.localeCompare(b.obra.nome));
    if (semObra.length) {
      semObra.sort((a,b) => {
        const fa=VR.Services.funcionarioPorId(data,a.registo.funcionario_id), fb=VR.Services.funcionarioPorId(data,b.registo.funcionario_id);
        return (fa?.nome||"").localeCompare(fb?.nome||"","pt");
      });
      obras.push({
        obra: { id: null, nome: "Sem obra indicada", cliente: "", localidade: "—" },
        pessoas: semObra,
        sem_obra: true,
      });
    }
    let ultima_demo = null;
    if (iso === VR.hojeISO() && !registos.length && data.registos.length) {
      ultima_demo = data.registos.map(r=>r.data).sort().slice(-1)[0];
    }
    return { presentes, ausencias: ausencias.sort((a,b)=>{
      const fa=VR.Services.funcionarioPorId(data,a.funcionario_id), fb=VR.Services.funcionarioPorId(data,b.funcionario_id);
      return (fa?.nome||"").localeCompare(fb?.nome||"","pt");
    }), por_registar, ocorrencias, obras, feriado, fim_de_semana: fds, ultima_demo };
  },

  construirRelatorio(data, ano, mes) {
    const ultimo = new Date(ano, mes, 0).getDate();
    const inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
    const fim = `${ano}-${String(mes).padStart(2,"0")}-${String(ultimo).padStart(2,"0")}`;
    const tiposAus = ["falta_justificada","falta_injustificada","baixa_medica","ferias","outro"];
    const registos = data.registos.filter(r => r.data >= inicio && r.data <= fim);
    const porFunc = new Map();
    for (const r of registos) {
      if (!porFunc.has(r.funcionario_id)) porFunc.set(r.funcionario_id, []);
      porFunc.get(r.funcionario_id).push(r);
    }
    const linhas = [];
    const detalhes = [];
    const ocorrencias = [];
    const funcs = [...data.funcionarios].sort((a,b)=>a.numero.localeCompare(b.numero)||a.nome.localeCompare(b.nome,"pt"));
    for (const f of funcs) {
      const doMes = porFunc.get(f.id) || [];
      const faltas = Object.fromEntries(tiposAus.map(t=>[t,0]));
      let dias=0, minutos=0, extra=0, totalOc=0;
      const obras = new Map();
      for (const reg of doMes) {
        if (reg.presenca === "presente") {
          dias++; minutos += reg.net_minutes||0; extra += reg.overtime_minutes||0;
          for (const al of VR.Services.alocacoesDe(data, reg.id)) {
            const obra = VR.Services.obraPorId(data, al.obra_id);
            if (!obra) continue;
            const rotulo = `${obra.cliente} — ${obra.nome}`;
            obras.set(rotulo, (obras.get(rotulo)||0) + al.minutos);
            detalhes.push({ cliente:obra.cliente, obra:obra.nome, localidade:obra.localidade, numero:f.numero, nome:f.nome, minutos:al.minutos });
          }
        } else if (faltas[reg.presenca] != null) faltas[reg.presenca]++;
        for (const oc of VR.Services.ocorrenciasDe(data, reg.id)) {
          totalOc++;
          const autor = VR.Services.userPorId(data, oc.criado_por_id);
          const eq = VR.Services.equipaPorId(data, f.equipa_id);
          ocorrencias.push({
            data: reg.data, numero:f.numero, nome:f.nome, equipa: eq?eq.nome:"",
            tipo: oc.tipo, tipo_label: VR.LABEL_OCORRENCIA[oc.tipo]||oc.tipo,
            descricao: oc.descricao, autor: autor?autor.nome:"",
            hora: oc.criado_em ? VR.fmtHora24(oc.criado_em) : "",
          });
        }
      }
      if (!f.ativo && dias===0 && Object.values(faltas).every(v=>v===0) && totalOc===0) continue;
      linhas.push({
        funcionario: f, dias, minutos, extra, faltas, ocorrencias: totalOc,
        obras: [...obras.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),
        get horas_por_cliente() { return this.obras.map(([r,m])=>`${r}: ${VR.minutosParaCsv(m)}`).join(" | "); },
      });
    }
    ocorrencias.sort((a,b)=>a.data.localeCompare(b.data)||a.nome.localeCompare(b.nome,"pt"));
    return { ano, mes, inicio, fim, linhas, detalhes_obras: detalhes, ocorrencias };
  },
};
