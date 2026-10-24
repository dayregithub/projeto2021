import { test, expect } from "./fixtures.js";

test("laser time shorthand and clock notation calculate the same 80-piece quote and retain numeric minutes when reopened", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await page
    .locator('#estimate-form [name="customer"]')
    .fill("Cliente duração");
  await page.locator('[data-item="quantity"]').fill("80");
  const time = page.locator('[data-item="minutes"]');
  await time.fill("1,30");
  await expect(page.locator("[data-laser-time-feedback]")).toContainText(
    "00:01:30",
  );
  await expect(page.locator("[data-time-result]")).toContainText(
    "120 minutos (02:00:00)",
  );
  const total = await page.locator("#estimate-summary").textContent();
  await time.fill("00:01:30");
  await expect(page.locator("[data-time-result]")).toContainText(
    "120 minutos (02:00:00)",
  );
  expect(await page.locator("#estimate-summary").textContent()).toBe(total);
  await page.locator("#estimate-save").click();
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem("papeled-issued-estimates-v1")))).toBe(true);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("papeled-issued-estimates-v1"))[0]
          .items[0].minutes,
    ),
  ).toBe(1.5);
  await page.locator('[data-tab="estimate-history"]').click();
  await page
    .locator("#estimate-history-list [data-open-estimate]")
    .first()
    .click();
  await expect(time).toHaveValue("00:01:30");
  await expect(page.locator("[data-time-result]")).toContainText(
    "120 minutos (02:00:00)",
  );
  await time.fill("1,60");
  await expect(time).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("[data-laser-time-feedback]")).toContainText(
    "Tempo inválido",
  );
  await expect(page.locator("#estimate-save")).toBeDisabled();
  await expect(page.locator("[data-time-result]")).toBeEmpty();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("papeled-issued-estimates-v1"))[0]
          .items[0].minutes,
    ),
  ).toBe(1.5);
  await time.fill("0,05");
  await expect(page.locator("[data-laser-time-feedback]")).toContainText(
    "00:00:05",
  );
  await expect(time).toHaveAttribute("aria-invalid", "false");
});
