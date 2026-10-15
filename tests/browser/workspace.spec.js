import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { MODELS } from "../../src/models.js";
const open = async (page, model) => {
  await page.goto("/");
  await page.locator(`[data-model="${model}"]`).click();
  await expect(page.locator("#editor-view")).toBeVisible();
};
test("catalogue search, process filters and empty state", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".model-card")).toHaveCount(MODELS.length);
  await page.locator('[data-filter="print"]').click();
  await expect(page.locator(".model-card")).toHaveCount(
    MODELS.filter((m) => m.category === "print").length,
  );
  await page.locator('[data-filter="all"]').click();
  await page.locator("#search").fill("divisorias");
  await expect(page.locator(".model-card")).toHaveCount(2);
  await page.locator("#search").fill("semresultado");
  await expect(page.locator(".empty-state")).toBeVisible();
  await page.locator("#clear-search").click();
  await expect(page.locator(".model-card")).toHaveCount(MODELS.length);
});
test("grid edits update geometry, panel count, validity and downloadable files", async ({
  page,
}) => {
  await open(page, "grid");
  await page.locator("#width").fill("300");
  await page.locator("#cols").fill("4");
  await expect(page.locator("#part-count")).toHaveText("12");
  await expect(page.locator("#project-stats")).toContainText(
    "8 compartimentos",
  );
  await page.locator('[data-view="2d"]').click();
  await expect(page.locator("#preview path")).toHaveCount(12);
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
  expect((svg.match(/<path /g) || []).length).toBe(12);
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
  await expect(page.locator("#part-count")).toHaveText("8");
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
  await page.locator("#project-file").setInputFiles({
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
  await page.locator("#project-file").setInputFiles({
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

test("box joinery changes contours, T hardware notes, and finger pitch", async ({
  page,
}) => {
  await open(page, "open");
  const straight = await page.locator("#preview").innerHTML();
  await page.locator('[data-joint="finger"]').click();
  await expect(page.locator("#finger-size-label")).toBeVisible();
  await page.locator("#fingerSize").fill("12");
  await expect(page.locator("#finger-size-value")).toHaveText("12 mm");
  expect(await page.locator("#preview").innerHTML()).not.toBe(straight);
  await page.locator("#export-project").click();
  const event = page.waitForEvent("download");
  await page.locator('[data-export="svg"]').click();
  const svg = await readFile(await (await event).path(), "utf8");
  expect(svg).toContain("Encaixes de dedo");
  expect((svg.match(/[ML]/g) || []).length).toBeGreaterThan(70);
  await page.keyboard.press("Escape");
  await page.locator('[data-joint="tslot"]').click();
  await expect(page.locator("#joint-hint")).toContainText("M3");
  await expect(page.locator("#summary-metrics")).toContainText("181,2");
  await page.locator("#quote-project").click();
  expect(await page.locator("#quote-message").inputValue()).toContain(
    "União: T",
  );
  await page.keyboard.press("Escape");
  await page.locator("#height").fill("20");
  await expect(page.locator("#export-project")).toBeDisabled();
});
test("all three lids support open-close, real panels and partitions", async ({
  page,
}) => {
  await open(page, "grid");
  for (const [lid, count] of [
    ["removable", "12"],
    ["sliding", "16"],
    ["hinged", "18"],
  ]) {
    await page.selectOption("#lid-type", lid);
    await expect(page.locator("#part-count")).toHaveText(count);
    const before = await page.locator("#preview").innerHTML();
    await page.locator("#toggle-lid").click();
    await expect(page.locator("#lid-opening-value")).toHaveText(
      lid === "hinged" ? "0°" : "0%",
    );
    expect(await page.locator("#preview").innerHTML()).not.toBe(before);
    await page.locator("#toggle-lid").click();
    await expect(page.locator("#toggle-lid")).toHaveText("Fechar tampa");
  }
  await page.locator("#pivotDiameter").fill("8");
  await page.locator("#lidHeight").fill("12");
  await page.locator("#quote-project").click();
  const quote = await page.locator("#quote-message").inputValue();
  expect(quote).toContain("Dobradiça integrada");
  expect(quote).toContain("pivô: Ø8");
  await page.keyboard.press("Escape");
  await page.locator("#export-project").click();
  const event = page.waitForEvent("download");
  await page.locator('[data-export="json"]').click();
  const data = JSON.parse(await readFile(await (await event).path(), "utf8"));
  expect(data.lidType).toBe("hinged");
  expect(data.pivotDiameter).toBe(8);
  expect(data.lidHeight).toBe(12);
});
test("legacy projects remain editable; removed model is absent; print and drawers keep independent construction", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('[data-model="bin"]')).toHaveCount(0);
  await expect(page.locator('[data-model="hinged"]')).toHaveCount(1);
  await expect(page.locator('[data-model="sliding"]')).toHaveCount(1);
  const legacy = {
    version: 1,
    model: "bin",
    name: "Projeto antigo",
    width: 220,
    depth: 180,
    height: 110,
    thickness: 3,
    cols: 1,
    rows: 1,
    ratio: 60,
    clearance: 0.6,
    finish: "natural",
  };
  await page.locator("#project-file").setInputFiles({
    name: "antigo.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await expect(page.locator("#editor-model-title")).toHaveText("Caixa aberta");
  await expect(page.locator('[data-joint="straight"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.selectOption("#lid-type", "sliding");
  await expect(page.locator("#export-project")).toBeEnabled();
  await page.locator("#back-models").click();
  await page.locator('[data-model="drawers"]').click();
  await expect(page.locator("#construction-section")).toBeVisible();
  await expect(page.locator("#lid-section")).toBeHidden();
});
test("hinge controls work on small screens without overflow or script errors", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "hinged");
  await page.locator("#lidOpening").fill("60");
  await expect(page.locator("#lid-opening-value")).toHaveText("60°");
  await page.locator("#pivotDiameter").fill("10");
  await page.locator("#save-project").click();
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator("#pivotDiameter")).toHaveValue("10");
  await expect(page.locator("#lid-type")).toHaveValue("hinged");
  await expect(page.locator("#lidOpening")).toHaveValue("60");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/papeled-hinge-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("usage and process filters combine and reset after an empty search", async ({
  page,
}) => {
  await page.goto("/");
  await page.selectOption("#use-filter", "desk");
  await expect(page.locator(".model-card")).toHaveCount(
    MODELS.filter((m) => m.usage === "desk").length,
  );
  await page.locator('[data-filter="laser"]').click();
  await expect(page.locator(".model-card")).toHaveCount(
    MODELS.filter((m) => m.usage === "desk" && m.category === "laser").length,
  );
  await expect(page.locator('[data-model="deskdrawers"]')).toBeVisible();
  await page.locator("#search").fill("semresultados");
  await page.locator("#clear-search").click();
  await expect(page.locator("#use-filter")).toHaveValue("all");
  await expect(page.locator(".model-card")).toHaveCount(MODELS.length);
});
test("new models expose the right family controls and preserve preset identity", async ({
  page,
}) => {
  await open(page, "tea");
  await expect(page.locator("#lid-type")).toHaveValue("hinged");
  await expect(page.locator("#cols")).toHaveValue("3");
  await expect(page.locator("#rows")).toHaveValue("2");
  await expect(page.locator("#part-count")).toHaveText("18");
  await page.locator("#project-name").fill("Meu porta-chás");
  await page.locator("#save-project").click();
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator("#editor-model-title")).toHaveText(
    "Porta-chás articulado",
  );
  await expect(page.locator("#project-name")).toHaveValue("Meu porta-chás");
  await page.locator("#quote-project").click();
  expect(await page.locator("#quote-message").inputValue()).toContain(
    "Modelo: Porta-chás articulado",
  );
  await page.keyboard.press("Escape");
  await open(page, "jewelry");
  await expect(page.locator("#ratio-label")).toBeVisible();
  await expect(page.locator("#compartment-info")).toContainText(
    "4 compartimentos",
  );
  await open(page, "deskdrawers");
  await expect(page.locator("#drawer-open-label")).toBeVisible();
  await expect(page.locator("#construction-section")).toBeVisible();
  await expect(page.locator("#parts-list")).toContainText("Gaveta 3.1");
  await open(page, "painttray");
  await expect(page.locator('[data-view="2d"]')).toBeDisabled();
  await expect(page.locator("#project-stats")).toContainText(
    "8 compartimentos",
  );
  await page.locator("#export-project").click();
  const event = page.waitForEvent("download");
  await page.locator('[data-export="stl"]').click();
  expect((await event).suggestedFilename()).toBe("bandeja-para-miniaturas.stl");
});
test("compact SVG-inspired presets open with specified dimensions and mobile filtering fits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page, "compacthinge");
  await expect(page.locator("#width")).toHaveValue("106");
  await expect(page.locator("#depth")).toHaveValue("150");
  await expect(page.locator("#height")).toHaveValue("50");
  await page.locator("#back-models").click();
  await page.selectOption("#use-filter", "gifts");
  await page.locator('[data-model="compactslider"]').click();
  await expect(page.locator("#width")).toHaveValue("125");
  await expect(page.locator("#lid-type")).toHaveValue("sliding");
  await page.locator("#back-models").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/papeled-new-products-mobile.png",
    fullPage: true,
  });
});

test("new integral shaft lid supports cutouts and names with separate manufacturing layers and JSON persistence", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "heartbox");
  await expect(page.locator("#hinge-type")).toHaveValue("tabbed");
  await expect(page.locator("#part-count")).toHaveText("6");
  await expect(page.locator("#integral-guide")).toBeVisible();
  await page.locator("#engraveName").fill("João & Ana");
  await expect(page.locator("#lidOpening")).toHaveValue("0");
  await page.selectOption("#lid-cutout", "star");
  await page.locator("#export-project").click();
  let wait = page.waitForEvent("download");
  await page.locator('[data-export="svg"]').click();
  const svg = await readFile(await (await wait).path(), "utf8");
  expect(svg).toContain('id="ENGRAVE"');
  expect(svg.split('id="ENGRAVE"')[1]).toContain("<path");
  wait = page.waitForEvent("download");
  await page.locator('[data-export="json"]').click();
  const json = JSON.parse(await readFile(await (await wait).path(), "utf8"));
  expect(json).toMatchObject({
    hingeType: "tabbed",
    lidCutout: "star",
    engraveName: "João & Ana",
  });
  await page.keyboard.press("Escape");
  await page.selectOption("#hinge-type", "laser");
  await expect(page.locator("#hinge-guide")).toBeVisible();
  await expect(page.locator("#parts-list")).toContainText("Disco-pivô");
  await expect(page.locator("#parts-list")).toContainText("Eixo recortado");
  await expect(page.locator("#export-project")).toBeEnabled();
  expect(errors).toEqual([]);
});

test("laser subassemblies inherit or override joints while printing stays single-piece", async ({
  page,
}) => {
  await open(page, "grid");
  await page.locator("#joint-details summary").click();
  await page.selectOption("#dividerJoint", "finger");
  await expect(page.locator("#export-project")).toBeEnabled();
  await page.selectOption("#lid-type", "sliding");
  await page.selectOption("#railJoint", "tslot");
  await page.selectOption("#lidJoint", "finger");
  await expect(page.locator("#export-project")).toBeEnabled();
  await page.locator('[data-joint="tslot"]').click();
  await page.locator("#inherit-all-joints").click();
  await expect(page.locator("#railJoint")).toHaveValue("inherit");
  await page.selectOption("#lid-type", "hinged");
  await expect(page.locator("#lidHeight")).toHaveValue("18");
  await expect(page.locator("#export-project")).toBeEnabled();
  await open(page, "drawers");
  await expect(page.locator("#construction-section")).toBeVisible();
  await page.locator('[data-joint="finger"]').click();
  await expect(page.locator("#export-project")).toBeEnabled();
  await page.locator("#joint-details summary").click();
  await page.selectOption("#drawerJoint", "straight");
  await expect(page.locator("#export-project")).toBeEnabled();
  await open(page, "print");
  await expect(page.locator("#construction-section")).toBeHidden();
  await expect(page.locator("#decoration-section")).toBeHidden();
});
