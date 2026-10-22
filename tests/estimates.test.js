import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  newEstimate,
  newEstimateItem,
  calculateEstimate,
  laserOperating,
  validateEstimate,
} from "../src/estimate-calculations.js";
import { estimatePDF } from "../src/estimate-pdf.js";
import { PGlite } from "@electric-sql/pglite";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.000001, `${a} != ${b}`);
test("laser machine costs reproduce Automatisa values and commercial time does not double-charge costs", () => {
  const c = laserOperating({});
  near(c.tube, 0.4375);
  near(c.energy, 1.425);
  near(c.labor, 3.125);
  near(c.depreciation, 1.875);
  near(c.hour, 6.8625);
  near(c.minute, 0.114375);
  const q = newEstimate();
  q.pricing.laserSaleHour = 45;
  q.pricing.taxPercent = 15;
  q.items[0].minutes = 60;
  const r = calculateEstimate(q);
  assert.equal(r.total, 45);
  assert.equal(r.profit, 31.39);
  q.pricing.laserSaleHour = 70;
  q.pricing.taxPercent = 0;
  q.items[0].minutes = 3;
  q.items[0].quantity = 14;
  assert.equal(calculateEstimate(q).total, 49);
});
test("MDF sheet example uses all three cut panels and area in square meters", () => {
  const q = newEstimate();
  Object.assign(q.pricing, {
    laserInvestment: 0,
    tubePrice: 0,
    operatorMonthly: 0,
    machineKw: 1.5,
    laserEnergy: 1,
    markupPercent: 100,
  });
  Object.assign(q.items[0], {
    method: "markup",
    minutes: 25,
    boards: 3,
    boardWidth: 60,
    boardLength: 40,
    handlingMinutes: 18,
  });
  const r = calculateEstimate(q);
  near(r.sheetM2, 4.95);
  near(r.materialM2, 85 / 4.95);
  near(r.items[0].unitCost, 18.98863636363636);
  assert.equal(r.total, 37.98);
});
test("3D filament, watts/kWh, finishing and markup follow workbook formulas", () => {
  const q = newEstimate();
  q.items = [newEstimateItem("print")];
  Object.assign(q.pricing, { filamentKg: 70, markupPercent: 500 });
  Object.assign(q.items[0], { grams: 300, hours: 9.6 });
  const r = calculateEstimate(q);
  near(r.items[0].costs.material, 21);
  near(r.items[0].costs.energy, 4.57344);
  near(r.items[0].unitCost, 25.57344);
  assert.equal(r.total, 153.44);
  Object.assign(q.pricing, { filamentKg: 120, markupPercent: 150 });
  Object.assign(q.items[0], { grams: 110, hours: 5 });
  assert.equal(calculateEstimate(q).total, 38.96);
  q.items[0].paintingCost = 12;
  q.items[0].handlingMinutes = 30;
  near(calculateEstimate(q).items[0].unitCost, 37.582);
});
test("discounts, negative adjustments, zero manual price and shipping preserve consistent totals", () => {
  const q = newEstimate();
  q.items[0].minutes = 60;
  q.setupPrice = 10;
  q.shipping = 15;
  q.discountType = "percent";
  q.discount = 10;
  q.adjustment = -2;
  let r = calculateEstimate(q);
  assert.equal(r.subtotal, 80);
  assert.equal(r.discount, 8);
  assert.equal(r.total, 85);
  q.items[0].manualUnitPrice = 0;
  q.setupPrice = 0;
  q.discount = 0;
  q.adjustment = 0;
  q.shipping = 0;
  r = calculateEstimate(q);
  assert.equal(r.total, 0);
  assert.ok(r.warnings.length);
  assert.ok(r.profit < 0);
  q.discountType = "amount";
  q.discount = 500;
  assert.throws(() => calculateEstimate(q), /superar/);
  q.discount = 0;
  q.items[0].manualUnitPrice = null;
  q.items[0].quantity = 1.5;
  assert.throws(() => calculateEstimate(q), /inteira/);
});
test("gross margin includes embedded taxes and invalid inputs cannot be issued", () => {
  const q = newEstimate();
  q.items[0].minutes = 60;
  q.items[0].method = "margin";
  q.pricing.marginPercent = 30;
  q.pricing.taxPercent = 15;
  const r = calculateEstimate(q);
  assert.ok(Math.abs(r.margin - 30) < 0.1);
  q.pricing.marginPercent = 90;
  assert.throws(() => calculateEstimate(q), /menores/);
  q.pricing.marginPercent = 30;
  q.pricing.workingHours = 0;
  assert.throws(() => calculateEstimate(q));
  q.pricing.workingHours = 8;
  q.issuedOn = "2026-02-31";
  assert.throws(() => validateEstimate(q), /Data inválida/);
});
test("branded PDF wraps long budgets over pages without exposing internal costs or notes", async () => {
  const q = newEstimate();
  q.customer = "Cliente de teste";
  q.internalNotes = "SEGREDO_INTERNO_NAO_EXPORTAR";
  q.items = Array.from({ length: 45 }, (_, i) => ({
    ...newEstimateItem("laser"),
    description: `Produto ${i + 1} com corte e gravação e descrição detalhada para verificar as quebras de página.`,
    minutes: 10,
    quantity: 2,
  }));
  q.notes = "Observação importante para produção. ".repeat(80);
  q.layout.template = "modern";
  const file = await estimatePDF(q, {
    logoData: new Uint8Array(
      await readFile(new URL("../public/papeled-logo.png", import.meta.url)),
    ),
  });
  await writeFile("/tmp/papeled-estimate-test.pdf", new Uint8Array(file.bytes));
  const text = execFileSync(
    "pdftotext",
    ["-layout", "/tmp/papeled-estimate-test.pdf", "-"],
    { encoding: "utf8" },
  );
  assert.match(text, /Papeled Maker/);
  assert.match(text, /Produto 45/);
  assert.match(text, /TOTAL/);
  assert.doesNotMatch(
    text,
    /SEGREDO_INTERNO|Custo interno|Resultado após impostos/,
  );
  assert.ok(text.split("\f").length > 2);
});
test("issued quotes and pricing defaults are private and only administrators can write", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/001_platform.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/003_estimates.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from public.issued_quotes"));
    await db.exec(
      `reset role;insert into auth.users values('11111111-1111-4111-8111-111111111111');insert into public.admin_users values('11111111-1111-4111-8111-111111111111');set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';insert into public.issued_quotes(quote_number,data)values('PM-1','{}');insert into public.pricing_profiles(id,data)values('default','{}');`,
    );
    assert.equal(
      (await db.query("select * from public.issued_quotes")).rows.length,
      1,
    );
    await db.exec(
      `set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'`,
    );
    assert.equal(
      (await db.query("select * from public.issued_quotes")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into public.issued_quotes(quote_number,data) values('PM-2','{}')",
      ),
    );
  } finally {
    await db.close();
  }
});

