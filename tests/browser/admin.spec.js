import { test, expect } from "./fixtures.js";
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
  await page.locator("[data-price-request]").click();
  await expect(page.locator('#estimate-form [name="customer"]')).toHaveValue(
    "Cliente teste",
  );
  await expect(page.locator('#estimate-form [name="contact"]')).toHaveValue(
    "cliente@example.com",
  );
  await page.locator('[data-tab="quotes"]').click();
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

test("panel retrieves the exact downloaded bytes and honors disabling the archive copy", async ({
  page,
  context,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  const site = await context.newPage();
  await site.goto("/");
  await site.locator("#metrics-decline").click();
  await site.locator('[data-group="laser-boxes"]').click();
  await site.locator("#export-project").click();
  const originalPending = site.waitForEvent("download");
  await site.locator('[data-export="svg"]').click();
  const original = await readFile(await (await originalPending).path());
  await expect(site.locator("#archive-export-status")).toContainText(
    "Cópia guardada",
  );
  await page.locator('[data-tab="files"]').click();
  await page.locator("#refresh-files").click();
  await expect(page.locator("[data-download-file]")).toHaveCount(1);
  const copiedPending = page.waitForEvent("download");
  await page.locator("[data-download-file]").click();
  expect(await readFile(await (await copiedPending).path())).toEqual(original);
  await expect(page.locator("#notice")).toContainText("verificada");
  await site.locator("#archive-export").uncheck();
  const second = site.waitForEvent("download");
  await site.locator('[data-export="dxf"]').click();
  await second;
  await page.locator("#refresh-files").click();
  await expect(page.locator("[data-download-file]")).toHaveCount(1);
  await site.locator("#export-dialog [data-close]").click();
  const zipPending = site.waitForEvent("download");
  await site.locator("#quote-project").click();
  const zip = await readFile(await (await zipPending).path());
  await expect(site.locator("#archive-quote-status")).toContainText(
    "Cópia guardada",
  );
  await page.locator("#refresh-files").click();
  await expect(page.locator("[data-download-file]")).toHaveCount(2);
  const zipCopy = page.waitForEvent("download");
  await page.locator("[data-download-file]").first().click();
  expect(await readFile(await (await zipCopy).path())).toEqual(zip);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("[data-delete-file]").first().click();
  await expect(page.locator("[data-download-file]")).toHaveCount(1);
});

test("existing 3D models open the full configurator and return all parameters to a new or existing panel product", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="products"]').click();
  await expect(page.locator("[data-configure-model]")).toHaveCount(5);
  await page.locator('[data-configure-model="toothbrush"]').click();
  await expect(page.locator("#admin-edit-banner")).toBeVisible();
  await expect(page.locator("#brush-options")).toBeVisible();
  await page.locator("#width").fill("88");
  await page.selectOption("#brush-texture", "ribbed");
  await page.selectOption("#brush-cover", "yes");
  await page.locator("#return-admin").click();
  await expect(page.locator("#product-form")).toBeVisible();
  await expect(page.locator('#product-form [name="width"]')).toHaveValue("88");
  await page
    .locator('#product-form [name="title"]')
    .fill("Porta-escovas canelado do estúdio");
  await page.locator('#product-form [name="published"]').check();
  await page
    .locator("#product-form button")
    .filter({ hasText: "Salvar produto" })
    .click();
  await expect(page.locator("#product-list")).toContainText(
    "Porta-escovas canelado do estúdio",
  );
  await page.locator("[data-edit]").click();
  await page.locator("#configure-product").click();
  await expect(page.locator("#brush-texture")).toHaveValue("ribbed");
  await expect(page.locator("#brush-cover")).toHaveValue("yes");
  await expect(page.locator("#width")).toHaveValue("88");
  await page.locator("#width").fill("90");
  await page.locator("#return-admin").click();
  await page
    .locator("#product-form button")
    .filter({ hasText: "Salvar produto" })
    .click();
  await expect(page.locator("#product-list [data-edit]")).toHaveCount(1);
  await expect(page.locator("#product-list")).toContainText("90 × 90");
  await page.locator('[data-use-model="lettering"]').click();
  await expect(page.locator("#product-model")).toHaveValue("lettering");
});

