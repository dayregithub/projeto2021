import { calculateEstimate, money } from "./estimate-calculations.js";
const approved = new Set(["approved", "in_progress", "completed", "delivered"]);
export const FINANCE_METHOD =
  "Vendas aprovadas; custos e impostos estimados conforme cada orçamento salvo. Frete é repasse sem lucro. Despesas do caixa não são descontadas novamente dos custos dos projetos. Não substitui apuração contábil ou notas fiscais.";
export function profitabilityReport(
  quotes,
  { from = "", to = "", group = "month", basis = "issued" } = {},
) {
  const totals = {
    revenue: 0,
    taxable: 0,
    tax: 0,
    cost: 0,
    profit: 0,
    shipping: 0,
    discount: 0,
    orders: 0,
  };
  const details = [],
    periods = new Map(),
    services = new Map(),
    invalid = [],
    undated = [];
  const periodKey = (d) =>
    d
      ? d.slice(0, group === "day" ? 10 : group === "year" ? 4 : 7)
      : "Sem data";
  for (const q of quotes) {
    if (
      !approved.has(q.status) ||
      (basis === "paid" && q.paymentStatus !== "paid")
    )
      continue;
    const date = (basis === "paid" ? q.paymentDate : q.issuedOn) || "";
    if (!date) undated.push(q.number || q.id);
    if ((from || to) && (!date || (from && date < from) || (to && date > to)))
      continue;
    let r;
    try {
      r = calculateEstimate(q);
    } catch {
      invalid.push(q.number || q.id);
      continue;
    }
    const amounts = {
      revenue: r.total,
      taxable: r.taxable,
      tax: r.tax,
      cost: r.cost,
      profit: r.profit,
      shipping: q.shipping,
      discount: r.totalDiscount,
      orders: 1,
    };
    const key = periodKey(date);
    if (!periods.has(key))
      periods.set(key, {
        period: key,
        ...Object.fromEntries(Object.keys(totals).map((k) => [k, 0])),
      });
    for (const k of Object.keys(totals)) {
      totals[k] += amounts[k];
      periods.get(key)[k] += amounts[k];
    }
    const add = (item, index) => {
      const row = {
        quoteId: q.id,
        itemId: item.id || `setup-${q.id}`,
        reference: q.number,
        date,
        customer: q.customer || "Não informado",
        project: q.title || "",
        description: item.description,
        process: item.process,
        quantity: item.quantity,
        sale: item.sale,
        tax: item.tax,
        cost: item.cost,
        profit: money(item.sale - item.tax - item.cost),
        discount: item.discount || 0,
        status: q.status,
      };
      row.margin = row.sale ? (row.profit / row.sale) * 100 : 0;
      details.push(row);
      const sk = `${row.process}:${row.description.trim().toLocaleLowerCase("pt-BR")}`;
      if (!services.has(sk))
        services.set(sk, {
          key: sk,
          description: row.description,
          process: row.process,
          quantity: 0,
          sale: 0,
          tax: 0,
          cost: 0,
          profit: 0,
          discount: 0,
          items: 0,
        });
      const service = services.get(sk);
      for (const k of ["quantity", "sale", "tax", "cost", "profit", "discount"])
        service[k] += row[k];
      service.items++;
    };
    // Round cumulative costs, rather than each piece, so item rows reconcile to the proposal cent.
    let costSum = 0,
      allocatedCost = 0;
    for (const item of r.items) {
      costSum += item.totalCost;
      const end = money(costSum),
        cost = money(end - allocatedCost);
      allocatedCost = end;
      add({
        ...item,
        sale: item.saleAfterAdjustments,
        tax: item.includedTax,
        cost,
        discount: item.itemDiscountAmount,
      });
    }
    const setupSale = money(
      r.taxable - r.items.reduce((s, i) => s + i.saleAfterAdjustments, 0),
    );
    const setupCost = money(r.cost - q.shipping - allocatedCost);
    if (setupSale || setupCost || r.setupTax)
      add({
        description: "Preparação / ajuste do projeto",
        process: "setup",
        quantity: 1,
        sale: setupSale,
        tax: r.setupTax,
        cost: setupCost,
      });
  }
  const round = (r) => {
    for (const k of Object.keys(r))
      if (typeof r[k] === "number") r[k] = money(r[k]);
    return r;
  };
  round(totals);
  totals.margin = totals.taxable ? (totals.profit / totals.taxable) * 100 : 0;
  return {
    totals,
    details,
    periods: [...periods.values()]
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(round),
    services: [...services.values()]
      .map((r) => ({
        ...round(r),
        margin: r.sale ? (r.profit / r.sale) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit),
    invalid,
    undated,
    basis,
    method: FINANCE_METHOD,
  };
}
export function reportSnapshot(report, filters, brand = {}, title = "") {
  const snapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    title: title.trim().slice(0, 160) || "Relatório financeiro",
    filters: structuredClone(filters),
    brand: structuredClone(brand),
    report: structuredClone(report),
  };
  if (JSON.stringify(snapshot).length > 8_000_000)
    throw Error(
      "Relatório muito grande para salvar. Selecione um período menor.",
    );
  return snapshot;
}
export const PROCESS_LABELS = {
  laser: "Laser",
  print: "Impressão 3D",
  setup: "Preparação",
};
