import { companyLinks } from "./company-links.js";
import { jsPDF } from "jspdf";
import {
  DEFAULT_LAYOUT,
  calculateEstimate,
  validateEstimate,
  brl,
} from "./estimate-calculations.js";
const dateBR = (s) => s.split("-").reverse().join("/");
export async function estimatePDF(quote, { logoData } = {}) {
  validateEstimate(quote);
  const result = calculateEstimate(quote),
    l = { ...DEFAULT_LAYOUT, ...quote.layout },
    doc = new jsPDF({ unit: "mm", format: "a4" }),
    margin = 16,
    bottom = 275,
    width = 178,
    font = l.fontSize,
    line = font * (l.template === "compact" ? 0.42 : 0.48),
    accent = l.accent.match(/\w\w/g).map((h) => parseInt(h, 16));
  let y = 0;
  let logo = logoData || l.logoData;
  if (!logo) {
    const response = await fetch(
      new URL("./papeled-logo.png", document.baseURI),
    );
    if (!response.ok) throw Error("Não foi possível carregar a logo.");
    logo = new Uint8Array(await response.arrayBuffer());
  }
  const clean = (s) =>
    String(s ?? "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...");
  function text(s, x, yy, size = font, style = "normal", color = [51, 39, 33]) {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(Array.isArray(s) ? s.map(clean) : clean(s), x, yy);
  }
  function header() {
    const modern = l.template === "modern";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    const name = doc.splitTextToSize(clean(l.businessName), 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const tagline = doc.splitTextToSize(clean(l.tagline), 100);
    const company = [
      [l.phone, l.email].filter(Boolean).join(" | "),
      l.businessId ? `CPF / CNPJ: ${l.businessId}` : "",
      l.address,
    ]
      .filter(Boolean)
      .flatMap((value) =>
        doc
          .splitTextToSize(clean(value), width)
          .map((label) => ({ label, url: null })),
      );
    for (const link of companyLinks(l))
      company.push(
        ...doc
          .splitTextToSize(clean(link.label), width)
          .map((label) => ({ label, url: link.url })),
      );
    doc.setFontSize(9);
    const reference = doc.splitTextToSize(clean(quote.number), 42);
    const topEnd = Math.max(
      37,
      18 + name.length * 6 + tagline.length * 4,
      20 + reference.length * 4 + 8,
    );
    const headerEnd = topEnd + company.length * 4 + 5;
    if (modern) {
      doc.setFillColor(...accent);
      doc.rect(0, 0, 210, headerEnd, "F");
    }
    doc.saveGraphicsState();
    doc.circle(27, 24, 11, null);
    doc.clip();
    doc.discardPath();
    doc.addImage(
      logo,
      typeof logo === "string" && logo.startsWith("data:image/jpeg")
        ? "JPEG"
        : "PNG",
      16,
      13,
      22,
      22,
    );
    doc.restoreGraphicsState();
    const color = modern ? [255, 255, 255] : accent;
    name.forEach((entry, i) => text(entry, 43, 18 + i * 6, 13, "bold", color));
    tagline.forEach((entry, i) =>
      text(entry, 43, 18 + name.length * 6 + i * 4, 8, "normal", color),
    );
    reference.forEach((entry, i) =>
      text(entry, 152, 20 + i * 4, 9, "bold", color),
    );
    text(
      dateBR(quote.issuedOn),
      152,
      24 + reference.length * 4,
      9,
      "normal",
      color,
    );
    company.forEach((entry, i) => {
      const yy = topEnd + i * 4;
      text(entry.label, margin, yy, 8, "normal", color);
      if (entry.url)
        doc.link(margin, yy - 3, doc.getTextWidth(clean(entry.label)), 4, {
          url: entry.url,
        });
    });
    if (!modern) {
      doc.setDrawColor(...accent);
      doc.line(margin, headerEnd, 194, headerEnd);
    }
    y = headerEnd + 10;
  }
  function page() {
    doc.addPage();
    header();
  }
  function space(h) {
    if (y + h > bottom) page();
  }
  function block(label, value) {
    if (!value) return;
    const lines = doc.splitTextToSize(clean(value), width);
    space(line * 2);
    text(label, margin, y, font, "bold");
    y += line;
    for (const entry of lines) {
      space(line + 1);
      text(entry, margin, y);
      y += line;
    }
    y += 3;
  }
  function tableHeader() {
    space(12);
    doc.setFillColor(244, 239, 235);
    doc.rect(margin, y - 4, width, 9, "F");
    text("ITEM / DESCRIÇÃO", margin + 2, y, 9, "bold");
    text("QTD.", 116, y, 9, "bold");
    text("UNITÁRIO", 136, y, 9, "bold");
    text("SUBTOTAL", 166, y, 9, "bold");
    y += 10;
  }
  header();
  text("DADOS DO CLIENTE", margin, y, 9, "bold", accent);
  y += 6;
  block("Cliente", quote.customer || "Não informado");
  if (quote.contact) block("Contato do cliente", quote.contact);
  if (quote.customerId) block("CPF / CNPJ do cliente", quote.customerId);
  doc.setDrawColor(228, 217, 207);
  doc.line(margin, y, 194, y);
  y += 8;
  block(l.title, quote.title);
  tableHeader();
  (result.invoiceRows || result.items).forEach((item, index) => {
    const description = [
      `${index + 1}. ${item.description}`,
      ...(l.showTechnical
        ? [
            `${item.process === "laser" ? "Laser" : "Impressão 3D"} - ${item.technical}`,
          ]
        : []),
    ].join("\n");
    doc.setFontSize(font);
    const lines = doc.splitTextToSize(clean(description), 94);
    if (y + Math.min(lines.length, 5) * line + 5 > bottom) {
      page();
      tableHeader();
    }
    text(String(item.quantity), 117, y);
    text(
      item.preciseUnitPrice
        ? item.unitPrice.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          })
        : brl(item.unitPrice),
      136,
      y,
      item.preciseUnitPrice ? 8 : font,
    );
    text(brl(item.subtotal), 166, y, font, "bold");
    for (const entry of lines) {
      if (y + line > bottom) {
        page();
        tableHeader();
      }
      text(entry, margin + 2, y);
      y += line;
    }
    y += 3;
    doc.setDrawColor(224, 215, 208);
    doc.line(margin, y, 194, y);
    y += 6;
  });
  const totals = [
    ...(quote.calculationVersion === 2
      ? [
          ["Valor do material", result.materialTotal],
          ["Valor do serviço", result.serviceTotal],
          ...(result.additionalTotal
            ? [["Serviços adicionais", result.additionalTotal]]
            : []),
        ]
      : [["Itens", result.itemSubtotal]]),
    ...(quote.setupPrice ? [["Preparação / projeto", quote.setupPrice]] : []),
    ...(result.discount ? [["Desconto", -result.discount]] : []),
    ...(quote.adjustment ? [["Ajuste comercial", quote.adjustment]] : []),
    ...(quote.shipping ? [["Frete", quote.shipping]] : []),
  ];
  space(totals.length * 7 + 19);
  for (const [label, value] of totals) {
    text(label, 110, y);
    text(brl(value), 164, y);
    y += 7;
  }
  doc.setFillColor(...accent);
  doc.rect(108, y - 3, 86, 12, "F");
  text("TOTAL", 111, y + 4, font + 1, "bold", [255, 255, 255]);
  text(brl(result.total), 164, y + 4, font + 1, "bold", [255, 255, 255]);
  y += 20;
  const expiration = new Date(quote.issuedOn + "T12:00:00Z");
  expiration.setUTCDate(expiration.getUTCDate() + quote.validityDays);
  block(
    "Validade",
    `${quote.validityDays} dia(s), até ${dateBR(expiration.toISOString().slice(0, 10))}.`,
  );
  block("Prazo de produção / entrega", quote.delivery);
  if (l.showPayment) block("Pagamento", quote.payment);
  block("Observações", quote.notes);
  const count = doc.getNumberOfPages();
  for (let n = 1; n <= count; n++) {
    doc.setPage(n);
    doc.setDrawColor(224, 215, 208);
    doc.line(margin, 282, 194, 282);
    doc.setFontSize(8);
    const footer = doc.splitTextToSize(clean(l.footer), 150).slice(0, 2);
    text(footer, margin, 288, 8);
    text(`${n} / ${count}`, 183, 288, 8);
  }
  doc.setProperties({
    title: `${l.title} ${quote.number}`,
    author: l.businessName,
    subject: "Orçamento comercial",
  });
  return {
    bytes: doc.output("arraybuffer"),
    name: `orcamento-${quote.number.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`,
  };
}
