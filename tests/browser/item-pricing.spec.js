import { test, expect } from "./fixtures.js";
test("item discounts and minute overrides persist independently and leave global tariff and discounts intact", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await page
    .locator('#estimate-form [name="customer"]')
    .fill("Cliente descontos");
  let rows = page.locator("#estimate-items [data-row]");
  await rows.nth(0).locator('[data-item="minutes"]').fill("10");
  await rows.nth(0).locator("[data-copy]").click();
  rows = page.locator("#estimate-items [data-row]");
  await rows.nth(0).locator('[data-item="laserMinutePrice"]').fill("2");
  await rows
    .nth(0)
    .locator('[data-item="discountType"]')
    .selectOption("percent");
  await rows.nth(0).locator('[data-item="discount"]').fill("10");
  await expect(rows.nth(0).locator("[data-item-result]")).toContainText(
    "18,00",
  );
  await expect(
    rows.nth(0).locator("[data-laser-rate-reference]"),
  ).toContainText("personalizado");
  await expect(
    rows.nth(1).locator('[data-item="laserMinutePrice"]'),
  ).toHaveValue("");
  await expect(rows.nth(1).locator('[data-item="discount"]')).toHaveValue("0");
  await page.locator("#estimate-commercial").evaluate((e) => (e.open = true));
  await page.locator('#estimate-form [name="discount"]').fill("3");
  await expect(page.locator("[data-discount-summary]")).toContainText(
    "Total de descontos: R$",
  );
  await page.locator("#estimate-save").click();
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem("papeled-issued-estimates-v1")))).toBe(true);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("papeled-issued-estimates-v1"))[0],
  );
  expect(saved.items[0].laserMinutePrice).toBe(2);
  expect(saved.items[0].discount).toBe(10);
  expect(saved.items[1].laserMinutePrice).toBeNull();
  expect(saved.items[1].discount).toBe(0);
  expect(saved.discount).toBe(3);
  expect(saved.pricing.laserSaleHour).not.toBe(120);
  await page.locator('[data-tab="estimate-history"]').click();
  await page
    .locator("#estimate-history-list [data-open-estimate]")
    .first()
    .click();
  await expect(
    rows.nth(0).locator('[data-item="laserMinutePrice"]'),
  ).toHaveValue("2");
  await expect(rows.nth(0).locator('[data-item="discountType"]')).toHaveValue(
    "percent",
  );
  await rows.nth(0).locator('[data-item="laserMinutePrice"]').fill("");
  await expect(page.locator("#estimate-save")).toBeEnabled();
  await page.locator("#estimate-save").click();
  const restored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("papeled-issued-estimates-v1"))[0],
  );
  expect(restored.items[0].laserMinutePrice).toBeNull();
  expect(restored.pricing).toEqual(saved.pricing);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
