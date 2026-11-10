/* VetroReport v3.0 (PWA + Supabase) — núcleo (horas, datas, crypto, utilitários) */
const VR = {
  VERSAO: "3.0",
  MESES: ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"],
  DIAS: ["segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado","domingo"],
  PRESENCAS: [
    ["presente","Presente"],
    ["falta_justificada","Falta justificada"],
    ["falta_injustificada","Falta injustificada"],
    ["baixa_medica","Baixa médica"],
    ["ferias","Férias"],
    ["outro","Outro"],
  ],
  OCORRENCIAS: [
    ["atraso","Atraso"],
    ["saida_antecipada","Saída antecipada"],
    ["acidente","Acidente"],
    ["comportamento","Comportamento"],
    ["material","Material / equipamento"],
    ["outro","Outro"],
  ],
  CORES_EQUIPA: {
    "Montagem":"#1e463c","Serralharia":"#8a4b24","Soldadura":"#1d4f86","Acabamentos":"#0e6e68"
  },
  LABEL_PRESENCA: {},
  LABEL_OCORRENCIA: {},
};

VR.PRESENCAS.forEach(([k,v]) => VR.LABEL_PRESENCA[k]=v);
VR.OCORRENCIAS.forEach(([k,v]) => VR.LABEL_OCORRENCIA[k]=v);

