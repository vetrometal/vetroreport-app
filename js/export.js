/* Exportações CSV e XLSX (OOXML mínimo via CompressionStream) */
VR.Export = {
  cabecalho: ["Número","Nome","Equipa","Dias trabalhados","Horas","Horas extra","Faltas justificadas","Faltas injustificadas","Baixas médicas","Férias","Outras ausências","Ocorrências","Horas por cliente"],

  csv(relatorio) {
    const linhas = [this.cabecalho.join(";")];
    for (const l of relatorio.linhas) {
      const eq = VR.Services.equipaPorId(App.store.data, l.funcionario.equipa_id);
      linhas.push([
        l.funcionario.numero, l.funcionario.nome, eq?eq.nome:"",
        l.dias, VR.minutosParaCsv(l.minutos), VR.minutosParaCsv(l.extra),
        l.faltas.falta_justificada, l.faltas.falta_injustificada, l.faltas.baixa_medica, l.faltas.ferias, l.faltas.outro,
        l.ocorrencias, l.horas_por_cliente,
      ].map(VR.Export._csvCell).join(";"));
    }
    const bom = "\ufeff";
    return new Blob([bom + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  },
  _csvCell(v) {
    const s = String(v??"");
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  },

  async xlsx(relatorio) {
    const titulo = VR.mesAno(relatorio.ano, relatorio.mes);
    const sheets = [];
    // Resumo
    const resumoRows = [this.cabecalho];
    for (const l of relatorio.linhas) {
      const eq = VR.Services.equipaPorId(App.store.data, l.funcionario.equipa_id);
      resumoRows.push([
        l.funcionario.numero, l.funcionario.nome, eq?eq.nome:"",
        l.dias, VR.minutosParaDecimal(l.minutos), VR.minutosParaDecimal(l.extra),
        l.faltas.falta_justificada, l.faltas.falta_injustificada, l.faltas.baixa_medica, l.faltas.ferias, l.faltas.outro,
        l.ocorrencias, l.horas_por_cliente,
      ]);
    }
    sheets.push({ name: "Resumo", rows: resumoRows });
    sheets.push({
      name: "Horas por cliente",
      rows: [["Cliente","Obra","Localidade","Número","Nome","Horas"],
        ...relatorio.detalhes_obras.map(d => [d.cliente,d.obra,d.localidade,d.numero,d.nome,VR.minutosParaDecimal(d.minutos)])],
    });
    sheets.push({
      name: "Ocorrências",
      rows: [["Data","Número","Nome","Equipa","Tipo","Descrição","Registado por","Hora"],
        ...relatorio.ocorrencias.map(o => [
          o.data.split("-").reverse().join("/"), o.numero, o.nome, o.equipa, o.tipo_label, o.descricao, o.autor, o.hora,
        ])],
    });
    return VR.Export._buildXlsx(sheets, titulo);
  },

  _escapeXml(s) {
    return String(s??"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
  },
  _sheetXml(rows) {
    let out = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`;
    rows.forEach((row, ri) => {
      out += `<row r="${ri+1}">`;
      row.forEach((cell, ci) => {
        const ref = VR.Export._col(ci)+(ri+1);
        if (typeof cell === "number" && Number.isFinite(cell)) {
          out += `<c r="${ref}"><v>${cell}</v></c>`;
        } else {
          out += `<c r="${ref}" t="inlineStr"><is><t>${VR.Export._escapeXml(cell)}</t></is></c>`;
        }
      });
      out += `</row>`;
    });
    out += `</sheetData></worksheet>`;
    return out;
  },
  _col(i) {
    let s = ""; i += 1;
    while (i) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); }
    return s;
  },
  async _buildXlsx(sheets, titulo) {
    const files = {};
    files["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`;
    files["_rels/.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
    files["xl/workbook.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sheets.map((s,i)=>`<sheet name="${VR.Export._escapeXml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}
</sheets></workbook>`;
    files["xl/_rels/workbook.xml.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}
</Relationships>`;
    sheets.forEach((s,i) => { files[`xl/worksheets/sheet${i+1}.xml`] = VR.Export._sheetXml(s.rows); });
    return VR.Export._zip(files);
  },

  async _zip(files) {
    // ZIP local file header + central directory (store or deflate)
    const entries = [];
    let offset = 0;
    const chunks = [];
    const enc = new TextEncoder();
    for (const [name, content] of Object.entries(files)) {
      const nameBytes = enc.encode(name);
      const data = typeof content === "string" ? enc.encode(content) : content;
      let compressed = data;
      let method = 0;
      if (typeof CompressionStream !== "undefined") {
        try {
          const cs = new CompressionStream("deflate-raw");
          const stream = new Blob([data]).stream().pipeThrough(cs);
          compressed = new Uint8Array(await new Response(stream).arrayBuffer());
          method = 8;
        } catch { compressed = data; method = 0; }
      }
      const crc = VR.Export._crc32(data);
      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(8, method, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, compressed.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      local.set(nameBytes, 30);
      chunks.push(local, compressed);
      entries.push({ nameBytes, method, crc, comp: compressed.length, raw: data.length, offset });
      offset += local.length + compressed.length;
    }
    const startCD = offset;
    for (const e of entries) {
      const cd = new Uint8Array(46 + e.nameBytes.length);
      const v = new DataView(cd.buffer);
      v.setUint32(0, 0x02014b50, true);
      v.setUint16(8, e.method, true);
      v.setUint32(16, e.crc, true);
      v.setUint32(20, e.comp, true);
      v.setUint32(24, e.raw, true);
      v.setUint16(28, e.nameBytes.length, true);
      v.setUint32(42, e.offset, true);
      cd.set(e.nameBytes, 46);
      chunks.push(cd);
      offset += cd.length;
    }
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, offset - startCD, true);
    ev.setUint32(16, startCD, true);
    chunks.push(end);
    return new Blob(chunks, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  },

  _crcTable: null,
  _crc32(buf) {
    if (!VR.Export._crcTable) {
      const t = new Uint32Array(256);
      for (let n=0;n<256;n++) {
        let c = n;
        for (let k=0;k<8;k++) c = (c & 1) ? (0xedb88320 ^ (c>>>1)) : (c>>>1);
        t[n] = c;
      }
      VR.Export._crcTable = t;
    }
    let crc = 0 ^ (-1);
    for (let i=0;i<buf.length;i++) crc = (crc>>>8) ^ VR.Export._crcTable[(crc ^ buf[i]) & 0xff];
    return (crc ^ (-1)) >>> 0;
  },
};
