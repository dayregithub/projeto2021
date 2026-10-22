import { brl, calculateEstimate, localDate } from "./estimate-calculations.js";
import { downloadReport, workbookBytes } from "./report-exports.js";
export const WORK_STATUS = {
  draft: "Orçamento",
  sent: "Enviado",
  approved: "Aprovado",
  in_progress: "Em execução",
  completed: "Concluído",
  delivered: "Entregue",
  rejected: "Não aprovado",
  cancelled: "Cancelado",
};
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function initWorkReports({
  getQuotes,
  openQuote,
  isQuoteSourceReady = () => true,
}) {
  const $ = (id) => document.getElementById(id);
  let visible = [];
  $("work-status").innerHTML =
    '<option value="">Todas as situações</option>' +
    Object.entries(WORK_STATUS)
      .map(([v, l]) => `<option value="${v}">${l}</option>`)
      .join("");
  function render() {
    if (!isQuoteSourceReady()) {
      visible = [];
      $("work-pdf").disabled = $("work-excel").disabled = true;
      $("work-rows").replaceChildren();
      $("work-report-status").textContent =
        "Não foi possível consultar os orçamentos no banco. Atualize a conexão antes de gerar relatórios.";
      return;
    }
    const from = $("work-from").value,
      to = $("work-to").value,
      term = $("work-search").value.toLocaleLowerCase("pt-BR");
    $("work-pdf").disabled = $("work-excel").disabled = !!(
      from &&
      to &&
      from > to
    );
    if (from && to && from > to) {
      visible = [];
      $("work-rows").replaceChildren();
      $("work-report-status").textContent =
        "A data inicial deve ser anterior à final.";
      return;
    }
    const rows = getQuotes().filter(
      (q) =>
        (!from || q.issuedOn >= from) &&
        (!to || q.issuedOn <= to) &&
        (!$("work-status").value || q.status === $("work-status").value) &&
        (!$("work-payment").value ||
          (q.paymentStatus || "pending") === $("work-payment").value) &&
        ($("work-archive").value === "all" ||
          ($("work-archive").value === "archived"
            ? !!q.archivedAt
            : !q.archivedAt)) &&
        [q.customer, q.title, q.number]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(term),
    );
    const invalid = [];
    visible = [];
    for (const q of rows) {
      try {
        visible.push({ quote: q, result: calculateEstimate(q) });
      } catch {
        invalid.push(q.number);
      }
    }
    $("work-report-status").textContent =
      `${visible.length} trabalho(s) · total ${brl(visible.reduce((sum, r) => sum + r.result.total, 0))}.${invalid.length ? ` Não incluídos por cálculo inválido: ${invalid.join(", ")}.` : ""}`;
    $("work-rows").innerHTML =
      visible
        .map(
          ({ quote: q, result: r }) =>
            `<tr><td>${esc(q.issuedOn)}<br>${esc(q.number)}</td><td><strong>${esc(q.customer || "Não informado")}</strong><br>${esc(q.title)}</td><td>${WORK_STATUS[q.status] || esc(q.status)}${q.archivedAt ? " · Arquivado" : ""}</td><td>${q.paymentStatus === "paid" ? "Recebido" : "Pendente"}<br>${esc(q.paymentDate || "")}</td><td>${brl(r.total)}</td><td><button class="secondary" data-work-open="${esc(q.id)}">Abrir</button></td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="6">Nenhum trabalho encontrado.</td></tr>';
    $("work-rows")
      .querySelectorAll("[data-work-open]")
      .forEach((b) => (b.onclick = () => openQuote(b.dataset.workOpen)));
  }
  $("work-filters").oninput = render;
  $("work-filters").onchange = render;
  $("work-clear").onclick = () => {
    for (const id of [
      "work-from",
      "work-to",
      "work-status",
      "work-payment",
      "work-search",
    ])
      $(id).value = "";
    $("work-archive").value = "all";
    render();
  };
  $("work-excel").onclick = () => {
    const quotes = [
      [
        "Número",
        "Emissão",
        "Cliente",
        "Contato",
        "CPF / CNPJ",
        "Projeto",
        "Situação",
        "Arquivado",
        "Pagamento",
        "Data pagamento",
        "Total (R$)",
        "Descrição do cliente",
        "Entrega",
        "Condições de pagamento",
      ],
    ];
    const items = [
      [
        "Orçamento",
        "Cliente",
        "Projeto",
        "Item / serviço / material",
        "Processo",
        "Quantidade",
        "Unidade",
        "Valor unitário (R$)",
        "Subtotal (R$)",
        "Especificações",
      ],
    ];
    for (const { quote: q, result: r } of visible) {
      quotes.push([
        q.number,
        q.issuedOn,
        q.customer,
        q.contact,
        q.customerId,
        q.title,
        WORK_STATUS[q.status],
        q.archivedAt ? "Sim" : "Não",
        q.paymentStatus === "paid" ? "Recebido" : "Pendente",
        q.paymentDate,
        r.total,
        q.notes,
        q.delivery,
        q.payment,
      ]);
      for (const item of r.invoiceRows || r.items)
        items.push([
          q.number,
          q.customer,
          q.title,
          item.description,
          item.process === "laser" ? "Laser" : "Impressão 3D",
          item.quantity,
          item.unit || "un.",
          item.unitPrice,
          item.subtotal,
          item.technical,
        ]);
    }
    downloadReport(
      new Blob(
        [
          workbookBytes([
            { name: "Orçamentos", rows: quotes },
            { name: "Itens e serviços", rows: items },
          ]),
        ],
        {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ),
      `trabalhos-${localDate()}.xlsx`,
    );
  };
  $("work-pdf").onclick = async () => {
    const b = $("work-pdf");
    b.disabled = true;
    const rows = structuredClone(visible);
    try {
      const { jsPDF } = await import("jspdf"),
        doc = new jsPDF();
      let y = 20;
      function line(text, bold = false) {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(10);
        for (const part of doc.splitTextToSize(String(text || ""), 174)) {
          if (y > 276) {
            doc.addPage();
            y = 20;
          }
          doc.text(part, 18, y);
          y += 5;
        }
      }
      line("Papeled Maker · Relatório de trabalhos", true);
      line(
        `Emissões: ${$("work-from").value || "início"} a ${$("work-to").value || "todo o período"}`,
      );
      line(
        `Situação: ${$("work-status").selectedOptions[0].text} · Pagamento: ${$("work-payment").selectedOptions[0].text} · Arquivo: ${$("work-archive").selectedOptions[0].text}`,
      );
      line(
        `Busca: ${$("work-search").value || "todas"} · ${rows.length} trabalho(s) · Total ${brl(rows.reduce((sum, r) => sum + r.result.total, 0))}`,
      );
      y += 5;
      for (const { quote: q, result: r } of rows) {
        line(`${q.number} · ${q.issuedOn}`, true);
        line(`Cliente: ${q.customer || "Não informado"} · ${q.contact || ""}`);
        if (q.customerId) line(`CPF / CNPJ: ${q.customerId}`);
        line(`Projeto: ${q.title}`, true);
        line(
          `${WORK_STATUS[q.status]}${q.archivedAt ? " · Arquivado" : ""} · ${q.paymentStatus === "paid" ? "Recebido" : "Pagamento pendente"} ${q.paymentDate || ""} · Total ${brl(r.total)}`,
        );
        if (q.notes) line(`Descrição do cliente: ${q.notes}`);
        if ($("work-detail").checked)
          for (const item of r.invoiceRows || r.items) {
            line(
              `${item.description} · ${item.quantity} ${item.unit || "un."} × ${brl(item.unitPrice)} = ${brl(item.subtotal)}`,
            );
            if (item.technical) line(item.technical);
          }
        if (q.delivery) line(`Entrega: ${q.delivery}`);
        if (q.payment) line(`Condições: ${q.payment}`);
        y += 7;
      }
      downloadReport(doc.output("blob"), `trabalhos-${localDate()}.pdf`);
    } catch {
      $("work-report-status").textContent =
        "Não foi possível gerar o PDF. Tente novamente.";
    } finally {
      b.disabled = false;
    }
  };
  return { render };
}