test("material snapshots and services keep independent purchase and sale prices", () => {
  const q = newEstimate();
  q.items[0].material = {
    name: "MDF 6 mm",
    price: 200,
    width: 100,
    length: 200,
  };
  q.items[0].boards = 1;
  q.pricing.markupPercent = 100;
  q.items[0].services = [
    {
      type: "service",
      name: "Pintura",
      unit: "unidade",
      cost: 5,
      price: 20,
      quantity: 1,
    },
  ];
  let result = calculateEstimate(q);
  assert.equal(result.total, 68);
  assert.equal(result.items[0].costs.material, 24);
  assert.equal(result.cost, 29);
  q.items = [newEstimateItem("print")];
  q.items[0].grams = 100;
  q.items[0].material = { name: "PETG", price: 200 };
  q.pricing.markupPercent = 150;
  assert.equal(calculateEstimate(q).total, 50);
  q.items[0].material.price = 0;
  assert.throws(() => calculateEstimate(q), /preço do material/);
  q.items[0].material.price = 200;
  q.paymentStatus = "paid";
  q.paymentDate = "";
  assert.throws(() => validateEstimate(q), /data do pagamento/);
  q.paymentDate = "2026-10-21";
  q.status = "in_progress";
  assert.equal(validateEstimate(q).paymentStatus, "paid");
});

