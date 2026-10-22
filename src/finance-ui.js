import { brl, localDate } from "./estimate-calculations.js";
import { financeReport, validateExpense, loadAllRows } from "./finance-data.js";
const KEY = "papeled-finance-expenses-v1";
const labels = {
  received: "Recebido",
  receivable: "A receber · aprovado",
  awaiting: "Aguardando aprovação",
  rejected: "Não aprovado",
  paid: "Despesa paga",
  payable: "Despesa pendente",
};
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const dateLabel = (d) => (d ? d.split("-").reverse().join("/") : "Sem data");
export function initFinance({
  getState,
  getQuotes,
  openQuote,
  isQuoteSourceReady = () => true,
}) {
  const $ = (id) => document.getElementById(id),
    form = $("finance-expense-form");
  let expenses = [],
    report = null,
    canWrite = false;
  const message = (s) => ($("finance-status").textContent = s);
  $("finance-month").value = localDate().slice(0, 7);
  $("finance-day").value = localDate();
  $("finance-year").value = localDate().slice(0, 4);
  form.elements.due_on.value = localDate();
  form.elements.paid_on.value = localDate();
  function filters() {
    const type = $("finance-period").value;
    let from = "",
      to = "";
    if (type === "month") {
      from = `${$("finance-month").value}-01`;
      to = `${$("finance-month").value}-31`;
    }
    if (type === "day") from = to = $("finance-day").value;
    if (type === "year") {
      from = `${$("finance-year").value}-01-01`;
      to = `${$("finance-year").value}-12-31`;
    }
    if (type === "custom") {
      from = $("finance-from").value;
      to = $("finance-to").value;
    }
    if (type !== "all" && (!from || !to || from > to))
      throw Error("Selecione um período válido para consultar.");
    return { from, to, group: $("finance-group").value };
  }
  function render() {
    for (const field of document.querySelectorAll("[data-finance-period]"))
      field.hidden = field.dataset.financePeriod !== $("finance-period").value;
    try {
      report = financeReport(getQuotes(), expenses, filters());
    } catch (e) {
      report = null;
      $("finance-csv").disabled = $("finance-pdf").disabled = true;
      $("finance-summary").replaceChildren();
      $("finance-chart").replaceChildren();
      $("finance-period-table").replaceChildren();
      $("finance-rows").replaceChildren();
      message(e.message);
      return;
    }
    $("finance-csv").disabled = $("finance-pdf").disabled =
      !canWrite || !isQuoteSourceReady();
    const m = report.metrics;
    $("finance-summary").innerHTML = [
      ["Recebido", m.received],
      ["Despesas pagas", m.paid],
      ["Saldo realizado", m.balance],
      ["A receber · aprovados", m.receivable],
      ["Despesas pendentes", m.payable],
      ["Aguardando aprovação", m.awaiting],
      ["Não aprovados / cancelados", m.rejected],
      ["Total orçado no período", m.quoted],
    ]
      .map(
        ([label, value]) =>
          `<div class="metric"><span>${label}</span><strong>${!isQuoteSourceReady() || (!canWrite && ["Despesas pagas", "Despesas pendentes", "Saldo realizado"].includes(label)) ? "Indisponível" : brl(value)}</strong></div>`,
      )
      .join("");
    const max = Math.max(
      1,
      ...report.periods.flatMap((p) => [p.received, p.paid]),
    );
    $("finance-chart").innerHTML = report.periods.length
      ? report.periods
          .map(
            (p) =>
              `<div class="finance-chart-row"><strong>${esc(p.period)}</strong><div><div class="finance-bar received" style="width:${(p.received / max) * 100}%" title="Recebido: ${brl(p.received)}"></div><span>Recebido ${brl(p.received)}</span><div class="finance-bar paid" style="width:${(p.paid / max) * 100}%" title="Despesas pagas: ${brl(p.paid)}"></div><span>Pago ${brl(p.paid)}</span></div></div>`,
          )
          .join("")
      : '<p class="muted">Nenhum movimento neste período.</p>';
    $("finance-period-table").innerHTML = report.periods
      .map(
        (p) =>
          `<tr><td>${esc(p.period)}</td><td>${brl(p.received)}</td><td>${brl(p.paid)}</td><td>${brl(p.balance)}</td><td>${brl(p.receivable)}</td><td>${brl(p.payable)}</td></tr>`,
      )
      .join("");
    $("finance-rows").innerHTML =
      report.rows
        .map(
          (r) =>
            `<tr><td>${esc(dateLabel(r.date))}</td><td>${esc(r.customer)}<br><strong>${esc(r.description)}</strong><br><small>${esc(r.reference)}</small></td><td>${labels[r.kind]}</td><td>${brl(r.amount)}</td><td>${r.source === "quote" ? `<button class="secondary" data-finance-quote="${esc(r.id)}">Abrir orçamento</button>` : `<button class="secondary" data-finance-expense="${esc(r.id)}">Editar</button>`}</td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="5">Nenhum lançamento no período.</td></tr>';
    $("finance-rows")
      .querySelectorAll("[data-finance-quote]")
      .forEach((b) => (b.onclick = () => openQuote(b.dataset.financeQuote)));
    $("finance-rows")
      .querySelectorAll("[data-finance-expense]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const e = expenses.find((x) => x.id === b.dataset.financeExpense);
            for (const k of [
              "id",
              "description",
              "category",
              "amount",
              "due_on",
              "status",
              "paid_on",
            ])
              form.elements[k].value = e[k] || "";
            $("finance-expense-details").open = true;
            form.scrollIntoView({ behavior: "smooth" });
          }),
      );
    $("finance-notes").textContent =
      `Custos estimados dos orçamentos aprovados emitidos no período: ${brl(m.estimatedCost)} (não são despesas lançadas). Recebimentos usam a data do pagamento; pendências de clientes usam a emissão, pois não há vencimento cadastrado. Orçamentos sem aprovação não entram em “a receber”. ${report.undated.length ? `${report.undated.length} pagamento(s) sem data: corrija no Kanban; aparecem apenas em todo o período.` : ""} ${report.invalid.length ? `${report.invalid.length} orçamento(s) com cálculo inválido não foram incluídos: ${report.invalid.join(", ")}.` : ""}`;
  }
  $("finance-filters").oninput = render;
  $("finance-filters").onchange = render;
  function reset() {
    form.reset();
    form.elements.id.value = "";
    form.elements.due_on.value = localDate();
    form.elements.paid_on.value = localDate();
  }
  $("finance-expense-reset").onclick = reset;
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!canWrite) {
      message(
        "Instale a atualização financeira no banco antes de salvar despesas.",
      );
      return;
    }
    const button = $("finance-expense-save");
    button.disabled = true;
    try {
      const row = validateExpense({
        id: form.elements.id.value || crypto.randomUUID(),
        description: form.elements.description.value.trim(),
        category: form.elements.category.value.trim(),
        amount: Number(form.elements.amount.value),
        due_on: form.elements.due_on.value,
        status: form.elements.status.value,
        paid_on:
          form.elements.status.value === "paid"
            ? form.elements.paid_on.value
            : null,
        updated_at: new Date().toISOString(),
      });
      const { client, local } = getState();
      if (!local && client) {
        const result = await client.from("finance_expenses").upsert(row);
        if (result.error)
          throw Error("Não foi possível salvar a despesa no banco.");
      } else {
        const rows = expenses.filter((x) => x.id !== row.id);
        rows.push(row);
        localStorage.setItem(KEY, JSON.stringify(rows));
      }
      await refresh();
      reset();
      message("Despesa salva. Resumo financeiro atualizado.");
    } catch (error) {
      message(error.message);
    } finally {
      button.disabled = false;
    }
  };
  async function refresh() {
    const { client, local } = getState();
    try {
      if (!local && client)
        expenses = await loadAllRows(client, "finance_expenses", "*");
      else expenses = JSON.parse(localStorage.getItem(KEY) || "[]");
      canWrite = true;
      $("finance-setup").hidden = true;
      message(
        local
          ? "Prévia local: despesas salvas somente neste navegador."
          : "Dados financeiros privados conectados ao Supabase.",
      );
    } catch {
      expenses = [];
      canWrite = false;
      $("finance-setup").hidden = false;
      message(
        "Orçamentos carregados. Para registrar despesas, instale a atualização financeira no Supabase.",
      );
    }
    $("finance-expense-save").disabled = !canWrite;
    if (!isQuoteSourceReady())
      message(
        "Não foi possível consultar os orçamentos no Supabase. Atualize a conexão antes de usar os valores financeiros.",
      );
    render();
  }
  function download(blob, name) {
    const a = document.createElement("a"),
      url = URL.createObjectURL(blob);
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $("finance-csv").onclick = () => {
    if (!report) return;
    const cell = (v) =>
      `"${String(v ?? "")
        .replace(/^[=+@\-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const csv = [
      [
        "Relatório financeiro",
        `${filters().from || "Início"} a ${filters().to || "hoje"}`,
      ],
      ["Período", "Recebido", "Pago", "Saldo", "A receber", "A pagar"],
      ...report.periods.map((p) => [
        p.period,
        p.received,
        p.paid,
        p.balance,
        p.receivable,
        p.payable,
      ]),
      [],
      [
        "Data",
        "Cliente / categoria",
        "Descrição",
        "Referência",
        "Situação",
        "Valor",
      ],
      ...report.rows.map((r) => [
        r.date,
        r.customer,
        r.description,
        r.reference,
        labels[r.kind],
        r.amount,
      ]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n");
    download(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
      `financeiro-${localDate()}.csv`,
    );
  };
  $("finance-pdf").onclick = async () => {
    if (!report) return;
    const button = $("finance-pdf");
    button.disabled = true;
    try {
      const snapshot = structuredClone(report),
        period = filters();
      const { jsPDF } = await import("jspdf"),
        doc = new jsPDF();
      let y = 20;
      const line = (text, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        for (const part of doc.splitTextToSize(text, 175)) {
          if (y > 276) {
            doc.addPage();
            y = 20;
          }
          doc.text(part, 18, y);
          y += 6;
        }
      };
      doc.setFontSize(12);
      line("Papeled Maker · Relatório financeiro", true);
      line(
        `Período: ${period.from || "Início"} a ${period.to || "todo o período"} · agrupamento: ${$("finance-group").selectedOptions[0].text}`,
      );
      line(`Gerado em ${dateLabel(localDate())}`);
      y += 4;
      for (const [key, label] of Object.entries({
        ...labels,
        balance: "Saldo realizado",
      }))
        line(`${label}: ${brl(snapshot.metrics[key])}`);
      y += 4;
      line("Resumo por período", true);
      for (const p of snapshot.periods)
        line(
          `${p.period} · Recebido ${brl(p.received)} · Pago ${brl(p.paid)} · Saldo ${brl(p.balance)} · A receber ${brl(p.receivable)} · A pagar ${brl(p.payable)}`,
        );
      y += 4;
      line("Lançamentos", true);
      for (const r of snapshot.rows)
        line(
          `${dateLabel(r.date)} · ${r.customer || ""} · ${r.description || ""} · ${labels[r.kind]} · ${brl(r.amount)}`,
        );
      y += 4;
      line(
        "Recebimentos por data de pagamento. Pendências de clientes por emissão. Custos estimados não são despesas pagas.",
      );
      if (snapshot.undated.length)
        line(
          `Pagamentos sem data (apenas em todo o período): ${snapshot.undated.join(", ")}`,
        );
      if (snapshot.invalid.length)
        line(
          `Orçamentos não incluídos por erro de cálculo: ${snapshot.invalid.join(", ")}`,
        );
      download(doc.output("blob"), `financeiro-${localDate()}.pdf`);
    } catch {
      message("Não foi possível gerar o relatório PDF. Tente novamente.");
    } finally {
      button.disabled = false;
    }
  };
  render();
  return { refresh };
}