test("60 days and all-time update totals and CSV using the complete local history", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator("#period").selectOption("0");
  await expect(page.locator("#statistics-range")).toContainText(
    "nenhum registro encontrado",
  );
  await expect(page.locator("#chart .bar")).toHaveCount(0);
  const now = new Date().toISOString(),
    old = new Date(Date.now() - 120 * 86400000).toISOString();
  await page.evaluate(
    ({ now, old }) => {
      const data = JSON.parse(
        localStorage.getItem("papeled-console-local-v1") ||
          '{"products":[],"events":[],"quotes":[]}',
      );
      data.events = [
        { kind: "page_view", created_at: now },
        { kind: "page_view", created_at: old },
      ];
      data.quotes = [
        {
          id: "old",
          customer_name: "Teste antigo",
          contact: "teste",
          message: "",
          project: {},
          status: "new",
          created_at: old,
        },
      ];
      localStorage.setItem("papeled-console-local-v1", JSON.stringify(data));
    },
    { now, old },
  );
  await page.locator("#period").selectOption("60");
  await expect(page.locator("#metrics .metric strong").first()).toHaveText("1");
  await expect(page.locator("#metrics .metric strong").nth(3)).toHaveText("0");
  await page.locator("#period").selectOption("0");
  await expect(page.locator("#metrics .metric strong").first()).toHaveText("2");
  await expect(page.locator("#metrics .metric strong").nth(3)).toHaveText("1");
  await expect(page.locator("#statistics-range")).toContainText(
    "histórico completo",
  );
  await expect(page.locator("#statistics-range")).toContainText(
    old.slice(0, 10).split("-").reverse().join("/"),
  );
  await expect(page.locator("#export-stats")).toBeEnabled();
  const pending = page.waitForEvent("download");
  await page.locator("#export-stats").click();
  const csv = await readFile(await (await pending).path(), "utf8");
  expect(csv).toContain(old.slice(0, 10) + ";1;0");
});

test("assistant local proposal previews changes, creates only a draft after click and links to editing", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="assistant"]').click();
  await page.locator("#assistant-demo").click();
  await expect(page.locator("#assistant-result")).toContainText(
    "sem chamada de IA",
  );
  await expect(page.locator("#assistant-proposals")).toContainText(
    "Organizador 3D de bancada",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("papeled-console-local-v1") || '{"products":[]}',
        ).products.length,
    ),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Criar este rascunho", exact: true })
    .click();
  await expect(page.locator("#assistant-proposals")).toContainText(
    "Alteração aplicada",
  );
  await expect(
    page.getByRole("button", { name: "Aplicado", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Abrir produto no formulário", exact: true })
    .click();
  await expect(page.locator("#product-form")).toBeVisible();
  await expect(
    page.locator('#product-form [name="published"]'),
  ).not.toBeChecked();
  await expect(page.locator('#product-form [name="width"]')).toHaveValue("120");
  await page.locator('[data-tab="assistant"]').click();
  await page.locator("#assistant-audit").click();
  await expect(page.locator("#assistant-audit-result")).toContainText(
    "Sem foto",
  );
});

test("owner can exclude this browser from future metrics even with consent enabled", async ({
  page,
  context,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.evaluate(() =>
    localStorage.setItem("papeled-metrics-consent", "yes"),
  );
  await page.locator("#metrics-exclude-browser").check();
  await expect(page.locator("#metrics-exclusion-status")).toContainText(
    "Exclusão ativada",
  );
  const site = await context.newPage();
  await site.goto("/");
  await expect(site.locator("#metrics-consent")).toBeHidden();
  await site.locator('[data-group="laser-boxes"]').click();
  await site.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("papeled-file-download", { detail: "svg" }),
    ),
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("papeled-console-local-v1") || '{"events":[]}',
        ).events,
    ),
  ).toEqual([]);
  await page.reload();
  await expect(page.locator("#metrics-exclude-browser")).toBeChecked();
  await page.locator("#metrics-exclude-browser").uncheck();
  await site.reload();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("papeled-console-local-v1") || '{"events":[]}',
          ).events.filter((e) => e.kind === "page_view").length,
      ),
    )
    .toBe(1);
});
