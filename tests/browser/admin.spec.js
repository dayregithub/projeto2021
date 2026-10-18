import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("local panel publishes a product to this browser, records opted-in metrics and receives a real quote form", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin.html");
  await expect(page.locator("#setup")).toBeVisible();
  await expect(page.locator("#workspace")).toBeHidden();
  await page.locator("#local-preview").click();
  await expect(page.locator("#mode-note")).toContainText("PRÉVIA LOCAL");
  await expect(page.locator("#metrics")).toContainText("0");
  await page.locator('[data-tab="products"]').click();
  await page.locator("#new-product").click();
  await page
    .locator('#product-form [name="title"]')
    .fill("Organizador do estúdio");
  await page
    .locator('#product-form [name="description"]')
    .fill("Uma criação publicada pelo painel.");
  await page.locator('#product-form [name="published"]').check();
  await page
    .locator("#product-form button")
    .filter({ hasText: "Salvar produto" })
    .click();
  await expect(page.locator("#product-list")).toContainText(
    "Organizador do estúdio",
  );
  const site = await context.newPage();
  site.on("pageerror", (e) => errors.push(e.message));
  await site.goto("/");
  await expect(site.locator("#managed-catalog")).toBeVisible();
  await site.locator("#metrics-accept").click();
  await site.locator("#managed-products button").click();
  await expect(site.locator("#project-name")).toHaveValue(
    "Organizador do estúdio",
  );
  await site.locator("#export-project").click();
  let pending = site.waitForEvent("download");
  await site.locator('[data-export="svg"]').click();
  await pending;
  await site.locator("#export-dialog [data-close]").click();
  pending = site.waitForEvent("download");
  await site.locator("#quote-project").click();
  await pending;
  await expect(site.locator("#platform-quote")).toBeVisible();
  await site.locator('#platform-quote [name="customer"]').fill("Cliente teste");
  await site
    .locator('#platform-quote [name="contact"]')
    .fill("cliente@example.com");
  await site
    .locator('#platform-quote [name="message"]')
    .fill("Quero 2 unidades");
  await site.locator('#platform-quote input[type="checkbox"]').check();
  await site.locator("#platform-quote button").click();
  await expect(site.locator("#platform-quote-status")).toContainText("prévia");
  await page.locator('[data-tab="overview"]').click();
  await page.locator("#refresh").click();
  await expect(
    page.locator("#metrics .metric").nth(0).locator("strong"),
  ).toHaveText("1");
  await expect(
    page.locator("#metrics .metric").nth(2).locator("strong"),
  ).toHaveText("2");
  await expect(
    page.locator("#metrics .metric").nth(3).locator("strong"),
  ).toHaveText("1");
  await page.locator('[data-tab="quotes"]').click();
  await expect(page.locator("#quote-list")).toContainText(
    "cliente@example.com",
  );
  await page.locator("[data-quote]").selectOption("contacted");
  await expect(page.locator("#notice")).toContainText("atualizada");
  await page.locator('[data-tab="products"]').click();
  await page.locator("[data-publish]").click();
  await expect(page.locator("#product-list")).toContainText("RASCUNHO");
  await site.reload();
  await expect(site.locator("#managed-catalog")).toBeHidden();
  expect(errors).toEqual([]);
});

test("declining statistics records nothing and mobile panel fits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await expect(page.locator("#workspace")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/");
  await page.locator("#metrics-decline").click();
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("papeled-console-local-v1") || '{"events":[]}',
        ).events,
    ),
  ).toEqual([]);
  await page.goto("/admin.html");
  await page.locator('[data-tab="assistant"]').click();
  await page.locator("#assistant-prompt").fill("Uma descrição de produto");
  await page.locator("#ask-assistant").click();
  await expect(page.locator("#assistant-status")).toContainText(
    "precisa da conexão",
  );
  await page.locator('[data-tab="overview"]').click();
  const pending = page.waitForEvent("download");
  await page.locator("#export-stats").click();
  const csv = await readFile(await (await pending).path(), "utf8");
  expect(csv).toContain("dia_UTC;acessos;downloads");
});
