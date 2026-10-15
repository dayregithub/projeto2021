import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const open = async (page, model) => {
  await page.goto("/");
  await page.locator(`[data-model="${model}"]`).click();
  await expect(page.locator("#editor-view")).toBeVisible();
};
test("catalogue search, process filters and empty state", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".model-card")).toHaveCount(8);
  await page.locator('[data-filter="print"]').click();
  await expect(page.locator(".model-card")).toHaveCount(2);
  await page.locator('[data-filter="all"]').click();
  await page.locator("#search").fill("divisorias");
  await expect(page.locator(".model-card")).toHaveCount(2);
  await page.locator("#search").fill("semresultado");
  await expect(page.locator(".empty-state")).toBeVisible();
  await page.locator("#clear-search").click();
  await expect(page.locator(".model-card")).toHaveCount(8);
});
test("grid edits update geometry, panel count, validity and downloadable files", async ({
  page,
}) => {
  await open(page, "grid");
  await page.locator("#width").fill("300");
  await page.locator("#cols").fill("4");
  await expect(page.locator("#part-count")).toHaveText("9");
  await expect(page.locator("#project-stats")).toContainText(
    "8 compartimentos",
  );
  await page.locator('[data-view="2d"]').click();
  await expect(page.locator("#preview path")).toHaveCount(9);
  await page.locator("#export-project").click();
  const wait = page.waitForEvent("download");
  await page.locator('[data-export="svg"]').click();
  const file = await wait,
    svg = await readFile(await file.path(), "utf8");
  expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  const baseDimensions = await page.evaluate((s) => {
    const d = new DOMParser().parseFromString(s, "image/svg+xml");
    const numbers = d
      .querySelector("path")
      .getAttribute("d")
      .match(/[\d.]+/g)
      .map(Number);
    return [numbers[2] - numbers[0], numbers[5] - numbers[1]];
  }, svg);
  expect(baseDimensions).toEqual([300, 180]);
  expect((svg.match(/<path /g) || []).length).toBe(9);
  const parsed = await page.evaluate(
    (s) =>
      new DOMParser()
        .parseFromString(s, "image/svg+xml")
        .querySelector("parsererror")?.textContent || "",
    svg,
  );
  expect(parsed).toBe("");
  const dxfWait = page.waitForEvent("download");
  await page.locator('[data-export="dxf"]').click();
  const dxf = await readFile(await (await dxfWait).path(), "utf8");
  expect(dxf).toContain("$INSUNITS\n70\n4");
  await page.keyboard.press("Escape");
  await page.locator("#width").fill("40");
  await expect(page.locator("#validation")).toBeVisible();
  await expect(page.locator("#export-project")).toBeDisabled();
  await page.locator("#width").fill("300");
  await expect(page.locator("#validation")).toBeHidden();
  await page.locator("#width").fill("");
  await expect(page.locator("#save-project")).toBeDisabled();
});
test("asymmetric divisions, camera, exploded view and model switching", async ({
  page,
}) => {
  await open(page, "custom");
  const before = await page.locator("#preview").innerHTML();
  await page.locator("#ratio").fill("75");
  await expect(page.locator("#ratio-value")).toHaveText("75%");
  expect(await page.locator("#preview").innerHTML()).not.toBe(before);
  await page.locator("#rotate-right").click();
  const rotated = await page.locator("#preview").innerHTML();
  await page.locator("#explode").click();
  expect(await page.locator("#preview").innerHTML()).not.toBe(rotated);
  await page.locator("#back-models").click();
  await page.locator('[data-model="open"]').click();
  await page.locator("#add-dividers").click();
  await expect(page.locator("#editor-model-title")).toHaveText(
    "Divisórias em grade",
  );
  await expect(page.locator("#part-count")).toHaveText("7");
});
test("saved projects survive reload, can update without duplicates and be deleted", async ({
  page,
}) => {
  await open(page, "grid");
  await page.locator("#project-name").fill("Minha oficina");
  await page.locator("#width").fill("310");
  await page.locator("#save-project").click();
  await expect(page.locator("#saved-count")).toHaveText("1");
  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.locator("#width")).toHaveValue("310");
  await expect(page.locator("#project-name")).toHaveValue("Minha oficina");
  await page.locator("#height").fill("75");
  await page.locator("#save-project").click();
  await expect(page.locator("#saved-count")).toHaveText("1");
  await page.locator('[data-nav="projetos"]').click();
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await page.locator("[data-saved]").click();
  await expect(page.locator("#height")).toHaveValue("75");
  await page.locator('[data-nav="projetos"]').click();
  await page.locator("[data-delete]").click();
  await page.locator("#confirm-ok").click();
  await expect(page.locator(".saved-card")).toHaveCount(0);
  await expect(page.locator("#saved-count")).toHaveText("0");
});
test("JSON export/import preserves settings and rejects invalid files", async ({
  page,
}) => {
  await open(page, "drawers");
  await page.locator("#width").fill("360");
  await page.locator("#rows").fill("4");
  await page.locator("#project-name").fill("Gavetas & ferramentas");
  await page.locator("#export-project").click();
  const event = page.waitForEvent("download");
  await page.locator('[data-export="json"]').click();
  const json = await readFile(await (await event).path(), "utf8");
  expect(JSON.parse(json).rows).toBe(4);
  await page.keyboard.press("Escape");
  await page.locator("#back-models").click();
  await page
    .locator("#project-file")
    .setInputFiles({
      name: "teste.papeled.json",
      mimeType: "application/json",
      buffer: Buffer.from(json),
    });
  await expect(page.locator("#width")).toHaveValue("360");
  await expect(page.locator("#rows")).toHaveValue("4");
  await expect(page.locator("#project-name")).toHaveValue(
    "Gavetas & ferramentas",
  );
  await page.locator("#back-models").click();
  await page
    .locator("#project-file")
    .setInputFiles({
      name: "invalido.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":1,"model":"naoexiste"}'),
    });
  await expect(page.locator("#toast")).toContainText("Use um arquivo");
  await expect(page.locator("#catalog-view")).toBeVisible();
});
test("3D model exports STL, has no 2D panel export, and can add partitions", async ({
  page,
}) => {
  await open(page, "print");
  await page.locator("#add-dividers").click();
  await expect(page.locator("#editor-model-title")).toHaveText(
    "Organizador 3D",
  );
  await expect(page.locator('[data-view="2d"]')).toBeDisabled();
  await page.locator("#export-project").click();
  await expect(page.locator('[data-export="svg"]')).toHaveCount(0);
  const event = page.waitForEvent("download");
  await page.locator('[data-export="stl"]').click();
  const stl = await readFile(await (await event).path(), "utf8");
  expect(stl).toContain("solid papeled_maker");
  expect((stl.match(/facet normal/g) || []).length).toBeGreaterThan(100);
});
test("drawer preview and quote capture actual model parameters without sending anything", async ({
  page,
}) => {
  await open(page, "drawers");
  const old = await page.locator("#preview").innerHTML();
  await page.locator("#drawer-open").fill("100");
  expect(await page.locator("#preview").innerHTML()).not.toBe(old);
  await page.locator("#cols").fill("3");
  await page.locator("#clearance").fill("0.8");
  await page.locator("#quote-project").click();
  await page
    .locator("#quote-message")
    .fill("Olá! Caixa para peças & ferramentas.");
  const url = new URL(
    await page.locator("#quote-whatsapp").getAttribute("href"),
  );
  expect(url.pathname).toBe("/5561992430051");
  expect(url.searchParams.get("text")).toBe(
    "Olá! Caixa para peças & ferramentas.",
  );
  expect(
    decodeURIComponent(await page.locator("#quote-email").getAttribute("href")),
  ).toContain("papeledmaker@gmail.com");
});
test("mobile: no horizontal overflow, models usable, export and help fit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/papeled-mobile-catalog.png",
    fullPage: true,
  });
  await page.locator('[data-model="drawers"]').click();
  await page.locator("#cols").fill("3");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/papeled-mobile-editor.png",
    fullPage: true,
  });
  await page.locator("#export-project").click();
  await expect(page.locator("#export-dialog")).toBeInViewport();
  await page.keyboard.press("Escape");
  await page.locator("#how-button").click();
  await expect(page.locator("#help-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
