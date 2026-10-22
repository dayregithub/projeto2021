import { test, expect } from "./fixtures.js";
test("leave confirmation only appears for changes and saved PDF starts a fresh quote without repeated questions", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await page.locator('#estimate-form [name="customer"]').fill("Cliente salvo");
  await page
    .locator('#estimate-form [name="customerPhone"]')
    .fill("61992430051");
  await page
    .locator('#estimate-form [name="customerEmail"]')
    .fill("cliente@example.com");
  await page.locator('[data-item="minutes"]').fill("60");
  await page.locator('[data-tab="finance"]').click();
  await expect(page.locator("#estimate-leave-dialog")).toBeVisible();
  await expect(page.locator('[data-section="finance"]')).toBeHidden();
  await page.locator("#estimate-leave-back").click();
  await expect(page.locator("#estimate-editor")).toBeVisible();
  await page.locator('[data-tab="finance"]').click();
  await page.locator("#estimate-leave-save").click();
  await expect(page.locator('[data-section="finance"]')).toBeVisible();
  await page.locator('[data-tab="estimates"]').click();
  const download = page.waitForEvent("download");
  await page.locator("#estimate-pdf").click();
  await download;
  await expect(page.locator("#estimate-pdf")).toBeEnabled();
  await page.locator("#estimate-new").click();
  await expect(page.locator("#estimate-leave-dialog")).toBeHidden();
  await expect(page.locator("#estimate-new-dialog")).toBeHidden();
  await expect(page.locator('#estimate-form [name="customer"]')).toHaveValue(
    "",
  );
  await page.locator('#estimate-form [name="customer"]').fill("Descartar este");
  await page.locator('[data-tab="estimate-history"]').click();
  await page.locator("#estimate-leave-discard").click();
  await expect(page.locator("#estimate-history-list")).toContainText(
    "Cliente salvo",
  );
  await expect(page.locator("#estimate-history-list")).not.toContainText(
    "Descartar este",
  );
  await page.reload();
  await page.locator('[data-tab="estimate-history"]').click();
  await page.locator("[data-open-estimate]").first().click();
  await expect(
    page.locator('#estimate-form [name="customerPhone"]'),
  ).toHaveValue("61992430051");
  await expect(
    page.locator('#estimate-form [name="customerEmail"]'),
  ).toHaveValue("cliente@example.com");
  await page.locator("#estimate-new").click();
  await expect(page.locator("#estimate-leave-dialog")).toBeHidden();
});
test("cancel preserves records and payments and deletion requires confirmation before removing history and finance", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await page
    .locator('#estimate-form [name="customer"]')
    .fill("Cliente cancelado");
  await page.locator('[data-item="minutes"]').fill("60");
  await page.locator("#estimate-save").click();
  await page.locator('[data-tab="production"]').click();
  await page.locator("[data-estimate-card] details summary").click();
  await page.locator("[data-payment-change]").selectOption("paid");
  await page.locator('[data-tab="estimate-history"]').click();
  await page.locator("[data-cancel-record]").click();
  await expect(page.locator("#estimate-record-dialog")).toBeVisible();
  await page.locator("#estimate-record-back").click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("papeled-issued-estimates-v1"))[0]
          .status,
    ),
  ).toBe("draft");
  await page.locator("[data-cancel-record]").click();
  await page.locator("#estimate-record-confirm").click();
  await expect(page.locator("#estimate-history-list")).toContainText(
    "cancelado",
  );
  let record = await page.evaluate(
    () => JSON.parse(localStorage.getItem("papeled-issued-estimates-v1"))[0],
  );
  expect(record.status).toBe("cancelled");
  expect(record.paymentStatus).toBe("paid");
  expect(record.paymentDate).toBeTruthy();
  await page.locator("[data-delete-record]").click();
  await page.locator("#estimate-record-back").click();
  await expect(page.locator("#estimate-history-list")).toContainText(
    "Cliente cancelado",
  );
  await page.locator("[data-delete-record]").click();
  await page.locator("#estimate-record-confirm").click();
  await expect(page.locator("#estimate-history-list")).not.toContainText(
    "Cliente cancelado",
  );
  await page.reload();
  await page.locator('[data-tab="estimate-history"]').click();
  await expect(page.locator("#estimate-history-list")).not.toContainText(
    "Cliente cancelado",
  );
  await page.locator('[data-tab="finance"]').click();
  await page.locator("#finance-period").selectOption("all");
  await expect(page.locator("#finance-summary .metric").first()).toContainText(
    "0,00",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("papeled-issued-estimates-v1")).length,
    ),
  ).toBe(0);
});
