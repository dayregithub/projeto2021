import { test, expect } from "./fixtures.js";
import { readFile } from "node:fs/promises";
test("3D project form matches spreadsheet and separates fixed settings from editable project inputs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(
    ({ price }) =>
      !localStorage.getItem("papeled-estimate-profile-v1") &&
      localStorage.setItem(
        "papeled-estimate-profile-v1",
        JSON.stringify({
          materials: [
            { process: "print", material: { name: "PLA", price, unit: "kg" } },
          ],
        }),
      ),
    { price: 200 },
  );
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimate-settings"]').click();
  await expect(page.locator('[data-cost-panel="laser"]')).toBeVisible();
  await expect(page.locator('[data-cost-panel="print"]')).toBeHidden();
  await page.locator('[data-cost-tab="print"]').click();
  await expect(page.locator('[data-cost-panel="laser"]')).toBeHidden();
  for (const [key, value] of Object.entries({
    filamentKg: 200,
    printerWatts: 400,
    printEnergy: 1.191,
    printMarkup: 150,
  }))
    await page.locator(`[data-pricing="${key}"]`).fill(String(value));
  await page.locator("#estimate-save-profile").click();
  await expect(page.locator("#estimate-settings-status")).toContainText(
    "Configurações salvas",
  );
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-print-estimate").click();
  await expect(page.locator("#estimate-form [data-pricing]")).toHaveCount(0);
  await expect(
    page.locator('#estimate-form [data-item="minutes"]'),
  ).toHaveCount(0);
  await expect(page.locator('#estimate-form [data-item="boards"]')).toHaveCount(
    0,
  );
  await page.locator('#estimate-form [name="customer"]').fill("Cliente 3D");
  await page.locator('[data-item="grams"]').fill("100");
  await page.locator('[data-item="hours"]').fill("2");
  await expect(page.locator("[data-item-result]")).toContainText("52,38");
  await expect(page.locator("[data-item-result]")).toContainText("0,52");
  await page
    .locator("summary")
    .filter({ hasText: "Conferir custos calculados" })
    .click();
  await expect(page.locator("[data-print-cost-result]")).toContainText("20,95");
  await page.locator('[data-item="quantity"]').fill("2");
  await expect(page.locator("#estimate-summary [data-estimate-total]")).toContainText(
    "104,76",
  );
  await page.locator('[data-item="printInputMode"]').selectOption("batch");
  await expect(page.locator("#estimate-summary [data-estimate-total]")).toContainText(
    "52,38",
  );
  await expect(page.locator("[data-time-result]")).toContainText("100 g");
  await page.locator("#estimate-save").click();
  const downloaded = page.waitForEvent("download");
  await page.locator("#estimate-pdf").click();
  expect(
    (await readFile(await (await downloaded).path())).subarray(0, 4).toString(),
  ).toBe("%PDF");
  await page.reload();
  await page.locator('[data-tab="estimates"]').click();
  await expect(page.locator('[data-item="printInputMode"]')).toHaveValue(
    "batch",
  );
  await expect(page.locator("#estimate-summary [data-estimate-total]")).toContainText(
    "52,38",
  );
  await page.locator("[data-material-cost]").fill("250");
  await expect(page.locator("#estimate-summary [data-estimate-total]")).toContainText(
    "64,88",
  );
  await page.locator('[data-item="grams"]').fill("0");
  await expect(page.locator("#estimate-pdf")).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "/tmp/papeled-print-quote-mobile.png",
    fullPage: true,
  });
});
