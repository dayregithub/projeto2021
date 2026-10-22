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
