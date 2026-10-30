import { initFinanceDashboard } from "./finance-dashboard.js";
import { financeChart } from "./finance-charts.js";
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
  getBrand = () => ({}),
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
      const month = $("finance-month").value;
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw Error("Selecione um mês válido.");
      from = `${month}-01`;
      const [year, m] = month.split("-").map(Number);
      to = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
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
    return {
      from,
      to,
      group: $("finance-group").value,
      basis: $("finance-basis").value,
    };
  }
  const advanced = initFinanceDashboard({
    getState,
    getReport: () => report,
    getFilters: filters,
    getBrand,
    ready: () => canWrite && isQuoteSourceReady(),
  });
  function render() {
    for (const field of document.querySelectorAll("[data-finance-period]"))
      field.hidden = field.dataset.financePeriod !== $("finance-period").value;
    try {
      if (!isQuoteSourceReady())
        throw Error(
          "Orçamentos indisponíveis no banco. Atualize a conexão antes de consultar o financeiro.",
        );
      report = financeReport(getQuotes(), expenses, filters());
    } catch (e) {
      report = null;
      $("finance-csv").disabled = $("finance-pdf").disabled = true;
      $("finance-summary").replaceChildren();
      $("finance-chart").replaceChildren();
      $("finance-period-table").replaceChildren();
      $("finance-rows").replaceChildren();
      message(e.message);
      advanced.render();
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
    $("finance-chart").innerHTML = financeChart(report.periods, { cash: true });
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
    advanced.render();
  }
  $("finance-filters").oninput = render;
  $("finance-filters").onchange = render;
  $("finance-basis").onchange = render;
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
    await advanced.refresh();
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
      await advanced.exportPDF();
    } catch {
      message("Não foi possível gerar o relatório PDF. Tente novamente.");
    } finally {
      button.disabled = false;
    }
  };
  render();
  return { refresh };
}