test("combined database update is repeatable, customer writes are private, backups isolated by owner", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;grant usage on schema auth to authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/001_platform.sql", import.meta.url),
        "utf8",
      ),
    );
    const update = await readFile(
      new URL("../public/database-update.sql", import.meta.url),
      "utf8",
    );
    await db.exec(update);
    await db.exec(update);
    await db.exec(`set role anon`);
    assert.equal(
      (await db.query("select public.customer_capture_enabled() as enabled"))
        .rows[0].enabled,
      true,
    );
    await assert.rejects(db.query("select * from public.customer_projects"));
    await assert.rejects(
      db.query(
        "select public.register_customer_project('11111111-1111-4111-8111-111111111111','','','','save','{\"model\":\"grid\"}')",
      ),
    );
    await db.query(
      "select public.register_customer_project('11111111-1111-4111-8111-111111111111','Maria','','maria@example.com','save','{\"model\":\"grid\"}')",
    );
    await assert.rejects(
      db.query("update public.customer_projects set customer_name='x'"),
    );
    await db.exec(
      `reset role;insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');insert into public.admin_users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';`,
    );
    assert.equal(
      (await db.query("select * from public.customer_projects")).rows.length,
      1,
    );
    await db.query(
      "insert into public.workspace_backups(device_id,device_name,data) values('33333333-3333-4333-8333-333333333333','PC','{\"version\":1}')",
    );
    await db.exec(
      `set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'`,
    );
    assert.equal(
      (await db.query("select * from public.workspace_backups")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test("workspace restore merges without losing local quotes and rolls back storage failures", async () => {
  const { restoreWorkspace, readWorkspace } =
    await import("../src/workspace-cloud.js");
  const original = newEstimate(),
    remote = newEstimate();
  const values = new Map([
    ["papeled-issued-estimates-v1", JSON.stringify([original])],
  ]);
  let fail = false;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem(key, value) {
      if (fail && key === "papeled-estimate-profile-v1") {
        fail = false;
        throw Error("Quota");
      }
      values.set(key, value);
    },
  };
  restoreWorkspace(
    { version: 1, "papeled-issued-estimates-v1": [remote] },
    storage,
  );
  assert.equal(readWorkspace(storage)["papeled-issued-estimates-v1"].length, 2);
  const before = JSON.stringify([...values]);
  fail = true;
  assert.throws(
    () =>
      restoreWorkspace(
        {
          version: 1,
          "papeled-issued-estimates-v1": [newEstimate()],
          "papeled-estimate-profile-v1": { pricing: {} },
        },
        storage,
      ),
    /Quota/,
  );
  assert.equal(JSON.stringify([...values]), before);
});

test("consolidated laser cost changes only internal cost, never double-charges the hourly sale", () => {
  const q = newEstimate();
  q.items[0].minutes = 60;
  q.pricing.laserCostHour = 30;
  const result = calculateEstimate(q);
  assert.equal(result.cost, 30);
  assert.equal(result.total, 70);
  const legacy = newEstimate();
  legacy.items[0].minutes = 60;
  assert.equal(calculateEstimate(legacy).cost, 6.86);
});

test("new laser and 3D markups are independent while legacy markup stays supported", () => {
  const q = newEstimate();
  q.pricing.laserMaterialMarkup = 100;
  q.pricing.printMarkup = 300;
  q.pricing.markupPercent = 999;
  q.items[0].minutes = 60;
  q.items[0].boards = 1;
  q.items[0].material = { name: "Chapa", price: 100, width: 100, length: 100 };
  assert.equal(calculateEstimate(q).total, 118);
  q.items = [newEstimateItem("print")];
  q.items[0].grams = 100;
  q.items[0].material = { name: "PETG", price: 200 };
  assert.equal(calculateEstimate(q).total, 80);
});
