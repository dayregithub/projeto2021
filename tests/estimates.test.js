import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  newEstimate,
  newEstimateItem,
  calculateEstimate,
  laserOperating,
  printOperating,
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
  q.customerPhone = "61992430051";
  q.customerEmail = "cliente@example.com";
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
  assert.match(text, /Instagram: @papeledmaker/);
  assert.match(text, /WhatsApp: 61992430051/);
  assert.match(text, /www.papeled.com.br/);
  assert.match(text, /papeledmaker.vercel.app/);
  const pdfSource = Buffer.from(file.bytes).toString("latin1");
  for (const url of [
    "https://www.instagram.com/papeledmaker/",
    "https://wa.me/5561992430051",
    "https://www.papeled.com.br/",
    "https://papeledmaker.vercel.app/",
  ])
    assert.ok(pdfSource.includes(url), `Missing clickable URL: ${url}`);
  assert.ok(
    text.indexOf("papeledmaker@gmail.com") < text.indexOf("Cliente de teste"),
  );
  assert.match(text, /DADOS DO CLIENTE/);
  assert.match(text, /Telefone do cliente/);
  assert.match(text, /E-mail do cliente/);
  assert.match(text, /cliente@example.com/);
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
    assert.equal(
      (await db.query("delete from public.issued_quotes returning id")).rows
        .length,
      0,
    );
    await db.exec(
      "set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'",
    );
    assert.equal(
      (
        await db.query(
          "delete from public.issued_quotes where quote_number='PM-1' returning id",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.issued_quotes")).rows.length,
      0,
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
    await assert.rejects(db.query("select * from public.finance_expenses"));
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
      "insert into public.finance_expenses(description,category,amount,due_on,status) values('Energia','Energia',15,'2026-01-01','pending')",
    );
    assert.equal(
      (await db.query("select * from public.finance_expenses")).rows.length,
      1,
    );
    await db.exec(
      "reset role;insert into auth.users values('44444444-4444-4444-8444-444444444444');set role authenticated;set request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';",
    );
    assert.equal(
      (await db.query("select * from public.finance_expenses")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into public.finance_expenses(description,category,amount,due_on,status) values('Teste','Outros',1,'2026-01-01','pending')",
      ),
    );
    await db.exec(
      "set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';",
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

test("spreadsheet quote rounds totals after multiplying and keeps material and extras independent", () => {
  const q = newEstimate();
  q.calculationVersion = 2;
  q.pricing.laserSaleHour = 85;
  Object.assign(q.items[0], {
    description: "CORTE PEÇAS",
    quantity: 40,
    minutes: 10,
    materialMode: "included",
    materialQuantity: 40,
    material: { name: "MDF 3 mm", unit: "unidade", price: 8, salePrice: 12.5 },
  });
  let result = calculateEstimate(q);
  assert.equal(result.serviceTotal, 566.67);
  assert.equal(result.materialTotal, 500);
  assert.equal(result.total, 1066.67);
  assert.equal(result.items[0].totalMinutes, 400);
  q.items[0].services = [
    {
      type: "service",
      name: "Acabamento",
      unit: "unidade",
      price: 10,
      cost: 5,
      quantity: 7,
    },
  ];
  result = calculateEstimate(q);
  assert.equal(result.additionalTotal, 70);
  assert.equal(result.total, 1136.67);
  q.items[0].quantity = 80;
  result = calculateEstimate(q);
  assert.equal(result.materialTotal, 500);
  assert.equal(result.additionalTotal, 70);
  assert.equal(result.serviceTotal, 1133.33);
  assert.equal(result.invoiceRows.length, 3);
  assert.equal(result.invoiceRows[0].quantity, 800);
  assert.equal(result.invoiceRows[1].quantity, 40);
  assert.equal(result.invoiceRows[2].quantity, 7);
  q.items[0].materialMode = "none";
  assert.equal(calculateEstimate(q).materialTotal, 0);
});

test("spreadsheet PDF separates the 400-minute service and 40 material units", async () => {
  const q = newEstimate();
  q.calculationVersion = 2;
  q.pricing.laserSaleHour = 85;
  Object.assign(q.items[0], {
    description: "CORTE PEÇAS",
    quantity: 40,
    minutes: 10,
    materialMode: "included",
    materialQuantity: 40,
    material: { name: "MDF 3 mm", unit: "unidade", price: 8, salePrice: 12.5 },
  });
  const file = await estimatePDF(q, {
    logoData: new Uint8Array(
      await readFile(new URL("../public/papeled-logo.png", import.meta.url)),
    ),
  });
  await writeFile(
    "/tmp/papeled-spreadsheet-budget.pdf",
    new Uint8Array(file.bytes),
  );
  const content = execFileSync(
    "pdftotext",
    ["-layout", "/tmp/papeled-spreadsheet-budget.pdf", "-"],
    { encoding: "utf8" },
  );
  assert.match(content, /566,67/);
  assert.match(content, /500,00/);
  assert.match(content, /1\.066,67/);
  assert.match(content, /400/);
  assert.match(content, /MDF 3 mm/);
});

test("detailed laser cost allocates fixed expenses by productive hours and includes optical consumables", () => {
  const pricing = {
    laserInvestment: 9600,
    depreciationMonths: 60,
    workingDays: 20,
    workingHours: 8,
    laserUtilization: 50,
    tubePrice: 1000,
    tubeLifeHours: 1000,
    lensPrice: 200,
    lensLifeHours: 1000,
    mirrorPrice: 100,
    mirrorLifeHours: 1000,
    machineKw: 2,
    laserEnergy: 1,
    operators: 1,
    operatorMonthly: 1000,
    overheadMonthly: 800,
    laserMaintenanceHour: 1,
    laserCostMode: "detailed",
    laserCostHour: 999,
  };
  const costs = laserOperating(pricing);
  near(costs.productiveHours, 80);
  near(costs.computed, 28.8);
  near(costs.hour, 28.8);
  const q = newEstimate({ pricing });
  q.calculationVersion = 2;
  q.items[0].minutes = 60;
  assert.equal(calculateEstimate(q).cost, 28.8);
  assert.equal(calculateEstimate(q).total, 70);
  assert.equal(
    laserOperating({ ...pricing, laserCostMode: "manual" }).hour,
    999,
  );
  assert.throws(() => laserOperating({ ...pricing, laserUtilization: 0 }));
  assert.throws(() => laserOperating({ ...pricing, lensLifeHours: 0 }));
});

test("3D operating costs include consumables, supervision and allocated overhead in both quote versions", () => {
  const pricing = {
    printerWatts: 200,
    printEnergy: 1,
    printerInvestment: 2000,
    printerLifeHours: 1000,
    printMaintenanceHour: 1,
    printConsumablesHour: 0.5,
    printOperatorHour: 2,
    printOverheadMonthly: 160,
    printProductiveHours: 80,
  };
  near(printOperating(pricing).hour, 7.7);
  for (const version of [undefined, 2]) {
    const q = newEstimate({ pricing });
    q.calculationVersion = version;
    q.items = [{ ...newEstimateItem("print"), hours: 2, quantity: 3 }];
    assert.equal(calculateEstimate(q).cost, 46.2);
    assert.equal(calculateEstimate(q).total, 115.5);
  }
  assert.throws(() => printOperating({ ...pricing, printProductiveHours: 0 }));
});

test("3D spreadsheet project uses purchase price, exact energy and 150 percent markup", () => {
  const q = newEstimate({
    pricing: {
      filamentKg: 200,
      printerWatts: 400,
      printEnergy: 1.191,
      printMarkup: 150,
    },
  });
  q.calculationVersion = 2;
  q.items = [
    {
      ...newEstimateItem("print"),
      printInputMode: "piece",
      materialMode: "included",
      grams: 100,
      hours: 2,
    },
  ];
  const before = JSON.stringify(q),
    result = calculateEstimate(q),
    item = result.items[0];
  near(item.costs.material, 20);
  near(item.costs.energy, 0.9528);
  near(item.baseCost, 20.9528);
  assert.equal(result.cost, 20.95);
  assert.equal(result.total, 52.38);
  near(item.pricePerGram, 0.5238);
  assert.equal(
    item.invoiceRows.reduce((sum, row) => sum + row.subtotal, 0),
    52.38,
  );
  assert.equal(JSON.stringify(q), before);
  q.items[0].material = { name: "PLA", price: 200, salePrice: 9999 };
  assert.equal(calculateEstimate(q).total, 52.38);
});
test("3D piece and slicer batch modes scale weight and time together, and extra services have their own quantities", () => {
  const q = newEstimate({
    pricing: {
      filamentKg: 200,
      printerWatts: 400,
      printEnergy: 1.191,
      printMarkup: 150,
    },
  });
  q.calculationVersion = 2;
  q.items = [
    {
      ...newEstimateItem("print"),
      printInputMode: "piece",
      materialMode: "included",
      grams: 100,
      hours: 2,
      quantity: 2,
    },
  ];
  assert.equal(calculateEstimate(q).total, 104.76);
  assert.equal(calculateEstimate(q).items[0].totalGrams, 200);
  assert.equal(calculateEstimate(q).items[0].totalHours, 4);
  q.items[0].printInputMode = "batch";
  assert.equal(calculateEstimate(q).total, 52.38);
  assert.equal(calculateEstimate(q).items[0].unitPrice, 26.19);
  q.items[0].services = [
    {
      name: "Pintura cadastrada",
      unit: "unidade",
      type: "service",
      price: 10,
      cost: 2,
      quantity: 7,
    },
  ];
  assert.equal(calculateEstimate(q).total, 122.38);
  q.items[0].materialMode = "provided";
  assert.equal(calculateEstimate(q).items[0].costs.material, 0);
  q.items[0].grams = 0;
  assert.throws(() => calculateEstimate(q), /Peso/);
});
test("3D project finishing uses the configured labor and pricing method, without changing laser prices", () => {
  const q = newEstimate({
    pricing: {
      filamentKg: 200,
      printerWatts: 400,
      printEnergy: 1.191,
      printMarkup: 150,
    },
  });
  q.calculationVersion = 2;
  q.items = [
    {
      ...newEstimateItem("print"),
      printInputMode: "piece",
      materialMode: "included",
      grams: 100,
      hours: 2,
      handlingMinutes: 10,
      paintingCost: 12,
      extras: 2,
    },
  ];
  assert.equal(calculateEstimate(q).total, 95.72);
  q.pricing.printPricingMethod = "margin";
  q.pricing.printMarginPercent = 30;
  q.pricing.taxPercent = 10;
  assert.equal(calculateEstimate(q).total, 63.81);
  q.items = [
    { ...newEstimateItem("laser"), minutes: 60, materialMode: "none" },
  ];
  assert.equal(calculateEstimate(q).total, 70);
  q.pricing.printMarginPercent = 99;
  assert.throws(() => calculateEstimate(q), /Margem 3D/);
});

test("included tax is visible per item and reconciles with actual sale after discounts and shipping", () => {
  const q = newEstimate({
    pricing: { filamentKg: 200, printMarkup: 150, taxPercent: 10 },
  });
  q.calculationVersion = 2;
  q.items = [
    {
      ...newEstimateItem("print"),
      printInputMode: "piece",
      materialMode: "included",
      grams: 100,
      hours: 2,
    },
  ];
  let r = calculateEstimate(q);
  assert.equal(r.total, 52.38);
  assert.equal(r.tax, 5.24);
  assert.equal(r.items[0].includedTax, 5.24);
  assert.equal(r.items[0].netRevenue, 47.14);
  assert.equal(r.items[0].estimatedProfit, 26.19);
  q.items = [
    { ...newEstimateItem("laser"), materialMode: "none", minutes: 60 },
  ];
  r = calculateEstimate(q);
  assert.equal(r.total, 70);
  assert.equal(r.items[0].includedTax, 7);
  assert.equal(r.items[0].estimatedProfit, 56.14);
  q.items = [
    { ...newEstimateItem("laser"), manualUnitPrice: 0.03 },
    { ...newEstimateItem("laser"), manualUnitPrice: 0.03 },
    { ...newEstimateItem("laser"), manualUnitPrice: 0.03 },
  ];
  q.calculationVersion = undefined;
  q.pricing.taxPercent = 33.33;
  q.setupPrice = 0.01;
  q.adjustment = 0.01;
  q.shipping = 10;
  r = calculateEstimate(q);
  near(
    r.items.reduce((sum, item) => sum + item.includedTax, 0) + r.setupTax,
    r.tax,
  );
  assert.equal(r.tax, 0.04);
  assert.equal(r.total, 10.11);
});

test("saved quote comparisons tolerate JSONB key order and metadata while detecting actual edits", async () => {
  const { quoteFingerprint } = await import("../src/quote-edit-state.js");
  const q = newEstimate();

  // Sorting the nested JSONB representation must not turn a saved quote into a dirty one.
  const reorder = (value) =>
    Array.isArray(value)
      ? value.map(reorder)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([key, v]) => [key, reorder(v)]),
          )
        : value;
  assert.equal(
    quoteFingerprint(q),
    quoteFingerprint({ ...reorder(q), updatedAt: "2026-01-01" }),
  );
  const edited = structuredClone(q);
  edited.customer = "Novo cliente";
  assert.notEqual(quoteFingerprint(q), quoteFingerprint(edited));
});
test("separate customer contact fields preserve older combined contacts and validate email", async () => {
  const { customerContacts } = await import("../src/customer-contacts.js");
  assert.deepEqual(
    customerContacts({ contact: "(61) 99243-0051 | maria@example.com" }),
    { phone: "(61) 99243-0051", email: "maria@example.com" },
  );
  assert.deepEqual(customerContacts({ contact: "1234567890@example.com" }), {
    phone: "",
    email: "1234567890@example.com",
  });
  const q = newEstimate();
  q.customerPhone = "61992430051";
  q.customerEmail = "maria@example.com";
  assert.doesNotThrow(() => validateEstimate(q));
  q.customerEmail = "inválido";
  assert.throws(() => validateEstimate(q), /E-mail do cliente/);
});

test("laser duration accepts minute-second shorthand and clock syntax without changing stored decimal minutes", async () => {
  const { parseLaserTime } = await import("../src/laser-time.js");
  near(parseLaserTime("1,30"), 1.5);
  near(parseLaserTime("00:01:30"), 1.5);
  near(parseLaserTime("1:30"), 1.5);
  near(parseLaserTime("01:02:03"), 62.05);
  near(parseLaserTime("90"), 90);
  near(parseLaserTime("0,05"), 5 / 60);
  for (const bad of ["1,60", "00:60:00", "1:90", "1,5", "-1", "abc", ""])
    assert.ok(Number.isNaN(parseLaserTime(bad)), bad);
  const quote = newEstimate();
  quote.calculationVersion = 2;
  const item = newEstimateItem("laser");
  item.quantity = 80;
  item.minutes = parseLaserTime("1,30");
  item.materialMode = "none";
  quote.items = [item];
  const result = calculateEstimate(quote);
  near(result.items[0].totalMinutes, 120);
  near(JSON.parse(JSON.stringify(quote)).items[0].minutes, 1.5);
});
