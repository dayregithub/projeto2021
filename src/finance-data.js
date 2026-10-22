import { calculateEstimate, money } from "./estimate-calculations.js";
export const COMMITTED_STAGES = [
  "approved",
  "in_progress",
  "completed",
  "delivered",
];
export function financeReport(
  quotes,
  expenses,
  { from = "", to = "", group = "month" } = {},
) {
  const includes = (date) =>
    (!from && !to) ||
    (!!date && (!from || date >= from) && (!to || date <= to));
  const rows = [],
    invalid = [],
    undated = [];
  const metrics = {
    quoted: 0,
    received: 0,
    receivable: 0,
    awaiting: 0,
    rejected: 0,
    paid: 0,
    payable: 0,
    estimatedCost: 0,
  };
  for (const q of quotes) {
    let result;
    try {
      result = calculateEstimate(q);
    } catch {
      invalid.push(q.number || q.id);
      continue;
    }
    const total = result.total;
    if (includes(q.issuedOn)) {
      metrics.quoted += total;
      if (["rejected", "cancelled"].includes(q.status))
        metrics.rejected += total;
      else if (!COMMITTED_STAGES.includes(q.status)) metrics.awaiting += total;
      else metrics.estimatedCost += result.cost;
    }
    const paid = q.paymentStatus === "paid";
    const date = paid ? q.paymentDate : q.issuedOn;
    if (paid && !date) undated.push(q.number || q.id);
    if (!includes(date)) continue;
    const kind = paid
      ? "received"
      : ["rejected", "cancelled"].includes(q.status)
        ? "rejected"
        : COMMITTED_STAGES.includes(q.status)
          ? "receivable"
          : "awaiting";
    if (kind === "received" || kind === "receivable") metrics[kind] += total;
    rows.push({
      id: q.id,
      source: "quote",
      date: date || "",
      description: q.title,
      customer: q.customer,
      reference: q.number,
      kind,
      amount: total,
    });
  }
  for (const e of expenses) {
    const date = e.status === "paid" ? e.paid_on : e.due_on;
    if (!includes(date)) continue;
    const kind = e.status === "paid" ? "paid" : "payable";
    metrics[kind] += Number(e.amount);
    rows.push({
      id: e.id,
      source: "expense",
      date,
      description: e.description,
      customer: e.category,
      reference: "",
      kind,
      amount: Number(e.amount),
    });
  }
  const buckets = new Map();
  for (const row of rows) {
    const key = row.date
      ? row.date.slice(0, group === "year" ? 4 : group === "day" ? 10 : 7)
      : "Sem data";
    if (!buckets.has(key))
      buckets.set(key, {
        period: key,
        received: 0,
        paid: 0,
        receivable: 0,
        payable: 0,
      });
    if (Object.hasOwn(buckets.get(key), row.kind))
      buckets.get(key)[row.kind] += row.amount;
  }
  for (const key of Object.keys(metrics)) metrics[key] = money(metrics[key]);
  metrics.balance = money(metrics.received - metrics.paid);
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return {
    metrics,
    rows,
    invalid,
    undated,
    periods: [...buckets.values()]
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((b) => ({ ...b, balance: money(b.received - b.paid) })),
  };
}
export function validateExpense(e) {
  if (!e.description?.trim() || e.description.length > 180)
    throw Error("Informe a descrição da despesa (até 180 caracteres).");
  if (!e.category?.trim() || e.category.length > 80)
    throw Error("Informe a categoria (até 80 caracteres).");
  if (!Number.isFinite(e.amount) || e.amount <= 0 || e.amount > 1e9)
    throw Error("Informe um valor maior que zero.");
  const validDate = (s) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s || "") &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (!validDate(e.due_on))
    throw Error("Informe uma data válida para a despesa.");
  if (
    !["pending", "paid"].includes(e.status) ||
    (e.status === "paid" && !validDate(e.paid_on))
  )
    throw Error("Informe uma data válida de pagamento.");
  return e;
}
export async function loadAllRows(client, table, columns, order = "id") {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const result = await client
      .from(table)
      .select(columns)
      .order(order, { ascending: true })
      .range(offset, offset + 499);
    if (result.error) throw result.error;
    rows.push(...result.data);
    if (result.data.length < 500) return rows;
  }
}
