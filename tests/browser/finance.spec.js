import { test, expect } from "./fixtures.js";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
test("floating quote actions protect edits, close and start a new quote", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  expect(
    await page
      .locator("#estimate-form")
      .evaluate(
        (form) =>
          form
            .querySelector('[name="customer"]')
            .compareDocumentPosition(form.querySelector("#estimate-items")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
  ).toBeTruthy();
  await page.locator('[name="customer"]').fill("Cliente teste");
  await page.locator("#estimate-close").click();
  await expect(page.locator("#estimate-leave-dialog")).toBeVisible();
  await page.locator("#estimate-leave-back").click();
  await expect(page.locator("#estimate-editor")).toBeVisible();
  await page.locator("#estimate-close").click();
  await page.locator("#estimate-leave-save").click();
  await expect(page.locator("#estimate-editor")).toBeHidden();
  await page.locator("#new-laser-estimate").click();
  await page.locator("#estimate-close").click();
  await page.locator("#estimate-new").click();
  await expect(page.locator("#estimate-new-dialog")).toBeVisible();
  await page.locator("#estimate-new-print").click();
  await expect(page.locator('[data-item="hours"]')).toBeVisible();
});
test("finance, archived work reports and exports stay consistent after reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await page.locator('#estimate-form [name="customer"]').fill("Maria Silva");
  await page.locator('#estimate-form [name="title"]').fill("Caixas MDF");
  await page.locator('[data-item="minutes"]').fill("60");
  await page.locator("#estimate-save").click();
  await page.locator('[data-tab="production"]').click();
  await page.locator("[data-estimate-card] details summary").click();
  await page.locator("[data-stage-change]").selectOption("approved");
  await page.locator("[data-payment-change]").selectOption("paid");
  await page.locator('[data-tab="finance"]').click();
  await page.locator("#finance-period").selectOption("all");
  await expect(page.locator("#finance-summary .metric").nth(0)).toContainText(
    "70,00",
  );
  await page.locator("#finance-expense-details summary").click();
  const form = page.locator("#finance-expense-form");
  await form.locator('[name="description"]').fill("Conta de energia");
  await form.locator('[name="category"]').fill("Energia");
  await form.locator('[name="amount"]').fill("20");
  await form.locator('[name="status"]').selectOption("paid");
  await page.locator("#finance-expense-save").click();
  await expect(page.locator("#finance-summary .metric").nth(2)).toContainText(
    "50,00",
  );
  await page.locator("#finance-group").selectOption("day");
  await expect(page.locator("#finance-chart")).toContainText("Recebido");
  let pending = page.waitForEvent("download");
  await page.locator("#finance-pdf").click();
  expect(
    (await readFile(await (await pending).path())).subarray(0, 4).toString(),
  ).toBe("%PDF");
  await page.locator('[data-tab="production"]').click();
  await page.locator("[data-archive-cancelled]").click();
  await page.locator("#estimate-record-confirm").click();
  await expect(page.locator("[data-estimate-card]")).toHaveCount(0);
  await page.locator('[data-tab="finance"]').click();
  await expect(page.locator("#finance-summary .metric").nth(0)).toContainText(
    "70,00",
  );
  await expect(page.locator("#finance-summary .metric").nth(6)).toContainText(
    "70,00",
  );
  await page.locator('[data-tab="work-reports"]').click();
  await page.locator("#work-archive").selectOption("archived");
  await expect(page.locator("#work-rows")).toContainText("Cancelado");
  await expect(page.locator("#work-rows")).toContainText("Maria Silva");
  pending = page.waitForEvent("download");
  await page.locator("#work-excel").click();
  const files = unzipSync(
    new Uint8Array(await readFile(await (await pending).path())),
  );
  expect(strFromU8(files["xl/worksheets/sheet1.xml"])).toContain("Maria Silva");
  expect(strFromU8(files["xl/worksheets/sheet2.xml"])).toContain("laser");
  pending = page.waitForEvent("download");
  await page.locator("#work-pdf").click();
  expect(
    (await readFile(await (await pending).path())).subarray(0, 4).toString(),
  ).toBe("%PDF");
  await page.locator("#work-payment").selectOption("pending");
  await expect(page.locator("#work-rows")).toContainText("Nenhum trabalho");
  await page.locator("#work-clear").click();
  await page.locator('[data-tab="estimate-history"]').click();
  await page.locator("#estimate-history-filter").selectOption("archived");
  await page.locator("[data-restore-estimate]").click();
  await page.locator('[data-tab="production"]').click();
  await expect(page.locator("[data-estimate-card]")).toHaveCount(1);
  await page.locator("[data-estimate-card] details summary").click();
  await expect(page.locator("[data-payment-change]")).toHaveValue("paid");
  await page.locator("[data-archive-completed]").click();
  await expect(page.locator("[data-estimate-card]")).toHaveCount(0);
  await page.reload();
  await page.locator('[data-tab="work-reports"]').click();
  await expect(page.locator("#work-rows")).toContainText("Concluído");
  await page.locator('[data-tab="finance"]').click();
  await page.locator("#finance-period").selectOption("all");
  await expect(page.locator("#finance-summary .metric").nth(2)).toContainText(
    "50,00",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "/tmp/papeled-finance-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("global floating actions and collapsible navigation work on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  const site = page.locator('details[data-nav-group="SITE"]');
  await site.locator(":scope > summary").click();
  await expect(page.locator('[data-tab="overview"]')).toBeHidden();
  await site.locator(":scope > summary").click();
  await expect(page.locator('[data-tab="overview"]')).toBeVisible();
  const materials = page.locator('details[data-nav-group="materials"]');
  await materials.locator(":scope > summary").click();
  await expect(page.locator('[data-tab="resources-laser"]')).toBeHidden();
  await materials.locator(":scope > summary").click();
  await expect(page.locator('[data-tab="resources-laser"]')).toBeVisible();
  await expect(page.locator("#estimate-new")).toBeVisible();
  await expect(page.locator("#estimate-close")).toBeHidden();
  await page.locator("#estimate-new").click();
  await page.locator("#estimate-new-laser").click();
  await expect(page.locator("#estimate-close")).toBeVisible();
  await page.locator('[data-item="minutes"]').fill("60");
  await page.locator("#estimate-save").click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await page.locator("#admin-scroll-top").click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#admin-menu-toggle")).toBeVisible();
  await page.locator("#admin-menu-toggle").click();
  await expect(page.locator("#admin-menu-items")).toBeHidden();
  await page.locator("#admin-menu-toggle").click();
  await expect(page.locator("#admin-menu-items")).toBeVisible();
  expect(
    await page
      .locator("#admin-menu-items")
      .evaluate((menu) => menu.scrollWidth <= menu.clientWidth),
  ).toBeTruthy();
  await page.locator("#admin-menu-toggle").click();
  await page.screenshot({
    path: "/tmp/papeled-navigation-mobile.png",
    fullPage: true,
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  for (const id of ["estimate-new", "estimate-close", "admin-scroll-top"]) {
    const rect = await page.locator("#" + id).boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(390);
    expect(rect.y + rect.height).toBeLessThanOrEqual(844);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("database diagnostics do not pretend local preview confirms a live database", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="database"]').click();
  await expect(page.locator("#database-check-summary")).toContainText(
    "Prévia local",
  );
  await expect(page.locator("#database-check-copy")).toBeDisabled();
  await page.locator("#database-check-run").click();
  await expect(page.locator("#database-check-results")).toBeEmpty();
  await expect(page.locator("#database-check-summary")).toContainText(
    "login de administrador",
  );
});

test("profit dashboard filters services, preserves saved snapshots and exports full Excel/PDF on mobile", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin.html");
  await page.evaluate(async () => {
    const { newEstimate, newEstimateItem } =
      await import("/src/estimate-calculations.js");
    const make = (process, name) => {
      const q = newEstimate();
      q.number = `PM-20260110-${process}`;
      q.issuedOn = "2026-01-10";
      q.status = "approved";
      q.customer = "João da Silva";
      q.title = "Peças personalizadas";
      q.pricing.taxPercent = 4;
      q.items = [newEstimateItem(process)];
      q.items[0].description = name;
      if (process === "laser") q.items[0].minutes = 60;
      else {
        q.items[0].grams = 100;
        q.items[0].hours = 2;
      }
      return q;
    };
    localStorage.setItem(
      "papeled-issued-estimates-v1",
      JSON.stringify([
        make("laser", "Corte de caixas"),
        make("print", "Impressão de suporte"),
      ]),
    );
  });
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="finance"]').click();
  await page.locator("#finance-period").selectOption("all");
  await expect(page.locator("#finance-profit-summary")).toContainText(
    "Impostos estimados",
  );
  await expect(page.locator("#finance-services")).toContainText(
    "Impressão de suporte",
  );
  await expect(page.locator("#finance-profit-chart svg")).toBeVisible();
  await page.locator("#finance-service-process").selectOption("laser");
  await expect(page.locator("#finance-services")).not.toContainText(
    "Impressão de suporte",
  );
  await expect(page.locator("#finance-services")).toContainText(
    "Corte de caixas",
  );
  await page.locator("#finance-service-search").fill("inexistente");
  await expect(page.locator("#finance-services")).toContainText(
    "Nenhum serviço",
  );
  await page.locator("#finance-service-search").fill("");
  await page.locator("#finance-report-title").fill("Fechamento janeiro");
  await page.locator("#finance-save-report").click();
  await expect(page.locator("#finance-report-status")).toContainText(
    "somente neste navegador",
  );
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("papeled-finance-reports-v1"))[0],
  );
  expect(saved.data.report.analytics.details.length).toBe(2);
  expect(saved.data.report.analytics.totals.tax).toBeGreaterThan(0);
  let pending = page.waitForEvent("download");
  await page.locator("#finance-excel").click();
  const files = unzipSync(
    new Uint8Array(await readFile(await (await pending).path())),
  );
  expect(strFromU8(files["xl/workbook.xml"])).toContain("Serviços");
  expect(strFromU8(files["xl/worksheets/sheet3.xml"])).toContain(
    "Corte de caixas",
  );
  await page.evaluate(() => {
    const qs = JSON.parse(localStorage.getItem("papeled-issued-estimates-v1"));
    qs[0].items[0].minutes = 900;
    localStorage.setItem("papeled-issued-estimates-v1", JSON.stringify(qs));
  });
  await page.reload();
  await page.locator('[data-tab="finance"]').click();
  await page.locator("#finance-period").selectOption("all");
  await expect(page.locator("#finance-saved-reports")).toContainText(
    "Fechamento janeiro",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("papeled-finance-reports-v1"))[0].data
          .report.analytics.totals,
    ),
  ).toEqual(saved.data.report.analytics.totals);
  pending = page.waitForEvent("download");
  await page.locator("[data-saved-finance]").first().click();
  const pdf = await readFile(await (await pending).path());
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  await expect(page.locator("#finance-report-status")).toContainText(
    "sem recalcular",
  );
  await page.locator("#finance-period").selectOption("month");
  await page.locator("#finance-month").fill("2026-02");
  await page.locator("#finance-save-report").click();
  const feb = await page.evaluate(
    () => JSON.parse(localStorage.getItem("papeled-finance-reports-v1"))[0],
  );
  expect(feb.period_to).toBe("2026-02-28");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
