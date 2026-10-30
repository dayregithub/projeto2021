import { brl, DEFAULT_LAYOUT } from "./estimate-calculations.js";
const pct = (n) =>
  `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const clean = (s) =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/[→·]/g, " | ")
    .replace(/[\u00a0\u202f]/g, " ");
let fontPromise;
async function reportFonts() {
  if (typeof document === "undefined") return null;
  fontPromise ||= Promise.all(
    ["regular", "bold"].map(async (style) => {
      const r = await fetch(
        new URL(`./fonts/report-${style}.ttf`, document.baseURI),
      );
      if (!r.ok) throw Error("Fonte indisponível");
      const bytes = new Uint8Array(await r.arrayBuffer());
      let data = "";
      for (let i = 0; i < bytes.length; i += 8192)
        data += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(data);
    }),
  ).catch(() => null);
  return fontPromise;
}
export async function professionalReport({
  brand = {},
  title,
  subtitle = "",
  generatedAt = new Date().toISOString(),
} = {}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
      compress: true,
    }),
    b = { ...DEFAULT_LAYOUT, ...brand };
  const fonts = await reportFonts();
  let face = "helvetica";
  if (fonts) {
    for (let i = 0; i < 2; i++) {
      const name = `report-${i}.ttf`;
      doc.addFileToVFS(name, fonts[i]);
      doc.addFont(name, "MakerReport", i ? "bold" : "normal");
    }
    face = "MakerReport";
  }
  const W = 297,
    H = 210,
    M = 16,
    CW = W - M * 2,
    ink = [51, 39, 33],
    accent = [104, 75, 67],
    muted = [114, 102, 94];
  let y = 49,
    logo = null;
  if (
    typeof b.logoData === "string" &&
    /^data:image\/(png|jpeg);base64,/.test(b.logoData)
  )
    logo = b.logoData;
  else if (typeof document !== "undefined") {
    try {
      const r = await fetch(new URL("./papeled-logo.png", document.baseURI));
      if (r.ok) logo = new Uint8Array(await r.arrayBuffer());
    } catch {}
  }
  const text = (s, x, yy, size = 9, bold = false, color = ink, opts = {}) => {
    doc.setFont(face, bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(clean(s), x, yy, opts);
  };
  function header() {
    doc.setFillColor(...accent);
    doc.rect(0, 0, W, 3, "F");
    if (logo) {
      try {
        doc.addImage(
          logo,
          typeof logo === "string" && logo.startsWith("data:image/jpeg")
            ? "JPEG"
            : "PNG",
          M,
          9,
          19,
          19,
        );
      } catch {}
    }
    const x = logo ? M + 24 : M;
    text(String(b.businessName).slice(0, 55), x, 15, 13, true);
    text(
      [b.businessId, b.email, b.phone]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 115),
      x,
      22,
      8,
      false,
      muted,
    );
    doc.setFont(face, "bold");
    doc.setFontSize(18);
    const titleSize = Math.max(
      8,
      Math.min(18, (18 * CW) / Math.max(1, doc.getTextWidth(clean(title)))),
    );
    text(title, M, 36, titleSize, true);
    text(subtitle.slice(0, 170), M, 43, 8, false, muted);
    doc.setDrawColor(220, 210, 202);
    doc.line(M, 46, W - M, 46);
  }
  function page() {
    doc.addPage();
    y = 54;
    header();
  }
  function ensure(h) {
    if (y + h > H - 21) page();
  }
  header();
  const api = {
    doc,
    newPage: page,
    section(label) {
      ensure(13);
      y += 5;
      text(label, M, y, 12, true);
      y += 7;
    },
    note(s) {
      doc.setFont(face, "normal");
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(clean(s), CW);
      for (const l of lines) {
        ensure(5);
        text(l, M, y, 8, false, muted);
        y += 4.5;
      }
      y += 3;
    },
    cards(items) {
      for (let i = 0; i < items.length; i += 4) {
        ensure(25);
        items.slice(i, i + 4).forEach(([label, value], j) => {
          const x = M + (j * (CW + 4)) / 4,
            w = (CW - 12) / 4;
          doc.setFillColor(247, 242, 237);
          doc.roundedRect(x, y, w, 22, 2, 2, "F");
          text(label, x + 4, y + 7, 8, false, muted);
          doc.setFont(face, "bold");
          doc.setFontSize(14);
          const size = Math.min(
            14,
            (14 * (w - 8)) / Math.max(1, doc.getTextWidth(clean(value))),
          );
          text(value, x + 4, y + 16, size, true);
        });
        y += 27;
      }
    },
    table(headers, rows, widths) {
      const sum = widths.reduce((a, b) => a + b, 0),
        ws = widths.map((w) => (w / sum) * CW);
      let headNeeded = true;
      const head = () => {
        ensure(12);
        doc.setFillColor(...accent);
        doc.rect(M, y, CW, 9, "F");
        let x = M;
        headers.forEach((h, i) => {
          text(h, x + 2, y + 6, 8, true, [255, 255, 255]);
          x += ws[i];
        });
        y += 9;
        headNeeded = false;
      };
      if (!rows.length) {
        api.note("Nenhum registro no período.");
        return;
      }
      head();
      rows.forEach((row, index) => {
        doc.setFont(face, "normal");
        doc.setFontSize(8);
        const cells = row.map((v, i) =>
          doc.splitTextToSize(clean(v), ws[i] - 4),
        );
        let line = 0,
          max = Math.max(...cells.map((c) => c.length));
        while (line < max) {
          if (y + 9 > H - 21) {
            page();
            headNeeded = true;
          }
          if (headNeeded) head();
          const available = Math.max(1, Math.floor((H - 21 - y - 4) / 4)),
            count = Math.min(available, max - line),
            h = count * 4 + 4;
          if (index % 2 === 0) {
            doc.setFillColor(248, 245, 242);
            doc.rect(M, y, CW, h, "F");
          }
          let x = M;
          cells.forEach((ls, i) => {
            ls.slice(line, line + count).forEach((v, n) =>
              text(v, x + 2, y + 5 + n * 4, 8),
            );
            x += ws[i];
          });
          doc.setDrawColor(230, 222, 215);
          doc.line(M, y + h, M + CW, y + h);
          y += h;
          line += count;
        }
      });
      y += 5;
    },
    chart(periods) {
      const data = periods.slice(-12);
      if (!data.length) return;
      ensure(60);
      const series = [
        ["revenue", "Faturamento", [104, 75, 67]],
        ["cost", "Custos", [184, 151, 121]],
        ["tax", "Impostos", [206, 135, 82]],
        ["profit", "Lucro estimado", [35, 115, 90]],
      ];
      const vals = data.flatMap((r) => series.map(([k]) => r[k] || 0)),
        min = Math.min(0, ...vals),
        max = Math.max(1, ...vals),
        top = y,
        bottom = y + 39,
        scale = (v) => bottom - ((v - min) / (max - min)) * 38,
        g = (CW - 22) / data.length,
        bw = Math.min(4, g / 6);
      doc.setDrawColor(205, 195, 185);
      doc.line(M + 22, scale(0), M + CW, scale(0));
      for (let i = 0; i < 5; i++) {
        const v = min + ((max - min) * i) / 4;
        doc.setDrawColor(230, 222, 215);
        doc.line(M + 22, scale(v), M + CW, scale(v));
        text(
          v.toLocaleString("pt-BR", {
            notation: "compact",
            maximumFractionDigits: 1,
          }),
          M + 19,
          scale(v) + 1,
          7,
          false,
          muted,
          { align: "right" },
        );
      }
      data.forEach((r, i) => {
        const x = M + 22 + (i + 0.5) * g;
        series.forEach(([key, , color], j) => {
          const v = r[key] || 0;
          doc.setFillColor(...(v < 0 ? [179, 78, 66] : color));
          doc.rect(
            x + (j - 2) * bw,
            scale(Math.max(0, v)),
            bw - 0.6,
            Math.abs(scale(v) - scale(0)),
            "F",
          );
        });
        text(r.period, x, bottom + 5, 7, false, muted, { align: "center" });
      });
      y = bottom + 13;
      series.forEach(([, label, color], i) => {
        doc.setFillColor(...color);
        doc.rect(M + i * 58, y - 3, 3, 3, "F");
        text(label, M + i * 58 + 5, y, 8);
      });
      y += 8;
      if (periods.length > 12)
        api.note(
          "Gráfico: últimos 12 períodos; as tabelas incluem todo o intervalo.",
        );
    },
    finish() {
      const total = doc.getNumberOfPages();
      for (let n = 1; n <= total; n++) {
        doc.setPage(n);
        doc.setDrawColor(220, 210, 202);
        doc.line(M, H - 16, W - M, H - 16);
        text(
          `Relatório gerencial interno | ${new Date(generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
          M,
          H - 10,
          7,
          false,
          muted,
        );
        text(`Página ${n} / ${total}`, W - M, H - 10, 8, false, muted, {
          align: "right",
        });
      }
      doc.setProperties({
        title,
        subject: "Relatório gerencial Papeled Maker",
        author: b.businessName,
      });
      return {
        bytes: new Uint8Array(doc.output("arraybuffer")),
        pages: total,
        blob: doc.output("blob"),
      };
    },
  };
  return api;
}
export async function financePDF(snapshot) {
  const { report: r, filters: f, brand, title, generatedAt } = snapshot,
    a = r.analytics,
    t = a.totals;
  const pdf = await professionalReport({
    brand,
    title,
    generatedAt,
    subtitle: `${f.from || "Início"} a ${f.to || "todo o período"} | ${f.basis === "paid" ? "Vendas aprovadas por pagamento" : "Vendas aprovadas por emissão"} | Agrupamento: ${{ day: "dia", month: "mês", year: "ano" }[f.group]}`,
  });
  pdf.section("Visão executiva");
  pdf.cards([
    ["Faturamento aprovado", brl(t.revenue)],
    ["Impostos estimados", brl(t.tax)],
    ["Custos dos projetos", brl(t.cost)],
    ["Lucro estimado", brl(t.profit)],
    ["Recebido no caixa", brl(r.metrics.received)],
    ["Despesas pagas", brl(r.metrics.paid)],
    ["Saldo de caixa", brl(r.metrics.balance)],
    ["Margem estimada", pct(t.margin)],
  ]);
  pdf.chart(a.periods);
  pdf.note(a.method);
  pdf.newPage();
  pdf.note(
    "Faturamento aprovado é o valor dos orçamentos aprovados, não emissão de nota fiscal. Lucro dos projetos inclui custos calculados e impostos, sem descontar novamente despesas do caixa.",
  );
  pdf.section("Rentabilidade por período");
  pdf.table(
    [
      "Período",
      "Faturamento",
      "Custos",
      "Impostos",
      "Lucro estimado",
      "Margem",
    ],
    a.periods.map((p) => [
      p.period,
      brl(p.revenue),
      brl(p.cost),
      brl(p.tax),
      brl(p.profit),
      pct(p.taxable ? (p.profit / p.taxable) * 100 : 0),
    ]),
    [25, 40, 38, 36, 43, 25],
  );
  pdf.section(
    "Rentabilidade por serviço / item (inclui material e adicionais)",
  );
  pdf.table(
    [
      "Serviço / processo",
      "Qtd.",
      "Venda ajustada*",
      "Custos",
      "Impostos",
      "Lucro estimado",
    ],
    a.services.map((s) => [
      `${s.description}\n${s.process === "print" ? "Impressão 3D" : s.process === "laser" ? "Laser" : "Preparação"}`,
      s.quantity.toLocaleString("pt-BR"),
      brl(s.sale),
      brl(s.cost),
      brl(s.tax),
      brl(s.profit),
    ]),
    [80, 18, 40, 38, 35, 42],
  );
  pdf.note(
    "* Venda após descontos e ajustes; inclui impostos. Frete separado, sem lucro. Preparação aparece separada quando houver.",
  );
  pdf.newPage();
  pdf.section("Detalhamento por projeto e cliente");
  pdf.table(
    [
      "Data / orçamento",
      "Cliente / projeto / serviço",
      "Venda",
      "Custos",
      "Impostos",
      "Lucro",
    ],
    a.details.map((d) => [
      `${d.date}\n${d.reference}`,
      `${d.customer}\n${d.project}\n${d.description}`,
      brl(d.sale),
      brl(d.cost),
      brl(d.tax),
      brl(d.profit),
    ]),
    [40, 92, 33, 33, 31, 36],
  );
  pdf.section("Movimentação de caixa e pendências");
  const kinds = {
    received: "Recebido",
    receivable: "A receber",
    awaiting: "Aguardando aprovação",
    rejected: "Não aprovado / cancelado",
    paid: "Despesa paga",
    payable: "Despesa pendente",
  };
  pdf.table(
    [
      "Data",
      "Cliente / categoria",
      "Descrição / referência",
      "Situação",
      "Valor",
    ],
    r.rows.map((d) => [
      d.date,
      d.customer,
      `${d.description}\n${d.reference}`,
      kinds[d.kind] || d.kind,
      brl(d.amount),
    ]),
    [25, 60, 95, 45, 40],
  );
  pdf.note(
    "Caixa por data do pagamento; pendências de clientes por emissão. Pagamentos de orçamentos cancelados ainda representam entrada no caixa, mas não venda aprovada.",
  );
  if (r.invalid.length || a.invalid.length)
    pdf.note(
      `Cálculos inválidos excluídos: ${[...new Set([...r.invalid, ...a.invalid])].join(", ")}`,
    );
  if (r.undated.length || a.undated.length)
    pdf.note(
      `Registros sem data: ${[...new Set([...r.undated, ...a.undated])].join(", ")}. Incluídos somente em todo o período.`,
    );
  return pdf.finish();
}
