import { test, expect } from "./fixtures.js";
import { readFile } from "node:fs/promises";

test("laser and 3D estimates calculate, export PDF and preserve history on mobile", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await expect(page.locator("#estimate-form [data-pricing]")).toHaveCount(0);
  await page.locator('[data-item="description"]').fill("Caixa personalizada");
  await page.locator('[data-item="minutes"]').fill("60");
  await page.locator('[data-item="quantity"]').fill("2");
  await page
    .locator('#estimate-form [name="customer"]')
    .fill("Cliente de teste");
  await expect(page.locator("#estimate-summary")).toContainText("140,00");
  await page.locator("#estimate-commercial summary").click();
  await page
    .locator('#estimate-form [name="discountType"]')
    .selectOption("percent");
  await page.locator('#estimate-form [name="discount"]').fill("10");
  await page.locator('#estimate-form [name="adjustment"]').fill("-6");
  await page.locator('#estimate-form [name="shipping"]').fill("10");
  await expect(page.locator("#estimate-summary .metric").nth(2)).toContainText(
    "130,00",
  );
  await page.locator("#estimate-save").click();
  await expect(page.locator("#estimate-status")).toContainText("salvo");
  const pending = page.waitForEvent("download");
  await page.locator("#estimate-pdf").click();
  const file = await pending;
  expect((await readFile(await file.path())).subarray(0, 4).toString()).toBe(
    "%PDF",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.reload();
  await expect(page.locator("#workspace")).toBeVisible();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator('[data-tab="estimate-history"]').click();
  await expect(page.locator("#estimate-history-list")).toContainText(
    "Cliente de teste",
  );
  await page
    .locator("#estimate-history-list [data-open-estimate]")
    .first()
    .click();
  await expect(page.locator('#estimate-form [name="customer"]')).toHaveValue(
    "Cliente de teste",
  );
  await page.locator("#new-print-estimate").click();
  await expect(page.locator("#estimate-form [data-pricing]")).toHaveCount(0);
  await page.locator('[data-item="grams"]').fill("110");
  await page.locator('[data-item="hours"]').fill("5");
  await expect(page.locator("#estimate-summary .metric").nth(2)).toContainText(
    "38,96",
  );
  await page.locator("#estimate-preview-button").click();
  await expect(page.locator("#estimate-preview")).toBeVisible();
  await expect(page.locator("#estimate-preview canvas")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator("[data-page]")).toContainText("Página 1 de 1");
  expect(
    await page.locator("#estimate-preview canvas").evaluate((c) => c.width),
  ).toBeGreaterThan(500);
  await expect(page.locator("#estimate-preview-open")).toHaveAttribute(
    "href",
    /^blob:/,
  );
  await expect(page.locator("#estimate-status")).toContainText(
    "Prévia atualizada",
  );
  await page.locator("#add-laser-item").click();
  await expect(page.locator(".estimate-item")).toHaveCount(2);
  await page.locator('[data-remove="1"]').click();
  expect(errors).toEqual([]);
});
