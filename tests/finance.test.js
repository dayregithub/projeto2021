import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { newEstimate } from "../src/estimate-calculations.js";
import {
  financeReport,
  validateExpense,
  loadAllRows,
} from "../src/finance-data.js";
import { workbookBytes } from "../src/report-exports.js";
const quote = (
  status,
  paymentStatus = "pending",
  issuedOn = "2026-01-10",
  paymentDate = "",
) => {
  const q = newEstimate();
  q.items[0].minutes = 60;
  return { ...q, status, paymentStatus, issuedOn, paymentDate };
};
test("finance separates cash, approved receivables and nonapproved proposals across dates", () => {
  const quotes = [
    quote("approved"),
    quote("draft"),
    quote("rejected"),
    quote("cancelled"),
    quote("delivered", "paid", "2025-12-01", "2026-01-20"),
    quote("approved", "paid", "2025-12-01", "2026-02-10"),
  ];
  const expenses = [
    validateExpense({
      description: "Energia",
      category: "Energia",
      amount: 15,
      status: "paid",
      due_on: "2025-12-20",
      paid_on: "2026-01-10",
    }),
    validateExpense({
      description: "Material",
      category: "MDF",
      amount: 20,
      status: "pending",
      due_on: "2026-01-20",
    }),
  ];
  const r = financeReport(quotes, expenses, {
    from: "2026-01-01",
    to: "2026-01-31",
    group: "day",
  });
  assert.equal(r.metrics.received, 70);
  assert.equal(r.metrics.receivable, 70);
  assert.equal(r.metrics.awaiting, 70);
  assert.equal(r.metrics.rejected, 140);
  assert.equal(r.metrics.paid, 15);
  assert.equal(r.metrics.payable, 20);
  assert.equal(r.metrics.balance, 55);
  assert.equal(r.metrics.quoted, 280);
  assert.equal(financeReport(quotes, expenses).metrics.received, 140);
  const missing = financeReport([quote("delivered", "paid")], [], {
    from: "2026-01-01",
    to: "2026-12-31",
  });
  assert.equal(missing.metrics.received, 0);
  assert.equal(missing.undated.length, 1);
  assert.equal(
    financeReport([quote("delivered", "paid")], []).metrics.received,
    70,
  );
});
test("expenses reject invalid values and inconsistent paid dates", () => {
  const e = {
    description: "Tubo",
    category: "Manutenção",
    amount: 10,
    due_on: "2026-01-01",
    status: "paid",
    paid_on: "2026-01-02",
  };
  assert.equal(validateExpense(e), e);
  for (const change of [
    { amount: -1 },
    { amount: Infinity },
    { description: "" },
    { paid_on: "" },
    { due_on: "2026-02-31" },
  ])
    assert.throws(() => validateExpense({ ...e, ...change }));
});
test("all pages of quotes are loaded beyond former 250 quote limit", async () => {
  const data = Array.from({ length: 1101 }, (_, id) => ({ id }));
  let calls = 0;
  const client = {
    from: () => ({
      select: () => ({
        order: () => ({
          range: async (a, b) => {
            calls++;
            return { data: data.slice(a, b + 1) };
          },
        }),
      }),
    }),
  };
  assert.equal(
    (await loadAllRows(client, "issued_quotes", "data")).length,
    1101,
  );
  assert.equal(calls, 3);
});
test("Excel exports use numeric cells, Unicode and inert inline strings", () => {
  const bytes = workbookBytes([
    {
      name: "Orçamentos",
      rows: [
        ["Cliente", "Total"],
        ['=HYPERLINK("bad")', 70],
        ["João & Cia", 12.5],
      ],
    },
    { name: "Itens", rows: [["Descrição"], ["Caixa <laser>"]] },
  ]);
  const files = unzipSync(bytes),
    sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
  assert.match(sheet, /t="inlineStr"/);
  assert.match(sheet, /<v>70<\/v>/);
  assert.match(sheet, /João &amp; Cia/);
  assert.ok(!sheet.includes("<f>"));
  assert.ok(files["xl/worksheets/sheet2.xml"]);
});