VR.hojeISO = () => {
  const d = new Date();
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};
VR.parseISO = (s) => {
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, m-1, d);
};
VR.fmtISO = (d) => {
  if (typeof d === "string") return d.slice(0,10);
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};
VR.addDays = (iso, n) => {
  const d = VR.parseISO(iso); d.setDate(d.getDate()+n); return VR.fmtISO(d);
};
VR.diaSemana = (iso) => VR.DIAS[VR.parseISO(iso).getDay() === 0 ? 6 : VR.parseISO(iso).getDay()-1].replace(/^./,c=>c.toUpperCase());
VR.dataCurta = (iso) => { const d=VR.parseISO(iso); return `${d.getDate()} de ${VR.MESES[d.getMonth()]}`; };
VR.dataLonga = (iso) => `${VR.diaSemana(iso)}, ${VR.dataCurta(iso)} de ${VR.parseISO(iso).getFullYear()}`;
VR.mesAno = (ano, mes) => `${VR.MESES[mes-1]} de ${ano}`;
VR.fimDeSemana = (iso) => { const w=VR.parseISO(iso).getDay(); return w===0||w===6; };
VR.iniciais = (nome) => {
  const p = String(nome||"").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length===1) return p[0].slice(0,2).toUpperCase();
  return (p[0][0]+p[p.length-1][0]).toUpperCase();
};
VR.corEquipa = (nome) => VR.CORES_EQUIPA[nome] || "#5f5a53";
VR.uid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  a[6]=(a[6]&0x0f)|0x40; a[8]=(a[8]&0x3f)|0x80;
  const h=[...a].map(b=>b.toString(16).padStart(2,"0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
};
VR.agoraISO = () => new Date().toISOString();
VR.esc = (s) => String(s??"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
VR.fmtHm = (minutos) => {
  minutos = Math.trunc(minutos||0);
  const h = Math.floor(Math.abs(minutos)/60), m = Math.abs(minutos)%60;
  const t = m ? `${h}h${String(m).padStart(2,"0")}` : `${h}h`;
  return minutos < 0 ? `-${t}` : t;
};
VR.parseHoras = (valor) => {
  const texto = String(valor||"").trim().replace(/\s/g,"").replace(",",".");
  if (!texto) throw new Error("vazio");
  const n = Number(texto);
  if (!Number.isFinite(n) || n < 0 || n > 24) throw new Error("invalido");
  return Math.round(n * 60);
};
VR.minutosParaInput = (minutos) => {
  const q = (Math.trunc(minutos)/60).toFixed(2).replace(".",",");
  if (q.endsWith(",00")) return q.slice(0,-3);
  if (q.endsWith("0")) return q.slice(0,-1);
  return q;
};
VR.minutosParaCsv = (minutos) => (Math.trunc(minutos)/60).toFixed(2).replace(".",",");
VR.minutosParaDecimal = (minutos) => Math.round(Math.trunc(minutos)/60*100)/100;
VR.calcularTurno = (entrada, saida, diaNormal, pausa, limiar) => {
  if (!entrada || !saida) throw new Error("Indique a entrada e a saída.");
  const a = entrada.split(":").map(Number), b = saida.split(":").map(Number);
  if (a.length<2||b.length<2||a.some(isNaN)||b.some(isNaN)) throw new Error("Horas inválidas.");
  const inicio = a[0]*60+a[1], fim = b[0]*60+b[1];
  if (fim <= inicio) throw new Error("A saída tem de ser depois da entrada.");
  const bruto = fim - inicio;
  let aplicada = bruto >= Number(limiar) ? Number(pausa) : 0;
  aplicada = Math.min(aplicada, bruto);
  const liquido = bruto - aplicada;
  const extra = Math.max(0, liquido - Number(diaNormal));
  return { gross_minutes: bruto, break_applied_minutes: aplicada, net_minutes: liquido, overtime_minutes: extra };
};
VR.escalarMinutos = (pares, alvo) => {
  const total = pares.reduce((s,[,m])=>s+m,0);
  if (total === alvo) return pares.filter(([,m])=>m>0);
  if (total <= 0) {
    if (pares.length===1) return [[pares[0][0], alvo]];
    throw new Error("Não foi possível repartir as horas pelas obras.");
  }
  const bruto = pares.map(([o,m]) => [o, (m/total)*alvo]);
  const base = bruto.map(([o,v]) => [o, Math.trunc(v)]);
  let resto = alvo - base.reduce((s,[,m])=>s+m,0);
  const ordem = bruto.map((x,i)=>i).sort((i,j)=>(bruto[j][1]-base[j][1])-(bruto[i][1]-base[i][1]));
  for (const i of ordem.slice(0, Math.max(resto,0))) base[i][1] += 1;
  return base.filter(([,m])=>m>0);
};
VR.horarioTextos = (reg) => {
  if (!reg) return [];
  const entrada = reg.entrada, saida = reg.saida;
  if (entrada && saida) return [`${entrada.slice(0,5)}\u2013${saida.slice(0,5)}`];
  if (entrada) return [`Entrada ${entrada.slice(0,5)}`];
  if (saida) return [`Saída ${saida.slice(0,5)}`];
  return [];
};


/* ---- Horas sempre em 24h (nunca am/pm) ---- */
VR.fmtHora24 = (d) => {
  if (d == null || d === "") return "";
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return `${String(x.getHours()).padStart(2,"0")}:${String(x.getMinutes()).padStart(2,"0")}`;
};
VR.fmtDataHora24 = (d) => {
  if (d == null || d === "") return "";
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const dia = `${String(x.getDate()).padStart(2,"0")}/${String(x.getMonth()+1).padStart(2,"0")}/${x.getFullYear()}`;
  return `${dia} ${VR.fmtHora24(x)}`;
};
/** Aceita 8, 8:3, 830, 0830, 8:30, 17:00 → "HH:MM" ou null se inválido/vazio. */
VR.normalizarHora = (valor) => {
  let s = String(valor ?? "").trim().toLowerCase()
    .replace(/\s/g, "")
    .replace(/[hH.]/g, ":")
    .replace(/,/g, ":");
  // remove am/pm se alguém colar
  s = s.replace(/(a\.?m\.?|p\.?m\.?)$/i, "");
  if (!s) return null;
  let h, m;
  if (/^\d{1,2}:\d{1,2}$/.test(s)) {
    [h, m] = s.split(":").map(Number);
  } else if (/^\d{1,2}$/.test(s)) {
    h = Number(s); m = 0;
  } else if (/^\d{3}$/.test(s)) {
    h = Number(s.slice(0,1)); m = Number(s.slice(1));
  } else if (/^\d{4}$/.test(s)) {
    h = Number(s.slice(0,2)); m = Number(s.slice(2));
  } else {
    throw new Error("Hora inválida. Use 08:00 ou 17:30.");
  }
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error("Hora inválida. Use 00:00 a 23:59.");
  }
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
};

VR.downloadBlob = (blob, nome) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

VR.comprimirJpeg = async (file, maxSide = 1600, quality = 0.82) => {
  if (!file) return null;
  const bmp = await createImageBitmap(file);
  let w = bmp.width, h = bmp.height;
  const scale = Math.min(1, maxSide / Math.max(w,h));
  w = Math.round(w*scale); h = Math.round(h*scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", quality));
  return blob;
};
