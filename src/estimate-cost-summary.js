import { brl } from "./estimate-calculations.js";
export function costSummaryHTML(item, quote, result) {
  const scale = quote.calculationVersion === 2 ? 1 : item.quantity;
  const c = Object.fromEntries(
    Object.entries(item.costs).map(([key, value]) => [key, value * scale]),
  );
  const entries = [
    [item.process === "print" ? "Filamento" : "Material", c.material],
  ];
  if (
    item.process === "laser" &&
    !item.primaryService &&
    Math.abs(result.laser.hour - result.laser.computed) < 0.000001
  ) {
    const hours = (item.minutes * item.quantity) / 60;
    for (const [label, key] of [
      ["Energia", "energy"],
      ["Tubo", "tube"],
      ["Lentes", "lenses"],
      ["Espelhos", "mirrors"],
      ["Operador", "labor"],
      ["Depreciação", "depreciation"],
      ["Despesas fixas", "overhead"],
      ["Manutenção", "maintenance"],
    ])
      entries.push([label, result.laser[key] * hours]);
  } else {
    entries.push([
      item.process === "laser"
        ? "Operação laser · custo consolidado"
        : "Energia",
      item.process === "laser" ? c.machine : c.energy,
    ]);
    if (item.process === "print")
      entries.push(["Máquina e custos operacionais", c.machine]);
  }
  entries.push(
    ["Trabalho manual", c.handling],
    ["Pintura / tinta", c.painting],
    ["Outros / serviços (custo)", c.extras],
  );
  const line = (label, value, strong = false) =>
    `<div${strong ? ' class="machine-cost-total"' : ""}><dt>${label}</dt><dd>${brl(value)}</dd></div>`;
  return `<dl class="machine-cost-breakdown">${entries.map(([label, value]) => line(label, value)).join("")}${line("Custo de produção", item.totalCost, true)}${line("Venda após descontos e ajustes", item.saleAfterAdjustments, true)}${line(`Impostos inclusos na venda (${quote.pricing.taxPercent.toLocaleString("pt-BR")}%)`, item.includedTax)}${line("Receita após impostos", item.netRevenue)}${line("Resultado estimado após impostos", item.estimatedProfit, true)}</dl><p class="muted">O imposto está dentro do preço de venda e reduz o resultado; não é somado novamente ao custo de produção. Descontos e ajustes são rateados proporcionalmente. Preparação e frete são conferidos no resumo geral.</p>`;
}
