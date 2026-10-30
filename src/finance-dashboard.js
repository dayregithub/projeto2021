import { brl, localDate } from "./estimate-calculations.js";
import { reportSnapshot, PROCESS_LABELS } from "./finance-analytics.js";
import { financeChart } from "./finance-charts.js";
import { loadAllRows } from "./finance-data.js";
import { workbookBytes, downloadReport } from "./report-exports.js";
const KEY = "papeled-finance-reports-v1";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const pct = (n) =>
  `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
export function initFinanceDashboard({
  getState,
  getReport,
  getFilters,
  getBrand,
  ready,
}) {
  const $ = (id) => document.getElementById(id);
  let savedReady = false,
    history = [],
    saving = false;
  const message = (s) => {
    $("finance-report-status").textContent = s;
  };
  const snapshot = () =>
    reportSnapshot(
      getReport(),
      getFilters(),
      getBrand(),
      $("finance-report-title").value,
    );
  function exportReady() {
    return ready() && !!getReport();
  }
  function render() {
    const r = getReport();
    $("finance-save-report").disabled = !savedReady || !exportReady() || saving;
    $("finance-excel").disabled = !exportReady();
    if (!r) {
      for (const id of [
        "finance-profit-summary",
        "finance-profit-chart",
        "finance-profit-periods",
        "finance-services",
        "finance-projects",
        "finance-service-result",
      ])
        $(id).replaceChildren();
      return;
    }
    const a = r.analytics,
      t = a.totals;
    $("finance-profit-summary").innerHTML = [
      ["Faturamento aprovado", t.revenue],
      ["Impostos estimados", t.tax],
      ["Custos dos projetos", t.cost],
      ["Lucro estimado", t.profit],
      ["Descontos totais", t.discount],
      ["Frete · repasse", t.shipping],
      ["Margem estimada", pct(t.margin)],
      ["Orçamentos aprovados", String(t.orders)],
    ]
      .map(
        ([l, v]) =>
          `<div class="metric${l === "Lucro estimado" && v < 0 ? " finance-negative" : ""}"><span>${l}</span><strong>${exportReady() ? (typeof v === "number" ? brl(v) : v) : "Indisponível"}</strong></div>`,
      )
      .join("");
    $("finance-profit-chart").innerHTML = exportReady()
      ? financeChart(a.periods)
      : "<p>Valores indisponíveis até reconectar os dados.</p>";
    $("finance-profit-periods").innerHTML =
      a.periods
        .map(
          (p) =>
            `<tr><td>${esc(p.period)}</td><td>${brl(p.revenue)}</td><td>${brl(p.cost)}</td><td>${brl(p.tax)}</td><td class="${p.profit < 0 ? "finance-loss" : "finance-gain"}">${brl(p.profit)}</td><td>${pct(p.taxable ? (p.profit / p.taxable) * 100 : 0)}</td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="6">Nenhuma venda aprovada no período.</td></tr>';
    const process = $("finance-service-process").value,
      term = $("finance-service-search")
        .value.trim()
        .toLocaleLowerCase("pt-BR"),
      matches = (s) =>
        (!process || s.process === process) &&
        (!term || s.description.toLocaleLowerCase("pt-BR").includes(term));
    const services = a.services.filter(matches),
      details = a.details.filter(matches);
    $("finance-services").innerHTML =
      services
        .map(
          (s) =>
            `<tr><td><strong>${esc(s.description)}</strong><br><small>${PROCESS_LABELS[s.process]}</small></td><td>${s.quantity.toLocaleString("pt-BR")}</td><td>${brl(s.sale)}</td><td>${brl(s.cost)}</td><td>${brl(s.tax)}</td><td class="${s.profit < 0 ? "finance-loss" : "finance-gain"}">${brl(s.profit)}</td><td>${pct(s.margin)}</td></tr>`,
        )
        .join("") || '<tr><td colspan="7">Nenhum serviço encontrado.</td></tr>';
    const sum = services.reduce(
      (s, i) => ({
        sale: s.sale + i.sale,
        profit: s.profit + i.profit,
        tax: s.tax + i.tax,
      }),
      { sale: 0, profit: 0, tax: 0 },
    );
    $("finance-service-result").textContent =
      `Seleção: ${services.length} serviço(s) · Venda ajustada ${brl(sum.sale)} · Impostos ${brl(sum.tax)} · Lucro estimado ${brl(sum.profit)}. Os filtros abaixo afetam apenas as tabelas de serviços e projetos; os indicadores e exportações abrangem todo o período.`;
    $("finance-projects").innerHTML =
      details
        .map(
          (d) =>
            `<tr><td>${esc(d.date)}<br>${esc(d.reference)}</td><td><strong>${esc(d.customer)}</strong><br>${esc(d.project)}<br><small>${esc(d.description)}</small></td><td>${brl(d.sale)}</td><td>${brl(d.cost)}</td><td>${brl(d.tax)}</td><td class="${d.profit < 0 ? "finance-loss" : "finance-gain"}">${brl(d.profit)}</td></tr>`,
        )
        .join("") || '<tr><td colspan="6">Nenhum projeto na seleção.</td></tr>';
    $("finance-analysis-notes").textContent =
      `${a.method} ${a.invalid.length ? `${a.invalid.length} cálculo(s) inválido(s) excluído(s).` : ""} ${a.undated.length ? `${a.undated.length} registro(s) sem data, incluídos somente em todo o período.` : ""}`;
  }
  $("finance-service-process").onchange = render;
  $("finance-service-search").oninput = render;
  async function getSaved(id) {
    const { client, local } = getState();
    if (local) {
      const row = JSON.parse(localStorage.getItem(KEY) || "[]").find(
        (r) => r.id === id,
      );
      if (!row) throw Error("Relatório não encontrado.");
      return row.data;
    }
    if (!client) throw Error("Conecte ao banco antes de abrir um relatório.");
    const r = await client
      .from("finance_reports")
      .select("data")
      .eq("id", id)
      .single();
    if (r.error)
      throw Error("Não foi possível ler o relatório salvo no banco.");
    return r.data.data;
  }
  function renderHistory() {
    $("finance-saved-reports").innerHTML =
      history
        .map(
          (h) =>
            `<article class="finance-saved-row"><div><strong>${esc(h.title)}</strong><p class="muted">${esc(h.period_from || "Início")} a ${esc(h.period_to || "todo o período")} · ${esc(new Date(h.created_at).toLocaleString("pt-BR"))}</p></div><button type="button" class="secondary" data-saved-finance="${esc(h.id)}">Baixar PDF do fechamento</button></article>`,
        )
        .join("") || '<p class="muted">Nenhum fechamento salvo.</p>';
    $("finance-saved-reports")
      .querySelectorAll("[data-saved-finance]")
      .forEach(
        (b) =>
          (b.onclick = async () => {
            b.disabled = true;
            try {
              const s = await getSaved(b.dataset.savedFinance);
              const { financePDF } = await import("./professional-report.js");
              const pdf = await financePDF(s);
              downloadReport(
                pdf.blob,
                `financeiro-salvo-${s.generatedAt.slice(0, 10)}.pdf`,
              );
              message(
                "PDF gerado a partir dos valores históricos salvos, sem recalcular os orçamentos atuais.",
              );
            } catch (e) {
              message(e.message);
            } finally {
              b.disabled = false;
            }
          }),
      );
  }
  async function refresh() {
    savedReady = false;
    history = [];
    $("finance-reports-setup").hidden = true;
    try {
      const { client, local } = getState();
      if (local)
        history = JSON.parse(localStorage.getItem(KEY) || "[]").map(
          ({ data, ...meta }) => meta,
        );
      else {
        if (!client)
          throw Error("Entre como administrador para consultar fechamentos.");
        history = await loadAllRows(
          client,
          "finance_reports",
          "id,title,period_from,period_to,created_at",
        );
      }
      savedReady = true;
      message(
        local
          ? "Prévia local: fechamentos ficam somente neste navegador."
          : "Histórico de relatórios conectado ao Supabase.",
      );
    } catch (e) {
      $("finance-reports-setup").hidden = !["42P01", "PGRST205"].includes(
        e.code,
      );
      message(
        ["42P01", "PGRST205"].includes(e.code)
          ? "Instale a atualização de relatórios para guardar fechamentos no banco. Os cálculos continuam usando os orçamentos salvos."
          : "Não foi possível consultar os fechamentos. Verifique a conexão e a sessão; não é confirmação de falta de instalação.",
      );
    }
    history.sort((a, b) => b.created_at.localeCompare(a.created_at));
    renderHistory();
    render();
  }
  async function persist(s) {
    if (!savedReady)
      throw Error(
        "O histórico não está disponível. Confira a conexão ou a atualização de relatórios.",
      );
    const row = {
      id: crypto.randomUUID(),
      title: s.title,
      period_from: s.filters.from || null,
      period_to: s.filters.to || null,
      created_at: s.generatedAt,
      data: s,
    };
    const { client, local } = getState();
    if (local) {
      const all = JSON.parse(localStorage.getItem(KEY) || "[]");
      all.unshift(row);
      localStorage.setItem(KEY, JSON.stringify(all));
    } else {
      if (!client) throw Error("Conecte ao banco para salvar.");
      const r = await client.from("finance_reports").insert(row);
      if (r.error)
        throw Error(
          "Não foi possível salvar o fechamento no banco. Nenhum sucesso de gravação foi confirmado.",
        );
    }
    const { data, ...meta } = row;
    history.unshift(meta);
    renderHistory();
    return local
      ? "Fechamento salvo somente neste navegador (prévia local)."
      : "Fechamento salvo no Supabase com valores, itens, impostos, custos e filtros desta consulta.";
  }
  $("finance-save-report").onclick = async () => {
    if (saving || !exportReady()) return;
    saving = true;
    render();
    try {
      message(await persist(snapshot()));
    } catch (e) {
      message(e.message);
    } finally {
      saving = false;
      render();
    }
  };
  async function exportPDF() {
    if (!exportReady()) return;
    const s = snapshot();
    const { financePDF } = await import("./professional-report.js");
    const pdf = await financePDF(s);
    let note =
      "PDF gerado. Fechamento não salvo no banco: confira o histórico de relatórios.";
    if (savedReady) {
      try {
        note = await persist(s);
      } catch (e) {
        note = `PDF gerado, mas não salvo no banco: ${e.message}`;
      }
    }
    downloadReport(pdf.blob, `financeiro-${localDate()}.pdf`);
    message(note);
  }
  $("finance-excel").onclick = () => {
    if (!exportReady()) return;
    const s = snapshot(),
      a = s.report.analytics;
    const bytes = workbookBytes([
      {
        name: "Indicadores",
        rows: [
          ["Indicador", "Valor"],
          ...Object.entries(a.totals).map(([k, v]) => [
            {
              revenue: "Faturamento aprovado",
              taxable: "Venda sem frete",
              tax: "Impostos estimados",
              cost: "Custos",
              profit: "Lucro estimado",
              shipping: "Frete",
              discount: "Descontos",
              orders: "Orçamentos",
              margin: "Margem (%)",
            }[k],
            v,
          ]),
          ["Metodologia", a.method],
        ],
      },
      {
        name: "Períodos",
        rows: [
          ["Período", "Faturamento", "Custos", "Impostos", "Lucro estimado"],
          ...a.periods.map((p) => [
            p.period,
            p.revenue,
            p.cost,
            p.tax,
            p.profit,
          ]),
        ],
      },
      {
        name: "Serviços",
        rows: [
          [
            "Serviço",
            "Processo",
            "Quantidade",
            "Venda ajustada",
            "Custos",
            "Impostos",
            "Lucro estimado",
            "Margem (%)",
          ],
          ...a.services.map((d) => [
            d.description,
            PROCESS_LABELS[d.process],
            d.quantity,
            d.sale,
            d.cost,
            d.tax,
            d.profit,
            d.margin,
          ]),
        ],
      },
      {
        name: "Projetos",
        rows: [
          [
            "Data",
            "Orçamento",
            "Cliente",
            "Projeto",
            "Serviço",
            "Venda ajustada",
            "Custos",
            "Impostos",
            "Lucro estimado",
          ],
          ...a.details.map((d) => [
            d.date,
            d.reference,
            d.customer,
            d.project,
            d.description,
            d.sale,
            d.cost,
            d.tax,
            d.profit,
          ]),
        ],
      },
      {
        name: "Caixa",
        rows: [
          ["Data", "Cliente / categoria", "Descrição", "Situação", "Valor"],
          ...s.report.rows.map((d) => [
            d.date,
            d.customer,
            d.description,
            d.kind,
            d.amount,
          ]),
        ],
      },
    ]);
    downloadReport(
      new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `financeiro-${localDate()}.xlsx`,
    );
  };
  return { render, refresh, exportPDF };
}
