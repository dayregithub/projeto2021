import { brl } from "./estimate-calculations.js";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function financeChart(periods, { cash = false } = {}) {
  if (!periods.length)
    return '<p class="muted">Nenhum movimento neste período.</p>';
  const data = periods.slice(-18),
    series = cash
      ? [
          ["received", "Recebido", "#23735a"],
          ["paid", "Pago", "#b34e42"],
        ]
      : [
          ["revenue", "Faturamento", "#684b43"],
          ["cost", "Custos", "#b89779"],
          ["tax", "Impostos", "#ce8752"],
          ["profit", "Lucro estimado", "#23735a"],
        ];
  const values = data.flatMap((p) => series.map(([k]) => p[k] || 0)),
    min = Math.min(0, ...values),
    max = Math.max(1, ...values),
    width = 940,
    height = 300,
    left = 92,
    right = 24,
    top = 24,
    bottom = 244,
    range = max - min,
    y = (v) => bottom - ((v - min) / range) * (bottom - top),
    group = (width - left - right) / data.length,
    bw = Math.min(19, group / (series.length + 1));
  let svg = `<svg role="img" aria-label="${cash ? "Fluxo de caixa" : "Faturamento, custos, impostos e lucro estimado"}" viewBox="0 0 ${width} ${height}"><title>${cash ? "Recebimentos e despesas pagas" : "Rentabilidade por período"}</title>`;
  for (let n = 0; n < 5; n++) {
    const v = min + (range * n) / 4,
      yy = y(v);
    svg += `<line x1="${left}" x2="${width - right}" y1="${yy}" y2="${yy}" stroke="#e5d9d0"/><text x="${left - 10}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#684b43">${esc(brl(v))}</text>`;
  }
  data.forEach((p, i) => {
    const x = left + i * group + group / 2;
    series.forEach(([k, label, color], j) => {
      const v = p[k] || 0,
        yy = y(Math.max(0, v)),
        h = Math.abs(y(v) - y(0));
      svg += `<rect x="${x + (j - series.length / 2) * bw}" y="${yy}" width="${Math.max(1, bw - 2)}" height="${h}" rx="2" fill="${v < 0 ? "#b34e42" : color}"><title>${esc(p.period)} · ${label}: ${esc(brl(v))}</title></rect>`;
    });
    svg += `<text x="${x}" y="265" text-anchor="middle" font-size="11" fill="#684b43">${esc(p.period)}</text>`;
  });
  svg += "</svg>";
  return `<div class="finance-plot">${svg}</div><div class="finance-legend">${series.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join("")}</div>${periods.length > 18 ? '<p class="muted">Gráfico: últimos 18 períodos. Tabelas e totais incluem todo o intervalo selecionado.</p>' : ""}`;
}
