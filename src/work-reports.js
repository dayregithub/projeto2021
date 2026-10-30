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
  getBrand = () => ({}),
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
      const { professionalReport } = await import("./professional-report.js");
      const pdf = await professionalReport({
        brand: getBrand(),
        title: "Relatório de trabalhos",
        subtitle: `Emissões: ${$("work-from").value || "início"} a ${$("work-to").value || "todo o período"} | ${$("work-status").selectedOptions[0].text} | ${$("work-payment").selectedOptions[0].text}`,
      });
      pdf.section("Propostas selecionadas");
      pdf.cards([
        [
          "Total das propostas",
          brl(rows.reduce((s, r) => s + r.result.total, 0)),
        ],
        ["Impostos estimados", brl(rows.reduce((s, r) => s + r.result.tax, 0))],
        ["Custos estimados", brl(rows.reduce((s, r) => s + r.result.cost, 0))],
        ["Lucro estimado", brl(rows.reduce((s, r) => s + r.result.profit, 0))],
      ]);
      pdf.note(
        "Os totais correspondem às propostas filtradas, incluindo situações não aprovadas quando selecionadas. Não são necessariamente faturamento realizado. Custos e impostos são os calculados em cada orçamento.",
      );
      pdf.table(
        [
          "Emissão / número",
          "Cliente / projeto",
          "Situação",
          "Pagamento",
          "Valor",
        ],
        rows.map(({ quote: q, result: r }) => [
          `${q.issuedOn}\n${q.number}`,
          `${q.customer || "Não informado"}\n${q.title}`,
          `${WORK_STATUS[q.status] || q.status}${q.archivedAt ? " / Arquivado" : ""}`,
          `${q.paymentStatus === "paid" ? "Recebido" : "Pendente"}\n${q.paymentDate || ""}`,
          brl(r.total),
        ]),
        [38, 105, 44, 40, 38],
      );
      if ($("work-detail").checked) {
        pdf.newPage();
        pdf.section("Itens por orçamento");
        pdf.table(
          [
            "Orçamento / cliente",
            "Item / especificação",
            "Qtd.",
            "Valor unitário",
            "Subtotal",
          ],
          rows.flatMap(({ quote: q, result: r }) =>
            (r.invoiceRows || r.items).map((item) => [
              `${q.number}\n${q.customer || ""}`,
              `${item.description}\n${item.technical || ""}`,
              `${item.quantity} ${item.unit || "un."}`,
              brl(item.unitPrice),
              brl(item.subtotal),
            ]),
          ),
          [50, 115, 22, 39, 39],
        );
        pdf.section("Contatos, prazos e condições");
        pdf.table(
          [
            "Orçamento / cliente / contato",
            "Descrição do cliente",
            "Entrega e pagamento",
          ],
          rows.map(({ quote: q }) => [
            `${q.number}\n${q.customer || ""}\n${[q.customerPhone, q.customerEmail, q.contact, q.customerId].filter(Boolean).join(" | ")}`,
            q.notes || "-",
            `${q.delivery || ""}\n${q.payment || ""}`,
          ]),
          [80, 95, 90],
        );
      }
      const file = pdf.finish();
      downloadReport(file.blob, `trabalhos-${localDate()}.pdf`);
    } catch {
      $("work-report-status").textContent =
        "Não foi possível gerar o PDF. Tente novamente.";
    } finally {
      b.disabled = false;
    }
  };
  return { render };
}
